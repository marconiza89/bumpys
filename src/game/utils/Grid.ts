import { LevelData, WorldPositioning } from "../types/LevelTypes";

export function expandRows(range: string): string[] {
    const [start, end] = range.split("-");
    const s = start.trim().toUpperCase().charCodeAt(0);
    const e = end.trim().toUpperCase().charCodeAt(0);
    const out: string[] = [];
    for (let c = s; c <= e; c++) out.push(String.fromCharCode(c));
    return out;
}

export function parseCoord(coord: string): { rowLetter: string; col: number } {
    const match = coord.trim().toUpperCase().match(/^([A-Z]+)(\d+)$/);
    if (!match) throw new Error(`Coord non valida: ${coord}`);
    return { rowLetter: match[1], col: parseInt(match[2], 10) };
}

export function coordToWorld(
    data: LevelData,
    coord: string,
    z: number = 0
): [number, number, number] {
    const { tileSize, cols: colRange, rows: rowRange } = data.meta.grid;
    const rows = expandRows(rowRange);
    const { rowLetter, col } = parseCoord(coord);

    const rowIndex = rows.indexOf(rowLetter);
    if (rowIndex === -1) throw new Error(`Riga fuori range: ${rowLetter}`);

    const colStart = colRange[0];
    const colEnd = colRange[1];
    const colsCount = colEnd - colStart + 1;
    const rowsCount = rows.length;

    const colIndex = col - colStart; // 0..colsCount-1
    if (colIndex < 0 || colIndex >= colsCount)
        throw new Error(`Colonna fuori range: ${col}`);

    // Centra la griglia nel mondo
    const offsetX = ((colsCount - 1) * tileSize) / 2;
    const offsetY = ((rowsCount - 1) * tileSize) / 2;

    const x = colIndex * tileSize - offsetX;
    const y = rowIndex * tileSize - offsetY;

    return [x, y, z];
}

// Utility per avere una mappa "coord -> cell"
export function cellsMap(data: LevelData): Map<string, { pad: string; item: string; brick: string }> {
    const map = new Map<string, { pad: string; item: string; brick: string }>();
    for (const c of data.cells) map.set(c.coord.toUpperCase(), { pad: c.pad, item: c.item, brick: c.brick });
    return map;
}

// Utility per enumerare tutte le coord della griglia (anche quelle mancanti nel JSON)
export function enumerateCoords(data: LevelData): string[] {
    const rows = expandRows(data.meta.grid.rows);
    const [cStart, cEnd] = data.meta.grid.cols;
    const out: string[] = [];
    for (const r of rows) {
        for (let c = cStart; c <= cEnd; c++) out.push(`${r}${c}`);
    }
    return out;
}