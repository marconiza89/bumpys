// src/game/systems/PlayerMovementSystem.ts
import { Vector3 } from "three";
import { LevelData } from "@/game/types/LevelTypes";
import { coordToWorld, expandRows, parseCoord } from "@/game/utils/Grid";
import { usePlayerStore, VerticalState } from "@/game/stores/playerState";
import { useInteractionStore } from "@/game/stores/InteractionState";
import { publishPadEvent } from "@/levels/state/padEvents";
import { useItemsStore } from "@/levels/state/itemsStore";

export class PlayerMovementSystem {
    private data: LevelData;
    private rows: string[];
    private colStart: number;
    private colEnd: number;
    private colsCount: number;
    private rowsCount: number;
    private tileSize: number;
    private padMap: Map<string, boolean>;
    
    // Constants
    private readonly SIDE_MOVE_DURATION_SEC = 0.38;
    private readonly DEFAULT_STEP_DURATION = 0.14;
    private readonly BALL_Z = 0.3;
    
    constructor(data: LevelData) {
        this.data = data;
        this.rows = expandRows(data.meta.grid.rows);
        [this.colStart, this.colEnd] = data.meta.grid.cols;
        this.colsCount = this.colEnd - this.colStart + 1;
        this.rowsCount = this.rows.length;
        this.tileSize = data.meta.grid.tileSize ?? 1;
        
        // Build pad map
        this.padMap = new Map();
        for (const r of this.rows) {
            for (let c = this.colStart; c <= this.colEnd; c++) {
                this.padMap.set(`${r}${c}`.toUpperCase(), false);
            }
        }
        for (const c of data.cells) {
            this.padMap.set(c.coord.toUpperCase(), c.pad !== "empty");
        }
    }
    
    private toCoord(rowIndex: number, colIndex: number): string {
        const rowLetter = this.rows[rowIndex];
        const colNumber = this.colStart + colIndex;
        return `${rowLetter}${colNumber}`;
    }
    
    private isPadAt(rowIndex: number, colIndex: number): boolean {
        if (rowIndex < 0 || rowIndex >= this.rowsCount) return false;
        if (colIndex < 0 || colIndex >= this.colsCount) return false;
        const coord = this.toCoord(rowIndex, colIndex);
        return this.padMap.get(coord.toUpperCase()) === true;
    }
    
    private canMoveTo(rowIndex: number, colIndex: number): boolean {
        return !(rowIndex < 0 || rowIndex >= this.rowsCount || colIndex < 0 || colIndex >= this.colsCount);
    }
    
    private computeWorldPosition(rowIndex: number, colIndex: number): Vector3 {
        const coord = this.toCoord(rowIndex, colIndex);
        const [x, y, z] = coordToWorld(this.data, coord, this.BALL_Z);
        return new Vector3(x, y, z);
    }
    
    private getPadType(rowIndex: number, colIndex: number): string {
        const coord = this.toCoord(rowIndex, colIndex);
        const cell = this.data.cells.find(c => c.coord.toUpperCase() === coord.toUpperCase());
        return cell?.pad || this.data.defaults.pad;
    }
    
    private getBrickType(rowIndex: number, colIndex: number): string {
        const coord = this.toCoord(rowIndex, colIndex);
        const cell = this.data.cells.find(c => c.coord.toUpperCase() === coord.toUpperCase());
        return cell?.brick || this.data.defaults.brick;
    }
    
    // Public methods for movement
    public initializePlayer(): void {
        const spawner = this.data.entities?.find(e => e.type === "spawner");
        const coord = spawner?.coord ?? `${this.rows[0]}${this.colStart}`;
        const { rowLetter, col } = parseCoord(coord);
        const spawnRow = this.rows.indexOf(rowLetter);
        const spawnCol = col - this.colStart;
        
        const worldPos = this.computeWorldPosition(spawnRow, spawnCol);
        const playerStore = usePlayerStore.getState();
        
        // Set both current position AND target to spawn location
        playerStore.setPosition(spawnRow, spawnCol, worldPos);
        playerStore.physics.targetWorld.copy(worldPos);
        playerStore.setVerticalState(this.isPadAt(spawnRow, spawnCol) ? "idle" : "descend");
        
        // Collect item at spawn
        const spawnCoord = this.toCoord(spawnRow, spawnCol);
        useItemsStore.getState().collectAt(spawnCoord);
    }
    
