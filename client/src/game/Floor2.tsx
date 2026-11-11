import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import {
  BREAKER_POS, F2_CORRIDOR, F2_H, F2_ROOMS, F2_ROOM_Z, F2_Y, GAS_DIAL_POS, GAS_DIAL_STEPS, GAS_SOCKETS, STAIRWELL, STORAGE_DOOR,
  f2Room, type F2RoomId, type Vec3,
} from '../../../shared/level'
import { live, useNet } from '../net'
import { BatchSet } from './geo'
import { getMats, type MatKey } from './materials'
import { Poster, Sign, useInteract } from './Puzzles'
import { plaqueTexture } from './textures'

// The second floor: a stairwell west of the maintenance room, a corridor, and five rooms off it.
// Layout numbers that the server also needs (sockets, breakers, item spots) are in shared/level.ts;
// this file is the walls, the furniture those items stand on, and everything players press or read.
//
//   stairwell   archive   medbay   dispatch   boiler   storage
//   (2 flights) ─────────────── corridor ──────────────────────
//
// How the floor is solved (server: puzzles/breakers.puzzle.ts, puzzles/gas.puzzle.ts):
//   1. The corridor lamps that still burn show which breakers to raise in the dispatch room.
//      The archive's duty log says the same in words.            → the storage room unlocks
//   2. Three gas cylinders (archive, medbay, storage) go into the boiler room rig.
//   3. Each regulator is clicked to its pressure: tally marks in the archive, the patient chart in the
//      medbay, the writing on the storage room wall.             → gas for the detonator

const TOP = F2_Y + F2_H
const WALL = 0.2
const X0 = F2_CORRIDOR.minX // west end of the floor
const X1 = F2_CORRIDOR.maxX
const ZN = F2_ROOM_Z.minZ // inner face of the rooms' far wall
const ZD = (F2_ROOM_Z.maxZ + F2_CORRIDOR.minZ) / 2 // the wall with the doors
const ZS = F2_CORRIDOR.maxZ // corridor's south side = stairwell's north side
const DOOR_W = 1.3
const DOOR_H = 2.3
const roomX = (id: F2RoomId) => (f2Room(id).minX + f2Room(id).maxX) / 2

// ---- stairs: two flights of 20 steps with a half landing, 0 → 3.5 → 7
const STEPS = 20
const RISE = F2_Y / 2 / STEPS
const RUN = 0.3
const FLIGHT = STEPS * RUN
const ST_Z0 = STAIRWELL.maxZ - 1.5 - FLIGHT // foot of the first flight (and head of the second)
const ST_Z1 = ST_Z0 + FLIGHT // the half landing starts here
const FA = { minX: STAIRWELL.minX + 0.1, maxX: STAIRWELL.minX + 2.4 } // first flight, west side
const FB = { minX: STAIRWELL.maxX - 2.5, maxX: STAIRWELL.maxX - 0.2 } // second flight, east side
const SLOPE = Math.atan2(F2_Y / 2, FLIGHT)
/** Doorway from the maintenance room into the stairwell (cut into that room's west wall in World.tsx). */
export const STAIR_DOOR = { z: (STAIRWELL.minZ + ST_Z0) / 2, width: 1.2, height: 2.2 }

interface Box { p: Vec3; s: Vec3; m: MatKey; c: boolean; r?: Vec3 }

