import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { BallCollider, CuboidCollider, CylinderCollider } from '@react-three/rapier'
import type { ItemKind } from '../../../shared/level'

// The second floor's things: gas cylinders for the boiler rig, rats, and the debris of 1977.
// Each mesh fits inside its collider below, and faces +z (a carried item turns +z to the player).

export type ExtraKind = 'gas' | 'rat' | 'doll' | 'skull' | 'book' | 'mask' | 'jar'
export const isExtraKind = (k: ItemKind): k is ExtraKind => k === 'gas' || k === 'rat' || k === 'doll' || k === 'skull' || k === 'book' || k === 'mask' || k === 'jar'

export function ExtraCollider({ kind }: { kind: ExtraKind }) {
  switch (kind) {
    case 'gas': return <CylinderCollider args={[0.42, 0.11]} friction={0.9} />
    case 'rat': return <CuboidCollider args={[0.05, 0.045, 0.12]} friction={1} />
    case 'doll': return <CuboidCollider args={[0.09, 0.2, 0.07]} friction={0.9} />
    case 'skull': return <BallCollider args={[0.11]} friction={0.8} />
    case 'book': return <CuboidCollider args={[0.11, 0.03, 0.15]} friction={1} />
    case 'mask': return <BallCollider args={[0.13]} friction={0.9} />
    case 'jar': return <CylinderCollider args={[0.11, 0.07]} friction={0.7} />
  }
}

const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(o)
const lit = (hex: string, k: number) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k), toneMapped: false })
let cache: ReturnType<typeof build> | null = null
function build() {
  return {
    tank: std({ color: '#b3261e', roughness: 0.45, metalness: 0.55 }),
    tankBand: std({ color: '#e6ff3a', roughness: 0.6, metalness: 0.2 }),
    brass: std({ color: '#b08a3c', roughness: 0.3, metalness: 0.9 }),
    steel: std({ color: '#6b747d', roughness: 0.35, metalness: 0.9 }),
    black: std({ color: '#0b0d10', roughness: 0.7, metalness: 0.2 }),
    fur: std({ color: '#2b2622', roughness: 1 }),
    skin: std({ color: '#a8776a', roughness: 0.8 }),
    eye: lit('#ff2a2a', 2.2),
    bone: std({ color: '#d8cfb8', roughness: 0.75 }),
    porcelain: std({ color: '#e9e4da', roughness: 0.35 }),
    dress: std({ color: '#d9d6cf', roughness: 0.9 }),
    blood: std({ color: '#5a0a0a', roughness: 0.5 }),
    hair: std({ color: '#0a0806', roughness: 0.95 }),
    cover: std({ color: '#3c1f1a', roughness: 0.85 }),
    pages: std({ color: '#c9bfa3', roughness: 0.95 }),
    rubber: std({ color: '#1b2320', roughness: 0.8 }),
    lens: std({ color: '#0d1a1c', roughness: 0.08, metalness: 0.9 }),
    filter: std({ color: '#4a5a4c', roughness: 0.6, metalness: 0.5 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#9fd8c8', roughness: 0.05, transparent: true, opacity: 0.32, depthWrite: false }),
    murk: std({ color: '#5a6b2a', emissive: '#232b0c', roughness: 0.3, transparent: true, opacity: 0.8 }),
    lid: std({ color: '#7a6a3a', roughness: 0.5, metalness: 0.7 }),
  }
}
const mats = () => (cache ??= build())

function Rat() {
  const m = mats()
  const tail = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const seed = useRef(Math.random() * 10)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed.current
    if (tail.current) tail.current.rotation.y = Math.sin(t * 7) * 0.5
    // breathing, and the occasional twitch
    if (body.current) body.current.scale.y = 1 + Math.sin(t * 9) * 0.05 + (Math.sin(t * 1.3) > 0.97 ? 0.12 : 0)
  })
  return (
    <group>
      <group ref={body}>
        <mesh material={m.fur} position={[0, 0, -0.02]} scale={[1, 0.85, 1.6]}>
          <sphereGeometry args={[0.05, 10, 8]} />
        </mesh>
        <mesh material={m.fur} position={[0, 0.005, 0.07]} scale={[0.8, 0.8, 1.2]}>
          <sphereGeometry args={[0.035, 10, 8]} />
        </mesh>
      </group>
      <mesh material={m.skin} position={[0, -0.002, 0.115]}>
        <sphereGeometry args={[0.009, 6, 6]} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh material={m.eye} position={[0.016 * s, 0.02, 0.092]}>
            <sphereGeometry args={[0.006, 6, 6]} />
          </mesh>
          <mesh material={m.skin} position={[0.024 * s, 0.035, 0.062]} rotation-y={0.5 * s}>
            <circleGeometry args={[0.015, 8]} />
          </mesh>
          {[-0.045, 0.04].map((z) => (
            <mesh key={z} material={m.skin} position={[0.03 * s, -0.036, z]}>
              <boxGeometry args={[0.012, 0.012, 0.022]} />
            </mesh>
          ))}
        </group>
      ))}
      <group ref={tail} position={[0, -0.01, -0.09]}>
        <mesh material={m.skin} position={[0, 0, -0.012]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.004, 0.008, 0.03, 6]} />
        </mesh>
      </group>
    </group>
  )
}

