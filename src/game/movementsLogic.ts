import { LevelData } from "@/game/types/LevelTypes";
import { cellsMap, expandRows, parseCoord } from "@/game/utils/Grid";
import { getEntryActionsForCell, getExitActionsForCell } from "@/game/movementRules";
import { useGreenPadsStore } from "@/levels/state/greenPadsStore";

export type Direction = "left" | "right" | "up" | "down";

export type JumpStepResult = {
    coord: string;
    continue: boolean;
    reason?: "border" | "blocked" | "pad" | "down" | "lateraljump";
};

function getRows(data: LevelData) {
    return expandRows(data.meta.grid.rows);
}

function isWithinGrid(data: LevelData, rowIndex: number, col: number): boolean {
    const rows = getRows(data);
    const [cStart, cEnd] = data.meta.grid.cols;
    return rowIndex >= 0 && rowIndex < rows.length && col >= cStart && col <= cEnd;
}

function getNeighborCoord(data: LevelData, coord: string, dir: Direction): string | null {
    const rows = getRows(data);
    const { rowLetter, col } = parseCoord(coord);
    const rIndex = rows.indexOf(rowLetter);
    if (rIndex < 0) return null;

    let nextR = rIndex;
    let nextC = col;

    // CORRETTO: down = rIndex - 1 (verso A), up = rIndex + 1 (verso F)
    if (dir === "left") nextC = col - 1;
    if (dir === "right") nextC = col + 1;
    if (dir === "up") nextR = rIndex + 1;
    if (dir === "down") nextR = rIndex - 1;

    if (!isWithinGrid(data, nextR, nextC)) return null;
    return `${rows[nextR]}${nextC}`;
}

function getPadIdAtCoord(data: LevelData, coord: string): string {
    const map = cellsMap(data);
    const cell = map.get(coord.toUpperCase());
    return String((cell?.pad ?? data.defaults.pad) || "empty");
}

function isPadEmptyAt(data: LevelData, coord: string): boolean {
    const padId = getPadIdAtCoord(data, coord);
    
    // Check if it's explicitly empty
    if (padId === "empty") return true;
    
    // Check if it's a consumed green pad
    if (padId === "green1" || padId === "green2" || padId === "green3") {
        const greenPadStore = useGreenPadsStore.getState();
        if (greenPadStore.isPadConsumed(coord)) {
            return true; // Treat as empty if consumed
        }
    }
    
    return false;
}

// Scende finché la cella è empty; atterra alla prima non-empty che accetta ingresso dall’alto
export function resolveGravity(data: LevelData, startCoord: string): string {
    if (!isPadEmptyAt(data, startCoord)) return startCoord;

    let current = startCoord;
    const maxSteps = getRows(data).length + 2;
    let steps = 0;

    while (steps++ < maxSteps) {
        const next = getNeighborCoord(data, current, "down");
        if (!next) return current; // bordo basso (oltre A)

        if (!isPadEmptyAt(data, next)) {
            const entry = getEntryActionsForCell(data, next);
            if (entry.fromTop) return next; // atterra
            // se non consente ingresso dall’alto, continua a scendere
        }

        current = next;
    }

    return current;
}

export function attemptMoveFrom(data: LevelData, fromCoord: string, dir: Direction): string {
    const toCoord = getNeighborCoord(data, fromCoord, dir);
    if (!toCoord) return fromCoord;

    const exit = getExitActionsForCell(data, fromCoord);
    const entry = getEntryActionsForCell(data, toCoord);

    const allowed =
        (dir === "right" && exit.toRight && entry.fromLeft) ||
        (dir === "left" && exit.toLeft && entry.fromRight) ||
        (dir === "up" && exit.toTop && entry.fromBottom) ||
        (dir === "down" && exit.toBottom && entry.fromTop);

    if (!allowed) return fromCoord;

    // Applica sempre la gravità alla cella di arrivo:
    // - se è empty, scenderà
    // - se è non-empty, resterà lì
    return resolveGravity(data, toCoord);
}



export function stepJump(
    data: LevelData,
    currentCoord: string,
    pressed: { left?: boolean; right?: boolean; down?: boolean }
): JumpStepResult {
    // 1) input laterale interrompe SEMPRE il salto (anche se il movimento fallisce)
    if (pressed.left || pressed.right) {
        let working = currentCoord;
        if (pressed.left) {
            working = attemptMoveNoGravity(data, working, "left");
        } else if (pressed.right) {
            working = attemptMoveNoGravity(data, working, "right");
        }
        return { coord: working, continue: false, reason: "lateraljump" };
    }

    // 2) stop salto se premi giù
    if (pressed.down) {
        return { coord: currentCoord, continue: false, reason: "down" };
    }

    // 3) prova a salire di una riga
    const nextUp = getNeighborCoord(data, currentCoord, "up");
    if (!nextUp) {
        return { coord: currentCoord, continue: false, reason: "border" };
    }

    const exit = getExitActionsForCell(data, currentCoord);
    if (!exit.toTop) {
        return { coord: currentCoord, continue: false, reason: "blocked" };
    }

    // Se sopra è empty, sali e continua a saltare
    if (isPadEmptyAt(data, nextUp)) {
        return { coord: nextUp, continue: true };
    }

    // Sopra c'è un pad non-empty: valuta l'ingresso dal basso
    const entryAbove = getEntryActionsForCell(data, nextUp);
    if (entryAbove.fromBottom) {
        return { coord: nextUp, continue: false, reason: "pad" };
    }

    // Non puoi entrare dal basso: fermati sotto
    return { coord: currentCoord, continue: false, reason: "blocked" };
}



export function attemptMoveNoGravity(
    data: LevelData,
    fromCoord: string,
    dir: Direction
): string {
    if (dir !== "left" && dir !== "right") return fromCoord;

    const toCoord = getNeighborCoord(data, fromCoord, dir);
    if (!toCoord) return fromCoord;

    const exit = getExitActionsForCell(data, fromCoord);
    const entry = getEntryActionsForCell(data, toCoord);

    const allowed =
        (dir === "right" && exit.toRight && entry.fromLeft) ||
        (dir === "left" && exit.toLeft && entry.fromRight);

    return allowed ? toCoord : fromCoord;

}