function layout() {
  const boxes: Box[] = []
  const add = (p: Vec3, s: Vec3, m: MatKey, c = true) => boxes.push({ p, s, m, c })
  /** A wall along x at depth z with doorways cut out of it. */
  const wallX = (z: number, x0: number, x1: number, y0: number, y1: number, m: MatKey, doors: { x: number; w: number; h: number }[] = []) => {
    let from = x0
    for (const d of [...doors].sort((a, b) => a.x - b.x)) {
      if (d.x - d.w / 2 > from) add([(from + d.x - d.w / 2) / 2, (y0 + y1) / 2, z], [d.x - d.w / 2 - from, y1 - y0, WALL], m)
      add([d.x, (y0 + d.h + y1) / 2, z], [d.w, y1 - y0 - d.h, WALL], m) // lintel
      from = d.x + d.w / 2
    }
    if (x1 > from) add([(from + x1) / 2, (y0 + y1) / 2, z], [x1 - from, y1 - y0, WALL], m)
  }
  const wallZ = (x: number, z0: number, z1: number, y0: number, y1: number, m: MatKey) => add([x, (y0 + y1) / 2, (z0 + z1) / 2], [WALL, y1 - y0, z1 - z0], m)

  // ---------------- stairwell ----------------
  const S = STAIRWELL
  add([(S.minX + S.maxX) / 2, -0.25, (S.minZ + S.maxZ) / 2], [S.maxX - S.minX + 0.4, 0.5, S.maxZ - S.minZ + 0.4], 'concreteDark')
  wallZ(S.minX - WALL / 2, S.minZ - WALL, S.maxZ + WALL, 0, TOP, 'concrete')
  wallX(S.maxZ + WALL / 2, S.minX, S.maxX + 0.4, 0, TOP, 'concrete')
  wallX(ZS - WALL / 2, S.minX, S.maxX + 0.4, 0, F2_Y, 'concrete') // below the corridor
  wallZ(S.maxX + WALL / 2, S.minZ, S.maxZ, 3.2, TOP, 'concrete') // above the maintenance room's own wall
  add([(S.minX + S.maxX) / 2, TOP + 0.15, (S.minZ + S.maxZ) / 2], [S.maxX - S.minX + 0.4, 0.3, S.maxZ - S.minZ + 0.4], 'concreteDark')
  // steps (drawn only: the player walks on the two ramps in <Floor2>)
  for (let i = 0; i < STEPS; i++) {
    const h = (i + 1) * RISE
    add([(FA.minX + FA.maxX) / 2, h / 2, ST_Z0 + (i + 0.5) * RUN], [FA.maxX - FA.minX, h, RUN], 'concrete', false)
    add([(FB.minX + FB.maxX) / 2, (F2_Y / 2 + h) / 2, ST_Z1 - (i + 0.5) * RUN], [FB.maxX - FB.minX, F2_Y / 2 + h, RUN], 'concrete', false)
    for (const [f, z, y] of [[FA, ST_Z0 + i * RUN + 0.02, h], [FB, ST_Z1 - i * RUN - 0.02, F2_Y / 2 + h]] as const) {
      add([(f.minX + f.maxX) / 2, y - 0.012, z], [f.maxX - f.minX, 0.025, 0.04], 'trim', false) // worn steel nosing
    }
  }
  // the solid mass under the second flight closes the lobby on that side
  add([(FB.minX + FB.maxX) / 2, F2_Y / 4, (ST_Z0 + ST_Z1) / 2], [FB.maxX - FB.minX, F2_Y / 2, FLIGHT], 'concrete')
  // spine wall between the flights, doubling as the balustrade of the upper one
  add([(FA.maxX + FB.minX) / 2, (F2_Y + 1.1) / 2, (ST_Z0 + ST_Z1) / 2], [FB.minX - FA.maxX, F2_Y + 1.1, FLIGHT], 'concrete')
  // half landing and top landing
  add([(FA.minX + FB.maxX) / 2, F2_Y / 4, (ST_Z1 + S.maxZ) / 2], [FB.maxX - FA.minX, F2_Y / 2, S.maxZ - ST_Z1], 'concrete')
  add([(FA.minX + FB.maxX) / 2, F2_Y - 0.15, (S.minZ + ST_Z0) / 2], [FB.maxX - FA.minX + 0.3, 0.3, ST_Z0 - S.minZ], 'concreteDark')
  // balustrade where the top landing overlooks the first flight
  add([(FA.minX + FB.minX) / 2, F2_Y + 0.55, ST_Z0 - 0.06], [FB.minX - FA.minX, 1.1, 0.12], 'paint')
  add([(FA.minX + FB.minX) / 2, F2_Y + 1.12, ST_Z0 - 0.06], [FB.minX - FA.minX, 0.05, 0.16], 'trim', false)
  // handrails
  for (const [x, y0, z0, z1] of [[FA.minX + 0.05, 0.95, ST_Z0, ST_Z1], [FB.maxX - 0.05, F2_Y / 2 + 0.95, ST_Z1, ST_Z0]] as const) {
    boxes.push({ p: [x, y0 + F2_Y / 4, (z0 + z1) / 2], s: [0.05, 0.05, Math.hypot(FLIGHT, F2_Y / 2)], m: 'trim', c: false, r: [z1 > z0 ? -SLOPE : SLOPE, 0, 0] })
  }

  // ---------------- corridor and rooms: slab, ceiling, outer walls ----------------
  const ZO = ZN - WALL // outer face of the far wall
  add([(X0 + X1) / 2, F2_Y - 0.15, (ZO + ZS) / 2], [X1 - X0 + 0.4, 0.3, ZS - ZO], 'floor')
  add([(X0 + X1) / 2, TOP + 0.15, (ZO + ZS) / 2], [X1 - X0 + 0.4, 0.3, ZS - ZO], 'concreteDark')
  wallX(ZN - WALL / 2, X0 - WALL, X1 + WALL, F2_Y, TOP, 'tile')
  wallZ(X0 - WALL / 2, ZO, ZS, F2_Y, TOP, 'tile')
  wallZ(X1 + WALL / 2, ZO, ZS, F2_Y, TOP, 'tile')
  // south side of the corridor, open onto the top landing
  wallX(ZS - WALL / 2, X0, X1 + WALL, F2_Y, TOP, 'tile', [{ x: (FA.minX + FB.maxX) / 2, w: FB.maxX - FA.minX - 0.3, h: 2.5 }]) // as wide as the landing
  // the wall with the five doors, and the partitions between rooms
  wallX(ZD, X0, X1, F2_Y, TOP, 'tileDark', F2_ROOMS.map((r) => ({ x: (r.minX + r.maxX) / 2, w: DOOR_W, h: DOOR_H })))
  for (const r of F2_ROOMS.slice(1)) wallZ(r.minX, ZN, ZD, F2_Y, TOP, 'tileDark')
  for (const r of F2_ROOMS) {
    const x = (r.minX + r.maxX) / 2
    for (const s of [-1, 1]) add([x + s * (DOOR_W / 2 + 0.04), F2_Y + DOOR_H / 2, ZD], [0.08, DOOR_H, WALL + 0.06], 'paint', false)
    add([x, F2_Y + DOOR_H + 0.04, ZD], [DOOR_W + 0.16, 0.08, WALL + 0.06], 'paint', false)
  }
  // skirting and a pipe run down the corridor
  add([(X0 + X1) / 2, F2_Y + 0.08, ZS - WALL - 0.02], [X1 - X0, 0.16, 0.04], 'stone', false)
  add([(X0 + X1) / 2, TOP - 0.35, ZS - WALL - 0.12], [X1 - X0, 0.12, 0.12], 'pipe', false)
  add([(X0 + X1) / 2, TOP - 0.55, ZS - WALL - 0.1], [X1 - X0, 0.07, 0.07], 'pipeTeal', false)

  // ---------------- furniture (solid: things stand on it) ----------------
  const table = (x: number, z: number, w: number, d: number, m: MatKey = 'metal') => {
    add([x, F2_Y + 0.86, z], [w, 0.08, d], m)
    add([x, F2_Y + 0.41, z], [w - 0.1, 0.82, d - 0.1], 'paint')
  }
  // archive: desk, and a wall of shelves full of files nobody will read
  const ax = roomX('archive')
  table(ax + 1.2, ZN + 0.55, 2.4, 0.9, 'wood')
  add([ax - 2.5, F2_Y + 1.15, -23.4], [0.5, 2.3, 4.2], 'paint')
  for (let i = 0; i < 5; i++) add([ax - 2.24, F2_Y + 0.35 + i * 0.45, -23.4], [0.04, 0.04, 4.1], 'trim', false)
  for (let i = 0; i < 26; i++) add([ax - 2.22, F2_Y + 0.56 + (i % 4) * 0.45, -25.3 + Math.floor(i / 4) * 0.6 + (i % 3) * 0.07], [0.06, 0.3, 0.11 + (i % 3) * 0.03], i % 5 ? 'wood' : 'rust', false)
  // medbay: instrument shelf, a gurney, a screen
  const mx = roomX('medbay')
  table(mx - 1.6, ZN + 0.4, 1.7, 0.6)
  add([mx + 1.9, F2_Y + 0.5, -21.3], [0.8, 0.1, 1.9], 'metal')
  add([mx + 1.9, F2_Y + 0.225, -21.3], [0.7, 0.45, 1.7], 'paint')
  add([mx + 1.9, F2_Y + 0.585, -20.6], [0.6, 0.07, 0.4], 'stone', false) // pillow
  add([mx - 0.3, F2_Y + 1.0, -23.6], [0.04, 2.0, 1.8], 'stone', false) // folding screen
  add([mx + 2.3, F2_Y + 1.5, -26.2], [0.5, 1.4, 0.9], 'paint') // medicine cabinet
  // dispatch: two consoles under the breaker wall
  const dx = roomX('dispatch')
  table(dx + 2.0, -24, 1.2, 2.4)
  table(dx - 2.25, -25.5, 1.0, 2.2)
  for (let i = 0; i < 3; i++) add([dx + 2.52, F2_Y + 1.25, -24.8 + i * 0.8], [0.06, 0.5, 0.62], 'black', false) // dead monitors
  add([dx, F2_Y + 1.45, ZN + 0.06], [3.3, 0.9, 0.12], 'paint', false) // breaker panel back plate
  // boiler: the rig shelf, the boiler itself, pipes
  const bx = roomX('boiler')
  add([bx, F2_Y + 0.1, ZN + 0.5], [3.7, 0.2, 0.8], 'metal')
  add([bx, F2_Y + 1.1, ZN + 0.09], [3.7, 1.9, 0.1], 'paint', false)
  for (const s of GAS_SOCKETS) for (const y of [0.45, 0.85]) add([s.pos[0], F2_Y + y, ZN + 0.2], [0.34, 0.05, 0.2], 'trim', false)
  add([bx + 1.9, F2_Y + 1.1, -22.4], [1.4, 2.2, 1.6], 'rust')
  add([bx + 1.9, F2_Y + 2.5, -22.4], [0.3, 0.9, 0.3], 'pipe', false)
  add([bx, TOP - 0.3, -23.5], [0.14, 0.14, 7.6], 'pipe', false)
  add([bx - 1.2, TOP - 0.5, -23.5], [0.1, 0.1, 7.6], 'pipeTeal', false)
  // storage: lockers along the far and east walls, one fallen
  const sx = roomX('storage')
  for (let i = 0; i < 4; i++) add([sx - 1.9 + i * 0.8, F2_Y + 1.0, ZN + 0.3], [0.76, 2.0, 0.5], i === 2 ? 'rust' : 'paint')
  add([sx + 2.4, F2_Y + 1.0, -23.2], [0.5, 2.0, 2.4], 'paint')
  add([sx - 0.4, F2_Y + 0.26, -22.4], [0.76, 0.5, 2.0], 'rust')
  return boxes
}

