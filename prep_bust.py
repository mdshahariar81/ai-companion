import sys
import os
import math

import bpy
import bmesh
from mathutils import Vector


TARGET_H = 2.2


# ------------------------------------------------------------
# Arguments
# ------------------------------------------------------------

if "--" not in sys.argv:
    raise SystemExit(
        "Usage: blender -b -P prep_bust.py -- "
        "<input> <output.glb> [rotz=0] [maxtris=250000]"
    )

args = sys.argv[sys.argv.index("--") + 1:]

if len(args) < 2:
    raise SystemExit(
        "Missing input/output arguments."
    )

src = args[0]
dst = args[1]

options = {
    "rotz": 0.0,
    "maxtris": 250000,
}

for arg in args[2:]:
    if "=" not in arg:
        raise SystemExit(f"Invalid option: {arg}")

    key, value = arg.split("=", 1)

    if key not in options:
        raise SystemExit(f"Unknown option: {key}")

    options[key] = float(value)


if not os.path.isfile(src):
    raise SystemExit(f"Input file not found: {src}")


# ------------------------------------------------------------
# 1. Fresh Blender scene
# ------------------------------------------------------------

bpy.ops.wm.read_factory_settings(use_empty=True)


# ------------------------------------------------------------
# 2. Import model
# ------------------------------------------------------------

ext = os.path.splitext(src)[1].lower()

if ext in (".glb", ".gltf"):
    bpy.ops.import_scene.gltf(filepath=src)

elif ext == ".fbx":
    bpy.ops.import_scene.fbx(filepath=src)

elif ext == ".obj":
    if hasattr(bpy.ops.wm, "obj_import"):
        bpy.ops.wm.obj_import(filepath=src)
    else:
        bpy.ops.import_scene.obj(filepath=src)

else:
    raise SystemExit(f"Unsupported file type: {ext}")


# ------------------------------------------------------------
# 3. Find the main human body
#
# Existing models contain:
#   base_female_body / base_male_body
#   high-poly
#   Icosphere
#
# We only keep the main body.
# ------------------------------------------------------------

meshes = [
    obj for obj in bpy.context.scene.objects
    if obj.type == "MESH"
]

if not meshes:
    raise SystemExit("No mesh found.")


body_candidates = [
    obj for obj in meshes
    if "body" in obj.name.lower()
]


if not body_candidates:
    raise SystemExit(
        "Could not find the main body mesh."
    )


body = body_candidates[0]


# ------------------------------------------------------------
# 4. Remove everything except the main body
# ------------------------------------------------------------

for obj in list(bpy.context.scene.objects):

    if obj != body:
        bpy.data.objects.remove(
            obj,
            do_unlink=True
        )


# ------------------------------------------------------------
# 5. Apply transforms
# ------------------------------------------------------------

bpy.context.view_layer.objects.active = body
body.select_set(True)

bpy.ops.object.parent_clear(
    type="CLEAR_KEEP_TRANSFORM"
)

bpy.ops.object.convert(
    target="MESH"
)

bpy.ops.object.transform_apply(
    location=True,
    rotation=True,
    scale=True
)


# ------------------------------------------------------------
# 6. Optional rotation
# ------------------------------------------------------------

if abs(options["rotz"]) > 0.0001:

    body.rotation_euler[2] = math.radians(
        options["rotz"]
    )

    bpy.ops.object.transform_apply(
        rotation=True
    )


# ------------------------------------------------------------
# Bounding box helper
# ------------------------------------------------------------

def get_bounds():

    corners = [
        body.matrix_world @ Vector(c)
        for c in body.bound_box
    ]

    lo = Vector((
        min(v.x for v in corners),
        min(v.y for v in corners),
        min(v.z for v in corners),
    ))

    hi = Vector((
        max(v.x for v in corners),
        max(v.y for v in corners),
        max(v.z for v in corners),
    ))

    return lo, hi


# ------------------------------------------------------------
# 7. Remove lower body if necessary
#
# The existing models are already bust-like.
# We only remove geometry below a conservative chest line.
#
# We DO NOT use the old cut=0.29 logic.
# ------------------------------------------------------------

