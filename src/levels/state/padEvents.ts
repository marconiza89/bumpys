import { create } from "zustand";

export type PadEventType = "bounce" | "tilt" | "trampoline" | "hitfrombottom";
export type PadEvent = {
    id: number;
    coord: string;
    type: PadEventType;
    payload?: any;
    ts: number;
};

type PadEventsStore = {
    seq: number;
    lastByCoord: Map<string, PadEvent>;
    publish: (coord: string, type: PadEventType, payload?: any) => PadEvent;
    getLastFor: (coord: string) => PadEvent | undefined;
};

export const usePadEventsStore = create<PadEventsStore>((set, get) => ({
    seq: 0,
    lastByCoord: new Map(),
    publish: (coord, type, payload) => {
        const id = get().seq + 1;
        const evt: PadEvent = {
            id,
            coord: coord.toUpperCase(),
            type,
            payload,
            ts: typeof performance !== "undefined" ? performance.now() : Date.now(),
        };
        set((state) => {
            const map = new Map(state.lastByCoord);
            map.set(evt.coord, evt);
            return { seq: id, lastByCoord: map };
        });
        return evt;
    },
    getLastFor: (coord) => get().lastByCoord.get(coord.toUpperCase()),
}));

export function publishPadEvent(coord: string, type: PadEventType, payload?: any) {
    return usePadEventsStore.getState().publish(coord, type, payload);
}

export function subscribePadEvents(coord: string, cb: (e: PadEvent) => void) {
    const store = usePadEventsStore;
    const key = coord.toUpperCase();
    let lastId = store.getState().getLastFor(key)?.id ?? 0;

    return store.subscribe((s) => {
        const id = s.lastByCoord.get(key)?.id ?? 0;
        if (!id || id === lastId) return;
        lastId = id;
        const evt = store.getState().getLastFor(key);
        if (evt) cb(evt);
    });
}