// ---------------- things players press ----------------

function Breaker({ index, p }: { index: number; p: Vec3 }) {
  const hit = useRef<THREE.Mesh>(null)
  const arm = useRef<THREE.Group>(null)
  const mats = getMats()
  useInteract(hit, () => {
    const g = useNet.getState().game
    if (!g) return null
    if (g.storageOpen) return { kind: 'read', label: 'Щит заблокирован: камера хранения открыта' }
    return { kind: 'breaker', index, label: `Рубильник ${index + 1}: ${g.breakers[index] ? 'опустить' : 'поднять'}` }
  })
  useFrame((_, dt) => {
    const up = !!useNet.getState().game?.breakers[index]
    if (arm.current) arm.current.rotation.x += ((up ? -0.9 : 0.9) - arm.current.rotation.x) * Math.min(1, dt * 14)
  })
  return (
    <group position={p}>
      <mesh ref={hit} material={mats.black} position-z={0.03}>
        <boxGeometry args={[0.3, 0.52, 0.08]} />
      </mesh>
      <group ref={arm} position-z={0.08}>
        <mesh material={mats.trim} position-z={0.09} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.018, 0.018, 0.2, 8]} />
        </mesh>
        <mesh position-z={0.2}>
          <sphereGeometry args={[0.04, 10, 10]} />
          <meshStandardMaterial color="#c4102e" roughness={0.4} metalness={0.3} />
        </mesh>
      </group>
      <Sign text={String(index + 1)} p={[0, -0.36, 0.02]} w={0.2} h={0.16} o={{ color: '#e6f1f4', glow: 6 }} />
    </group>
  )
}

