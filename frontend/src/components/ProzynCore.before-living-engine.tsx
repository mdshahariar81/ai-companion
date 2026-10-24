import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

export type Persona = "sara" | "alex";
export type CoreState = "idle" | "listening" | "thinking" | "speaking";

const PARTICLE_COUNT = 10000;
const AMBIENT_COUNT = 1500;

type TargetData = {
  sara: Float32Array;
  alex: Float32Array;
  phase: Float32Array;
  size: Float32Array;
};

function gaussian() {
  let u = 0;
  let v = 0;

  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();

  return Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * v);
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

function ellipse(
  target: Float32Array,
  cursor: number,
  count: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  depth: number,
  zOffset = 0,
) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.sqrt(Math.random());

    const x =
      cx +
      Math.cos(angle) * rx * radius +
      gaussian() * 0.012;

    const y =
      cy +
      Math.sin(angle) * ry * radius +
      gaussian() * 0.012;

    const z =
      zOffset +
      gaussian() * depth;

    setPoint(target, cursor + i, x, y, z);
  }
}

function tube(
  target: Float32Array,
  cursor: number,
  count: number,
  points: Array<[number, number]>,
  thickness: number,
  depth: number,
  zOffset = 0,
) {
  for (let i = 0; i < count; i += 1) {
    const segmentPosition =
      Math.random() * (points.length - 1);

    const segment = Math.min(
      Math.floor(segmentPosition),
      points.length - 2,
    );

    const local =
      segmentPosition - segment;

    const [x1, y1] = points[segment];
    const [x2, y2] = points[segment + 1];

    const x =
      THREE.MathUtils.lerp(x1, x2, local);

    const y =
      THREE.MathUtils.lerp(y1, y2, local);

    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.max(
      Math.sqrt(dx * dx + dy * dy),
      0.001,
    );

    const nx = -dy / length;
    const ny = dx / length;

    const offset =
      gaussian() * thickness;

    setPoint(
      target,
      cursor + i,
      x + nx * offset,
      y + ny * offset,
      zOffset + gaussian() * depth,
    );
  }
}

function flowingHair(
  target: Float32Array,
  cursor: number,
  count: number,
  side: -1 | 1,
) {
  for (let i = 0; i < count; i += 1) {
    const strand = Math.floor(
      Math.random() * 16,
    );

    const t = Math.random();

    const topX =
      side *
      (0.23 + strand * 0.018);

    const topY =
      1.55 -
      strand * 0.018;

    const bottomX =
      side *
      (0.42 + strand * 0.035);

    const bottomY =
      0.38 -
      t * 0.18;

    const x =
      THREE.MathUtils.lerp(
        topX,
        bottomX,
        t,
      ) +
      gaussian() * 0.035;

    const y =
      THREE.MathUtils.lerp(
        topY,
        bottomY,
        t,
      ) +
      gaussian() * 0.035;

    const z =
      -0.06 +
      gaussian() * 0.12;

    setPoint(
      target,
      cursor + i,
      x,
      y,
      z,
    );
  }
}

function hairCrown(
  target: Float32Array,
  cursor: number,
  count: number,
) {
  for (let i = 0; i < count; i += 1) {
    const angle =
      Math.PI +
      Math.random() * Math.PI;

    const radius =
      Math.sqrt(Math.random());

    const x =
      Math.cos(angle) *
      0.42 *
      radius;

    const y =
      1.48 +
      Math.sin(angle) *
      0.38 *
      radius;

    setPoint(
      target,
      cursor + i,
      x + gaussian() * 0.025,
      y + gaussian() * 0.025,
      -0.08 + gaussian() * 0.1,
    );
  }
}

