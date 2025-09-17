import * as THREE from "three";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";

export interface ItemsProps {
    position?: [number, number, number];

    // animazione esplosione
    explode?: boolean;
    explodeOnMount?: boolean;
    duration?: number; // in secondi
    strength?: number; // ampiezza spostamento
    grid?: number;     // risoluzione griglia
    seed?: number;     // seme random
    onExplodeEnd?: () => void;
}

type ExplodableSpriteProps = ItemsProps & {
    textureUrl: string;
    rotation?: [number, number, number];
};

function ExplodableSprite({
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    textureUrl,
    explode,
    explodeOnMount = false,
    duration = 0.3,
    strength = 0.51,
    grid = 8,
    seed = 14,
    onExplodeEnd,
}: ExplodableSpriteProps) {
    const texture = useTexture(textureUrl);
    const materialRef = useRef<THREE.ShaderMaterial | null>(null);

    useEffect(() => {
        if (texture) {
            texture.flipY = true;
            texture.needsUpdate = true;
            // opzionale: un po' di anisotropia
            texture.anisotropy = Math.max(texture.anisotropy ?? 1, 4);
        }
    }, [texture]);

    const progressRef = useRef(0); // 0..1
    const [running, setRunning] = useState(explodeOnMount || !!explode);
    const [visible, setVisible] = useState(true);

    const start = () => {
        progressRef.current = 0;
        setVisible(true);
        setRunning(true);
    };

    // trigger da prop "explode"
    useEffect(() => {
        if (explode) start();
    }, [explode]);

    // trigger al mount se richiesto
    useEffect(() => {
        if (explodeOnMount) start();
    }, [explodeOnMount]);

    const StartExplosion = () => {
        start();
    };

    useFrame((_, delta) => {
        if (!running || !materialRef.current) return;

        const step = delta / Math.max(0.0001, duration);
        progressRef.current = Math.min(1, progressRef.current + step);

        materialRef.current.uniforms.uProgress.value = progressRef.current;

        if (progressRef.current >= 1) {
            setRunning(false);
            setVisible(false);
            onExplodeEnd?.();
        }
    });

    const uniforms = useMemo(
        () => ({
            uMap: { value: texture },
            uProgress: { value: 0 },
            uStrength: { value: strength },
            uGrid: { value: grid },
            uSeed: { value: seed },
        }),
        [texture, strength, grid, seed]
    );

    const vertexShader = `
uniform float uProgress;
uniform float uStrength;
uniform float uGrid;
uniform float uSeed;
varying vec2 vUv;

float hash12(vec2 p) {
float h = dot(p, vec2(127.1, 311.7));
return fract(sin(h + uSeed) * 43758.5453123);
}

vec2 hash22(vec2 p) {
float n = sin(dot(p, vec2(127.1, 311.7)) + uSeed);
return fract(vec2(n, n * 1.2154)) * 2.0 - 1.0;
}

void main() {
vUv = uv;
vec3 pos = position;

vec2 cell = floor(uv * uGrid);
vec2 r = hash22(cell);
r = normalize(r + 1e-6);

float delay = hash12(cell);
float p = clamp((uProgress - delay * 0.25) / max(1e-5, (1.0 - 0.25)), 0.0, 1.0);
p = 1.0 - pow(1.0 - p, 3.0);

pos.xy += r * (uStrength * p);
pos.z += p * 0.05 * hash12(cell + 13.7);

gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

    const fragmentShader = `
uniform sampler2D uMap;
uniform float uProgress;
uniform float uGrid;
uniform float uSeed;
varying vec2 vUv;

float hash12(vec2 p) {
float h = dot(p, vec2(127.1, 311.7));
return fract(sin(h + uSeed) * 43758.5453123);
}

void main() {
vec4 c = texture2D(uMap, vUv);
if (c.a < 0.01) discard;

vec2 cell = floor(vUv * uGrid);
float delay = hash12(cell);
float p = clamp((uProgress - delay * 0.25) / max(1e-5, (1.0 - 0.25)), 0.0, 1.0);
p = 1.0 - pow(1.0 - p, 3.0);

float alpha = c.a * (1.0 - p);
if (alpha < 0.01) discard;

gl_FragColor = vec4(c.rgb, alpha);
}
`;

    return (
        <group  position={position} visible={visible}>
            <mesh position={[0, 0.5, 0]} rotation={rotation}>
                <planeGeometry args={[0.8, 0.8, grid, grid]} />
                <shaderMaterial
                    ref={materialRef}
                    uniforms={uniforms}
                    vertexShader={vertexShader}
                    fragmentShader={fragmentShader}
                    transparent
                    depthWrite={false}
                />
            </mesh>
        </group>
    );
}

export function IceStick({
    position = [0, 0, 0],
    explode,
    explodeOnMount = false,
    duration = 0.3,
    strength = 0.91,
    grid = 8,
    seed = 14,
    onExplodeEnd,
}: ItemsProps) {
    return (
        <ExplodableSprite
            position={position}
            rotation={[0, 0, 0]}
            textureUrl="/items/2D/ice-stick.png"
            explode={explode}
            explodeOnMount={explodeOnMount}
            duration={duration}
            strength={strength}
            grid={grid}
            seed={seed}
            onExplodeEnd={onExplodeEnd}
        />
    );
}

export function Coin(props: ItemsProps) {
    return <ExplodableSprite textureUrl="/items/2D/coin.png" {...props} />;
}

export function Gelato(props: ItemsProps) {
    return <ExplodableSprite textureUrl="/items/2D/gelato.png" {...props} />;
}

export function Cone(props: ItemsProps) {
    return <ExplodableSprite textureUrl="/items/2D/cone.png" {...props} />;
}

export function Bear(props: ItemsProps) {
    return <ExplodableSprite textureUrl="/items/2D/bear.png" {...props} />;
}

export function Flag(props: ItemsProps) {
    return <ExplodableSprite textureUrl="/items/2D/flag.png" {...props} />;
}

export function Strawberry(props: ItemsProps) {
    return <ExplodableSprite textureUrl="/items/2D/strawberry.png" {...props} />;
}

export function IceCream(props: ItemsProps) {
    return <ExplodableSprite textureUrl="/items/2D/ice-cream.png" {...props} />;
}

export function CupCake(props: ItemsProps) {
    return <ExplodableSprite textureUrl="/items/2D/cupcake.png" {...props} />;
}

export function Cake(props: ItemsProps) {
    return <ExplodableSprite textureUrl="/items/2D/cake.png" {...props} />;
}

export function Drink(props: ItemsProps) {
    return <ExplodableSprite textureUrl="/items/2D/drink.png" {...props} />;
}
export function Drink2(props: ItemsProps) {
    return <ExplodableSprite textureUrl="/items/2D/drink2.png" {...props} />;
}
export function Granita(props: ItemsProps) {
    return <ExplodableSprite textureUrl="/items/2D/granita.png" {...props} />;
}

export function CheeseCake(props: ItemsProps) {
    return <ExplodableSprite textureUrl="/items/2D/cheesecake.png" {...props} />;
}

export function Bread(props: ItemsProps) {
    return <ExplodableSprite textureUrl="/items/2D/bread.png" {...props} />;
}