    public tryMoveSide(direction: -1 | 1): boolean {
        const playerState = usePlayerStore.getState();
        const { rowIndex, colIndex } = playerState.position;
        const { verticalState, physics } = playerState;
        
        if (physics.moving || verticalState === "descend") return false;
        
        const toCol = colIndex + direction;
        if (!this.canMoveTo(rowIndex, toCol)) {
            // Wall bounce
            this.performWallBounce(direction);
            return false;
        }
        
        // Calculate target world position but don't update current position yet
        const targetWorldPos = this.computeWorldPosition(rowIndex, toCol);
        const distance = this.tileSize;
        const speed = distance / this.SIDE_MOVE_DURATION_SEC;
        
        // Update grid position and target, but current world position stays for gradual movement
        playerState.setPosition(rowIndex, toCol, playerState.position.worldPosition); // Keep current world pos
        playerState.physics.targetWorld.copy(targetWorldPos); // Set target for movement
        playerState.setMoving(true, "side");
        playerState.physics.currentSpeed = speed;
        playerState.pauseBounce();
        
        return true;
    }
    
    public tryAscend(): boolean {
        const playerState = usePlayerStore.getState();
        const { rowIndex, colIndex } = playerState.position;
        const { physics } = playerState;
        
        if (physics.moving) return false;
        
        const upRow = rowIndex + 1;
        if (!this.canMoveTo(upRow, colIndex) || this.isPadAt(upRow, colIndex)) {
            playerState.setVerticalState("descend");
            return false;
        }
        
        const targetWorldPos = this.computeWorldPosition(upRow, colIndex);
        const speed = this.tileSize / this.DEFAULT_STEP_DURATION;
        
        // Update grid position and target, but current world position stays for gradual movement
        playerState.setPosition(upRow, colIndex, playerState.position.worldPosition); // Keep current world pos
        playerState.physics.targetWorld.copy(targetWorldPos); // Set target for movement
        playerState.setMoving(true, "vertical");
        playerState.physics.currentSpeed = speed;
        
        return true;
    }
    
    public tryDescend(): boolean {
        const playerState = usePlayerStore.getState();
        const { rowIndex, colIndex } = playerState.position;
        const { physics } = playerState;
        
        if (physics.moving) return false;
        
        const downRow = rowIndex - 1;
        if (!this.canMoveTo(downRow, colIndex)) {
            playerState.setVerticalState("idle");
            return false;
        }
        
        const hasPadBelow = this.isPadAt(downRow, colIndex);
        const hasPadHere = this.isPadAt(rowIndex, colIndex);
        
        if (hasPadBelow && hasPadHere) {
            playerState.setVerticalState("idle");
            return false;
        }
        
        const targetWorldPos = this.computeWorldPosition(downRow, colIndex);
        const speed = this.tileSize / this.DEFAULT_STEP_DURATION;
        
        // Update grid position and target, but current world position stays for gradual movement
        playerState.setPosition(downRow, colIndex, playerState.position.worldPosition); // Keep current world pos
        playerState.physics.targetWorld.copy(targetWorldPos); // Set target for movement
        playerState.setMoving(true, "vertical");
        playerState.physics.currentSpeed = speed;
        
        return true;
    }
    
    private performWallBounce(direction: -1 | 1): void {
        const playerState = usePlayerStore.getState();
        const { worldPosition } = playerState.position;
        
        if (playerState.verticalState === "ascend") {
            playerState.setVerticalState("descend");
        }
        
        const totalLength = this.tileSize;
        playerState.startWallBounce(direction, worldPosition, totalLength);
    }
    
