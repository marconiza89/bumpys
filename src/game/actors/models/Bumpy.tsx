import * as THREE from 'three'
import React, { JSX, useLayoutEffect, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { GLTF } from 'three-stdlib'

type GLTFResult = GLTF & {
  nodes: {
    BallRoot: THREE.Mesh
    EyeL: THREE.Mesh
    EyeR: THREE.Mesh
    PupilL: THREE.Mesh
    PupilR: THREE.Mesh
    Mouth: THREE.Mesh
  }
  materials: {
    ['Material.002']: THREE.MeshStandardMaterial
    ['Material.005']: THREE.MeshStandardMaterial
    ['Material.006']: THREE.MeshStandardMaterial
    ['Material.007']: THREE.MeshStandardMaterial
  }
}

type BumpyProps = JSX.IntrinsicElements['group'] & {
  blinkFrequency?: number // Hz, blink al secondo. 0 o undefined => no blink
}

export function Bumpy({ blinkFrequency = 0.8, ...props }: BumpyProps) {
  const { nodes, materials } = useGLTF('/3DModels/bumpy.glb') as any

  const eyeLRef = useRef<THREE.Mesh>(null!)
  const eyeRRef = useRef<THREE.Mesh>(null!)
  const pupilLRef = useRef<THREE.Mesh>(null!)
  const pupilRRef = useRef<THREE.Mesh>(null!)
  const groupRef = useRef<THREE.Group>(null!)

  // Valori base letti una volta dal modello
  const base = useRef({
    eyeScaleY: 1.5, // dallo scale iniziale degli occhi
    pupilLZ: 0.218,
    pupilRZ: 0.218,
  })

  useLayoutEffect(() => {
    if (eyeLRef.current) base.current.eyeScaleY = eyeLRef.current.scale.y
    if (pupilLRef.current) base.current.pupilLZ = pupilLRef.current.position.z
    if (pupilRRef.current) base.current.pupilRZ = pupilRRef.current.position.z
  }, [])

  useFrame(({ clock }) => {
    if (!eyeLRef.current || !eyeRRef.current || !pupilLRef.current || !pupilRRef.current) return

    // Se frequenza <= 0, ripristina e non blinkare
    if (!blinkFrequency || blinkFrequency <= 0) {
      eyeLRef.current.scale.y = base.current.eyeScaleY
      eyeRRef.current.scale.y = base.current.eyeScaleY
      pupilLRef.current.position.z = base.current.pupilLZ
      pupilRRef.current.position.z = base.current.pupilRZ
      return
    }

    // Parametri blink
    const minEyeScaleY = 0.05 // chiusura palpebra
    const pupilBack = 0.10 // arretramento Z durante il blink
    const blinkDuration = 0.12 // secondi per un ciclo chiudi-apri

    const t = clock.getElapsedTime()
    const cycle = 1 / blinkFrequency
    const phase = t % cycle

    // s: 0 fuori dal blink, 0->1->0 durante il blink (triangolare)
    let s = 0
    if (phase < blinkDuration) {
      const u = phase / blinkDuration // 0..1
      s = 1 - Math.abs(2 * u - 1) // 0->1->0
      // opzionale: curva leggermente più "snap"
      s = Math.pow(s, 0.8)
    }

    // Interpolazioni
    const y = THREE.MathUtils.lerp(base.current.eyeScaleY, minEyeScaleY, s)
    const zL = base.current.pupilLZ - s * pupilBack
    const zR = base.current.pupilRZ - s * pupilBack

    eyeLRef.current.scale.y = y
    eyeRRef.current.scale.y = y
    pupilLRef.current.position.z = zL
    pupilRRef.current.position.z = zR
  })

  return (
    <group {...props} dispose={null}>
      <group ref={groupRef} name="Scene">
        <mesh
          name="BallRoot"
          castShadow
          receiveShadow
          geometry={nodes.BallRoot.geometry}
          material={materials['Material.002']}
        />
        <mesh
          ref={eyeLRef}
          name="EyeL"
          castShadow
          receiveShadow
          geometry={nodes.EyeL.geometry}
          material={nodes.EyeL.material}
          position={[-0.105, 0.076, 0.228]}
          scale={1.5}
        />
        <mesh
          ref={eyeRRef}
          name="EyeR"
          castShadow
          receiveShadow
          geometry={nodes.EyeR.geometry}
          material={nodes.EyeR.material}
          position={[0.105, 0.076, 0.228]}
          scale={1.5}
        />
        <mesh
          ref={pupilLRef}
          name="PupilL"
          castShadow
          receiveShadow
          geometry={nodes.PupilL.geometry}
          material={materials['Material.005']}
          position={[-0.103, 0.08, 0.218]}
        />
        <mesh
          ref={pupilRRef}
          name="PupilR"
          castShadow
          receiveShadow
          geometry={nodes.PupilR.geometry}
          material={materials['Material.006']}
          position={[0.103, 0.08, 0.218]}
        />
        {/* <mesh
          name="Mouth"
          castShadow
          receiveShadow
          geometry={nodes.Mouth.geometry}
          material={materials['Material.007']}
          morphTargetDictionary={nodes.Mouth.morphTargetDictionary}
          morphTargetInfluences={nodes.Mouth.morphTargetInfluences}
          position={[0, -0.079, 0.258]}
          scale={[1.2, 0.4, 1]}
        /> */}
      </group>
    </group>
  )
}

useGLTF.preload('/3DModels/bumpy.glb')