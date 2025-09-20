import { useEffect, useMemo, useState, useRef } from "react";
import { LevelData } from "../types/LevelTypes";
import { coordToWorld, expandRows } from "../utils/Grid";
import { Bumpy } from "./models/Bumpy";
import { initMovementRules } from "@/game/movementRules";
import { attemptMoveFrom, resolveGravity, JumpStepResult, stepJump, attemptMoveNoGravity } from "@/game/movementsLogic";
import { useFrame } from "@react-three/fiber";
import { hasIdleBounceAtCell } from "@/game/movementRules"; // <-- nuovo import

type Props = { data: LevelData };

export function Player({ data }: Props) {
const [coord, setCoord] = useState<string | null>(null);
const jumpingRef = useRef(false);
const keysRef = useRef<{ left: boolean; right: boolean; up: boolean; down: boolean }>({
left: false,
right: false,
up: false,
down: false,
});

// Posizione visuale (root del player)
const [visualPos, setVisualPos] = useState<[number, number, number]>([0, 0, 0]);

// Stato animazione XBounce (già introdotto)
const isXBouncingRef = useRef(false);
const xBounceRef = useRef<{
    t: number;
    dur: number;
    start: [number, number, number];
    end: [number, number, number];
    targetCoord: string;
    height: number;
} | null>(null);

// Accumulatore tempo per Idle Bounce
const idleTimeRef = useRef(0);

useEffect(() => {
    initMovementRules({
        padUrl: "/levels/config/padAction.json",
        brickUrl: "/levels/config/brickAction.json",
    });
}, []);

const spawnCoord = useMemo(() => {
    const spawner = (data.entities || []).find((e) => e.type === "spawner");
    return spawner?.coord || null;
}, [data]);

useEffect(() => {
    const fallback = () => {
        const firstRow = expandRows(data.meta.grid.rows)[0];
        const firstCol = data.meta.grid.cols[0];
        return `${firstRow}${firstCol}`;
    };
    const start = spawnCoord || fallback();
    const landed = resolveGravity(data, start);
    setCoord(landed);
    jumpingRef.current = false;
    setVisualPos(coordToWorld(data, landed, 0));
    idleTimeRef.current = 0;
}, [data, spawnCoord]);

const worldPos = useMemo<[number, number, number]>(() => {
    if (!coord) return [0, 0, 0];
    return coordToWorld(data, coord, 0);
}, [data, coord]);

useEffect(() => {
    if (!isXBouncingRef.current) {
        setVisualPos(worldPos);
    }
}, [worldPos]);

function tryStartXBounce(dir: "left" | "right") {
    if (!coord) return;
    if (jumpingRef.current) return;
    if (isXBouncingRef.current) return;

    const to = attemptMoveNoGravity(data, coord, dir);
    if (to === coord) return;

    const start = coordToWorld(data, coord, 0);
    const end = coordToWorld(data, to, 0);
    const tile = data.meta.grid.tileSize;
    const dur = 0.18;
    const height = tile * 0.45;

    xBounceRef.current = {
        t: 0,
        dur,
        start,
        end,
        targetCoord: to,
        height,
    };
    isXBouncingRef.current = true;
    // interrompi eventuale idle oscillation
    idleTimeRef.current = 0;
}

useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
        if (e.key === "ArrowLeft") keysRef.current.left = true;
        if (e.key === "ArrowRight") keysRef.current.right = true;
        if (e.key === "ArrowDown") keysRef.current.down = true;
        if (e.key === "ArrowUp") {
            keysRef.current.up = true;
            if (!jumpingRef.current && !isXBouncingRef.current) {
                jumpingRef.current = true;
            }
        }

        if (!jumpingRef.current && !isXBouncingRef.current && coord) {
            if (e.key === "ArrowLeft") {
                tryStartXBounce("left");
            } else if (e.key === "ArrowRight") {
                tryStartXBounce("right");
            } else if (e.key === "ArrowUp") {
                setCoord((c) => (c ? attemptMoveFrom(data, c, "up") : c));
            } else if (e.key === "ArrowDown") {
                setCoord((c) => (c ? attemptMoveFrom(data, c, "down") : c));
            }
        }
    }
    function onKeyUp(e: KeyboardEvent) {
        if (e.key === "ArrowLeft") keysRef.current.left = false;
        if (e.key === "ArrowRight") keysRef.current.right = false;
        if (e.key === "ArrowDown") keysRef.current.down = false;
        if (e.key === "ArrowUp") keysRef.current.up = false;
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
    };
}, [data, coord]);