    public onArrival(): void {
        const playerState = usePlayerStore.getState();
        const { rowIndex, colIndex } = playerState.position;
        const { verticalState, physics } = playerState;
        
        // Update actual world position to match target now that movement is complete
        playerState.position.worldPosition.copy(physics.targetWorld);
        
        // Collect items
        const coord = this.toCoord(rowIndex, colIndex);
        useItemsStore.getState().collectAt(coord);
        
        // Handle pad interactions
        if (this.isPadAt(rowIndex, colIndex)) {
            const padType = this.getPadType(rowIndex, colIndex);
            const interactionStore = useInteractionStore.getState();
            
            // Determine interaction direction based on movement
            let direction: "from_above" | "from_below" | "from_left" | "from_right" = "from_above";
            if (physics.moveKind === "side") {
                direction = "from_left"; // Simplified, could be more specific
            } else if (verticalState === "descend") {
                direction = "from_above";
            } else {
                direction = "from_below";
            }
            
            // Trigger appropriate pad interaction
            this.handlePadInteraction(coord, padType, direction);
        }
        
        // Handle brick interactions (only for left side of cell)
        const brickType = this.getBrickType(rowIndex, colIndex);
        if (brickType && brickType !== "none") {
            this.handleBrickInteraction(coord, brickType);
        }
        
        // Update vertical state based on arrival context
        this.updateVerticalStateOnArrival();
        
        // Reset movement state
        playerState.setMoving(false);
    }
    
    private handlePadInteraction(coord: string, padType: string, direction: any): void {
        const interactionStore = useInteractionStore.getState();
        
        switch (padType) {
            case "normal":
                interactionStore.handleNormalPad(coord, direction);
                publishPadEvent(coord, "bounce");
                break;
            case "ice":
                interactionStore.handleIcePad(coord, direction);
                publishPadEvent(coord, "bounce");
                break;
            case "doubletrap":
            case "bottrap":
            case "toptrap":
                interactionStore.handleTrapPad(coord, direction, padType);
                publishPadEvent(coord, "bounce");
                break;
            case "rbouncer":
                interactionStore.handleBouncerPad(coord, direction, "right");
                publishPadEvent(coord, "tilt", { dir: 1 });
                break;
            case "lbouncer":
                interactionStore.handleBouncerPad(coord, direction, "left");
                publishPadEvent(coord, "tilt", { dir: -1 });
                break;
            case "rtrampoline":
                interactionStore.handleTrampolinePad(coord, direction, "right");
                publishPadEvent(coord, "trampoline");
                break;
            case "ltrampoline":
                interactionStore.handleTrampolinePad(coord, direction, "left");
                publishPadEvent(coord, "trampoline");
                break;
            case "updoor":
                interactionStore.handleDoorPad(coord, direction, "up");
                publishPadEvent(coord, "bounce");
                break;
            case "downdoor":
                interactionStore.handleDoorPad(coord, direction, "down");
                publishPadEvent(coord, "bounce");
                break;
            case "green1":
                interactionStore.handleGreenPad(coord, direction, 1);
                publishPadEvent(coord, "bounce");
                break;
            case "green2":
                interactionStore.handleGreenPad(coord, direction, 2);
                publishPadEvent(coord, "bounce");
                break;
        }
    }
    
    private handleBrickInteraction(coord: string, brickType: string): void {
        const interactionStore = useInteractionStore.getState();
        
        switch (brickType) {
            case "ldoor":
                interactionStore.handleDoorBrick(coord, "from_left", "left");
                break;
            case "rdoor":
                interactionStore.handleDoorBrick(coord, "from_right", "right");
                break;
        }
    }
    
    private updateVerticalStateOnArrival(): void {
        const playerState = usePlayerStore.getState();
        const { rowIndex, colIndex } = playerState.position;
        const { verticalState, physics, landedFrom } = playerState;
        
        const hasPadHere = this.isPadAt(rowIndex, colIndex);
        
        if (physics.moveKind === "side") {
            // Side movement completed
            if (verticalState === "ascend") {
                playerState.setVerticalState(hasPadHere ? "idle" : "ascend");
            } else {
                playerState.setVerticalState(hasPadHere ? "idle" : "descend");
            }
        } else if (physics.moveKind === "vertical") {
            // Vertical movement completed
            if (verticalState === "descend") {
                playerState.setVerticalState(hasPadHere ? "idle" : "descend");
            } else if (verticalState === "ascend") {
                playerState.setVerticalState("ascend"); // Continue ascending
            }
        }
        
        // Handle bounce resumption
        if (playerState.verticalState === "idle") {
            this.handleBounceOnLanding();
        }
    }
    
