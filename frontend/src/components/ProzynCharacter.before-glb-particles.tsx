import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";

export type Persona = "sara" | "alex";
export type CoreState = "idle" | "listening" | "thinking" | "speaking";

const PARTICLES = 8200;
const AMBIENT = 420;
const TAU = Math.PI * 2;

type CharacterTargets = {
  sara: Float32Array;
  alex: Float32Array;
  seed: Float32Array;
  size: Float32Array;
};

function rng(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);

    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(random: () => number) {
  let u = 0;
  let v = 0;

  while (u === 0) u = random();
  while (v === 0) v = random();

  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
}

function setPoint(
  target: Float32Array,
  index: number,
  x: number,
  y: number,
  z: number,
) {
  const i = index * 3;

  target[i] = x;
  target[i + 1] = y;
  target[i + 2] = z;
}

/* -------------------------------------------------------------------------- */
/* 3D SURFACE SAMPLERS                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Samples points directly from the surface of an ellipsoid.
 *
 * This is intentionally a surface sampler rather than a filled cloud.
 * The result reads more like a real 3D form when rendered as particles.
 */
function sampleEllipsoid(
  target: Float32Array,
  cursor: number,
  count: number,
  random: () => number,
  center: [number, number, number],
  radius: [number, number, number],
  jitter = 0.006,
) {
  const [cx, cy, cz] = center;
  const [rx, ry, rz] = radius;

  for (let i = 0; i < count; i++) {
    const theta = random() * TAU;
    const phi = Math.acos(2 * random() - 1);

    const sinPhi = Math.sin(phi);

    const x = Math.cos(theta) * sinPhi;
    const y = Math.cos(phi);
    const z = Math.sin(theta) * sinPhi;

    setPoint(
      target,
      cursor + i,
      cx + x * rx + gaussian(random) * jitter,
      cy + y * ry + gaussian(random) * jitter,
      cz + z * rz + gaussian(random) * jitter,
    );
  }
}

/**
 * Samples a soft 3D tube along a 2D path.
 *
 * Used primarily for hair and jacket/shoulder structure.
 */
function sampleTube(
  target: Float32Array,
  cursor: number,
  count: number,
  random: () => number,
  path: Array<[number, number]>,
  radius: number,
  depth: number,
  zOffset = 0,
) {
  for (let i = 0; i < count; i++) {
    const raw = random() * (path.length - 1);
    const segment = Math.min(
      Math.floor(raw),
      path.length - 2,
    );

    const local = raw - segment;

    const [x1, y1] = path[segment];
    const [x2, y2] = path[segment + 1];

    const x = THREE.MathUtils.lerp(x1, x2, local);
    const y = THREE.MathUtils.lerp(y1, y2, local);

    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.max(Math.hypot(dx, dy), 0.001);

    const nx = -dy / length;
    const ny = dx / length;

    const angle = random() * TAU;
    const r = Math.abs(gaussian(random)) * radius;

    const offset2D = Math.cos(angle) * r;
    const offsetZ = Math.sin(angle) * r * depth;

    setPoint(
      target,
      cursor + i,
      x + nx * offset2D,
      y + ny * offset2D,
      zOffset + offsetZ + gaussian(random) * 0.006,
    );
  }
}

/**
 * Samples a thin 3D feature line.
 *
 * These are subtle facial/jacket details that make the character
 * readable without turning it into a conventional solid 3D model.
 */
