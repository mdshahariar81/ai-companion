import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";

export type Persona = "sara" | "alex";
export type CoreState =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking";

const PARTICLES = 12000;
const AMBIENT = 900;

const vertexShader = `
  uniform float uTime;
  uniform float uIntensity;

  attribute float aSize;
  attribute float aPhase;

  varying float vAlpha;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

    float breathing =
      sin(uTime * 1.15 + aPhase)
      * 0.012
      * uIntensity;

    float depthScale =
      clamp(
        5.0 / max(0.8, -mvPosition.z),
        0.65,
        1.8
      );

    gl_PointSize =
      aSize
      * depthScale
      * (1.0 + breathing);

    gl_Position = projectionMatrix * mvPosition;

    vAlpha =
      0.52
      + 0.48 * uIntensity;
  }
`;

const fragmentShader = `
  uniform vec3 uColor;

  varying float vAlpha;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;

    float distanceFromCenter = length(uv);

    float glow =
      smoothstep(
        0.5,
        0.0,
        distanceFromCenter
      );

    float core =
      smoothstep(
        0.18,
        0.0,
        distanceFromCenter
      );

    gl_FragColor =
      vec4(
        uColor,
        glow * vAlpha * 0.78
        + core * 0.22
      );
  }
`;

function seeded(seed: number) {
  let value = seed >>> 0;

  return () => {
    value =
      (value * 1664525 + 1013904223) >>> 0;

    return value / 4294967296;
  };
}

/**
 * Convert a real GLB human mesh into evenly distributed particles.
 */
function sampleScene(
  scene: THREE.Object3D,
  seed: number,
) {
  scene.updateMatrixWorld(true);

  const meshes: THREE.Mesh[] = [];

  scene.traverse((object) => {
    const mesh = object as THREE.Mesh;

    if (
      mesh.isMesh &&
      mesh.visible &&
      mesh.geometry?.attributes?.position
    ) {
      meshes.push(mesh);
    }
  });

  if (!meshes.length) {
    throw new Error(
      "PROZYN: no renderable mesh found in GLB asset.",
    );
  }

  /*
   * Allocate particles according to the amount of
   * geometry contained in each mesh.
   */
  const weights = meshes.map(
    (mesh) =>
      mesh.geometry.attributes.position.count,
  );

  const weightTotal = weights.reduce(
    (sum, value) => sum + value,
    0,
  );

  const counts = weights.map((weight) =>
    Math.max(
      40,
      Math.floor(
        (weight / weightTotal) * PARTICLES,
      ),
    ),
  );

  let countTotal = counts.reduce(
    (sum, value) => sum + value,
    0,
  );

  while (countTotal > PARTICLES) {
    let index = counts.length - 1;

    for (let i = 0; i < counts.length; i++) {
      if (counts[i] > counts[index]) {
        index = i;
      }
    }

    if (counts[index] <= 40) {
      break;
    }

    counts[index] -= 1;
    countTotal -= 1;
  }

  while (countTotal < PARTICLES) {
    let index = 0;

    for (let i = 1; i < counts.length; i++) {
      if (weights[i] > weights[index]) {
        index = i;
      }
    }

    counts[index] += 1;
    countTotal += 1;
  }

  const random = seeded(seed);

  const temp = new THREE.Vector3();

  const points: THREE.Vector3[] = [];

  meshes.forEach((mesh, meshIndex) => {
    const sampler =
      new MeshSurfaceSampler(mesh).build();

    for (
      let i = 0;
      i < counts[meshIndex];
      i++
    ) {
      sampler.sample(temp);

      const worldPoint = temp
        .clone()
        .applyMatrix4(mesh.matrixWorld);

      /*
       * Tiny deterministic noise makes the particle
       * surface feel alive instead of perfectly rigid.
       */
      worldPoint.x +=
        (random() - 0.5) * 0.008;

      worldPoint.y +=
        (random() - 0.5) * 0.008;

      worldPoint.z +=
        (random() - 0.5) * 0.008;

      points.push(worldPoint);
    }
  });

  /*
   * Crop the lower part of the model.
   * PROZYN uses an upper-body / bust presentation.
   */
  const box =
    new THREE.Box3().setFromPoints(points);

  const minY = box.min.y;
  const maxY = box.max.y;

  const height =
    Math.max(0.001, maxY - minY);

  const cropY =
    minY + height * 0.28;

  const upperBody =
    points.filter(
      (point) => point.y >= cropY,
    );

  /*
   * If cropping removed too many points,
   * refill from the remaining human surface.
   */
  while (upperBody.length < PARTICLES) {
    const source =
      upperBody[
        Math.floor(
          random() * upperBody.length,
        )
      ];

    upperBody.push(
      new THREE.Vector3(
        source.x +
          (random() - 0.5) * 0.018,

        source.y +
          (random() - 0.5) * 0.018,

        source.z +
          (random() - 0.5) * 0.018,
      ),
    );
  }

  upperBody.length =
    Math.min(
      upperBody.length,
      PARTICLES,
    );

  /*
   * Sorting creates a more coherent
   * SARA ↔ ALEX morph.
   */
  upperBody.sort((a, b) => {
    const y = b.y - a.y;

    if (Math.abs(y) > 0.025) {
      return y;
    }

    return a.x - b.x;
  });

  /*
   * Normalize the human bust so both models
   * occupy the same visual space.
   */
  const finalBox =
    new THREE.Box3().setFromPoints(
      upperBody,
    );

  const center =
    finalBox.getCenter(
      new THREE.Vector3(),
    );

  const finalHeight =
    Math.max(
      0.001,
      finalBox.max.y -
        finalBox.min.y,
    );

  const scale =
    3.9 / finalHeight;

  const output =
    new Float32Array(
      PARTICLES * 3,
    );

  for (
    let i = 0;
    i < PARTICLES;
    i++
  ) {
    const point =
      upperBody[i];

    output[i * 3] =
      (point.x - center.x) *
      scale;

    output[i * 3 + 1] =
      (point.y - center.y) *
      scale;

    output[i * 3 + 2] =
      (point.z - center.z) *
      scale;
  }

  return output;
}

