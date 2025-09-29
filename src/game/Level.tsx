"use client";

import { memo, useEffect, useMemo } from "react";
import { BasicPad, BotTrapPad, DoubleTrapPad, DownDoor, GreenPad, IcePad, LBouncer, Ltrampoline, RBouncer, Rtrampoline, TopTrapPad, UpDoor } from "@/levels/assets/Pads";
import { LevelData } from "./types/LevelTypes";
import { cellsMap, coordToWorld, enumerateCoords } from "./utils/Grid";
import {Player} from "./actors/Player";
import { useItemsStore } from "@/levels/state/itemsStore";
import { ItemAtCoord } from "@/levels/util/ItemAtCoord";
import { ExitDoor } from "@/levels/assets/ExitDoor";
import { LDoor, RDoor } from "@/levels/assets/Bricks";
import { useGreenPadsStore } from "@/levels/state/greenPadsStore";

type Props = { data: LevelData };

function renderPad(pad: string, coord: string, position: [number, number, number]) {
    switch (pad) {
        case "normal":
            // @ts-ignore: coord è extra, BasicPad accetta position
            return <BasicPad key={`${pad}-${coord}`} coord={coord} position={position} />;
        case "doubletrap":
            return <DoubleTrapPad key={`${pad}-${coord}`} coord={coord} position={position} />;
        case "rbouncer":
            return <RBouncer key={`${pad}-${coord}`} coord={coord} position={position} />;
        case "lbouncer":
            return <LBouncer key={`${pad}-${coord}`} coord={coord} position={position} />;
        case "ice":
            return <IcePad key={`${pad}-${coord}`} coord={coord} position={position} />;
        case "green1":
            return <GreenPad touchdown={2} key={`${pad}-${coord}`} coord={coord} position={position} />;
        case "green2":
            return <GreenPad touchdown={3} key={`${pad}-${coord}`} coord={coord} position={position} />;
        case "updoor":
            return <UpDoor key={`${pad}-${coord}`} coord={coord} position={position} />;
        case "downdoor":
            return <DownDoor key={`${pad}-${coord}`} coord={coord} position={position} />;
        case "bottrap":
            return <BotTrapPad key={`${pad}-${coord}`} coord={coord} position={position} />;
        case "toptrap":
            return <TopTrapPad key={`${pad}-${coord}`} coord={coord} position={position} />;
        case "rtrampoline":
            return <Rtrampoline key={`${pad}-${coord}`} coord={coord} position={position} />;
            case "ltrampoline":
            return <Ltrampoline key={`${pad}-${coord}`} coord={coord} position={position} />;
        default:
            return null;
    }
}

function RenderBrick(brick: string, coord: string, position: [number, number, number]) {
    switch (brick) {
        case "ldoor":
            return <LDoor key={`${brick}-${coord}`} coord={coord} position={position} />;
        case "rdoor":
            return <RDoor key={`${brick}-${coord}`} coord={coord} position={position} />;
        default:
            return null;
    }
}

export const Level = memo(function Level({ data }: Props) {
 

useEffect(() => {
        useItemsStore.getState().initFromLevel(data);
    }, [data]);

    const gridNodes = useMemo(() => {
        const map = cellsMap(data);
        const coords = enumerateCoords(data);

        return coords.map((coord) => {
            const cell = map.get(coord.toUpperCase()) ?? {
                pad: data.defaults.pad,
                item: data.defaults.item,
                brick: data.defaults.brick
            };
            const padPos = coordToWorld(data, coord, 0);
            const itemPos = coordToWorld(data, coord, 0);
            const brickPos = coordToWorld(data, coord, 0);

            return (
                <group key={`cell-${coord}`}>
                   
                    {renderPad(cell.pad, coord, padPos)}
                    {RenderBrick(cell.brick, coord, brickPos)}
                    <ItemAtCoord coord={coord} type={cell.item} position={itemPos} />
                </group>
            );
        });
    }, [data]);

    const exits = useMemo(() => {
        return (data.entities || [])
            .filter((e) => e.type === "exit")
            .map((e) => {
                const pos = coordToWorld(data, e.coord, 0);
                return <ExitDoor key={`exit-${e.coord}`} position={pos} />;
            });
    }, [data]);

    return (
        <group name={data.meta.name}>
            {gridNodes}
            {exits}
            <Player data={data} />
        </group>
    );
});