function sampleFeatureLine(
  target: Float32Array,
  cursor: number,
  count: number,
  random: () => number,
  path: Array<[number, number]>,
  z: number,
  thickness: number,
) {
  for (let i = 0; i < count; i++) {
    const raw = random() * (path.length - 1);
    const segment = Math.min(
      Math.floor(raw),
      path.length - 2,
    );

    const local = raw - segment;

    const [x1, y1] = path[segment];
    const [x2, y2] = path[segment + 1];

    const x = THREE.MathUtils.lerp(x1, x2, local);
    const y = THREE.MathUtils.lerp(y1, y2, local);

    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.max(Math.hypot(dx, dy), 0.001);

    const nx = -dy / length;
    const ny = dx / length;

    const offset = gaussian(random) * thickness;

    setPoint(
      target,
      cursor + i,
      x + nx * offset,
      y + ny * offset,
      z + gaussian(random) * 0.008,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* SARA                                                                      */
/* -------------------------------------------------------------------------- */

function createSara(
  target: Float32Array,
  random: () => number,
) {
  let cursor = 0;

  /*
   * The same particle blocks are used for SARA and ALEX.
   * This is important for smooth morphing.
   *
   * 1600 head
   *  500 face structure
   *  400 neck
   *  900 shoulders
   * 1400 torso
   *  900 hair mass
   *  700 left hair
   *  700 right hair
   * 1100 details
   *
   * TOTAL = 8200
   */

  // 1. Head
  sampleEllipsoid(
    target,
    cursor,
    1600,
    random,
    [0, 1.16, 0.02],
    [0.39, 0.49, 0.34],
    0.005,
  );
  cursor += 1600;

  // 2. Facial structure
  sampleFeatureLine(
    target,
    cursor,
    140,
    random,
    [
      [0, 1.34],
      [-0.015, 1.23],
      [0.018, 1.12],
      [0, 1.06],
    ],
    0.335,
    0.018,
  );
  cursor += 140;

  sampleFeatureLine(
    target,
    cursor,
    90,
    random,
    [
      [-0.28, 1.30],
      [-0.16, 1.34],
      [-0.06, 1.30],
    ],
    0.325,
    0.012,
  );
  cursor += 90;

  sampleFeatureLine(
    target,
    cursor,
    90,
    random,
    [
      [0.28, 1.30],
      [0.16, 1.34],
      [0.06, 1.30],
    ],
    0.325,
    0.012,
  );
  cursor += 90;

  sampleFeatureLine(
    target,
    cursor,
    90,
    random,
    [
      [-0.25, 1.10],
      [-0.16, 1.04],
      [-0.07, 1.02],
    ],
    0.326,
    0.014,
  );
  cursor += 90;

  sampleFeatureLine(
    target,
    cursor,
    90,
    random,
    [
      [0.25, 1.10],
      [0.16, 1.04],
      [0.07, 1.02],
    ],
    0.326,
    0.014,
  );
  cursor += 90;

  // 3. Neck
  sampleEllipsoid(
    target,
    cursor,
    400,
    random,
    [0, 0.72, -0.005],
    [0.145, 0.32, 0.17],
    0.005,
  );
  cursor += 400;

  // 4. Soft feminine shoulders
  sampleEllipsoid(
    target,
    cursor,
    900,
    random,
    [0, 0.43, 0],
    [0.78, 0.29, 0.27],
    0.006,
  );
  cursor += 900;

  // 5. Upper torso
  sampleEllipsoid(
    target,
    cursor,
    1400,
    random,
    [0, -0.13, -0.01],
    [0.53, 0.70, 0.27],
    0.006,
  );
  cursor += 1400;

  // 6. Long flowing hair mass
  sampleEllipsoid(
    target,
    cursor,
    900,
    random,
    [0, 1.16, -0.16],
    [0.54, 0.65, 0.18],
    0.007,
  );
  cursor += 900;

  // 7. Left long hair
  sampleTube(
    target,
    cursor,
    700,
    random,
    [
      [-0.35, 1.58],
      [-0.52, 1.35],
      [-0.62, 1.03],
      [-0.66, 0.67],
      [-0.70, 0.28],
      [-0.68, -0.06],
      [-0.60, -0.38],
    ],
    0.075,
    1.0,
    -0.04,
  );
  cursor += 700;

  // 8. Right long hair
  sampleTube(
    target,
    cursor,
    700,
    random,
    [
      [0.35, 1.58],
      [0.52, 1.35],
      [0.62, 1.03],
      [0.66, 0.67],
      [0.70, 0.28],
      [0.68, -0.06],
      [0.60, -0.38],
    ],
    0.075,
    1.0,
    -0.04,
  );
  cursor += 700;

  // 9. Character details
  sampleFeatureLine(
    target,
    cursor,
    250,
    random,
    [
      [-0.43, 0.54],
      [-0.26, 0.66],
      [0, 0.70],
      [0.26, 0.66],
      [0.43, 0.54],
    ],
    0.265,
    0.020,
  );
  cursor += 250;

  sampleFeatureLine(
    target,
    cursor,
    220,
    random,
    [
      [-0.08, 1.59],
      [0, 1.67],
      [0.08, 1.59],
    ],
    0.30,
    0.018,
  );
  cursor += 220;

  sampleTube(
    target,
    cursor,
    250,
    random,
    [
      [-0.61, 0.16],
      [-0.78, -0.08],
      [-0.72, -0.35],
    ],
    0.045,
    0.75,
    -0.05,
  );
  cursor += 250;

  sampleTube(
    target,
    cursor,
    250,
    random,
    [
      [0.61, 0.16],
      [0.78, -0.08],
      [0.72, -0.35],
    ],
    0.045,
    0.75,
    -0.05,
  );
  cursor += 250;

  sampleFeatureLine(
    target,
    cursor,
    130,
    random,
    [
      [-0.70, 0.48],
      [-0.78, 0.34],
      [-0.74, 0.18],
    ],
    0.20,
    0.014,
  );
  cursor += 130;

  if (cursor !== PARTICLES) {
    throw new Error(`SARA allocation mismatch: ${cursor}`);
  }
}

/* -------------------------------------------------------------------------- */
/* ALEX                                                                      */
/* -------------------------------------------------------------------------- */

function createAlex(
  target: Float32Array,
  random: () => number,
) {
  let cursor = 0;

  /*
   * Same block sizes as SARA.
   * The geometry changes, but particle identity remains aligned.
   */

  // 1. Head
  sampleEllipsoid(
    target,
    cursor,
    1600,
    random,
    [0, 1.16, 0.02],
    [0.43, 0.50, 0.35],
    0.005,
  );
  cursor += 1600;

  // 2. Facial structure
  sampleFeatureLine(
    target,
    cursor,
    140,
    random,
    [
      [0, 1.35],
      [-0.01, 1.23],
      [0.025, 1.11],
      [0, 1.04],
    ],
    0.345,
    0.018,
  );
  cursor += 140;

  sampleFeatureLine(
    target,
    cursor,
    90,
    random,
    [
      [-0.30, 1.30],
      [-0.17, 1.34],
      [-0.05, 1.31],
    ],
    0.332,
    0.013,
  );
  cursor += 90;

  sampleFeatureLine(
    target,
    cursor,
    90,
    random,
    [
      [0.30, 1.30],
      [0.17, 1.34],
      [0.05, 1.31],
    ],
    0.332,
    0.013,
  );
  cursor += 90;

  sampleFeatureLine(
    target,
    cursor,
    90,
    random,
    [
      [-0.26, 1.09],
      [-0.16, 1.02],
      [-0.06, 1.00],
    ],
    0.334,
    0.014,
  );
  cursor += 90;

  sampleFeatureLine(
    target,
    cursor,
    90,
    random,
    [
      [0.26, 1.09],
      [0.16, 1.02],
      [0.06, 1.00],
    ],
    0.334,
    0.014,
  );
  cursor += 90;

  // 3. Stronger neck
  sampleEllipsoid(
    target,
    cursor,
    400,
    random,
    [0, 0.70, -0.005],
    [0.17, 0.34, 0.19],
    0.005,
  );
  cursor += 400;

  // 4. Broad shoulders
  sampleEllipsoid(
    target,
    cursor,
    900,
    random,
    [0, 0.41, 0],
    [0.90, 0.30, 0.29],
    0.006,
  );
  cursor += 900;

  // 5. Straight professional torso
  sampleEllipsoid(
    target,
    cursor,
    1400,
    random,
    [0, -0.14, -0.01],
    [0.62, 0.72, 0.29],
    0.006,
  );
  cursor += 1400;

  // 6. Short structured hair
  sampleEllipsoid(
    target,
    cursor,
    900,
    random,
    [0, 1.46, -0.005],
    [0.47, 0.29, 0.27],
    0.007,
  );
  cursor += 900;

  // 7. Left short hair
  sampleTube(
    target,
    cursor,
    700,
    random,
    [
      [-0.39, 1.56],
      [-0.48, 1.40],
      [-0.45, 1.20],
      [-0.39, 1.06],
    ],
    0.060,
    0.85,
    -0.005,
  );
  cursor += 700;

  // 8. Right short hair
  sampleTube(
    target,
    cursor,
    700,
    random,
    [
      [0.39, 1.56],
      [0.48, 1.40],
      [0.45, 1.20],
      [0.39, 1.06],
    ],
    0.060,
    0.85,
    -0.005,
  );
  cursor += 700;

  // 9. Jacket / professional structure
  sampleFeatureLine(
    target,
    cursor,
    250,
    random,
    [
      [-0.17, 0.62],
      [-0.32, 0.38],
      [-0.42, 0.10],
      [-0.47, -0.24],
      [-0.43, -0.58],
    ],
    0.285,
    0.022,
  );
  cursor += 250;

  sampleFeatureLine(
    target,
    cursor,
    250,
    random,
    [
      [0.17, 0.62],
      [0.32, 0.38],
      [0.42, 0.10],
      [0.47, -0.24],
      [0.43, -0.58],
    ],
    0.285,
    0.022,
  );
  cursor += 250;

  // Tie / center line
  sampleFeatureLine(
    target,
    cursor,
    250,
    random,
    [
      [0, 0.59],
      [0, 0.32],
      [0, 0.04],
      [0, -0.25],
      [0, -0.52],
    ],
    0.295,
    0.018,
  );
  cursor += 250;

  // Left shoulder contour
  sampleFeatureLine(
    target,
    cursor,
    175,
    random,
    [
      [-0.18, 0.62],
      [-0.46, 0.56],
      [-0.73, 0.43],
    ],
    0.27,
    0.018,
  );
  cursor += 175;

  // Right shoulder contour
  sampleFeatureLine(
    target,
    cursor,
    175,
    random,
    [
      [0.18, 0.62],
      [0.46, 0.56],
      [0.73, 0.43],
    ],
    0.27,
    0.018,
  );
  cursor += 175;

  if (cursor !== PARTICLES) {
    throw new Error(`ALEX allocation mismatch: ${cursor}`);
  }
}

/* -------------------------------------------------------------------------- */
/* TARGETS                                                                    */
/* -------------------------------------------------------------------------- */

function buildTargets(): CharacterTargets {
  const random = rng(0x91a7d4);

  const sara = new Float32Array(PARTICLES * 3);
  const alex = new Float32Array(PARTICLES * 3);

  const seed = new Float32Array(PARTICLES);
  const size = new Float32Array(PARTICLES);

  createSara(sara, random);
  createAlex(alex, random);

  for (let i = 0; i < PARTICLES; i++) {
    seed[i] = random() * TAU;

    /*
     * Smaller points keep facial contours and silhouette readable.
     */
    size[i] = 0.42 + random() * 0.72;
  }

  return {
    sara,
    alex,
    seed,
    size,
  };
}

/* -------------------------------------------------------------------------- */
/* PARTICLE ENTITY                                                             */
/* -------------------------------------------------------------------------- */

function ParticleCharacter({
  persona,
  state,
}: {
  persona: Persona;
  state: CoreState;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const geometryRef = useRef<THREE.BufferGeometry>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const targets = useMemo(buildTargets, []);

  /*
   * Start directly as SARA.
   * Switching to ALEX keeps the same particle array and morphs it.
   */
  const current = useMemo(
    () => new Float32Array(targets.sara),
    [targets],
  );

  const attributes = useMemo(
    () => ({
      positions: new Float32Array(targets.sara),
      seed: new Float32Array(targets.seed),
      size: new Float32Array(targets.size),
    }),
    [targets],
  );

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uIntensity: { value: 0.16 },
      uHue: { value: 0.76 },
      uPointScale: { value: 1 },
    }),
    [],
  );

  useFrame((_, delta) => {
    const target =
      persona === "sara"
        ? targets.sara
        : targets.alex;

    /*
     * This is the actual living morph.
     * No character is destroyed or spawned.
     * Every particle travels toward its new position.
     */
    const morphSpeed =
      state === "thinking"
        ? 2.7
        : state === "speaking"
          ? 3.0
          : 2.45;

    const blend = 1 - Math.exp(-morphSpeed * delta);

    const position =
      geometryRef.current?.getAttribute(
        "position",
      ) as THREE.BufferAttribute | undefined;

    if (!position) return;

    for (let i = 0; i < current.length; i++) {
      current[i] +=
        (target[i] - current[i]) * blend;
    }

    position.array.set(current);
    position.needsUpdate = true;

    const time = performance.now() * 0.001;

    const intensity =
      state === "idle"
        ? 0.14
        : state === "listening"
          ? 0.52
          : state === "thinking"
            ? 0.44
            : 0.70;

    const hue =
      persona === "sara"
        ? 0.76
        : 0.54;

    if (materialRef.current) {
      const u = materialRef.current.uniforms;

      u.uTime.value = time;

      u.uIntensity.value =
        THREE.MathUtils.damp(
          u.uIntensity.value,
          intensity,
          4,
          delta,
        );

      u.uHue.value =
        THREE.MathUtils.damp(
          u.uHue.value,
          hue,
          3,
          delta,
        );

      u.uPointScale.value =
        THREE.MathUtils.damp(
          u.uPointScale.value,
          state === "idle"
            ? 0.92
            : 1.0,
          4,
          delta,
        );
    }

    if (pointsRef.current) {
      /*
       * Living/breathing movement.
       * Intentionally tiny so the human form stays recognizable.
       */
      const breathing =
        Math.sin(time * 1.15) * 0.012;

      pointsRef.current.scale.set(
        1 + breathing * 0.35,
        1 + breathing,
        1 + breathing * 0.35,
      );

      /*
       * Very subtle rotation.
       * Thinking gets slightly more active.
       */
      pointsRef.current.rotation.y +=
        delta *
        (state === "thinking"
          ? 0.045
          : 0.012);
    }
  });

  return (
    <points
      ref={pointsRef}
      frustumCulled={false}
    >
      <bufferGeometry ref={geometryRef}>
        <bufferAttribute
          attach="attributes-position"
          args={[
            attributes.positions,
            3,
          ]}
        />

        <bufferAttribute
          attach="attributes-aSeed"
          args={[
            attributes.seed,
            1,
          ]}
        />

        <bufferAttribute
          attach="attributes-aSize"
          args={[
            attributes.size,
            1,
          ]}
        />
      </bufferGeometry>

      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
      />
    </points>
  );
}

/* -------------------------------------------------------------------------- */
/* AMBIENT PARTICLES                                                           */
/* -------------------------------------------------------------------------- */

function AmbientParticles() {
  const ref = useRef<THREE.Points>(null);

  const data = useMemo(() => {
    const random = rng(0x88a11f);
    const positions =
      new Float32Array(
        AMBIENT * 3,
      );

    for (
      let i = 0;
      i < AMBIENT;
      i++
    ) {
      const radius =
        2.0 + random() * 2.2;

      const angle =
        random() * TAU;

      const i3 = i * 3;

      positions[i3] =
        Math.cos(angle) * radius;

      positions[i3 + 1] =
        (random() - 0.5) * 3.4;

      positions[i3 + 2] =
        (random() - 0.5) * 1.8;
    }

    return positions;
  }, []);

  useFrame((_, delta) => {
    if (!ref.current) return;

    ref.current.rotation.y -=
      delta * 0.010;

    ref.current.rotation.z +=
      delta * 0.004;
  });

  return (
    <points
      ref={ref}
      frustumCulled={false}
    >
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[data, 3]}
        />
      </bufferGeometry>

      <pointsMaterial
        size={0.013}
        color="#5be8ff"
        transparent
        opacity={0.20}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/* -------------------------------------------------------------------------- */
/* ORBITAL ENERGY                                                              */
/* -------------------------------------------------------------------------- */

function EnergyRings({
  state,
}: {
  state: CoreState;
}) {
  const groupRef =
    useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!groupRef.current) {
      return;
    }

    const speed =
      state === "thinking"
        ? 0.22
        : state === "speaking"
          ? 0.34
          : state === "listening"
            ? 0.16
            : 0.06;

    groupRef.current.rotation.z +=
      delta * speed;

    groupRef.current.rotation.x =
      Math.sin(
        performance.now() *
          0.00035,
      ) * 0.08;
  });

  const opacityA =
    state === "idle"
      ? 0.10
      : state === "listening"
        ? 0.18
        : 0.23;

  const opacityB =
    state === "idle"
      ? 0.055
      : 0.13;

  return (
    <group ref={groupRef}>
      <mesh
        rotation={[
          Math.PI / 2.2,
          0,
          0,
        ]}
      >
        <torusGeometry
          args={[
            1.55,
            0.004,
            8,
            160,
          ]}
        />

        <meshBasicMaterial
          color="#55e9ff"
          transparent
          opacity={opacityA}
          depthWrite={false}
        />
      </mesh>

      <mesh
        rotation={[
          Math.PI / 3.1,
          0.35,
          0,
        ]}
      >
        <torusGeometry
          args={[
            1.82,
            0.003,
            8,
            160,
          ]}
        />

        <meshBasicMaterial
          color="#9b7cff"
          transparent
          opacity={opacityB}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/* -------------------------------------------------------------------------- */
/* SHADERS                                                                    */
/* -------------------------------------------------------------------------- */

const vertexShader = /* glsl */ `
  attribute float aSeed;
  attribute float aSize;

  uniform float uTime;
  uniform float uIntensity;
  uniform float uPointScale;

  varying float vEnergy;

  void main() {
    vec3 p = position;

    /*
     * Organic micro movement.
     * The movement is deliberately tiny so facial and body contours survive.
     */
    float life =
      sin(
        uTime * 1.25 +
        aSeed * 6.0 +
        p.y * 2.8
      );

    float shimmer =
      sin(
        uTime * 2.3 +
        aSeed * 11.0
      );

    p.x +=
      life *
      0.0025 *
      uIntensity;

    p.y +=
      shimmer *
      0.0020 *
      uIntensity;

    p.z +=
      sin(
        uTime * 1.7 +
        aSeed * 8.0
      ) *
      0.004 *
      uIntensity;

    vec4 mvPosition =
      modelViewMatrix *
      vec4(p, 1.0);

    float depth =
      max(-mvPosition.z, 0.8);

    gl_PointSize =
      (
        aSize *
        (
          8.0 +
          5.0 * uIntensity
        ) *
        uPointScale
      ) /
      depth;

    gl_Position =
      projectionMatrix *
      mvPosition;

    vEnergy =
      0.55 +
      0.45 *
      sin(
        aSeed * 9.0 +
        uTime * 1.6
      );
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uIntensity;
  uniform float uHue;

  varying float vEnergy;

  vec3 hsb2rgb(vec3 c) {
    vec3 rgb =
      clamp(
        abs(
          mod(
            c.x * 6.0 +
            vec3(0.0, 4.0, 2.0),
            6.0
          ) -
          3.0
        ) -
        1.0,
        0.0,
        1.0
      );

    rgb =
      rgb *
      rgb *
      (3.0 - 2.0 * rgb);

    return c.z *
      mix(
        vec3(1.0),
        rgb,
        c.y
      );
  }

  void main() {
    vec2 uv =
      gl_PointCoord -
      0.5;

    float d =
      length(uv);

    if (d > 0.5) {
      discard;
    }

    float core =
      smoothstep(
        0.5,
        0.06,
        d
      );

    float glow =
      smoothstep(
        0.5,
        0.0,
        d
      );

    vec3 color =
      hsb2rgb(
        vec3(
          uHue +
            vEnergy * 0.045,
          0.66,
          1.0
        )
      );

    float alpha =
      (
        0.18 +
        core * 0.70
      ) *
      (
        0.72 +
        uIntensity * 0.46
      );

    gl_FragColor =
      vec4(
        color,
        alpha * glow
      );
  }
`;

/* -------------------------------------------------------------------------- */
/* PUBLIC COMPONENT                                                            */
/* -------------------------------------------------------------------------- */

export default function ProzynCharacter({
  persona,
  state,
}: {
  persona: Persona;
  state: CoreState;
}) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{
        position: [0, 0, 5.15],
        fov: 34,
        near: 0.1,
        far: 30,
      }}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference:
          "high-performance",
      }}
      style={{
        width: "100%",
        height: "100%",
        display: "block",
      }}
      onCreated={({ gl }) => {
        gl.setClearColor(
          0x000000,
          0,
        );
      }}
    >
      <group
        position={[
          0,
          -0.12,
          0,
        ]}
      >
        <ParticleCharacter
          persona={persona}
          state={state}
        />

        <EnergyRings
          state={state}
        />

        <AmbientParticles />
      </group>

      <EffectComposer
        multisampling={4}
      >
        <Bloom
          intensity={
            state === "speaking"
              ? 1.15
              : state === "idle"
                ? 0.52
                : 0.82
          }
          luminanceThreshold={0.10}
          luminanceSmoothing={0.48}
          mipmapBlur
        />

        <Vignette
          eskil={false}
          offset={0.25}
          darkness={0.48}
        />
      </EffectComposer>
    </Canvas>
  );
}
