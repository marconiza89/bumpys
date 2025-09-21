// src/game/actors/MovementController.ts
import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { LevelData } from "@/game/types/LevelTypes";
import { attemptMoveFrom, Direction } from "./movementsLogic";
import { publishPadEvent } from "@/levels/state/padEvents";

export type MovementPhase = "idle" | "jumping";
export type TimingEvent = "bounce" | "middleCell";

export interface MovementController {
    // State
    currentCoord: string;
    phase: MovementPhase;
    pendingInput: Direction | null;
    
    // Timing
    bounceTimer: number;
    bounceInterval: number; // 160 BPM = 375ms per bounce
    lastBounce: number;
    
    // Jump state
    jumpProgress: number;
    isJumping: boolean;
    
    // Callbacks
    onMove: (newCoord: string) => void;
    onBounce: () => void;
    onMiddleCell: () => void;
}

export function useMovementController(
    data: LevelData,
    initialCoord: string,
    onMoveCallback: (coord: string) => void
): MovementController {
    const controllerRef = useRef<MovementController>({
        currentCoord: initialCoord,
        phase: "idle",
        pendingInput: null,
        
        bounceTimer: 0,
        bounceInterval: 60000 / 160, // 160 BPM in milliseconds
        lastBounce: 0,
        
        jumpProgress: 0,
        isJumping: false,
        
        onMove: onMoveCallback,
        onBounce: () => {},
        onMiddleCell: () => {},
    });

    // Input handling
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            const controller = controllerRef.current;
            let dir: Direction | null = null;
            
            if (e.key === "ArrowLeft") dir = "left";
            else if (e.key === "ArrowRight") dir = "right";
            else if (e.key === "ArrowUp") dir = "up";
            else if (e.key === "ArrowDown") dir = "down";
            
            if (dir) {
                // Buffer the input for next timing event
                controller.pendingInput = dir;
                
                // If jumping and input is up, start jump immediately
                if (dir === "up" && controller.phase === "idle") {
                    startJump(controller);
                }
            }
        }

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    // Main timing loop
    useFrame((_, delta) => {
        const controller = controllerRef.current;
        const deltaMs = delta * 1000;
        
        if (controller.phase === "idle") {
            handleIdleBouncing(controller, deltaMs);
        } else if (controller.phase === "jumping") {
            handleJumping(controller, deltaMs);
        }
    });

    return controllerRef.current;
}

function handleIdleBouncing(controller: MovementController, deltaMs: number) {
    controller.bounceTimer += deltaMs;
    
    if (controller.bounceTimer >= controller.bounceInterval) {
        controller.bounceTimer = 0;
        controller.lastBounce = performance.now();
        
        // Trigger bounce event
        onBounce(controller);
        
        // Handle pending lateral movement
        if (controller.pendingInput && 
            (controller.pendingInput === "left" || controller.pendingInput === "right")) {
            handleLateralMovement(controller);
        }
        
        controller.pendingInput = null;
    }
}

function handleJumping(controller: MovementController, deltaMs: number) {
    // Jump duration should be sync with bounce interval for smooth movement
    const jumpDuration = controller.bounceInterval;
    const jumpSpeed = 1 / jumpDuration;
    
    controller.jumpProgress += (deltaMs * jumpSpeed);
    
    // Check for middle of jump (50% progress)
    if (controller.jumpProgress >= 0.5 && controller.jumpProgress < 0.5 + jumpSpeed * 16) {
        onMiddleCell(controller);
        
        // Handle pending lateral movement during jump
        if (controller.pendingInput && 
            (controller.pendingInput === "left" || controller.pendingInput === "right")) {
            handleLateralMovement(controller);
        }
    }
    
    // End jump
    if (controller.jumpProgress >= 1) {
        controller.jumpProgress = 0;
        controller.isJumping = false;
        controller.phase = "idle";
        controller.pendingInput = null;
    }
}

function startJump(controller: MovementController) {
    controller.phase = "jumping";
    controller.isJumping = true;
    controller.jumpProgress = 0;
}

function onBounce(controller: MovementController) {
    // Publish bounce event for pad animations
    publishPadEvent(controller.currentCoord, "bounce");
    
    // Call external bounce callback
    controller.onBounce();
}

function onMiddleCell(controller: MovementController) {
    // Call external middle cell callback
    controller.onMiddleCell();
}

function handleLateralMovement(controller: MovementController) {
    if (!controller.pendingInput) return;
    
    const data = getCurrentLevelData(); // You'll need to pass this or get it from context
    const newCoord = attemptMoveFrom(data, controller.currentCoord, controller.pendingInput);
    
    if (newCoord !== controller.currentCoord) {
        controller.currentCoord = newCoord;
        controller.onMove(newCoord);
    }
}

// Helper to get current level data - implement based on your architecture
function getCurrentLevelData(): LevelData {
    // This should return the current level data
    // You might want to pass this as a parameter or get it from a global store
    throw new Error("getCurrentLevelData not implemented");
}