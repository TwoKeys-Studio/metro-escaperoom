import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { F2_ROOMS, F2_ROOM_Z, F2_CORRIDOR, F2_Y, type Vec3 } from '../../../shared/level'
import { live, useNet } from '../net'
import { sfx } from './audio'
import { STAIR_DOOR } from './Floor2'

// Things seen for a second and never explained. Each is started by a server event aimed at one player
// (shared/protocol.ts EventType) and only that player sees it:
//   ghostWoman — a woman in a white dress crosses the way ahead and is gone
//   peeker     — a head leans out from behind a door frame, looks at the player, and hides
//   laugh      — laughter somewhere close in the dark
// They are drawn with a little light of their own, or nobody would see them in the dark.

const EYE = 1.6 // the player's eye height above the floor they stand on

const pale = new THREE.MeshStandardMaterial({ color: '#d8d1c6', emissive: '#8a847b', emissiveIntensity: 0.8, roughness: 0.8 })
const dress = new THREE.MeshStandardMaterial({ color: '#e4e0d8', emissive: '#8a867e', emissiveIntensity: 0.6, roughness: 0.95, side: THREE.DoubleSide })
const hair = new THREE.MeshStandardMaterial({ color: '#050403', roughness: 1 })
const voidBlack = new THREE.MeshBasicMaterial({ color: '#000000' })
const blood = new THREE.MeshStandardMaterial({ color: '#6b0707', emissive: '#3a0303', emissiveIntensity: 0.6, roughness: 0.5 })

/** Pale face, long dark hair, and holes where the eyes should be. Faces +z; origin at the centre of the head. */
export function Head() {
  return (
    <group>
      <mesh material={pale} scale={[0.9, 1.12, 0.95]}>
        <sphereGeometry args={[0.11, 16, 14]} />
      </mesh>
      <mesh material={hair} position={[0, 0.012, -0.02]} scale={[1, 1.14, 1.04]}>
        <sphereGeometry args={[0.116, 16, 14, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
      </mesh>
      {/* hair hanging down both sides of the face and the back */}
      {[-1, 1].map((s) => (
        <mesh key={s} material={hair} position={[0.085 * s, -0.16, 0.025]}>
          <boxGeometry args={[0.05, 0.46, 0.12]} />
        </mesh>
      ))}
      <mesh material={hair} position={[0, -0.18, -0.08]}>
        <boxGeometry args={[0.2, 0.5, 0.06]} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh material={voidBlack} position={[0.038 * s, 0.012, 0.092]} scale={[1, 1.25, 0.5]}>
            <sphereGeometry args={[0.026, 10, 10]} />
          </mesh>
          {/* what runs from them */}
          <mesh material={blood} position={[0.038 * s, -0.045, 0.098]}>
            <boxGeometry args={[0.008, 0.085, 0.004]} />
          </mesh>
        </group>
      ))}
      <mesh material={voidBlack} position={[0, -0.062, 0.096]} scale={[1, 0.5, 0.4]}>
        <sphereGeometry args={[0.03, 10, 8]} />
      </mesh>
    </group>
  )
}

export function Woman() {
  return (
    <group>
      {/* dress to the floor, dark and wet at the hem and down the front */}
      <mesh material={dress} position-y={0.66}>
        <cylinderGeometry args={[0.13, 0.34, 1.32, 14, 1, true]} />
      </mesh>
      <mesh material={blood} position-y={0.07}>
        <cylinderGeometry args={[0.325, 0.345, 0.16, 14, 1, true]} />
      </mesh>
      <mesh material={blood} position={[0.03, 0.95, 0.14]} rotation-x={-0.14}>
        <boxGeometry args={[0.12, 0.5, 0.01]} />
      </mesh>
      <mesh material={dress} position-y={1.36} scale={[1, 0.6, 0.7]}>
        <sphereGeometry args={[0.17, 12, 10]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} material={pale} position={[0.2 * s, 1.02, 0.02]} rotation-z={0.1 * s}>
          <cylinderGeometry args={[0.028, 0.022, 0.66, 8]} />
        </mesh>
      ))}
      <group position-y={1.58}>
        <Head />
      </group>
    </group>
  )
}

/** Unit vectors of where the player looks (flat) and their right-hand side. */
function facing() {
  const yaw = live.me.yaw
  return { fwd: new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)), right: new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)) }
}

function GhostWoman() {
  const g = useRef<THREE.Group>(null)
  const st = useRef({ seen: 0, t0: 0, from: new THREE.Vector3(), to: new THREE.Vector3(), active: false })
  const myId = useNet((s) => s.myId)
  useFrame(() => {
    const o = g.current
    if (!o) return
    const s = st.current
    const ev = live.events.find((e) => e.type === 'ghostWoman' && e.t > s.seen)
    if (ev) {
      s.seen = ev.t
      if (ev.target === myId) {
        // she crosses the way ahead, side to side, 7–10 m off, in under a second: far and brief enough to doubt it
        const { fwd, right } = facing()
        const side = Math.random() < 0.5 ? -1 : 1
        const centre = new THREE.Vector3(...live.me.p).addScaledVector(fwd, 7 + Math.random() * 3)
        centre.y = live.me.p[1] - EYE
        s.from.copy(centre).addScaledVector(right, -2.6 * side)
        s.to.copy(centre).addScaledVector(right, 2.6 * side)
        s.t0 = performance.now()
        s.active = true
        o.visible = true
        o.rotation.y = Math.atan2(s.to.x - s.from.x, s.to.z - s.from.z)
        live.glitchUntil = performance.now() + 220
        sfx.whisper([centre.x, centre.y + 1.5, centre.z])
      }
    }
    if (!s.active) return
    const k = (performance.now() - s.t0) / 850
    if (k >= 1) {
      s.active = false
      o.visible = false
      return
    }
    o.position.lerpVectors(s.from, s.to, k)
    o.position.y += Math.sin(k * 40) * 0.01 // she does not quite walk
  })
  return (
    <group ref={g} visible={false}>
      <Woman />
    </group>
  )
}

