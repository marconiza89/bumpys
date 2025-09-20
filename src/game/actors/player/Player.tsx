import { useEffect, useMemo, useRef } from "react";
import { BufferGeometry, Group, Material, Mesh, PositionalAudio as ThreePositionalAudio } from "three";
import { useFrame } from "@react-three/fiber";
import { PositionalAudio } from "@react-three/drei";
import { LevelData } from "@/game/types/LevelTypes";
import { usePlayerStore } from "@/game/stores/playerState";
import { useInteractionStore } from "@/game/stores/InteractionState";
import { PlayerMovementSystem } from "./PlayerMovementSystem";
import { PlayerPhysicsSystem } from "./PlayerPhysicSystem";
import { PlayerInputHandler } from "./PlayerImputHandler";
import { Bumpy } from "../models/Bumpy";
import { subscribePadEvents, PadEvent } from "@/levels/state/padEvents";

type PlayerProps = {
    data: LevelData;
};

export function Player({ data }: PlayerProps) {
    // Refs for 3D objects - properly typed
    const groupRef = useRef<Group | null>(null);
    const ballRef = useRef<Mesh<BufferGeometry, Material | Material[]> | null>(null);
    const tiltNodeRef = useRef<Group | null>(null);
    const springPivotRef = useRef<Group | null>(null);
    
    // Audio refs - properly typed
    const wallAudioRef = useRef<ThreePositionalAudio | null>(null);
    const bounceAudioRef = useRef<ThreePositionalAudio | null>(null);
    const jumpAudioRef = useRef<ThreePositionalAudio | null>(null);
    
    // Systems
    const movementSystem = useMemo(() => new PlayerMovementSystem(data), [data]);
    const physicsSystem = useMemo(() => new PlayerPhysicsSystem(movementSystem), [movementSystem]);
    const inputHandler = useMemo(() => new PlayerInputHandler(movementSystem), [movementSystem]);
    
    // Zustand store subscriptions
    const playerState = usePlayerStore();
    const { position, physics, verticalState } = playerState;
    
    // Initialize player and group position
    useEffect(() => {
        movementSystem.initializePlayer();
        inputHandler.attachEventListeners();
        
        // Set initial group position after player is initialized
        const playerState = usePlayerStore.getState();
        if (groupRef.current && playerState.position.worldPosition.length() > 0) {
            groupRef.current.position.copy(playerState.position.worldPosition);
        }
        
        return () => {
            inputHandler.detachEventListeners();
            usePlayerStore.getState().reset();
            useInteractionStore.getState().reset();
        };
    }, [movementSystem, inputHandler]);
    
    // Subscribe to pad events for audio and animation triggers
    useEffect(() => {
        const coord = movementSystem.toCoordFromIndices?.(position.rowIndex, position.colIndex) || "";
        if (!coord) return;
        
        const unsubscribe = subscribePadEvents(coord, (event: PadEvent) => {
            switch (event.type) {
                case "bounce":
                    physicsSystem.triggerBounceImpulse();
                    playBounceAudio();
                    break;
                case "tilt":
                    const dir = event.payload?.dir || 1;
                    physicsSystem.triggerTiltImpulse(dir);
                    break;
                case "trampoline":
                    physicsSystem.triggerTrampolineImpulse();
                    playJumpAudio();
                    break;
            }
        });
        
        return unsubscribe;
    }, [position.rowIndex, position.colIndex, physicsSystem]);
    
    // Audio helper functions
    const playBounceAudio = () => {
        const audio = bounceAudioRef.current;
        if (audio) {
            try {
                audio.setPlaybackRate(0.95 + Math.random() * 0.1);
                if (audio.isPlaying) audio.stop();
                if (audio.context.state === "suspended") audio.context.resume();
                audio.play();
            } catch (error) {
                console.warn("Failed to play bounce audio:", error);
            }
        }
    };
    
    const playJumpAudio = () => {
        const audio = jumpAudioRef.current;
        if (audio) {
            try {
                audio.setPlaybackRate(0.98 + Math.random() * 0.08);
                if (audio.isPlaying) audio.stop();
                if (audio.context.state === "suspended") audio.context.resume();
                audio.play();
            } catch (error) {
                console.warn("Failed to play jump audio:", error);
            }
        }
    };
    
    // Main frame update
    useFrame((_, deltaTime) => {
        const dt = Math.min(0.033, Math.max(0.001, deltaTime));
        
        // Ensure group position is synced with player world position when not moving
        if (!physics.moving && !physics.wallBounce.active && groupRef.current) {
            const currentDistance = groupRef.current.position.distanceTo(position.worldPosition);
            if (currentDistance > 0.001) {
                groupRef.current.position.copy(position.worldPosition);
            }
        }
        
        // Update bounce animation
        physicsSystem.updateBounce(dt, ballRef);
        
        // Update wall bounce if active
        if (physics.wallBounce.active) {
            const completed = physicsSystem.updateWallBounce(dt, groupRef, ballRef, wallAudioRef);
            if (completed) return; // Skip other updates if wall bounce completed
        }
        
        // Update regular movement
        if (physics.moving && !physics.wallBounce.active) {
            const completed = physicsSystem.updateMovement(dt, groupRef, ballRef);
            if (completed) return; // Skip other updates if movement completed
        }
        
        // Update pad animation (spring system)
        physicsSystem.updatePadAnimation(dt, { tiltNodeRef, springPivotRef });
        
        // Handle input resolution when not moving
        if (!physics.moving && !physics.wallBounce.active) {
            // Check for immediate input after landing
            if (verticalState === "idle" && playerState.landedFrom) {
                const handled = movementSystem.handleImmediateInput();
                if (handled) return;
            }
            
            // Resolve general motion
            const resolved = inputHandler.resolveMotion();
            if (!resolved && verticalState === "ascend") {
                movementSystem.tryAscend();
            } else if (!resolved && verticalState === "descend") {
                movementSystem.tryDescend();
            }
        }
    });
    
    return (
        <group ref={groupRef} name="Player">
            {/* Audio components */}
            <PositionalAudio
                ref={wallAudioRef}
                url="/sounds/wall.wav"
                distance={4}
                loop={false}
                autoplay={false}
            />
            <PositionalAudio
                ref={bounceAudioRef}
                url="/sounds/basicBounce.WAV"
                distance={3}
                loop={false}
                autoplay={false}
            />
            <PositionalAudio
                ref={jumpAudioRef}
                url="/sounds/jump.wav"
                distance={3}
                loop={false}
                autoplay={false}
            />
            
            {/* Animated pad platform */}
            <group ref={tiltNodeRef}>
                <group ref={springPivotRef}>
                    {/* This could be used for pad-specific animations if needed */}
                </group>
            </group>
            
            {/* Player ball */}
            <group ref={ballRef} position={[0, 0.5, -0.25]} castShadow>
                <Bumpy />
            </group>
            
            {/* Shadow */}
            <mesh position={[0, 0.09, -0.25]} rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[0.22, 16]} />
                <meshBasicMaterial color="#000000" transparent opacity={0.25} />
            </mesh>
        </group>
    );
}