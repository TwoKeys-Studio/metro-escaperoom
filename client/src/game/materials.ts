import * as THREE from 'three'
import { concreteSet, floorSet, glowTexture, gravelSet, hazardSet, metalSet, tileSet } from './textures'

let mats: ReturnType<typeof build> | null = null

function build() {
  const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(o)
  const ns = (n: number) => new THREE.Vector2(n, n)
  const neon = (hex: string, k: number) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k), toneMapped: false })
  // additive "light card": fakes the spill of a lamp on the surface behind it, costs no real light
  const glow = (hex: string, kind: 'round' | 'strip' = 'round') => new THREE.MeshBasicMaterial({
    color: new THREE.Color(hex), map: glowTexture(kind), transparent: true, blending: THREE.AdditiveBlending,
    depthWrite: false, toneMapped: false, fog: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  })
  const tile = tileSet('tile', '#2f5258')
  const tileD = tileSet('tileD', '#3a2630')
  const conc = concreteSet(11)
  const concD = concreteSet(23)
  const plate = metalSet('plate')
  const rusty = metalSet('rust')
  return {
    tile: std({ ...tile, roughness: 1, metalness: 0.05, normalScale: ns(0.9) }),
    tileDark: std({ ...tileD, roughness: 1, metalness: 0.05, normalScale: ns(0.9) }),
    floor: std({ ...floorSet(), roughness: 1, metalness: 0.1, normalScale: ns(0.6) }),
    concrete: std({ ...conc, roughness: 1, normalScale: ns(1) }),
    concreteDark: std({ ...concD, roughness: 1, color: '#868c92', normalScale: ns(1) }),
    metal: std({ ...plate, roughness: 1, metalness: 0.7, normalScale: ns(0.8) }),
    rust: std({ ...rusty, roughness: 1, metalness: 0.3, normalScale: ns(1) }),
    hazard: std({ ...hazardSet(), roughness: 1, metalness: 0.2, normalScale: ns(0.6) }),
    black: std({ color: '#07090c', roughness: 0.6, metalness: 0.3 }),
    rail: std({ color: '#5d646c', roughness: 0.3, metalness: 0.95 }),
    wood: std({ color: '#3a2a20', roughness: 0.9 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#0f2a30', roughness: 0.1, metalness: 0, transmission: 0, transparent: true, opacity: 0.35 }),
    // neon materials: colour pushed above 1 so bloom picks them up; animated in Lights
    neonCyan: neon('#22f0ff', 3),
    neonPink: neon('#ff2e88', 3),
    neonAcid: neon('#e6ff3a', 2.5),
    emergency: neon('#ff1a1a', 3),
    tunnelLamp: neon('#ffb36b', 2),
    // ---- added for the environment pass ----
    gravel: std({ ...gravelSet(), roughness: 1, normalScale: ns(1.2) }),
    paint: std({ color: '#14181c', roughness: 0.55, metalness: 0.5 }), // dark enamelled steel: fixtures, frames, trays
    trim: std({ color: '#4d555e', roughness: 0.38, metalness: 0.85 }), // bare worn steel: nosings, handrails, kerbs
    stone: std({ color: '#3b4046', roughness: 0.5, metalness: 0.05, map: conc.map, normalMap: conc.normalMap, normalScale: ns(0.5) }),
    pipe: std({ color: '#5a3b2c', roughness: 0.7, metalness: 0.5 }),
    pipeTeal: std({ color: '#1f4347', roughness: 0.5, metalness: 0.5 }),
    cable: std({ color: '#0a0b0d', roughness: 0.75, metalness: 0.1 }),
    neonAmber: neon('#ff9a1f', 2.6),
    glowCyan: glow('#22f0ff'),
    glowPink: glow('#ff2e88'),
    glowAcid: glow('#e6ff3a'),
    glowAmber: glow('#ff9a1f'),
    glowWarm: glow('#ffb36b'),
    glowRed: glow('#ff1a1a'),
    stripCyan: glow('#22f0ff', 'strip'),
    stripPink: glow('#ff2e88', 'strip'),
    stripAcid: glow('#e6ff3a', 'strip'),
  }
}

export function getMats() {
  if (!mats) mats = build()
  return mats
}
export type MatKey = keyof ReturnType<typeof build>