function createSara(target: Float32Array) {
  let cursor = 0;

  /*
   * SARA
   *
   * Human-like upper-body silhouette.
   * The important difference from the previous version:
   * hair is flowing around the head instead of forming
   * a rectangular block.
   */

  // Back hair / crown.
  hairCrown(target, cursor, 1900);
  cursor += 1900;

  // Long left hair.
  flowingHair(target, cursor, 1100, -1);
  cursor += 1100;

  // Long right hair.
  flowingHair(target, cursor, 1100, 1);
  cursor += 1100;

  // Head / face.
  ellipse(
    target,
    cursor,
    1700,
    0,
    1.42,
    0.31,
    0.40,
    0.13,
    0.04,
  );
  cursor += 1700;

  // Lower face / jaw softness.
  ellipse(
    target,
    cursor,
    480,
    0,
    1.20,
    0.25,
    0.23,
    0.12,
    0.05,
  );
  cursor += 480;

  // Neck.
  ellipse(
    target,
    cursor,
    420,
    0,
    0.88,
    0.105,
    0.25,
    0.10,
    0.02,
  );
  cursor += 420;

  // Soft feminine shoulders.
  ellipse(
    target,
    cursor,
    1150,
    0,
    0.63,
    0.76,
    0.25,
    0.16,
    0,
  );
  cursor += 1150;

  // Upper torso.
  ellipse(
    target,
    cursor,
    1250,
    0,
    0.27,
    0.58,
    0.48,
    0.18,
    0,
  );
  cursor += 1250;

  // Lower torso.
  ellipse(
    target,
    cursor,
    650,
    0,
    -0.16,
    0.48,
    0.34,
    0.16,
    0,
  );
  cursor += 650;

  // Left arm.
  tube(
    target,
    cursor,
    650,
    [
      [-0.54, 0.68],
      [-0.70, 0.56],
      [-0.82, 0.35],
      [-0.91, 0.08],
      [-0.92, -0.22],
      [-0.87, -0.45],
    ],
    0.085,
    0.12,
    0,
  );
  cursor += 650;

  // Right arm.
  tube(
    target,
    cursor,
    650,
    [
      [0.54, 0.68],
      [0.70, 0.56],
      [0.82, 0.35],
      [0.91, 0.08],
      [0.92, -0.22],
      [0.87, -0.45],
    ],
    0.085,
    0.12,
    0,
  );
  cursor += 650;

  // Soft particle halo around silhouette.
  while (cursor < PARTICLE_COUNT) {
    const angle =
      Math.random() * Math.PI * 2;

    const radius =
      0.72 + Math.random() * 0.58;

    const vertical =
      0.1 +
      Math.sin(angle) *
        radius *
        1.15;

    setPoint(
      target,
      cursor,
      Math.cos(angle) * radius,
      vertical,
      gaussian() * 0.34,
    );

    cursor += 1;
  }
}

function shortHair(
  target: Float32Array,
  cursor: number,
  count: number,
) {
  for (let i = 0; i < count; i += 1) {
    const angle =
      Math.random() * Math.PI * 2;

    const radius =
      Math.sqrt(Math.random());

    const x =
      Math.cos(angle) *
      0.36 *
      radius;

    const y =
      1.52 +
      Math.sin(angle) *
      0.33 *
      radius;

    setPoint(
      target,
      cursor + i,
      x,
      y,
      -0.05 + gaussian() * 0.12,
    );
  }
}

