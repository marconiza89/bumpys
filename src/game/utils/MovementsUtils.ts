// src/game/utils/MovementUtils.ts
import { LevelData } from "@/game/types/LevelTypes";
import { cellsMap } from "@/game/utils/Grid";
import { useGreenPadsStore } from "@/levels/state/greenPadsStore";

/**
 * Check if a pad at the given coordinate should be treated as empty.
 * This includes:
 * - Pads that are actually "empty" in the level data
 * - Green pads that have been consumed
 */
export function isEffectivelyEmptyPad(data: LevelData, coord: string): boolean {
    const map = cellsMap(data);
    const cell = map.get(coord.toUpperCase());
    const padType = cell?.pad ?? data.defaults.pad;
    
    // Check if it's actually empty
    if (padType === "empty") {
        return true;
    }
    
    // Check if it's a consumed green pad
    if (padType === "green1" || padType === "green2" || padType === "green3") {
        const greenPadStore = useGreenPadsStore.getState();
        if (greenPadStore.isPadConsumed(coord)) {
            return true;
        }
    }
    
    return false;
}

/**
 * Check if there's a solid (non-empty) pad at the given coordinate.
 * Takes into account consumed green pads.
 */
export function hasSolidPadAt(data: LevelData, coord: string): boolean {
    return !isEffectivelyEmptyPad(data, coord);
}