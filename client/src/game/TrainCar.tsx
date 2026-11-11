import { useMemo } from 'react'
import * as THREE from 'three'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { PIT_Y } from '../../../shared/level'
import { BatchSet } from './geo'
import { getMats } from './materials'
import { Sign } from './Puzzles'

// The dead 1977 metro car in the west tunnel. It stands on the track with its doors stuck open on the
// side facing the station. Its floor is 0.8 m above the track bed: too high to step onto (the player
// steps up 0.5 m at most), so the way in is to jump through the doorway.
//
// Inside are an energy cell spot (shared/level.ts CELL_SPOTS), the machinist's poem (POEM_POS) and the
// "train" easter egg zone (TrainEgg in Puzzles.tsx). All three are tied to this footprint and floor
// height: move the car and they must move with it.

type V3 = [number, number, number]

// footprint on the map
const X0 = -49.5 // west end
const X1 = -42 // east end, facing the station
const Z0 = 6 // side with the open doors
const Z1 = 10 // side against the tunnel wall
const CX = (X0 + X1) / 2
const CZ = (Z0 + Z1) / 2
const LEN = X1 - X0
const WID = Z1 - Z0

/** Top of the car floor. Also the height the cell inside is spawned at. */
export const CAR_FLOOR = PIT_Y + 0.8
const WALL_H = 2.15
const TOP = CAR_FLOOR + WALL_H
const WALL = 0.12
const DOOR_W = 1.5
// The player is 1.8 m tall and comes through at the top of a 0.93 m jump, 0.13 m above the floor, so the
// doorway has to clear 1.93 m.
const DOOR_H = 2.08
// window band
const SILL = CAR_FLOOR + 1.05
const WIN_H = 0.72
const WIN_Y = SILL + WIN_H / 2

type Paint = 'body' | 'upper' | 'roof' | 'glass' | 'steel' | 'dark' | 'seat' | 'lino' | 'lampOn' | 'lampDead' | 'head' | 'tail'

function usePaint(): Record<Paint, THREE.Material> {
  return useMemo(() => {
    const rust = getMats().rust
    // old enamel on riveted steel: the plain paint colour, with the relief of the station's rusty plating
    const enamel = (color: string, roughness: number) =>
      new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.2, normalMap: rust.normalMap, normalScale: new THREE.Vector2(0.7, 0.7) })
    const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(o)
    const lit = (hex: string, k: number) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k), toneMapped: false })
    return {
      body: enamel('#1f5f6b', 0.6),
      upper: enamel('#b9b199', 0.7),
      roof: enamel('#4a5259', 0.85),
      glass: std({ color: '#0a1a20', emissive: '#0c2f38', emissiveIntensity: 0.35, roughness: 0.12, metalness: 0.7 }),
      steel: std({ color: '#7d868f', roughness: 0.35, metalness: 0.9 }),
      dark: std({ color: '#0d1013', roughness: 0.7, metalness: 0.4 }),
      seat: std({ color: '#5e2c24', roughness: 0.8 }),
      lino: std({ color: '#2a2f33', roughness: 0.6, metalness: 0.1 }),
      lampOn: lit('#ffcf9a', 1.5),
      lampDead: std({ color: '#3a3d40', roughness: 0.4 }),
      head: lit('#ffe2b0', 1.1),
      tail: lit('#ff2a2a', 1.4),
    }
  }, [])
}

/** Everything solid: [centre, size]. The player and thrown items collide with these. */
function solids(): [V3, V3][] {
  const wallY = CAR_FLOOR + WALL_H / 2
  const side = (LEN - DOOR_W) / 2 // length of the wall on each side of the doorway
  return [
    // floor and everything under it, as one block: nothing can roll under the car and get lost
    [[CX, (PIT_Y + CAR_FLOOR) / 2, CZ], [LEN, CAR_FLOOR - PIT_Y, WID]],
    [[CX, wallY, Z1 - WALL / 2], [LEN, WALL_H, WALL]],
    [[X0 + side / 2, wallY, Z0 + WALL / 2], [side, WALL_H, WALL]],
    [[X1 - side / 2, wallY, Z0 + WALL / 2], [side, WALL_H, WALL]],
    [[CX, CAR_FLOOR + DOOR_H + (WALL_H - DOOR_H) / 2, Z0 + WALL / 2], [DOOR_W, WALL_H - DOOR_H, WALL]],
    [[X0 + WALL / 2, wallY, CZ], [WALL, WALL_H, WID]],
    [[X1 - WALL / 2, wallY, CZ], [WALL, WALL_H, WID]],
    [[CX, TOP + 0.06, CZ], [LEN, 0.12, WID]],
    // benches: one along the far wall, two short ones beside the doorway
    [[CX, CAR_FLOOR + 0.225, Z1 - 0.42], [LEN - 1, 0.45, 0.55]],
    [[X0 + 1.45, CAR_FLOOR + 0.225, Z0 + 0.42], [2.3, 0.45, 0.55]],
    [[X1 - 1.45, CAR_FLOOR + 0.225, Z0 + 0.42], [2.3, 0.45, 0.55]],
  ]
}

