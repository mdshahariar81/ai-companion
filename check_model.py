import bpy
import sys
from mathutils import Vector

path = sys.argv[sys.argv.index("--") + 1]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=path)

meshes = [
    obj for obj in bpy.context.scene.objects
    if obj.type == "MESH"
]

print("\n" + "=" * 60)
print("MODEL:", path)
print("MESHES:", len(meshes))
print("=" * 60)

for obj in meshes:
    corners = [
        obj.matrix_world @ Vector(c)
        for c in obj.bound_box
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

    print(
        f"{obj.name}: "
        f"width={hi.x - lo.x:.3f}, "
        f"depth={hi.y - lo.y:.3f}, "
        f"height={hi.z - lo.z:.3f}"
    )

print("=" * 60)