function buildParticleAttributes() {
  const sizes =
    new Float32Array(PARTICLES);

  const phases =
    new Float32Array(PARTICLES);

  const random =
    seeded(81723);

  for (
    let i = 0;
    i < PARTICLES;
    i++
  ) {
    sizes[i] =
      1.35 +
      random() * 2.25;

    phases[i] =
      random() *
      Math.PI *
      2;
  }

  return {
    sizes,
    phases,
  };
}

function HumanParticleSurface({
  persona,
  state,
}: {
  persona: Persona;
  state: CoreState;
}) {
  const sara =
    useGLTF(
      "/models/sara-base.glb",
    );

  const alex =
    useGLTF(
      "/models/alex-base.glb",
    );

  const pointsRef =
    useRef<THREE.Points>(null);

  const materialRef =
    useRef<THREE.ShaderMaterial>(null);

  const targets = useMemo(
    () => ({
      sara: sampleScene(
        sara.scene,
        1201,
      ),

      alex: sampleScene(
        alex.scene,
        9207,
      ),
    }),
    [
      sara.scene,
      alex.scene,
    ],
  );

  const attributes =
    useMemo(
      buildParticleAttributes,
      [],
    );

  /*
   * Start as SARA.
   * Persona changes are handled by
   * the animation loop so the particles
   * actually morph instead of teleporting.
   */
  const current =
    useMemo(
      () =>
        new Float32Array(
          targets.sara,
        ),
      [targets.sara],
    );

  useFrame(
    ({ clock }, delta) => {
      const points =
        pointsRef.current;

      const material =
        materialRef.current;

      if (
        !points ||
        !material
      ) {
        return;
      }

      const target =
        targets[persona];

      const morphSpeed =
        state === "thinking"
          ? 5.5
          : state === "speaking"
            ? 7.5
            : 4.2;

      const blend =
        1 -
        Math.exp(
          -morphSpeed *
            delta,
        );

      /*
       * Smooth particle morph.
       */
      for (
        let i = 0;
        i < current.length;
        i++
      ) {
        current[i] +=
          (target[i] -
            current[i]) *
          blend;
      }

      const position =
        points.geometry.getAttribute(
          "position",
        ) as THREE.BufferAttribute;

      position.array.set(
        current,
      );

      position.needsUpdate =
        true;

      /*
       * State energy.
       */
      const intensity =
        state === "listening"
          ? 1.28
          : state === "thinking"
            ? 1.42
            : state === "speaking"
              ? 1.58
              : 1.0;

      material.uniforms.uTime.value =
        clock.elapsedTime;

      material.uniforms.uIntensity.value =
        intensity;

      /*
       * SARA = cyan.
       * ALEX = violet / blue.
       */
      const baseColor =
        persona === "sara"
          ? new THREE.Color(
              "#68dfff",
            )
          : new THREE.Color(
              "#8d7cff",
            );

      if (
        state === "thinking"
      ) {
        baseColor.lerp(
          new THREE.Color(
            "#c7a6ff",
          ),
          0.28,
        );
      }

      if (
        state === "speaking"
      ) {
        baseColor.lerp(
          new THREE.Color(
            "#ffffff",
          ),
          0.18,
        );
      }

      material.uniforms.uColor.value.copy(
        baseColor,
      );

      /*
       * Very subtle rotation and breathing.
       */
      points.rotation.y =
        Math.sin(
          clock.elapsedTime *
            0.18,
        ) * 0.035;

      points.position.y =
        -0.05 +
        Math.sin(
          clock.elapsedTime *
            1.15,
        ) * 0.018;
    },
  );

  return (
    <points
      ref={pointsRef}
      frustumCulled={false}
    >
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[
            current,
            3,
          ]}
          count={PARTICLES}
        />

        <bufferAttribute
          attach="attributes-aSize"
          args={[
            attributes.sizes,
            1,
          ]}
          count={PARTICLES}
        />

        <bufferAttribute
          attach="attributes-aPhase"
          args={[
            attributes.phases,
            1,
          ]}
          count={PARTICLES}
        />
      </bufferGeometry>

      <shaderMaterial
        ref={materialRef}
        vertexShader={
          vertexShader
        }
        fragmentShader={
          fragmentShader
        }
        uniforms={{
          uTime: {
            value: 0,
          },

          uIntensity: {
            value: 1,
          },

          uColor: {
            value:
              new THREE.Color(
                "#68dfff",
              ),
          },
        }}
        transparent
        depthWrite={false}
        blending={
          THREE.AdditiveBlending
        }
      />
    </points>
  );
}

