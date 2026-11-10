import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { DIFFICULTIES, PIT_Y, type Vec3 } from '../../../shared/level'
import { live, useNet } from '../net'
import { getMats } from './materials'

const BASE = {
  neonCyan: new THREE.Color('#22f0ff').multiplyScalar(3),
  neonPink: new THREE.Color('#ff2e88').multiplyScalar(3),
  neonAcid: new THREE.Color('#e6ff3a').multiplyScalar(2.5),
  emergency: new THREE.Color('#ff1a1a').multiplyScalar(3),
  tunnelLamp: new THREE.Color('#ffb36b').multiplyScalar(2),
}
const OFF = new THREE.Color('#050506')
const DIM_RED = new THREE.Color('#ff1a1a').multiplyScalar(0.25)

interface L { p: Vec3; on: string; off: string; i: number; d: number; flicker?: number }
// Fixed light set: count never changes, so shaders never recompile.
const LIGHTS: L[] = [
  { p: [-16, 5, -3], on: '#22f0ff', off: '#ff1a1a', i: 18, d: 16, flicker: 0.02 },
  { p: [-5, 5, -3], on: '#ff2e88', off: '#000000', i: 16, d: 16 },
  { p: [6, 5, -3], on: '#22f0ff', off: '#ff1a1a', i: 18, d: 16, flicker: 0.05 },
  { p: [17, 5, -3], on: '#ff2e88', off: '#000000', i: 16, d: 16 },
  { p: [-10, 4, 6], on: '#e6ff3a', off: '#000000', i: 8, d: 12 },
  { p: [10, 4, 6], on: '#22f0ff', off: '#ff1a1a', i: 8, d: 12, flicker: 0.1 },
  { p: [-8, 2.9, -12], on: '#22f0ff', off: '#000000', i: 10, d: 10, flicker: 0.04 },
  { p: [8, 2.6, -8.8], on: '#e6ff3a', off: '#000000', i: 6, d: 6 },
  { p: [-36, PIT_Y + 3, 7.5], on: '#ffb36b', off: '#ff1a1a', i: 7, d: 14, flicker: 0.25 },
  { p: [36, PIT_Y + 3, 7.5], on: '#ffb36b', off: '#ff1a1a', i: 7, d: 14, flicker: 0.2 },
  { p: [56, PIT_Y + 2.6, 8], on: '#ff1a1a', off: '#ff1a1a', i: 10, d: 12, flicker: 0.35 },
  // expansion
  { p: [-35, PIT_Y + 3.4, -1], on: '#22f0ff', off: '#ff1a1a', i: 12, d: 16, flicker: 0.05 },
  { p: [28, 2.6, -3], on: '#ff2e88', off: '#ff1a1a', i: 6, d: 10 },
  { p: [40, 4.4, -8], on: '#ff9a1f', off: '#ff1a1a', i: 16, d: 18, flicker: 0.03 },
  { p: [52, 4.4, -8], on: '#22f0ff', off: '#000000', i: 16, d: 18 },
  { p: [56.4, 3.2, -8], on: '#fff1d6', off: '#000000', i: 7, d: 7 },
]
const BRIGHT = 1.45 // global light boost (players asked for a brighter station)

export function Lights() {
  const refs = useRef<(THREE.PointLight | null)[]>([])
  const amb = useRef<THREE.AmbientLight>(null)
  const hemi = useRef<THREE.HemisphereLight>(null)
  const flick = useRef(LIGHTS.map(() => 1))
  const colors = useRef(LIGHTS.map((l) => ({ on: new THREE.Color(l.on), off: new THREE.Color(l.off) })))

  useFrame(({ clock }, dt) => {
    const g = useNet.getState().game
    const power = !!g?.power
    const cfg = DIFFICULTIES[g?.difficulty ?? 'normal']
    const now = performance.now()
    const blackout = now < live.blackoutUntil
    const quake = live.shake > 0.3
    const t = clock.elapsedTime
    const mats = getMats()

    if (amb.current) amb.current.intensity = blackout ? 0.04 : cfg.ambient * (power ? 1.7 : 1)
    if (hemi.current) hemi.current.intensity = blackout ? 0.02 : power ? 0.6 : 0.3

    LIGHTS.forEach((l, i) => {
      const light = refs.current[i]
      if (!light) return
      // random flicker drops
      if (Math.random() < (l.flicker ?? 0) * dt * 20 || (quake && Math.random() < 0.2)) flick.current[i] = Math.random() * 0.3
      flick.current[i] += (1 - flick.current[i]) * Math.min(1, dt * 6)
      const c = colors.current[i]
      light.color.copy(power ? c.on : c.off)
      const pulse = power ? 1 : 0.55 + 0.25 * Math.sin(t * 2.3 + i) // emergency pulse
      light.intensity = blackout ? 0 : BRIGHT * l.i * pulse * flick.current[i] * (power || l.off !== '#000000' ? 1 : 0)
    })

    // neon tubes: dead without power except emergency lamps
    const f = 0.8 + 0.2 * Math.sin(t * 50) * (Math.random() < 0.02 ? 1 : 0)
    const set = (key: keyof typeof BASE, on: boolean, mult = 1) => {
      const m = mats[key]
      if (blackout || !on) m.color.copy(key === 'emergency' && !blackout ? DIM_RED : OFF)
      else m.color.copy(BASE[key]).multiplyScalar(mult)
    }
    set('neonCyan', power, f)
    set('neonPink', power, flick.current[1])
    set('neonAcid', power, 1)
    set('tunnelLamp', power, flick.current[8])
    set('emergency', true, power ? 0.4 : 0.6 + 0.4 * Math.sin(t * 3))
  })

  return (
    <>
      <ambientLight ref={amb} intensity={0.2} color="#9fb6ff" />
      <hemisphereLight ref={hemi} args={['#22f0ff', '#1a0b14', 0.2]} />
      {LIGHTS.map((l, i) => (
        <pointLight key={i} ref={(el) => { refs.current[i] = el }} position={l.p} distance={l.d} decay={1.6} intensity={l.i} color={l.on} />
      ))}
    </>
  )
}