/** A place a head can lean out from: hidden at `hide`, visible at `show`. */
interface Nook { hide: Vec3; show: Vec3 }
const NOOKS: Nook[] = [
  // second floor: from inside each room, round either side of its door
  ...F2_ROOMS.flatMap((r) => {
    const x = (r.minX + r.maxX) / 2
    const wall = (F2_ROOM_Z.maxZ + F2_CORRIDOR.minZ) / 2
    // hidden inside the room beside the door; shown leaning out of the doorway into the corridor
    return [-1, 1].map((s): Nook => ({ hide: [x + s * 0.95, F2_Y + 1.55, wall - 0.4], show: [x + s * 0.4, F2_Y + 1.55, wall + 0.16] }))
  }),
  // from the stairwell into the maintenance room
  ...[-1, 1].map((s): Nook => ({ hide: [-14.7, 1.55, STAIR_DOOR.z + s * 0.9], show: [-14.7, 1.55, STAIR_DOOR.z + s * 0.42] })),
  // from the maintenance room into the hall, round the service door
  ...[-1, 1].map((s): Nook => ({ hide: [-8 + s * 1.5, 1.55, -7.6], show: [-8 + s * 0.85, 1.55, -7.6] })),
]

function Peeker() {
  const g = useRef<THREE.Group>(null)
  const st = useRef({ seen: 0, t0: 0, nook: null as Nook | null })
  const myId = useNet((s) => s.myId)
  const tmp = useRef({ a: new THREE.Vector3(), b: new THREE.Vector3() })
  useFrame(() => {
    const o = g.current
    if (!o) return
    const s = st.current
    const ev = live.events.find((e) => e.type === 'peeker' && e.t > s.seen)
    if (ev) {
      s.seen = ev.t
      if (ev.target === myId) {
        // the nearest nook that is in front of the player, on their floor, and not on top of them
        const me = new THREE.Vector3(...live.me.p)
        const { fwd } = facing()
        const best = NOOKS
          .map((n) => ({ n, v: new THREE.Vector3(...n.show).sub(me) }))
          .filter(({ v }) => Math.abs(v.y) < 1.5 && v.length() > 3 && v.length() < 16 && v.clone().setY(0).normalize().dot(fwd) > 0.3)
          .sort((a, b) => a.v.length() - b.v.length())[0]
        if (best) {
          s.nook = best.n
          s.t0 = performance.now()
          o.visible = true
        } else {
          // nowhere to hide near this player: they only hear it, behind them
          sfx.laugh([me.x - fwd.x * 4, me.y, me.z - fwd.z * 4])
        }
      }
    }
    const n = s.nook
    if (!n) return
    const t = (performance.now() - s.t0) / 1000
    // lean out (0.35 s), stare (1.1 s), snap back (0.12 s)
    const k = t < 0.35 ? t / 0.35 : t < 1.45 ? 1 : Math.max(0, 1 - (t - 1.45) / 0.12)
    o.position.lerpVectors(tmp.current.a.set(...n.hide), tmp.current.b.set(...n.show), k * k * (3 - 2 * k))
    o.lookAt(live.me.p[0], live.me.p[1], live.me.p[2])
    o.rotation.z = 0.35 * Math.sign(n.show[0] - n.hide[0] || n.show[2] - n.hide[2]) // head tilted into the gap
    if (t > 1.57) {
      s.nook = null
      o.visible = false
      // and from where it hid, a moment later, laughter
      setTimeout(() => sfx.laugh(n.hide), 500 + Math.random() * 900)
    }
  })
  return (
    // a little larger than life: it has to be noticed from the far end of a corridor
    <group ref={g} visible={false} scale={1.45}>
      <Head />
      {/* a shoulder of the white dress */}
      <mesh material={dress} position={[0, -0.27, -0.04]} scale={[1.25, 0.55, 0.7]}>
        <sphereGeometry args={[0.17, 12, 10]} />
      </mesh>
      {/* fingers on the door frame */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} material={pale} position={[0.13, -0.2 - i * 0.03, 0.06]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.009, 0.008, 0.07, 6]} />
        </mesh>
      ))}
    </group>
  )
}

function Laughter() {
  const seen = useRef(0)
  const myId = useNet((s) => s.myId)
  useFrame(() => {
    const ev = live.events.find((e) => e.type === 'laugh' && e.t > seen.current)
    if (!ev) return
    seen.current = ev.t
    if (ev.target && ev.target !== myId) return
    const a = Math.random() * Math.PI * 2
    const d = 3 + Math.random() * 4
    sfx.laugh([live.me.p[0] + Math.cos(a) * d, live.me.p[1], live.me.p[2] + Math.sin(a) * d])
  })
  return null
}

export function Apparitions() {
  return (
    <>
      <GhostWoman />
      <Peeker />
      <Laughter />
    </>
  )
}