    private handleBounceOnLanding(): void {
        const playerState = usePlayerStore.getState();
        const { input, landedFrom } = playerState;
        
        // Check if we should suppress bounce resume due to immediate input
        const suppressResume = 
            (landedFrom === "descend" && (input.up || input.left || input.right)) ||
            (landedFrom === "ascend" && (input.left || input.right || input.pendingSide !== 0));
        
        if (!suppressResume) {
            playerState.resumeBounce();
        }
    }
    
    public handleImmediateInput(): boolean {
        const playerState = usePlayerStore.getState();
        const { verticalState, landedFrom, input } = playerState;
        const { rowIndex, colIndex } = playerState.position;
        
        if (verticalState !== "idle" || !landedFrom) return false;
        
        const coord = this.toCoord(rowIndex, colIndex);
        
        // Immediate actions after landing
        if (landedFrom === "descend" && input.up) {
            // Immediate trampoline
            publishPadEvent(coord, "trampoline");
            playerState.setVerticalState("ascend");
            playerState.setInput({ up: false });
            this.tryAscend();
            return true;
        }
        
        if (landedFrom === "descend" && (input.left || input.right)) {
            // Immediate side movement
            const dir: -1 | 1 = input.left ? -1 : 1;
            publishPadEvent(coord, "tilt", { dir });
            playerState.setInput({ left: false, right: false, pendingSide: 0 });
            this.tryMoveSide(dir);
            return true;
        }
        
        if (landedFrom === "ascend" && (input.left || input.right || input.pendingSide !== 0)) {
            // Immediate side movement from ascend
            const dir: -1 | 1 = input.left ? -1 : input.right ? 1 : input.pendingSide as -1 | 1;
            publishPadEvent(coord, "tilt", { dir });
            playerState.setInput({ left: false, right: false, pendingSide: 0 });
            this.tryMoveSide(dir);
            return true;
        }
        
        return false;
    }
    
    public resolveQueuedActions(): boolean {
        const playerState = usePlayerStore.getState();
        const { verticalState, input, physics } = playerState;
        const { rowIndex, colIndex } = playerState.position;
        
        if (physics.moving || verticalState !== "idle") return false;
        
        const coord = this.toCoord(rowIndex, colIndex);
        
        // Handle pending side movement
        if (input.pendingSide !== 0) {
            const dir = input.pendingSide;
            publishPadEvent(coord, "tilt", { dir });
            playerState.setInput({ pendingSide: 0 });
            this.tryMoveSide(dir);
            return true;
        }
        
        // Handle immediate input (live input while idle)
        if (input.left) {
            publishPadEvent(coord, "tilt", { dir: -1 });
            playerState.setInput({ left: false });
            this.tryMoveSide(-1);
            return true;
        }
        
        if (input.right) {
            publishPadEvent(coord, "tilt", { dir: 1 });
            playerState.setInput({ right: false });
            this.tryMoveSide(1);
            return true;
        }
        
        if (input.up) {
            publishPadEvent(coord, "trampoline");
            playerState.setVerticalState("ascend");
            playerState.setInput({ up: false });
            this.tryAscend();
            return true;
        }
        
        if (input.down) {
            playerState.setVerticalState("descend");
            playerState.setInput({ down: false });
            return true;
        }
        
        return false;
    }
    
    public queueSideMovement(direction: -1 | 1): void {
        const playerState = usePlayerStore.getState();
        
        if (playerState.verticalState === "descend") return;
        
        if (playerState.input.pendingSide === 0) {
            playerState.setInput({ pendingSide: direction });
        }
    }
    
    public tryMoveSideWithEvent(direction: -1 | 1): boolean {
        const playerState = usePlayerStore.getState();
        const { rowIndex, colIndex } = playerState.position;
        const coord = this.toCoord(rowIndex, colIndex);
        
        publishPadEvent(coord, "tilt", { dir: direction });
        return this.tryMoveSide(direction);
    }
    
    public tryJumpWithEvent(): boolean {
        const playerState = usePlayerStore.getState();
        const { rowIndex, colIndex } = playerState.position;
        const coord = this.toCoord(rowIndex, colIndex);
        
        publishPadEvent(coord, "trampoline");
        playerState.setVerticalState("ascend");
        return this.tryAscend();
    }
    
    public toCoordFromIndices(rowIndex: number, colIndex: number): string {
        return this.toCoord(rowIndex, colIndex);
    }
}