useEffect(() => {
    if (!coord) return;
    let raf: number | null = null;
    let acc = 0;
    const STEP_MS = 120;

    const loop = () => {
        raf = requestAnimationFrame(loop);
        acc += 16;
        if (!jumpingRef.current) {
            acc = 0;
            return;
        }
        if (acc < STEP_MS) return;
        acc = 0;

        if (isXBouncingRef.current) {
            jumpingRef.current = false;
            return;
        }

        setCoord((c) => {
            if (!c) return c;
            const res: JumpStepResult = stepJump(data, c, keysRef.current);
            if (res.continue) {
                return res.coord;
            } else {
                jumpingRef.current = false;
                const landed = resolveGravity(data, res.coord);
                return landed;
            }
        });
    };

    raf = requestAnimationFrame(loop);
    return () => {
        if (raf) cancelAnimationFrame(raf);
    };
}, [data, coord]);

useFrame((_, delta) => {
    // XBounce attiva: aggiorna traiettoria ad arco e termina con gravità (come già implementato)
    if (isXBouncingRef.current && xBounceRef.current) {
        const anim = xBounceRef.current;
        anim.t += delta / anim.dur;
        const t = Math.min(anim.t, 1);

        const x = anim.start[0] + (anim.end[0] - anim.start[0]) * t;
        const z = anim.start[2] + (anim.end[2] - anim.start[2]) * t;
        const baseY = anim.start[1] + (anim.end[1] - anim.start[1]) * t;
        const offsetY = anim.height * Math.sin(Math.PI * t);
        const y = baseY + offsetY;

        setVisualPos([x, y, z]);

        if (t >= 1) {
            const target = anim.targetCoord;
            isXBouncingRef.current = false;
            xBounceRef.current = null;
            setCoord((c) => resolveGravity(data, target));
            idleTimeRef.current = 0; // reset oscillazione per nuovo pad
        }
        return;
    }

    // Idle Bounce: attivo solo se fermo, nessun tasto e pad con IdleBounce
    const anyKey =
        keysRef.current.left || keysRef.current.right || keysRef.current.up || keysRef.current.down;

    if (
        coord &&
        !jumpingRef.current &&
        !anyKey &&
        hasIdleBounceAtCell(data, coord)
    ) {
        idleTimeRef.current += delta;
        const tile = data.meta.grid.tileSize;
        const amp = tile * 0.68;           // ampiezza del rimbalzo
        const speedHz = 2.0;               // 2 rimbalzi al secondo
        // offset 0..amp: (1 - cos(omega t)) / 2
        const yOff = amp * 0.2 * (1 - Math.cos(2 * Math.PI * speedHz * idleTimeRef.current));

        setVisualPos([worldPos[0], worldPos[1] + yOff, worldPos[2]]);
    } else {
        // niente idle bounce: riporta alla base
        if (!isXBouncingRef.current) {
            setVisualPos(worldPos);
        }
        idleTimeRef.current = 0;
    }
});

return (
    <group name="Player" position={visualPos}>
        <group position={[0, 0.3, 0]} castShadow>
            <Bumpy />
        </group>
        <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.22, 16]} />
            <meshBasicMaterial color="#000" transparent opacity={0.25} />
        </mesh>
    </group>
);
}