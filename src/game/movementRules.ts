// levels/rules/movementRules.ts
// Carica i JSON via fetch dal public e calcola le regole di entrata/uscita.

import { LevelData } from "@/game/types/LevelTypes";
import { cellsMap } from "@/game/utils/Grid";

type RawStringMap = Record<string, string>;

type RawPadAction = {
    default: RawStringMap;
    pads: Record<string, RawStringMap>;
};

type RawBrickAction = {
    default: RawStringMap;
    bricks: Record<string, RawStringMap>;
};

type PadAction = {
    IdleBounce: boolean;
    BottomEntry: boolean;
    BottomExit: boolean;
    TopEntry: boolean;
    TopExit: boolean;
    BounceTopDamage: boolean;
    BounceBotDamage: boolean;
    LeftRebounce: boolean;
    LeftRebounceStrong: number;
    RightRebounce: boolean;
    RightRebounceStrong: number;
    TopRebouncer: boolean;
    LeftShoot: boolean;
    RightShoot: boolean;
    Consumable: boolean;
    ConsumableBounce: number;
    IcePad: boolean;
    ShadowPad: boolean;
};

type BrickAction = {
    FromLeftEntry: boolean;
    LeftExit: boolean;
    FromRightEntry: boolean;
    RightExit: boolean;
    CountDown: boolean;
    CountDownTime: number;
    FromLeftEntryDamage: boolean;
    LeftExitDamage: boolean;
};

export type EntryActions = {
    fromTop: boolean;
    fromBottom: boolean;
    fromLeft: boolean;
    fromRight: boolean;
};

export type ExitActions = {
    toTop: boolean;
    toBottom: boolean;
    toLeft: boolean;
    toRight: boolean;
};

let PAD_JSON: RawPadAction | null = null;
let BRICK_JSON: RawBrickAction | null = null;
let initPromise: Promise<void> | null = null;

function toBool(v: string | undefined, fallback = false): boolean {
    if (v === undefined) return fallback;
    return v === "true";
}

function toNum(v: string | undefined, fallback = 0): number {
    if (v === undefined) return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}

function fallbackPadJson(): RawPadAction {
    return {
        default: {
            IdleBounce: "true",
            BottomEntry: "false",
            BottomExit: "false",
            TopEntry: "true",
            TopExit: "true",
            BounceTopDamage: "false",
            BounceBotDamage: "false",
            LeftRebounce: "false",
            LeftRebounceStrong: "0",
            RightRebounce: "false",
            RightRebounceStrong: "0",
            TopRebouncer: "false",
            LeftShoot: "false",
            RightShoot: "false",
            Consumable: "false",
            ConsumableBounce: "3",
            IcePad: "false",
            ShadowPad: "false",
        },
        pads: {
            normal: {},
            rbouncer: { RightRebounce: "true", RightRebounceStrong: "1" },
            lbouncer: { LeftRebounce: "true", LeftRebounceStrong: "1" },
            rtrampoline: { RightRebounce: "true", RightRebounceStrong: "2", TopRebouncer: "true" },
            ltrampoline: { LeftRebounce: "true", LeftRebounceStrong: "2", TopRebouncer: "true" },
            ice: { IcePad: "true" },
            green1: { Consumable: "true", ConsumableBounce: "1" },
            green2: { Consumable: "true", ConsumableBounce: "2" },
            toptrap: { BounceTopDamage: "true" },
            updoor: { BottomEntry: "true" },
            downdoor: { BottomExit: "true" },
        },
    };
}

function fallbackBrickJson(): RawBrickAction {
    return {
        default: {
            FromLeftEntry: "true",
            LeftExit: "true",
            FromRightEntry: "true",
            RightExit: "true",
            CountDown: "false",
            CountDownTime: "3",
            FromLeftEntryDamage: "false",
            LeftExitDamage: "false",
        },
        bricks: {
            empty: {},
            rdoor: { FromLeftEntry: "false" },
            ldoor: { LeftExit: "false" },
            countdown: { CountDown: "true", CountDownTime: "3" },
            rdoorD: { FromLeftEntryDamage: "true" },
            ldoorD: { LeftExitDamage: "true" },
        },
    };
}

async function fetchJson<T>(url: string): Promise<T> {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) throw new Error(`Fetch fallito: ${url} (${res.status})`);
    return res.json();
}

