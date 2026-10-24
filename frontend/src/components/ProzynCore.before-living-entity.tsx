import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

type Persona = "sara" | "alex";
type CoreState = "idle" | "listening" | "thinking" | "speaking";

interface ProzynCoreProps {
  persona?: Persona;
  state?: CoreState;
}

interface ParticleCharacterProps {
  persona: Persona;
  state: CoreState;
}

const PARTICLE_COUNT = 4600;

const STATE_CONFIG: Record<
  CoreState,
  {
    color: string;
    secondary: string;
    speed: number;
    pulse: number;
    spread: number;
  }
> = {
  idle: {
    color: "#79e8ff",
    secondary: "#4a9cff",
    speed: 0.28,
    pulse: 0.018,
    spread: 0.018,
  },
  listening: {
    color: "#72f5ff",
    secondary: "#6d8cff",
    speed: 0.72,
    pulse: 0.055,
    spread: 0.035,
  },
  thinking: {
    color: "#a98cff",
    secondary: "#55c9ff",
    speed: 1.2,
    pulse: 0.085,
    spread: 0.075,
  },
  speaking: {
    color: "#65f7e9",
    secondary: "#72a7ff",
    speed: 1.45,
    pulse: 0.11,
    spread: 0.045,
  },
};

function seededRandom(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function randomNormal(seed: number) {
  const u = Math.max(0.0001, seededRandom(seed));
  const v = seededRandom(seed + 17.31);

  return (
    Math.sqrt(-2 * Math.log(u)) *
    Math.cos(Math.PI * 2 * v)
  );
}

function addEllipsoid(
  points: THREE.Vector3[],
  count: number,
  center: THREE.Vector3,
  radius: THREE.Vector3,
  seedOffset: number,
) {
  for (let i = 0; i < count; i += 1) {
    const seed = seedOffset + i * 3.17;

    const theta = seededRandom(seed) * Math.PI * 2;
    const phi = Math.acos(
      THREE.MathUtils.clamp(
        seededRandom(seed + 1.7) * 2 - 1,
        -1,
        1,
      ),
    );

    const depth = Math.cbrt(seededRandom(seed + 3.1));

    const sinPhi = Math.sin(phi);

    points.push(
      new THREE.Vector3(
        center.x +
          Math.cos(theta) *
            sinPhi *
            radius.x *
            depth,
        center.y +
          Math.cos(phi) *
            radius.y *
            depth,
        center.z +
          Math.sin(theta) *
            sinPhi *
            radius.z *
            depth,
      ),
    );
  }
}

function addCylinder(
  points: THREE.Vector3[],
  count: number,
  center: THREE.Vector3,
  radiusX: number,
  radiusZ: number,
  height: number,
  seedOffset: number,
) {
  for (let i = 0; i < count; i += 1) {
    const seed = seedOffset + i * 4.27;
    const angle = seededRandom(seed) * Math.PI * 2;
    const radial = Math.sqrt(seededRandom(seed + 1.2));

    points.push(
      new THREE.Vector3(
        center.x +
          Math.cos(angle) *
            radiusX *
            radial,
        center.y +
          (seededRandom(seed + 2.4) - 0.5) *
            height,
        center.z +
          Math.sin(angle) *
            radiusZ *
            radial,
      ),
    );
  }
}

function createSaraTargets(count: number) {
  const points: THREE.Vector3[] = [];

  const headCount = Math.floor(count * 0.23);
  const neckCount = Math.floor(count * 0.06);
  const shoulderCount = Math.floor(count * 0.17);
  const torsoCount = Math.floor(count * 0.28);
  const hairCount = Math.floor(count * 0.18);
  const accentCount =
    count -
    headCount -
    neckCount -
    shoulderCount -
    torsoCount -
    hairCount;

  addEllipsoid(
    points,
    headCount,
    new THREE.Vector3(0, 1.08, 0),
    new THREE.Vector3(0.48, 0.64, 0.38),
    100,
  );

  addCylinder(
    points,
    neckCount,
    new THREE.Vector3(0, 0.42, 0),
    0.19,
    0.18,
    0.42,
    500,
  );

  addEllipsoid(
    points,
    shoulderCount,
    new THREE.Vector3(0, 0.17, 0),
    new THREE.Vector3(0.78, 0.24, 0.30),
    800,
  );

  addEllipsoid(
    points,
    torsoCount,
    new THREE.Vector3(0, -0.35, 0.02),
    new THREE.Vector3(0.56, 0.75, 0.30),
    1300,
  );

  addEllipsoid(
    points,
    hairCount,
    new THREE.Vector3(0, 1.18, -0.08),
    new THREE.Vector3(0.59, 0.70, 0.42),
    1800,
  );

  for (let i = 0; i < accentCount; i += 1) {
    const seed = 2500 + i * 2.31;

    const side =
      seededRandom(seed) > 0.5 ? 1 : -1;

    const t = seededRandom(seed + 1.4);

    points.push(
      new THREE.Vector3(
        side * (0.35 + t * 0.14),
        0.98 - t * 0.68,
        -0.02 + randomNormal(seed + 3) * 0.12,
      ),
    );
  }

  return normalizePointCount(points, count);
}

function createAlexTargets(count: number) {
  const points: THREE.Vector3[] = [];

  const headCount = Math.floor(count * 0.23);
  const neckCount = Math.floor(count * 0.065);
  const shoulderCount = Math.floor(count * 0.22);
  const torsoCount = Math.floor(count * 0.32);
  const hairCount = Math.floor(count * 0.10);
  const accentCount =
    count -
    headCount -
    neckCount -
    shoulderCount -
    torsoCount -
    hairCount;

  addEllipsoid(
    points,
    headCount,
    new THREE.Vector3(0, 1.06, 0),
    new THREE.Vector3(0.50, 0.63, 0.39),
    3000,
  );

  addCylinder(
    points,
    neckCount,
    new THREE.Vector3(0, 0.38, 0),
    0.22,
    0.20,
    0.48,
    3500,
  );

  addEllipsoid(
    points,
    shoulderCount,
    new THREE.Vector3(0, 0.13, 0),
    new THREE.Vector3(0.92, 0.27, 0.34),
    3900,
  );

  addEllipsoid(
    points,
    torsoCount,
    new THREE.Vector3(0, -0.39, 0.02),
    new THREE.Vector3(0.65, 0.78, 0.33),
    4500,
  );

  addEllipsoid(
    points,
    hairCount,
    new THREE.Vector3(0, 1.43, -0.02),
    new THREE.Vector3(0.47, 0.26, 0.34),
    5200,
  );

  for (let i = 0; i < accentCount; i += 1) {
    const seed = 5700 + i * 2.91;

    const side =
      seededRandom(seed) > 0.5 ? 1 : -1;

    const t = seededRandom(seed + 1.6);

    points.push(
      new THREE.Vector3(
        side * (0.39 + t * 0.22),
        0.84 - t * 0.72,
        -0.02 + randomNormal(seed + 3.7) * 0.12,
      ),
    );
  }

  return normalizePointCount(points, count);
}

function normalizePointCount(
  points: THREE.Vector3[],
  count: number,
) {
  if (points.length === count) {
    return points;
  }

  const result: THREE.Vector3[] = [];

  for (let i = 0; i < count; i += 1) {
    const source =
      points[
        Math.floor(
          seededRandom(9000 + i * 1.77) *
            points.length,
        )
      ];

    result.push(source.clone());
  }

  return result;
}

function createAmbientTargets(count: number) {
  const points: THREE.Vector3[] = [];

  for (let i = 0; i < count; i += 1) {
    const seed = 11000 + i * 3.13;

    const theta = seededRandom(seed) * Math.PI * 2;
    const radius =
      1.35 +
      seededRandom(seed + 1.2) * 1.25;

    const y =
      (seededRandom(seed + 2.4) - 0.5) * 2.7;

    points.push(
      new THREE.Vector3(
        Math.cos(theta) * radius,
        y,
        Math.sin(theta) * radius,
      ),
    );
  }

  return points;
}

function ParticleCharacter({
  persona,
  state,
}: ParticleCharacterProps) {
  const pointsRef =
    useRef<THREE.Points>(null);

  const materialRef =
    useRef<THREE.PointsMaterial>(null);

  const geometry = useMemo(() => {
    const sara = createSaraTargets(
      PARTICLE_COUNT,
    );
    const alex = createAlexTargets(
      PARTICLE_COUNT,
    );
    const ambient = createAmbientTargets(
      PARTICLE_COUNT,
    );

    const initial =
      persona === "sara" ? sara : alex;

    const positions = new Float32Array(
      PARTICLE_COUNT * 3,
    );

    const saraTargets = new Float32Array(
      PARTICLE_COUNT * 3,
    );

    const alexTargets = new Float32Array(
      PARTICLE_COUNT * 3,
    );

    const ambientTargets = new Float32Array(
      PARTICLE_COUNT * 3,
    );

    const randomOffsets = new Float32Array(
      PARTICLE_COUNT,
    );

    for (let i = 0; i < PARTICLE_COUNT; i += 1) {
      const index = i * 3;

      positions[index] = initial[i].x;
      positions[index + 1] = initial[i].y;
      positions[index + 2] = initial[i].z;

      saraTargets[index] = sara[i].x;
      saraTargets[index + 1] = sara[i].y;
      saraTargets[index + 2] = sara[i].z;

      alexTargets[index] = alex[i].x;
      alexTargets[index + 1] = alex[i].y;
      alexTargets[index + 2] = alex[i].z;

      ambientTargets[index] = ambient[i].x;
      ambientTargets[index + 1] = ambient[i].y;
      ambientTargets[index + 2] = ambient[i].z;

      randomOffsets[i] =
        seededRandom(13000 + i * 1.91);
    }

    const buffer =
      new THREE.BufferGeometry();

    buffer.setAttribute(
      "position",
      new THREE.BufferAttribute(
        positions,
        3,
      ),
    );

    buffer.setAttribute(
      "aSara",
      new THREE.BufferAttribute(
        saraTargets,
        3,
      ),
    );

    buffer.setAttribute(
      "aAlex",
      new THREE.BufferAttribute(
        alexTargets,
        3,
      ),
    );

    buffer.setAttribute(
      "aAmbient",
      new THREE.BufferAttribute(
        ambientTargets,
        3,
      ),
    );

    buffer.setAttribute(
      "aRandom",
      new THREE.BufferAttribute(
        randomOffsets,
        1,
      ),
    );

    return buffer;
  }, [persona]);

  const targetPositions =
    useMemo(() => {
      const sara =
        geometry.getAttribute("aSara")
          .array as Float32Array;

      const alex =
        geometry.getAttribute("aAlex")
          .array as Float32Array;

      const ambient =
        geometry.getAttribute("aAmbient")
          .array as Float32Array;

      return {
        sara,
        alex,
        ambient,
      };
    }, [geometry]);

  useFrame((_, delta) => {
    const points = pointsRef.current;

    if (!points) {
      return;
    }

    const position =
      points.geometry.getAttribute(
        "position",
      ) as THREE.BufferAttribute;

    const random =
      points.geometry.getAttribute(
        "aRandom",
      ) as THREE.BufferAttribute;

    const config =
      STATE_CONFIG[state];

    const target =
      persona === "sara"
        ? targetPositions.sara
        : targetPositions.alex;

    const time =
      performance.now() * 0.001;

    const smoothing =
      1 - Math.exp(-delta * 5.5);

    for (
      let i = 0;
      i < PARTICLE_COUNT;
      i += 1
    ) {
      const index = i * 3;

      const tx = target[index];
      const ty = target[index + 1];
      const tz = target[index + 2];

      const randomValue =
        random.getX(i);

      let energy =
        Math.sin(
          time * config.speed * 2 +
            randomValue * 12,
        ) * config.pulse;

      if (state === "listening") {
        energy +=
          Math.sin(
            time * 5 +
              randomValue * 20,
          ) * 0.018;
      }

      if (state === "thinking") {
        energy +=
          Math.sin(
            time * 3.2 +
              randomValue * 30,
          ) * 0.035;
      }

      const normalizedY =
        THREE.MathUtils.clamp(
          (ty + 1.35) / 2.9,
          0,
          1,
        );

      let x =
        tx +
        Math.sin(
          time * config.speed +
            normalizedY * 7 +
            randomValue * 15,
        ) *
          config.spread;

      let y =
        ty +
        Math.cos(
          time * config.speed * 0.8 +
            randomValue * 18,
        ) *
          config.spread;

      let z =
        tz +
        energy;

      if (state === "speaking") {
        const mouthZone =
          Math.exp(
            -Math.pow(
              (ty - 0.82) / 0.22,
              2,
            ),
          );

        y +=
          mouthZone *
          Math.sin(
            time * 12 +
              randomValue * 18,
          ) *
          0.045;

        z +=
          mouthZone *
          Math.sin(
            time * 10 +
              randomValue * 11,
          ) *
          0.025;
      }

      if (state === "thinking") {
        const outward =
          1 +
          Math.sin(
            time * 2.2 +
              randomValue * 9,
          ) *
            0.025;

        x *= outward;
        y *= outward;
        z *= outward;
      }

      position.setXYZ(
        i,
        THREE.MathUtils.lerp(
          position.getX(i),
          x,
          smoothing,
        ),
        THREE.MathUtils.lerp(
          position.getY(i),
          y,
          smoothing,
        ),
        THREE.MathUtils.lerp(
          position.getZ(i),
          z,
          smoothing,
        ),
      );
    }

    position.needsUpdate = true;

    const breathing =
      1 +
      Math.sin(
        time * 1.15,
      ) *
        (state === "idle" ? 0.018 : 0.01);

    points.scale.set(
      breathing,
      breathing,
      breathing,
    );

    points.rotation.y +=
      delta *
      (state === "thinking"
        ? 0.045
        : 0.018);

    points.rotation.x =
      Math.sin(time * 0.32) *
      0.018;

    if (materialRef.current) {
      materialRef.current.size =
        state === "speaking"
          ? 0.026
          : state === "thinking"
            ? 0.023
            : 0.019;

      materialRef.current.opacity =
        state === "thinking"
          ? 0.88
          : 0.76;
    }
  });

  return (
    <points
      ref={pointsRef}
      geometry={geometry}
    >
      <pointsMaterial
        ref={materialRef}
        color={
          STATE_CONFIG[state].color
        }
        size={0.019}
        sizeAttenuation
        transparent
        opacity={0.78}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function AmbientParticles({
  state,
}: {
  state: CoreState;
}) {
  const ref =
    useRef<THREE.Points>(null);

  const geometry = useMemo(() => {
    const points =
      createAmbientTargets(900);

    const positions =
      new Float32Array(
        points.length * 3,
      );

    for (
      let i = 0;
      i < points.length;
      i += 1
    ) {
      const index = i * 3;

      positions[index] = points[i].x;
      positions[index + 1] =
        points[i].y;
      positions[index + 2] =
        points[i].z;
    }

    const buffer =
      new THREE.BufferGeometry();

    buffer.setAttribute(
      "position",
      new THREE.BufferAttribute(
        positions,
        3,
      ),
    );

    return buffer;
  }, []);

  useFrame((_, delta) => {
    if (!ref.current) {
      return;
    }

    const intensity =
      state === "thinking"
        ? 0.7
        : state === "listening"
          ? 0.42
          : 0.24;

    ref.current.rotation.y +=
      delta * intensity * 0.045;

    ref.current.rotation.z +=
      delta * 0.008;
  });

  return (
    <points
      ref={ref}
      geometry={geometry}
    >
      <pointsMaterial
        color={
          STATE_CONFIG[state].secondary
        }
        size={0.011}
        sizeAttenuation
        transparent
        opacity={
          state === "thinking"
            ? 0.48
            : 0.25
        }
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function CoreEnvironment({
  persona,
  state,
}: {
  persona: Persona;
  state: CoreState;
}) {
  const groupRef =
    useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!groupRef.current) {
      return;
    }

    groupRef.current.rotation.y +=
      delta * 0.006;
  });

  return (
    <>
      <color
        attach="background"
        args={["#01060c"]}
      />

      <ambientLight intensity={0.25} />

      <group ref={groupRef}>
        <ParticleCharacter
          persona={persona}
          state={state}
        />

        <AmbientParticles
          state={state}
        />
      </group>
    </>
  );
}

export default function ProzynCore({
  persona = "sara",
  state = "idle",
}: ProzynCoreProps) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        minWidth: 0,
        minHeight: 0,
      }}
    >
      <Canvas
        camera={{
          position: [0, 0.05, 4.35],
          fov: 40,
          near: 0.1,
          far: 20,
        }}
        dpr={[1, 1.75]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        }}
      >
        <CoreEnvironment
          persona={persona}
          state={state}
        />
      </Canvas>
    </div>
  );
}
