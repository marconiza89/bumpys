import { memo } from "react";
import { useLevelProgressStore } from "@/levels/state/LevelProgress";

type Props = {
    position: [number, number, number];
};

export const ExitDoor = memo(function ExitDoor({ position }: Props) {
    const visible = useLevelProgressStore((s) => s.exitVisible);
    if (!visible) return null;

    // Porta semplice: arc + glow
    return (
        <group position={position}>
            <mesh position={[0, 0.5, 0]}>
                <torusGeometry args={[0.35, 0.06, 12, 32, Math.PI]} />
                <meshStandardMaterial color="#66e2ff" emissive="#2288ff" emissiveIntensity={0.6} />
            </mesh>
           <mesh rotation={[0,0, Math.PI]} position={[0, 0.5, 0]}>
                <torusGeometry args={[0.35, 0.06, 12, 32, Math.PI]} />
                <meshStandardMaterial color="#66e2ff" emissive="#2288ff" emissiveIntensity={0.6} />
            </mesh>
        </group>
    );
});