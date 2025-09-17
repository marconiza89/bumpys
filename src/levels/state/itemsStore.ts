import { create } from "zustand";
import { LevelData } from "@/game/types/LevelTypes";
import { useLevelProgressStore } from "./LevelProgress";
type ItemEntry = { type: string; collected: boolean };
type ItemsDict = Record<string, ItemEntry>;

// Collezionabili dal JSON "cells"
const COLLECTABLES = new Set(["coin", "ice-stick", "gelato", "cone", "bear", "flag", "strawberry", "ice-cream", "cupcake", "cake", "cheesecake", "bread", "drink", "drink2", "granita"]);

type ItemsStore = {
    items: ItemsDict;
    totalCollectables: number;
    collectedCount: number;
    initFromLevel: (data: LevelData) => void;
    collectAt: (coord: string) => boolean;
    isCollected: (coord: string) => boolean;
    reset: () => void;
};

export const useItemsStore = create<ItemsStore>((set, get) => ({
    items: {},
    totalCollectables: 0,
    collectedCount: 0,
    initFromLevel: (data) => {
        const dict: ItemsDict = {};
        let total = 0;

        for (const cell of data.cells) {
            const t = cell.item;
            if (!t || t === "none") continue;
            const key = cell.coord.toUpperCase();
            dict[key] = { type: t, collected: false };
            if (COLLECTABLES.has(t)) total += 1;
        }

        set({ items: dict, totalCollectables: total, collectedCount: 0 });
        useLevelProgressStore.getState().setExitVisible(false);
    },
    collectAt: (coord) => {
        const key = coord.toUpperCase();
        const it = get().items[key];
        if (!it) return false;
        if (!COLLECTABLES.has(it.type)) return false;
        if (it.collected) return false;

        const nextItems = { ...get().items, [key]: { ...it, collected: true } };
        const collectedCount = get().collectedCount + 1;
        set({ items: nextItems, collectedCount });

        const total = get().totalCollectables;
        if (total > 0 && collectedCount >= total) {
            useLevelProgressStore.getState().setExitVisible(true);
        }
        return true;
    },
    isCollected: (coord) => !!get().items[coord.toUpperCase()]?.collected,
    reset: () => set({ items: {}, totalCollectables: 0, collectedCount: 0 }),
}));