export function ExtraMesh({ kind }: { kind: ExtraKind }) {
  const m = mats()
  switch (kind) {
    case 'rat': return <Rat />
    case 'gas':
      return (
        <group dispose={null}>
          <mesh material={m.tank} castShadow>
            <cylinderGeometry args={[0.105, 0.105, 0.62, 18]} />
          </mesh>
          <mesh material={m.tank} position-y={0.31} scale={[1, 0.55, 1]}>
            <sphereGeometry args={[0.105, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
          <mesh material={m.black} position-y={-0.325}>
            <cylinderGeometry args={[0.108, 0.108, 0.03, 18]} />
          </mesh>
          <mesh material={m.tankBand} position-y={0.14}>
            <cylinderGeometry args={[0.107, 0.107, 0.07, 18]} />
          </mesh>
          <mesh material={m.brass} position-y={0.385}>
            <cylinderGeometry args={[0.022, 0.03, 0.05, 10]} />
          </mesh>
          <mesh material={m.steel} position-y={0.41} rotation-x={Math.PI / 2}>
            <torusGeometry args={[0.035, 0.007, 6, 14]} />
          </mesh>
          <mesh material={m.brass} position={[0, 0.39, 0.035]} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.01, 0.01, 0.04, 8]} />
          </mesh>
        </group>
      )
    case 'doll':
      return (
        <group dispose={null}>
          {/* white dress, stained at the hem */}
          <mesh material={m.dress} position-y={-0.06}>
            <cylinderGeometry args={[0.035, 0.085, 0.24, 12]} />
          </mesh>
          <mesh material={m.blood} position-y={-0.165}>
            <cylinderGeometry args={[0.083, 0.087, 0.03, 12]} />
          </mesh>
          <mesh material={m.porcelain} position-y={0.115}>
            <sphereGeometry args={[0.055, 14, 12]} />
          </mesh>
          {/* long dark hair down the back and sides */}
          <mesh material={m.hair} position={[0, 0.115, -0.012]} scale={[1.08, 1.08, 1]}>
            <sphereGeometry args={[0.056, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
          </mesh>
          <mesh material={m.hair} position={[0, 0.03, -0.045]}>
            <boxGeometry args={[0.1, 0.19, 0.025]} />
          </mesh>
          {[-1, 1].map((s) => (
            <group key={s}>
              <mesh material={m.black} position={[0.02 * s, 0.122, 0.048]}>
                <sphereGeometry args={[0.011, 8, 8]} />
              </mesh>
              <mesh material={m.porcelain} position={[0.06 * s, -0.03, 0]} rotation-z={0.35 * s}>
                <cylinderGeometry args={[0.011, 0.009, 0.13, 6]} />
              </mesh>
            </group>
          ))}
          <mesh material={m.blood} position={[0.018, 0.1, 0.05]}>
            <boxGeometry args={[0.006, 0.03, 0.004]} />
          </mesh>
        </group>
      )
    case 'skull':
      return (
        <group dispose={null}>
          <mesh material={m.bone} position-y={0.015} scale={[0.9, 1, 1.05]} castShadow>
            <sphereGeometry args={[0.1, 14, 12]} />
          </mesh>
          <mesh material={m.bone} position={[0, -0.065, 0.035]}>
            <boxGeometry args={[0.1, 0.06, 0.09]} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} material={m.black} position={[0.036 * s, 0.01, 0.086]}>
              <sphereGeometry args={[0.026, 8, 8]} />
            </mesh>
          ))}
          <mesh material={m.black} position={[0, -0.03, 0.098]}>
            <coneGeometry args={[0.012, 0.03, 3]} />
          </mesh>
          {[-0.03, -0.01, 0.01, 0.03].map((x) => (
            <mesh key={x} material={m.black} position={[x, -0.075, 0.081]}>
              <boxGeometry args={[0.003, 0.03, 0.004]} />
            </mesh>
          ))}
        </group>
      )
    case 'book':
      return (
        <group dispose={null}>
          <mesh material={m.cover} castShadow>
            <boxGeometry args={[0.215, 0.056, 0.295]} />
          </mesh>
          <mesh material={m.pages} position-x={0.006}>
            <boxGeometry args={[0.212, 0.042, 0.28]} />
          </mesh>
          <mesh material={m.brass} position={[0, 0.029, 0]}>
            <boxGeometry args={[0.1, 0.002, 0.04]} />
          </mesh>
          <mesh material={m.blood} position={[0.05, 0.029, 0.09]} rotation-y={0.5}>
            <boxGeometry args={[0.07, 0.002, 0.05]} />
          </mesh>
        </group>
      )
    case 'mask':
      return (
        <group dispose={null}>
          <mesh material={m.rubber} scale={[0.95, 1.1, 0.9]} castShadow>
            <sphereGeometry args={[0.115, 14, 12]} />
          </mesh>
          {[-1, 1].map((s) => (
            <group key={s} position={[0.045 * s, 0.03, 0.085]} rotation-y={0.25 * s}>
              <mesh material={m.steel} rotation-x={Math.PI / 2}>
                <cylinderGeometry args={[0.036, 0.036, 0.02, 14]} />
              </mesh>
              <mesh material={m.lens} position-z={0.011}>
                <circleGeometry args={[0.03, 14]} />
              </mesh>
            </group>
          ))}
          <mesh material={m.filter} position={[0, -0.06, 0.1]} rotation-x={Math.PI / 2 - 0.5}>
            <cylinderGeometry args={[0.04, 0.045, 0.06, 14]} />
          </mesh>
          <mesh material={m.black} position={[0, -0.075, 0.125]} rotation-x={Math.PI / 2 - 0.5}>
            <cylinderGeometry args={[0.043, 0.043, 0.012, 14]} />
          </mesh>
        </group>
      )
    case 'jar':
      return (
        <group dispose={null}>
          <mesh material={m.murk} position-y={-0.02}>
            <cylinderGeometry args={[0.06, 0.06, 0.15, 14]} />
          </mesh>
          {/* something that looks back */}
          <mesh material={m.porcelain} position={[0.005, -0.02, 0.01]}>
            <sphereGeometry args={[0.03, 10, 10]} />
          </mesh>
          <mesh material={m.black} position={[0.005, -0.02, 0.037]}>
            <sphereGeometry args={[0.012, 8, 8]} />
          </mesh>
          <mesh material={m.glass}>
            <cylinderGeometry args={[0.067, 0.067, 0.2, 14]} />
          </mesh>
          <mesh material={m.lid} position-y={0.1}>
            <cylinderGeometry args={[0.07, 0.07, 0.022, 14]} />
          </mesh>
        </group>
      )
  }
}
