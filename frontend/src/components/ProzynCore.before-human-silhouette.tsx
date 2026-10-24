import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";

export type Persona = "sara" | "alex";
export type CoreState = "idle" | "listening" | "thinking" | "speaking";

const PARTICLES = 8200;
const AMBIENT = 500;
const TAU = Math.PI * 2;

type Targets = {
  core: Float32Array;
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
        gaussian(random) * 0.012,
      cy +
        Math.sin(angle) * ry * radius +
        gaussian(random) * 0.012,
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
/* Living AI Core                                                             */
/* -------------------------------------------------------------------------- */

function createCore(target: Float32Array, random: () => number) {
  let cursor = 0;

  // Dense spherical nucleus.
  for (let i = 0; i < 4200; i++) {
    const radius = Math.pow(random(), 0.42) * 0.82;
    const theta = random() * TAU;
    const phi = Math.acos(2 * random() - 1);

    point(
      target,
      cursor++,
      Math.sin(phi) * Math.cos(theta) * radius,
      Math.cos(phi) * radius * 1.04,
      Math.sin(phi) * Math.sin(theta) * radius * 0.72,
    );
  }

  // Neural pathways.
  const paths: Array<Array<[number, number]>> = [
    [
      [-1.25, -0.04],
      [-0.75, 0.16],
      [-0.25, -0.02],
      [0.25, 0.18],
      [0.78, 0.02],
      [1.25, 0.22],
    ],
    [
      [-1.0, 0.58],
      [-0.52, 0.30],
      [-0.08, 0.58],
      [0.38, 0.36],
      [0.95, 0.62],
    ],
    [
      [-0.95, -0.62],
      [-0.46, -0.34],
      [0.02, -0.60],
      [0.52, -0.38],
      [1.0, -0.56],
    ],
  ];

  for (const path of paths) {
    tube(target, cursor, 620, random, path, 0.035, 0.13);
    cursor += 620;
  }

  // Orbital layer.
  for (let i = 0; i < 780; i++) {
    const angle = random() * TAU;
    const radius = 1.02 + gaussian(random) * 0.045;

    point(
      target,
      cursor++,
      Math.cos(angle) * radius,
      Math.sin(angle) * radius * 0.43,
      Math.sin(angle * 2) * 0.1 + gaussian(random) * 0.035,
    );
  }

  // Outer energy particles.
  while (cursor < PARTICLES) {
    const angle = random() * TAU;
    const radius = 1.0 + random() * 0.62;

    point(
      target,
      cursor++,
      Math.cos(angle) * radius,
      Math.sin(angle) * radius * 0.72,
      gaussian(random) * 0.2,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* SARA                                                                      */
/* -------------------------------------------------------------------------- */

function createSara(target: Float32Array, random: () => number) {
  let cursor = 0;

  // Hair crown.
  ellipse(
    target,
    cursor,
    1500,
    random,
    0,
    1.30,
    0.46,
    0.42,
    0.10,
    -0.06,
  );
  cursor += 1500;

  // Left flowing hair.
  tube(
    target,
    cursor,
    1450,
    random,
    [
      [-0.34, 1.55],
      [-0.48, 1.34],
      [-0.54, 0.98],
      [-0.58, 0.54],
      [-0.68, 0.15],
      [-0.58, -0.14],
    ],
    0.055,
    0.12,
  );
  cursor += 1450;

  // Right flowing hair.
  tube(
    target,
    cursor,
    1450,
    random,
    [
      [0.34, 1.55],
      [0.48, 1.34],
      [0.54, 0.98],
      [0.58, 0.54],
      [0.68, 0.15],
      [0.58, -0.14],
    ],
    0.055,
    0.12,
  );
  cursor += 1450;

  // Head.
  ellipse(
    target,
    cursor,
    1450,
    random,
    0,
    1.25,
    0.32,
    0.42,
    0.13,
    0.02,
  );
  cursor += 1450;

  // Jaw.
  ellipse(
    target,
    cursor,
    420,
    random,
    0,
    1.02,
    0.24,
    0.20,
    0.12,
    0.03,
  );
  cursor += 420;

  // Neck.
  ellipse(
    target,
    cursor,
    350,
    random,
    0,
    0.74,
    0.11,
    0.25,
    0.08,
  );
  cursor += 350;

  // Soft feminine shoulders.
  ellipse(
    target,
    cursor,
    1050,
    random,
    0,
    0.42,
    0.66,
    0.27,
    0.19,
  );
  cursor += 1050;

  // Torso.
  ellipse(
    target,
    cursor,
    420,
    random,
    0,
    -0.02,
    0.45,
    0.55,
    0.18,
  );
  cursor += 420;

  // Extra hair strands.
  tube(
    target,
    cursor,
    160,
    random,
    [
      [-0.58, 0.18],
      [-0.76, -0.10],
      [-0.66, -0.38],
    ],
    0.04,
    0.08,
  );
  cursor += 160;

  tube(
    target,
    cursor,
    160,
    random,
    [
      [0.58, 0.18],
      [0.76, -0.10],
      [0.66, -0.38],
    ],
    0.04,
    0.08,
  );
  cursor += 160;

  while (cursor < PARTICLES) {
    const angle = random() * TAU;
    const radius = 0.48 + random() * 0.72;

    point(
      target,
      cursor++,
      Math.cos(angle) * radius,
      (random() - 0.5) * 1.4,
      gaussian(random) * 0.24,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* ALEX                                                                      */
/* -------------------------------------------------------------------------- */

function createAlex(target: Float32Array, random: () => number) {
  let cursor = 0;

  // Short structured hair.
  ellipse(
    target,
    cursor,
    1650,
    random,
    0,
    1.36,
    0.40,
    0.31,
    0.11,
    -0.04,
  );
  cursor += 1650;

  // Head.
  ellipse(
    target,
    cursor,
    1550,
    random,
    0,
    1.20,
    0.34,
    0.43,
    0.13,
    0.03,
  );
  cursor += 1550;

  // Jaw.
  ellipse(
    target,
    cursor,
    430,
    random,
    0,
    0.96,
    0.25,
    0.18,
    0.11,
    0.04,
  );
  cursor += 430;

  // Neck.
  ellipse(
    target,
    cursor,
    360,
    random,
    0,
    0.72,
    0.13,
    0.26,
    0.08,
  );
  cursor += 360;

  // Broad shoulders.
  ellipse(
    target,
    cursor,
    1400,
    random,
    0,
    0.38,
    0.82,
    0.28,
    0.20,
  );
  cursor += 1400;

  // Straight professional torso.
  ellipse(
    target,
    cursor,
    950,
    random,
    0,
    -0.06,
    0.57,
    0.62,
    0.20,
  );
  cursor += 950;

  // Jacket structure.
  tube(
    target,
    cursor,
    420,
    random,
    [
      [-0.22, 0.66],
      [-0.30, 0.10],
      [-0.26, -0.58],
    ],
    0.045,
    0.09,
  );
  cursor += 420;

  tube(
    target,
    cursor,
    420,
    random,
    [
      [0.22, 0.66],
      [0.30, 0.10],
      [0.26, -0.58],
    ],
    0.045,
    0.09,
  );
  cursor += 420;

  while (cursor < PARTICLES) {
    const angle = random() * TAU;
    const radius = 0.52 + random() * 0.70;

    point(
      target,
      cursor++,
      Math.cos(angle) * radius,
      (random() - 0.5) * 1.4,
      gaussian(random) * 0.24,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Target generation                                                         */
/* -------------------------------------------------------------------------- */

function buildTargets(): Targets {
  const random = rng(0x7a31c9);

  const core = new Float32Array(PARTICLES * 3);
  const sara = new Float32Array(PARTICLES * 3);
  const alex = new Float32Array(PARTICLES * 3);
  const seed = new Float32Array(PARTICLES);
  const size = new Float32Array(PARTICLES);

  createCore(core, random);
  createSara(sara, random);
  createAlex(alex, random);

  for (let i = 0; i < PARTICLES; i++) {
    seed[i] = random() * TAU;
    size[i] = 0.55 + random() * 1.25;
  }

  return {
    core,
    sara,
    alex,
    seed,
    size,
  };
}

/* -------------------------------------------------------------------------- */
/* Particle renderer                                                         */
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
  const current = useMemo(
    () => new Float32Array(targets.core),
    [targets],
  );

  const attributes = useMemo(
    () => ({
      positions: new Float32Array(targets.core),
      seed: new Float32Array(targets.seed),
      size: new Float32Array(targets.size),
    }),
    [targets],
  );

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uIntensity: { value: 0.18 },
      uHue: { value: 0.76 },
      uPointScale: { value: 1 },
    }),
    [],
  );

  useFrame((_, delta) => {
    const target =
      state === "idle"
        ? targets.core
        : persona === "sara"
          ? targets.sara
          : targets.alex;

    const morphSpeed = state === "idle" ? 4.8 : 3.2;
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
          ? 0.58
          : state === "thinking"
            ? 0.44
            : 0.76;

    const hue = persona === "sara" ? 0.76 : 0.53;

    if (materialRef.current) {
      const uniforms = materialRef.current.uniforms;

      uniforms.uTime.value = time;

      uniforms.uIntensity.value = THREE.MathUtils.damp(
        uniforms.uIntensity.value,
        intensity,
        4,
        delta,
      );

      uniforms.uHue.value = THREE.MathUtils.damp(
        uniforms.uHue.value,
        hue,
        3,
        delta,
      );

      uniforms.uPointScale.value = THREE.MathUtils.damp(
        uniforms.uPointScale.value,
        state === "idle" ? 0.92 : 1.06,
        4,
        delta,
      );
    }

    if (pointsRef.current) {
      const breathe = Math.sin(time * 1.35) * 0.018;

      pointsRef.current.scale.setScalar(1 + breathe);

      pointsRef.current.rotation.y +=
        delta * (state === "thinking" ? 0.08 : 0.025);
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
/* Ambient environment                                                       */
/* -------------------------------------------------------------------------- */

function AmbientParticles() {
  const ref = useRef<THREE.Points>(null);

  const data = useMemo(() => {
    const random = rng(0x9912aa);
    const positions = new Float32Array(AMBIENT * 3);

    for (let i = 0; i < AMBIENT; i++) {
      const radius = 1.8 + random() * 2.0;
      const angle = random() * TAU;
      const i3 = i * 3;

      positions[i3] = Math.cos(angle) * radius;
      positions[i3 + 1] = (random() - 0.5) * 3.0;
      positions[i3 + 2] = (random() - 0.5) * 1.6;
    }

    return positions;
  }, []);

  useFrame((_, delta) => {
    if (!ref.current) return;

    ref.current.rotation.y -= delta * 0.018;
    ref.current.rotation.z += delta * 0.008;
  });

  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[data, 3]}
        />
      </bufferGeometry>

      <pointsMaterial
        size={0.018}
        color="#5be8ff"
        transparent
        opacity={0.30}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/* -------------------------------------------------------------------------- */
/* Energy orbitals                                                            */
/* -------------------------------------------------------------------------- */

function EnergyRings({ state }: { state: CoreState }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    const speed =
      state === "thinking"
        ? 0.34
        : state === "speaking"
          ? 0.50
          : 0.12;

    groupRef.current.rotation.z += delta * speed;
    groupRef.current.rotation.x =
      Math.sin(performance.now() * 0.00035) * 0.14;
  });

  const firstOpacity = state === "idle" ? 0.18 : 0.34;
  const secondOpacity = state === "idle" ? 0.10 : 0.22;

  return (
    <group ref={groupRef}>
      <mesh rotation={[Math.PI / 2.2, 0, 0]}>
        <torusGeometry args={[1.12, 0.006, 8, 128]} />
        <meshBasicMaterial
          color="#55e9ff"
          transparent
          opacity={firstOpacity}
        />
      </mesh>

      <mesh rotation={[Math.PI / 3.1, 0.35, 0]}>
        <torusGeometry args={[1.36, 0.004, 8, 128]} />
        <meshBasicMaterial
          color="#9b7cff"
          transparent
          opacity={secondOpacity}
        />
      </mesh>
    </group>
  );
}

/* -------------------------------------------------------------------------- */
/* Particle shaders                                                           */
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

    float wave =
      sin(uTime * 1.4 + aSeed * 4.0 + p.y * 2.4) *
      0.006;

    float pulse =
      sin(uTime * 2.1 + aSeed * 7.0) *
      0.010 *
      uIntensity;

    p += normalize(p + vec3(0.0001)) * (wave + pulse);

    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);

    float depth = max(-mvPosition.z, 0.8);

    gl_PointSize =
      (aSize * (18.0 + 9.0 * uIntensity) * uPointScale) /
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

    if (distanceFromCenter > 0.5) discard;

    float core =
      smoothstep(
        0.5,
        0.05,
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
          0.64,
          1.0
        )
      );

    float alpha =
      (0.26 + core * 0.72) *
      (0.72 + uIntensity * 0.55);

    gl_FragColor =
      vec4(
        color,
        alpha * glow
      );
  }
`;

/* -------------------------------------------------------------------------- */
/* Public component                                                          */
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
        position: [0, 0, 4.8],
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
      <EntityParticles
        persona={persona}
        state={state}
      />

      <EnergyRings state={state} />

      <AmbientParticles />

      <EffectComposer multisampling={4}>
        <Bloom
          intensity={
            state === "speaking"
              ? 1.45
              : state === "idle"
                ? 0.72
                : 1.05
          }
          luminanceThreshold={0.08}
          luminanceSmoothing={0.45}
          mipmapBlur
        />

        <Vignette
          eskil={false}
          offset={0.25}
          darkness={0.55}
        />
      </EffectComposer>
    </Canvas>
  );
}
