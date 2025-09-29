import { RoundedBox, PositionalAudio, useTexture } from "@react-three/drei";
import { useEffect, useRef, useState } from "react";
import { Group, PositionalAudio as ThreePositionalAudio } from "three";
import { useFrame } from "@react-three/fiber";
import { PadEvent, subscribePadEvents } from "@/levels/state/padEvents";
import * as THREE from "three";
import { Arrow, ArrowBlue } from "./Arrow";
import { useGreenPadsStore } from "../state/greenPadsStore";

export interface PadsProps {
  position?: [number, number, number];
  coord?: string;
}

export interface DynamicPadsProps {
  position?: [number, number, number];
  coord?: string;
  touchdown: number;
}

export interface GreenPadProps {
  position?: [number, number, number];
  coord?: string;
  touchdown: number; // 1, 2 or 3
}

export function BasicPad({ position = [0, 0, 0], coord }: PadsProps) {
  const tiltNodeRef = useRef<Group>(null);
  const springPivotRef = useRef<Group>(null);

  // Audio
  const audioRef = useRef<ThreePositionalAudio>(null);       // bounce
  const audioJumpRef = useRef<ThreePositionalAudio>(null);   // jump

  // Canali animazione
  const yVal = useRef(0);
  const yVel = useRef(0);
  const zVal = useRef(0);
  const zVel = useRef(0);
  const xVal = useRef(0);
  const xVel = useRef(0);

  const activeRef = useRef(false);

  const Y_K = 140, Y_D = 18;
  const Z_K = 120, Z_D = 16;
  const X_K = 130, X_D = 16;

  const IMPULSE_BOUNCE_Y = -0.06;
  const IMPULSE_TILT_Z = 4.2;
  const IMPULSE_TRAMP_X = -3.6;
  const IMPULSE_TRAMP_Y = -0.02;

  useEffect(() => {
    if (!coord) return;
    const unsubscribe = subscribePadEvents(coord, (e: PadEvent) => {
      if (e.type === "bounce") {
        yVel.current += IMPULSE_BOUNCE_Y * 10;
        activeRef.current = true;

        const a = audioRef.current;
        if (a) {
          try {
            a.setPlaybackRate(0.95 + Math.random() * 0.1);
            if (a.isPlaying) a.stop();
            if (a.context.state === "suspended") a.context.resume();
            a.play();
          } catch { }
        }
      } else if (e.type === "tilt") {
        const dir = Math.sign(e.payload?.dir ?? 0) || 1;
        zVel.current += dir * -IMPULSE_TILT_Z;
        activeRef.current = true;
      } else if (e.type === "trampoline") {
        xVel.current += IMPULSE_TRAMP_X * 5;
        yVel.current += IMPULSE_TRAMP_Y * 5;
        activeRef.current = true;

        const aj = audioJumpRef.current;
        if (aj) {
          try {
            aj.setPlaybackRate(0.98 + Math.random() * 0.08);
            if (aj.isPlaying) aj.stop();
            if (aj.context.state === "suspended") aj.context.resume();
            aj.play();
          } catch { }
        }
      }
    });
    return () => unsubscribe();
  }, [coord]);

  useFrame((_, dt) => {
    if (!activeRef.current) return;
    const clampedDt = Math.min(0.033, Math.max(0.001, dt));

    const ay = -Y_K * yVal.current - Y_D * yVel.current;
    yVel.current += ay * clampedDt;
    yVal.current += yVel.current * clampedDt;

    const az = -Z_K * zVal.current - Z_D * zVel.current;
    zVel.current += az * clampedDt;
    zVal.current += zVel.current * clampedDt;

    const ax = -X_K * xVal.current - X_D * xVel.current;
    xVel.current += ax * clampedDt;
    xVal.current += xVel.current * clampedDt;

    if (tiltNodeRef.current) {
      tiltNodeRef.current.position.y = yVal.current;
      tiltNodeRef.current.rotation.z = zVal.current;
    }
    if (springPivotRef.current) {
      springPivotRef.current.rotation.x = xVal.current;
    }

    const eps = 1e-3;
    if (
      Math.abs(yVal.current) < eps && Math.abs(yVel.current) < eps &&
      Math.abs(zVal.current) < eps && Math.abs(zVel.current) < eps &&
      Math.abs(xVal.current) < eps && Math.abs(xVel.current) < eps
    ) {
      yVal.current = yVel.current = 0;
      zVal.current = zVel.current = 0;
      xVal.current = xVel.current = 0;
      activeRef.current = false;
    }
  });

  const depth = 0.5;
  const halfDepth = depth / 2;

  return (
    <group position={position}>
      {/* Bounce  */}
      <PositionalAudio
        ref={audioRef}
        url="/sounds/basicBounce.wav"
        distance={3}
        loop={false}
        autoplay={false}

      />
      {/* Jump */}
      <PositionalAudio
        ref={audioJumpRef}
        url="/sounds/jump.wav"
        distance={3}
        loop={false}
        autoplay={false}

      />
      <group ref={tiltNodeRef}>
        <group ref={springPivotRef} position={[0, 0, -halfDepth]}>
          <group position={[0, 0, halfDepth]}>
            {/* <pointLight color="#ffffff" intensity={4.6} distance={3} position={[0, 0, 1]} /> */}
            <mesh receiveShadow>
              <RoundedBox args={[0.8, 0.15, 0.5]} radius={0.05} smoothness={4}>
                <meshStandardMaterial color="#853448" />
              </RoundedBox>
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}


export function DoubleTrapPad({ position = [0, 0, 0], coord }: PadsProps) {
  const geometry = new THREE.ConeGeometry(0.1, 0.3, 8);
  const material = new THREE.MeshStandardMaterial({ color: "#aa7a3b", metalness: 0.9, roughness: 0.1 });
  return (
    <group position={position}>
      <mesh receiveShadow>
        <RoundedBox args={[0.9, 0.15, 0.5]} radius={0.05} smoothness={4}>
          <meshStandardMaterial color="#853448" />
        </RoundedBox>
      </mesh>
      <mesh position={[-0.25, 0.15, 0]} rotation={[0, 0, 0]} geometry={geometry} material={material} />
      <mesh position={[-0., 0.15, 0]} rotation={[0, 0, 0]} geometry={geometry} material={material} />
      <mesh position={[0.25, 0.15, 0]} rotation={[0, 0, 0]} geometry={geometry} material={material} />

      <mesh position={[-0.25, -0.15, 0]} rotation={[Math.PI, 0, 0]} geometry={geometry} material={material} />
      <mesh position={[-0., -0.15, 0]} rotation={[Math.PI, 0, 0]} geometry={geometry} material={material} />
      <mesh position={[0.25, -0.15, 0]} rotation={[Math.PI, 0, 0]} geometry={geometry} material={material} />


    </group>
  );
}

export function RBouncer({ position = [0, 0, 0], coord }: PadsProps) {
  const geometry = new THREE.SphereGeometry(0.05, 8, 8);

  // Riferimenti ai materiali delle sfere per animare l'emissive
  const materialRefs = useRef<THREE.MeshStandardMaterial[]>([]);
  const audioRef = useRef<ThreePositionalAudio>(null);

  // Stato animazione emissive
  const boostTimer = useRef(0); // timer per il boost temporaneo

  const BASE_INTENSITY = 25.6;
  const BOOST_MULTIPLIER = 4.0; // 4x quando c'è il bounce
  const BOOST_DURATION = 0.33; // 1/3 di secondo

  // Crea 3 materiali separati per poterli animare
  const materials = useRef([
    new THREE.MeshStandardMaterial({
      color: "#aa7a3b",
      metalness: 0.1,
      roughness: 0.0,
      emissive: "#e9955c",
      emissiveIntensity: BASE_INTENSITY
    }),
    new THREE.MeshStandardMaterial({
      color: "#aa7a3b",
      metalness: 0.1,
      roughness: 0.0,
      emissive: "#e9955c",
      emissiveIntensity: BASE_INTENSITY
    }),
    new THREE.MeshStandardMaterial({
      color: "#aa7a3b",
      metalness: 0.1,
      roughness: 0.0,
      emissive: "#e9955c",
      emissiveIntensity: BASE_INTENSITY
    })
  ]);

  useEffect(() => {
    materialRefs.current = materials.current;
    return () => {
      // Cleanup materials
      materials.current.forEach(mat => mat.dispose());
    };
  }, []);

  useEffect(() => {
    if (!coord) return;
    const unsubscribe = subscribePadEvents(coord, (e: PadEvent) => {
      if (e.type === "bounce") {
        // Attiva il boost temporaneo
        boostTimer.current = BOOST_DURATION;

        // Play audio (usando l'audio esistente del wall bounce)
        const a = audioRef.current;
        if (a) {
          try {
            a.setPlaybackRate(0.95 + Math.random() * 0.1);
            if (a.isPlaying) a.stop();
            if (a.context.state === "suspended") a.context.resume();
            a.play();
          } catch { }
        }
      }
    });
    return () => unsubscribe();
  }, [coord]);

  useFrame((state, dt) => {
    // Decrementa il boost timer
    if (boostTimer.current > 0) {
      boostTimer.current = Math.max(0, boostTimer.current - dt);
    }

    // Calcola il moltiplicatore corrente (1x normale, 4x durante boost)
    const currentMultiplier = boostTimer.current > 0 ? BOOST_MULTIPLIER : 1.0;

    // Animazione continua pulsante con boost applicato
    const time = state.clock.getElapsedTime();

    materialRefs.current.forEach((mat, i) => {
      if (mat) {
        // Pulsazione continua con offset per ogni sfera
        const pulse = Math.sin(time * 3 + i * 2) * 0.3 + 0.7; // varia tra 0.4 e 1.0
        mat.emissiveIntensity = BASE_INTENSITY * pulse * currentMultiplier;
      }
    });
  });

  return (
    <group position={position}>
      {/* Audio del bounce */}
      <PositionalAudio
        ref={audioRef}
        url="/sounds/bouncer.wav"
        distance={3}
        loop={false}
        autoplay={false}
      />

      <group position={[0, 0., 0]} rotation={[0, 0, -0.4]} >
        <mesh>
          <RoundedBox args={[0.8, 0.25, 0.5]} radius={0.05} smoothness={4}>
            <meshStandardMaterial color="#853448" />
          </RoundedBox>
        </mesh>
        <mesh position={[-0.25, 0, 0.25]} geometry={geometry} material={materials.current[0]} />
        <mesh position={[-0., 0, 0.25]} geometry={geometry} material={materials.current[1]} />
        <mesh position={[0.25, 0, 0.25]} geometry={geometry} material={materials.current[2]} />
      </group>
    </group>
  );
}

export function LBouncer({ position = [0, 0, 0], coord }: PadsProps) {
  const geometry = new THREE.SphereGeometry(0.05, 8, 8);

  // Riferimenti ai materiali delle sfere per animare l'emissive
  const materialRefs = useRef<THREE.MeshStandardMaterial[]>([]);
  const audioRef = useRef<ThreePositionalAudio>(null);

  // Stato animazione emissive
  const boostTimer = useRef(0); // timer per il boost temporaneo

  const BASE_INTENSITY = 25.6;
  const BOOST_MULTIPLIER = 4.0; // 4x quando c'è il bounce
  const BOOST_DURATION = 0.33; // 1/3 di secondo

  // Crea 3 materiali separati per poterli animare
  const materials = useRef([
    new THREE.MeshStandardMaterial({
      color: "#aa7a3b",
      metalness: 0.1,
      roughness: 0.0,
      emissive: "#e9955c",
      emissiveIntensity: BASE_INTENSITY
    }),
    new THREE.MeshStandardMaterial({
      color: "#aa7a3b",
      metalness: 0.1,
      roughness: 0.0,
      emissive: "#e9955c",
      emissiveIntensity: BASE_INTENSITY
    }),
    new THREE.MeshStandardMaterial({
      color: "#aa7a3b",
      metalness: 0.1,
      roughness: 0.0,
      emissive: "#e9955c",
      emissiveIntensity: BASE_INTENSITY
    })
  ]);

  useEffect(() => {
    materialRefs.current = materials.current;
    return () => {
      // Cleanup materials
      materials.current.forEach(mat => mat.dispose());
    };
  }, []);

  useEffect(() => {
    if (!coord) return;
    const unsubscribe = subscribePadEvents(coord, (e: PadEvent) => {
      if (e.type === "bounce") {
        // Attiva il boost temporaneo
        boostTimer.current = BOOST_DURATION;

        // Play audio (usando l'audio esistente del wall bounce)
        const a = audioRef.current;
        if (a) {
          try {
            a.setPlaybackRate(0.95 + Math.random() * 0.1);
            if (a.isPlaying) a.stop();
            if (a.context.state === "suspended") a.context.resume();
            a.play();
          } catch { }
        }
      }
    });
    return () => unsubscribe();
  }, [coord]);

  useFrame((state, dt) => {
    // Decrementa il boost timer
    if (boostTimer.current > 0) {
      boostTimer.current = Math.max(0, boostTimer.current - dt);
    }

    // Calcola il moltiplicatore corrente (1x normale, 4x durante boost)
    const currentMultiplier = boostTimer.current > 0 ? BOOST_MULTIPLIER : 1.0;

    // Animazione continua pulsante con boost applicato
    const time = state.clock.getElapsedTime();

    materialRefs.current.forEach((mat, i) => {
      if (mat) {
        // Pulsazione continua con offset per ogni sfera
        const pulse = Math.sin(time * 3 + i * 2) * 0.3 + 0.7; // varia tra 0.4 e 1.0
        mat.emissiveIntensity = BASE_INTENSITY * pulse * currentMultiplier;
      }
    });
  });

  return (
    <group position={position}>
      {/* Audio del bounce */}
      <PositionalAudio
        ref={audioRef}
        url="/sounds/bouncer.wav"
        distance={3}
        loop={false}
        autoplay={false}
      />

      <group position={[0, 0, 0]} rotation={[0, 0, 0.4]} >
        <mesh>
          <RoundedBox args={[0.8, 0.25, 0.5]} radius={0.05} smoothness={4}>
            <meshStandardMaterial color="#853448" />
          </RoundedBox>
        </mesh>
        <mesh position={[-0.25, 0, 0.25]} geometry={geometry} material={materials.current[0]} />
        <mesh position={[-0., 0, 0.25]} geometry={geometry} material={materials.current[1]} />
        <mesh position={[0.25, 0, 0.25]} geometry={geometry} material={materials.current[2]} />
      </group>
    </group>
  );
}

export function IcePad({ position = [0, 0, 0], coord }: PadsProps) {
  return (
    <group position={position}>
      <mesh receiveShadow>
        <RoundedBox args={[0.8, 0.15, 0.5]} radius={0.05} smoothness={4}>
          <meshStandardMaterial color="#346e85" metalness={0.} roughness={0.3} />
        </RoundedBox>
      </mesh>
    </group>
  );
}

export function GreenPad({ position = [0, 0, 0], coord = "", touchdown = 1 }: GreenPadProps) {
  const groupRef = useRef<Group>(null);
  const audioRef = useRef<ThreePositionalAudio>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const meshRef = useRef<THREE.Mesh>(null);

  // Animation state
  const [isAnimating, setIsAnimating] = useState(false);
  const animationProgress = useRef(0);
  const animationType = useRef<"shrink" | "fade" | "none">("none");

  // Track initialization
  const [isInitialized, setIsInitialized] = useState(false);

  // Local state for rendering
  const [localRemainingTouches, setLocalRemainingTouches] = useState(touchdown);
  const [localConsumed, setLocalConsumed] = useState(false);

  // Initialize the pad in the store on mount and ensure proper initialization
  useEffect(() => {
    if (coord) {
      const store = useGreenPadsStore.getState();

      // Initialize the pad (this will overwrite any existing state)
      store.initPad(coord, touchdown);

      // Get the initial state from store after initialization
      const remaining = store.getRemainingTouches(coord);
      const consumed = store.isPadConsumed(coord);

      // Set local state
      setLocalRemainingTouches(remaining > 0 ? remaining : touchdown);
      setLocalConsumed(consumed);
      setIsInitialized(true);

      console.log(`GreenPad ${coord}: Initialized with ${touchdown} touches, current state: ${remaining} remaining, consumed: ${consumed}`);
    }

    return () => {
      // No cleanup - we want to persist the state
    };
  }, [coord, touchdown]);

  // Subscribe to store changes after initialization
  useEffect(() => {
    if (!isInitialized || !coord) return;

    const unsubscribe = useGreenPadsStore.subscribe((state) => {
      const remaining = state.getRemainingTouches(coord);
      const consumed = state.isPadConsumed(coord);

      // Only update if there's a real change
      if (remaining !== localRemainingTouches) {
        setLocalRemainingTouches(remaining);
      }
      if (consumed !== localConsumed) {
        setLocalConsumed(consumed);
      }
    });

    return unsubscribe;
  }, [isInitialized, coord, localRemainingTouches, localConsumed]);

  // Subscribe to bounce events
  useEffect(() => {
    if (!coord || !isInitialized) return;

    const unsubscribe = subscribePadEvents(coord, (e: PadEvent) => {
      if (e.type === "bounce") {
        const store = useGreenPadsStore.getState();

        // Check current state
        if (!store.isPadConsumed(coord)) {
          const remainingBefore = store.getRemainingTouches(coord);
          const nowConsumed = store.consumeTouch(coord);
          const remainingAfter = store.getRemainingTouches(coord);

          console.log(`GreenPad ${coord}: Bounce consumed touch. ${remainingBefore} -> ${remainingAfter}, consumed: ${nowConsumed}`);

          // Update local state immediately
          setLocalRemainingTouches(remainingAfter);
          setLocalConsumed(nowConsumed);

          // Trigger appropriate animation
          if (!nowConsumed && remainingAfter < remainingBefore) {
            // Pad was touched but not fully consumed - shrink animation
            animationType.current = "shrink";
            animationProgress.current = 0;
            setIsAnimating(true);
          } else if (nowConsumed) {
            // Pad is fully consumed - fade animation
            animationType.current = "fade";
            animationProgress.current = 0;
            setIsAnimating(true);
          }

          // Play consumption sound
          const a = audioRef.current;
          if (a) {
            try {
              // Different pitch based on remaining touches
              const pitch = 0.8 + (remainingAfter * 0.1);
              a.setPlaybackRate(pitch);
              if (a.isPlaying) a.stop();
              if (a.context.state === "suspended") a.context.resume();
              a.play();
            } catch (err) {
              console.error("Error playing audio:", err);
            }
          }
        } else {
          console.log(`GreenPad ${coord}: Already consumed, ignoring bounce`);
        }
      }
    });

    return () => unsubscribe();
  }, [coord, isInitialized]);

  // Animation loop
  useFrame((_, dt) => {
    if (!isAnimating) return;

    animationProgress.current += dt * 3; // Speed of animation

    if (animationProgress.current >= 1) {
      animationProgress.current = 1;
      setIsAnimating(false);
      animationType.current = "none";
    }

    const easedProgress = 1 - Math.pow(1 - animationProgress.current, 3);

    if (animationType.current === "shrink" && groupRef.current) {
      // Bounce effect during shrink
      const bounce = Math.sin(easedProgress * Math.PI * 2) * 0.05;
      groupRef.current.position.y = position[1] + bounce;

      // Scale effect
      const scale = 1 - (easedProgress * 0.2);
      if (meshRef.current) {
        meshRef.current.scale.x = scale;
      }
    } else if (animationType.current === "fade") {
      // Fade animation when consumed
      if (materialRef.current) {
        materialRef.current.opacity = 1 - easedProgress;
      }

      // Scale down as it fades
      if (groupRef.current) {
        const scale = 1 - (easedProgress * 0.5);
        groupRef.current.scale.setScalar(scale);
      }
    }
  });

  // Don't render if consumed
  if (localConsumed) {
    return null;
  }

  // Don't render until initialized
  if (!isInitialized) {
    return null;
  }

  // Calculate visual properties based on remaining touches
  const baseWidth = 0.8;
  const widthPerStep = baseWidth / 3;
  const currentWidth = Math.max(0.2, widthPerStep * (localRemainingTouches) );

  // Color gets darker as touches are consumed
  const greenIntensity = Math.max(0.2, localRemainingTouches / touchdown);
  const hue = 0.33; // Green hue
  const saturation = 0.6;
  const lightness = 0.3 + greenIntensity * 0.2;
  const color = new THREE.Color().setHSL(hue, saturation, lightness);

  return (
    <group ref={groupRef} position={position}>
      {/* Consumption sound */}
      <PositionalAudio
        ref={audioRef}
        url="/sounds/basicBounce.wav"
        distance={3}
        loop={false}
        autoplay={false}
      />

      <mesh ref={meshRef} receiveShadow>
        <RoundedBox args={[currentWidth, 0.15, 0.5]} radius={0.05} smoothness={4}>
          <meshStandardMaterial
            ref={materialRef}
            color={color}
            transparent
            opacity={1}
            emissive={color}
            emissiveIntensity={greenIntensity * 0.3}
          />
        </RoundedBox>
      </mesh>

      {/* Visual indicator of remaining touches */}
      {localRemainingTouches > 0 && Array.from({ length: localRemainingTouches }).map((_, i) => (
        <mesh
          key={i}
          position={[(i - (localRemainingTouches - 1) / 2) * 0.15, 0.1, 0.2]}
        >
          <sphereGeometry args={[0.03, 8, 8]} />
          <meshStandardMaterial
            color="#66ff66"
            emissive="#66ff66"
            emissiveIntensity={2}
          />
        </mesh>
      ))}
    </group>
  );
}
export function UpDoor({ position = [0, 0, 0] }: PadsProps) {

  return (
    <group position={position}>
      <group position={[-0.25, 0, 0]} >
        <mesh receiveShadow>
          <RoundedBox args={[0.8 / 2, 0.15, 0.5]} radius={0.05} smoothness={4}>
            <meshStandardMaterial color="#853448" />
          </RoundedBox>
        </mesh>
        <Arrow position={[0, 0, 0]} />
      </group>
      <group position={[0.25, 0, 0]} >
        <mesh receiveShadow>
          <RoundedBox args={[0.8 / 2, 0.15, 0.5]} radius={0.05} smoothness={4}>
            <meshStandardMaterial color="#853448" />
          </RoundedBox>
        </mesh>
        <Arrow position={[0, 0, 0]} />
      </group>

    </group>
  );
}

export function DownDoor({ position = [0, 0, 0] }: PadsProps) {

  return (
    <group position={position}>
      <group position={[-0.25, 0, 0]} >
        <mesh receiveShadow>
          <RoundedBox args={[0.8 / 2, 0.15, 0.5]} radius={0.05} smoothness={4}>
            <meshStandardMaterial color="#853448" />
          </RoundedBox>
        </mesh>
        <ArrowBlue rotation={[0, 0, 0]} position={[0, 0, 0]} />
      </group>
      <group position={[0.25, 0, 0]} >
        <mesh receiveShadow>
          <RoundedBox args={[0.8 / 2, 0.15, 0.5]} radius={0.05} smoothness={4}>
            <meshStandardMaterial color="#853448" />
          </RoundedBox>
        </mesh>
        <ArrowBlue position={[0, 0, 0]} />
      </group>

    </group>
  );
}

export function TopTrapPad({ position = [0, 0, 0], coord }: PadsProps) {
  const geometry = new THREE.ConeGeometry(0.1, 0.3, 8);
  const material = new THREE.MeshStandardMaterial({ color: "#a79e93", metalness: 0.9, roughness: 0.1 });
  const geometry2 = new THREE.SphereGeometry(0.05, 8, 8);
  const material2 = new THREE.MeshStandardMaterial({ color: "#aa7a3b", metalness: 0.1, roughness: 0.0, emissive: "#e95c5c", emissiveIntensity: 5.6 });
  return (
    <group position={position}>
      <mesh receiveShadow>
        <RoundedBox args={[0.9, 0.15, 0.5]} radius={0.05} smoothness={4}>
          <meshStandardMaterial color="#853448" />
        </RoundedBox>
      </mesh>
      <mesh position={[-0.25, 0.08, 0]} rotation={[0, 0, 0]} geometry={geometry} material={material} />
      <mesh position={[-0., 0.11, 0]} rotation={[0, 0, 0]} geometry={geometry} material={material} />
      <mesh position={[0.25, 0.15, 0]} rotation={[0, 0, 0]} geometry={geometry} material={material} />
      <mesh position={[-0.25, 0, 0.24]} rotation={[0, 0, 0]} geometry={geometry2} material={material} />
      <mesh position={[0, 0, 0.24]} rotation={[0, 0, 0]} geometry={geometry2} material={material} />
      <mesh position={[0.25, 0, 0.24]} rotation={[0, 0, 0]} geometry={geometry2} material={material} />
    </group>
  );
}

export function BotTrapPad({ position = [0, 0, 0], coord }: PadsProps) {
  const geometry = new THREE.ConeGeometry(0.1, 0.3, 8);
  const material = new THREE.MeshStandardMaterial({ color: "#aa7a3b", metalness: 0.9, roughness: 0.1 });
  return (
    <group position={position}>
      <mesh receiveShadow>
        <RoundedBox args={[0.9, 0.15, 0.5]} radius={0.05} smoothness={4}>
          <meshStandardMaterial color="#853448" />
        </RoundedBox>
      </mesh>
      <mesh position={[-0.25, 0.15, 0]} rotation={[0, 0, 0]} geometry={geometry} material={material} />
      <mesh position={[-0., 0.15, 0]} rotation={[0, 0, 0]} geometry={geometry} material={material} />
      <mesh position={[0.25, 0.15, 0]} rotation={[0, 0, 0]} geometry={geometry} material={material} />
    </group>
  );
}

export function Rtrampoline({ position = [0, 0, 0], coord }: PadsProps) {
  const geometry = new THREE.SphereGeometry(0.05, 8, 8);
  const material = new THREE.MeshStandardMaterial({ color: "#aa7a3b", metalness: 0.1, roughness: 0.0, emissive: "#e95c5c", emissiveIntensity: 5.6 });
  return (
    <group position={position}>
      <group position={[0.2, -0.2, 0]} >
        <mesh receiveShadow>
          <RoundedBox args={[0.5, 0.15, 0.5]} radius={0.05} smoothness={4}>
            <meshStandardMaterial metalness={0.8} roughness={0.4} color="#d4bb2c" />
          </RoundedBox>
        </mesh>
        <mesh position={[0.15, 0, 0.25]} geometry={geometry} material={material} />
      </group>
      <group rotation={[0, 0, -0.8]} position={[-0.25, -0.05, 0]}>
        <mesh receiveShadow>
          <RoundedBox args={[0.3, 0.15, 0.5]} radius={0.05} smoothness={4}>
            <meshStandardMaterial metalness={0.8} roughness={0.4} color="#d4bb2c" />
          </RoundedBox>
        </mesh>
        <mesh position={[-0.06, 0, 0.25]} geometry={geometry} material={material} />
      </group>

    </group>
  );
}

export function Ltrampoline({ position = [0, 0, 0], coord }: PadsProps) {
  const geometry = new THREE.SphereGeometry(0.05, 8, 8);
  const material = new THREE.MeshStandardMaterial({ color: "#aa7a3b", metalness: 0.1, roughness: 0.0, emissive: "#e95c5c", emissiveIntensity: 5.6 });
  return (
    <group rotation={[0, Math.PI, 0]} position={position}>
      <group position={[0.2, -0.2, 0]} >
        <mesh receiveShadow>
          <RoundedBox args={[0.5, 0.15, 0.5]} radius={0.05} smoothness={4}>
            <meshStandardMaterial metalness={0.8} roughness={0.4} color="#d4bb2c" />
          </RoundedBox>
        </mesh>
        <mesh position={[0.15, 0, -0.25]} geometry={geometry} material={material} />
      </group>
      <group rotation={[0, 0, -0.8]} position={[-0.25, -0.05, 0]}>
        <mesh receiveShadow>
          <RoundedBox args={[0.3, 0.15, 0.5]} radius={0.05} smoothness={4}>
            <meshStandardMaterial metalness={0.8} roughness={0.4} color="#d4bb2c" />
          </RoundedBox>
        </mesh>
        <mesh position={[-0.06, 0, -0.25]} geometry={geometry} material={material} />
      </group>

    </group>
  );
}