import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { MeshReflectorMaterial } from '@react-three/drei'
import { DIRT_PILES, PIT_Y, PUMP_DOOR, SERVICE_DOOR, TRANSFER_DOOR, type Vec3 } from '../../../shared/level'
import { boxGeo } from './geo'
import { getMats, type MatKey } from './materials'
import { useNet } from '../net'

interface BoxDef { p: Vec3; s: Vec3; m: MatKey; c?: boolean; uv?: number; r?: Vec3; shadow?: boolean }

const T = PIT_Y + 4.2 // tunnel ceiling underside

// ---------- static layout ----------
function layout(): BoxDef[] {
  const b: BoxDef[] = []
  const add = (p: Vec3, s: Vec3, m: MatKey, extra: Partial<BoxDef> = {}) => b.push({ p, s, m, c: true, ...extra })

  // floors
  add([0, -0.65, -1], [44, 1.3, 12], 'floor', { uv: 3 })
  add([-8, -0.25, -12], [12, 0.5, 10], 'concreteDark', { uv: 3 })
  add([8, -0.25, -8.85], [4.4, 0.5, 3.7], 'metal', { uv: 1 })
  add([8, PIT_Y - 0.25, 8], [116, 0.5, 6.4], 'concrete', { uv: 3 })
  // platform edge strip
  add([0, -0.01, 4.75], [44, 0.04, 0.5], 'hazard', { c: false, uv: 1 })

  // pit / tunnel walls
  add([0, 2.35, 11.2], [44, 7.3, 0.4], 'tile', { uv: 2 })
  add([-36, PIT_Y + 2.1, 11.2], [28, 4.2, 0.4], 'concrete')
  add([44, PIT_Y + 2.1, 11.2], [44, 4.2, 0.4], 'concrete')
  add([-43, PIT_Y + 2.1, 4.8], [14, 4.2, 0.4], 'concrete')
  add([-28, PIT_Y + 2.1, 4.8], [12, 4.2, 0.4], 'concrete')
  add([-35, PIT_Y + 3.4, 4.8], [2, 1.6, 0.4], 'concreteDark')
  add([44, PIT_Y + 2.1, 4.8], [44, 4.2, 0.4], 'concrete')
  add([-36, T + 0.2, 8], [28, 0.4, 6.8], 'concreteDark')
  add([44, T + 0.2, 8], [44, 0.4, 6.8], 'concreteDark')
  add([-50.2, PIT_Y + 2.1, 8], [0.4, 4.2, 6.4], 'concrete')
  add([66.2, PIT_Y + 2.1, 8], [0.4, 4.2, 6.4], 'concrete')

  // hall walls
  add([-22.2, 3, -1], [0.4, 6, 12.4], 'tile', { uv: 2 })
  add([22.2, 3, -5.6], [0.4, 6, 3.2], 'tile', { uv: 2 })
  add([22.2, 3, 1.5], [0.4, 6, 7], 'tile', { uv: 2 })
  add([22.2, 4.4, -3], [0.4, 3.2, 2], 'tileDark', { uv: 2 })
  add([-22.2, (T + 6) / 2, 8], [0.4, 6 - T, 6.4], 'tileDark', { uv: 2 })
  add([22.2, (T + 6) / 2, 8], [0.4, 6 - T, 6.4], 'tileDark', { uv: 2 })
  add([-15.55, 3, -7.2], [12.9, 6, 0.4], 'tile', { uv: 2 })
  add([-0.45, 3, -7.2], [12.9, 6, 0.4], 'tile', { uv: 2 })
  add([16.1, 3, -7.2], [12.2, 6, 0.4], 'tile', { uv: 2 })
  add([-8, 4.4, -7.2], [2.2, 3.2, 0.4], 'tileDark', { uv: 2 })
  add([8, 4.4, -7.2], [4, 3.2, 0.4], 'tileDark', { uv: 2 })
  add([0, 6.2, 2], [44.8, 0.4, 18.8], 'concreteDark', { uv: 4 })

  // maintenance room
  add([-14.2, 1.6, -12], [0.4, 3.2, 10], 'concrete')
  add([-1.8, 1.6, -12], [0.4, 3.2, 10], 'concrete')
  add([-8, 1.6, -17.2], [12.4, 3.2, 0.4], 'concrete')
  add([-8, 3.4, -12], [12.4, 0.4, 10.4], 'concreteDark')
  add([-10, 0.5, -16.3], [3, 1, 1], 'rust') // shelf
  add([-4.6, 0.4, -14], [1.6, 0.05, 1], 'metal', { c: true }) // charge table top
  add([-12.5, 0.45, -12], [1.6, 0.9, 0.8], 'metal') // workbench

  // elevator shaft
  add([5.8, 1.5, -8.85], [0.4, 3, 3.7], 'metal', { uv: 1 })
  add([10.2, 1.5, -8.85], [0.4, 3, 3.7], 'metal', { uv: 1 })
  add([8, 1.5, -10.7], [4.8, 3, 0.4], 'metal', { uv: 1 })
  add([8, 3.1, -8.85], [4.8, 0.4, 3.7], 'metal', { uv: 1 })

  // stairs down to the tracks (both ends of the platform)
  for (const x of [-20.8, 20.8]) {
    for (let i = 1; i <= 3; i++) {
      const top = -0.325 * i
      add([x, (top + PIT_Y) / 2, 5 + 0.45 * (i - 0.5)], [2, top - PIT_Y, 0.45], 'metal', { uv: 1 })
    }
  }

  // pillars
  for (const x of [-15, -7.5, 7.5, 15]) add([x, 3, -0.5], [0.9, 6, 0.9], 'tileDark', { uv: 1.5 })

  // benches (seat only collides, so a cell can hide underneath)
  for (const x of [-12.5, 12.5]) {
    add([x, 0.45, -6.2], [2.4, 0.08, 0.6], 'wood', { uv: 1 })
    add([x - 1.05, 0.2, -6.2], [0.08, 0.4, 0.5], 'metal', { c: false })
    add([x + 1.05, 0.2, -6.2], [0.08, 0.4, 0.5], 'metal', { c: false })
  }
  // ticket booth
  add([-20.5, 0.95, -6.3], [2.2, 1.9, 1.4], 'metal', { uv: 1 })
  // vending machine
  add([17.5, 1.1, -6.4], [1.2, 2.2, 0.8], 'black')
  // detonator pedestals
  for (const x of [-15, 15]) add([x, 0.5, -6.4], [0.8, 1, 0.6], 'metal', { uv: 1 })
  // power panel housing
  add([-2, 1.4, -6.95], [2.6, 1.6, 0.15], 'metal', { uv: 1 })

  // ghost train car in the west tunnel (open door on the platform side)
  const F = PIT_Y + 0.45
  add([-45.75, PIT_Y + 0.3, 8], [7.5, 0.3, 4], 'rust', { uv: 1 })
  add([-45.75, F + 1.45, 9.95], [7.5, 2.9, 0.12], 'rust', { uv: 1 })
  add([-48, F + 1.45, 6.05], [3, 2.9, 0.12], 'rust', { uv: 1 })
  add([-43.5, F + 1.45, 6.05], [3, 2.9, 0.12], 'rust', { uv: 1 })
  add([-45.75, F + 2.55, 6.05], [1.5, 0.7, 0.12], 'rust', { uv: 1 })
  add([-49.45, F + 1.45, 8], [0.12, 2.9, 4], 'rust', { uv: 1 })
  add([-42.05, F + 1.45, 8], [0.12, 2.9, 4], 'rust', { uv: 1 })
  add([-45.75, F + 2.95, 8], [7.5, 0.12, 4], 'rust', { uv: 1 })
  add([-45.75, F + 0.22, 9.55], [6.5, 0.45, 0.6], 'wood', { uv: 1 }) // seats
  add([-45.75, PIT_Y + 0.22, 6.5], [1.5, 0.22, 0.9], 'metal', { uv: 1 }) // step

  // collapse rubble in the east tunnel
  const r = mulberry(17)
  for (let i = 0; i < 26; i++) {
    const x = 60 + r() * 6
    const s = 0.6 + r() * 1.6
    add([x, PIT_Y + s * 0.4 + r() * (x - 59) * 0.45, 5.2 + r() * 5.6], [s, s * 0.8, s * 1.1], i % 3 ? 'concrete' : 'concreteDark', {
      r: [r() * 0.6, r() * 3, r() * 0.6], uv: 1,
    })
  }
  add([63.5, PIT_Y + 2.1, 8], [5, 4.2, 6.4], 'concreteDark', { uv: 2 }) // solid blockage behind the rubble

  // ---------- pump room (track level, north of the west tunnel) ----------
  const P = PIT_Y
  add([-35, P - 0.25, -1.2], [18.4, 0.5, 12.4], 'concreteDark', { uv: 3 })
  add([-35, P + 2, -7.2], [18.4, 4, 0.4], 'concrete')
  add([-44.2, P + 2, -1.2], [0.4, 4, 12.4], 'concrete')
  add([-25.8, P + 2, -1.2], [0.4, 4, 12.4], 'concrete')
  add([-35, P + 4.2, -1.2], [18.4, 0.4, 12.4], 'concreteDark')
  // the pump: housing + tanks
  add([-35, P + 0.6, -3], [7, 1.2, 2.4], 'metal', { uv: 1 })
  add([-35, P + 1.5, -3.2], [6.4, 0.6, 1.6], 'rust', { uv: 1 })
  add([-40.5, P + 1.6, -5.6], [2.2, 3.2, 2.2], 'rust', { uv: 1 })
  add([-29.5, P + 1.6, -5.6], [2.2, 3.2, 2.2], 'rust', { uv: 1 })
  add([-42.6, P + 0.5, 2.6], [2, 1, 1.2], 'metal', { uv: 1 }) // tool chest

  // ---------- transfer corridor ----------
  add([28.2, -0.25, -3], [11.6, 0.5, 2.8], 'floor', { uv: 2 })
  add([28.2, 1.5, -1.6], [11.6, 3, 0.4], 'tileDark', { uv: 2 })
  add([28.2, 1.5, -4.4], [11.6, 3, 0.4], 'tileDark', { uv: 2 })
  add([28.2, 3.2, -3], [11.6, 0.4, 3.2], 'concreteDark')

  // ---------- branch B — "Литейная" ----------
  add([46, -0.25, -8.5], [24.4, 0.5, 15.4], 'floor', { uv: 3 })
  add([46, 2.5, -0.8], [24.4, 5, 0.4], 'tile', { uv: 2 })
  add([46, 2.5, -16.2], [24.4, 5, 0.4], 'tile', { uv: 2 })
  add([58.2, 2.5, -8.5], [0.4, 5, 15.4], 'tileDark', { uv: 2 })
  add([33.8, 2.5, -10.1], [0.4, 5, 11.8], 'tileDark', { uv: 2 })
  add([33.8, 2.5, -1.4], [0.4, 5, 0.8], 'tileDark', { uv: 2 })
  add([33.8, 4, -3], [0.4, 2, 2.4], 'tileDark', { uv: 2 })
  add([46, 5.2, -8.5], [24.8, 0.4, 15.8], 'concreteDark', { uv: 4 })
  for (const x of [40, 46, 52]) add([x, 2.5, -8], [0.8, 5, 0.8], 'tileDark', { uv: 1.5 })
  // dead branch-B train along the south wall
  add([46, 1.5, -15], [20, 3, 1.6], 'rust', { uv: 1 })
  // benches
  for (const x of [38, 54]) add([x, 0.45, -1.4], [2.2, 0.08, 0.6], 'wood', { uv: 1 })
  return b
}