function GasDial({ index, p }: { index: number; p: Vec3 }) {
  const hit = useRef<THREE.Mesh>(null)
  const needle = useRef<THREE.Group>(null)
  const led = useRef<THREE.MeshBasicMaterial>(null)
  const mats = getMats()
  const angle = (v: number) => (120 - v * (240 / (GAS_DIAL_STEPS - 1))) * (Math.PI / 180)
  useInteract(hit, () => {
    const g = useNet.getState().game
    if (!g) return null
    if (g.gasOk) return { kind: 'read', label: 'Давление в норме' }
    return { kind: 'dial', index, label: `Редуктор Р-${index + 1}: сейчас ${g.gasDials[index]}, щёлкнуть дальше` }
  })
  useFrame((_, dt) => {
    const g = useNet.getState().game
    if (needle.current) needle.current.rotation.z += (angle(g?.gasDials[index] ?? 0) - needle.current.rotation.z) * Math.min(1, dt * 10)
    led.current?.color.set(g?.gasOk ? '#3dff8a' : '#ff2e88').multiplyScalar(g?.gasOk ? 3 : 1.2)
  })
  return (
    <group position={p}>
      <mesh ref={hit} material={mats.trim} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.2, 0.2, 0.06, 24]} />
      </mesh>
      <mesh position-z={0.032}>
        <circleGeometry args={[0.17, 24]} />
        <meshStandardMaterial color="#d9d4c4" roughness={0.6} />
      </mesh>
      {Array.from({ length: GAS_DIAL_STEPS }, (_, v) => (
        <Sign key={v} text={String(v)} p={[Math.sin(-angle(v)) * 0.125, Math.cos(angle(v)) * 0.125, 0.036]} w={0.07} h={0.07} o={{ color: '#111', glow: 0, bg: 'rgba(0,0,0,0)' }} glow={0.05} />
      ))}
      <group ref={needle} position-z={0.045}>
        <mesh position-y={0.055}>
          <boxGeometry args={[0.012, 0.12, 0.006]} />
          <meshBasicMaterial color="#c4102e" />
        </mesh>
      </group>
      <mesh material={mats.black} position-z={0.05} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.02, 0.02, 0.02, 10]} />
      </mesh>
      <mesh position={[0, -0.27, 0.02]}>
        <circleGeometry args={[0.025, 10]} />
        <meshBasicMaterial ref={led} toneMapped={false} />
      </mesh>
      <Sign text={`Р-${index + 1}`} p={[0, 0.3, 0.02]} w={0.3} h={0.14} o={{ color: '#ff9a1f', glow: 8 }} />
    </group>
  )
}

