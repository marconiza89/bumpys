"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useRef, useEffect, useState, use, forwardRef, ComponentProps } from "react";
import { MeshReflectorMaterial,Circle, Lightformer, Float, useVideoTexture, useProgress, Html, OrbitControls, SoftShadows } from "@react-three/drei";
import * as THREE from "three";
import {
  EffectComposer,
  GodRays,
  BrightnessContrast,
  Bloom,
  ToneMapping,
  TiltShift2,
  WaterEffect,
  FXAA,
  DepthOfField,
  SSAO,
  Pixelation,
} from "@react-three/postprocessing";

import { Mesh } from 'three'

const Sun = forwardRef<Mesh, any>((props, ref) => (
  <mesh ref={ref} position={[0, 120, -400]} {...props}>
    <circleGeometry args={[30, 64]} />
    <meshBasicMaterial color={"#ffd9b5"} />
  </mesh>
));


export function Effects() {
  const color ="#f1f1f1";
  const color2 ="#020d00";
  const color3 ="#000";
 
  const material = useRef<Mesh>(null!); 
  
  return (   
          
             
        <Suspense>
          <Sun ref={material} />    
        
          <EffectComposer multisampling={0}  >
              {/* <GodRays sun={material} weight={10} density={1.2} samples={64} exposure={0.034} decay={0.9} blur={true} /> */}
              <Pixelation granularity={0.5} />
            {/* <BrightnessContrast brightness={0.02} contrast={0.} />  */}
            {/* <FXAA />                     */}
            <Bloom mipmapBlur luminanceThreshold={0.1} intensity={0.3} />  
          </EffectComposer>
        
        </Suspense>
    
  );
}