function mulberry(a: number) {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function World() {
  const boxes = useMemo(layout, [])
  const mats = getMats()
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        {boxes.filter((b) => b.c !== false).map((b, i) => (
          <CuboidCollider
            key={i}
            args={[b.s[0] / 2, b.s[1] / 2, b.s[2] / 2]}
            position={b.p}
            rotation={b.r ? new THREE.Euler(...b.r) : undefined}
          />
        ))}
      </RigidBody>
      {boxes.map((b, i) => (
        <mesh
          key={i}
          geometry={boxGeo(b.s[0], b.s[1], b.s[2], b.uv ?? 2)}
          material={mats[b.m]}
          position={b.p}
          rotation={b.r ? new THREE.Euler(...b.r) : undefined}
          receiveShadow
          castShadow={b.s[1] < 3}
        />
      ))}
      <WetFloor />
      <Tracks />
      <Decor />
      <ServiceDoor />
      <ElevatorDoors />
      <BlastDoor />
      <PumpDoor />
      <TransferDoor />
      <DirtPiles />
    </group>
  )
}

// Glossy wet floor on the platform: reflects neon.
function WetFloor() {
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.003, -1.2]}>
      <planeGeometry args={[44, 11.4]} />
      <MeshReflectorMaterial
        resolution={512}
        blur={[300, 80]}
        mixBlur={1}
        mixStrength={9}
        roughness={0.85}
        depthScale={1}
        minDepthThreshold={0.6}
        maxDepthThreshold={1.2}
        color="#0d1014"
        metalness={0.6}
        mirror={0.4}
      />
    </mesh>
  )
}

