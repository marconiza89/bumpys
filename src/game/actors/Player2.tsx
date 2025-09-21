import { use, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh } from "three";
import { LevelData } from "../types/LevelTypes";
import { coordToWorld, expandRows, cellsMap } from "../utils/Grid";
import { Bumpy } from "./models/Bumpy";
import { initMovementRules } from "@/game/movementRules";
import { attemptMoveFrom, resolveGravity } from "@/game/movementsLogic";

type Props = { data: LevelData };

// Parametri bounce di base (solo Y, no squash/stretch)
const BOUNCES_PER_MINUTE = 160;
const BOUNCE_PERIOD = 60 / BOUNCES_PER_MINUTE; // secondi
const BASE_Y = 0.5;
const BOUNCE_H = 0.45;

type RawPadAction = {
default: Record<string, string>;
pads: Record<string, Record<string, string>>;
};

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

function toBool(v: string | undefined, fallback = false): boolean {
if (v === undefined) return fallback;
return v === "true";
}

function getPadIdAtCoord(data: LevelData, coord: string): string {
const map = cellsMap(data);
const cell = map.get(coord.toUpperCase());
return String((cell?.pad ?? data.defaults.pad) || "empty");
}

export function Player({ data }: Props) {
const [coord, setCoord] = useState<string | null>(null);

const visualRef = useRef<Group>(null);
const shadowRef = useRef<Mesh>(null);
const offsetRef = useRef<Group>(null); // offset X per animazione laterale

// Config pad per leggere IdleBounce (caricata da JSON, con fallback interno)
const [padConfig, setPadConfig] = useState<RawPadAction | null>(null);
const lastBounceAtRef = useRef<number>(0);
const prevPhaseRef = useRef<number | null>(null); // fase f precedente (0..1) per rilevare il wrap (= touchdown)

// Intent laterale (da tastiera) che parte a padTouchDown
const pendingLateralRef = useRef<"left" | "right" | null>(null);
// Coord "fresh" per gli handler async
const coordRef = useRef<string | null>(null);
useEffect(() => {
    coordRef.current = coord;
}, [coord]);

// Stato dell'animazione laterale
const lateralMoveRef = useRef<{
    start: number;
    duration: number;
    fromCoord: string;
    toCoord: string;
    fromX: number;
    toX: number;
    committed?: boolean;
} | null>(null);

useEffect(() => {
    initMovementRules({
        padUrl: "/levels/config/padAction.json",
        brickUrl: "/levels/config/brickAction.json",
    });
}, []);

useEffect(() => {
    let cancelled = false;
    (async () => {
        try {
            const res = await fetch("/levels/config/padAction.json", { cache: "force-cache" });
            if (!cancelled && res.ok) {
                const json = (await res.json()) as RawPadAction;
                setPadConfig(json);
                return;
            }
        } catch {
            // ignore, fallback below
        }
        if (!cancelled) setPadConfig(fallbackPadJson());
    })();
    return () => {
        cancelled = true;
    };
}, []);

const spawnCoord = useMemo(() => {
    const spawner = (data.entities || []).find((e) => e.type === "spawner");
    return spawner?.coord || null;
}, [data]);

useEffect(() => {
    if (!spawnCoord) {
        const firstRow = expandRows(data.meta.grid.rows)[0];
        const firstCol = data.meta.grid.cols[0];
        setCoord(`${firstRow}${firstCol}`);
        return;
    }
    setCoord(resolveGravity(data, spawnCoord));
}, [data, spawnCoord]);

const worldPos = useMemo<[number, number, number]>(() => {
    if (!coord) return [0, 0, 0];
    return coordToWorld(data, coord, 0);
}, [data, coord]);

// Determina se il pad corrente abilita l'idle bounce
const idleBounceEnabled = useMemo(() => {
    if (!coord) return false;
    const padId = getPadIdAtCoord(data, coord);
    const cfg = padConfig ?? fallbackPadJson();
    const merged = { ...cfg.default, ...(cfg.pads[padId] || {}) };
    return toBool(merged.IdleBounce, true);
}, [data, coord, padConfig]);

// Input: sinistra/destra vengono messi in pending e consumati a padTouchDown.
// Up/Down rimangono immediati.
useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
        if (!coordRef.current) return;

        if (e.key === "ArrowLeft") {
            pendingLateralRef.current = "left";
        } else if (e.key === "ArrowRight") {
            pendingLateralRef.current = "right";
        } else if (e.key === "ArrowUp") {
            setCoord((c) => (c ? attemptMoveFrom(data, c, "up") : c));
        } else if (e.key === "ArrowDown") {
            setCoord((c) => (c ? attemptMoveFrom(data, c, "down") : c));
        }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
}, [data]);

