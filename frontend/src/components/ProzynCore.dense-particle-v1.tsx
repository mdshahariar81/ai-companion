import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

export type Persona = "sara" | "alex";
export type CoreState = "idle" | "listening" | "thinking" | "speaking";

const PARTICLE_COUNT = 10000;
const AMBIENT_COUNT = 1400;

type TargetData = {
  core: Float32Array;
  sara: Float32Array;
  alex: Float32Array;
  phase: Float32Array;
  size: Float32Array;
};

function randomGaussian(): number {
  let u = 0;
  let v = 0;

  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();

  return Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * v);
}

function addPoint(
  target: Float32Array,
  index: number,
  x: number,
  y: number,
  z: number,
) {
  const offset = index * 3;

  target[offset] = x;
  target[offset + 1] = y;
  target[offset + 2] = z;
}

function fillEllipse(
  target: Float32Array,
  start: number,
  count: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  depth: number,
  softness = 1,
) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.sqrt(Math.random());

    const x =
      cx +
      Math.cos(angle) *
        rx *
        radius *
        (1 + randomGaussian() * 0.018 * softness);

    const y =
      cy +
      Math.sin(angle) *
        ry *
        radius *
        (1 + randomGaussian() * 0.018 * softness);

    const z = randomGaussian() * depth;

    addPoint(target, start + i, x, y, z);
  }
}

function fillTube(
  target: Float32Array,
  start: number,
  count: number,
  points: Array<[number, number]>,
  thickness: number,
  depth: number,
) {
  for (let i = 0; i < count; i += 1) {
    const t = Math.random() * (points.length - 1);
    const index = Math.min(Math.floor(t), points.length - 2);
    const local = t - index;

    const [x1, y1] = points[index];
    const [x2, y2] = points[index + 1];

    const x = THREE.MathUtils.lerp(x1, x2, local);
    const y = THREE.MathUtils.lerp(y1, y2, local);

    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.max(Math.sqrt(dx * dx + dy * dy), 0.001);

    const nx = -dy / length;
    const ny = dx / length;

    const offset = randomGaussian() * thickness;

    addPoint(
      target,
      start + i,
      x + nx * offset,
      y + ny * offset,
      randomGaussian() * depth,
    );
  }
}

function fillHair(
  target: Float32Array,
  start: number,
  count: number,
  cx: number,
  cy: number,
) {
  for (let i = 0; i < count; i += 1) {
    const side = Math.random() < 0.5 ? -1 : 1;

    const x =
      cx +
      side *
        (0.27 + Math.random() * 0.19) +
      randomGaussian() * 0.055;

    const y =
      cy +
      (Math.random() - 0.25) * 0.82 +
      randomGaussian() * 0.05;

    const z = randomGaussian() * 0.15;

    addPoint(target, start + i, x, y, z);
  }
}

function createSara(target: Float32Array) {
  let cursor = 0;

  // Head
  fillEllipse(target, cursor, 1850, 0, 1.43, 0.34, 0.44, 0.16, 0.7);
  cursor += 1850;

  // Hair mass — long, soft and flowing
  fillHair(target, cursor, 2100, 0, 1.37);
  cursor += 2100;

  // Neck
  fillEllipse(target, cursor, 430, 0, 0.88, 0.12, 0.25, 0.11, 0.7);
  cursor += 430;

  // Upper chest / shoulders
  fillEllipse(target, cursor, 1450, 0, 0.63, 0.78, 0.28, 0.18, 0.8);
  cursor += 1450;

  // Soft torso
  fillEllipse(target, cursor, 1450, 0, 0.08, 0.62, 0.68, 0.19, 0.9);
  cursor += 1450;

  // Left arm
  fillTube(
    target,
    cursor,
    850,
    [
      [-0.62, 0.64],
      [-0.82, 0.46],
      [-0.99, 0.18],
      [-1.08, -0.15],
      [-1.02, -0.48],
    ],
    0.105,
    0.14,
  );
  cursor += 850;

  // Right arm
  fillTube(
    target,
    cursor,
    850,
    [
      [0.62, 0.64],
      [0.82, 0.46],
      [0.99, 0.18],
      [1.08, -0.15],
      [1.02, -0.48],
    ],
    0.105,
    0.14,
  );
  cursor += 850;

  // Extra shoulder softness
  fillEllipse(target, cursor, 500, -0.55, 0.52, 0.27, 0.2, 0.13, 0.8);
  cursor += 500;

  fillEllipse(target, cursor, 500, 0.55, 0.52, 0.27, 0.2, 0.13, 0.8);
  cursor += 500;

  // Remaining particles become a soft body halo.
  while (cursor < PARTICLE_COUNT) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 0.72 + Math.random() * 0.48;

    addPoint(
      target,
      cursor,
      Math.cos(angle) * radius,
      0.35 + Math.sin(angle) * radius * 1.45,
      randomGaussian() * 0.32,
    );

    cursor += 1;
  }
}