function Tracks() {
  const mats = getMats()
  const sleepers = useRef<THREE.InstancedMesh>(null)
  const count = 140
  useMemo(() => {
    queueMicrotask(() => {
      const m = new THREE.Matrix4()
      for (let i = 0; i < count; i++) {
        m.makeTranslation(-49.5 + i * 0.82, PIT_Y + 0.04, 8)
        sleepers.current?.setMatrixAt(i, m)
      }
      if (sleepers.current) sleepers.current.instanceMatrix.needsUpdate = true
    })
  }, [])
  return (
    <group>
      {[7.25, 8.75].map((z) => (
        <mesh key={z} position={[8, PIT_Y + 0.12, z]} material={mats.rail} receiveShadow>
          <boxGeometry args={[116, 0.14, 0.08]} />
        </mesh>
      ))}
      {/* maglev guide strip */}
      <mesh position={[8, PIT_Y + 0.03, 8]} material={mats.neonCyan}>
        <boxGeometry args={[116, 0.02, 0.06]} />
      </mesh>
      <instancedMesh ref={sleepers} args={[undefined, undefined, count]} material={mats.concreteDark} receiveShadow>
        <boxGeometry args={[0.25, 0.08, 2.4]} />
      </instancedMesh>
    </group>
  )
}

function Decor() {
  const mats = getMats()
  const tubes: { p: Vec3; s: Vec3; m: MatKey }[] = []
  // ceiling neon tubes in the hall
  for (let x = -19; x <= 19; x += 4.2) {
    tubes.push({ p: [x, 5.92, -4], s: [3, 0.07, 0.1], m: 'neonCyan' })
    tubes.push({ p: [x + 2, 5.92, 1.5], s: [3, 0.07, 0.1], m: 'neonPink' })
  }
  // pillar strips
  for (const x of [-15, -7.5, 7.5, 15]) {
    tubes.push({ p: [x, 3, -0.04], s: [0.06, 5, 0.06], m: x < 0 ? 'neonPink' : 'neonCyan' })
    tubes.push({ p: [x, 3, -0.96], s: [0.06, 5, 0.06], m: x < 0 ? 'neonCyan' : 'neonPink' })
  }
  // platform edge light line
  tubes.push({ p: [0, 0.02, 4.98], s: [44, 0.03, 0.04], m: 'neonAcid' })
  // emergency lamps
  for (const x of [-18, -6, 6, 18]) tubes.push({ p: [x, 5.4, -6.95], s: [0.5, 0.15, 0.1], m: 'emergency' })
  // tunnel lamps
  for (let x = -46; x <= 62; x += 8) {
    if (x > -22 && x < 22) continue
    tubes.push({ p: [x, PIT_Y + 3.2, 5.05], s: [0.4, 0.12, 0.12], m: x % 16 === 0 ? 'emergency' : 'tunnelLamp' })
  }
  // maintenance room strip
  tubes.push({ p: [-8, 3.17, -12], s: [6, 0.05, 0.1], m: 'neonCyan' })
  // elevator light
  tubes.push({ p: [8, 2.88, -8.85], s: [2, 0.04, 0.6], m: 'neonAcid' })

  return (
    <group>
      {tubes.map((t, i) => (
        <mesh key={i} position={t.p} material={mats[t.m]}>
          <boxGeometry args={t.s} />
        </mesh>
      ))}
      {/* cable bundles along the tunnel walls */}
      {[
        [-36, 28],
        [44, 44],
      ].map(([x, len]) =>
        [0.6, 0.75, 0.9].map((y, k) => (
          <mesh key={`${x}${k}`} position={[x, PIT_Y + 2.4 + y * 0.3, 10.9]} rotation-z={Math.PI / 2} material={mats.black}>
            <cylinderGeometry args={[0.04 + k * 0.01, 0.04 + k * 0.01, len, 6]} />
          </mesh>
        )),
      )}
      {/* big pipe */}
      <mesh position={[8, PIT_Y + 3.6, 10.6]} rotation-z={Math.PI / 2} material={mats.rust} castShadow>
        <cylinderGeometry args={[0.22, 0.22, 116, 12]} />
      </mesh>
      {/* broken hanging cable sparking near the hall east mouth */}
      <mesh position={[24, PIT_Y + 3, 7.5]} rotation-x={0.2} material={mats.black}>
        <cylinderGeometry args={[0.025, 0.025, 2.2, 5]} />
      </mesh>
    </group>
  )
}