export async function initMovementRules(options?: {
    padUrl?: string;
    brickUrl?: string;
    padData?: RawPadAction;
    brickData?: RawBrickAction;
}): Promise<void> {
    if (PAD_JSON && BRICK_JSON) return; // già inizializzate
    if (initPromise) return initPromise;

    initPromise = (async () => {
        try {
            if (options?.padData) {
                PAD_JSON = options.padData;
            } else {
                const url = options?.padUrl ?? "/levels/pads/padAction.json";
                PAD_JSON = await fetchJson<RawPadAction>(url);
            }
        } catch (e) {
            console.warn("padAction.json non caricato, uso fallback interno", e);
            PAD_JSON = fallbackPadJson();
        }

        try {
            if (options?.brickData) {
                BRICK_JSON = options.brickData;
            } else {
                const url = options?.brickUrl ?? "/levels/pads/brickAction.json";
                BRICK_JSON = await fetchJson<RawBrickAction>(url);
            }
        } catch (e) {
            console.warn("brickAction.json non caricato, uso fallback interno", e);
            BRICK_JSON = fallbackBrickJson();
        }
    })();

    return initPromise;
}

function buildPadAction(pad: string): PadAction {
    const raw = PAD_JSON ?? fallbackPadJson();
    const merged: RawStringMap = { ...raw.default, ...(raw.pads[pad] || {}) };
    return {
        IdleBounce: toBool(merged.IdleBounce, true),
        BottomEntry: toBool(merged.BottomEntry, false),
        BottomExit: toBool(merged.BottomExit, false),
        TopEntry: toBool(merged.TopEntry, true),
        TopExit: toBool(merged.TopExit, true),
        BounceTopDamage: toBool(merged.BounceTopDamage, false),
        BounceBotDamage: toBool(merged.BounceBotDamage, false),
        LeftRebounce: toBool(merged.LeftRebounce, false),
        LeftRebounceStrong: toNum(merged.LeftRebounceStrong, 0),
        RightRebounce: toBool(merged.RightRebounce, false),
        RightRebounceStrong: toNum(merged.RightRebounceStrong, 0),
        TopRebouncer: toBool(merged.TopRebouncer, false),
        LeftShoot: toBool(merged.LeftShoot, false),
        RightShoot: toBool(merged.RightShoot, false),
        Consumable: toBool(merged.Consumable, false),
        ConsumableBounce: toNum(merged.ConsumableBounce, 3),
        IcePad: toBool(merged.IcePad, false),
        ShadowPad: toBool(merged.ShadowPad, false),
    };
}

function  buildBrickAction(brick: string): BrickAction {
    const raw = BRICK_JSON ?? fallbackBrickJson();
    const merged: RawStringMap = { ...raw.default, ...(raw.bricks[brick] || {}) };
    return {
        FromLeftEntry: toBool(merged.FromLeftEntry, true),
        LeftExit: toBool(merged.LeftExit, true),
        FromRightEntry: toBool(merged.FromRightEntry, true),
        RightExit: toBool(merged.RightExit, true),
        CountDown: toBool(merged.CountDown, false),
        CountDownTime: toNum(merged.CountDownTime, 3),
        FromLeftEntryDamage: toBool(merged.FromLeftEntryDamage, false),
        LeftExitDamage: toBool(merged.LeftExitDamage, false),
    };
}

function getCellPadAndBrick(data: LevelData, coord: string): { pad: string; brick: string } {
    const map = cellsMap(data);
    const c = map.get(coord.toUpperCase());
    const pad = String((c?.pad ?? data.defaults.pad) || "normal");
    const brick = String((c?.brick ?? data.defaults.brick) || "empty");
    return { pad, brick };
}

export function getEntryActionsForCell(data: LevelData, coord: string): EntryActions {
    const { pad, brick } = getCellPadAndBrick(data, coord);
    const padRules = buildPadAction(pad);
    const brickRules = buildBrickAction(brick);

    return {
        fromTop: padRules.TopEntry,
        fromBottom: padRules.BottomEntry,
        fromLeft: brickRules.FromLeftEntry,
        fromRight: brickRules.FromRightEntry,
    };
}

export function getExitActionsForCell(data: LevelData, coord: string): ExitActions {
    const { pad, brick } = getCellPadAndBrick(data, coord);
    const padRules = buildPadAction(pad);
    const brickRules = buildBrickAction(brick);

    return {
        toTop: padRules.TopExit,
        toBottom: padRules.BottomExit,
        toLeft: brickRules.LeftExit,
        toRight: brickRules.RightExit,
    };
}

export function hasIdleBounceAtCell(data: LevelData, coord: string): boolean {
const { pad } = getCellPadAndBrick(data, coord);
const padRules = buildPadAction(pad);
return !!padRules.IdleBounce;
}