/** The clamp a gas cylinder stands in; its lamp turns green once one is in. */
function GasClamp({ id, p }: { id: string; p: Vec3 }) {
  const filled = useNet((s) => Object.values(s.items).some((i) => i.socket === id))
  return (
    <mesh position={[p[0], F2_Y + 0.24, p[2] + 0.16]} rotation-x={-Math.PI / 2}>
      <ringGeometry args={[0.13, 0.16, 20]} />
      <meshBasicMaterial color={new THREE.Color(filled ? '#3dff8a' : '#e6ff3a').multiplyScalar(filled ? 3 : 1.6)} toneMapped={false} />
    </mesh>
  )
}

/** Locked until the breakers are right; then it grinds up into the wall. */
function StorageDoor() {
  const open = useNet((s) => !!s.game?.storageOpen)
  const leaf = useRef<THREE.Mesh>(null)
  const mats = getMats()
  const y0 = F2_Y + STORAGE_DOOR.height / 2
  useFrame((_, dt) => {
    if (leaf.current) leaf.current.position.y += ((open ? y0 + STORAGE_DOOR.height - 0.15 : y0) - leaf.current.position.y) * Math.min(1, dt * 1.6)
  })
  return (
    <>
      {!open && (
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[STORAGE_DOOR.width / 2, STORAGE_DOOR.height / 2, 0.1]} position={[STORAGE_DOOR.x, y0, ZD]} />
        </RigidBody>
      )}
      <mesh ref={leaf} material={mats.rust} position={[STORAGE_DOOR.x, y0, ZD]}>
        <boxGeometry args={[STORAGE_DOOR.width, STORAGE_DOOR.height, 0.14]} />
      </mesh>
      <Sign text={open ? 'ОТКРЫТО' : 'ЗАПЕРТО · ЩИТ Д-2'} p={[STORAGE_DOOR.x, F2_Y + DOOR_H + 0.62, ZD + 0.12]} w={1.5} h={0.2} o={{ color: open ? '#3dff8a' : '#ff2e88', glow: 10 }} />
    </>
  )
}

