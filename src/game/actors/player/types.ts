import type { MutableRefObject } from "react";
import type { Group, Object3D, Vector3, PositionalAudio as ThreePositionalAudio } from "three";

// Stati verticali del player
export type VState = "idle" | "ascend" | "descend";

// Tipi di movimento in corso
export type MoveKind = "none" | "side" | "vertical";

// Direzione laterale
export type SideDir = -1 | 1;

// Helper di griglia esposti dal controller Grid
export interface GridHelpers {
// Metadati griglia
rows: string[];
colStart: number;
colEnd: number;
rowsCount: number;
colsCount: number;
tileSize: number;

// Utility coordinate
toCoord: (rowIndex: number, colIndex: number) => string;
computeWorld: (rowIndex: number, colIndex: number) => Vector3;

// Query su pad/limiti
isPadAt: (rowIndex: number, colIndex: number) => boolean;
canMoveTo: (rowIndex: number, colIndex: number) => boolean;

// Spawn iniziale (row/col indicizzati 0-based)
getSpawn: () => { row: number; col: number };
}

// Tick context per il rimbalzo (bounce)
export interface BounceTickContext {
isIdle: boolean;
isMoving: boolean;
moveKind: MoveKind;
}

// Controller del rimbalzo della palla
export interface BounceController {
attach: (ballRef: MutableRefObject<Object3D | null>) => void;
start: () => void;
pause: () => void;
resumeFromGround: () => void;
ensureIfIdle: (ctx: BounceTickContext) => void;
queueGroundAction: (fn: () => void) => void;
onGroundTouch: (cb: () => void) => void;
tick: (dt: number, ctx: BounceTickContext) => void;
}

// Callback chiamata quando il movimento raggiunge la cella target
export type MovementArrivedCallback = () => void;

// Controller del movimento (tra celle, wall-bounce, velocità)
export interface MovementController {
attach: (
groupRef: MutableRefObject<Group | null>,
ballRef: MutableRefObject<Object3D | null>,
wallAudioRef: MutableRefObject<ThreePositionalAudio | null>
) => void;

// Stato verticale (setter/getter)
setVState: (next: VState) => void;
getVState: () => VState;

// Posizionamento griglia (impostazione iniziale)
setGridPosition: (rowIndex: number, colIndex: number) => void;

// Query sullo stato di movimento
isMoving: () => boolean;
getMoveKind: () => MoveKind;

// Azioni di movimento
tryMoveSide: (dir: SideDir) => void;
tryAscend: () => void;
tryDescend: () => void;
performWallBounce: (dir: SideDir) => void;

// Tick per avanzare l’animazione/movimento
tick: (dt: number) => void;

// Notifica arrivo a destinazione
onArrived: (cb: MovementArrivedCallback) => void;
}

// Stato input raw
export interface InputState {
left: boolean;
right: boolean;
up: boolean;
down: boolean;
}

// Controller dell’input (tastiera, pending side)
export interface InputController {
bind: () => void;
unbind: () => void;

// Riferimenti mutabili allo stato input e alla coda laterale in aria
stateRef: MutableRefObject<InputState>;
pendingSideRef: MutableRefObject<0 | SideDir>;

// Consumo dei comandi frame-by-frame
consumeImmediateLeftRight: () => SideDir | 0; // consuma e ritorna -1 | 1 | 0
consumeUp: () => boolean;                      // consuma up
consumeDown: () => boolean;                    // consuma down

// Accoda un comando laterale quando possibile
queueSide: (dir: SideDir) => void;
}

// Ref utili del player
export interface PlayerRefs {
groupRef: MutableRefObject<Group | null>;
ballRef: MutableRefObject<Object3D | null>;
wallAudioRef: MutableRefObject<ThreePositionalAudio | null>;
}