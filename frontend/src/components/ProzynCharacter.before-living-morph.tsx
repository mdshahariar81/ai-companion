import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { useGLTF } from "@react-three/drei";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";
import * as THREE from "three";

export type Persona = "sara" | "alex";

export type CoreState =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking";

const PARTICLES = 12000;
const SAMPLE_POOL = 30000;
const AMBIENT = 650;

/*
 * The character is intentionally presented as a bust:
 *
 * HEAD
 * FACE
 * NECK
 * SHOULDERS
 * UPPER CHEST
 *
 * No full body.
 */

const BUST_HEIGHT = 2.85;

const vertexShader = `
  uniform float uTime;
  uniform float uIntensity;

  attribute float aSize;
  attribute float aPhase;

  varying float vAlpha;

  void main() {
    vec4 mvPosition =
      modelViewMatrix *
      vec4(position, 1.0);

    float breathing =
      sin(
        uTime * 1.15 +
        aPhase
      ) *
      0.012 *
      uIntensity;

    float depthScale =
      clamp(
        5.4 /
        max(
          0.8,
          -mvPosition.z
        ),
        0.7,
        1.8
      );

    gl_PointSize =
      aSize *
      depthScale *
      (1.0 + breathing);

    gl_Position =
      projectionMatrix *
      mvPosition;

    vAlpha =
      0.60 +
      0.40 * uIntensity;
  }
`;

