import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

type CoreState = "idle" | "listening" | "thinking" | "speaking";

interface ProzynCoreProps {
  state?: CoreState;
}

interface ParticleCoreProps {
  state: CoreState;
}

const STATE_CONFIG: Record<
  CoreState,
  {
    color: THREE.Color;
    accent: THREE.Color;
    speed: number;
    pulse: number;
  }
> = {
  idle: {
    color: new THREE.Color("#63e9ff"),
    accent: new THREE.Color("#8c7cff"),
    speed: 0.22,
    pulse: 0.035,
  },
  listening: {
    color: new THREE.Color("#55eaff"),
    accent: new THREE.Color("#6ee7ff"),
    speed: 0.55,
    pulse: 0.075,
  },
  thinking: {
    color: new THREE.Color("#9c82ff"),
    accent: new THREE.Color("#55ddff"),
    speed: 0.85,
    pulse: 0.09,
  },
  speaking: {
    color: new THREE.Color("#63f4d0"),
    accent: new THREE.Color("#58d9ff"),
    speed: 1.05,
    pulse: 0.12,
  },
};

const PARTICLE_COUNT = 4200;

function createSphereTargets(count: number) {
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i += 1) {
    const index = i * 3;

    const phi = Math.acos(1 - 2 * Math.random());
    const theta = Math.PI * 2 * Math.random();

    const radius =
      0.88 +
      Math.pow(Math.random(), 1.8) * 0.42 +
      Math.sin(phi * 7) * 0.025;

    positions[index] = Math.sin(phi) * Math.cos(theta) * radius;
    positions[index + 1] = Math.cos(phi) * radius;
    positions[index + 2] = Math.sin(phi) * Math.sin(theta) * radius;
  }

  return positions;
}

function createInnerTargets(count: number) {
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i += 1) {
    const index = i * 3;

    const angle = Math.random() * Math.PI * 2;
    const radius = Math.pow(Math.random(), 0.7) * 0.78;

    const wave = Math.sin(angle * 5) * 0.08;

    positions[index] = Math.cos(angle) * radius + wave;
    positions[index + 1] =
      (Math.random() - 0.5) * 0.7 +
      Math.sin(angle * 3) * 0.08;
    positions[index + 2] =
      Math.sin(angle) * radius;
  }

  return positions;
}

function createOuterTargets(count: number) {
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i += 1) {
    const index = i * 3;

    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(1 - 2 * Math.random());

    const radius = 1.15 + Math.random() * 0.75;

    positions[index] =
      Math.sin(phi) * Math.cos(theta) * radius;

    positions[index + 1] =
      Math.cos(phi) * radius;

    positions[index + 2] =
      Math.sin(phi) * Math.sin(theta) * radius;
  }

  return positions;
}

