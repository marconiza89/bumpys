// src/game/state/interactionState.ts
import { create } from "zustand";
import { Vector3 } from "three";

export type PadInteractionType = 
    | "normal_bounce" 
    | "ice_slide" 
    | "trap_damage" 
    | "bouncer_redirect" 
    | "trampoline_boost" 
    | "door_teleport";

export type BrickInteractionType = 
    | "door_left_enter" 
    | "door_left_exit" 
    | "door_right_enter" 
    | "door_right_exit";

export type InteractionDirection = "from_above" | "from_below" | "from_left" | "from_right";

export type PadInteraction = {
    id: string;
    coord: string;
    padType: string;
    interactionType: PadInteractionType;
    direction: InteractionDirection;
    timestamp: number;
    data?: any;
};

export type BrickInteraction = {
    id: string;
    coord: string;
    brickType: string;
    interactionType: BrickInteractionType;
    direction: InteractionDirection;
    timestamp: number;
    data?: any;
};

export type InteractionState = {
    padInteractions: Map<string, PadInteraction>;
    brickInteractions: Map<string, BrickInteraction>;
    interactionSequence: number;
    
    // Actions
    triggerPadInteraction: (
        coord: string, 
        padType: string, 
        direction: InteractionDirection, 
        data?: any
    ) => void;
    
    triggerBrickInteraction: (
        coord: string, 
        brickType: string, 
        direction: InteractionDirection,
        data?: any
    ) => void;
    
    getLastPadInteraction: (coord: string) => PadInteraction | undefined;
    getLastBrickInteraction: (coord: string) => BrickInteraction | undefined;
    
    // Pad-specific interactions
    handleNormalPad: (coord: string, direction: InteractionDirection) => void;
    handleIcePad: (coord: string, direction: InteractionDirection) => void;
    handleTrapPad: (coord: string, direction: InteractionDirection, trapType: string) => void;
    handleBouncerPad: (coord: string, direction: InteractionDirection, bouncerDir: "left" | "right") => void;
    handleTrampolinePad: (coord: string, direction: InteractionDirection, trampolineDir: "left" | "right") => void;
    handleDoorPad: (coord: string, direction: InteractionDirection, doorType: "up" | "down") => void;
    handleGreenPad: (coord: string, direction: InteractionDirection, touchdown: number) => void;
    
    // Brick-specific interactions
    handleDoorBrick: (coord: string, direction: InteractionDirection, doorDir: "left" | "right") => void;
    
    reset: () => void;
};

// Map pad types to interaction types
const PAD_TYPE_MAP: Record<string, PadInteractionType> = {
    "normal": "normal_bounce",
    "ice": "ice_slide",
    "doubletrap": "trap_damage",
    "bottrap": "trap_damage",
    "toptrap": "trap_damage",
    "rbouncer": "bouncer_redirect",
    "lbouncer": "bouncer_redirect",
    "rtrampoline": "trampoline_boost",
    "ltrampoline": "trampoline_boost",
    "updoor": "door_teleport",
    "downdoor": "door_teleport",
    "green1": "normal_bounce",
    "green2": "normal_bounce",
};

export const useInteractionStore = create<InteractionState>((set, get) => ({
    padInteractions: new Map(),
    brickInteractions: new Map(),
    interactionSequence: 0,
    
    triggerPadInteraction: (coord, padType, direction, data) => {
        const interactionType = PAD_TYPE_MAP[padType] || "normal_bounce";
        const id = `pad_${get().interactionSequence + 1}`;
        
        const interaction: PadInteraction = {
            id,
            coord: coord.toUpperCase(),
            padType,
            interactionType,
            direction,
            timestamp: performance.now(),
            data,
        };
        
        set((state) => {
            const newMap = new Map(state.padInteractions);
            newMap.set(coord.toUpperCase(), interaction);
            return {
                padInteractions: newMap,
                interactionSequence: state.interactionSequence + 1,
            };
        });
    },
    
    triggerBrickInteraction: (coord, brickType, direction, data) => {
        const id = `brick_${get().interactionSequence + 1}`;
        
        let interactionType: BrickInteractionType = "door_left_enter";
        if (brickType === "ldoor") {
            interactionType = direction === "from_left" ? "door_left_enter" : "door_left_exit";
        } else if (brickType === "rdoor") {
            interactionType = direction === "from_right" ? "door_right_enter" : "door_right_exit";
        }
        
        const interaction: BrickInteraction = {
            id,
            coord: coord.toUpperCase(),
            brickType,
            interactionType,
            direction,
            timestamp: performance.now(),
            data,
        };
        
        set((state) => {
            const newMap = new Map(state.brickInteractions);
            newMap.set(coord.toUpperCase(), interaction);
            return {
                brickInteractions: newMap,
                interactionSequence: state.interactionSequence + 1,
            };
        });
    },
    
    getLastPadInteraction: (coord) => {
        return get().padInteractions.get(coord.toUpperCase());
    },
    
    getLastBrickInteraction: (coord) => {
        return get().brickInteractions.get(coord.toUpperCase());
    },
    
    // Pad handlers
    handleNormalPad: (coord, direction) => {
        get().triggerPadInteraction(coord, "normal", direction);
    },
    
    handleIcePad: (coord, direction) => {
        get().triggerPadInteraction(coord, "ice", direction, { slippery: true });
    },
    
    handleTrapPad: (coord, direction, trapType) => {
        const damage = trapType === "doubletrap" ? 2 : 1;
        get().triggerPadInteraction(coord, trapType, direction, { damage });
    },
    
    handleBouncerPad: (coord, direction, bouncerDir) => {
        const bounceVector = bouncerDir === "right" ? new Vector3(1, 0, 0) : new Vector3(-1, 0, 0);
        get().triggerPadInteraction(coord, `${bouncerDir}bouncer`, direction, { bounceVector });
    },
    
    handleTrampolinePad: (coord, direction, trampolineDir) => {
        const boostVector = trampolineDir === "right" 
            ? new Vector3(0.7, 1, 0) 
            : new Vector3(-0.7, 1, 0);
        get().triggerPadInteraction(coord, `${trampolineDir}trampoline`, direction, { boostVector });
    },
    
    handleDoorPad: (coord, direction, doorType) => {
        get().triggerPadInteraction(coord, `${doorType}door`, direction, { doorType });
    },
    
    handleGreenPad: (coord, direction, touchdown) => {
        get().triggerPadInteraction(coord, `green${touchdown}`, direction, { touchdown });
    },
    
    // Brick handlers
    handleDoorBrick: (coord, direction, doorDir) => {
        get().triggerBrickInteraction(coord, `${doorDir}door`, direction, { doorDirection: doorDir });
    },
    
    reset: () => {
        set({
            padInteractions: new Map(),
            brickInteractions: new Map(),
            interactionSequence: 0,
        });
    },
}));