lo, hi = get_bounds()

height = hi.z - lo.z

# Keep approximately the upper 78% of the model.
# This is intentionally conservative because the supplied
# models are already partial-body models.

cut_ratio = 0.22

z_cut = hi.z - height * cut_ratio


bm = bmesh.new()
bm.from_mesh(body.data)

geom = (
    list(bm.verts)
    + list(bm.edges)
    + list(bm.faces)
)

bmesh.ops.bisect_plane(
    bm,
    geom=geom,
    plane_co=(0, 0, z_cut),
    plane_no=(0, 0, 1),
    clear_inner=True,
    clear_outer=False,
)

bm.to_mesh(body.data)
bm.free()

body.data.update()


# ------------------------------------------------------------
# 8. Remove unused data
# ------------------------------------------------------------

body.data.materials.clear()

for uv in list(body.data.uv_layers):
    body.data.uv_layers.remove(uv)

for color in list(body.data.color_attributes):
    body.data.color_attributes.remove(color)

body.vertex_groups.clear()


# ------------------------------------------------------------
# 9. Smooth shading
# ------------------------------------------------------------

bpy.context.view_layer.objects.active = body
body.select_set(True)

bpy.ops.object.shade_smooth()


# ------------------------------------------------------------
# 10. Decimate if necessary
# ------------------------------------------------------------

triangles = sum(
    len(poly.vertices) - 2
    for poly in body.data.polygons
)

max_triangles = int(
    options["maxtris"]
)

if triangles > max_triangles:

    ratio = max_triangles / triangles

    modifier = body.modifiers.new(
        name="PROZYN_Decimate",
        type="DECIMATE"
    )

    modifier.ratio = ratio

    bpy.ops.object.modifier_apply(
        modifier=modifier.name
    )


# ------------------------------------------------------------
# 11. Normalize height to exactly 2.2
# ------------------------------------------------------------

lo, hi = get_bounds()

height = hi.z - lo.z

if height <= 0:
    raise SystemExit(
        "Invalid model height."
    )


scale = TARGET_H / height

body.scale = (
    scale,
    scale,
    scale,
)

bpy.ops.object.transform_apply(
    scale=True
)


# ------------------------------------------------------------
# 12. Center X/Y and place bottom at Z=0
# ------------------------------------------------------------

lo, hi = get_bounds()

center_x = (lo.x + hi.x) / 2
center_y = (lo.y + hi.y) / 2

body.location = Vector((
    -center_x,
    -center_y,
    -lo.z,
))

bpy.ops.object.transform_apply(
    location=True
)


# ------------------------------------------------------------
# 13. Final dimensions
# ------------------------------------------------------------

lo, hi = get_bounds()

final_width = hi.x - lo.x
final_depth = hi.y - lo.y
final_height = hi.z - lo.z

final_triangles = sum(
    len(poly.vertices) - 2
    for poly in body.data.polygons
)


# ------------------------------------------------------------
# 14. Export GLB
# ------------------------------------------------------------

output_dir = os.path.dirname(
    os.path.abspath(dst)
)

os.makedirs(
    output_dir,
    exist_ok=True
)

bpy.ops.object.select_all(action="DESELECT")
body.select_set(True)

bpy.context.view_layer.objects.active = body


bpy.ops.export_scene.gltf(
    filepath=dst,
    export_format="GLB",
    use_selection=True,
    export_apply=True,
    export_yup=True,
    export_materials="NONE",
    export_texcoords=False,
    export_normals=True,
    export_animations=False,
    export_skins=False,
    export_morph=False,
    export_cameras=False,
    export_lights=False,
    export_draco_mesh_compression_enable=False,
)


# ------------------------------------------------------------
# Done
# ------------------------------------------------------------

print()
print("=" * 60)
print("PROZYN BUST READY")
print("=" * 60)
print(f"Input      : {src}")
print(f"Output     : {dst}")
print(f"Triangles  : {final_triangles:,}")
print(f"Width      : {final_width:.3f}")
print(f"Depth      : {final_depth:.3f}")
print(f"Height     : {final_height:.3f}")
print("=" * 60)