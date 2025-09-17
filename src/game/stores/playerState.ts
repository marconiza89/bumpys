// src/game/state/playerState.ts
import { create } from "zustand";
import { Vector3 } from "three";

export type VerticalState = "idle" | "ascend" | "descend";
export type MovementState = "none" | "side" | "vertical" | "wallbounce";
export type BounceState = "inactive" | "active" | "paused";

export type PlayerPosition = {
    rowIndex: number;
    colIndex: number;
    worldPosition: Vector3;
};

export type PlayerPhysics = {
    // Bounce physics
    bounceProgress: number;
    bounceActive: boolean;
    hasStartedBounce: boolean;
    
    // Movement physics
    moving: boolean;
    moveKind: MovementState;
    currentSpeed: number;
    targetWorld: Vector3;
    
    // Wall bounce specific
    wallBounce: {
        active: boolean;
        start: Vector3;
        dir: -1 | 1;
        total: number;
        traveled: number;
        impactPlayed: boolean;
    };
    
    // Animation states
    yVal: number;
    yVel: number;
    zVal: number;
    zVel: number;
    xVal: number;
    xVel: number;
    animationActive: boolean;
};

export type PlayerInput = {
    left: boolean;
    right: boolean;
    up: boolean;
    down: boolean;
    pendingSide: 0 | -1 | 1;
};

export type PlayerStore = {
    // Core state
    verticalState: VerticalState;
    position: PlayerPosition;
    physics: PlayerPhysics;
    input: PlayerInput;
    landedFrom: VerticalState | null;
    
    // Actions
    setVerticalState: (state: VerticalState) => void;
    setPosition: (rowIndex: number, colIndex: number, worldPos: Vector3) => void;
    setMoving: (moving: boolean, kind?: MovementState) => void;
    setInput: (input: Partial<PlayerInput>) => void;
    
    // Physics actions
    startBounce: () => void;
    pauseBounce: () => void;
    resumeBounce: () => void;
    updateBounceProgress: (progress: number) => void;
    
    // Wall bounce
    startWallBounce: (dir: -1 | 1, start: Vector3, total: number) => void;
    updateWallBounce: (traveled: number, impactPlayed?: boolean) => void;
    stopWallBounce: () => void;
    
    // Animation
    updateAnimation: (updates: Partial<Pick<PlayerPhysics, 'yVal' | 'yVel' | 'zVal' | 'zVel' | 'xVal' | 'xVel' | 'animationActive'>>) => void;
    
    // Reset
    reset: () => void;
};

const initialPhysics: PlayerPhysics = {
    bounceProgress: 0,
    bounceActive: false,
    hasStartedBounce: false,
    moving: false,
    moveKind: "none",
    currentSpeed: 1,
    targetWorld: new Vector3(),
    wallBounce: {
        active: false,
        start: new Vector3(),
        dir: 1,
        total: 0,
        traveled: 0,
        impactPlayed: false,
    },
    yVal: 0,
    yVel: 0,
    zVal: 0,
    zVel: 0,
    xVal: 0,
    xVel: 0,
    animationActive: false,
};

export const usePlayerStore = create<PlayerStore>((set, get) => ({
    verticalState: "descend",
    position: {
        rowIndex: 0,
        colIndex: 0,
        worldPosition: new Vector3(),
    },
    physics: initialPhysics,
    input: {
        left: false,
        right: false,
        up: false,
        down: false,
        pendingSide: 0,
    },
    landedFrom: null,
    
    setVerticalState: (state) => {
        set((prev) => {
            const newState = { ...prev, verticalState: state };
            
            // Handle state transitions
            if (state === "descend") {
                newState.input = { ...prev.input, pendingSide: 0 };
            }
            
            if (state === "idle") {
                newState.landedFrom = prev.verticalState;
            } else {
                newState.landedFrom = null;
            }
            
            // Pause/resume bounce based on state
            if (state === "ascend" || state === "descend") {
                newState.physics = { ...prev.physics, bounceActive: false };
            }
            
            return newState;
        });
    },
    
    setPosition: (rowIndex, colIndex, worldPos) => {
        set((prev) => ({
            ...prev,
            position: {
                rowIndex,
                colIndex,
                worldPosition: worldPos.clone(),
            },
            physics: {
                ...prev.physics,
                targetWorld: worldPos.clone(),
            },
        }));
    },
    
    setMoving: (moving, kind = "none") => {
        set((prev) => ({
            ...prev,
            physics: {
                ...prev.physics,
                moving,
                moveKind: moving ? kind : "none",
            },
        }));
    },
    
    setInput: (inputUpdates) => {
        set((prev) => ({
            ...prev,
            input: { ...prev.input, ...inputUpdates },
        }));
    },
    
    startBounce: () => {
        set((prev) => ({
            ...prev,
            physics: {
                ...prev.physics,
                bounceActive: true,
                hasStartedBounce: true,
                bounceProgress: 0.5001, // Just after ground touch
            },
        }));
    },
    
    pauseBounce: () => {
        set((prev) => ({
            ...prev,
            physics: {
                ...prev.physics,
                bounceActive: false,
            },
        }));
    },
    
    resumeBounce: () => {
        const state = get();
        if (state.physics.hasStartedBounce) {
            set((prev) => ({
                ...prev,
                physics: {
                    ...prev.physics,
                    bounceActive: true,
                    bounceProgress: 0.5001,
                },
            }));
        }
    },
    
    updateBounceProgress: (progress) => {
        set((prev) => ({
            ...prev,
            physics: {
                ...prev.physics,
                bounceProgress: progress,
            },
        }));
    },
    
    startWallBounce: (dir, start, total) => {
        set((prev) => ({
            ...prev,
            physics: {
                ...prev.physics,
                wallBounce: {
                    active: true,
                    start: start.clone(),
                    dir,
                    total,
                    traveled: 0,
                    impactPlayed: false,
                },
                moving: true,
                moveKind: "wallbounce",
                bounceActive: false,
            },
        }));
    },
    
    updateWallBounce: (traveled, impactPlayed) => {
        set((prev) => ({
            ...prev,
            physics: {
                ...prev.physics,
                wallBounce: {
                    ...prev.physics.wallBounce,
                    traveled,
                    impactPlayed: impactPlayed ?? prev.physics.wallBounce.impactPlayed,
                },
            },
        }));
    },
    
    stopWallBounce: () => {
        set((prev) => ({
            ...prev,
            physics: {
                ...prev.physics,
                wallBounce: {
                    ...prev.physics.wallBounce,
                    active: false,
                },
                moving: false,
                moveKind: "none",
            },
        }));
    },
    
    updateAnimation: (updates) => {
        set((prev) => ({
            ...prev,
            physics: {
                ...prev.physics,
                ...updates,
            },
        }));
    },
    
    reset: () => {
        set({
            verticalState: "descend",
            position: {
                rowIndex: 0,
                colIndex: 0,
                worldPosition: new Vector3(),
            },
            physics: { ...initialPhysics, targetWorld: new Vector3() },
            input: {
                left: false,
                right: false,
                up: false,
                down: false,
                pendingSide: 0,
            },
            landedFrom: null,
        });
    },
}));