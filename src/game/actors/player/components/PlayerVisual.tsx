import React, { MutableRefObject } from "react";
import { Group, Object3D } from "three";
import {
    BALL_NODE_OFFSET,
    SHADOW_OFFSET,
    SHADOW_RADIUS,
    SHADOW_SEGMENTS,
    SHADOW_OPACITY,
} from "../constant.ts";
import { Bumpy } from "../../models/Bumpy";

type PlayerVisualsProps = {
    groupRef: MutableRefObject<Group | null>;
    ballRef: MutableRefObject<Object3D | null>;
    ballNodeOffset?: readonly [number, number, number];
    shadow?: boolean;
    shadowOffset?: readonly [number, number, number];
};

export function PlayerVisuals({
    groupRef,
    ballRef,
    ballNodeOffset = BALL_NODE_OFFSET,
    shadow = true,
    shadowOffset = SHADOW_OFFSET,
}: PlayerVisualsProps) {
    return (
        <group ref={groupRef} name="Player">
            <group ref={ballRef} position={ballNodeOffset} castShadow>
                <Bumpy />
            </group>

            {shadow && (
                <mesh position={shadowOffset} rotation={[-Math.PI / 2, 0, 0]}>
                    <circleGeometry args={[SHADOW_RADIUS, SHADOW_SEGMENTS]} />
                    <meshBasicMaterial color="#000000" transparent opacity={SHADOW_OPACITY} />
                </mesh>
            )}
        </group>
    );
}