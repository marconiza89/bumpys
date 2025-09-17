import { RoundedBox, PositionalAudio, useTexture } from "@react-three/drei";
import { useEffect, useRef } from "react";
import { Group, PositionalAudio as ThreePositionalAudio } from "three";
import { useFrame } from "@react-three/fiber";
import { PadEvent, subscribePadEvents } from "@/levels/state/padEvents";
import * as THREE from "three";
import { Arrow, ArrowBlue, ArrowRed } from "./Arrow";

export interface BricksProps {
  position?: [number, number, number];
  coord?: string;
}

export interface DynamicBricksProps {
  position?: [number, number, number];
  coord?: string;
  touchdown: number;
}



export function LDoor({ position = [0, 0, 0] }: BricksProps) {

  return (
    <group position={position}>
      <group  rotation={[0,0,-Math.PI/2]} position={[-0.5, 0.5,0]}  >
          <group  position={[-0.2, 0, 0]} >
            <mesh receiveShadow>
              <RoundedBox args={[0.8 / 2, 0.15, 0.5]} radius={0.05} smoothness={4}>
                <meshStandardMaterial color="#348546" />
              </RoundedBox>
            </mesh>
            <ArrowRed rotation={[0, 0, 0]} position={[0, 0, 0]} />
          </group>
          <group position={[0.2, 0, 0]} >
            <mesh receiveShadow>
              <RoundedBox args={[0.8 / 2, 0.15, 0.5]} radius={0.05} smoothness={4}>
                <meshStandardMaterial color="#348546" />
              </RoundedBox>
            </mesh>
            <ArrowRed position={[0, 0, 0]} />
          </group>
      </group>

    </group>
  );
}

export function RDoor({ position = [0, 0, 0] }: BricksProps) {

  return (
    <group position={position}>
      <group rotation={[0,0,-Math.PI/2]}  position={[-0.5, 0.5,0]}  >
          <group  position={[-0.2, 0, 0]} >
            <mesh receiveShadow>
              <RoundedBox args={[0.8 / 2, 0.15, 0.5]} radius={0.05} smoothness={4}>
                <meshStandardMaterial color="#348546" />
              </RoundedBox>
            </mesh>
            <ArrowRed rotation={[0, 0, Math.PI]} position={[0, 0, 0]} />
          </group>
          <group position={[0.2, 0, 0]} >
            <mesh receiveShadow>
              <RoundedBox args={[0.8 / 2, 0.15, 0.5]} radius={0.05} smoothness={4}>
                <meshStandardMaterial color="#348546" />
              </RoundedBox>
            </mesh>
            <ArrowRed rotation={[0, 0, Math.PI]} position={[0, 0, 0]} />
          </group>
      </group>

    </group>
  );
}

