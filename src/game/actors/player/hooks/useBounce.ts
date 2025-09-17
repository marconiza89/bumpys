import { useRef } from "react";
import type { MutableRefObject } from "react";
import type { Object3D } from "three";
import {
BOUNCE_FREQ,
TWO_PI,
BALL_MIN_Y,
BALL_MAX_Y,
BALL_MID_Y,
BALL_AMP_Y,
BOUNCE_START_Y,
BOUNCE_RESUME_P,
} from  "../constant.ts";
import type { BounceController, BounceTickContext } from "../types";

export function useBounce(): BounceController {
const ballRef = useRef<Object3D | null>(null);

const activeRef = useRef(false);
const hasStartedRef = useRef(false);

const phaseRef = useRef(0); // p in [0..1)
const prevPhaseRef = useRef(0);

const queuedGroundActionRef = useRef<(() => void) | undefined>(undefined);
const groundTouchCbRef = useRef<(() => void) | undefined>(undefined);

function attach(ref: MutableRefObject<Object3D | null>) {
ballRef.current = ref.current;
}

function setBallYFromPhase(p: number) {
const n = ballRef.current;
if (!n) return;
const y = BALL_MID_Y + BALL_AMP_Y * Math.cos(TWO_PI * p);
n.position.y = y;
}

function start() {
if (activeRef.current) return;
hasStartedRef.current = true;
activeRef.current = true;

const y0 = BOUNCE_START_Y;
const cosVal = Math.max(-1, Math.min(1, (y0 - BALL_MID_Y) / BALL_AMP_Y));
const base = Math.acos(cosVal) / TWO_PI;
const p0Up = 1 - base; // partire salendo

phaseRef.current = p0Up;
prevPhaseRef.current = p0Up;
setBallYFromPhase(p0Up);
}

function pause() {
activeRef.current = false;
}

function resumeFromGround() {
if (!hasStartedRef.current) return;
activeRef.current = true;
const p = BOUNCE_RESUME_P;
phaseRef.current = p;
prevPhaseRef.current = p;
setBallYFromPhase(p);
}

function ensureIfIdle(ctx: BounceTickContext) {
if (!hasStartedRef.current) return;
if (!ctx.isIdle) return;
if (ctx.isMoving) return;
if (ctx.moveKind === "side") return; // durante il laterale gestiamo Y separatamente
if (!activeRef.current) resumeFromGround();
}

function queueGroundAction(fn: () => void) {
if (!activeRef.current) start();
queuedGroundActionRef.current = fn;
}

function onGroundTouch(cb: () => void) {
groundTouchCbRef.current = cb;
}

function emitGroundTouch() {
// Callback esterna (es. publishPadEvent)
if (groundTouchCbRef.current) {
groundTouchCbRef.current();
}
// Azione accodata al prossimo touch
const fn = queuedGroundActionRef.current;
if (fn) {
queuedGroundActionRef.current = undefined;
fn();
}
}

function detectGroundTouch(prev: number, p: number): boolean {
// Il touch avviene a p = 0.5 (cos = -1)
// Rileviamo il passaggio sopra 0.5 o il wrap-around che lo oltrepassa
if (prev <= 0.5 && p > 0.5) return true;
if (p < prev) {
// wrap
if (prev <= 0.5 || p > 0.5) return true;
}
return false;
}

function tick(dt: number, ctx: BounceTickContext) {
if (!activeRef.current) return;
if (!ctx.isIdle || ctx.isMoving || ctx.moveKind === "side") return;

const prev = phaseRef.current;
const p = (prev + BOUNCE_FREQ * dt) % 1;
phaseRef.current = p;

setBallYFromPhase(p);

if (detectGroundTouch(prev, p)) {
  emitGroundTouch();
}

prevPhaseRef.current = p;
}

return {
attach,
start,
pause,
resumeFromGround,
ensureIfIdle,
queueGroundAction,
onGroundTouch,
tick,
};
}