const fragmentShader = `
  uniform vec3 uColor;

  varying float vAlpha;

  void main() {
    vec2 uv =
      gl_PointCoord -
      0.5;

    float distanceFromCenter =
      length(uv);

    float soft =
      smoothstep(
        0.5,
        0.0,
        distanceFromCenter
      );

    float core =
      smoothstep(
        0.20,
        0.0,
        distanceFromCenter
      );

    float alpha =
      soft *
      vAlpha *
      0.78 +
      core *
      0.22;

    if (alpha < 0.01) {
      discard;
    }

    gl_FragColor =
      vec4(
        uColor,
        alpha
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

function shuffle<T>(
  array: T[],
  seed: number,
) {
  const random = seeded(seed);

  for (
    let i = array.length - 1;
    i > 0;
    i--
  ) {
    const j =
      Math.floor(
        random() * (i + 1),
      );

    [array[i], array[j]] = [
      array[j],
      array[i],
    ];
  }

  return array;
}

/**
 * Collect all visible meshes from a GLB.
 */
function collectMeshes(
  scene: THREE.Object3D,
) {
  scene.updateMatrixWorld(true);

  const meshes: THREE.Mesh[] = [];

  scene.traverse((object) => {
    const mesh =
      object as THREE.Mesh;

    if (
      mesh.isMesh &&
      mesh.visible &&
      mesh.geometry?.attributes?.position
    ) {
      meshes.push(mesh);
    }
  });

  return meshes;
}

/**
 * Sample a real 3D human surface.
 *
 * We first create a large point pool.
 * Then we keep only the upper human body.
 * This gives us a proper bust instead of
 * trying to draw a human using geometric shapes.
 */
function sampleHumanBust(
  scene: THREE.Object3D,
  seed: number,
) {
  const meshes =
    collectMeshes(scene);

  if (!meshes.length) {
    throw new Error(
      "PROZYN: no renderable human mesh found.",
    );
  }

  const random =
    seeded(seed);

  const weights =
    meshes.map(
      (mesh) =>
        mesh.geometry
          .attributes
          .position.count,
    );

  const totalWeight =
    weights.reduce(
      (sum, value) =>
        sum + value,
      0,
    );

  const points: THREE.Vector3[] =
    [];

  const temp =
    new THREE.Vector3();

  /*
   * Build a large surface sample.
   */
  meshes.forEach(
    (mesh, meshIndex) => {
      const sampler =
        new MeshSurfaceSampler(
          mesh,
        ).build();

      const meshCount =
        Math.max(
          80,
          Math.floor(
            (weights[meshIndex] /
              totalWeight) *
              SAMPLE_POOL,
          ),
        );

      for (
        let i = 0;
        i < meshCount;
        i++
      ) {
        sampler.sample(temp);

        const world =
          temp
            .clone()
            .applyMatrix4(
              mesh.matrixWorld,
            );

        /*
         * Extremely small irregularity.
         * Keeps the surface organic.
         */
        world.x +=
          (random() - 0.5) *
          0.004;

        world.y +=
          (random() - 0.5) *
          0.004;

        world.z +=
          (random() - 0.5) *
          0.004;

        points.push(world);
      }
    },
  );

  /*
   * Find the complete human bounds.
   */
  const fullBox =
    new THREE.Box3().setFromPoints(
      points,
    );

  const minY =
    fullBox.min.y;

  const maxY =
    fullBox.max.y;

  const height =
    Math.max(
      0.001,
      maxY - minY,
    );

  /*
   * Keep approximately the upper 46%
   * of the human.
   *
   * This removes legs and most of the
   * lower body while retaining:
   *
   * head
   * neck
   * shoulders
   * chest
   */
  const bustStart =
    minY +
    height * 0.54;

  const bustPoints =
    points.filter(
      (point) =>
        point.y >= bustStart,
    );

  /*
   * Randomize the remaining surface
   * before selecting the final particles.
   */
  shuffle(
    bustPoints,
    seed + 991,
  );

  /*
   * We intentionally keep exactly the same
   * particle count for SARA and ALEX.
   */
  const selected =
    bustPoints.slice(
      0,
      Math.min(
        PARTICLES,
        bustPoints.length,
      ),
    );

  /*
   * If the model somehow contains too few
   * particles after cropping, duplicate nearby
   * surface points with tiny variation.
   */
  while (
    selected.length <
    PARTICLES
  ) {
    const source =
      selected[
        Math.floor(
          random() *
            selected.length,
        )
      ];

    selected.push(
      new THREE.Vector3(
        source.x +
          (random() - 0.5) *
            0.012,

        source.y +
          (random() - 0.5) *
            0.012,

        source.z +
          (random() - 0.5) *
            0.012,
      ),
    );
  }

  /*
   * Compute bounds of the final bust.
   */
  const bustBox =
    new THREE.Box3().setFromPoints(
      selected,
    );

  const center =
    bustBox.getCenter(
      new THREE.Vector3(),
    );

  const bustHeight =
    Math.max(
      0.001,
      bustBox.max.y -
        bustBox.min.y,
    );

  /*
   * Normalize both humans to the same
   * visual height.
   */
  const scale =
    BUST_HEIGHT /
    bustHeight;

  const output =
    new Float32Array(
      PARTICLES * 3,
    );

  /*
   * Sort vertically first.
   *
   * This gives the SARA ↔ ALEX morph
   * much better correspondence.
   */
  selected.sort(
    (a, b) => {
      const vertical =
        b.y - a.y;

      if (
        Math.abs(vertical) >
        0.035
      ) {
        return vertical;
      }

      return a.x - b.x;
    },
  );

  for (
    let i = 0;
    i < PARTICLES;
    i++
  ) {
    const point =
      selected[i];

    output[i * 3] =
      (point.x -
        center.x) *
      scale;

    output[i * 3 + 1] =
      (point.y -
        center.y) *
      scale;

    output[i * 3 + 2] =
      (point.z -
        center.z) *
      scale;
  }

  return output;
}

function createParticleAttributes() {
  const sizes =
    new Float32Array(
      PARTICLES,
    );

  const phases =
    new Float32Array(
      PARTICLES,
    );

  const random =
    seeded(712983);

  for (
    let i = 0;
    i < PARTICLES;
    i++
  ) {
    /*
     * Small particles preserve the
     * holographic human appearance.
     */
    sizes[i] =
      1.15 +
      random() * 2.0;

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

function HumanParticleCharacter({
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
    useRef<THREE.ShaderMaterial>(
      null,
    );

  const previousPersona =
    useRef<Persona>(
      persona,
    );

  const transition =
    useRef(0);

  const targets =
    useMemo(
      () => ({
        sara:
          sampleHumanBust(
            sara.scene,
            1201,
          ),

        alex:
          sampleHumanBust(
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
      createParticleAttributes,
      [],
    );

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

      const time =
        clock.elapsedTime;

      /*
       * Detect SARA ↔ ALEX switch.
       */
      if (
        previousPersona.current !==
        persona
      ) {
        previousPersona.current =
          persona;

        transition.current =
          1;
      }

      /*
       * Beautiful but controlled
       * particle transformation.
       *
       * It starts energetic and then
       * settles into the new human.
       */
      transition.current =
        Math.max(
          0,
          transition.current -
            delta * 0.72,
        );

      const transitionPower =
        transition.current *
        transition.current;

      const target =
        targets[persona];

      /*
       * State intensity.
       */
      const stateIntensity =
        state === "thinking"
          ? 1.32
          : state === "speaking"
            ? 1.42
            : state === "listening"
              ? 1.18
              : 1.0;

      /*
       * Faster morph during persona switch.
       * Normal state changes keep the body stable.
       */
      const morphSpeed =
        transition.current >
        0.01
          ? 6.8
          : 4.5;

      const blend =
        1 -
        Math.exp(
          -morphSpeed *
            delta,
        );

      for (
        let i = 0;
        i < PARTICLES;
        i++
      ) {
        const index =
          i * 3;

        const tx =
          target[index];

        const ty =
          target[index + 1];

        const tz =
          target[index + 2];

        /*
         * Vertical human zones.
         *
         * top:
         * head / face
         *
         * middle:
         * neck / shoulders
         *
         * lower:
         * chest
         */
        const head =
          THREE.MathUtils.smoothstep(
            ty,
            0.65,
            1.35,
          );

        const chest =
          1 -
          THREE.MathUtils.smoothstep(
            ty,
            -1.35,
            -0.25,
          );

        /*
         * Subtle breathing.
         */
        const breath =
          Math.sin(
            time * 1.25 +
              attributes.phases[i],
          ) *
          0.006 *
          stateIntensity;

        /*
         * Speaking animation:
         *
         * Face gets the strongest movement.
         * Chest receives a softer voice pulse.
         */
        let speakingOffset =
          0;

        if (
          state === "speaking"
        ) {
          const voice =
            Math.sin(
              time * 7.5 +
                attributes.phases[
                  i
                ],
            );

          const facePulse =
            head *
            voice *
            0.018;

          const chestPulse =
            chest *
            Math.sin(
              time * 4.2 +
                attributes.phases[
                  i
                ] *
                  0.7,
            ) *
            0.006;

          speakingOffset =
            facePulse +
            chestPulse;
        }

        /*
         * Thinking:
         *
         * Small neural-like horizontal
         * particle movement.
         *
         * The human silhouette remains intact.
         */
        let thinkingX =
          0;

        let thinkingZ =
          0;

        if (
          state === "thinking"
        ) {
          const neural =
            Math.sin(
              time * 3.2 +
                ty * 3.4 +
                attributes.phases[
                  i
                ],
            );

          const neural2 =
            Math.cos(
              time * 2.1 +
                tx * 2.7 +
                attributes.phases[
                  i
                ] *
                  0.4,
            );

          thinkingX =
            neural *
            0.009;

          thinkingZ =
            neural2 *
            0.008;
        }

        /*
         * Listening:
         *
         * Very soft outward response.
         */
        let listeningOffset =
          0;

        if (
          state === "listening"
        ) {
          listeningOffset =
            Math.sin(
              time * 2.8 +
                attributes.phases[
                  i
                ],
            ) *
            0.007;
        }

        /*
         * Persona switching effect.
         *
         * Particles make a small controlled
         * orbital flow around their target.
         *
         * They never explode into a huge cloud.
         */
        const orbital =
          transitionPower *
          Math.sin(
            time * 3.8 +
              attributes.phases[
                i
              ],
          ) *
          0.055;

        const swirlX =
          -tz * orbital;

        const swirlZ =
          tx * orbital;

        /*
         * Small radial transition lift.
         */
        const radial =
          transitionPower *
          0.025;

        const length =
          Math.sqrt(
            tx * tx +
              tz * tz,
          ) || 1;

        const radialX =
          (tx / length) *
          radial;

        const radialZ =
          (tz / length) *
          radial;

        /*
         * Final target for this frame.
         */
        const desiredX =
          tx +
          swirlX +
          radialX +
          thinkingX;

        const desiredY =
          ty +
          breath +
          speakingOffset +
          listeningOffset;

        const desiredZ =
          tz +
          swirlZ +
          radialZ +
          thinkingZ;

        current[index] +=
          (desiredX -
            current[index]) *
          blend;

        current[index + 1] +=
          (desiredY -
            current[index + 1]) *
          blend;

        current[index + 2] +=
          (desiredZ -
            current[index + 2]) *
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
       * Character color.
       */
      const color =
        persona === "sara"
          ? new THREE.Color(
              "#66ddff",
            )
          : new THREE.Color(
              "#9a82ff",
            );

      /*
       * Thinking becomes slightly
       * brighter / more intelligent.
       */
      if (
        state === "thinking"
      ) {
        color.lerp(
          new THREE.Color(
            "#d1baff",
          ),
          0.24,
        );
      }

      /*
       * Speaking becomes slightly brighter.
       */
      if (
        state === "speaking"
      ) {
        color.lerp(
          new THREE.Color(
            "#ffffff",
          ),
          0.16,
        );
      }

      material.uniforms.uColor.value.copy(
        color,
      );

      material.uniforms.uTime.value =
        time;

      material.uniforms.uIntensity.value =
        stateIntensity;

      /*
       * Extremely subtle character movement.
       *
       * This keeps the entity alive even
       * when it is doing nothing.
       */
      points.rotation.y =
        Math.sin(
          time * 0.18,
        ) *
        0.018;

      points.rotation.x =
        Math.sin(
          time * 0.12,
        ) *
        0.008;

      points.position.y =
        0.22 +
        Math.sin(
          time * 1.15,
        ) *
          0.012;
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
                "#66ddff",
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

/**
 * Very subtle environmental particles.
 *
 * These are intentionally much quieter than
 * the previous version so the human character
 * remains the visual focus.
 */
function AmbientParticles() {
  const pointsRef =
    useRef<THREE.Points>(null);

  const positions =
    useMemo(() => {
      const data =
        new Float32Array(
          AMBIENT * 3,
        );

      const random =
        seeded(81122);

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
          2.1 +
          random() *
            2.8;

        data[i * 3] =
          Math.cos(angle) *
          radius;

        data[i * 3 + 1] =
          (random() - 0.5) *
          4.2;

        data[i * 3 + 2] =
          (random() - 0.5) *
          2.8;
      }

      return data;
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
        0.012;
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
            positions,
            3,
          ]}
          count={AMBIENT}
        />
      </bufferGeometry>

      <pointsMaterial
        size={0.014}
        color="#6edcff"
        transparent
        opacity={0.30}
        depthWrite={false}
        blending={
          THREE.AdditiveBlending
        }
      />
    </points>
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
      <HumanParticleCharacter
        persona={persona}
        state={state}
      />

      <AmbientParticles />

      <EffectComposer>
        <Bloom
          intensity={1.15}
          luminanceThreshold={0.06}
          luminanceSmoothing={0.76}
          mipmapBlur
        />

        <Vignette
          eskil={false}
          offset={0.10}
          darkness={0.58}
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