function SlidingBlock({ open, closedPos, openPos, size, mat, speed = 1.2 }: {
  open: boolean; closedPos: Vec3; openPos: Vec3; size: Vec3; mat: MatKey; speed?: number
}) {
  const mesh = useRef<THREE.Mesh>(null)
  const mats = getMats()
  useFrame((_, dt) => {
    const m = mesh.current
    if (!m) return
    const target = open ? openPos : closedPos
    m.position.x += (target[0] - m.position.x) * Math.min(1, dt * speed)
    m.position.y += (target[1] - m.position.y) * Math.min(1, dt * speed)
    m.position.z += (target[2] - m.position.z) * Math.min(1, dt * speed)
  })
  return (
    <>
      <mesh ref={mesh} position={closedPos} geometry={boxGeo(size[0], size[1], size[2], 1)} material={mats[mat]} castShadow receiveShadow />
      {!open && (
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[size[0] / 2, size[1] / 2, size[2] / 2]} position={closedPos} />
        </RigidBody>
      )}
    </>
  )
}

function ServiceDoor() {
  const open = useNet((s) => !!s.game?.doorOpen)
  const p: Vec3 = [SERVICE_DOOR.x, SERVICE_DOOR.height / 2, SERVICE_DOOR.z - 0.15]
  return <SlidingBlock open={open} closedPos={p} openPos={[p[0], p[1] + 2.7, p[2]]} size={[2.2, 2.8, 0.2]} mat="hazard" />
}