/** Six lamps down the corridor. The ones still burning are the breakers to raise. */
function CorridorLamps() {
  const mats = useRef<(THREE.MeshBasicMaterial | null)[]>([])
  const xs = useMemo(() => Array.from({ length: 6 }, (_, i) => X0 + 2.2 + i * ((X1 - X0 - 4.4) / 5)), [])
  const z = (F2_CORRIDOR.minZ + F2_CORRIDOR.maxZ) / 2
  useFrame(({ clock }) => {
    const g = useNet.getState().game
    const dark = performance.now() < live.blackoutUntil
    mats.current.forEach((m, i) => {
      if (!m) return
      const on = !!g?.breakerTarget[i] && !dark
      // a nervous flicker, but never long enough to misread which lamps are alive
      const k = on ? (Math.sin(clock.elapsedTime * (11 + i * 3)) > 0.96 ? 0.6 : 2.2) : 0.03
      m.color.set('#ffd9a0').multiplyScalar(k)
    })
  })
  const body = getMats().paint
  return (
    <group>
      {xs.map((x, i) => (
        <group key={i} position={[x, TOP - 0.06, z]}>
          <mesh material={body}>
            <boxGeometry args={[1.0, 0.08, 0.26]} />
          </mesh>
          <mesh position-y={-0.045} rotation-x={Math.PI / 2}>
            <planeGeometry args={[0.9, 0.18]} />
            <meshBasicMaterial ref={(el) => { mats.current[i] = el }} toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
          <Sign text={String(i + 1)} p={[0, -0.5, ZS - WALL - 0.02 - z]} r={Math.PI} w={0.3} h={0.26} o={{ color: '#8693a3', glow: 4 }} glow={0.8} />
        </group>
      ))}
    </group>
  )
}

