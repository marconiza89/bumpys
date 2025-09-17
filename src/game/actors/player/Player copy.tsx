"use client";

import { useEffect, useMemo, useRef } from "react";
import { Group, Object3D, Vector3, PositionalAudio as ThreePositionalAudio } from "three";
import { useFrame } from "@react-three/fiber";

import { LevelData } from "../../types/LevelTypes";
import { useItemsStore } from "@/levels/state/itemsStore";
import { publishPadEvent } from "@/levels/state/padEvents";

import { usePlayerGrid } from "./hooks/usePlayerGrid";
import { usePlayerInput } from "./hooks/usePlayerImput";
import { useBounce } from "./hooks/useBounce";
import { useMovement } from "./hooks/useMovements";

import { PlayerVisuals } from "./components/PlayerVisual";
import { PlayerAudio } from "./components/PlayerAudio";

import type { SideDir } from "./types";

type PlayerProps = { data: LevelData };

export function Player({ data }: PlayerProps) {
    // Helpers griglia
    const grid = usePlayerGrid(data);

    // Controller
    const input = usePlayerInput();
    const bounce = useBounce();
    const movement = useMovement(grid);

    // Refs scena
    const groupRef = useRef<Group | null>(null);
    const ballRef = useRef<Object3D | null>(null);
    const wallAudioRef = useRef<ThreePositionalAudio | null>(null);

    // Azione da eseguire al prossimo "touch a terra" (idle), vedi semantica originale
    const queuedGroundActionRef = useRef<(() => void) | undefined>(undefined);

    // Utilità: coord corrente dal world position del gruppo
    const getCurrentCoord = () => {
        if (!groupRef.current) {
            const { row, col } = grid.getSpawn();
            return grid.toCoord(row, col);
        }
        const pos = groupRef.current.position;
        const tile = grid.tileSize;

        const offsetX = ((grid.colsCount - 1) * tile) / 2;
        const offsetY = ((grid.rowsCount - 1) * tile) / 2;

        const colIndex = Math.max(0, Math.min(grid.colsCount - 1, Math.round((pos.x + offsetX) / tile)));
        const rowIndex = Math.max(0, Math.min(grid.rowsCount - 1, Math.round((pos.y + offsetY) / tile)));

        return grid.toCoord(rowIndex, colIndex);
    };

    // Queue helper locale (manteniamo qui le azioni per preservare l’instant-exec all’arrivo)
    const queueGroundAction = (fn: () => void) => {
        queuedGroundActionRef.current = fn;
        // Attiva il bounce se non è mai partito, per visual feedback immediato
        bounce.start();
    };

    // Setup iniziale
    useEffect(() => {
        // Bind input
        input.bind();

        // Attach refs ai controller
        movement.attach(groupRef, ballRef, wallAudioRef);
        bounce.attach(ballRef);

        // Posizionamento iniziale
        const { row, col } = grid.getSpawn();
        movement.setGridPosition(row, col);

        // Stato verticale iniziale
        movement.setVState(grid.isPadAt(row, col) ? "idle" : "descend");

        // Colleziona l'eventuale item sulla cella di spawn
        const spawnCoord = grid.toCoord(row, col);
        useItemsStore.getState().collectAt(spawnCoord);

        // Bounce: callback su "touch a terra" (idle -> ground)
        bounce.onGroundTouch(() => {
            const coord = getCurrentCoord();
            publishPadEvent(coord, "bounce");
            // Esegui eventuale comando accodato
            const fn = queuedGroundActionRef.current;
            if (fn) {
                queuedGroundActionRef.current = undefined;
                fn();
            }
        });

        // Movimento: callback su arrivo a destinazione
        movement.onArrived(() => {
            const here = getCurrentCoord();
            useItemsStore.getState().collectAt(here);

            // Se siamo idle all'arrivo, comportati come un "touch a terra" immediato
            if (movement.getVState() === "idle") {
                publishPadEvent(here, "bounce");
                bounce.resumeFromGround();
                const fn = queuedGroundActionRef.current;
                if (fn) {
                    queuedGroundActionRef.current = undefined;
                    fn();
                }
            }
        });

        return () => {
            input.unbind();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data]);

    // Helpers movimento lato orchestratore
    const canMoveSideFromPos = (dir: SideDir) => {
        if (!groupRef.current) return false;
        const pos = groupRef.current.position;
        const tile = grid.tileSize;

        const offsetX = ((grid.colsCount - 1) * tile) / 2;
        const offsetY = ((grid.rowsCount - 1) * tile) / 2;

        const c = Math.round((pos.x + offsetX) / tile);
        const r = Math.round((pos.y + offsetY) / tile);

        return grid.canMoveTo(r, c + dir);
    };

    // Risoluzione logica movimenti/stati
    function resolveMotion() {
        const state = movement.getVState();

        // 1) Caduta: nessun laterale, si scende finché possibile
        if (state === "descend") {
            input.stateRef.current.left = false;
            input.stateRef.current.right = false;
            input.pendingSideRef.current = 0;
            movement.tryDescend();
            return;
        }

        // 2) Pending side in aria o in idle
        if (input.pendingSideRef.current !== 0) {
            const dir = input.pendingSideRef.current as SideDir;
            input.pendingSideRef.current = 0;

            if (state === "idle") {
                // Tilt immediato sul pad, poi movimento o wall-bounce
                const coord = getCurrentCoord();
                publishPadEvent(coord, "tilt", { dir });

                if (canMoveSideFromPos(dir)) {
                    movement.tryMoveSide(dir);
                } else {
                    movement.performWallBounce(dir);
                }
                return;
            }

            // Stato "ascend": side immediato o wall bounce
            if (canMoveSideFromPos(dir)) {
                movement.tryMoveSide(dir);
            } else {
                movement.performWallBounce(dir);
            }
            return;
        }

        // 3) Input laterale live
        const liveDir = input.consumeImmediateLeftRight();
        if (liveDir !== 0) {
            if (state === "idle") {
                // Accoda al prossimo touch: tilt + spostamento (o wall-bounce)
                queueGroundAction(() => {
                    const coord = getCurrentCoord();
                    publishPadEvent(coord, "tilt", { dir: liveDir });
                    if (canMoveSideFromPos(liveDir)) {
                        movement.tryMoveSide(liveDir);
                    } else {
                        movement.performWallBounce(liveDir);
                    }
                });
            } else {
                if (canMoveSideFromPos(liveDir)) {
                    movement.tryMoveSide(liveDir);
                } else {
                    movement.performWallBounce(liveDir);
                }
            }
            return;
        }

        // 4) Verticale
        if (state === "ascend") {
            if (input.consumeDown()) {
                movement.setVState("descend");
                return;
            }
            movement.tryAscend();
            return;
        }

        // 5) Idle: comandi accodati al prossimo touch a terra
        if (input.consumeDown()) {
            queueGroundAction(() => movement.setVState("descend"));
            return;
        }
        if (input.consumeUp()) {
            // Trampolino: effetto + set ascend + tentativo immediato
            queueGroundAction(() => {
                const coord = getCurrentCoord();
                publishPadEvent(coord, "trampoline");
                movement.setVState("ascend");
                movement.tryAscend();
            });
            return;
        }
    }

    useFrame((_, dt) => {
        // Bounce in idle
        bounce.tick(dt, {
            isIdle: movement.getVState() === "idle",
            isMoving: movement.isMoving(),
            moveKind: movement.getMoveKind(),
        });

        // Tick movimento
        movement.tick(dt);

        // Aggiorna posizione audio per seguirci (non essendo child del gruppo)
        if (groupRef.current && wallAudioRef.current) {
            wallAudioRef.current.position.copy(groupRef.current.position);
        }

        // Se non si sta muovendo, risolvi la logica di prossima azione
        if (!movement.isMoving()) {
            resolveMotion();
            // Se siamo idle e fermi, assicurati che il bounce sia attivo
            bounce.ensureIfIdle({
                isIdle: movement.getVState() === "idle",
                isMoving: movement.isMoving(),
                moveKind: movement.getMoveKind(),
            });
        }
    });

    return (
        <>
            <PlayerVisuals groupRef={groupRef} ballRef={ballRef} />
            <PlayerAudio ref={wallAudioRef} />
        </>
    );
}