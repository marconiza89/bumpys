// src/game/systems/PlayerPhysicsSystem.ts
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { Group, Mesh, Vector3, BufferGeometry, Material, PositionalAudio as ThreePositionalAudio } from "three";
import { usePlayerStore } from "@/game/stores/playerState";
import { PlayerMovementSystem } from "./PlayerMovementSystem";
import { publishPadEvent } from "@/levels/state/padEvents";

export class PlayerPhysicsSystem {
    private movementSystem: PlayerMovementSystem;
    
    // Bounce constants
    private readonly BOUNCE_BPM = 140;
    private readonly BOUNCE_FREQ = this.BOUNCE_BPM / 60; // Hz
    private readonly TWO_PI = Math.PI * 2;
    
    // Ball position constants
    private readonly BALL_MIN_Y = 0.3;
    private readonly BALL_MAX_Y = 0.8;
    private readonly BALL_MID_Y = (this.BALL_MIN_Y + this.BALL_MAX_Y) / 2; // 0.55
    private readonly BALL_AMP_Y = (this.BALL_MAX_Y - this.BALL_MIN_Y) / 2; // 0.25
    
    // Animation constants
    private readonly Y_K = 140; private readonly Y_D = 18;
    private readonly Z_K = 120; private readonly Z_D = 16;
    private readonly X_K = 130; private readonly X_D = 16;
    
    // Impulse constants
    private readonly IMPULSE_BOUNCE_Y = -0.06;
    private readonly IMPULSE_TILT_Z = 4.2;
    private readonly IMPULSE_TRAMP_X = -3.6;
    private readonly IMPULSE_TRAMP_Y = -0.02;
    
    constructor(movementSystem: PlayerMovementSystem) {
        this.movementSystem = movementSystem;
    }
    
    public updateBounce(deltaTime: number, ballRef: React.RefObject<Mesh<BufferGeometry, Material | Material[]> | null>): void {
        const playerState = usePlayerStore.getState();
        const { physics, verticalState } = playerState;
        
        if (!physics.bounceActive || verticalState !== "idle" || physics.moving || !ballRef.current) {
            return;
        }
        
        const prevProgress = physics.bounceProgress;
        const newProgress = (prevProgress + this.BOUNCE_FREQ * deltaTime) % 1;
        
        const y = this.BALL_MID_Y + this.BALL_AMP_Y * Math.cos(this.TWO_PI * newProgress);
        ballRef.current.position.y = y;
        
        playerState.updateBounceProgress(newProgress);
        
        // Detect ground hit
        const groundHit = this.detectGroundHit(prevProgress, newProgress);
        if (groundHit) {
            this.onBounceGround();
        }
    }
    
    private detectGroundHit(prevProgress: number, newProgress: number): boolean {
        if (prevProgress <= 0.5 && newProgress > 0.5) return true;
        if (newProgress < prevProgress && (prevProgress <= 0.5 || newProgress > 0.5)) return true;
        return false;
    }
    
    private onBounceGround(): void {
        const playerState = usePlayerStore.getState();
        const { position } = playerState;
        
        const coord = this.toCoord(position.rowIndex, position.colIndex);
        publishPadEvent(coord, "bounce");
        
        // Handle queued actions on ground bounce
        if (playerState.verticalState === "idle") {
            const hadImmediateAction = this.movementSystem.handleImmediateInput();
            if (!hadImmediateAction) {
                this.movementSystem.resolveQueuedActions();
            }
        }
    }
    
    private toCoord(rowIndex: number, colIndex: number): string {
        // This should match the method in MovementSystem
        // Consider moving to a shared utility
        return `${String.fromCharCode(65 + rowIndex)}${colIndex + 1}`;
    }
    
    public updateWallBounce(
        deltaTime: number, 
        groupRef: React.RefObject<Group | null>,
        ballRef: React.RefObject<Mesh<BufferGeometry, Material | Material[]> | null>,
        wallAudioRef: React.RefObject<ThreePositionalAudio | null>
    ): boolean {
        const playerState = usePlayerStore.getState();
        const { physics } = playerState;
        const { wallBounce } = physics;
        
        if (!wallBounce.active || !groupRef.current) return false;
        
        const step = physics.currentSpeed * deltaTime;
        const newTraveled = Math.min(wallBounce.traveled + step, wallBounce.total);
        
        const progress = newTraveled / wallBounce.total; // 0..1
        const distOut = progress <= 0.5 ? progress * wallBounce.total : (1 - progress) * wallBounce.total;
        const offsetX = wallBounce.dir * distOut;
        
        // Update position
        groupRef.current.position.set(
            wallBounce.start.x + offsetX,
            wallBounce.start.y,
            wallBounce.start.z
        );
        
        // Update ball arc
        if (ballRef.current) {
            const y = this.BALL_MIN_Y + (this.BALL_MAX_Y - this.BALL_MIN_Y) * Math.sin(Math.PI * progress);
            ballRef.current.position.y = y;
        }
        
        // Handle wall impact sound
        const half = wallBounce.total / 2;
        if (!wallBounce.impactPlayed && newTraveled >= half - 1e-6) {
            this.playWallImpactSound(wallAudioRef);
            playerState.updateWallBounce(newTraveled, true);
        } else {
            playerState.updateWallBounce(newTraveled);
        }
        
        // Check completion
        if (newTraveled >= wallBounce.total - 1e-6) {
            this.completeWallBounce(ballRef);
            return true; // Movement completed
        }
        
        return false; // Still moving
    }
    
