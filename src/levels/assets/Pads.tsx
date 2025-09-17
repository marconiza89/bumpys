import { RoundedBox, PositionalAudio, useTexture } from "@react-three/drei";
import { useEffect, useRef } from "react";
import { Group, PositionalAudio as ThreePositionalAudio } from "three";
import { useFrame } from "@react-three/fiber";
import { PadEvent, subscribePadEvents } from "@/levels/state/padEvents";
import * as THREE from "three";
import { Arrow, ArrowBlue } from "./Arrow";

export interface PadsProps {
  position?: [number, number, number];
  coord?: string;
}

export interface DynamicPadsProps {
  position?: [number, number, number];
  coord?: string;
  touchdown: number;
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
        url="/sounds/basicBounce.WAV"
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
  const material = new THREE.MeshStandardMaterial({ color: "#aa7a3b", metalness: 0.1, roughness: 0.0, emissive: "#e9955c", emissiveIntensity: 5.6 });
  return (
    <group position={position}>
      <group position={[0, 0.2, 0]} rotation={[0, 0, -0.4]} >
        <mesh  >
          <RoundedBox args={[0.8, 0.25, 0.5]} radius={0.05} smoothness={4}>
            <meshStandardMaterial color="#853448" />
          </RoundedBox>
        </mesh>
        <mesh position={[-0.25, 0, 0.25]} geometry={geometry} material={material} />
        <mesh position={[-0., 0, 0.25]} geometry={geometry} material={material} />
        <mesh position={[0.25, 0, 0.25]} geometry={geometry} material={material} />
      </group>

    </group>
  );
}

export function LBouncer({ position = [0, 0, 0], coord }: PadsProps) {
  const geometry = new THREE.SphereGeometry(0.05, 8, 8);
  const material = new THREE.MeshStandardMaterial({ color: "#aa7a3b", metalness: 0.1, roughness: 0.0, emissive: "#e9955c", emissiveIntensity: 5.6 });
  return (
    <group position={position}>
      <group position={[0, 0.2, 0]} rotation={[0, 0, 0.4]} >
        <mesh  >
          <RoundedBox args={[0.8, 0.25, 0.5]} radius={0.05} smoothness={4}>
            <meshStandardMaterial color="#853448" />
          </RoundedBox>
        </mesh>
        <mesh position={[-0.25, 0, 0.25]} geometry={geometry} material={material} />
        <mesh position={[-0., 0, 0.25]} geometry={geometry} material={material} />
        <mesh position={[0.25, 0, 0.25]} geometry={geometry} material={material} />
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

export function GreenPad({ position = [0, 0, 0], coord, touchdown = 0 }: DynamicPadsProps) {
  return (
    <group position={position}>
      <mesh receiveShadow>
        <RoundedBox args={[0.8 / 3 * touchdown, 0.15, 0.5]} radius={0.05} smoothness={4}>
          <meshStandardMaterial color="#348546" />
        </RoundedBox>
      </mesh>
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
        <mesh  receiveShadow>
          <RoundedBox args={[0.5, 0.15, 0.5]} radius={0.05} smoothness={4}>
            <meshStandardMaterial metalness={0.8} roughness={0.4} color="#d4bb2c" />
          </RoundedBox>
        </mesh>
         <mesh position={[0.15, 0, 0.25]} geometry={geometry} material={material} />
      </group>
      <group rotation={[0, 0, -0.8]} position={[-0.25, -0.05, 0]}>
        <mesh  receiveShadow>
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
        <mesh  receiveShadow>
          <RoundedBox args={[0.5, 0.15, 0.5]} radius={0.05} smoothness={4}>
            <meshStandardMaterial metalness={0.8} roughness={0.4} color="#d4bb2c" />
          </RoundedBox>
        </mesh>
         <mesh position={[0.15, 0, -0.25]} geometry={geometry} material={material} />
      </group>
      <group rotation={[0, 0, -0.8]} position={[-0.25, -0.05, 0]}>
        <mesh  receiveShadow>
          <RoundedBox args={[0.3, 0.15, 0.5]} radius={0.05} smoothness={4}>
            <meshStandardMaterial metalness={0.8} roughness={0.4} color="#d4bb2c" />
          </RoundedBox>
        </mesh>
         <mesh position={[-0.06, 0, -0.25]} geometry={geometry} material={material} />
      </group>
     
    </group>
  );
}