// Debug listener opzionale
useEffect(() => {
    const log = (e: Event) => {
        console.log("padTouchDown", (e as CustomEvent).detail);
    };
    window.addEventListener("padTouchDown", log as EventListener);
    return () => window.removeEventListener("padTouchDown", log as EventListener);
}, []);

// All'evento padTouchDown, se c'è un input laterale pending, avvia animazione X
useEffect(() => {
    function onPadTouchDown() {
        const dir = pendingLateralRef.current;
        const c = coordRef.current;
        if (!dir || !c) return;

        // se già in animazione, ignora
        if (lateralMoveRef.current) {
            pendingLateralRef.current = null;
            return;
        }

        const next = attemptMoveFrom(data, c, dir);
        pendingLateralRef.current = null;

        if (!next || next === c) return; // bloccato

        const from = coordToWorld(data, c, 0);
        const to = coordToWorld(data, next, 0);

        lateralMoveRef.current = {
            start: performance.now(),
            duration: BOUNCE_PERIOD * 1000, // durata = un bounce
            fromCoord: c,
            toCoord: next,
            fromX: from[0],
            toX: to[0],
        };
    }

    window.addEventListener("padTouchDown", onPadTouchDown as EventListener);
    return () => window.removeEventListener("padTouchDown", onPadTouchDown as EventListener);
}, [data]);

// Animazione verticale (bounce) + animazione X laterale
// Emissione evento "padTouchDown" quando la fase f avvolge (1 -> 0) = punto più basso
useFrame(() => {
    const g = visualRef.current;
    const off = offsetRef.current;
    const lm = lateralMoveRef.current;
    if (!g || !off) return;

    // -- Bounce Y --
    if (!idleBounceEnabled) {
        g.position.y = BASE_Y;
        prevPhaseRef.current = null; // resetta il rilevamento touchdown quando il bounce è disabilitato
    } else {
        if (lastBounceAtRef.current === 0) {
            lastBounceAtRef.current = performance.now();
        }
        const now = performance.now();
        const periodMs = BOUNCE_PERIOD * 1000;
        const f = ((now - lastBounceAtRef.current) % periodMs) / periodMs; // 0..1

        // Rilevazione touchdown: wrap della fase (f cala rispetto al frame precedente)
        const prevF = prevPhaseRef.current;
        if (prevF !== null && f < prevF) {
            try {
                setTimeout(() => {
                    window.dispatchEvent(new CustomEvent("padTouchDown", { detail: { coord: coordRef.current } }));
                }, 10);
                
            } catch {
                // no-op
            }
        }
        prevPhaseRef.current = f;

        const hNorm = 4 * f * (1 - f); // parabola 0..1..0
        const h = BOUNCE_H * hNorm;
        g.position.y = BASE_Y + h;
    }

    // -- Animazione laterale X --
    
    if (lm) {
        const now = performance.now();
        const delta = lm.toX - lm.fromX;
        const tRaw = (now - lm.start) / lm.duration;
        const t = Math.min(Math.max(tRaw, 0), 1);



        if (t < 0.7) {
            // smoothstep
            const e = t * t * (3 - 2 * t);
            off.position.x = delta * e;
            
                    
              
             


            
            
        } else {
            // fine animazione
            if (!lm.committed) {
                off.position.x = delta; // mantieni offset pieno
                setCoord(lm.toCoord);
                
                lm.committed = true;
            } else if (coordRef.current === lm.toCoord) {
                // coord base aggiornata: azzera offset e chiudi animazione
                off.position.x = 0;
                lateralMoveRef.current = null;
            } else {
                // in attesa che React applichi coord
                off.position.x = delta;
            }
        }
    } else {
        off.position.x = 0;
    }
});

return (
    <group name="Player" position={worldPos}>
        <group ref={offsetRef} position={[0, 0, 0]}>
            <group ref={visualRef} position={[0, BASE_Y, -0.25]} castShadow>
                <group position={[0, -0.3, 0]}>
                    <Bumpy />
                </group>
            </group>
            <mesh ref={shadowRef} position={[0, 0.09, -0.25]} rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[0.22, 16]} />
                <meshBasicMaterial color="#000000" transparent opacity={0.2} />
            </mesh>
        </group>
    </group>
);
}