function ElevatorDoors() {
  const open = useNet((s) => !!s.game?.elevatorOpen)
  return (
    <>
      <SlidingBlock open={open} closedPos={[7, 1.4, -7.05]} openPos={[5.2, 1.4, -7.05]} size={[2, 2.8, 0.1]} mat="metal" speed={0.8} />
      <SlidingBlock open={open} closedPos={[9, 1.4, -7.05]} openPos={[10.8, 1.4, -7.05]} size={[2, 2.8, 0.1]} mat="metal" speed={0.8} />
    </>
  )
}

function PumpDoor() {
  const open = useNet((s) => !!s.game?.pumpDoorOpen)
  const p: Vec3 = [PUMP_DOOR.x, PIT_Y + PUMP_DOOR.height / 2, PUMP_DOOR.z]
  return <SlidingBlock open={open} closedPos={p} openPos={[p[0], p[1] + 2.5, p[2]]} size={[PUMP_DOOR.width, PUMP_DOOR.height, 0.25]} mat="rust" />
}

function TransferDoor() {
  const open = useNet((s) => !!s.game?.transferOpen)
  const p: Vec3 = [TRANSFER_DOOR.x, TRANSFER_DOOR.height / 2, TRANSFER_DOOR.z]
  return <SlidingBlock open={open} closedPos={p} openPos={[p[0], p[1], p[2] - 2.1]} size={[0.25, TRANSFER_DOOR.height, TRANSFER_DOOR.width]} mat="hazard" />
}

// Mounds of fallen earth in branch B; mosaic tiles lie half-buried on top.
function DirtPiles() {
  return (
    <group>
      {DIRT_PILES.map((p, i) => (
        <mesh key={i} position={[p[0], p[1], p[2]]} scale={[1.4 + (i % 2) * 0.4, 0.42, 1.1]} receiveShadow castShadow>
          <sphereGeometry args={[1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#2b2119" roughness={1} />
        </mesh>
      ))}
    </group>
  )
}

function BlastDoor() {
  const closed = useNet((s) => !!s.game?.blastDoorClosed)
  const evac = useNet((s) => s.game?.phase === 'evac')
  const h = T - PIT_Y
  return (
    <>
      <SlidingBlock
        open={!closed}
        closedPos={[22.6, PIT_Y + h / 2, 8]}
        openPos={[22.6, PIT_Y + h / 2 + h - 0.3, 8]}
        size={[0.5, h, 6.4]}
        mat="hazard"
        speed={evac || closed ? 2 : 1}
      />
    </>
  )
}
