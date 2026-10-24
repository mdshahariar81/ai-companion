import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Sparkles } from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";

type CoreState = "idle" | "listening" | "thinking" | "speaking";

interface ProzynCoreProps {
  state?: CoreState;
}

function EnergyCore({ state }: { state: CoreState }) {
  const coreRef = useRef<THREE.Mesh>(null);
  const innerRef = useRef<THREE.Mesh>(null);
  const ringOneRef = useRef<THREE.Mesh>(null);
  const ringTwoRef = useRef<THREE.Mesh>(null);
  const ringThreeRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    const speed =
      state === "thinking"
        ? 1.8
        : state === "listening"
          ? 1.35
          : state === "speaking"
            ? 2.2
            : 0.55;

    if (coreRef.current) {
      coreRef.current.rotation.x += delta * 0.18 * speed;
      coreRef.current.rotation.y += delta * 0.32 * speed;
    }

    if (innerRef.current) {
      innerRef.current.rotation.x -= delta * 0.28 * speed;
      innerRef.current.rotation.y -= delta * 0.18 * speed;
    }

    if (ringOneRef.current) {
      ringOneRef.current.rotation.x += delta * 0.18 * speed;
      ringOneRef.current.rotation.z += delta * 0.08 * speed;
    }

    if (ringTwoRef.current) {
      ringTwoRef.current.rotation.y -= delta * 0.22 * speed;
      ringTwoRef.current.rotation.z += delta * 0.12 * speed;
    }

    if (ringThreeRef.current) {
      ringThreeRef.current.rotation.x -= delta * 0.12 * speed;
      ringThreeRef.current.rotation.y += delta * 0.16 * speed;
    }

    const time = performance.now() * 0.001;

    const pulse =
      state === "speaking"
        ? 1 + Math.sin(time * 7) * 0.08
        : state === "listening"
          ? 1 + Math.sin(time * 4) * 0.045
          : state === "thinking"
            ? 1 + Math.sin(time * 5) * 0.055
            : 1 + Math.sin(time * 1.8) * 0.025;

    coreRef.current?.scale.setScalar(pulse);

    if (innerRef.current) {
      innerRef.current.scale.setScalar(
        0.92 + Math.sin(time * 2.2) * 0.04,
      );
    }
  });

  const energyColor =
    state === "thinking"
      ? "#9f7cff"
      : state === "speaking"
        ? "#5ff0c4"
        : "#58ddff";

  return (
    <>
      <pointLight
        position={[0, 0, 1.8]}
        intensity={3}
        distance={5}
        color={energyColor}
      />

      <mesh ref={coreRef}>
        <icosahedronGeometry args={[0.82, 5]} />
        <meshStandardMaterial
          color="#07151d"
          emissive={energyColor}
          emissiveIntensity={0.65}
          metalness={0.9}
          roughness={0.18}
          transparent
          opacity={0.96}
        />
      </mesh>

      <mesh ref={innerRef} scale={0.7}>
        <sphereGeometry args={[0.82, 64, 64]} />
        <meshBasicMaterial
          color={energyColor}
          transparent
          opacity={0.09}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <mesh scale={0.28}>
        <sphereGeometry args={[0.8, 32, 32]} />
        <meshBasicMaterial
          color="#e8fbff"
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <mesh
        ref={ringOneRef}
        rotation={[Math.PI / 2.4, 0.25, 0]}
      >
        <torusGeometry args={[1.22, 0.012, 16, 180]} />
        <meshBasicMaterial
          color="#54ddff"
          transparent
          opacity={0.7}
        />
      </mesh>

      <mesh
        ref={ringTwoRef}
        rotation={[0.45, Math.PI / 2.5, 0.8]}
      >
        <torusGeometry args={[1.48, 0.009, 16, 180]} />
        <meshBasicMaterial
          color="#9275ff"
          transparent
          opacity={0.5}
        />
      </mesh>

      <mesh
        ref={ringThreeRef}
        rotation={[1.1, 0.35, 0.25]}
      >
        <torusGeometry args={[1.75, 0.006, 16, 180]} />
        <meshBasicMaterial
          color="#4ee7c0"
          transparent
          opacity={0.32}
        />
      </mesh>

      <Sparkles
        count={140}
        scale={[4.4, 4.4, 4.4]}
        size={1.8}
        speed={
          state === "thinking"
            ? 1.8
            : state === "speaking"
              ? 2.4
              : 0.7
        }
        opacity={0.75}
        color={energyColor}
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
        minWidth: 280,
        minHeight: 280,
        position: "relative",
      }}
    >
      <Canvas
        camera={{
          position: [0, 0, 5.2],
          fov: 42,
        }}
        dpr={[1, 2]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        }}
      >
        <ambientLight intensity={0.35} />

        <Float
          speed={1.2}
          rotationIntensity={0.08}
          floatIntensity={0.12}
        >
          <EnergyCore state={state} />
        </Float>
      </Canvas>
    </div>
  );
}
