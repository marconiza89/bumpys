import { useMemo } from "react";
import { Vector3 } from "three";
import { BALL_Z } from "../constant.ts";
import { GridHelpers } from "../types";
import { LevelData } from "../../../types/LevelTypes";
import { coordToWorld, expandRows, parseCoord } from "../../../utils/Grid";

export function usePlayerGrid(data: LevelData): GridHelpers {
    // Metadati griglia
    const rows = useMemo(() => expandRows(data.meta.grid.rows), [data]);
    const [colStart, colEnd] = data.meta.grid.cols;
    const colsCount = colEnd - colStart + 1;
    const rowsCount = rows.length;
    const tileSize = data.meta.grid.tileSize ?? 1;

    // Mappa pad presenti
    const padMap = useMemo(() => {
        const m = new Map<string, boolean>();
        // inizializza tutto a false
        for (const r of rows) {
            for (let c = colStart; c <= colEnd; c++) {
                m.set(`${ r }${ c }.toUpperCase()`, false);
            }
        }
        // marca i pad definiti nel level
        for (const c of data.cells) {
            m.set(c.coord.toUpperCase(), c.pad !== "empty");
        }
        return m;
    }, [data, rows, colStart, colEnd]);

    const toCoord = (rowIndex: number, colIndex: number) => {
        const rowLetter = rows[rowIndex];
        const colNumber = colStart + colIndex;
        return `${ rowLetter }${ colNumber }`.toUpperCase();
    };

    const computeWorld = (rowIndex: number, colIndex: number) => {
        const coord = toCoord(rowIndex, colIndex);
        const [x, y, z] = coordToWorld(data, coord, BALL_Z);
        return new Vector3(x, y, z);
    };

    const isPadAt = (rowIndex: number, colIndex: number) => {
        if (rowIndex < 0 || rowIndex >= rowsCount) return false;
        if (colIndex < 0 || colIndex >= colsCount) return false;
        const coord = toCoord(rowIndex, colIndex);
        return padMap.get(coord.toUpperCase()) === true;
    };

    const canMoveTo = (rowIndex: number, colIndex: number) => {
        return !(rowIndex < 0 || rowIndex >= rowsCount || colIndex < 0 || colIndex >= colsCount);
    };

    const getSpawn = () => {
        const spawner = data.entities?.find((e) => e.type === "spawner");
        const fallback = `${ rows[0] }${ colStart }`.toUpperCase();
        const spawnCoord = spawner?.coord ?? fallback;
        const { rowLetter, col } = parseCoord(spawnCoord);
        return {
            row: rows.indexOf(rowLetter),
            col: col - colStart,
        };
    };

    return {
        rows,
        colStart,
        colEnd,
        rowsCount,
        colsCount,
        tileSize,
        toCoord,
        computeWorld,
        isPadAt,
        canMoveTo,
        getSpawn,
    };
}