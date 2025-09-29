// src/levels/state/greenPadsStore.ts
import { create } from "zustand";

type GreenPadState = {
    touchesRemaining: number;
    maxTouches: number;
    consumed: boolean;
};

type GreenPadsStore = {
    pads: Map<string, GreenPadState>;
    
    // Initialize a green pad with max touches
    initPad: (coord: string, maxTouches: number) => void;
    
    // Handle a bounce on a green pad
    consumeTouch: (coord: string) => boolean; // returns true if pad is now consumed
    
    // Check if a pad acts as empty (consumed)
    isPadConsumed: (coord: string) => boolean;
    
    // Get remaining touches for a pad
    getRemainingTouches: (coord: string) => number;
    
    // Reset all pads to initial state
    resetFromLevel: () => void;
    
    // Clear all state
    reset: () => void;
};

export const useGreenPadsStore = create<GreenPadsStore>((set, get) => ({
    pads: new Map(),
    
    initPad: (coord, maxTouches) => {
        const key = coord.toUpperCase();
        
        set((state) => {
            const newPads = new Map(state.pads);
            // Always initialize with fresh state
            newPads.set(key, {
                touchesRemaining: maxTouches,
                maxTouches: maxTouches,
                consumed: false
            });
            console.log(`Store: Initialized pad ${key} with ${maxTouches} touches`);
            return { pads: newPads };
        });
    },
    
consumeTouch: (coord) => {
        const key = coord.toUpperCase();
        const pad = get().pads.get(key);
        
        if (!pad) {
            console.warn(`Store: Cannot consume touch - pad ${key} not found!`);
            return false;
        }
        
        if (pad.consumed) {
            console.log(`Store: Pad ${key} already consumed`);
            return true;
        }
        
        const newTouches = pad.touchesRemaining - 1  ;
        const isNowConsumed = newTouches <= 0;
        
        set((state) => {
            const newPads = new Map(state.pads);
            newPads.set(key, {
                ...pad,
                touchesRemaining: Math.max(0, newTouches),
                consumed: isNowConsumed
            });
            
            console.log(`Store: Pad ${key} consumed touch. Remaining: ${Math.max(0, newTouches)}, Consumed: ${isNowConsumed}`);
            
            return { pads: newPads };
        });
        
        return isNowConsumed;
    },
    
    isPadConsumed: (coord) => {
        const key = coord.toUpperCase();
        const pad = get().pads.get(key);
        
        // Return false if pad doesn't exist (not consumed, just not initialized yet)
        if (!pad) {
            return false;
        }
        
        return pad.consumed;
    },
    
    getRemainingTouches: (coord) => {
        const key = coord.toUpperCase();
        const pad = get().pads.get(key);
        
        // Return 0 if pad doesn't exist (safe default)
        if (!pad) {
            return 0;
        }
        
        return pad.touchesRemaining;
    },
    
    resetFromLevel: () => {
        console.log(`Store: Resetting all pads to initial state`);
        
        // Re-initialize all pads to their original state
        const currentPads = get().pads;
        const newPads = new Map<string, GreenPadState>();
        
        currentPads.forEach((pad, key) => {
            newPads.set(key, {
                touchesRemaining: pad.maxTouches,
                maxTouches: pad.maxTouches,
                consumed: false
            });
        });
        
        set({ pads: newPads });
    },
    
    reset: () => {
        console.log(`Store: Clearing all pads`);
        set({ pads: new Map() });
    }
}));