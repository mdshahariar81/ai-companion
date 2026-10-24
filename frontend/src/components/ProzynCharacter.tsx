import { useGLTF } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  EffectComposer,
  Bloom,
  Vignette,
} from "@react-three/postprocessing";
import { useMemo, useRef } from "react";
import * as THREE from "three";

import type { CoreState, Persona } from "./ProzynCore";

const PARTICLE_COUNT = 9000;

type PointData = {
  sara: Float32Array;
  alex: Float32Array;
};

function seededRandom(seed: number) {
  let value = seed >>> 0;

  return () => {
    value += 0x6d2b79f5;

    let t = value;

    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function collectTriangles(root: THREE.Object3D) {
  const triangles: Array<{
    a: THREE.Vector3;
    b: THREE.Vector3;
    c: THREE.Vector3;
    area: number;
  }> = [];

  const matrix = new THREE.Matrix4();

  root.updateWorldMatrix(true, true);

  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;

    const geometry = object.geometry;

    if (!geometry.attributes.position) return;

    const position = geometry.attributes.position;
    const index = geometry.index;

    matrix.copy(object.matrixWorld);

    const readVertex = (indexValue: number) => {
      const vertex = new THREE.Vector3();

      vertex.fromBufferAttribute(position, indexValue);
      vertex.applyMatrix4(matrix);

      return vertex;
    };

    const addTriangle = (
      ia: number,
      ib: number,
      ic: number,
    ) => {
      const a = readVertex(ia);
      const b = readVertex(ib);
      const c = readVertex(ic);

      const ab = new THREE.Vector3().subVectors(b, a);
      const ac = new THREE.Vector3().subVectors(c, a);

      const area =
        ab.cross(ac).length() * 0.5;

      if (area > 0.000001) {
        triangles.push({
          a,
          b,
          c,
          area,
        });
      }
    };

    if (index) {
      for (let i = 0; i < index.count; i += 3) {
        if (i + 2 >= index.count) break;

        addTriangle(
          index.getX(i),
          index.getX(i + 1),
          index.getX(i + 2),
        );
      }
    } else {
      for (let i = 0; i < position.count; i += 3) {
        if (i + 2 >= position.count) break;

        addTriangle(i, i + 1, i + 2);
      }
    }
  });

  return triangles;
}

/**
 * Converts the full GLB into a compact upper-bust character.
 *
 * Final composition:
 *
 *             HEAD
 *          ┌────────┐
 *          │  FACE  │
 *          └────────┘
 *              │
 *             NECK
 *        ┌────────────┐
 *        │  SHOULDERS │
 *        │    CHEST   │
 *        └────────────┘
 *
 * No legs and no lower torso.
 */