/** Everything written on the walls: room names, the clues (plain and cryptic), and things best not read. */
function Writing() {
  const game = useNet((s) => s.game)
  if (!game) return null
  const blood = { color: '#c4161c', font: '600', glow: 4 }
  const ax = roomX('archive')
  const mx = roomX('medbay')
  const dx = roomX('dispatch')
  const bx = roomX('boiler')
  const sx = roomX('storage')
  const [p1, p2, p3] = game.gasTarget
  const log = game.breakerTarget.map((up, i) => `Смена ${i + 1} — ${up ? 'вышла на линию.' : 'не вернулась.'}`)
  return (
    <group>
      {F2_ROOMS.map((r) => (
        <Sign key={r.id} text={r.name} p={[(r.minX + r.maxX) / 2, F2_Y + DOOR_H + 0.3, ZD + 0.11]} w={r.name.length > 9 ? 2.2 : 1.5} h={0.26} o={{ color: '#ff9a1f', glow: 8 }} />
      ))}
      <Sign text="СЛУЖЕБНЫЙ ЭТАЖ · ПОСТОРОННИМ НЕТ" p={[(FA.minX + FB.maxX) / 2, F2_Y + 2.72, ZS - WALL - 0.01]} r={Math.PI} w={3.2} h={0.24} o={{ color: '#e6ff3a', glow: 8 }} />

      {/* ---- breakers: where to look (plain), and the same pattern in words (cryptic) ---- */}
      <Poster tex={plaqueTexture('ЩИТ Д-2 · ШЕСТЬ ЛИНИЙ', ['Поднять только те линии,', 'где ещё горит свет.', 'Свет считай в коридоре:', 'от лестницы — первый.'], '#e6ff3a', 1024, 640)}
        p={[dx, F2_Y + 2.44, ZN + 0.02]} w={1.68} h={1.05} emissive={0.45} />
      <Poster tex={plaqueTexture('ЖУРНАЛ ДЕЖУРСТВ · 1977', [...log, '', 'Кто вышел — того подними.'], '#ff2e88', 1024, 900)}
        p={[ax + 1.2, F2_Y + 1.98, ZN + 0.02]} w={1.9} h={1.67} emissive={0.4} />

      {/* ---- gas: where each pressure is written, then the three writings ---- */}
      <Poster tex={plaqueTexture('ГАЗОВАЯ РАМПА', ['Три баллона — в гнёзда.', 'Р-1 зарубками в архиве.', 'Р-2 — в карте пациента.', 'Р-3 — за запертой дверью.', 'Редуктор щёлкает: 0 → 5 → 0.'], '#ff9a1f', 1024, 768)}
        p={[bx - 2.68, F2_Y + 1.65, -24]} r={Math.PI / 2} w={2.0} h={1.5} emissive={0.45} />
      <Poster tex={plaqueTexture('Р-1', ['▮ '.repeat(p1).trim(), 'Столько вдохов', 'до тишины.'], '#e6f1f4', 640, 640)}
        p={[ax - 0.95, F2_Y + 1.7, ZN + 0.02]} w={1.2} h={1.2} emissive={0.4} />
      <Poster tex={plaqueTexture('КАРТА ПАЦИЕНТА № 2', ['Пульс: нитевидный.', `Давление: ${p2} атм.`, 'Зрачки: отсутствуют.', 'Выписан: никогда.'], '#22f0ff', 1024, 768)}
        p={[mx + 0.9, F2_Y + 1.75, ZN + 0.02]} w={1.8} h={1.35} emissive={0.4} />
      <Sign text={`ТРЕТИЙ ДЫШИТ НА ${p3}`} p={[sx - 2.69, F2_Y + 1.7, -23.6]} r={Math.PI / 2} w={3.4} h={0.6} o={blood} glow={0.9} />

      {/* ---- things best not read ---- */}
      <Sign text="ОНА ХОДИТ ПО КОРИДОРУ" p={[-1, F2_Y + 1.5, ZS - WALL - 0.01]} r={Math.PI} w={3.6} h={0.5} o={blood} glow={0.8} />
      <Sign text="НЕ СМОТРИ ЕЙ В ГЛАЗА" p={[mx - 2.69, F2_Y + 1.9, -23.5]} r={Math.PI / 2} w={3.2} h={0.5} o={blood} glow={0.8} />
      <Sign text="ТИШЕ" p={[ax + 2.69, F2_Y + 2.0, -22.2]} r={-Math.PI / 2} w={1.4} h={0.6} o={blood} glow={0.8} />
      <Sign text="МЫ ВСЕ ЕЩЁ ЗДЕСЬ" p={[sx, F2_Y + 2.45, ZN + 0.02]} w={3.2} h={0.5} o={blood} glow={0.8} />
      <Sign text="ОНИ СМЕЮТСЯ НОЧЬЮ" p={[dx + 2.69, F2_Y + 2.3, -22]} r={-Math.PI / 2} w={3} h={0.45} o={blood} glow={0.7} />
      <Sign text="КРЫСЫ ЗНАЮТ" p={[STAIRWELL.minX + 0.02, 1.7, ST_Z0 + 2]} r={Math.PI / 2} w={2} h={0.45} o={blood} glow={0.7} />
      <Sign text="ЛЕСТНИЦА · ЭТАЖ 2 ↑" p={[STAIRWELL.maxX + WALL + 0.21, STAIR_DOOR.height + 0.28, STAIR_DOOR.z]} r={Math.PI / 2} w={1.7} h={0.24} o={{ color: '#e6ff3a', glow: 10 }} />
    </group>
  )
}

