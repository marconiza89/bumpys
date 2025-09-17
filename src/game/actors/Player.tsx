// Player.tsx

import { useEffect, useMemo, useRef, useState } from "react";
import { Group, Mesh, Vector3, PositionalAudio as ThreePositionalAudio } from "three";
import { useFrame } from "@react-three/fiber";
import { LevelData } from "../types/LevelTypes";
import { coordToWorld, expandRows, parseCoord } from "../utils/Grid";
import { publishPadEvent } from "@/levels/state/padEvents";
import { useItemsStore } from "@/levels/state/itemsStore";
import { PositionalAudio } from "@react-three/drei";
import { Bumpy } from "./models/Bumpy";

type PlayerProps = {
    data: LevelData;
};

type VState = "idle" | "ascend" | "descend";

function toCoord(rows: string[], colStart: number, rowIndex: number, colIndex: number): string {
    const rowLetter = rows[rowIndex];
    const colNumber = colStart + colIndex;
    return `${rowLetter}${colNumber}`;
}

export function Player({ data }: PlayerProps) {
    // Grid info
    const rows = useMemo(() => expandRows(data.meta.grid.rows), [data]);
    const [colStart, colEnd] = data.meta.grid.cols;
    const colsCount = colEnd - colStart + 1;
    const rowsCount = rows.length;
    const tileSize = data.meta.grid.tileSize ?? 1;
    const landedFromRef = useRef<VState | null>(null);
    
    const wallBounceRef = useRef<{
        active: boolean;
        start: Vector3;
        dir: -1 | 1;
        total: number;     // lunghezza totale (andata+ritorno)
        traveled: number;  // percorso cumulativo
        impactPlayed: boolean; // NEW: suono impatto già eseguito?
    }>({
        active: false,
        start: new Vector3(),
        dir: 1,
        total: 0,
        traveled: 0,
        impactPlayed: false,
    });

    // Pad lookup
    const padMap = useMemo(() => {
        const m = new Map<string, boolean>();
        for (const r of rows) for (let c = colStart; c <= colEnd; c++) m.set(`${r}${c}`.toUpperCase(), false); // FIX
        for (const c of data.cells) m.set(c.coord.toUpperCase(), c.pad !== "empty");
        return m;
    }, [data, rows, colStart, colEnd]);

    const isPadAt = (rowIndex: number, colIndex: number) => {
        if (rowIndex < 0 || rowIndex >= rowsCount) return false;
        if (colIndex < 0 || colIndex >= colsCount) return false;
        const coord = toCoord(rows, colStart, rowIndex, colIndex);
        return padMap.get(coord.toUpperCase()) === true;
    };

    // Spawn
    const { spawnRow, spawnCol } = useMemo(() => {
        const spawner = data.entities?.find((e) => e.type === "spawner");
        const coord = spawner?.coord ?? `${rows[0]}${colStart}`;
        const { rowLetter, col } = parseCoord(coord);
        return { spawnRow: rows.indexOf(rowLetter), spawnCol: col - colStart };
    }, [data, rows, colStart]);

    // Grid position
    const [rowIndex, setRowIndex] = useState(spawnRow);
    const [colIndex, setColIndex] = useState(spawnCol);

    // Vertical state
    const vStateRef = useRef<VState>("descend");

    const setVState = (s: VState) => {
        const prev = vStateRef.current;
        vStateRef.current = s;

        if (s === "descend") pendingSideRef.current = 0;

        // NEW: memorizza da dove arriviamo quando entriamo in idle
        if (s === "idle") landedFromRef.current = prev;
        else landedFromRef.current = null;

        if (s === "ascend" || s === "descend") {
            pauseBounce();
        } else {
            const suppressResume =
                (prev === "descend" && (inputRef.current.up || inputRef.current.left || inputRef.current.right)) ||
                (prev === "ascend" &&
                    (inputRef.current.left || inputRef.current.right || pendingSideRef.current !== 0));
            if (!suppressResume) ensureBounceIfIdle();
        }
    }

    // Input
    const inputRef = useRef({ left: false, right: false, up: false, down: false });

    // Coda laterale in aria (non durante descend)
    const pendingSideRef = useRef<0 | -1 | 1>(0);
    const queueSide = (dir: -1 | 1) => {
        if (vStateRef.current === "descend") return;
        if (pendingSideRef.current === 0) pendingSideRef.current = dir;
    };

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d"].includes(e.key)) e.preventDefault();

            if (e.key === "ArrowLeft" || e.key === "a") {
                inputRef.current.left = true;
                if (movingRef.current || vStateRef.current !== "idle") queueSide(-1);
            }
            if (e.key === "ArrowRight" || e.key === "d") {
                inputRef.current.right = true;
                if (movingRef.current || vStateRef.current !== "idle") queueSide(1);
            }
            if (e.key === "ArrowUp" || e.key === "w") {
                inputRef.current.up = true;
                // Non permettere di tornare in ascend durante "descend"
            }
            if (e.key === "ArrowDown" || e.key === "s") {
                inputRef.current.down = true;
                if (vStateRef.current === "ascend") setVState("descend");
            }
        };
        const onKeyUp = (e: KeyboardEvent) => {
            if (e.key === "ArrowLeft" || e.key === "a") inputRef.current.left = false;
            if (e.key === "ArrowRight" || e.key === "d") inputRef.current.right = false;
            if (e.key === "ArrowUp" || e.key === "w") inputRef.current.up = false;
            if (e.key === "ArrowDown" || e.key === "s") inputRef.current.down = false;
        };
        window.addEventListener("keydown", onKeyDown, { passive: false });
        window.addEventListener("keyup", onKeyUp, { passive: true });
        return () => {
            window.removeEventListener("keydown", onKeyDown as any);
            window.removeEventListener("keyup", onKeyUp as any);
        };
    }, []);

    // Movimento gruppo
    const groupRef = useRef<Group>(null);
    const targetWorld = useRef<Vector3>(new Vector3());
    const movingRef = useRef(false);

    // Dati movimento
    const moveKindRef = useRef<"none" | "side" | "vertical">("none");
    const moveInitialDistRef = useRef(1);
    const currentSpeedRef = useRef(1);

    // Palla e rimbalzo
    const ballRef = useRef<Mesh>(null);
    const wallAudioRef = useRef<ThreePositionalAudio | null>(null);
    const BOUNCE_BPM = 140;
    const BOUNCE_FREQ = BOUNCE_BPM / 60; // Hz
    const TWO_PI = Math.PI * 2;

    const BALL_MIN_Y = 0.3;
    const BALL_MAX_Y = 0.8;
    const BALL_MID_Y = (BALL_MIN_Y + BALL_MAX_Y) / 2; // 0.55
    const BALL_AMP_Y = (BALL_MAX_Y - BALL_MIN_Y) / 2; // 0.25

    // Durata laterale fissa e indipendente (richiesta)
    const SIDE_MOVE_DURATION_SEC = 0.38;

    // Velocità verticale indipendente
    const DEFAULT_STEP_DURATION = 0.14;
    const verticalSpeed = tileSize / DEFAULT_STEP_DURATION;

    const bounceActiveRef = useRef(false);
    const hasStartedBounceRef = useRef(false);
    const bouncePRef = useRef(0);
    const prevPRef = useRef(0);
    const queuedGroundActionRef = useRef<undefined | (() => void)>(undefined);


    function startBounce() {
        if (bounceActiveRef.current) return;
        hasStartedBounceRef.current = true;
        bounceActiveRef.current = true;
        const y0 = 0.5; // start a metà
        const cosVal = Math.max(-1, Math.min(1, (y0 - BALL_MID_Y) / BALL_AMP_Y));
        const base = Math.acos(cosVal) / TWO_PI;
        const p0Up = 1 - base; // partire salendo
        bouncePRef.current = p0Up;
        prevPRef.current = p0Up;
        if (ballRef.current) ballRef.current.position.y = y0;
    }
    function pauseBounce() {
        bounceActiveRef.current = false;
    }
    function resumeBounceFromGround() {
        if (!hasStartedBounceRef.current) return;
        bounceActiveRef.current = true;
        const p = 0.5001; // subito dopo il touch a terra
        bouncePRef.current = p;
        prevPRef.current = p;
        if (ballRef.current) {
            const y = BALL_MID_Y + BALL_AMP_Y * Math.cos(TWO_PI * p);
            ballRef.current.position.y = y;
        }
    }
    function ensureBounceIfIdle() {
        if (vStateRef.current !== "idle") return;
        if (movingRef.current) return;
        if (!hasStartedBounceRef.current) return;
        if (!bounceActiveRef.current) resumeBounceFromGround();
    }



    function queueGroundAction(action: () => void) {
        if (!bounceActiveRef.current) startBounce();
        queuedGroundActionRef.current = action;
    }

    function onBounceGround() {
        // Pubblica il bounce sul pad corrente quando il rimbalzo tocca terra in idle
        // (è qui che i comandi accodati scatteranno)
        const coord = toCoord(rows, colStart, rowIndex, colIndex);
        publishPadEvent(coord, "bounce");

        if (vStateRef.current === "idle" && queuedGroundActionRef.current) {
            const fn = queuedGroundActionRef.current;
            queuedGroundActionRef.current = undefined;
            fn();
        }
    }

    // World pos
    const BALL_Z = 0.3;
    const computeWorld = (r: number, c: number) => {
        const coord = toCoord(rows, colStart, r, c);
        const [x, y, z] = coordToWorld(data, coord, BALL_Z);
        return new Vector3(x, y, z);
    };

    useEffect(() => {
        const start = computeWorld(rowIndex, colIndex);
        targetWorld.current.copy(start);
        if (groupRef.current) groupRef.current.position.copy(start);
        setVState(isPadAt(rowIndex, colIndex) ? "idle" : "descend");

        // raccogli subito se spawni su un item
        const spawnCoord = toCoord(rows, colStart, rowIndex, colIndex);
        useItemsStore.getState().collectAt(spawnCoord);

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useFrame((_, dt) => {
        // Rimbalzo solo da idle e non durante balzi
        if (bounceActiveRef.current && vStateRef.current === "idle" && !movingRef.current && moveKindRef.current !== "side" && ballRef.current) {
            const prev = bouncePRef.current;
            const p = (prev + BOUNCE_FREQ * dt) % 1;
            bouncePRef.current = p;

            const y = BALL_MID_Y + BALL_AMP_Y * Math.cos(TWO_PI * p);
            ballRef.current.position.y = y;

            let groundHit = false;
            if (prev <= 0.5 && p > 0.5) groundHit = true;
            else if (p < prev) {
                if (prev <= 0.5 || p > 0.5) groundHit = true;
            }
            if (groundHit) onBounceGround();

            prevPRef.current = p;
        }

        // Movimento tra celle
        if (!groupRef.current) return;

        if (wallBounceRef.current.active && groupRef.current) {
            const wb = wallBounceRef.current;

            const step = currentSpeedRef.current * dt;
            wb.traveled = Math.min(wb.traveled + step, wb.total);

            const progress = wb.traveled / wb.total; // 0..1
            const half = wb.total / 2;

            const distOut = progress <= 0.5 ? progress * wb.total : (1 - progress) * wb.total;
            const offsetX = wb.dir * distOut;

            const start = wb.start;
            groupRef.current.position.set(start.x + offsetX, start.y, start.z);

            if (ballRef.current) {
                const y = BALL_MIN_Y + (BALL_MAX_Y - BALL_MIN_Y) * Math.sin(Math.PI * progress);
                ballRef.current.position.y = y;
            }

            // Impatto contro il muro: play a metà percorso (punto di inversione)
            if (!wb.impactPlayed && wb.traveled >= half - 1e-6) {
                wb.impactPlayed = true;
                const a = wallAudioRef.current;
                if (a) {
                    try {
                        a.setPlaybackRate(0.95 + Math.random() * 0.1);
                        if (a.isPlaying) a.stop();
                        if (a.context.state === "suspended") a.context.resume();
                        a.play();
                    } catch { }
                }
            }

            if (wb.traveled >= wb.total - 1e-6) {
                wb.active = false;
                movingRef.current = false;
                moveKindRef.current = "none";
                if (ballRef.current) ballRef.current.position.y = BALL_MIN_Y;

                if (vStateRef.current === "idle") {
                    onBounceGround();
                    resumeBounceFromGround();
                }
                return;
            }
        }



        if (movingRef.current) {
            const pos = groupRef.current.position;
            const dir = targetWorld.current.clone().sub(pos);
            const dist = dir.length();

            // Profilo ad arco del balzo laterale (sempre, sia su pad che in aria)
            if (moveKindRef.current === "side" && ballRef.current) {
                const t = 1 - Math.max(0, Math.min(1, dist / Math.max(1e-6, moveInitialDistRef.current)));
                const y = BALL_MIN_Y + (BALL_MAX_Y - BALL_MIN_Y) * Math.sin(Math.PI * t);
                ballRef.current.position.y = y;
            }

            if (dist < 0.001) {
                groupRef.current.position.copy(targetWorld.current);
                movingRef.current = false;
                onArrived();
            } else {
                const step = Math.min(dist, currentSpeedRef.current * dt);
                dir.normalize().multiplyScalar(step);
                pos.add(dir);
            }
        } else {
            resolveMotion();
        }
    });

    function setGridAndMove(toRow: number, toCol: number, onDone?: () => void) {
        // Clamp
        toRow = Math.max(0, Math.min(rowsCount - 1, toRow));
        toCol = Math.max(0, Math.min(colsCount - 1, toCol));

        setRowIndex(toRow);
        setColIndex(toCol);

        const tw = computeWorld(toRow, toCol);
        targetWorld.current.copy(tw);

        // Distanza iniziale e velocità per questo movimento
        let dist = tileSize;
        if (groupRef.current) dist = groupRef.current.position.distanceTo(tw);
        moveInitialDistRef.current = dist;

        if (moveKindRef.current === "side") {
            // Durata laterale fissa (0.25s a cella)
            const duration = SIDE_MOVE_DURATION_SEC;
            currentSpeedRef.current = dist / duration;
            pauseBounce();
            if (ballRef.current) ballRef.current.position.y = BALL_MIN_Y;
        } else {
            currentSpeedRef.current = verticalSpeed;
        }

        movingRef.current = true;
        arrivalCallbackRef.current = onDone;
    }

    const arrivalCallbackRef = useRef<undefined | (() => void)>(undefined);

    function onArrived() {
        const cb = arrivalCallbackRef.current;
        arrivalCallbackRef.current = undefined;
        if (cb) cb();

        if (moveKindRef.current === "side") {
            if (ballRef.current) ballRef.current.position.y = BALL_MIN_Y;
        }

        // raccogli item nella nuova cella
        const here = toCoord(rows, colStart, rowIndex, colIndex);
        useItemsStore.getState().collectAt(here);

        // NEW: pubblica sempre il touch a terra, ma riprendi il bounce solo se non c'è azione immediata
        if (vStateRef.current === "idle") {
            onBounceGround();
            const suppressResume =
                (landedFromRef.current === "descend" &&
                    (inputRef.current.up || inputRef.current.left || inputRef.current.right)) ||
                (landedFromRef.current === "ascend" &&
                    (inputRef.current.left || inputRef.current.right || pendingSideRef.current !== 0));
            if (!suppressResume) {
                resumeBounceFromGround();
            }
        }

        moveKindRef.current = "none";
    }


    function performWallBounce(dir: -1 | 1) {
        if (!groupRef.current || movingRef.current) return;

        if (vStateRef.current === "ascend") {
            setVState("descend");
        }

        const totalLength = tileSize;

        wallBounceRef.current.active = true;
        wallBounceRef.current.start.copy(groupRef.current.position);
        wallBounceRef.current.dir = dir;
        wallBounceRef.current.total = totalLength;
        wallBounceRef.current.traveled = 0;
        wallBounceRef.current.impactPlayed = false; // reset

        moveKindRef.current = "side";
        currentSpeedRef.current = totalLength / SIDE_MOVE_DURATION_SEC;

        movingRef.current = true;
        pauseBounce();
        if (ballRef.current) ballRef.current.position.y = BALL_MIN_Y;
    }

    function canMoveTo(r: number, c: number) {
        return !(r < 0 || r >= rowsCount || c < 0 || c >= colsCount);
    }
    const canMoveSide = (dir: -1 | 1) => canMoveTo(rowIndex, colIndex + dir);

    function tryMoveSide(dir: -1 | 1) {
        if (movingRef.current) return;
        if (vStateRef.current === "descend") return; // nessun laterale in caduta

        const toCol = colIndex + dir;
        if (!canMoveTo(rowIndex, toCol)) {
            // Effetto muro: unico balzo continuo, metà blocco e ritorno
            performWallBounce(dir);
            return;
        }

        // Sempre balzo laterale, sia su pad (idle) che in aria (ascend)
        moveKindRef.current = "side";

        const fromState = vStateRef.current;
        setGridAndMove(rowIndex, toCol, () => {
            const hasPadHere = isPadAt(rowIndex, toCol);
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
        const upRow = rowIndex + 1;

        if (!canMoveTo(upRow, colIndex) || isPadAt(upRow, colIndex)) {
            setVState("descend");
            return;
        }

        moveKindRef.current = "vertical";
        setGridAndMove(upRow, colIndex, () => {
            if (vStateRef.current === "ascend") setVState("ascend");
        });
    }

    function tryDescend() {
        if (movingRef.current) return;
        const downRow = rowIndex - 1;

        if (!canMoveTo(downRow, colIndex)) {
            setVState("idle");
            return;
        }

        const hasPadBelow = isPadAt(downRow, colIndex);
        const hasPadHere = isPadAt(rowIndex, colIndex);

        moveKindRef.current = "vertical";

        if (hasPadBelow) {
            if (hasPadHere) {
                setVState("idle");
                return;
            } else {
                setGridAndMove(downRow, colIndex, () => setVState("idle"));
                return;
            }
        }

        setGridAndMove(downRow, colIndex);
    }

    function resolveMotion() {
        const state = vStateRef.current;

        // 1) Caduta
        if (state === "descend") {
            inputRef.current.left = false;
            inputRef.current.right = false;
            pendingSideRef.current = 0;
            tryDescend();
            return;
        }

        // 2) Eventuale side accodato (già esistente)
        if (pendingSideRef.current !== 0) {
            const dir = pendingSideRef.current as -1 | 1;
            pendingSideRef.current = 0;

            if (state === "idle") {
                const coord = toCoord(rows, colStart, rowIndex, colIndex);
                publishPadEvent(coord, "tilt", { dir });

                if (canMoveSide(dir)) {
                    tryMoveSide(dir);
                } else {
                    performWallBounce(dir);
                }
                return;
            }

            if (canMoveSide(dir)) {
                tryMoveSide(dir);
            } else {
                performWallBounce(dir);
            }
            return;
        }

        // NEW 2.5) Azioni immediate al primo frame dopo l'atterraggio in idle
        if (state === "idle" && landedFromRef.current) {
            const from = landedFromRef.current;

            // Caso 1: arrivo da descend e su è premuto -> trampolino immediato
            if (from === "descend" && inputRef.current.up) {
                inputRef.current.up = false;
                const coord = toCoord(rows, colStart, rowIndex, colIndex);
                publishPadEvent(coord, "trampoline");
                setVState("ascend");
                tryAscend();
                landedFromRef.current = null;
                return;
            }

            // Caso 1.5: arrivo da descend e sinistra/destra premuto -> side immediato
            if (from === "descend" && (inputRef.current.left || inputRef.current.right)) {
                const dir: -1 | 1 = inputRef.current.left ? -1 : 1;

                // pulizia input per evitare doppie esecuzioni
                if (dir === -1) inputRef.current.left = false;
                if (dir === 1) inputRef.current.right = false;
                pendingSideRef.current = 0;

                const coord = toCoord(rows, colStart, rowIndex, colIndex);
                publishPadEvent(coord, "tilt", { dir });
                tryMoveSide(dir);
                landedFromRef.current = null;
                return;
            }

            // Caso 2: arrivo da ascend e sinistra/destra premuto -> side immediato
            if (
                from === "ascend" &&
                (inputRef.current.left || inputRef.current.right || pendingSideRef.current !== 0)
            ) {
                const dir: -1 | 1 =
                    inputRef.current.left ? -1 : inputRef.current.right ? 1 : (pendingSideRef.current as -1 | 1) || 1;

                // pulizia input per evitare doppie esecuzioni
                if (dir === -1) inputRef.current.left = false;
                if (dir === 1) inputRef.current.right = false;
                pendingSideRef.current = 0;

                const coord = toCoord(rows, colStart, rowIndex, colIndex);
                publishPadEvent(coord, "tilt", { dir });
                tryMoveSide(dir);
                landedFromRef.current = null;
                return;
            }

            // nessuna azione immediata, reset flag
            landedFromRef.current = null;
        }

        // 3) Laterale live (come prima)
        if (inputRef.current.left) {
            inputRef.current.left = false;
            if (state === "idle") {
                queueGroundAction(() => {
                    const coord = toCoord(rows, colStart, rowIndex, colIndex);
                    publishPadEvent(coord, "tilt", { dir: -1 });
                    tryMoveSide(-1);
                });
            } else {
                tryMoveSide(-1);
            }
            return;
        }
        if (inputRef.current.right) {
            inputRef.current.right = false;
            if (state === "idle") {
                queueGroundAction(() => {
                    const coord = toCoord(rows, colStart, rowIndex, colIndex);
                    publishPadEvent(coord, "tilt", { dir: 1 });
                    tryMoveSide(1);
                });
            } else {
                tryMoveSide(1);
            }
            return;
        }

        // 4) Verticale (come prima)
        if (state === "ascend") {
            if (inputRef.current.down) {
                inputRef.current.down = false;
                setVState("descend");
                return;
            }
            tryAscend();
            return;
        }

        // 5) Idle: comandi accodati (come prima)
        if (inputRef.current.down) {
            inputRef.current.down = false;
            queueGroundAction(() => setVState("descend"));
            return;
        }
        if (inputRef.current.up) {
            inputRef.current.up = false;
            queueGroundAction(() => {
                const coord = toCoord(rows, colStart, rowIndex, colIndex);
                publishPadEvent(coord, "trampoline");
                setVState("ascend");
                tryAscend();
            });
            return;
        }
    }



    return (
        <group ref={groupRef} name="Player">
            <PositionalAudio
                ref={wallAudioRef}
                url="/sounds/wall.wav"
                distance={4}
                loop={false}
                autoplay={false}

            />
            <group ref={ballRef} position={[0, 0.5, -0.25]} castShadow>
                <Bumpy />
            </group>

            <mesh position={[0, 0.09, -0.25]} rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[0.22, 16]} />
                <meshBasicMaterial color="#000000" transparent opacity={0.25} />
            </mesh>
        </group>
    );
}