function sampleBust(
  root: THREE.Object3D,
  seed: number,
  count: number,
) {
  const triangles = collectTriangles(root);

  if (!triangles.length) {
    throw new Error(
      "No triangle geometry found in character model.",
    );
  }

  const bounds = new THREE.Box3();

  root.updateWorldMatrix(true, true);

  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;

    object.geometry.computeBoundingBox();

    if (!object.geometry.boundingBox) return;

    const box =
      object.geometry.boundingBox.clone();

    box.applyMatrix4(object.matrixWorld);

    bounds.union(box);
  });

  const minY = bounds.min.y;
  const maxY = bounds.max.y;
  const height = Math.max(
    maxY - minY,
    0.001,
  );

  /*
   * Keep only the upper ~30% of the original
   * character height.
   *
   * This is intentionally much higher than the
   * previous 54% cut because the user wants:
   *
   * head + neck + shoulders + upper chest only.
   */
  const bustCut =
    minY + height * 0.69;

  const usableTriangles =
    triangles.filter(
      ({ a, b, c }) =>
        Math.max(a.y, b.y, c.y) >= bustCut,
    );

  const source =
    usableTriangles.length > 0
      ? usableTriangles
      : triangles;

  let totalArea = 0;

  for (const triangle of source) {
    totalArea += triangle.area;
  }

  const cumulative =
    new Float64Array(source.length);

  let running = 0;

  for (
    let i = 0;
    i < source.length;
    i += 1
  ) {
    running += source[i].area;
    cumulative[i] = running;
  }

  const random = seededRandom(seed);

  const positions =
    new Float32Array(count * 3);

  const sampled = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();

  for (
    let i = 0;
    i < count;
    i += 1
  ) {
    const randomArea =
      random() * totalArea;

    let low = 0;
    let high =
      cumulative.length - 1;

    while (low < high) {
      const mid =
        (low + high) >> 1;

      if (
        cumulative[mid] <
        randomArea
      ) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    const triangle = source[low];

    let u = random();
    let v = random();

    if (u + v > 1) {
      u = 1 - u;
      v = 1 - v;
    }

    ab.subVectors(
      triangle.b,
      triangle.a,
    );

    ac.subVectors(
      triangle.c,
      triangle.a,
    );

    sampled
      .copy(triangle.a)
      .addScaledVector(ab, u)
      .addScaledVector(ac, v);

    positions[i * 3] =
      sampled.x;

    positions[i * 3 + 1] =
      sampled.y;

    positions[i * 3 + 2] =
      sampled.z;
  }

  /*
   * Normalize the compact bust.
   */
  const bustBounds =
    new THREE.Box3();

  const point =
    new THREE.Vector3();

  for (
    let i = 0;
    i < count;
    i += 1
  ) {
    point.set(
      positions[i * 3],
      positions[i * 3 + 1],
      positions[i * 3 + 2],
    );

    bustBounds.expandByPoint(point);
  }

  const center =
    bustBounds.getCenter(
      new THREE.Vector3(),
    );

  const size =
    bustBounds.getSize(
      new THREE.Vector3(),
    );

  /*
   * Character size on screen.
   *
   * Smaller than the previous full-body version.
   */
  const targetHeight = 2.65;

  const scale =
    targetHeight /
    Math.max(size.y, 0.001);

  for (
    let i = 0;
    i < count;
    i += 1
  ) {
    const x =
      positions[i * 3];

    const y =
      positions[i * 3 + 1];

    const z =
      positions[i * 3 + 2];

    positions[i * 3] =
      (x - center.x) * scale;

    positions[i * 3 + 1] =
      (y - center.y) * scale +
      0.12;

    positions[i * 3 + 2] =
      (z - center.z) * scale;
  }

  /*
   * Straighten the visible arms.
   *
   * The source GLB is likely posed with the
   * arms slightly outward. We compress the
   * outer shoulder/arm region inward so the
   * final silhouette becomes a calm,
   * respectful upper-bust pose.
   */
  for (
    let i = 0;
    i < count;
    i += 1
  ) {
    const index = i * 3;

    const x = positions[index];
    const y = positions[index + 1];

    /*
     * Shoulder-to-chest region.
     *
     * Points far away from the center are
     * gently pulled inward.
     */
    if (
      y < 0.55 &&
      Math.abs(x) > 0.68
    ) {
      const side =
        Math.sign(x);

      const distance =
        Math.abs(x);

      const compressed =
        0.68 +
        (distance - 0.68) *
        0.22;

      positions[index] =
        side * compressed;
    }
  }

  return positions;
}

function loadCharacterTargets(): PointData {
  const saraScene =
    useGLTF(
      "/models/sara-base.glb",
    ).scene;

  const alexScene =
    useGLTF(
      "/models/alex-base.glb",
    ).scene;

  return {
    sara: sampleBust(
      saraScene,
      12031,
      PARTICLE_COUNT,
    ),

    alex: sampleBust(
      alexScene,
      42091,
      PARTICLE_COUNT,
    ),
  };
}

