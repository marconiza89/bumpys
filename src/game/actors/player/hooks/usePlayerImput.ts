import { useMemo, useRef } from "react";
import { InputController, InputState, SideDir } from "../types";

const CONTROL_KEYS = new Set([
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "w",
    "a",
    "s",
    "d",
]);

export function usePlayerInput(): InputController {
    const stateRef = useRef<InputState>({ left: false, right: false, up: false, down: false });
    const pendingSideRef = useRef<0 | SideDir>(0);
    const boundRef = useRef(false);

    const onKeyDown = useMemo(
        () =>
            (e: KeyboardEvent) => {
                if (CONTROL_KEYS.has(e.key)) e.preventDefault();

                if (e.key === "ArrowLeft" || e.key === "a") {
                    stateRef.current.left = true;
                }
                if (e.key === "ArrowRight" || e.key === "d") {
                    stateRef.current.right = true;
                }
                if (e.key === "ArrowUp" || e.key === "w") {
                    stateRef.current.up = true;
                }
                if (e.key === "ArrowDown" || e.key === "s") {
                    stateRef.current.down = true;
                }
            },
        []
    );

    const onKeyUp = useMemo(
        () =>
            (e: KeyboardEvent) => {
                if (e.key === "ArrowLeft" || e.key === "a") stateRef.current.left = false;
                if (e.key === "ArrowRight" || e.key === "d") stateRef.current.right = false;
                if (e.key === "ArrowUp" || e.key === "w") stateRef.current.up = false;
                if (e.key === "ArrowDown" || e.key === "s") stateRef.current.down = false;
            },
        []
    );

    function bind() {
        if (boundRef.current) return;
        boundRef.current = true;
        window.addEventListener("keydown", onKeyDown, { passive: false });
        window.addEventListener("keyup", onKeyUp, { passive: true });
    }

    function unbind() {
        if (!boundRef.current) return;
        boundRef.current = false;
        window.removeEventListener("keydown", onKeyDown as any);
        window.removeEventListener("keyup", onKeyUp as any);
    }

    function consumeImmediateLeftRight(): SideDir | 0 {
        // Consumo immediato: una volta letto, azzeriamo il flag per evitare repeat continuo
        if (stateRef.current.left) {
            stateRef.current.left = false;
            return -1;
        }
        if (stateRef.current.right) {
            stateRef.current.right = false;
            return 1;
        }
        return 0;
    }

    function consumeUp(): boolean {
        if (stateRef.current.up) {
            stateRef.current.up = false;
            return true;
        }
        return false;
    }

    function consumeDown(): boolean {
        if (stateRef.current.down) {
            stateRef.current.down = false;
            return true;
        }
        return false;
    }

    function queueSide(dir: SideDir) {
        if (pendingSideRef.current === 0) pendingSideRef.current = dir;
    }

    return {
        bind,
        unbind,
        stateRef,
        pendingSideRef,
        consumeImmediateLeftRight,
        consumeUp,
        consumeDown,
        queueSide,
    };
}