function build() {
  const b = new BatchSet<Paint>()
  const box = (m: Paint, p: V3, s: V3) => b.of(m).box(p, s, 1.5)
  const wallY = CAR_FLOOR + WALL_H / 2
  const side = (LEN - DOOR_W) / 2
  const upperH = TOP - SILL
  const upperY = SILL + upperH / 2

  // ---- shell: teal below the windows, cream above, as on the old rolling stock
  const longWall = (x: number, len: number, z: number) => {
    box('body', [x, wallY, z], [len, WALL_H, WALL])
    box('upper', [x, upperY, z], [len, upperH, WALL + 0.012])
    box('steel', [x, SILL, z], [len, 0.035, WALL + 0.03]) // sill moulding
  }
  longWall(CX, LEN, Z1 - WALL / 2)
  longWall(X0 + side / 2, side, Z0 + WALL / 2)
  longWall(X1 - side / 2, side, Z0 + WALL / 2)
  box('upper', [CX, CAR_FLOOR + DOOR_H + (WALL_H - DOOR_H) / 2, Z0 + WALL / 2], [DOOR_W, WALL_H - DOOR_H, WALL + 0.012])
  for (const x of [X0 + WALL / 2, X1 - WALL / 2]) {
    box('body', [x, wallY, CZ], [WALL, WALL_H, WID])
    box('upper', [x, upperY, CZ], [WALL + 0.012, upperH, WID])
    box('steel', [x, SILL, CZ], [WALL + 0.03, 0.035, WID])
  }

  // ---- windows: dark panes a little thicker than the wall, so they show inside and out
  const pane = (x: number, z: number, w: number) => {
    box('glass', [x, WIN_Y, z], [w, WIN_H, WALL + 0.03])
    box('steel', [x, WIN_Y + WIN_H / 2 + 0.015, z], [w + 0.06, 0.03, WALL + 0.045])
    box('steel', [x, WIN_Y - WIN_H / 2 - 0.015, z], [w + 0.06, 0.03, WALL + 0.045])
  }
  // far wall: the middle bay is left blank, the poem hangs there
  for (const x of [X0 + 0.9, X0 + 2.2, X1 - 2.2, X1 - 0.9]) pane(x, Z1 - WALL / 2, 1)
  for (const x of [X0 + 0.85, X0 + 2.15, X1 - 2.15, X1 - 0.85]) pane(x, Z0 + WALL / 2, 1)
  // ends: a gangway door with a small window, and a narrow window each side
  for (const [x, out] of [[X0 + WALL / 2, -1], [X1 - WALL / 2, 1]] as const) {
    box('dark', [x + out * 0.012, CAR_FLOOR + 0.98, CZ], [WALL, 1.96, 0.86])
    box('glass', [x + out * 0.02, WIN_Y + 0.05, CZ], [WALL + 0.02, 0.5, 0.46])
    for (const z of [CZ - 1.25, CZ + 1.25]) box('glass', [x, WIN_Y, z], [WALL + 0.03, WIN_H, 0.8])
    box('steel', [x + out * 0.07, CAR_FLOOR + 1.0, CZ + 0.34], [0.03, 0.14, 0.03]) // door handle
  }

  // ---- the doorway: leaves slid open along the outside of the wall, steel jambs and a worn sill
  for (const s of [-1, 1]) {
    const x = CX + s * (DOOR_W / 2 + 0.36)
    box('body', [x, CAR_FLOOR + DOOR_H / 2, Z0 - 0.035], [0.72, DOOR_H, 0.045])
    box('glass', [x, WIN_Y + 0.08, Z0 - 0.04], [0.46, 0.8, 0.06])
    box('steel', [CX + s * (DOOR_W / 2), CAR_FLOOR + DOOR_H / 2, Z0 + WALL / 2], [0.05, DOOR_H, WALL + 0.05])
    box('dark', [x - s * 0.33, CAR_FLOOR + DOOR_H / 2, Z0 - 0.035], [0.05, DOOR_H, 0.05]) // rubber edge
  }
  box('steel', [CX, CAR_FLOOR + 0.012, Z0 + 0.12], [DOOR_W, 0.025, 0.3])
  box('steel', [CX, CAR_FLOOR + DOOR_H + 0.02, Z0 + WALL / 2], [DOOR_W + 0.1, 0.04, WALL + 0.05])

  // ---- roof: a shallow vault over the flat ceiling, with ventilation hoods
  const vault = new THREE.CylinderGeometry(WID / 2, WID / 2, LEN + 0.16, 14, 1, false, -Math.PI / 2, Math.PI)
  vault.rotateX(-Math.PI / 2) // the kept half now bulges upwards
  vault.rotateY(Math.PI / 2) // and the cylinder runs along the car
  b.of('roof').add(vault, [CX, TOP + 0.1, CZ], undefined, [1, 0.2, 1.01])
  box('roof', [CX, TOP + 0.05, CZ], [LEN + 0.16, 0.1, WID + 0.04])
  for (const x of [X0 + 1.4, CX, X1 - 1.4]) box('dark', [x, TOP + 0.5, CZ], [1.1, 0.12, 0.9])

  // ---- underframe, bogies, couplers
  box('dark', [CX, CAR_FLOOR - 0.13, CZ], [LEN + 0.02, 0.26, WID + 0.02])
  box('dark', [CX, CAR_FLOOR - 0.36, CZ], [LEN - 3.4, 0.22, 1.5]) // equipment boxes between the bogies
  for (const x of [X0 + 1.5, X1 - 1.5]) {
    box('dark', [x, PIT_Y + 0.42, CZ], [2.2, 0.2, 2.2])
    for (const dx of [-0.75, 0.75]) {
      b.of('dark').cyl([x + dx, PIT_Y + 0.4, CZ], 0.07, 2.5, 'z', 8) // axle
      for (const z of [CZ - 1.0, CZ + 1.0]) {
        b.of('steel').cyl([x + dx, PIT_Y + 0.4, z], 0.4, 0.13, 'z', 16)
        b.of('dark').cyl([x + dx, PIT_Y + 0.4, z + Math.sign(z - CZ) * 0.07], 0.2, 0.05, 'z', 10)
      }
    }
  }
  for (const [x, out] of [[X0, -1], [X1, 1]] as const) {
    box('dark', [x + out * 0.25, CAR_FLOOR - 0.3, CZ], [0.5, 0.18, 0.26])
    b.of('steel').cyl([x + out * 0.52, CAR_FLOOR - 0.3, CZ], 0.12, 0.08, 'x', 10)
    box('dark', [x + out * 0.06, CAR_FLOOR - 0.02, CZ], [0.12, 0.1, WID - 0.6]) // buffer beam
  }
  // lamps on the end facing the station: two headlights, two red markers, long dead but still faintly lit
  for (const z of [CZ - 1.45, CZ + 1.45]) {
    b.of('steel').cyl([X1 + 0.03, CAR_FLOOR + 0.42, z], 0.15, 0.06, 'x', 14)
    b.of('head').cyl([X1 + 0.065, CAR_FLOOR + 0.42, z], 0.11, 0.02, 'x', 14)
    b.of('tail').cyl([X1 + 0.05, CAR_FLOOR + 0.42, z + Math.sign(CZ - z) * 0.32], 0.055, 0.03, 'x', 10)
  }

  // ---- inside
  box('lino', [CX, CAR_FLOOR + 0.006, CZ], [LEN - WALL * 2, 0.012, WID - WALL * 2])
  const bench = (x: number, len: number, z: number, back: number) => {
    box('dark', [x, CAR_FLOOR + 0.16, z], [len, 0.32, 0.5])
    box('seat', [x, CAR_FLOOR + 0.385, z], [len, 0.13, 0.55])
    box('seat', [x, CAR_FLOOR + 0.75, z + back * 0.24], [len, 0.5, 0.09]) // backrest against the wall
  }
  bench(CX, LEN - 1, Z1 - 0.42, 1)
  bench(X0 + 1.45, 2.3, Z0 + 0.42, -1)
  bench(X1 - 1.45, 2.3, Z0 + 0.42, -1)
  // handrails under the ceiling and the posts by the doorway
  for (const z of [CZ - 0.75, CZ + 0.75]) {
    b.of('steel').cyl([CX, TOP - 0.22, z], 0.02, LEN - 0.6, 'x', 8)
    for (const x of [X0 + 0.9, X0 + 2.6, X1 - 2.6, X1 - 0.9]) b.of('steel').cyl([x, TOP - 0.11, z], 0.012, 0.22, 'y', 6)
  }
  for (const s of [-1, 1]) b.of('steel').cyl([CX + s * (DOOR_W / 2 + 0.1), CAR_FLOOR + WALL_H / 2, Z0 + 0.72], 0.022, WALL_H, 'y', 8)
  // ceiling lamps: one still glows, the rest are dead
  for (const [i, x] of [X0 + 1.2, X0 + 3, X1 - 3, X1 - 1.2].entries()) box(i === 2 ? 'lampOn' : 'lampDead', [x, TOP - 0.03, CZ], [1.1, 0.04, 0.22])

  return b.build()
}

export function TrainCar() {
  const paint = usePaint()
  const parts = useMemo(build, [])
  const colliders = useMemo(solids, [])
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        {colliders.map(([p, s], i) => <CuboidCollider key={i} position={p} args={[s[0] / 2, s[1] / 2, s[2] / 2]} />)}
      </RigidBody>
      {parts.map(([m, g]) => <mesh key={m} geometry={g} material={paint[m]} receiveShadow />)}
      {/* fleet number and destination board on the end facing the station */}
      <Sign text="1977" p={[X1 + 0.012, TOP - 0.19, CZ + 1.25]} r={Math.PI / 2} w={0.7} h={0.2} o={{ color: '#ff9a1f', glow: 8 }} glow={0.9} />
      <Sign text="В ДЕПО" p={[X1 + 0.012, TOP - 0.19, CZ - 1.25]} r={Math.PI / 2} w={0.9} h={0.2} o={{ color: '#ff9a1f', glow: 8 }} glow={0.9} />
    </group>
  )
}
