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
const AMBIENT = 520;

/*
 * PROZYN character target:
 *
 * Head
 * Face
 * Hair
 * Neck
 * Shoulders
 * Upper chest
 *
 * No full body.
 */
const CHARACTER_HEIGHT = 2.15;
const MORPH_DURATION = 1.55;

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
        uTime * 1.12 +
        aPhase
      ) *
      0.008 *
      uIntensity;

    float depthScale =
      clamp(
        5.5 /
        max(
          0.8,
          -mvPosition.z
        ),
        0.7,
        1.75
      );

    gl_PointSize =
      aSize *
      depthScale *
      (1.0 + breathing);

    gl_Position =
      projectionMatrix *
      mvPosition;

    vAlpha =
      0.62 +
      0.38 * uIntensity;
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

    float glow =
      smoothstep(
        0.5,
        0.0,
        distanceFromCenter
      );

    float core =
      smoothstep(
        0.17,
        0.0,
        distanceFromCenter
      );

    float alpha =
      glow * vAlpha * 0.82 +
      core * 0.20;

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
 * Creates the compact upper-body character.
 *
 * The original GLB is sampled as a real surface,
 * then cropped to the bust area.
 */
function sampleHumanBust(
  scene: THREE.Object3D,
  persona: Persona,
  seed: number,
) {
  const meshes =
    collectMeshes(scene);

  if (!meshes.length) {
    throw new Error(
      "PROZYN: no human mesh found in GLB.",
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

  const temp =
    new THREE.Vector3();

  const points: THREE.Vector3[] =
    [];

  /*
   * Surface sample.
   */
  meshes.forEach(
    (mesh, meshIndex) => {
      const sampler =
        new MeshSurfaceSampler(
          mesh,
        ).build();

      const count =
        Math.max(
          100,
          Math.floor(
            (weights[meshIndex] /
              totalWeight) *
              30000,
          ),
        );

      for (
        let i = 0;
        i < count;
        i++
      ) {
        sampler.sample(temp);

        const point =
          temp
            .clone()
            .applyMatrix4(
              mesh.matrixWorld,
            );

        point.x +=
          (random() - 0.5) *
          0.003;

        point.y +=
          (random() - 0.5) *
          0.003;

        point.z +=
          (random() - 0.5) *
          0.003;

        points.push(point);
      }
    },
  );

  /*
   * Complete model bounds.
   */
  const fullBox =
    new THREE.Box3().setFromPoints(
      points,
    );

  const minY =
    fullBox.min.y;

  const maxY =
    fullBox.max.y;

  const fullHeight =
    Math.max(
      0.001,
      maxY - minY,
    );

  /*
   * Keep only upper-body region.
   *
   * This removes legs and lower body.
   */
  const bustStart =
    minY +
    fullHeight * 0.58;

  let bust =
    points.filter(
      (point) =>
        point.y >= bustStart,
    );

  /*
   * Randomize before selecting.
   */
  for (
    let i = bust.length - 1;
    i > 0;
    i--
  ) {
    const j =
      Math.floor(
        random() * (i + 1),
      );

    [bust[i], bust[j]] = [
      bust[j],
      bust[i],
    ];
  }

  /*
   * Make sure we have enough surface points.
   */
  while (
    bust.length <
    PARTICLES
  ) {
    const source =
      bust[
        Math.floor(
          random() * bust.length,
        )
      ];

    bust.push(
      source.clone(),
    );
  }

  bust =
    bust.slice(
      0,
      PARTICLES,
    );

  /*
   * Calculate normalized bust bounds.
   */
  const box =
    new THREE.Box3().setFromPoints(
      bust,
    );

  const center =
    box.getCenter(
      new THREE.Vector3(),
    );

  const height =
    Math.max(
      0.001,
      box.max.y -
        box.min.y,
    );

  const scale =
    CHARACTER_HEIGHT /
    height;

  const normalized =
    new Array<THREE.Vector3>(
      PARTICLES,
    );

  for (
    let i = 0;
    i < PARTICLES;
    i++
  ) {
    const point =
      bust[i];

    normalized[i] =
      new THREE.Vector3(
        (point.x -
          center.x) *
          scale,

        (point.y -
          center.y) *
          scale,

        (point.z -
          center.z) *
          scale,
      );
  }

  /*
   * Add subtle hair mass.
   *
   * We use particles from the existing
   * character surface and reposition selected
   * head-region particles into a hair silhouette.
   *
   * This keeps hair part of the same particle
   * system, so it morphs naturally with the body.
   */
  const headParticles =
    normalized.filter(
      (point) =>
        point.y > 0.38,
    );

  const hairCount =
    persona === "sara"
      ? 1800
      : 850;

  const hairSource =
    headParticles.length >
    0
      ? headParticles
      : normalized;

  for (
    let i = 0;
    i <
    Math.min(
      hairCount,
      hairSource.length,
    );
    i++
  ) {
    const source =
      hairSource[
        Math.floor(
          random() *
            hairSource.length,
        )
      ];

    const angle =
      random() *
      Math.PI *
      2;

    const side =
      random() > 0.5
        ? 1
        : -1;

    if (
      persona === "sara"
    ) {
      /*
       * Feminine hair:
       *
       * soft crown
       * side framing
       * slightly longer sides
       */
      const length =
        0.18 +
        random() * 0.42;

      const sideAmount =
        Math.abs(
          source.x,
        );

      source.x +=
        Math.cos(angle) *
        0.035;

      source.z -=
        0.05 +
        random() * 0.10;

      source.y =
        Math.max(
          source.y,
          0.48,
        );

      if (
        sideAmount >
        0.22
      ) {
        source.x +=
          side *
          length *
          0.55;

        source.y -=
          random() *
          0.25;
      } else {
        source.x +=
          Math.cos(angle) *
          0.12;

        source.y +=
          random() *
          0.10;
      }
    } else {
      /*
       * Male hair:
       *
       * short crown
       * subtle side hair
       * never long
       */
      source.y =
        Math.max(
          source.y,
          0.74,
        );

      source.x +=
        Math.cos(angle) *
        0.08;

      source.z -=
        0.035;

      if (
        Math.abs(source.x) >
        0.34
      ) {
        source.x +=
          side *
          0.025;
      }
    }
  }

  /*
   * Sort vertically.
   *
   * This makes SARA/ALEX particle
   * correspondence much more stable.
   */
  normalized.sort(
    (a, b) => {
      const vertical =
        b.y - a.y;

      if (
        Math.abs(vertical) >
        0.03
      ) {
        return vertical;
      }

      return a.x - b.x;
    },
  );

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
      normalized[i];

    output[i * 3] =
      point.x;

    output[i * 3 + 1] =
      point.y;

    output[i * 3 + 2] =
      point.z;
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
    seeded(918273);

  for (
    let i = 0;
    i < PARTICLES;
    i++
  ) {
    sizes[i] =
      1.15 +
      random() * 1.9;

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

  /*
   * Previous character shape.
   * Used for the cinematic gather → reform transition.
   */
  const transitionStart =
    useRef(
      new Float32Array(
        PARTICLES * 3,
      ),
    );

  const transitionProgress =
    useRef(1);

  const initialized =
    useRef(false);

  const targets =
    useMemo(
      () => ({
        sara:
          sampleHumanBust(
            sara.scene,
            "sara",
            1201,
          ),

        alex:
          sampleHumanBust(
            alex.scene,
            "alex",
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

  /*
   * Initial transition state.
   */
  if (!initialized.current) {
    transitionStart.current.set(
      current,
    );

    initialized.current =
      true;
  }

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
       * Persona switch detected.
       */
      if (
        previousPersona.current !==
        persona
      ) {
        /*
         * Capture exactly where the current
         * particles are before beginning the
         * transformation.
         */
        transitionStart.current.set(
          current,
        );

        transitionProgress.current =
          0;

        previousPersona.current =
          persona;
      }

      /*
       * Progress from 0 → 1.
       */
      if (
        transitionProgress.current <
        1
      ) {
        transitionProgress.current =
          Math.min(
            1,
            transitionProgress.current +
              delta /
                MORPH_DURATION,
          );
      }

      const progress =
        transitionProgress.current;

      /*
       * Smooth cinematic curve.
       */
      const eased =
        progress *
        progress *
        (3 -
          2 * progress);

      const target =
        targets[persona];

      /*
       * State intensity.
       */
      const intensity =
        state === "thinking"
          ? 1.25
          : state === "speaking"
            ? 1.38
            : state === "listening"
              ? 1.14
              : 1.0;

      /*
       * Human body stays stable during
       * normal state changes.
       */
      const normalBlend =
        1 -
        Math.exp(
          -4.8 * delta,
        );

      /*
       * Persona transition:
       *
       * 0.0 → 0.45
       * old human gathers toward center
       *
       * 0.45 → 1.0
       * new human reforms from center
       */
      const gather =
        Math.sin(
          eased * Math.PI,
        );

      const centerX =
        0;

      const centerY =
        0.12;

      const centerZ =
        0;

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
         * Normal living animation.
         */
        const phase =
          attributes.phases[i];

        /*
         * Very subtle breathing.
         */
        const breathing =
          Math.sin(
            time * 1.15 +
              phase,
          ) *
          0.005 *
          intensity;

        /*
         * Speaking:
         *
         * Face reacts most.
         * Chest reacts softly.
         */
        let speakingX = 0;
        let speakingY = 0;
        let speakingZ = 0;

        if (
          state === "speaking"
        ) {
          const face =
            THREE.MathUtils.smoothstep(
              ty,
              0.55,
              1.20,
            );

          const chest =
            THREE.MathUtils.smoothstep(
              -0.85,
              -0.15,
              ty,
            );

          const voice =
            Math.sin(
              time * 8.0 +
                phase,
            );

          speakingX =
            face *
            voice *
            0.010;

          speakingY =
            face *
            Math.abs(voice) *
            0.006;

          speakingZ =
            chest *
            Math.sin(
              time * 4.5 +
                phase,
            ) *
            0.006;
        }

        /*
         * Thinking:
         *
         * Neural motion remains inside
         * the human silhouette.
         */
        let thinkingX = 0;
        let thinkingZ = 0;

        if (
          state === "thinking"
        ) {
          const neural =
            Math.sin(
              time * 3.0 +
                ty * 4.0 +
                phase,
            );

          const neural2 =
            Math.cos(
              time * 2.3 +
                tx * 3.0 +
                phase,
            );

          thinkingX =
            neural *
            0.006;

          thinkingZ =
            neural2 *
            0.006;
        }

        /*
         * Listening:
         * soft outward response.
         */
        let listeningX = 0;

        if (
          state === "listening"
        ) {
          listeningX =
            Math.sin(
              time * 2.8 +
                phase,
            ) *
            0.005;
        }

        /*
         * Persona transition.
         */
        let desiredX =
          tx;

        let desiredY =
          ty +
          breathing +
          speakingY;

        let desiredZ =
          tz;

        if (
          progress < 1
        ) {
          /*
           * Start from previous character.
           */
          const sx =
            transitionStart.current[
              index
            ];

          const sy =
            transitionStart.current[
              index + 1
            ];

          const sz =
            transitionStart.current[
              index + 2
            ];

          /*
           * Gather target.
           */
          if (
            eased < 0.48
          ) {
            const gatherProgress =
              eased /
              0.48;

            const gatherEase =
              gatherProgress *
              gatherProgress *
              (3 -
                2 *
                  gatherProgress);

            desiredX =
              THREE.MathUtils.lerp(
                sx,
                centerX,
                gatherEase,
              );

            desiredY =
              THREE.MathUtils.lerp(
                sy,
                centerY,
                gatherEase,
              );

            desiredZ =
              THREE.MathUtils.lerp(
                sz,
                centerZ,
                gatherEase,
              );
          } else {
            /*
             * Reform new character.
             */
            const reformProgress =
              (eased - 0.48) /
              0.52;

            const reformEase =
              reformProgress *
              reformProgress *
              (3 -
                2 *
                  reformProgress);

            desiredX =
              THREE.MathUtils.lerp(
                centerX,
                tx,
                reformEase,
              );

            desiredY =
              THREE.MathUtils.lerp(
                centerY,
                ty,
                reformEase,
              );

            desiredZ =
              THREE.MathUtils.lerp(
                centerZ,
                tz,
                reformEase,
              );
          }

          /*
           * Gentle orbital particle flow.
           */
          const swirl =
            gather *
            0.025;

          const angle =
            time * 2.0 +
            phase;

          desiredX +=
            Math.cos(angle) *
            swirl;

          desiredZ +=
            Math.sin(angle) *
            swirl;
        } else {
          desiredX +=
            speakingX +
            thinkingX +
            listeningX;

          desiredZ +=
            speakingZ +
            thinkingZ;
        }

        /*
         * During transition use slightly
         * faster response.
         */
        const blend =
          progress < 1
            ? 1 -
              Math.exp(
                -7.0 * delta,
              )
            : normalBlend;

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
       * Persona colors.
       */
      const color =
        persona === "sara"
          ? new THREE.Color(
              "#68ddff",
            )
          : new THREE.Color(
              "#9a82ff",
            );

      if (
        state === "thinking"
      ) {
        color.lerp(
          new THREE.Color(
            "#d0b8ff",
          ),
          0.18,
        );
      }

      if (
        state === "speaking"
      ) {
        color.lerp(
          new THREE.Color(
            "#ffffff",
          ),
          0.13,
        );
      }

      material.uniforms.uTime.value =
        time;

      material.uniforms.uIntensity.value =
        intensity;

      material.uniforms.uColor.value.copy(
        color,
      );

      /*
       * Tiny natural body movement.
       */
      points.rotation.y =
        Math.sin(
          time * 0.16,
        ) *
        0.012;

      points.rotation.x =
        Math.sin(
          time * 0.11,
        ) *
        0.006;

      points.position.y =
        0.08 +
        Math.sin(
          time * 1.1,
        ) *
          0.009;
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
                "#68ddff",
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

  const positions =
    useMemo(() => {
      const data =
        new Float32Array(
          AMBIENT * 3,
        );

      const random =
        seeded(55128);

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
          2.2 +
          random() *
            2.5;

        data[i * 3] =
          Math.cos(angle) *
          radius;

        data[i * 3 + 1] =
          (random() - 0.5) *
          4.0;

        data[i * 3 + 2] =
          (random() - 0.5) *
          2.6;
      }

      return data;
    }, []);

  useFrame(
    ({ clock }) => {
      if (
        pointsRef.current
      ) {
        pointsRef.current.rotation.y =
          clock.elapsedTime *
          0.01;
      }
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
        color="#69dfff"
        transparent
        opacity={0.28}
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
          intensity={1.05}
          luminanceThreshold={0.07}
          luminanceSmoothing={0.78}
          mipmapBlur
        />

        <Vignette
          eskil={false}
          offset={0.10}
          darkness={0.56}
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