function createAlex(target: Float32Array) {
  let cursor = 0;

  // Hair.
  shortHair(target, cursor, 1450);
  cursor += 1450;

  // Head.
  ellipse(
    target,
    cursor,
    1850,
    0,
    1.42,
    0.34,
    0.42,
    0.14,
    0.05,
  );
  cursor += 1850;

  // Jaw.
  ellipse(
    target,
    cursor,
    450,
    0,
    1.18,
    0.28,
    0.23,
    0.12,
    0.05,
  );
  cursor += 450;

  // Neck.
  ellipse(
    target,
    cursor,
    450,
    0,
    0.88,
    0.135,
    0.26,
    0.11,
    0.02,
  );
  cursor += 450;

  // Broad shoulders.
  ellipse(
    target,
    cursor,
    1550,
    0,
    0.62,
    0.88,
    0.27,
    0.17,
    0,
  );
  cursor += 1550;

  // Strong torso.
  ellipse(
    target,
    cursor,
    1550,
    0,
    0.20,
    0.66,
    0.55,
    0.18,
    0,
  );
  cursor += 1550;

  // Lower torso.
  ellipse(
    target,
    cursor,
    700,
    0,
    -0.25,
    0.54,
    0.34,
    0.17,
    0,
  );
  cursor += 700;

  // Left arm.
  tube(
    target,
    cursor,
    650,
    [
      [-0.70, 0.67],
      [-0.84, 0.48],
      [-0.96, 0.22],
      [-1.02, -0.10],
      [-1.02, -0.42],
      [-0.96, -0.65],
    ],
    0.11,
    0.13,
    0,
  );
  cursor += 650;

  // Right arm.
  tube(
    target,
    cursor,
    650,
    [
      [0.70, 0.67],
      [0.84, 0.48],
      [0.96, 0.22],
      [1.02, -0.10],
      [1.02, -0.42],
      [0.96, -0.65],
    ],
    0.11,
    0.13,
    0,
  );
  cursor += 650;

  while (cursor < PARTICLE_COUNT) {
    const angle =
      Math.random() * Math.PI * 2;

    const radius =
      0.74 + Math.random() * 0.58;

    setPoint(
      target,
      cursor,
      Math.cos(angle) * radius,
      0.08 +
        Math.sin(angle) *
          radius *
          1.12,
      gaussian() * 0.32,
    );

    cursor += 1;
  }
}

function createTargetData(): TargetData {
  const sara = new Float32Array(
    PARTICLE_COUNT * 3,
  );

  const alex = new Float32Array(
    PARTICLE_COUNT * 3,
  );

  const phase = new Float32Array(
    PARTICLE_COUNT,
  );

  const size = new Float32Array(
    PARTICLE_COUNT,
  );

  createSara(sara);
  createAlex(alex);

  for (let i = 0; i < PARTICLE_COUNT; i += 1) {
    phase[i] =
      Math.random() * Math.PI * 2;

    /*
     * Most particles remain small.
     * A smaller number are slightly larger,
     * creating depth and sparkle.
     */
    const random = Math.random();

    size[i] =
      random < 0.82
        ? 0.65 + Math.random() * 0.5
        : 1.15 + Math.random() * 0.9;
  }

  return {
    sara,
    alex,
    phase,
    size,
  };
}

const vertexShader = `
  attribute float aSize;

  varying float vDepth;

  void main() {
    vec4 mvPosition =
      modelViewMatrix * vec4(position, 1.0);

    float depthScale =
      22.0 / max(-mvPosition.z, 1.0);

    gl_PointSize =
      aSize * depthScale;

    gl_Position =
      projectionMatrix * mvPosition;

    vDepth =
      clamp(1.0 / max(-mvPosition.z, 1.0), 0.0, 1.0);
  }
`;

const fragmentShader = `
  uniform vec3 uColor;

  varying float vDepth;

  void main() {
    vec2 uv =
      gl_PointCoord - vec2(0.5);

    float distanceFromCenter =
      length(uv);

    if (distanceFromCenter > 0.5) {
      discard;
    }

    float soft =
      1.0 -
      smoothstep(
        0.12,
        0.5,
        distanceFromCenter
      );

    float glow =
      0.65 +
      vDepth * 0.35;

    gl_FragColor =
      vec4(
        uColor,
        soft * glow * 0.72
      );
  }
`;