function fillShortHair(
  target: Float32Array,
  start: number,
  count: number,
) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.sqrt(Math.random());

    const x = Math.cos(angle) * 0.39 * radius;
    const y = 1.44 + Math.sin(angle) * 0.39 * radius;

    addPoint(
      target,
      start + i,
      x,
      y,
      randomGaussian() * 0.15,
    );
  }
}

function createAlex(target: Float32Array) {
  let cursor = 0;

  // Head
  fillEllipse(target, cursor, 1800, 0, 1.42, 0.35, 0.43, 0.15, 0.7);
  cursor += 1800;

  // Short hair
  fillShortHair(target, cursor, 1150);
  cursor += 1150;

  // Neck
  fillEllipse(target, cursor, 470, 0, 0.88, 0.14, 0.27, 0.11, 0.7);
  cursor += 470;

  // Broad shoulders
  fillEllipse(target, cursor, 1850, 0, 0.62, 0.91, 0.28, 0.18, 0.7);
  cursor += 1850;

  // Structured torso
  fillEllipse(target, cursor, 1700, 0, 0.02, 0.68, 0.73, 0.19, 0.8);
  cursor += 1700;

  // Left arm
  fillTube(
    target,
    cursor,
    850,
    [
      [-0.75, 0.62],
      [-0.9, 0.37],
      [-1.02, 0.02],
      [-1.05, -0.36],
      [-1.0, -0.66],
    ],
    0.13,
    0.14,
  );
  cursor += 850;

  // Right arm
  fillTube(
    target,
    cursor,
    850,
    [
      [0.75, 0.62],
      [0.9, 0.37],
      [1.02, 0.02],
      [1.05, -0.36],
      [1.0, -0.66],
    ],
    0.13,
    0.14,
  );
  cursor += 850;

  // Additional shoulder definition
  fillEllipse(target, cursor, 550, -0.65, 0.55, 0.28, 0.2, 0.13, 0.8);
  cursor += 550;

  fillEllipse(target, cursor, 550, 0.65, 0.55, 0.28, 0.2, 0.13, 0.8);
  cursor += 550;

  while (cursor < PARTICLE_COUNT) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 0.7 + Math.random() * 0.5;

    addPoint(
      target,
      cursor,
      Math.cos(angle) * radius,
      0.3 + Math.sin(angle) * radius * 1.42,
      randomGaussian() * 0.3,
    );

    cursor += 1;
  }
}

function createCore(target: Float32Array) {
  for (let i = 0; i < PARTICLE_COUNT; i += 1) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const radius =
      0.42 +
      Math.pow(Math.random(), 2.2) * 1.1;

    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.cos(phi) + 0.15;
    const z = radius * Math.sin(phi) * Math.sin(theta);

    addPoint(target, i, x, y, z);
  }
}

function createTargetData(): TargetData {
  const core = new Float32Array(PARTICLE_COUNT * 3);
  const sara = new Float32Array(PARTICLE_COUNT * 3);
  const alex = new Float32Array(PARTICLE_COUNT * 3);
  const phase = new Float32Array(PARTICLE_COUNT);
  const size = new Float32Array(PARTICLE_COUNT);

  createCore(core);
  createSara(sara);
  createAlex(alex);

  for (let i = 0; i < PARTICLE_COUNT; i += 1) {
    phase[i] = Math.random() * Math.PI * 2;
    size[i] = 0.55 + Math.random() * 0.9;
  }

  return {
    core,
    sara,
    alex,
    phase,
    size,
  };
}