function ParticleCharacter({
  persona,
  state,
}: {
  persona: Persona;
  state: CoreState;
}) {
  const pointsRef =
    useRef<THREE.Points>(null);

  const materialRef =
    useRef<THREE.ShaderMaterial>(
      null,
    );

  const { sara, alex } =
    loadCharacterTargets();

  const targets =
    useMemo<PointData>(
      () => ({
        sara,
        alex,
      }),
      [sara, alex],
    );

  const current =
    useMemo(() => {
      const initial =
        new Float32Array(
          PARTICLE_COUNT * 3,
        );

      initial.set(targets.sara);

      return initial;
    }, [targets]);

  const previousPersona =
    useRef<Persona>(persona);

  const morphProgress =
    useRef(
      persona === "sara"
        ? 0
        : 1,
    );

  useFrame(
    (frameState, delta) => {
      const points =
        pointsRef.current;

      const material =
        materialRef.current;

      if (!points || !material) {
        return;
      }

      const target =
        persona === "sara"
          ? targets.sara
          : targets.alex;

      if (
        previousPersona.current !==
        persona
      ) {
        previousPersona.current =
          persona;
      }

      const targetProgress =
        persona === "sara"
          ? 0
          : 1;

      /*
       * Smooth SARA ↔ ALEX morph.
       *
       * The particles never disappear.
       * They physically travel from one
       * identity shape into the other.
       */
      morphProgress.current =
        THREE.MathUtils.damp(
          morphProgress.current,
          targetProgress,
          2.35,
          delta,
        );

      const transition =
        Math.sin(
          morphProgress.current *
            Math.PI,
        );

      const time =
        frameState.clock.elapsedTime;

      const stateIntensity =
        state === "speaking"
          ? 0.95
          : state === "thinking"
            ? 0.72
            : state === "listening"
              ? 0.62
              : 0.22;

      for (
        let i = 0;
        i < current.length;
        i += 3
      ) {
        /*
         * Main identity morph.
         */
        const morph =
          1 -
          Math.exp(
            -6.2 * delta,
          );

        current[i] +=
          (target[i] -
            current[i]) *
          morph;

        current[i + 1] +=
          (target[i + 1] -
            current[i + 1]) *
          morph;

        current[i + 2] +=
          (target[i + 2] -
            current[i + 2]) *
          morph;

        const x =
          current[i];

        const y =
          current[i + 1];

        const z =
          current[i + 2];

        /*
         * Living movement.
         *
         * Very subtle so the identity
         * remains stable while speaking
         * or thinking.
         */
        const phase =
          i * 0.013 +
          time *
            (0.65 +
              stateIntensity *
                0.4);

        const breathing =
          Math.sin(
            time * 1.1 +
              y * 1.8,
          ) *
          0.0045 *
          stateIntensity;

        const microX =
          Math.sin(
            phase +
              z * 2.0,
          ) *
          0.0018 *
          stateIntensity;

        const microY =
          Math.cos(
            phase * 0.8 +
              x * 1.6,
          ) *
          0.0016 *
          stateIntensity;

        current[i] +=
          microX +
          breathing;

        current[i + 1] +=
          microY +
          breathing;

        /*
         * Smooth energy release during
         * SARA ↔ ALEX switching.
         */
        current[i] +=
          Math.sin(
            phase * 1.6,
          ) *
          0.008 *
          transition;

        current[i + 1] +=
          Math.cos(
            phase * 1.2,
          ) *
          0.007 *
          transition;

        current[i + 2] +=
          Math.sin(
            phase * 0.9,
          ) *
          0.006 *
          transition;
      }

      points.geometry.attributes.position.needsUpdate =
        true;

      material.uniforms.uTime.value =
        time;

      material.uniforms.uIntensity.value =
        stateIntensity;

      material.uniforms.uTransition.value =
        transition;

      material.uniforms.uPersona.value =
        persona === "sara"
          ? 0
          : 1;
    },
  );

  const geometry =
    useMemo(() => {
      const buffer =
        new THREE.BufferGeometry();

      buffer.setAttribute(
        "position",
        new THREE.BufferAttribute(
          current,
          3,
        ),
      );

      return buffer;
    }, [current]);

  const uniforms =
    useMemo(
      () => ({
        uTime: { value: 0 },
        uIntensity: {
          value: 0.25,
        },
        uTransition: {
          value: 0,
        },
        uPersona: {
          value: 0,
        },
      }),
      [],
    );

  return (
    <points
      ref={pointsRef}
      geometry={geometry}
      frustumCulled={false}
    >
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={
          THREE.AdditiveBlending
        }
        vertexShader={`
          uniform float uTime;
          uniform float uIntensity;
          uniform float uTransition;

          void main() {
            vec4 mvPosition =
              modelViewMatrix *
              vec4(position, 1.0);

            float breathing =
              sin(
                uTime * 1.15 +
                position.y * 2.0
              ) *
              0.0025 *
              uIntensity;

            mvPosition.x +=
              breathing;

            float transitionWave =
              sin(
                position.y * 5.0 +
                uTime * 2.4
              ) *
              uTransition *
              0.008;

            mvPosition.z +=
              transitionWave;

            gl_Position =
              projectionMatrix *
              mvPosition;

            float distanceScale =
              5.0 /
              max(
                1.0,
                -mvPosition.z
              );

            gl_PointSize =
              2.7 *
              distanceScale;

            gl_PointSize *=
              0.92 +
              uIntensity *
              0.14;
          }
        `}
        fragmentShader={`
          uniform float uTime;
          uniform float uIntensity;
          uniform float uTransition;
          uniform float uPersona;

          void main() {
            vec2 uv =
              gl_PointCoord -
              vec2(0.5);

            float distanceFromCenter =
              length(uv);

            if (
              distanceFromCenter >
              0.5
            ) {
              discard;
            }

            float core =
              1.0 -
              smoothstep(
                0.02,
                0.48,
                distanceFromCenter
              );

            float shimmer =
              0.78 +
              0.22 *
              sin(
                uTime * 2.2 +
                gl_FragCoord.x *
                  0.018 +
                gl_FragCoord.y *
                  0.013
              );

            /*
             * SARA:
             * soft cyan / violet.
             *
             * ALEX:
             * cyan / blue.
             */
            vec3 saraColor =
              vec3(
                0.25,
                0.9,
                1.0
              );

            vec3 alexColor =
              vec3(
                0.38,
                0.62,
                1.0
              );

            vec3 color =
              mix(
                saraColor,
                alexColor,
                uPersona
              );

            float brightness =
              core *
              shimmer *
              (
                0.88 +
                uIntensity *
                  0.22
              );

            /*
             * Slightly brighter transition,
             * without creating a separate
             * energy ring.
             */
            brightness +=
              uTransition *
              core *
              0.18;

            gl_FragColor =
              vec4(
                color * brightness,
                core * 0.96
              );
          }
        `}
      />
    </points>
  );
}

