import { useEffect, useMemo, useState } from "react";
import { LevelData } from "../types/LevelTypes";
import { coordToWorld, expandRows } from "../utils/Grid";
import { Bumpy } from "./models/Bumpy";
import { initMovementRules } from "@/game/movementRules";
import { attemptMoveFrom, resolveGravity, Direction } from "@/game/movementsLogic";

type Props = { data: LevelData };

export function Player({ data }: Props) {
const [coord, setCoord] = useState<string | null>(null);

// Inizializza regole (fetch dal public) con fallback
useEffect(() => {
initMovementRules({
padUrl: "/levels/config/padAction.json",
brickUrl: "/levels/config/brickAction.json",
});
}, []);

// trova lo spawn
const spawnCoord = useMemo(() => {
const spawner = (data.entities || []).find((e) => e.type === "spawner");
return spawner?.coord || null;
}, [data]);

// posizionamento iniziale + gravità se spawn è empty
useEffect(() => {
if (!spawnCoord) {
const firstRow = expandRows(data.meta.grid.rows)[0];
const firstCol = data.meta.grid.cols[0];
setCoord(`${firstRow}${firstCol}`);
return;
}
// applico subito gravità dallo spawn
setCoord((prev) => resolveGravity(data, spawnCoord));
}, [data, spawnCoord]);

// mapping coord -> world
const worldPos = useMemo<[number, number, number]>(() => {
if (!coord) return [0, 0, 0];
return coordToWorld(data, coord, 0);
}, [data, coord]);

// input tastiera (test)
useEffect(() => {
function onKeyDown(e: KeyboardEvent) {
if (!coord) return;
let dir: Direction | null = null;
if (e.key === "ArrowLeft") dir = "left";
else if (e.key === "ArrowRight") dir = "right";
else if (e.key === "ArrowUp") dir = "up";
else if (e.key === "ArrowDown") dir = "down";
if (!dir) return;

  const next = attemptMoveFrom(data, coord, dir);
  if (next !== coord) setCoord(next);
}
window.addEventListener("keydown", onKeyDown);
return () => window.removeEventListener("keydown", onKeyDown);
}, [data, coord]);

return (
<group name="Player" position={worldPos}>
<group position={[0, 0.5, -0.25]} castShadow>
<Bumpy />
</group>
<mesh position={[0, 0.09, -0.25]} rotation={[-Math.PI / 2, 0, 0]}>
<circleGeometry args={[0.22, 16]} />
<meshBasicMaterial color="#000000" transparent opacity={0.25} />
</mesh>
</group>
);
}