import * as THREE from 'three'
import { concreteTexture, floorTexture, hazardTexture, metalTexture, tileTexture } from './textures'

let mats: ReturnType<typeof build> | null = null

function build() {
  const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(o)
  return {
    tile: std({ map: tileTexture('tile', '#1d3236', [1, 1]), roughness: 0.35, metalness: 0.1 }),
    tileDark: std({ map: tileTexture('tileD', '#2a1a24', [1, 1]), roughness: 0.4, metalness: 0.1 }),
    floor: std({ map: floorTexture([1, 1]), roughness: 0.3, metalness: 0.2 }),
    concrete: std({ map: concreteTexture([1, 1]), roughness: 0.92 }),
    concreteDark: std({ map: concreteTexture([1, 1], 23), roughness: 0.95, color: '#7a8086' }),
    metal: std({ map: metalTexture([1, 1]), roughness: 0.45, metalness: 0.75 }),
    rust: std({ map: metalTexture([1, 1]), roughness: 0.8, metalness: 0.4, color: '#8a5a44' }),
    hazard: std({ map: hazardTexture([1, 1]), roughness: 0.6 }),
    black: std({ color: '#07090c', roughness: 0.6, metalness: 0.3 }),
    rail: std({ color: '#5d646c', roughness: 0.3, metalness: 0.95 }),
    wood: std({ color: '#3a2a20', roughness: 0.9 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#0f2a30', roughness: 0.1, metalness: 0, transmission: 0, transparent: true, opacity: 0.35 }),
    // neon materials: colour pushed above 1 so bloom picks them up; animated in Lights
    neonCyan: new THREE.MeshBasicMaterial({ color: new THREE.Color('#22f0ff').multiplyScalar(3), toneMapped: false }),
    neonPink: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff2e88').multiplyScalar(3), toneMapped: false }),
    neonAcid: new THREE.MeshBasicMaterial({ color: new THREE.Color('#e6ff3a').multiplyScalar(2.5), toneMapped: false }),
    emergency: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff1a1a').multiplyScalar(3), toneMapped: false }),
    tunnelLamp: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb36b').multiplyScalar(2), toneMapped: false }),
  }
}

export function getMats() {
  if (!mats) mats = build()
  return mats
}
export type MatKey = keyof ReturnType<typeof build>