function LivingEntity({
  persona,
  state,
  data,
}: {
  persona: Persona;
  state: CoreState;
  data: TargetData;
}) {
  const pointsRef =
    useRef<THREE.Points>(null);

  const positionsRef =
    useRef<Float32Array | null>(null);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uColor: {
            value: new THREE.Color(
              persona === "sara"
                ? "#9aefff"
                : "#86c7ff",
            ),
          },
        },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [persona],
  );

  const initialPositions = useMemo(
    () =>
      new Float32Array(
        persona === "sara"
          ? data.sara
          : data.alex,
      ),
    [data, persona],
  );

  useFrame((frame) => {
    const points =
      pointsRef.current;

    if (!points) return;

    if (!positionsRef.current) {
      positionsRef.current =
        points.geometry.attributes.position
          .array as Float32Array;
    }

    const positions =
      positionsRef.current;

    const target =
      persona === "sara"
        ? data.sara
        : data.alex;

    const time =
      frame.clock.getElapsedTime();

    const motion =
      state === "listening"
        ? 0.055
        : state === "thinking"
          ? 0.072
          : state === "speaking"
            ? 0.062
            : 0.022;

    for (
      let i = 0;
      i < PARTICLE_COUNT;
      i += 1
    ) {
      const index = i * 3;
      const phase = data.phase[i];

      let x = target[index];
      let y = target[index + 1];
      let z = target[index + 2];

      // Natural breathing.
      const breath =
        Math.sin(
          time * 1.15 + phase,
        ) * motion;

      x +=
        Math.sin(
          time * 0.52 +
            phase * 1.7,
        ) * 0.012;

      y +=
        breath +
        Math.cos(
          time * 0.68 +
            phase * 1.2,
        ) *
          0.012;

      z +=
        Math.sin(
          time * 0.45 +
            phase,
        ) *
        0.018;

      // Listening: radial ripple.
      if (state === "listening") {
        const radius =
          Math.sqrt(
            x * x + y * y,
          );

        z +=
          Math.sin(
            time * 3.2 -
              radius * 7.5,
          ) * 0.026;
      }

      // Thinking: subtle neural movement.
      if (state === "thinking") {
        const neural =
          Math.sin(
            time * 2.4 +
              phase * 2.1,
          ) * 0.025;

        x +=
          neural *
          Math.cos(phase);

        y +=
          neural *
          Math.sin(phase);
      }

      // Speaking: stronger living pulse.
      if (state === "speaking") {
        const pulse =
          1 +
          Math.sin(
            time * 6.5 +
              phase,
          ) *
            0.022;

        x *= pulse;
        y *= pulse;
      }

      positions[index] +=
        (x - positions[index]) *
        0.075;

      positions[index + 1] +=
        (y - positions[index + 1]) *
        0.075;

      positions[index + 2] +=
        (z - positions[index + 2]) *
        0.075;
    }

    points.geometry.attributes.position.needsUpdate = true;

    // Very subtle 3D breathing rotation.
    points.rotation.y =
      Math.sin(time * 0.12) *
      0.035;

    points.rotation.x =
      Math.sin(time * 0.08) *
      0.012;
  });

  return (
    <points
      ref={pointsRef}
      scale={[1.14, 1.14, 1.14]}
      position={[0, 0.03, 0]}
    >
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[initialPositions, 3]}
        />

        <bufferAttribute
          attach="attributes-aSize"
          args={[data.size, 1]}
        />
      </bufferGeometry>

      <primitive
        object={material}
        attach="material"
      />
    </points>
  );
}

function AmbientField() {
  const positions = useMemo(() => {
    const data =
      new Float32Array(
        AMBIENT_COUNT * 3,
      );

    for (
      let i = 0;
      i < AMBIENT_COUNT;
      i += 1
    ) {
      const angle =
        Math.random() *
        Math.PI *
        2;

      const radius =
        2.0 +
        Math.random() * 3.0;

      data[i * 3] =
        Math.cos(angle) *
        radius;

      data[i * 3 + 1] =
        (Math.random() - 0.5) *
        4.5;

      data[i * 3 + 2] =
        (Math.random() - 0.5) *
        2.4;
    }

    return data;
  }, []);

  const ref =
    useRef<THREE.Points>(null);

  useFrame((frame) => {
    if (!ref.current) return;

    const time =
      frame.clock.getElapsedTime();

    ref.current.rotation.y =
      time * 0.008;

    ref.current.rotation.x =
      Math.sin(time * 0.07) *
      0.025;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>

      <pointsMaterial
        color="#70dff4"
        size={0.008}
        transparent
        opacity={0.25}
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
      <LivingEntity
        persona={persona}
        state={state}
        data={data}
      />

      <AmbientField />
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
  const data =
    useMemo(
      () => createTargetData(),
      [],
    );

  return (
    <Canvas
      dpr={[1, 1.6]}
      camera={{
        position: [0, 0.05, 5.8],
        fov: 42,
      }}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference:
          "high-performance",
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
