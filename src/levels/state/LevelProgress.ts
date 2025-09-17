import { create } from "zustand";

type LevelProgressStore = {
exitVisible: boolean;
setExitVisible: (v: boolean) => void;
reset: () => void;
};

export const useLevelProgressStore = create<LevelProgressStore>((set) => ({
exitVisible: false,
setExitVisible: (v) => set({ exitVisible: v }),
reset: () => set({ exitVisible: false }),
}));