function ParticleCore({ state }: ParticleCoreProps) {
  const config = STATE_CONFIG[state];

  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.PointsMaterial>(null);

  const basePositions = useMemo(
    () => createSphereTargets(PARTICLE_COUNT),
    [],
  );

  const innerPositions = useMemo(
    () => createInnerTargets(PARTICLE_COUNT),
    [],
  );

  const outerPositions = useMemo(
    () => createOuterTargets(PARTICLE_COUNT),
    [],
  );

  const currentPositions = useMemo(
    () => new Float32Array(basePositions),
    [basePositions],
  );

  const geometry = useMemo(() => {
    const bufferGeometry = new THREE.BufferGeometry();

    bufferGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(currentPositions, 3),
    );

    return bufferGeometry;
  }, [currentPositions]);

  useFrame(({ clock, pointer }, delta) => {
    if (!pointsRef.current || !materialRef.current) {
      return;
    }

    const positionAttribute =
      pointsRef.current.geometry.getAttribute(
        "position",
      ) as THREE.BufferAttribute;

    const target =
      state === "thinking"
        ? outerPositions
        : state === "speaking"
          ? innerPositions
          : basePositions;

    const time = clock.getElapsedTime();

    const morphSpeed =
      state === "listening"
        ? 5.5
        : state === "thinking"
          ? 2.8
          : 3.6;

    const breathing =
      1 +
      Math.sin(
        time * (1.4 + config.speed * 2),
      ) *
        config.pulse;

    for (let i = 0; i < PARTICLE_COUNT; i += 1) {
      const index = i * 3;

      let targetX = target[index];
      let targetY = target[index + 1];
      let targetZ = target[index + 2];

      const noise =
        Math.sin(
          time * 1.7 +
            i * 0.037,
        ) *
        0.012;

      targetX += noise;
      targetY +=
        Math.cos(
          time * 1.4 +
            i * 0.029,
        ) *
        0.01;
      targetZ +=
        Math.sin(
          time * 1.1 +
            i * 0.021,
        ) *
        0.01;

      targetX *= breathing;
      targetY *= breathing;
      targetZ *= breathing;

      const currentX =
        positionAttribute.getX(i);
      const currentY =
        positionAttribute.getY(i);
      const currentZ =
        positionAttribute.getZ(i);

      positionAttribute.setXYZ(
        i,
        THREE.MathUtils.lerp(
          currentX,
          targetX,
          Math.min(1, delta * morphSpeed),
        ),
        THREE.MathUtils.lerp(
          currentY,
          targetY,
          Math.min(1, delta * morphSpeed),
        ),
        THREE.MathUtils.lerp(
          currentZ,
          targetZ,
          Math.min(1, delta * morphSpeed),
        ),
      );
    }

    positionAttribute.needsUpdate = true;

    pointsRef.current.rotation.y +=
      delta * config.speed;

    pointsRef.current.rotation.x +=
      delta * 0.035;

    pointsRef.current.rotation.y +=
      pointer.x * delta * 0.025;

    pointsRef.current.rotation.x +=
      -pointer.y * delta * 0.015;

    materialRef.current.size =
      0.018 +
      Math.sin(
        time * (2.4 + config.speed),
      ) *
        0.0025;

    materialRef.current.opacity =
      0.68 +
      Math.sin(
        time * (2.1 + config.speed),
      ) *
        0.08;

    materialRef.current.color.lerp(
      config.color,
      Math.min(1, delta * 4),
    );
  });

  return (
    <points
      ref={pointsRef}
      geometry={geometry}
      frustumCulled={false}
    >
      <pointsMaterial
        ref={materialRef}
        color={config.color}
        size={0.018}
        transparent
        opacity={0.72}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
  );
}

function ParticleGlow({ state }: ParticleCoreProps) {
  const config = STATE_CONFIG[state];
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!glowRef.current) {
      return;
    }

    const time = clock.getElapsedTime();

    const pulse =
      1 +
      Math.sin(
        time * (1.5 + config.speed),
      ) *
        config.pulse;

    glowRef.current.scale.setScalar(
      pulse,
    );
  });

  return (
    <mesh
      ref={glowRef}
      scale={1.45}
    >
      <sphereGeometry
        args={[0.72, 32, 32]}
      />

      <meshBasicMaterial
        color={config.color}
        transparent
        opacity={0.055}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

function CoreEnvironment({
  state,
}: ParticleCoreProps) {
  const config = STATE_CONFIG[state];

  return (
    <>
      <ambientLight intensity={0.15} />

      <pointLight
        position={[0, 0, 1]}
        intensity={1.8}
        distance={4}
        color={config.color}
      />

      <pointLight
        position={[-1.2, 0.8, -1]}
        intensity={1.1}
        distance={3}
        color={config.accent}
      />

      <ParticleGlow state={state} />
      <ParticleCore state={state} />
    </>
  );
}

export default function ProzynCore({
  state = "idle",
}: ProzynCoreProps) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minWidth: 420,
        minHeight: 420,
        position: "relative",
      }}
    >
      <Canvas
        camera={{
          position: [0, 0, 4.4],
          fov: 38,
        }}
        dpr={[1, 2]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        }}
      >
        <CoreEnvironment state={state} />
      </Canvas>
    </div>
  );
}