    private playWallImpactSound(wallAudioRef: React.RefObject<ThreePositionalAudio | null>): void {
        const audio = wallAudioRef.current;
        if (!audio) return;
        
        try {
            audio.setPlaybackRate(0.95 + Math.random() * 0.1);
            if (audio.isPlaying) audio.stop();
            if (audio.context.state === "suspended") audio.context.resume();
            audio.play();
        } catch (error) {
            console.warn("Failed to play wall impact sound:", error);
        }
    }
    
    private completeWallBounce(ballRef: React.RefObject<Mesh<BufferGeometry, Material | Material[]> | null>): void {
        const playerState = usePlayerStore.getState();
        
        playerState.stopWallBounce();
        
        if (ballRef.current) {
            ballRef.current.position.y = this.BALL_MIN_Y;
        }
        
        if (playerState.verticalState === "idle") {
            this.onBounceGround();
            playerState.resumeBounce();
        }
    }
    
    public updateMovement(
        deltaTime: number,
        groupRef: React.RefObject<Group | null>,
        ballRef: React.RefObject<Mesh<BufferGeometry, Material | Material[]> | null>
    ): boolean {
        const playerState = usePlayerStore.getState();
        const { physics } = playerState;
        
        if (!physics.moving || !groupRef.current) return false;
        
        const pos = groupRef.current.position;
        const dir = physics.targetWorld.clone().sub(pos);
        const dist = dir.length();
        
        // Handle side movement arc
        if (physics.moveKind === "side" && ballRef.current) {
            const initialDist = physics.targetWorld.distanceTo(new Vector3().copy(pos));
            const t = 1 - Math.max(0, Math.min(1, dist / Math.max(1e-6, initialDist)));
            const y = this.BALL_MIN_Y + (this.BALL_MAX_Y - this.BALL_MIN_Y) * Math.sin(Math.PI * t);
            ballRef.current.position.y = y;
        }
        
        if (dist < 0.001) {
            // Arrival
            groupRef.current.position.copy(physics.targetWorld);
            this.movementSystem.onArrival();
            return true; // Movement completed
        } else {
            // Continue moving
            const step = Math.min(dist, physics.currentSpeed * deltaTime);
            dir.normalize().multiplyScalar(step);
            pos.add(dir);
        }
        
        return false; // Still moving
    }
    
    public updatePadAnimation(deltaTime: number, refs: {
        tiltNodeRef: React.RefObject<Group | null>;
        springPivotRef: React.RefObject<Group | null>;
    }): void {
        const playerState = usePlayerStore.getState();
        const { physics } = playerState;
        
        if (!physics.animationActive) return;
        
        const clampedDt = Math.min(0.033, Math.max(0.001, deltaTime));
        
        // Y axis (bounce)
        const ay = -this.Y_K * physics.yVal - this.Y_D * physics.yVel;
        const newYVel = physics.yVel + ay * clampedDt;
        const newYVal = physics.yVal + newYVel * clampedDt;
        
        // Z axis (tilt)
        const az = -this.Z_K * physics.zVal - this.Z_D * physics.zVel;
        const newZVel = physics.zVel + az * clampedDt;
        const newZVal = physics.zVal + newZVel * clampedDt;
        
        // X axis (spring)
        const ax = -this.X_K * physics.xVal - this.X_D * physics.xVel;
        const newXVel = physics.xVel + ax * clampedDt;
        const newXVal = physics.xVal + newXVel * clampedDt;
        
        // Update refs
        if (refs.tiltNodeRef.current) {
            refs.tiltNodeRef.current.position.y = newYVal;
            refs.tiltNodeRef.current.rotation.z = newZVal;
        }
        if (refs.springPivotRef.current) {
            refs.springPivotRef.current.rotation.x = newXVal;
        }
        
        // Check if animation should stop
        const eps = 1e-3;
        const shouldStop = 
            Math.abs(newYVal) < eps && Math.abs(newYVel) < eps &&
            Math.abs(newZVal) < eps && Math.abs(newZVel) < eps &&
            Math.abs(newXVal) < eps && Math.abs(newXVel) < eps;
        
        if (shouldStop) {
            playerState.updateAnimation({
                yVal: 0, yVel: 0, zVal: 0, zVel: 0, xVal: 0, xVel: 0,
                animationActive: false
            });
        } else {
            playerState.updateAnimation({
                yVal: newYVal, yVel: newYVel, zVal: newZVal, 
                zVel: newZVel, xVal: newXVal, xVel: newXVel
            });
        }
    }
    
    public triggerBounceImpulse(): void {
        const playerState = usePlayerStore.getState();
        playerState.updateAnimation({
            yVel: playerState.physics.yVel + this.IMPULSE_BOUNCE_Y * 10,
            animationActive: true
        });
    }
    
    public triggerTiltImpulse(direction: -1 | 1): void {
        const playerState = usePlayerStore.getState();
        playerState.updateAnimation({
            zVel: playerState.physics.zVel + direction * -this.IMPULSE_TILT_Z,
            animationActive: true
        });
    }
    
    public triggerTrampolineImpulse(): void {
        const playerState = usePlayerStore.getState();
        playerState.updateAnimation({
            xVel: playerState.physics.xVel + this.IMPULSE_TRAMP_X * 5,
            yVel: playerState.physics.yVel + this.IMPULSE_TRAMP_Y * 5,
            animationActive: true
        });
    }
}