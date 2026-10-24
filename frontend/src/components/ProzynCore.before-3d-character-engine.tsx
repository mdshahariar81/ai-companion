import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";

export type Persona = "sara" | "alex";
export type CoreState = "idle" | "listening" | "thinking" | "speaking";

const PARTICLES = 8200;
const AMBIENT = 360;
const TAU = Math.PI * 2;

type Targets = {
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

function point(
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

function ellipse(
  target: Float32Array,
  cursor: number,
  count: number,
  random: () => number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  depth: number,
  z = 0,
) {
  for (let i = 0; i < count; i++) {
    const angle = random() * TAU;
    const radius = Math.sqrt(random());

    point(
      target,
      cursor + i,
      cx +
        Math.cos(angle) * rx * radius +
        gaussian(random) * 0.009,
      cy +
        Math.sin(angle) * ry * radius +
        gaussian(random) * 0.009,
      z + gaussian(random) * depth,
    );
  }
}

function tube(
  target: Float32Array,
  cursor: number,
  count: number,
  random: () => number,
  path: Array<[number, number]>,
  thickness: number,
  depth: number,
) {
  for (let i = 0; i < count; i++) {
    const raw = random() * (path.length - 1);
    const segment = Math.min(Math.floor(raw), path.length - 2);
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

    point(
      target,
      cursor + i,
      x + nx * offset,
      y + ny * offset,
      gaussian(random) * depth,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* SARA                                                                      */
/* -------------------------------------------------------------------------- */

function createSara(target: Float32Array, random: () => number) {
  let cursor = 0;

  /*
   * SARA silhouette:
   * - long flowing hair
   * - smaller feminine head
   * - narrow neck
   * - softer shoulders
   * - narrower torso
   *
   * Every allocation is controlled so the total is exactly 8200 particles.
   */

  // Hair crown — 900
  ellipse(
    target,
    cursor,
    900,
    random,
    0,
    1.46,
    0.47,
    0.30,
    0.10,
    -0.05,
  );
  cursor += 900;

  // Left long hair — 1050
  tube(
    target,
    cursor,
    1050,
    random,
    [
      [-0.34, 1.62],
      [-0.48, 1.40],
      [-0.57, 1.08],
      [-0.61, 0.72],
      [-0.65, 0.34],
      [-0.62, -0.04],
      [-0.56, -0.34],
    ],
    0.065,
    0.12,
  );
  cursor += 1050;

  // Right long hair — 1050
  tube(
    target,
    cursor,
    1050,
    random,
    [
      [0.34, 1.62],
      [0.48, 1.40],
      [0.57, 1.08],
      [0.61, 0.72],
      [0.65, 0.34],
      [0.62, -0.04],
      [0.56, -0.34],
    ],
    0.065,
    0.12,
  );
  cursor += 1050;

  // Head — 1150
  ellipse(
    target,
    cursor,
    1150,
    random,
    0,
    1.22,
    0.32,
    0.41,
    0.13,
    0.015,
  );
  cursor += 1150;

  // Jaw — 400
  ellipse(
    target,
    cursor,
    400,
    random,
    0,
    0.99,
    0.24,
    0.18,
    0.11,
    0.025,
  );
  cursor += 400;

  // Neck — 300
  ellipse(
    target,
    cursor,
    300,
    random,
    0,
    0.72,
    0.11,
    0.24,
    0.08,
  );
  cursor += 300;

  // Soft shoulders — 1100
  ellipse(
    target,
    cursor,
    1100,
    random,
    0,
    0.43,
    0.66,
    0.25,
    0.17,
  );
  cursor += 1100;

  // Narrow torso — 1200
  ellipse(
    target,
    cursor,
    1200,
    random,
    0,
    -0.03,
    0.43,
    0.58,
    0.16,
  );
  cursor += 1200;

  // Lower hair accent — 250
  tube(
    target,
    cursor,
    250,
    random,
    [
      [-0.58, 0.24],
      [-0.76, -0.04],
      [-0.70, -0.36],
    ],
    0.045,
    0.08,
  );
  cursor += 250;

  // Lower hair accent — 250
  tube(
    target,
    cursor,
    250,
    random,
    [
      [0.58, 0.24],
      [0.76, -0.04],
      [0.70, -0.36],
    ],
    0.045,
    0.08,
  );
  cursor += 250;

  // Controlled density inside the silhouette — 550
  ellipse(
    target,
    cursor,
    150,
    random,
    0,
    1.25,
    0.27,
    0.34,
    0.10,
  );
  cursor += 150;

  ellipse(
    target,
    cursor,
    150,
    random,
    0,
    0.42,
    0.57,
    0.20,
    0.12,
  );
  cursor += 150;

  ellipse(
    target,
    cursor,
    250,
    random,
    0,
    -0.10,
    0.36,
    0.50,
    0.13,
  );
  cursor += 250;

  if (cursor !== PARTICLES) {
    throw new Error(`SARA particle allocation mismatch: ${cursor}`);
  }
}

/* -------------------------------------------------------------------------- */
/* ALEX                                                                      */
/* -------------------------------------------------------------------------- */

function createAlex(target: Float32Array, random: () => number) {
  let cursor = 0;

  /*
   * ALEX silhouette:
   * - short structured hair
   * - slightly wider masculine head
   * - stronger jaw
   * - wider neck
   * - broad shoulders
   * - straight professional torso
   * - jacket structure
   *
   * Every allocation is controlled so the total is exactly 8200 particles.
   */

  // Short hair — 850
  ellipse(
    target,
    cursor,
    850,
    random,
    0,
    1.47,
    0.41,
    0.27,
    0.10,
    -0.035,
  );
  cursor += 850;

  // Structured hairline — 300
  tube(
    target,
    cursor,
    300,
    random,
    [
      [-0.36, 1.55],
      [-0.18, 1.68],
      [0.08, 1.70],
      [0.32, 1.58],
    ],
    0.055,
    0.08,
  );
  cursor += 300;

  // Head — 1200
  ellipse(
    target,
    cursor,
    1200,
    random,
    0,
    1.21,
    0.35,
    0.42,
    0.13,
    0.025,
  );
  cursor += 1200;

  // Stronger jaw — 420
  ellipse(
    target,
    cursor,
    420,
    random,
    0,
    0.96,
    0.27,
    0.19,
    0.11,
    0.035,
  );
  cursor += 420;

  // Wider neck — 320
  ellipse(
    target,
    cursor,
    320,
    random,
    0,
    0.70,
    0.14,
    0.26,
    0.08,
  );
  cursor += 320;

  // Broad shoulders — 1400
  ellipse(
    target,
    cursor,
    1400,
    random,
    0,
    0.39,
    0.82,
    0.27,
    0.19,
  );
  cursor += 1400;

  // Straight torso — 1550
  ellipse(
    target,
    cursor,
    1550,
    random,
    0,
    -0.08,
    0.57,
    0.64,
    0.20,
  );
  cursor += 1550;

  // Left jacket line — 500
  tube(
    target,
    cursor,
    500,
    random,
    [
      [-0.23, 0.64],
      [-0.32, 0.28],
      [-0.34, -0.18],
      [-0.29, -0.62],
    ],
    0.045,
    0.09,
  );
  cursor += 500;

  // Right jacket line — 500
  tube(
    target,
    cursor,
    500,
    random,
    [
      [0.23, 0.64],
      [0.32, 0.28],
      [0.34, -0.18],
      [0.29, -0.62],
    ],
    0.045,
    0.09,
  );
  cursor += 500;

  // Controlled density inside silhouette — 1160
  ellipse(
    target,
    cursor,
    200,
    random,
    0,
    1.21,
    0.29,
    0.34,
    0.10,
  );
  cursor += 200;

  ellipse(
    target,
    cursor,
    400,
    random,
    0,
    0.39,
    0.72,
    0.21,
    0.13,
  );
  cursor += 400;

  ellipse(
    target,
    cursor,
    560,
    random,
    0,
    -0.12,
    0.49,
    0.54,
    0.15,
  );
  cursor += 560;

  if (cursor !== PARTICLES) {
    throw new Error(`ALEX particle allocation mismatch: ${cursor}`);
  }
}

/* -------------------------------------------------------------------------- */
/* Target generation                                                          */
/* -------------------------------------------------------------------------- */

function buildTargets(): Targets {
  const random = rng(0x7a31c9);

  const sara = new Float32Array(PARTICLES * 3);
  const alex = new Float32Array(PARTICLES * 3);
  const seed = new Float32Array(PARTICLES);
  const size = new Float32Array(PARTICLES);

  createSara(sara, random);
  createAlex(alex, random);

  for (let i = 0; i < PARTICLES; i++) {
    seed[i] = random() * TAU;
    size[i] = 0.48 + random() * 0.82;
  }

  return {
    sara,
    alex,
    seed,
    size,
  };
}

/* -------------------------------------------------------------------------- */
/* Particle renderer                                                          */
/* -------------------------------------------------------------------------- */

function EntityParticles({
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
   * SARA is the default persona in App.tsx, so the first frame already
   * starts as a human silhouette instead of showing the old reactor.
   *
   * When switching SARA <-> ALEX, this same particle array morphs between
   * the two targets.
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
      uPointScale: { value: 0.92 },
    }),
    [],
  );

  useFrame((_, delta) => {
    /*
     * IMPORTANT:
     * Persona is always visible, including READY/idle.
     * There is no reactor/core target anymore.
     */
    const target = persona === "sara" ? targets.sara : targets.alex;

    const morphSpeed = state === "idle" ? 3.8 : 3.1;
    const blend = 1 - Math.exp(-morphSpeed * delta);

    const position = geometryRef.current?.getAttribute(
      "position",
    ) as THREE.BufferAttribute | undefined;

    if (!position) return;

    for (let i = 0; i < current.length; i++) {
      current[i] += (target[i] - current[i]) * blend;
    }

    position.array.set(current);
    position.needsUpdate = true;

    const time = performance.now() * 0.001;

    const intensity =
      state === "idle"
        ? 0.16
        : state === "listening"
          ? 0.56
          : state === "thinking"
            ? 0.46
            : 0.72;

    const hue = persona === "sara" ? 0.76 : 0.53;

    if (materialRef.current) {
      const materialUniforms = materialRef.current.uniforms;

      materialUniforms.uTime.value = time;

      materialUniforms.uIntensity.value = THREE.MathUtils.damp(
        materialUniforms.uIntensity.value,
        intensity,
        4,
        delta,
      );

      materialUniforms.uHue.value = THREE.MathUtils.damp(
        materialUniforms.uHue.value,
        hue,
        3,
        delta,
      );

      materialUniforms.uPointScale.value = THREE.MathUtils.damp(
        materialUniforms.uPointScale.value,
        state === "idle" ? 0.92 : 1.02,
        4,
        delta,
      );
    }

    if (pointsRef.current) {
      /*
       * Very small breathing motion.
       * The silhouette must remain readable instead of turning into a cloud.
       */
      const breathe = Math.sin(time * 1.25) * 0.012;

      pointsRef.current.scale.setScalar(1 + breathe);

      /*
       * Thinking gets a little more active, but the identity stays stable.
       */
      pointsRef.current.rotation.y +=
        delta * (state === "thinking" ? 0.055 : 0.018);
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
          args={[attributes.positions, 3]}
        />

        <bufferAttribute
          attach="attributes-aSeed"
          args={[attributes.seed, 1]}
        />

        <bufferAttribute
          attach="attributes-aSize"
          args={[attributes.size, 1]}
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
/* Ambient environment                                                        */
/* -------------------------------------------------------------------------- */

function AmbientParticles() {
  const ref = useRef<THREE.Points>(null);

  const data = useMemo(() => {
    const random = rng(0x9912aa);
    const positions = new Float32Array(AMBIENT * 3);

    for (let i = 0; i < AMBIENT; i++) {
      const radius = 1.9 + random() * 2.1;
      const angle = random() * TAU;
      const i3 = i * 3;

      positions[i3] = Math.cos(angle) * radius;
      positions[i3 + 1] = (random() - 0.5) * 3.1;
      positions[i3 + 2] = (random() - 0.5) * 1.8;
    }

    return positions;
  }, []);

  useFrame((_, delta) => {
    if (!ref.current) return;

    ref.current.rotation.y -= delta * 0.012;
    ref.current.rotation.z += delta * 0.005;
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
        size={0.014}
        color="#5be8ff"
        transparent
        opacity={0.24}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/* -------------------------------------------------------------------------- */
/* Energy orbitals                                                             */
/* -------------------------------------------------------------------------- */

function EnergyRings({ state }: { state: CoreState }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    const speed =
      state === "thinking"
        ? 0.25
        : state === "speaking"
          ? 0.38
          : state === "listening"
            ? 0.20
            : 0.08;

    groupRef.current.rotation.z += delta * speed;
    groupRef.current.rotation.x =
      Math.sin(performance.now() * 0.00035) * 0.10;
  });

  const firstOpacity =
    state === "idle"
      ? 0.12
      : state === "listening"
        ? 0.22
        : 0.27;

  const secondOpacity =
    state === "idle"
      ? 0.07
      : state === "speaking"
        ? 0.18
        : 0.14;

  return (
    <group ref={groupRef}>
      <mesh rotation={[Math.PI / 2.2, 0, 0]}>
        <torusGeometry args={[1.48, 0.005, 8, 128]} />

        <meshBasicMaterial
          color="#55e9ff"
          transparent
          opacity={firstOpacity}
          depthWrite={false}
        />
      </mesh>

      <mesh rotation={[Math.PI / 3.1, 0.35, 0]}>
        <torusGeometry args={[1.76, 0.0035, 8, 128]} />

        <meshBasicMaterial
          color="#9b7cff"
          transparent
          opacity={secondOpacity}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/* -------------------------------------------------------------------------- */
/* Particle shaders                                                            */
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
     * Keep the motion subtle.
     * Large radial movement destroys the human silhouette.
     */
    float wave =
      sin(uTime * 1.35 + aSeed * 4.0 + p.y * 2.2) *
      0.0025;

    float pulse =
      sin(uTime * 2.0 + aSeed * 7.0) *
      0.004 *
      uIntensity;

    vec3 direction = normalize(p + vec3(0.0001));

    p += direction * (wave + pulse);

    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);

    float depth = max(-mvPosition.z, 0.8);

    /*
     * Smaller particles = sharper silhouette.
     * The previous 18 + 9 size made the human form look like a glowing cloud.
     */
    gl_PointSize =
      (aSize * (8.5 + 4.5 * uIntensity) * uPointScale) /
      depth;

    gl_Position = projectionMatrix * mvPosition;

    vEnergy =
      0.55 +
      0.45 * sin(aSeed * 9.0 + uTime * 1.7);
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

    rgb = rgb * rgb * (3.0 - 2.0 * rgb);

    return c.z * mix(vec3(1.0), rgb, c.y);
  }

  void main() {
    vec2 uv = gl_PointCoord - 0.5;

    float distanceFromCenter = length(uv);

    if (distanceFromCenter > 0.5) {
      discard;
    }

    float core =
      smoothstep(
        0.5,
        0.08,
        distanceFromCenter
      );

    float glow =
      smoothstep(
        0.5,
        0.0,
        distanceFromCenter
      );

    vec3 color =
      hsb2rgb(
        vec3(
          uHue + vEnergy * 0.045,
          0.66,
          1.0
        )
      );

    float alpha =
      (0.20 + core * 0.68) *
      (0.70 + uIntensity * 0.48);

    gl_FragColor =
      vec4(
        color,
        alpha * glow
      );
  }
`;

/* -------------------------------------------------------------------------- */
/* Public component                                                            */
/* -------------------------------------------------------------------------- */

export default function ProzynCore({
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
        position: [0, 0, 5.2],
        fov: 34,
        near: 0.1,
        far: 30,
      }}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      }}
      style={{
        width: "100%",
        height: "100%",
        display: "block",
      }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
      }}
    >
      <group position={[0, -0.10, 0]}>
        <EntityParticles
          persona={persona}
          state={state}
        />

        <EnergyRings state={state} />

        <AmbientParticles />
      </group>

      <EffectComposer multisampling={4}>
        <Bloom
          intensity={
            state === "speaking"
              ? 1.20
              : state === "idle"
                ? 0.55
                : 0.88
          }
          luminanceThreshold={0.10}
          luminanceSmoothing={0.48}
          mipmapBlur
        />

        <Vignette
          eskil={false}
          offset={0.25}
          darkness={0.52}
        />
      </EffectComposer>
    </Canvas>
  );
}
