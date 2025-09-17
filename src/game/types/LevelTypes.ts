
export type PadType = "empty" | "normal";
export type ItemType = | "none" | "coin" | "gelato" | "ice-stick" | "cone" | "bear" | "flag";
export type BrickType = "none" | "ldoor";

export interface LevelGridMeta {
    rows: string;            // es: "A-F"
    cols: [number, number];  // es: [1, 8]
    tileSize: number;        // es: 1.0
}

export interface LevelMeta {
    id: string;
    name: string;
    grid: LevelGridMeta;
    theme: string;
}

export interface LevelDefaults {
    pad: PadType;
    item: ItemType;
    brick: BrickType;
}

export interface LevelCell {
    coord: string; // es: "C5"
    pad: PadType;
    item: ItemType;
    brick: BrickType;
}

export interface LevelEntity {
    type: "spawner" | "exit";
    coord: string;
}

export interface LevelData {
    meta: LevelMeta;
    defaults: LevelDefaults;
    cells: LevelCell[];
    entities: LevelEntity[];
}

export interface WorldPositioning {
    x: number;
    y: number;
    z: number;
}