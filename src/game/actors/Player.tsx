// Player.tsx

import { useEffect, useMemo, useRef, useState } from "react";
import { Group, Mesh, Vector3, PositionalAudio as ThreePositionalAudio } from "three";
import { useFrame } from "@react-three/fiber";
import { LevelData } from "../types/LevelTypes";
import { coordToWorld, expandRows, parseCoord, cellsMap } from "../utils/Grid";
import { publishPadEvent } from "@/levels/state/padEvents";
import { useItemsStore } from "@/levels/state/itemsStore";
import { PositionalAudio } from "@react-three/drei";
import { Bumpy } from "./models/Bumpy";
import {
    getEntryActionsForCell,
    getExitActionsForCell,
    initMovementRules,
    hasIdleBounceAtCell,

} from "../movementRules";
import {
    resolveGravity,
    attemptMoveFrom,
    stepJump,
    attemptMoveNoGravity,
    Direction
} from "../movementsLogic";
import { useGreenPadsStore } from "@/levels/state/greenPadsStore";

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
    // Initialize movement rules on mount
    useEffect(() => {
        initMovementRules().catch(console.error);
    }, []);

    // Grid info
    const rows = useMemo(() => expandRows(data.meta.grid.rows), [data]);
    const [colStart, colEnd] = data.meta.grid.cols;
    const colsCount = colEnd - colStart + 1;
    const rowsCount = rows.length;
    const tileSize = data.meta.grid.tileSize ?? 1;
    const landedFromRef = useRef<VState | null>(null);
    const [bouncedcount, setBouncedcount] = useState(false);
    const nextBounceCheckRef = useRef(false);

    const wallBounceRef = useRef<{
        active: boolean;
        start: Vector3;
        dir: -1 | 1;
        total: number;
        traveled: number;
        impactPlayed: boolean;
    }>({
        active: false,
        start: new Vector3(),
        dir: 1,
        total: 0,
        traveled: 0,
        impactPlayed: false,
    });

    const ceilingBounceRef = useRef<{
        active: boolean;
        start: Vector3;
        total: number;
        traveled: number;
        impactPlayed: boolean;
    }>({
        active: false,
        start: new Vector3(),
        total: 0,
        traveled: 0,
        impactPlayed: false,
    });

    // Pad lookup with movement rules
    const padMap = useMemo(() => {
        const m = new Map<string, boolean>();
        for (const r of rows) for (let c = colStart; c <= colEnd; c++) m.set(`${r}${c}`.toUpperCase(), false);
        for (const c of data.cells) m.set(c.coord.toUpperCase(), c.pad !== "empty");
        return m;
    }, [data, rows, colStart, colEnd]);
    const isPadAt = (rowIndex: number, colIndex: number) => {
        if (rowIndex < 0 || rowIndex >= rowsCount) return false;
        if (colIndex < 0 || colIndex >= colsCount) return false;
        const coord = toCoord(rows, colStart, rowIndex, colIndex);

        // Check if the pad exists in the map
        const hasPad = padMap.get(coord.toUpperCase()) === true;

        if (!hasPad) return false;

        // Check if it's a green pad that has been consumed
        const cellMap = cellsMap(data);
        const cell = cellMap.get(coord.toUpperCase());
        const padType = cell?.pad ?? data.defaults.pad;

        if (padType === "green1" || padType === "green2" || padType === "green3") {
            const greenPadStore = useGreenPadsStore.getState();
            if (greenPadStore.isPadConsumed(coord)) {
                return false; // Treat consumed green pad as empty
            }
        }

        return true;
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

        if (s === "idle") landedFromRef.current = prev;
        else landedFromRef.current = null;

        if (s === "ascend" || s === "descend") {
            pauseBounce();
        } else {
            const coord = toCoord(rows, colStart, rowIndex, colIndex);
            const hasIdleBounce = hasIdleBounceAtCell(data, coord);

            const suppressResume =
                (prev === "descend" && (inputRef.current.up || inputRef.current.left || inputRef.current.right)) ||
                (prev === "ascend" &&
                    (inputRef.current.left || inputRef.current.right || pendingSideRef.current !== 0));
            if (!suppressResume && hasIdleBounce) ensureBounceIfIdle();
        }
    }

    // Input
    const inputRef = useRef({ left: false, right: false, up: false, down: false });
    const inputBlockedRef = useRef(false); // Block input temporarily for bouncer pads

    // Side queue when in air
    const pendingSideRef = useRef<0 | -1 | 1>(0);
    const queueSide = (dir: -1 | 1) => {
        if (vStateRef.current === "descend") return;
        if (inputBlockedRef.current) return; // Don't queue if input is blocked
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

    // Group movement
    const groupRef = useRef<Group>(null);
    const targetWorld = useRef<Vector3>(new Vector3());
    const movingRef = useRef(false);

    // Movement data
    const moveKindRef = useRef<"none" | "side" | "vertical">("none");
    const moveInitialDistRef = useRef(1);
    const currentSpeedRef = useRef(1);

    // Ball and bounce
    const ballRef = useRef<Mesh>(null);
    const wallAudioRef = useRef<ThreePositionalAudio | null>(null);
    const BOUNCE_BPM = 140;
    const BOUNCE_FREQ = BOUNCE_BPM / 60;
    const TWO_PI = Math.PI * 2;

    const BALL_MIN_Y = 0.3;
    const BALL_MAX_Y = 0.8;
    const BALL_MID_Y = (BALL_MIN_Y + BALL_MAX_Y) / 2;
    const BALL_AMP_Y = (BALL_MAX_Y - BALL_MIN_Y) / 2;

    const SIDE_MOVE_DURATION_SEC = 0.38;
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
        const y0 = 0.5;
        const cosVal = Math.max(-1, Math.min(1, (y0 - BALL_MID_Y) / BALL_AMP_Y));
        const base = Math.acos(cosVal) / TWO_PI;
        const p0Up = 1 - base;
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
        const p = 0.5001;
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
        const coord = toCoord(rows, colStart, rowIndex, colIndex);

        // Check if the pad exists BEFORE publishing the bounce
        const padExistsBeforeBounce = isPadAt(rowIndex, colIndex);

        // Publish the bounce event (normal bounce from above, not a ceiling hit)
        publishPadEvent(coord, "bounce", { fromBelow: false });

        // Check if the pad exists AFTER publishing the bounce
        const padExistsAfterBounce = isPadAt(rowIndex, colIndex);

        // If the pad existed before but not after, it was just consumed
        // Mark that the NEXT bounce should trigger a fall
        if (padExistsBeforeBounce && !padExistsAfterBounce) {
            console.log(`Player: Green pad ${coord} was just consumed, next bounce will trigger fall`);
            // Set a flag that will be checked on the NEXT bounce
            nextBounceCheckRef.current = true;
        } else if (nextBounceCheckRef.current && !padExistsAfterBounce) {
            // This is the bounce AFTER consumption - now we should fall
            console.log(`Player: Bouncing on consumed pad ${coord}, starting fall`);
            nextBounceCheckRef.current = false;
            // Don't interrupt the current bounce animation
            // Queue the fall for when the ball reaches the ground again
            queuedGroundActionRef.current = () => {
                setVState("descend");
                pauseBounce();
            };
        }

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

        // Only collect items on spawn, not green pads
        const spawnCoord = toCoord(rows, colStart, rowIndex, colIndex);
        const cellMap = cellsMap(data);
        const cell = cellMap.get(spawnCoord.toUpperCase());
        const itemType = cell?.item ?? data.defaults.item;

        // Only collect actual items, not trigger green pad consumption
        if (itemType && itemType !== "none") {
            useItemsStore.getState().collectAt(spawnCoord);
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const unsubscribe = useGreenPadsStore.subscribe(() => {
            // Check if we're idle and not moving
            if (vStateRef.current === "idle" && !movingRef.current) {
                const currentRowIndex = rowIndex;
                const currentColIndex = colIndex;
                const currentCoord = toCoord(rows, colStart, currentRowIndex, currentColIndex);

                // Check if current position is a green pad
                const cellMap = cellsMap(data);
                const cell = cellMap.get(currentCoord.toUpperCase());
                const padType = cell?.pad ?? data.defaults.pad;

                if (padType === "green1" || padType === "green2" || padType === "green3") {
                    const greenPadStore = useGreenPadsStore.getState();
                    if (greenPadStore.isPadConsumed(currentCoord)) {
                        console.log(`Player: Green pad ${currentCoord} consumed under player, starting fall`);
                        // setVState("descend");
                        // Force immediate descent check
                        resolveMotion();
                    }
                }
            }
        });

        return () => unsubscribe();
    }, [rowIndex, colIndex, data, rows, colStart]);

    useFrame((_, dt) => {

        if (vStateRef.current === "idle" && !movingRef.current && !bounceActiveRef.current) {
            if (!isPadAt(rowIndex, colIndex)) {
                console.log(`Player: Ground disappeared while idle, starting fall`);
                setVState("descend");
            }
        }
        // Bounce animation only in idle
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

        // Movement between cells
        if (!groupRef.current) return;

        if (wallBounceRef.current.active && groupRef.current) {
            const wb = wallBounceRef.current;

            const step = currentSpeedRef.current * dt;
            wb.traveled = Math.min(wb.traveled + step, wb.total);

            const progress = wb.traveled / wb.total;
            const half = wb.total / 2;

            const distOut = progress <= 0.5 ? progress * wb.total : (1 - progress) * wb.total;
            const offsetX = wb.dir * distOut;

            const start = wb.start;
            groupRef.current.position.set(start.x + offsetX, start.y, start.z);

            if (ballRef.current) {
                const y = BALL_MIN_Y + (BALL_MAX_Y - BALL_MIN_Y) * Math.sin(Math.PI * progress);
                ballRef.current.position.y = y;
            }

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

        if (ceilingBounceRef.current.active && groupRef.current) {
            const vb = ceilingBounceRef.current;

            const step = currentSpeedRef.current * dt;
            vb.traveled = Math.min(vb.traveled + step, vb.total);

            const progress = vb.traveled / vb.total;
            const half = vb.total / 2;

            // Offset verticale: va su fino a metà tile e torna giù
            const distOut = progress <= 0.5 ? progress * vb.total : (1 - progress) * vb.total;
            const offsetY = distOut;

            const start = vb.start;
            groupRef.current.position.set(start.x, start.y + offsetY, start.z);

            // Arco della palla durante il bounce
            if (ballRef.current) {
                const y = BALL_MIN_Y + (BALL_MAX_Y - BALL_MIN_Y) * Math.sin(Math.PI * progress) / 8;
                ballRef.current.position.y = y;
            }

            // Suono d'impatto a metà corsa (punto di inversione)
            if (!vb.impactPlayed && vb.traveled >= half - 1e-6) {
                vb.impactPlayed = true;
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

            if (vb.traveled >= vb.total - 1e-6) {
                vb.active = false;
                movingRef.current = false;
                moveKindRef.current = "none";
                if (ballRef.current) ballRef.current.position.y = BALL_MIN_Y;

                // Solo se siamo idle, riprendi il bounce “idle”
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
        toRow = Math.max(0, Math.min(rowsCount - 1, toRow));
        toCol = Math.max(0, Math.min(colsCount - 1, toCol));

        setRowIndex(toRow);
        setColIndex(toCol);

        const tw = computeWorld(toRow, toCol);
        targetWorld.current.copy(tw);

        let dist = tileSize;
        if (groupRef.current) dist = groupRef.current.position.distanceTo(tw);
        moveInitialDistRef.current = dist;

        if (moveKindRef.current === "side") {
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

    function handleBouncerPad(padType: string, coord: string) {
        // Block input to prevent override
        inputBlockedRef.current = true;
        pendingSideRef.current = 0; // Clear any pending side movement

        // Get bouncer properties from movement rules
        const cellMap = cellsMap(data);
        const cell = cellMap.get(coord.toUpperCase());
        const pad = cell?.pad ?? data.defaults.pad;

        let bounceDir: -1 | 0 | 1 = 0;
        let bounceStrength = 1;

        // Determine bounce based on pad type
        if (pad === "rbouncer") {
            bounceDir = 1; // Right bouncer bounces left
            bounceStrength = 1; // From config: RightRebounceStrong: 1
        } else if (pad === "lbouncer") {
            bounceDir = -1; // Left bouncer bounces right  
            bounceStrength = 1; // From config: LeftRebounceStrong: 1
        } else if (pad === "rtrampoline") {
            bounceDir = 1; // Right trampoline bounces left
            bounceStrength = 2; // From config: RightRebounceStrong: 2
        } else if (pad === "ltrampoline") {
            bounceDir = -1; // Left trampoline bounces right
            bounceStrength = 2; // From config: LeftRebounceStrong: 2
        }

        if (bounceDir === 0) {
            inputBlockedRef.current = false;
            return;
        }

        // Calculate target position based on strength
        let targetCol = colIndex;
        let cellsToMove = bounceStrength;

        // Find the furthest valid position we can bounce to
        for (let i = 1; i <= bounceStrength; i++) {
            const testCol = colIndex + (bounceDir * i);
            if (canMoveTo(rowIndex, testCol)) {
                targetCol = testCol;
                cellsToMove = i;
            } else {
                break; // Hit boundary
            }
        }

        if (targetCol !== colIndex) {
            // Perform the bounce
            moveKindRef.current = "side";
            setGridAndMove(rowIndex, targetCol, () => {
                const bouncedToPad = isPadAt(rowIndex, targetCol);
                if (bouncedToPad) {
                    setVState("idle");
                } else {
                    setVState("descend");
                }
                // Re-enable input after bounce completes
                setTimeout(() => {
                    inputBlockedRef.current = false;
                }, 100);
            });
        } else {
            // Can't bounce - hit wall immediately
            performWallBounce(bounceDir);
            // Re-enable input after wall bounce
            setTimeout(() => {
                inputBlockedRef.current = false;
            }, 300);
        }
    }

function onArrived() {
        const cb = arrivalCallbackRef.current;
        arrivalCallbackRef.current = undefined;
        if (cb) cb();

        if (moveKindRef.current === "side") {
            if (ballRef.current) ballRef.current.position.y = BALL_MIN_Y;
        }

        const here = toCoord(rows, colStart, rowIndex, colIndex);
        useItemsStore.getState().collectAt(here);

        // Check if we landed on a bouncer pad
        const cellMap = cellsMap(data);
        const cell = cellMap.get(here.toUpperCase());
        const padType = cell?.pad ?? data.defaults.pad;

        if (vStateRef.current === "idle" &&
            (padType === "rbouncer" || padType === "lbouncer" ||
                padType === "rtrampoline" || padType === "ltrampoline")) {

            // Immediately handle the bouncer, don't wait
            publishPadEvent(here, "bounce");
            handleBouncerPad(padType, here);

            // Don't resume normal bounce while being bounced
            return;
        }

        if (vStateRef.current === "idle") {
            // Check if up is pressed after a side movement - jump immediately
            if (moveKindRef.current === "side" && inputRef.current.up) {
                inputRef.current.up = false;
                const coord = toCoord(rows, colStart, rowIndex, colIndex);
                publishPadEvent(coord, "trampoline");
                setVState("ascend");
                tryAscend();
                moveKindRef.current = "none";
                return;
            }
            
            onBounceGround();
            const suppressResume =
                (landedFromRef.current === "descend" &&
                    (inputRef.current.up || inputRef.current.left || inputRef.current.right)) ||
                (landedFromRef.current === "ascend" &&
                    (inputRef.current.left || inputRef.current.right || pendingSideRef.current !== 0)) ||
                (moveKindRef.current === "side" && 
                    (inputRef.current.up || inputRef.current.left || inputRef.current.right));
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
        wallBounceRef.current.impactPlayed = false;

        moveKindRef.current = "side";
        currentSpeedRef.current = totalLength / SIDE_MOVE_DURATION_SEC;

        movingRef.current = true;
        pauseBounce();
        if (ballRef.current) ballRef.current.position.y = BALL_MIN_Y;
    }

    function performCeilingBounce() {
        if (!groupRef.current || movingRef.current) return;

        const totalLength = tileSize;

        ceilingBounceRef.current.active = true;
        ceilingBounceRef.current.start.copy(groupRef.current.position);
        ceilingBounceRef.current.total = totalLength;
        ceilingBounceRef.current.traveled = 0;
        ceilingBounceRef.current.impactPlayed = false;

        moveKindRef.current = "vertical";
        currentSpeedRef.current = totalLength / SIDE_MOVE_DURATION_SEC;

        movingRef.current = true;
        pauseBounce();
        if (ballRef.current) ballRef.current.position.y = BALL_MIN_Y;
    }

    function canMoveTo(r: number, c: number) {
        return !(r < 0 || r >= rowsCount || c < 0 || c >= colsCount);
    }

    function canMoveSide(dir: -1 | 1): boolean {
        const fromCoord = toCoord(rows, colStart, rowIndex, colIndex);
        const toCol = colIndex + dir;

        if (!canMoveTo(rowIndex, toCol)) return false;

        const targetCoord = toCoord(rows, colStart, rowIndex, toCol);
        const exitRules = getExitActionsForCell(data, fromCoord);
        const entryRules = getEntryActionsForCell(data, targetCoord);

        if (dir === 1) {
            return exitRules.toRight && entryRules.fromLeft;
        } else {
            return exitRules.toLeft && entryRules.fromRight;
        }
    }

    function tryMoveSide(dir: -1 | 1) {
        if (movingRef.current) return;
        if (vStateRef.current === "descend") return;

        const toCol = colIndex + dir;
        if (!canMoveTo(rowIndex, toCol)) {
            performWallBounce(dir);
            return;
        }

        // Check movement rules
        const fromCoord = toCoord(rows, colStart, rowIndex, colIndex);
        const targetCoord = toCoord(rows, colStart, rowIndex, toCol);

        // Check exit and entry rules
        const exitRules = getExitActionsForCell(data, fromCoord);
        const entryRules = getEntryActionsForCell(data, targetCoord);

        const canExit = dir === 1 ? exitRules.toRight : exitRules.toLeft;
        const canEnter = dir === 1 ? entryRules.fromLeft : entryRules.fromRight;

        if (!canExit || !canEnter) {
            // Movement blocked by rules
            performWallBounce(dir);
            return;
        }

        moveKindRef.current = "side";
        const fromState = vStateRef.current;

        // If we're in ascend state, maintain the jump arc
        if (fromState === "ascend") {
            // Move laterally during jump
            setGridAndMove(rowIndex, toCol, () => {
                const hasPadHere = isPadAt(rowIndex, toCol);
                const currentPadEmpty = !isPadAt(rowIndex, colIndex);

                if (hasPadHere) {
                    // Landing on a solid pad
                    const landingRules = getEntryActionsForCell(data, targetCoord);
                    if (landingRules.fromTop) {
                        setVState("idle");
                    } else {
                        // Can't land on this pad, continue jumping or fall
                        if (currentPadEmpty) {
                            // We were jumping from empty space, now fall
                            setVState("descend");
                        } else {
                            setVState("ascend"); // Continue jumping
                        }
                    }
                } else {
                    // Moved to empty space during jump
                    // If we were already on empty, we should fall
                    // If we jumped from a solid pad, we can continue the arc for one move
                    if (currentPadEmpty) {
                        setVState("descend");
                    } else {
                        // Just moved from solid to empty, continue ascend for this move
                        // But mark that next lateral move should trigger descent
                        setVState("ascend");
                    }
                }
            });
        } else {
            // From idle state - apply gravity after lateral movement
            setGridAndMove(rowIndex, toCol, () => {
                const hasPadHere = isPadAt(rowIndex, toCol);
                if (hasPadHere) {
                    setVState("idle");
                } else {
                    // Start falling after moving to empty space
                    setVState("descend");
                }
            });
        }
    }

    function tryAscend() {
        if (movingRef.current) return;

        const fromCoord = toCoord(rows, colStart, rowIndex, colIndex);
        const jumpResult = stepJump(data, fromCoord, {});

        if (!jumpResult.continue) {
            // Se abbiamo colpito un pad sopra, invia la scossa al pad e fai il ceiling bounce
            let hitCoord: string | null = null;

            if (jumpResult.reason === "pad") {
                hitCoord = jumpResult.coord;
            } else if (jumpResult.reason === "blocked") {
                const upRow = rowIndex + 1;
                if (upRow >= 0 && upRow < rows.length && isPadAt(upRow, colIndex)) {
                    hitCoord = toCoord(rows, colStart, upRow, colIndex);
                }
            }

            if (hitCoord) {
                publishPadEvent(hitCoord, "hitfrombottom");
                performCeilingBounce();
            }

            setVState("descend");
            return;
        }

        // Parse the new coordinate
        const { rowLetter: newRow, col: newCol } = parseCoord(jumpResult.coord);
        const newRowIndex = rows.indexOf(newRow);
        const newColIndex = newCol - colStart;

        moveKindRef.current = "vertical";
        setGridAndMove(newRowIndex, newColIndex, () => {
            if (jumpResult.continue) {
                setVState("ascend");
            } else {
                setVState(jumpResult.reason === "pad" ? "idle" : "descend");
            }
        });
    }

    function tryDescend() {
        if (movingRef.current) return;

        const fromCoord = toCoord(rows, colStart, rowIndex, colIndex);
        const resultCoord = resolveGravity(data, fromCoord);

        if (resultCoord === fromCoord) {
            // Already at the bottom or can't descend
            setVState("idle");
            return;
        }

        // Parse the result coordinate
        const { rowLetter: newRow, col: newCol } = parseCoord(resultCoord);
        const newRowIndex = rows.indexOf(newRow);
        const newColIndex = newCol - colStart;

        moveKindRef.current = "vertical";
        setGridAndMove(newRowIndex, newColIndex, () => {
            const hasPadHere = isPadAt(newRowIndex, newColIndex);
            setVState(hasPadHere ? "idle" : "descend");
        });
    }

    function resolveMotion() {
        const state = vStateRef.current;

        // 1) Fall
        if (state === "descend") {
            inputRef.current.left = false;
            inputRef.current.right = false;
            pendingSideRef.current = 0;
            tryDescend();
            return;
        }

        // Block input processing if bouncer is active
        if (inputBlockedRef.current) {
            return;
        }

        // 2) Pending side movement
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

        // 3) Immediate actions after landing in idle
        if (state === "idle" && landedFromRef.current) {
            const from = landedFromRef.current;

            if (from === "descend" && inputRef.current.up) {
                inputRef.current.up = false;
                const coord = toCoord(rows, colStart, rowIndex, colIndex);
                publishPadEvent(coord, "trampoline");
                setVState("ascend");
                tryAscend();
                landedFromRef.current = null;
                return;
            }

            if (from === "descend" && (inputRef.current.left || inputRef.current.right)) {
                const dir: -1 | 1 = inputRef.current.left ? -1 : 1;

                if (dir === -1) inputRef.current.left = false;
                if (dir === 1) inputRef.current.right = false;
                pendingSideRef.current = 0;

                const coord = toCoord(rows, colStart, rowIndex, colIndex);
                publishPadEvent(coord, "tilt", { dir });
                tryMoveSide(dir);
                landedFromRef.current = null;
                return;
            }

            if (
                from === "ascend" &&
                (inputRef.current.left || inputRef.current.right || pendingSideRef.current !== 0)
            ) {
                const dir: -1 | 1 =
                    inputRef.current.left ? -1 : inputRef.current.right ? 1 : (pendingSideRef.current as -1 | 1) || 1;

                if (dir === -1) inputRef.current.left = false;
                if (dir === 1) inputRef.current.right = false;
                pendingSideRef.current = 0;

                const coord = toCoord(rows, colStart, rowIndex, colIndex);
                publishPadEvent(coord, "tilt", { dir });
                tryMoveSide(dir);
                landedFromRef.current = null;
                return;
            }

            landedFromRef.current = null;
        }

        // 4) Live lateral movement
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

        // 5) Vertical movement
        if (state === "ascend") {
            if (inputRef.current.down) {
                inputRef.current.down = false;
                setVState("descend");
                return;
            }
            tryAscend();
            return;
        }

        // 6) Idle: queued commands
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
                <pointLight color="#ffffff" intensity={2.} position={[0, 0, 1]} distance={3} />
            </group>

            <mesh position={[0, 0.09, -0.25]} rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[0.22, 16]} />
                <meshBasicMaterial color="#000000" transparent opacity={0.25} />
            </mesh>
        </group>
    );
}