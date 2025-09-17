import { useRef } from "react";
import { Group, Object3D, Vector3, PositionalAudio as ThreePositionalAudio } from "three";
import {
    BALL_MIN_Y,
    BALL_MAX_Y,
    DEFAULT_STEP_DURATION,
    EPS_POS,
    SIDE_MOVE_DURATION_SEC,
    WALL_AUDIO_DISTANCE,
    WALL_AUDIO_RATE_MAX,
    WALL_AUDIO_RATE_MIN,
    WALL_BOUNCE_TOTAL_FACTOR,
} from "../constant.ts";
import type {
    GridHelpers,
    MovementArrivedCallback,
    MovementController,
    SideDir,
    VState,
} from "../types";

type WallBounceState = {
    active: boolean;
    start: Vector3;
    dir: SideDir;
    total: number; // lunghezza totale (andata+ritorno)
    traveled: number; // percorso cumulativo
    impactPlayed: boolean;
};

export function useMovement(grid: GridHelpers): MovementController {
    // Refs scena
    const groupRef = useRef<Group | null>(null);
    const ballRef = useRef<Object3D | null>(null);
    const wallAudioRef = useRef<ThreePositionalAudio | null>(null);

    // Stato griglia
    const rowIndexRef = useRef(0);
    const colIndexRef = useRef(0);

    // Stato verticale e movimento
    const vStateRef = useRef<VState>("descend");
    const movingRef = useRef(false);
    const moveKindRef = useRef<"none" | "side" | "vertical">("none");
    const targetWorldRef = useRef<Vector3>(new Vector3());
    const moveInitialDistRef = useRef(1);
    const currentSpeedRef = useRef(1);

    // Callback arrivo (invocata al termine di uno spostamento tra celle)
    const arrivalCallbackRef = useRef<MovementArrivedCallback | undefined>(undefined);

    // Wall bounce
    const wallBounceRef = useRef<WallBounceState>({
        active: false,
        start: new Vector3(),
        dir: 1,
        total: 0,
        traveled: 0,
        impactPlayed: false,
    });

    function attach(
        group: React.MutableRefObject<Group | null>,
        ball: React.MutableRefObject<Object3D | null>,
        wallAudio: React.MutableRefObject<ThreePositionalAudio | null>
    ) {
        groupRef.current = group.current;
        ballRef.current = ball.current;
        wallAudioRef.current = wallAudio.current;
    }

    function setVState(next: VState) {
        vStateRef.current = next;
    }

    function getVState(): VState {
        return vStateRef.current;
    }

    function isMoving() {
        return movingRef.current;
    }

    function getMoveKind() {
        return moveKindRef.current;
    }

    function setGridPosition(rowIndex: number, colIndex: number) {
        // Clamp e applica
        const r = Math.max(0, Math.min(grid.rowsCount - 1, rowIndex));
        const c = Math.max(0, Math.min(grid.colsCount - 1, colIndex));
        rowIndexRef.current = r;
        colIndexRef.current = c;

        const start = grid.computeWorld(r, c);
        targetWorldRef.current.copy(start);
        if (groupRef.current) groupRef.current.position.copy(start);
    }

    function onArrived(cb: MovementArrivedCallback) {
        arrivalCallbackRef.current = cb;
    }

    function setTargetAndSpeed(toRow: number, toCol: number) {
        const tw = grid.computeWorld(toRow, toCol);
        targetWorldRef.current.copy(tw);

        let dist = 1;
        if (groupRef.current) dist = groupRef.current.position.distanceTo(tw);
        moveInitialDistRef.current = dist;

        if (moveKindRef.current === "side") {
            const duration = SIDE_MOVE_DURATION_SEC;
            currentSpeedRef.current = dist / duration;
            if (ballRef.current) ballRef.current.position.y = BALL_MIN_Y;
        } else {
            const verticalSpeed = grid.tileSize / DEFAULT_STEP_DURATION;
            currentSpeedRef.current = verticalSpeed;
        }

        movingRef.current = true;
    }

    function finishArrive() {
        const cb = arrivalCallbackRef.current;
        arrivalCallbackRef.current = undefined;

        // Riporta Y palla a min per sicurezza
        if (moveKindRef.current === "side" && ballRef.current) {
            ballRef.current.position.y = BALL_MIN_Y;
        }

        moveKindRef.current = "none";
        movingRef.current = false;

        if (cb) cb();
    }

    function tryMoveSide(dir: SideDir) {
        if (movingRef.current) return;
        if (vStateRef.current === "descend") return;

        const r = rowIndexRef.current;
        const toCol = colIndexRef.current + dir;

        if (!grid.canMoveTo(r, toCol)) {
            performWallBounce(dir);
            return;
        }

        moveKindRef.current = "side";

        const fromState = vStateRef.current;

        // Aggiorna indici logici subito (come nel codice originale) e muovi
        colIndexRef.current = toCol;
        setTargetAndSpeed(r, toCol);

        // Al termine, aggiorna lo stato verticale in base al pad presente
        onArrived(() => {
            const hasPadHere = grid.isPadAt(r, toCol);
            if (fromState === "ascend") {
                if (hasPadHere) setVState("idle");
                else setVState("ascend");
            } else {
                if (hasPadHere) setVState("idle");
                else setVState("descend");
            }
        });
    }

    function tryAscend() {
        if (movingRef.current) return;

        const toRow = rowIndexRef.current + 1;
        const c = colIndexRef.current;

        if (!grid.canMoveTo(toRow, c) || grid.isPadAt(toRow, c)) {
            setVState("descend");
            return;
        }

        moveKindRef.current = "vertical";
        rowIndexRef.current = toRow;
        setTargetAndSpeed(toRow, c);

        onArrived(() => {
            if (vStateRef.current === "ascend") setVState("ascend");
        });
    }

    function tryDescend() {
        if (movingRef.current) return;

        const toRow = rowIndexRef.current - 1;
        const c = colIndexRef.current;

        if (!grid.canMoveTo(toRow, c)) {
            setVState("idle");
            return;
        }

        const hasPadBelow = grid.isPadAt(toRow, c);
        const hasPadHere = grid.isPadAt(rowIndexRef.current, c);

        moveKindRef.current = "vertical";

        if (hasPadBelow) {
            if (hasPadHere) {
                setVState("idle");
                return;
            } else {
                rowIndexRef.current = toRow;
                setTargetAndSpeed(toRow, c);
                onArrived(() => setVState("idle"));
                return;
            }
        }

        rowIndexRef.current = toRow;
        setTargetAndSpeed(toRow, c);
    }

    function performWallBounce(dir: SideDir) {
        if (movingRef.current || !groupRef.current) return;

        // Durante wall-bounce invertiamo ascend -> descend come nell'originale
        if (vStateRef.current === "ascend") {
            setVState("descend");
        }

        const totalLength = grid.tileSize * WALL_BOUNCE_TOTAL_FACTOR;

        const wb = wallBounceRef.current;
        wb.active = true;
        wb.start.copy(groupRef.current.position);
        wb.dir = dir;
        wb.total = totalLength;
        wb.traveled = 0;
        wb.impactPlayed = false;

        moveKindRef.current = "side";
        currentSpeedRef.current = totalLength / SIDE_MOVE_DURATION_SEC;

        movingRef.current = true;
        if (ballRef.current) ballRef.current.position.y = BALL_MIN_Y;
    }

    function tick(dt: number) {
        const group = groupRef.current;
        if (!group) return;

        // Gestione wall-bounce
        if (wallBounceRef.current.active) {
            const wb = wallBounceRef.current;
            const step = currentSpeedRef.current * dt;
            wb.traveled = Math.min(wb.traveled + step, wb.total);

            const progress = wb.traveled / wb.total; // 0..1
            const half = wb.total / 2;

            // distanza dall'estremo: va su e giù un'unica volta
            const distOut = progress <= 0.5 ? progress * wb.total : (1 - progress) * wb.total;
            const offsetX = wb.dir as number * distOut;

            const start = wb.start;
            group.position.set(start.x + offsetX, start.y, start.z);

            // Profilo Y della palla a "salto" singolo
            if (ballRef.current) {
                const y = BALL_MIN_Y + (BALL_MAX_Y - BALL_MIN_Y) * Math.sin(Math.PI * progress);
                ballRef.current.position.y = y;
            }

            // Impatto contro il muro a metà percorso
            if (!wb.impactPlayed && wb.traveled >= half - 1e-6) {
                wb.impactPlayed = true;
                const a = wallAudioRef.current;
                if (a) {
                    try {
                        const rate =
                            WALL_AUDIO_RATE_MIN +
                            Math.random() * (WALL_AUDIO_RATE_MAX - WALL_AUDIO_RATE_MIN);
                        a.setPlaybackRate(rate);
                        a.setRefDistance?.(WALL_AUDIO_DISTANCE);
                        if (a.isPlaying) a.stop();
                        if (a.context.state === "suspended") a.context.resume();
                        a.play();
                    } catch { }
                }
            }

            if (wb.traveled >= wb.total - 1e-6) {
                // termina senza cambiare cella
                wb.active = false;
                movingRef.current = false;
                moveKindRef.current = "none";
                if (ballRef.current) ballRef.current.position.y = BALL_MIN_Y;
            }
            return;
        }

        // Movimento tra celle
        if (movingRef.current) {
            const pos = group.position;
            const dir = targetWorldRef.current.clone().sub(pos);
            const dist = dir.length();

            if (moveKindRef.current === "side" && ballRef.current) {
                const t = 1 - Math.max(0, Math.min(1, dist / Math.max(1e-6, moveInitialDistRef.current)));
                const y = BALL_MIN_Y + (BALL_MAX_Y - BALL_MIN_Y) * Math.sin(Math.PI * t);
                ballRef.current.position.y = y;
            }

            if (dist < EPS_POS) {
                group.position.copy(targetWorldRef.current);
                movingRef.current = false;
                finishArrive();
            } else {
                const step = Math.min(dist, currentSpeedRef.current * dt);
                dir.normalize().multiplyScalar(step);
                pos.add(dir);
            }
        }
    }

    return {
        attach,
        setVState,
        getVState,
        setGridPosition,
        isMoving,
        getMoveKind,
        tryMoveSide,
        tryAscend,
        tryDescend,
        performWallBounce,
        tick,
        onArrived,
    };
}