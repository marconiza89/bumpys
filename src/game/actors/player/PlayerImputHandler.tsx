// src/game/systems/PlayerInputHandler.ts
import { usePlayerStore } from "@/game/stores/playerState";
import { PlayerMovementSystem } from "./PlayerMovementSystem";

export class PlayerInputHandler {
    private movementSystem: PlayerMovementSystem;
    private keyDownHandler: (e: KeyboardEvent) => void;
    private keyUpHandler: (e: KeyboardEvent) => void;
    
    constructor(movementSystem: PlayerMovementSystem) {
        this.movementSystem = movementSystem;
        
        // Bind event handlers
        this.keyDownHandler = this.onKeyDown.bind(this);
        this.keyUpHandler = this.onKeyUp.bind(this);
    }
    
    public attachEventListeners(): void {
        window.addEventListener("keydown", this.keyDownHandler, { passive: false });
        window.addEventListener("keyup", this.keyUpHandler, { passive: true });
    }
    
    public detachEventListeners(): void {
        window.removeEventListener("keydown", this.keyDownHandler);
        window.removeEventListener("keyup", this.keyUpHandler);
    }
    
    private onKeyDown(e: KeyboardEvent): void {
        if (this.isMovementKey(e.key)) {
            e.preventDefault();
        }
        
        const playerState = usePlayerStore.getState();
        const { verticalState, physics } = playerState;
        
        switch (e.key) {
            case "ArrowLeft":
            case "a":
                playerState.setInput({ left: true });
                this.handleLeftInput(verticalState, physics.moving);
                break;
                
            case "ArrowRight":
            case "d":
                playerState.setInput({ right: true });
                this.handleRightInput(verticalState, physics.moving);
                break;
                
            case "ArrowUp":
            case "w":
                playerState.setInput({ up: true });
                // Up input is handled in resolveMotion
                break;
                
            case "ArrowDown":
            case "s":
                playerState.setInput({ down: true });
                this.handleDownInput(verticalState);
                break;
        }
    }
    
    private onKeyUp(e: KeyboardEvent): void {
        const playerState = usePlayerStore.getState();
        
        switch (e.key) {
            case "ArrowLeft":
            case "a":
                playerState.setInput({ left: false });
                break;
                
            case "ArrowRight":
            case "d":
                playerState.setInput({ right: false });
                break;
                
            case "ArrowUp":
            case "w":
                playerState.setInput({ up: false });
                break;
                
            case "ArrowDown":
            case "s":
                playerState.setInput({ down: false });
                break;
        }
    }
    
    private isMovementKey(key: string): boolean {
        return ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d"].includes(key);
    }
    
    private handleLeftInput(verticalState: string, isMoving: boolean): void {
        if (isMoving || verticalState !== "idle") {
            this.movementSystem.queueSideMovement(-1);
        }
        // Immediate handling is done in resolveMotion for idle state
    }
    
    private handleRightInput(verticalState: string, isMoving: boolean): void {
        if (isMoving || verticalState !== "idle") {
            this.movementSystem.queueSideMovement(1);
        }
        // Immediate handling is done in resolveMotion for idle state
    }
    
    private handleDownInput(verticalState: string): void {
        const playerState = usePlayerStore.getState();
        
        if (verticalState === "ascend") {
            playerState.setVerticalState("descend");
        }
        // Down input in idle state is handled in resolveMotion
    }
    
    public resolveMotion(): boolean {
        const playerState = usePlayerStore.getState();
        const { verticalState, input, physics } = playerState;
        
        // Don't resolve if already moving
        if (physics.moving) return false;
        
        // Handle different vertical states
        switch (verticalState) {
            case "descend":
                // In descent, clear lateral inputs and queue
                playerState.setInput({ left: false, right: false, pendingSide: 0 });
                this.movementSystem.tryDescend();
                return true;
                
            case "ascend":
                // Handle down input to switch to descend
                if (input.down) {
                    playerState.setInput({ down: false });
                    playerState.setVerticalState("descend");
                    return true;
                }
                // Continue ascending
                this.movementSystem.tryAscend();
                return true;
                
            case "idle":
                return this.resolveIdleMotion();
                
            default:
                return false;
        }
    }
    
    private resolveIdleMotion(): boolean {
        const playerState = usePlayerStore.getState();
        const { input } = playerState;
        
        // Handle pending side movement (queued during air time)
        if (input.pendingSide !== 0) {
            const dir = input.pendingSide;
            playerState.setInput({ pendingSide: 0 });
            return this.executeIdleAction(() => {
                this.movementSystem.tryMoveSideWithEvent(dir);
            });
        }
        
        // Handle immediate side input
        if (input.left) {
            playerState.setInput({ left: false });
            return this.executeIdleAction(() => {
                this.movementSystem.tryMoveSideWithEvent(-1);
            });
        }
        
        if (input.right) {
            playerState.setInput({ right: false });
            return this.executeIdleAction(() => {
                this.movementSystem.tryMoveSideWithEvent(1);
            });
        }
        
        // Handle vertical input
        if (input.up) {
            playerState.setInput({ up: false });
            return this.executeIdleAction(() => {
                this.movementSystem.tryJumpWithEvent();
            });
        }
        
        if (input.down) {
            playerState.setInput({ down: false });
            return this.executeIdleAction(() => {
                playerState.setVerticalState("descend");
            });
        }
        
        return false;
    }
    
    private executeIdleAction(action: () => void): boolean {
        // For idle state, we can either execute immediately or queue for next bounce
        // This depends on the current bounce phase and game design
        const playerState = usePlayerStore.getState();
        
        if (playerState.physics.bounceActive) {
            // Queue for next ground touch
            this.queueActionForGroundTouch(action);
        } else {
            // Execute immediately
            action();
        }
        
        return true;
    }
    
    private queueActionForGroundTouch(action: () => void): void {
        // This would need to be implemented to queue actions for the next bounce ground touch
        // For now, execute immediately
        action();
    }
    
    public handleGroundTouch(): void {
        // Called when the bounce system detects ground touch
        // Execute any queued actions here
        const handled = this.movementSystem.handleImmediateInput();
        if (!handled) {
            this.movementSystem.resolveQueuedActions();
        }
    }
}