function AmbientParticles() {
  const pointsRef =
    useRef<THREE.Points>(null);

  const data =
    useMemo(() => {
      const positions =
        new Float32Array(
          AMBIENT * 3,
        );

      const random =
        seeded(44811);

      for (
        let i = 0;
        i < AMBIENT;
        i++
      ) {
        const angle =
          random() *
          Math.PI *
          2;

        const radius =
          2.0 +
          random() *
            2.5;

        positions[i * 3] =
          Math.cos(angle) *
          radius;

        positions[
          i * 3 + 1
        ] =
          (random() - 0.5) *
          4.7;

        positions[
          i * 3 + 2
        ] =
          (random() - 0.5) *
          2.6;
      }

      return {
        positions,
      };
    }, []);

  useFrame(
    ({ clock }) => {
      if (
        !pointsRef.current
      ) {
        return;
      }

      pointsRef.current.rotation.y =
        clock.elapsedTime *
        0.015;

      pointsRef.current.rotation.z =
        Math.sin(
          clock.elapsedTime *
            0.08,
        ) * 0.015;
    },
  );

  return (
    <points
      ref={pointsRef}
      frustumCulled={false}
    >
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[
            data.positions,
            3,
          ]}
          count={AMBIENT}
        />
      </bufferGeometry>

      <pointsMaterial
        size={0.018}
        color="#5ecfff"
        transparent
        opacity={0.45}
        depthWrite={false}
        blending={
          THREE.AdditiveBlending
        }
      />
    </points>
  );
}

function EnergyRings({
  state,
}: {
  state: CoreState;
}) {
  const groupRef =
    useRef<THREE.Group>(null);

  useFrame(
    ({ clock }) => {
      if (
        !groupRef.current
      ) {
        return;
      }

      const speed =
        state === "thinking"
          ? 0.38
          : state === "speaking"
            ? 0.55
            : 0.18;

      groupRef.current.rotation.z =
        clock.elapsedTime *
        speed;

      groupRef.current.rotation.x =
        Math.sin(
          clock.elapsedTime *
            0.12,
        ) * 0.16;
    },
  );

  return (
    <group
      ref={groupRef}
      rotation={[
        0.18,
        0.1,
        0,
      ]}
    >
      {[2.15, 2.55, 2.95].map(
        (
          radius,
          index,
        ) => (
          <mesh
            key={radius}
            rotation={[
              Math.PI / 2,
              index * 0.7,
              index * 0.9,
            ]}
          >
            <torusGeometry
              args={[
                radius,
                0.0035,
                8,
                180,
              ]}
            />

            <meshBasicMaterial
              color={
                index === 1
                  ? "#55dfff"
                  : "#7168ff"
              }
              transparent
              opacity={
                state ===
                "thinking"
                  ? 0.28
                  : 0.16
              }
              depthWrite={false}
              blending={
                THREE.AdditiveBlending
              }
            />
          </mesh>
        ),
      )}
    </group>
  );
}

function Scene({
  persona,
  state,
}: {
  persona: Persona;
  state: CoreState;
}) {
  return (
    <>
      <ambientLight
        intensity={0.3}
      />

      <group
        position={[
          0,
          -0.02,
          0,
        ]}
      >
        <HumanParticleSurface
          persona={persona}
          state={state}
        />

        <EnergyRings
          state={state}
        />
      </group>

      <AmbientParticles />

      <EffectComposer>
        <Bloom
          intensity={1.25}
          luminanceThreshold={
            0.08
          }
          luminanceSmoothing={
            0.72
          }
          mipmapBlur
        />

        <Vignette
          eskil={false}
          offset={0.12}
          darkness={0.62}
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
    <Canvas
      dpr={[1, 1.6]}
      camera={{
        position: [
          0,
          0.05,
          6.2,
        ],
        fov: 34,
        near: 0.1,
        far: 100,
      }}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference:
          "high-performance",
      }}
    >
      <Suspense fallback={null}>
        <Scene
          persona={persona}
          state={state}
        />
      </Suspense>
    </Canvas>
  );
}

useGLTF.preload(
  "/models/sara-base.glb",
);

useGLTF.preload(
  "/models/alex-base.glb",
);
