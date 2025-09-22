"use client";
import { Canvas } from "@react-three/fiber";
import { useEffect, useState } from "react";
import { Environment, OrbitControls, useTexture } from "@react-three/drei";
import { Level } from "@/game/Level";
import type { LevelData } from "@/game/types/LevelTypes";
import { Effects } from "./Effects";
import { Bumpy } from "@/game/actors/models/Bumpy";
import { Model } from "@/levels/assets/Monitor";

export function Render() {
    const [canvasKey, setCanvasKey] = useState(0);
    const [level, setLevel] = useState<LevelData | null>(null);

    useEffect(() => {
        if (process.env.NODE_ENV === "development") {
            setCanvasKey((k) => k + 1);
        }
    }, []);

    useEffect(() => {
        let active = true;
        (async () => {
            const res = await fetch("/levels/data/Levelref.json");
            const data = (await res.json()) as LevelData;
            if (active) setLevel(data);
        })();
        return () => {
            active = false;
        };
    }, []);

    return (
        <Canvas key={canvasKey} className="w-full h-full bg-black overflow-hidden" camera={{ position: [0, 0, 7], fov: 55 }}>
            <ambientLight intensity={0.} />
             <Environment  preset="sunset" environmentIntensity={0.9} />
            <OrbitControls target={[0, 0, 0]} />
            <Sfondo /> 
            {/* <Model position={[0,-6.6,1.2]} scale={3} /> */}
            {/* <Bumpy /> */}

            {level && <Level data={level} />}
            <Effects />
        </Canvas>
    );
}

function Sfondo() {
    const texture = useTexture("/sfondo2.png");
    return (
        <mesh position={[0, 0, -1]}>
            <planeGeometry args={[11, 11]} />
            <meshStandardMaterial color={"#002080"} map={texture} />
        </mesh>
    );
}