function AmbientParticles() {
  const ref =
    useRef<THREE.Points>(null);

  const data =
    useMemo(() => {
      const count = 700;

      const positions =
        new Float32Array(
          count * 3,
        );

      const random =
        seededRandom(78123);

      for (
        let i = 0;
        i < count;
        i += 1
      ) {
        const radius =
          3.4 +
          random() * 2.5;

        const angle =
          random() *
          Math.PI *
          2;

        positions[i * 3] =
          Math.cos(angle) *
          radius *
          (0.65 +
            random() *
              0.5);

        positions[i * 3 + 1] =
          (random() - 0.5) *
          4.8;

        positions[i * 3 + 2] =
          (random() - 0.5) *
          2.4;
      }

      return positions;
    }, []);

  useFrame(({ clock }) => {
    if (!ref.current) {
      return;
    }

    ref.current.rotation.y =
      Math.sin(
        clock.elapsedTime *
          0.06,
      ) * 0.04;
  });

  return (
    <points
      ref={ref}
      position={[0, 0.05, -0.8]}
    >
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[data, 3]}
        />
      </bufferGeometry>

      <pointsMaterial
        size={0.012}
        transparent
        opacity={0.36}
        color="#5278a8"
        depthWrite={false}
        blending={
          THREE.AdditiveBlending
        }
      />
    </points>
  );
}

function CharacterScene({
  persona,
  state,
}: {
  persona: Persona;
  state: CoreState;
}) {
  return (
    <>
      <color
        attach="background"
        args={["#02070d"]}
      />

      <AmbientParticles />

      <ParticleCharacter
        persona={persona}
        state={state}
      />

      <EffectComposer>
        <Bloom
          intensity={1.3}
          luminanceThreshold={0.1}
          luminanceSmoothing={0.78}
          mipmapBlur
        />

        <Vignette
          darkness={0.68}
          eskil={false}
        />
      </EffectComposer>
    </>
  );
}

export default function ProzynCharacter({
  persona,
  state,
}: {
  persona: Persona;
  state: CoreState;
}) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
      }}
    >
      <Canvas
        dpr={[1, 2]}
        camera={{
          position: [
            0,
            0.08,
            4.65,
          ],
          fov: 32,
          near: 0.1,
          far: 100,
        }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference:
            "high-performance",
        }}
      >
        <CharacterScene
          persona={persona}
          state={state}
        />
      </Canvas>
    </div>
  );
}

useGLTF.preload(
  "/models/sara-base.glb",
);

useGLTF.preload(
  "/models/alex-base.glb",
);
