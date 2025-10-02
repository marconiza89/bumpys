import { RoundedBox, PositionalAudio, useTexture } from "@react-three/drei";
import { useEffect, useRef, useState } from "react";
import { Group, PositionalAudio as ThreePositionalAudio } from "three";
import { useFrame } from "@react-three/fiber";
import { PadEvent, subscribePadEvents } from "@/levels/state/padEvents";
import * as THREE from "three";
import { Arrow, ArrowBlue } from "../Arrow";
import { useGreenPadsStore } from "../../state/greenPadsStore";

export interface GreenPadProps {
  position?: [number, number, number];
  coord?: string;
  touchdown: number; // 1, 2 or 3
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
        // Check if this is a ceiling hit (fromBelow: true)
        if (e.payload?.fromBelow) {
          console.log(`GreenPad ${coord}: Hit from below, not consuming`);
          
          // Play a different sound or animation for ceiling hits if desired
          const a = audioRef.current;
          if (a) {
            try {
              // Higher pitch for ceiling hit
              a.setPlaybackRate(1.5);
              if (a.isPlaying) a.stop();
              if (a.context.state === "suspended") a.context.resume();
              a.play();
            } catch (err) {
              console.error("Error playing audio:", err);
            }
          }
          
          // Could add a different animation here for ceiling hits
          // For now, just return without consuming
          return;
        }

        // Normal bounce from above - consume as usual
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