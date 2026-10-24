import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMemo, useRef } from "react";

export type Persona = "sara" | "alex";
export type CoreState =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking";

interface ProzynCoreProps {
  persona?: Persona;
  state?: CoreState;
}

const PARTICLE_COUNT = 6200;
const AMBIENT_PARTICLE_COUNT = 1200;

type TargetSet = {
  core: Float32Array;
  sara: Float32Array;
  alex: Float32Array;
  phases: Float32Array;
  sizes: Float32Array;
};

function random(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function range(seed: number, min: number, max: number) {
  return min + random(seed) * (max - min);
}

function pushPoint(
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

function createTargets(count: number): TargetSet {
  const core = new Float32Array(count * 3);
  const sara = new Float32Array(count * 3);
  const alex = new Float32Array(count * 3);

  const phases = new Float32Array(count);
  const sizes = new Float32Array(count);

  for (let i = 0; i < count; i += 1) {
    const seed = i + 31;

    phases[i] = random(seed * 2.13) * Math.PI * 2;
    sizes[i] = range(seed * 3.77, 0.55, 1.3);

    /*
     * ---------------------------------------------------------
     * CORE
     * ---------------------------------------------------------
     *
     * Dense living energy field.
     */
    const coreAngle =
      random(seed * 1.7) * Math.PI * 2;

    const coreRadius =
      0.25 +
      Math.pow(random(seed * 2.1), 0.48) * 1.05;

    const coreY =
      (random(seed * 2.8) - 0.5) * 1.7;

    const coreX =
      Math.cos(coreAngle) *
      coreRadius *
      (0.8 + random(seed * 3.1) * 0.25);

    const coreZ =
      Math.sin(coreAngle) *
      coreRadius *
      0.68;

    pushPoint(
      core,
      i,
      coreX,
      coreY,
      coreZ,
    );

    /*
     * ---------------------------------------------------------
     * SARA
     * ---------------------------------------------------------
     *
     * Upper-body feminine silhouette:
     * head + long hair + neck + softer shoulders + chest.
     */
    const saraZone = random(seed * 4.2);

    if (saraZone < 0.27) {
      // Head
      const angle =
        random(seed * 5.1) *
        Math.PI *
        2;

      const radius =
        Math.sqrt(
          random(seed * 5.8),
        );

      const x =
        Math.cos(angle) *
        radius *
        0.52;

      const y =
        1.18 +
        Math.sin(angle) *
        radius *
        0.66;

      const z =
        (random(seed * 6.2) - 0.5) *
        0.32;

      pushPoint(
        sara,
        i,
        x,
        y,
        z,
      );
    } else if (saraZone < 0.48) {
      // Long hair
      const side =
        random(seed * 7.2) > 0.5
          ? 1
          : -1;

      const strand =
        random(seed * 8.1);

      const y =
        1.45 -
        strand * 2.05;

      const hairWidth =
        0.57 +
        Math.sin(
          strand * Math.PI,
        ) *
          0.27;

      const x =
        side *
        (
          hairWidth +
          Math.sin(
            strand * 9 +
              seed,
          ) *
            0.12
        );

      const z =
        -0.02 +
        Math.sin(
          strand * 7 +
            seed,
        ) *
          0.16;

      pushPoint(
        sara,
        i,
        x,
        y,
        z,
      );
    } else if (saraZone < 0.72) {
      // Neck + shoulders + upper chest
      const angle =
        random(seed * 9.4) *
        Math.PI;

      const radius =
        Math.sqrt(
          random(seed * 10.1),
        );

      const x =
        Math.cos(angle) *
        radius *
        1.58;

      const y =
        -0.04 +
        Math.sin(angle) *
        radius *
        0.72;

      const z =
        (random(seed * 10.8) - 0.5) *
        0.42;

      pushPoint(
        sara,
        i,
        x,
        y,
        z,
      );
    } else {
      // Central chest / neck transition
      const side =
        random(seed * 11.4) > 0.5
          ? 1
          : -1;

      const t =
        random(seed * 12.1);

      const x =
        side *
        (
          0.035 +
          t * 0.48 +
          Math.sin(
            t * 10 +
              seed,
          ) *
            0.035
        );

      const y =
        0.45 -
        t * 1.02;

      const z =
        0.18 +
        Math.sin(
          t * 8 +
            seed,
        ) *
          0.08;

      pushPoint(
        sara,
        i,
        x,
        y,
        z,
      );
    }

    /*
     * ---------------------------------------------------------
     * ALEX
     * ---------------------------------------------------------
     *
     * Upper-body masculine silhouette:
     * short hair + wider head + stronger shoulders +
     * straight chest structure.
     */
    const alexZone = random(seed * 13.7);

    if (alexZone < 0.28) {
      // Head
      const angle =
        random(seed * 14.2) *
        Math.PI *
        2;

      const radius =
        Math.sqrt(
          random(seed * 14.9),
        );

      const x =
        Math.cos(angle) *
        radius *
        0.55;

      const y =
        1.20 +
        Math.sin(angle) *
        radius *
        0.67;

      const z =
        (random(seed * 15.3) - 0.5) *
        0.32;

      pushPoint(
        alex,
        i,
        x,
        y,
        z,
      );
    } else if (alexZone < 0.45) {
      // Short styled hair
      const angle =
        random(seed * 16.1) *
        Math.PI;

      const radius =
        0.42 +
        random(seed * 16.8) *
          0.30;

      const x =
        Math.cos(angle) *
        radius;

      const y =
        1.50 +
        Math.sin(angle) *
        0.30;

      const z =
        (random(seed * 17.4) - 0.5) *
        0.30;

      pushPoint(
        alex,
        i,
        x,
        y,
        z,
      );
    } else if (alexZone < 0.74) {
      // Broad shoulders / chest
      const angle =
        random(seed * 18.2) *
        Math.PI;

      const radius =
        Math.sqrt(
          random(seed * 18.9),
        );

      const x =
        Math.cos(angle) *
        radius *
        1.82;

      const y =
        -0.08 +
        Math.sin(angle) *
        radius *
        0.70;

      const z =
        (random(seed * 19.5) - 0.5) *
        0.44;

      pushPoint(
        alex,
        i,
        x,
        y,
        z,
      );
    } else {
      // Strong central torso / neck
      const side =
        random(seed * 20.4) > 0.5
          ? 1
          : -1;

      const t =
        random(seed * 21.1);

      const x =
        side *
        (
          0.03 +
          t * 0.38 +
          Math.sin(
            t * 8 +
              seed,
          ) *
            0.025
        );

      const y =
        0.48 -
        t * 1.12;

      const z =
        0.18 +
        Math.sin(
          t * 7 +
            seed,
        ) *
          0.07;

      pushPoint(
        alex,
        i,
        x,
        y,
        z,
      );
    }
  }

  return {
    core,
    sara,
    alex,
    phases,
    sizes,
  };
}

function ParticleEntity({
  persona,
  state,
}: {
  persona: Persona;
  state: CoreState;
}) {
  const pointsRef =
    useRef<THREE.Points>(null);

  const positionAttributeRef =
    useRef<THREE.BufferAttribute | null>(
      null,
    );

  const materialRef =
    useRef<THREE.PointsMaterial>(null);

  const data = useMemo(
    () =>
      createTargets(
        PARTICLE_COUNT,
      ),
    [],
  );

  const positions = useMemo(
    () =>
      data.core.slice(),
    [data],
  );

  const colors = useMemo(() => {
    const values =
      new Float32Array(
        PARTICLE_COUNT * 3,
      );

    for (
      let i = 0;
      i < PARTICLE_COUNT;
      i += 1
    ) {
      const seed = i + 100;

      const glow =
        0.68 +
        random(seed * 4.7) *
          0.32;

      const color =
        persona === "sara"
          ? random(seed * 8.1) > 0.82
            ? new THREE.Color(
                0xd58cff,
              )
            : new THREE.Color(
                0x63dcff,
              )
          : random(seed * 9.2) > 0.86
            ? new THREE.Color(
                0x7caeff,
              )
            : new THREE.Color(
                0x43d9ff,
              );

      values[i * 3] =
        color.r * glow;

      values[i * 3 + 1] =
        color.g * glow;

      values[i * 3 + 2] =
        color.b * glow;
    }

    return values;
  }, [persona]);

  useFrame(({ clock }) => {
    const points =
      pointsRef.current;

    const attribute =
      positionAttributeRef.current;

    if (!points || !attribute) {
      return;
    }

    const array =
      attribute.array as Float32Array;

    const elapsed =
      clock.getElapsedTime();

    /*
     * The current persona is always the identity
     * the particle system is preparing to become.
     */
    const humanoidTarget =
      data[persona];

    /*
     * Idle:
     * living digital core.
     *
     * Active states:
     * humanoid upper body.
     */
    const target =
      state === "idle"
        ? data.core
        : humanoidTarget;

    const breathing =
      Math.sin(
        elapsed * 1.18,
      ) *
        0.5 +
      0.5;

    const slowBreathing =
      Math.sin(
        elapsed * 0.55,
      ) *
        0.5 +
      0.5;

    const energy =
      state === "listening"
        ? 0.38
        : state === "thinking"
          ? 0.56
          : state === "speaking"
            ? 0.48
            : 0.16;

    /*
     * Slower morph = more organic.
     */
    const morphSpeed =
      state === "idle"
        ? 0.045
        : 0.075;

    for (
      let i = 0;
      i < PARTICLE_COUNT;
      i += 1
    ) {
      const offset = i * 3;

      let x =
        target[offset];

      let y =
        target[offset + 1];

      let z =
        target[offset + 2];

      const phase =
        data.phases[i];

      const size =
        data.sizes[i];

      /*
       * Natural particle movement.
       */
      x +=
        Math.sin(
          elapsed * 0.40 +
            phase,
        ) *
        0.018 *
        size;

      y +=
        Math.sin(
          elapsed * 0.28 +
            phase * 1.4,
        ) *
        0.014 *
        size;

      z +=
        Math.cos(
          elapsed * 0.34 +
            phase,
        ) *
        0.020 *
        size;

      /*
       * Living core breathing.
       */
      if (state === "idle") {
        const coreBreath =
          1 +
          breathing *
            0.045;

        x *= coreBreath;
        z *= coreBreath;

        y +=
          Math.sin(
            elapsed * 0.9 +
              phase,
          ) *
          0.018;

        /*
         * Slow energy circulation.
         */
        const rotation =
          elapsed * 0.08;

        const rotatedX =
          x *
            Math.cos(
              rotation,
            ) -
          z *
            Math.sin(
              rotation,
            );

        const rotatedZ =
          x *
            Math.sin(
              rotation,
            ) +
          z *
            Math.cos(
              rotation,
            );

        x =
          rotatedX;
        z =
          rotatedZ;
      }

      /*
       * Humanoid breathing.
       */
      if (state !== "idle") {
        const chestWeight =
          Math.max(
            0,
            1 -
              Math.abs(
                y + 0.10,
              ) /
                1.25,
          );

        const breathAmount =
          chestWeight *
          (0.018 +
            breathing *
              0.035);

        x *=
          1 +
          breathAmount;

        y +=
          breathAmount *
          0.35;

        /*
         * Small shoulder movement.
         */
        const shoulderWeight =
          Math.max(
            0,
            1 -
              Math.abs(
                y + 0.02,
              ) /
                0.55,
          );

        x +=
          Math.sin(
            elapsed * 1.1 +
              phase,
          ) *
          shoulderWeight *
          0.018;
      }

      /*
       * LISTENING
       *
       * Input-reactive ripple.
       */
      if (
        state ===
        "listening"
      ) {
        const distance =
          Math.sqrt(
            x * x +
              (y - 0.2) *
                (y - 0.2),
          );

        const ripple =
          Math.sin(
            distance * 9.0 -
              elapsed * 4.5 +
              phase,
          ) *
          0.028 *
          energy;

        x +=
          ripple *
          (x >= 0
            ? 1
            : -1);

        z +=
          ripple * 0.9;
      }

      /*
       * THINKING
       *
       * Neural movement.
       */
      if (
        state ===
        "thinking"
      ) {
        const neural =
          Math.sin(
            elapsed * 2.4 +
              phase * 2.7 +
              y * 2.2,
          );

        x +=
          neural *
          0.035 *
          energy;

        z +=
          Math.cos(
            elapsed * 2.0 +
              phase,
          ) *
          0.055 *
          energy;

        y +=
          Math.sin(
            elapsed * 1.6 +
              phase * 1.8,
          ) *
          0.018 *
          energy;
      }

      /*
       * SPEAKING
       *
       * Head + chest + neck energy pulse.
       */
      if (
        state ===
        "speaking"
      ) {
        const speechWave =
          Math.sin(
            elapsed * 6.0 +
              phase * 3.0,
          );

        const headWeight =
          Math.max(
            0,
            1 -
              Math.abs(
                y - 0.85,
              ) /
                0.95,
          );

        const chestWeight =
          Math.max(
            0,
            1 -
              Math.abs(
                y + 0.10,
              ) /
                1.0,
          );

        const speechAmount =
          speechWave *
          0.026 *
          (
            0.3 +
            headWeight *
              0.45 +
            chestWeight *
              0.25
          );

        x +=
          speechAmount *
          (x >= 0
            ? 1
            : -1);

        z +=
          speechAmount *
          1.5;
      }

      /*
       * Smoothly move the SAME particles.
       */
      array[offset] +=
        (x -
          array[offset]) *
        morphSpeed;

      array[offset + 1] +=
        (y -
          array[offset + 1]) *
        morphSpeed;

      array[offset + 2] +=
        (z -
          array[offset + 2]) *
        morphSpeed;
    }

    attribute.needsUpdate =
      true;

    /*
     * Whole entity breathing.
     */
    points.position.y =
      Math.sin(
        elapsed * 1.15,
      ) *
      0.012;

    /*
     * Very subtle living rotation.
     */
    points.rotation.y =
      Math.sin(
        elapsed * 0.15,
      ) *
      0.022;

    points.rotation.z =
      Math.sin(
        elapsed * 0.10,
      ) *
      0.005;

    if (
      materialRef.current
    ) {
      materialRef.current.opacity =
        0.72 +
        breathing *
          0.14 +
        slowBreathing *
          0.05;

      materialRef.current.size =
        0.023 +
        breathing *
          0.004 +
        energy *
          0.004;
    }
  });

  return (
    <points
      ref={pointsRef}
      frustumCulled={false}
    >
      <bufferGeometry>
        <bufferAttribute
          ref={(attribute) => {
            positionAttributeRef.current =
              attribute;
          }}
          attach="attributes-position"
          args={[
            positions,
            3,
          ]}
          usage={
            THREE.DynamicDrawUsage
          }
        />

        <bufferAttribute
          attach="attributes-color"
          args={[
            colors,
            3,
          ]}
        />
      </bufferGeometry>

      <pointsMaterial
        ref={materialRef}
        vertexColors
        size={0.023}
        sizeAttenuation
        transparent
        opacity={0.82}
        depthWrite={false}
        blending={
          THREE.AdditiveBlending
        }
      />
    </points>
  );
}

function AmbientField() {
  const pointsRef =
    useRef<THREE.Points>(null);

  const positions =
    useMemo(() => {
      const values =
        new Float32Array(
          AMBIENT_PARTICLE_COUNT *
            3,
        );

      for (
        let i = 0;
        i <
        AMBIENT_PARTICLE_COUNT;
        i += 1
      ) {
        const seed =
          i + 800;

        values[i * 3] =
          range(
            seed,
            -6.5,
            6.5,
          );

        values[i * 3 + 1] =
          range(
            seed * 2,
            -4.2,
            4.2,
          );

        values[i * 3 + 2] =
          range(
            seed * 3,
            -2.5,
            1.5,
          );
      }

      return values;
    }, []);

  useFrame(({ clock }) => {
    if (!pointsRef.current) {
      return;
    }

    const elapsed =
      clock.getElapsedTime();

    pointsRef.current.rotation.y =
      elapsed * 0.010;

    pointsRef.current.rotation.z =
      Math.sin(
        elapsed * 0.07,
      ) *
      0.018;
  });

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
        />
      </bufferGeometry>

      <pointsMaterial
        color={0x3f8cff}
        size={0.011}
        transparent
        opacity={0.20}
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
}: ProzynCoreProps) {
  return (
    <>
      <ParticleEntity
        persona={
          persona ?? "sara"
        }
        state={
          state ?? "idle"
        }
      />

      <AmbientField />
    </>
  );
}

export default function ProzynCore({
  persona = "sara",
  state = "idle",
}: ProzynCoreProps) {
  return (
    <div
      className="prozyn-core"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        overflow: "hidden",
      }}
    >
      <Canvas
        camera={{
          position: [
            0,
            0.12,
            6.6,
          ],
          fov: 40,
          near: 0.1,
          far: 100,
        }}
        dpr={[
          1,
          1.75,
        ]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference:
            "high-performance",
        }}
      >
        <color
          attach="background"
          args={[
            "#02050c",
          ]}
        />

        <Scene
          persona={persona}
          state={state}
        />
      </Canvas>
    </div>
  );
}