export function Floor2() {
  const mats = getMats()
  const boxes = useMemo(layout, [])
  const merged = useMemo(() => {
    const b = new BatchSet<MatKey>()
    for (const x of boxes) b.of(x.m).box(x.p, x.s, 2, x.r)
    return b.build()
  }, [boxes])
  const boiler = useRef<THREE.PointLight>(null)
  useFrame(({ clock }) => {
    if (boiler.current) boiler.current.intensity = performance.now() < live.blackoutUntil ? 0 : 5 + Math.sin(clock.elapsedTime * 2.3) * 1.5
  })
  // the ramps the player actually walks on; their surface runs through the step edges
  const rampLen = Math.hypot(FLIGHT, F2_Y / 2)
  const ramp = (f: { minX: number; maxX: number }, yMid: number, up: 1 | -1) => (
    <CuboidCollider
      args={[(f.maxX - f.minX) / 2, 0.1, rampLen / 2]}
      position={[(f.minX + f.maxX) / 2, yMid + RISE / 2 - 0.1 * Math.cos(SLOPE), (ST_Z0 + ST_Z1) / 2 + up * 0.1 * Math.sin(SLOPE)]}
      rotation={[-up * SLOPE, 0, 0]}
      friction={1}
    />
  )
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        {boxes.filter((b) => b.c).map((b, i) => <CuboidCollider key={i} args={[b.s[0] / 2, b.s[1] / 2, b.s[2] / 2]} position={b.p} />)}
        {ramp(FA, F2_Y / 4, 1)}
        {ramp(FB, (F2_Y * 3) / 4, -1)}
      </RigidBody>
      {merged.map(([m, g]) => <mesh key={m} geometry={g} material={mats[m]} receiveShadow />)}
      {BREAKER_POS.map((p, i) => <Breaker key={i} index={i} p={p} />)}
      {GAS_DIAL_POS.map((p, i) => <GasDial key={i} index={i} p={p} />)}
      {GAS_SOCKETS.map((s) => <GasClamp key={s.id} id={s.id} p={s.pos} />)}
      <StorageDoor />
      <CorridorLamps />
      <Writing />
      {/* two real lights for the whole floor: the rest is the players' flashlights */}
      <pointLight position={[(X0 + X1) / 2, TOP - 0.5, (F2_CORRIDOR.minZ + F2_CORRIDOR.maxZ) / 2]} color="#ffd9a0" intensity={3} distance={16} decay={2} />
      <pointLight ref={boiler} position={[roomX('boiler') + 1, F2_Y + 1.2, -23]} color="#ff3a1a" intensity={5} distance={9} decay={2} />
    </group>
  )
}