function LivingParticles({
  persona,
  state,
  data,
}: {
  persona: Persona;
  state: CoreState;
  data: TargetData;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const positionsRef = useRef<Float32Array | null>(null);

  const material = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: persona === "sara" ? "#91efff" : "#7dbdff",
        size: 0.025,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      }),
    [persona],
  );

  useFrame((frameState) => {
    const points = pointsRef.current;

    if (!points) return;

    if (!positionsRef.current) {
      positionsRef.current = points.geometry.attributes.position
        .array as Float32Array;
    }

    const positions = positionsRef.current;

    const target =
      state === "idle"
        ? data.core
        : persona === "sara"
          ? data.sara
          : data.alex;

    const time = frameState.clock.getElapsedTime();

    const stateStrength =
      state === "listening"
        ? 0.055
        : state === "thinking"
          ? 0.08
          : state === "speaking"
            ? 0.065
            : 0.025;

    for (let i = 0; i < PARTICLE_COUNT; i += 1) {
      const offset = i * 3;

      let tx = target[offset];
      let ty = target[offset + 1];
      let tz = target[offset + 2];

      const phase = data.phase[i];

      const breathing =
        Math.sin(time * 1.25 + phase) * stateStrength;

      const driftX =
        Math.sin(time * 0.62 + phase * 1.7) * 0.012;

      const driftY =
        Math.cos(time * 0.72 + phase * 1.35) * 0.012;

      const driftZ =
        Math.sin(time * 0.5 + phase * 0.8) * 0.018;

      tx += driftX;
      ty += breathing + driftY;
      tz += driftZ;

      if (state === "listening") {
        const ripple =
          Math.sin(
            time * 3.4 -
              Math.sqrt(tx * tx + ty * ty) * 7
          ) * 0.018;

        tz += ripple;
      }

      if (state === "thinking") {
        const neural =
          Math.sin(time * 2.6 + phase * 2.4) *
          0.025;

        tx += neural * Math.cos(phase);
        ty += neural * Math.sin(phase);
      }

      if (state === "speaking") {
        const pulse =
          1 +
          Math.sin(time * 7 + phase) * 0.025;

        tx *= pulse;
        ty *= pulse;
      }

      positions[offset] +=
        (tx - positions[offset]) * 0.075;

      positions[offset + 1] +=
        (ty - positions[offset + 1]) * 0.075;

      positions[offset + 2] +=
        (tz - positions[offset + 2]) * 0.075;
    }

    points.geometry.attributes.position.needsUpdate = true;

    points.rotation.y =
      Math.sin(time * 0.12) * 0.055;

    points.rotation.x =
      Math.sin(time * 0.09) * 0.018;
  });

  const initialPositions = useMemo(
    () => new Float32Array(data.core),
    [data],
  );

  return (
    <points
      ref={pointsRef}
      position={[0, 0.02, 0]}
      scale={[1.12, 1.12, 1.12]}
    >
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[initialPositions, 3]}
        />
      </bufferGeometry>

      <primitive object={material} attach="material" />
    </points>
  );
}

function AmbientParticles() {
  const data = useMemo(() => {
    const positions = new Float32Array(AMBIENT_COUNT * 3);

    for (let i = 0; i < AMBIENT_COUNT; i += 1) {
      const radius = 2.2 + Math.random() * 2.7;
      const angle = Math.random() * Math.PI * 2;

      positions[i * 3] =
        Math.cos(angle) * radius;

      positions[i * 3 + 1] =
        (Math.random() - 0.5) * 4.5;

      positions[i * 3 + 2] =
        (Math.random() - 0.5) * 2.2;
    }

    return positions;
  }, []);

  const ref = useRef<THREE.Points>(null);

  useFrame((frameState) => {
    if (!ref.current) return;

    ref.current.rotation.y =
      frameState.clock.getElapsedTime() * 0.012;

    ref.current.rotation.x =
      Math.sin(
        frameState.clock.getElapsedTime() * 0.08,
      ) * 0.03;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[data, 3]}
        />
      </bufferGeometry>

      <pointsMaterial
        color="#72dff5"
        size={0.009}
        transparent
        opacity={0.28}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function Scene({
  persona,
  state,
  data,
}: {
  persona: Persona;
  state: CoreState;
  data: TargetData;
}) {
  return (
    <>
      <ambientLight intensity={0.4} />

      <LivingParticles
        persona={persona}
        state={state}
        data={data}
      />

      <AmbientParticles />
    </>
  );
}

export default function ProzynCore({
  persona,
  state,
}: {
  persona: Persona;
  state: CoreState;
}) {
  const data = useMemo(() => createTargetData(), []);

  return (
    <Canvas
      dpr={[1, 1.7]}
      camera={{
        position: [0, 0.08, 5.8],
        fov: 42,
      }}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      }}
    >
      <Scene
        persona={persona}
        state={state}
        data={data}
      />
    </Canvas>
  );
}
