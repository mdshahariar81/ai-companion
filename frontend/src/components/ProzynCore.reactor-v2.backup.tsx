import { Canvas, useFrame } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";

type CoreState = "idle" | "listening" | "thinking" | "speaking";

interface ProzynCoreProps {
  state?: CoreState;
}

interface ReactorProps {
  state: CoreState;
}

const STATE_CONFIG: Record<
  CoreState,
  {
    color: string;
    accent: string;
    speed: number;
    pulse: number;
  }
> = {
  idle: {
    color: "#52dcff",
    accent: "#8d7bff",
    speed: 0.45,
    pulse: 0.025,
  },
  listening: {
    color: "#5ce9ff",
    accent: "#37d8ff",
    speed: 1.1,
    pulse: 0.055,
  },
  thinking: {
    color: "#9d82ff",
    accent: "#54dfff",
    speed: 1.7,
    pulse: 0.075,
  },
  speaking: {
    color: "#62f3ce",
    accent: "#55cfff",
    speed: 2.15,
    pulse: 0.095,
  },
};

function EnergyParticles({ state }: ReactorProps) {
  const config = STATE_CONFIG[state];

  return (
    <>
      <Sparkles
        count={180}
        scale={[4.8, 4.8, 4.8]}
        size={1.7}
        speed={config.speed * 0.65}
        opacity={0.72}
        color={config.color}
      />

      <Sparkles
        count={70}
        scale={[3.1, 3.1, 3.1]}
        size={2.6}
        speed={config.speed}
        opacity={0.52}
        color={config.accent}
      />
    </>
  );
}

function ReactorParticles({ state }: ReactorProps) {
  const config = STATE_CONFIG[state];

  const pointsRef = useRef<THREE.Points>(null);

  const particles = useMemo(() => {
    const positions = new Float32Array(90 * 3);

    for (let i = 0; i < 90; i += 1) {
      const radius = 1.15 + Math.random() * 0.9;
      const angle = Math.random() * Math.PI * 2;
      const height = (Math.random() - 0.5) * 1.8;

      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = height;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
    }

    return positions;
  }, []);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;

    pointsRef.current.rotation.y += delta * 0.16 * config.speed;
    pointsRef.current.rotation.x += delta * 0.04 * config.speed;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[particles, 3]}
        />
      </bufferGeometry>

      <pointsMaterial
        color={config.color}
        size={0.025}
        transparent
        opacity={0.75}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
  );
}

function EnergyRings({ state }: ReactorProps) {
  const config = STATE_CONFIG[state];

  const ringOne = useRef<THREE.Mesh>(null);
  const ringTwo = useRef<THREE.Mesh>(null);
  const ringThree = useRef<THREE.Mesh>(null);
  const ringFour = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    const speed = config.speed;

    if (ringOne.current) {
      ringOne.current.rotation.x += delta * 0.32 * speed;
      ringOne.current.rotation.z += delta * 0.12 * speed;
    }

    if (ringTwo.current) {
      ringTwo.current.rotation.y -= delta * 0.24 * speed;
      ringTwo.current.rotation.z += delta * 0.18 * speed;
    }

    if (ringThree.current) {
      ringThree.current.rotation.x -= delta * 0.2 * speed;
      ringThree.current.rotation.y += delta * 0.28 * speed;
    }

    if (ringFour.current) {
      ringFour.current.rotation.y += delta * 0.14 * speed;
      ringFour.current.rotation.x += delta * 0.08 * speed;
    }
  });

  return (
    <>
      <mesh ref={ringOne} rotation={[Math.PI / 2.25, 0.18, 0]}>
        <torusGeometry args={[1.08, 0.018, 12, 160]} />
        <meshBasicMaterial
          color={config.color}
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <mesh ref={ringTwo} rotation={[0.4, Math.PI / 2.8, 0.6]}>
        <torusGeometry args={[1.35, 0.012, 12, 160]} />
        <meshBasicMaterial
          color={config.accent}
          transparent
          opacity={0.72}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <mesh ref={ringThree} rotation={[1.05, 0.35, 0.25]}>
        <torusGeometry args={[1.62, 0.008, 10, 160]} />
        <meshBasicMaterial
          color={config.color}
          transparent
          opacity={0.42}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <mesh ref={ringFour} rotation={[0.25, 1.15, 0.85]}>
        <torusGeometry args={[1.88, 0.005, 8, 160]} />
        <meshBasicMaterial
          color={config.accent}
          transparent
          opacity={0.24}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </>
  );
}

function EnergyArcs({ state }: ReactorProps) {
  const config = STATE_CONFIG[state];

  const arcOne = useRef<THREE.Mesh>(null);
  const arcTwo = useRef<THREE.Mesh>(null);
  const arcThree = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (arcOne.current) {
      arcOne.current.rotation.y += delta * 0.75 * config.speed;
      arcOne.current.rotation.z += delta * 0.18;
    }

    if (arcTwo.current) {
      arcTwo.current.rotation.x -= delta * 0.62 * config.speed;
      arcTwo.current.rotation.y += delta * 0.12;
    }

    if (arcThree.current) {
      arcThree.current.rotation.z += delta * 0.9 * config.speed;
      arcThree.current.rotation.x -= delta * 0.16;
    }
  });

  return (
    <>
      <mesh ref={arcOne} rotation={[0.7, 0.2, 0.5]}>
        <torusGeometry args={[1.46, 0.028, 10, 80, Math.PI * 0.62]} />
        <meshBasicMaterial
          color={config.color}
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <mesh ref={arcTwo} rotation={[1.1, 0.7, 0.25]}>
        <torusGeometry args={[1.7, 0.022, 10, 80, Math.PI * 0.46]} />
        <meshBasicMaterial
          color={config.accent}
          transparent
          opacity={0.8}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <mesh ref={arcThree} rotation={[0.2, 1.1, 1.2]}>
        <torusGeometry args={[1.22, 0.018, 10, 80, Math.PI * 0.35]} />
        <meshBasicMaterial
          color="#d8fbff"
          transparent
          opacity={0.82}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </>
  );
}

function ReactorShell({ state }: ReactorProps) {
  const config = STATE_CONFIG[state];

  const shellRef = useRef<THREE.Mesh>(null);
  const cageRef = useRef<THREE.Mesh>(null);
  const nucleusRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    const time = performance.now() * 0.001;

    const pulse =
      1 + Math.sin(time * (2.1 + config.speed)) * config.pulse;

    if (shellRef.current) {
      shellRef.current.rotation.x += delta * 0.16 * config.speed;
      shellRef.current.rotation.y -= delta * 0.22 * config.speed;
      shellRef.current.scale.setScalar(pulse);
    }

    if (cageRef.current) {
      cageRef.current.rotation.x -= delta * 0.38 * config.speed;
      cageRef.current.rotation.y += delta * 0.5 * config.speed;
      cageRef.current.rotation.z += delta * 0.08;
    }

    if (nucleusRef.current) {
      nucleusRef.current.scale.setScalar(
        0.92 + Math.sin(time * (3.2 + config.speed)) * 0.07,
      );
    }

    if (glowRef.current) {
      glowRef.current.scale.setScalar(
        1 + Math.sin(time * (2.2 + config.speed)) * 0.045,
      );
    }
  });

  return (
    <>
      <mesh ref={glowRef} scale={1.25}>
        <sphereGeometry args={[0.82, 48, 48]} />
        <meshBasicMaterial
          color={config.color}
          transparent
          opacity={0.075}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <mesh ref={shellRef}>
        <icosahedronGeometry args={[0.88, 2]} />
        <meshPhysicalMaterial
          color="#06131b"
          emissive={config.color}
          emissiveIntensity={0.45}
          metalness={0.92}
          roughness={0.2}
          transmission={0.05}
          transparent
          opacity={0.94}
        />
      </mesh>

      <mesh ref={cageRef} scale={0.93}>
        <icosahedronGeometry args={[1.02, 1]} />
        <meshBasicMaterial
          color={config.color}
          wireframe
          transparent
          opacity={0.62}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <mesh rotation={[0.7, 0.4, 0.2]} scale={0.62}>
        <octahedronGeometry args={[1, 2]} />
        <meshBasicMaterial
          color={config.accent}
          wireframe
          transparent
          opacity={0.65}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <mesh ref={nucleusRef} scale={0.34}>
        <sphereGeometry args={[0.9, 48, 48]} />
        <meshBasicMaterial
          color="#ecfdff"
          transparent
          opacity={0.96}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <pointLight
        position={[0, 0, 0.8]}
        intensity={3.2}
        distance={4.5}
        color={config.color}
      />

      <pointLight
        position={[0.8, -0.4, -0.5]}
        intensity={1.6}
        distance={3}
        color={config.accent}
      />
    </>
  );
}

function Reactor({ state }: ReactorProps) {
  const config = STATE_CONFIG[state];

  return (
    <>
      <ambientLight intensity={0.22} />

      <ReactorShell state={state} />
      <EnergyRings state={state} />
      <EnergyArcs state={state} />
      <ReactorParticles state={state} />
      <EnergyParticles state={state} />

      <pointLight
        position={[0, 1.5, 2]}
        intensity={0.65}
        distance={6}
        color={config.color}
      />
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
        minWidth: 320,
        minHeight: 320,
        position: "relative",
      }}
    >
      <Canvas
        camera={{
          position: [0, 0, 5.4],
          fov: 40,
        }}
        dpr={[1, 2]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        }}
      >
        <Reactor state={state} />
      </Canvas>
    </div>
  );
}
