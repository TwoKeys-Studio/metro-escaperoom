import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { BallCollider, CuboidCollider, CylinderCollider, RigidBody, useRapier, type RapierRigidBody } from '@react-three/rapier'
import type { ItemKind } from '../../../shared/level'
import type { ItemState } from '../../../shared/protocol'
import { live, send, useNet } from '../net'
import { sfx } from './audio'
import { getMats } from './materials'
import { tileFaceTexture } from './textures'
import { hold, interactables, itemLabels, keys, useUi } from './ui'

export function Items() {
  const ids = useNet((s) => Object.keys(s.items).sort().join(','))
  const eggs = useNet((s) => s.game?.eggs ?? true)
  return (
    <>
      {ids.split(',').filter(Boolean).map((id) => (id === 'pixel' && !eggs ? null : <Item key={id} id={id} />))}
    </>
  )
}

// Where a carried item floats, in camera space: [right, down, forward] in metres. Off to the lower right,
// like something held in the right hand, so it never covers the middle of the screen.
const CARRY: Record<ItemKind, [number, number, number]> = {
  cell: [0.36, 0.3, 0.85], can: [0.34, 0.28, 0.75], bottle: [0.34, 0.26, 0.75], helmet: [0.38, 0.32, 0.85],
  cone: [0.4, 0.36, 0.9], pixel: [0.38, 0.32, 0.9], hose: [0.4, 0.34, 0.9], pipe: [0.38, 0.34, 0.95],
  tile: [0.42, 0.34, 0.95], chair: [0.52, 0.5, 1.2], crate: [0.55, 0.52, 1.35],
  charge: [0.2, 0.55, 1.15], // heavy: lugged low in front with both arms
}
// How far in front of the eyes an item is put down, straight along the crosshair.
const PLACE_REACH: Partial<Record<ItemKind, number>> = { charge: 1.3, crate: 1.5 }
// Putting down takes a moment: the item swings from the hand to the crosshair first.
const PLACE_MS = 220
const GIRTH: Record<ItemKind, number> = {
  cell: 0.09, can: 0.04, bottle: 0.05, helmet: 0.16, cone: 0.13, pixel: 0.15, hose: 0.13, pipe: 0.05,
  tile: 0.04, chair: 0.25, crate: 0.4, charge: 0.22,
}

const MASS: Record<ItemKind, number> = {
  cell: 2, charge: 25, crate: 8, can: 0.3, cone: 1, bottle: 0.5, chair: 4, pixel: 3, helmet: 1, pipe: 3, tile: 1.5, hose: 3,
}

function Item({ id }: { id: string }) {
  const kind = useNet((s) => s.items[id]?.kind)
  const socketed = useNet((s) => !!s.items[id]?.socket)
  const fake = useNet((s) => !!s.items[id]?.fake)
  const body = useRef<RapierRigidBody>(null)
  const group = useRef<THREE.Group>(null)
  const { camera } = useThree()
  const { rapier } = useRapier()
  const st = useRef({ mode: -1, sendT: 0, still: 0, releasedAt: 0, placeAt: 0 })
  const tmp = useMemo(() => ({ v: new THREE.Vector3(), q: new THREE.Quaternion(), t: new THREE.Vector3(), a: new THREE.Vector3() }), [])

  useEffect(() => {
    const g = group.current
    if (!g) return
    interactables.set(g, () => {
      const it = useNet.getState().items[id]
      if (!it || (it.socket && !(it.socket.startsWith('mos') && !useNet.getState().game?.mosaicDone)) || (it.holder && it.holder !== useNet.getState().myId)) return null
      return { kind: 'item', id, label: `Взять ${itemLabels[it.kind] ?? 'предмет'}` }
    })
    return () => {
      interactables.delete(g)
    }
  }, [id])

  useFrame((_, dt) => {
    const rb = body.current
    if (!rb) return
    const net = useNet.getState()
    const it = net.items[id]
    if (!it) return
    const me = net.myId
    const now = performance.now()

    // pick up when the server confirms
    if (it.holder === me && hold.id !== id && now - st.current.releasedAt > 600) {
      hold.id = id
      st.current.placeAt = 0
      useUi.setState({ holding: id })
      sfx.grab()
      if (it.kind === 'pixel') sfx.meow()
    }

    const holding = hold.id === id
    const simulating = holding || (it.owner === me && !it.socket)
    const wantMode = simulating ? 0 : 2
    if (st.current.mode !== wantMode) {
      rb.setBodyType(wantMode === 0 ? rapier.RigidBodyType.Dynamic : rapier.RigidBodyType.KinematicPositionBased, true)
      st.current.mode = wantMode
      st.current.still = 0
    }

    if (holding) {
      rb.setGravityScale(0, true)
      const dir = tmp.v.set(0, 0, -1).applyQuaternion(camera.quaternion)
      // carried at the side; when asked to put it down it first swings to the crosshair, so it lands
      // (and snaps into sockets) exactly where the player is looking
      if (hold.dropReq && !st.current.placeAt) st.current.placeAt = now
      const placing = st.current.placeAt > 0
      const target = tmp.t.copy(camera.position)
      if (placing) {
        target.addScaledVector(dir, PLACE_REACH[it.kind] ?? 1.15)
        if (it.kind === 'charge') target.y -= 0.35
      } else {
        const [right, down, forward] = CARRY[it.kind]
        target.add(tmp.a.set(right, -down, -forward).applyQuaternion(camera.quaternion))
      }
      const p = rb.translation()
      const dx = target.x - p.x
      const dy = target.y - p.y
      const dz = target.z - p.z
      const gap = Math.hypot(dx, dy, dz)
      const k = placing ? 22 : 16
      rb.setLinvel({ x: dx * k, y: dy * k, z: dz * k }, true)
      const av = rb.angvel()
      rb.setAngvel({ x: av.x * 0.7, y: av.y * 0.7 + (keys.has('KeyR') ? 4 : 0), z: av.z * 0.7 }, true)
      hold.view.set(p.x, p.y, p.z).sub(camera.position).applyQuaternion(tmp.q.copy(camera.quaternion).invert())
      hold.girth = GIRTH[it.kind]

      const placed = placing && (gap < 0.12 || now - st.current.placeAt > PLACE_MS)
      const release = placed || hold.throwReq || gap > 2.6
      if (release) {
        const throwing = hold.throwReq && it.kind !== 'charge'
        // thrown from the hand, but aimed at what the crosshair points at
        const aim = tmp.a.copy(camera.position).addScaledVector(dir, 9).sub(tmp.t.set(p.x, p.y, p.z)).normalize()
        const v = throwing ? aim.clone().multiplyScalar(it.kind === 'crate' ? 7 : 12) : new THREE.Vector3(dx * 4, dy * 4, dz * 4)
        rb.setLinvel(v, true)
        rb.setGravityScale(1, true)
        hold.id = null
        hold.dropReq = false
        hold.throwReq = false
        st.current.placeAt = 0
        st.current.releasedAt = now
        useUi.setState({ holding: null })
        const q = rb.rotation()
        send({ t: 'release', id, p: v3(rb.translation()), q: [q.x, q.y, q.z, q.w], v: [v.x, v.y, v.z] })
        useNet.setState({ items: { ...net.items, [id]: { ...it, holder: null, owner: me } } })
        st.current.still = 0
      }
    } else if (simulating) {
      rb.setGravityScale(1, true)
      const lv = rb.linvel()
      const speed = Math.hypot(lv.x, lv.y, lv.z)
      if (speed < 0.05) st.current.still += dt
      else st.current.still = 0
      if (st.current.still > 0.6 || rb.translation().y < -10) {
        if (rb.translation().y < -10) rb.setTranslation({ x: 0, y: 1, z: -2 }, true)
        const q = rb.rotation()
        send({ t: 'rest', id, p: v3(rb.translation()), q: [q.x, q.y, q.z, q.w] })
        live.items.set(id, { p: v3(rb.translation()), q: [q.x, q.y, q.z, q.w] })
        useNet.setState({ items: { ...net.items, [id]: { ...it, owner: null } } })
        sfx.drop(v3(rb.translation()))
        return
      }
    }

    if (simulating) {
      st.current.sendT -= dt
      if (st.current.sendT <= 0) {
        st.current.sendT = 1 / 15
        const q = rb.rotation()
        send({ t: 'itemTf', id, p: v3(rb.translation()), q: [r4(q.x), r4(q.y), r4(q.z), r4(q.w)] })
      }
    } else {
      // follow the network
      const target = live.items.get(id)
      if (!target) return
      const p = rb.translation()
      const a = it.socket ? 1 : Math.min(1, dt * 12)
      rb.setNextKinematicTranslation({
        x: p.x + (target.p[0] - p.x) * a, y: p.y + (target.p[1] - p.y) * a, z: p.z + (target.p[2] - p.z) * a,
      })
      const r = rb.rotation()
      tmp.q.set(r.x, r.y, r.z, r.w).slerp(new THREE.Quaternion(...target.q), a)
      rb.setNextKinematicRotation(tmp.q)
    }
  })

  const init = live.items.get(id)
  if (!kind) return null
  return (
    <RigidBody
      ref={body}
      type="kinematicPosition"
      colliders={false}
      position={init?.p}
      quaternion={init?.q}
      userData={{ item: id }}
      mass={MASS[kind]}
      linearDamping={0.3}
      angularDamping={0.6}
      ccd
    >
      <ItemCollider kind={kind} />
      <group ref={group}>
        <ItemMesh kind={kind} socketed={socketed} fake={fake} id={id} />
      </group>
    </RigidBody>
  )
}

const v3 = (p: { x: number; y: number; z: number }): [number, number, number] => [r4(p.x), r4(p.y), r4(p.z)]
const r4 = (n: number) => Math.round(n * 1000) / 1000

function ItemCollider({ kind }: { kind: ItemKind }) {
  switch (kind) {
    case 'cell': return <CylinderCollider args={[0.2, 0.09]} friction={0.8} />
    case 'charge': return <CuboidCollider args={[0.3, 0.2, 0.2]} friction={1} />
    case 'crate': return <CuboidCollider args={[0.4, 0.4, 0.4]} friction={0.9} />
    case 'can': return <CylinderCollider args={[0.07, 0.04]} />
    case 'cone': return <CylinderCollider args={[0.3, 0.16]} />
    case 'bottle': return <CylinderCollider args={[0.15, 0.05]} />
    case 'chair': return <CuboidCollider args={[0.25, 0.45, 0.25]} />
    case 'pixel': return <CuboidCollider args={[0.22, 0.17, 0.12]} />
    case 'helmet': return <BallCollider args={[0.16]} />
    case 'pipe': return <CylinderCollider args={[0.5, 0.05]} rotation={[0, 0, Math.PI / 2]} />
    case 'tile': return <CuboidCollider args={[0.27, 0.27, 0.03]} friction={1} />
    case 'hose': return <CylinderCollider args={[0.12, 0.28]} />
  }
}

function CellMesh({ socketed, fake }: { socketed: boolean; fake: boolean }) {
  const core = useRef<THREE.MeshBasicMaterial>(null)
  useFrame(({ clock }) => {
    const m = core.current
    if (!m) return
    const t = clock.elapsedTime
    if (fake && socketed) m.color.setRGB(4, 0.2, 0.3)
    else {
      const pulse = 1.6 + Math.sin(t * 3) * 0.6
      // a faulty cell gives itself away with a rare red twitch — only if you watch it
      const tell = fake && Math.random() < 0.012
      m.color.setRGB(tell ? 3 : 0.13 * pulse, tell ? 0.2 : 0.94 * pulse, tell ? 0.3 : pulse)
    }
  })
  const mats = getMats()
  return (
    <group>
      <mesh castShadow>
        <cylinderGeometry args={[0.07, 0.07, 0.3, 14]} />
        <meshBasicMaterial ref={core} toneMapped={false} />
      </mesh>
      {[0.17, -0.17].map((y) => (
        <mesh key={y} position-y={y} material={mats.metal} castShadow>
          <cylinderGeometry args={[0.095, 0.095, 0.07, 14]} />
        </mesh>
      ))}
      <mesh>
        <cylinderGeometry args={[0.09, 0.09, 0.3, 14, 1, true]} />
        <meshPhysicalMaterial color="#9ff" transparent opacity={0.18} roughness={0} />
      </mesh>
    </group>
  )
}

function ChargeMesh() {
  const led = useRef<THREE.MeshBasicMaterial>(null)
  const mats = getMats()
  useFrame(({ clock }) => {
    if (led.current) led.current.color.setRGB(Math.sin(clock.elapsedTime * 8) > 0 ? 5 : 0.2, 0, 0)
  })
  return (
    <group>
      <mesh material={mats.hazard} castShadow>
        <boxGeometry args={[0.6, 0.4, 0.4]} />
      </mesh>
      {[-0.15, 0, 0.15].map((x) => (
        <mesh key={x} position={[x, 0.05, 0.205]} rotation-x={Math.PI / 2} material={mats.rust}>
          <cylinderGeometry args={[0.055, 0.055, 0.02, 10]} />
        </mesh>
      ))}
      <mesh position={[0.22, 0.21, 0.12]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshBasicMaterial ref={led} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.22, 0]} material={mats.black}>
        <boxGeometry args={[0.3, 0.05, 0.25]} />
      </mesh>
    </group>
  )
}

function PixelMesh() {
  const mats = getMats()
  return (
    <group>
      <mesh material={mats.metal} castShadow position={[0, -0.03, 0]}>
        <boxGeometry args={[0.42, 0.22, 0.22]} />
      </mesh>
      <mesh material={mats.black} position={[0.22, 0.1, 0]} castShadow>
        <boxGeometry args={[0.2, 0.18, 0.2]} />
      </mesh>
      {[-0.06, 0.06].map((z) => (
        <group key={z}>
          <mesh material={mats.black} position={[0.24, 0.23, z]} rotation-z={-0.2}>
            <coneGeometry args={[0.04, 0.09, 4]} />
          </mesh>
          <mesh position={[0.33, 0.12, z]}>
            <sphereGeometry args={[0.022, 8, 8]} />
            <meshBasicMaterial color={new THREE.Color('#22f0ff').multiplyScalar(4)} toneMapped={false} />
          </mesh>
        </group>
      ))}
      <mesh material={mats.neonPink} position={[-0.3, 0.06, 0]} rotation-z={0.9}>
        <cylinderGeometry args={[0.015, 0.015, 0.25, 6]} />
      </mesh>
    </group>
  )
}

function ItemMesh({ kind, socketed, fake, id }: { kind: ItemKind; socketed: boolean; fake: boolean; id: string }) {
  const mats = getMats()
  switch (kind) {
    case 'tile': return <TileMesh index={Number(id.replace('tile', ''))} />
    case 'hose': return <HoseMesh />
    case 'cell': return <CellMesh socketed={socketed} fake={fake} />
    case 'charge': return <ChargeMesh />
    case 'pixel': return <PixelMesh />
    case 'crate':
      return (
        <mesh material={mats.wood} castShadow receiveShadow>
          <boxGeometry args={[0.8, 0.8, 0.8]} />
        </mesh>
      )
    case 'can':
      return (
        <mesh castShadow>
          <cylinderGeometry args={[0.04, 0.04, 0.14, 12]} />
          <meshStandardMaterial color="#ff2e88" emissive="#ff2e88" emissiveIntensity={0.6} metalness={0.8} roughness={0.3} />
        </mesh>
      )
    case 'cone':
      return (
        <mesh castShadow position-y={0}>
          <coneGeometry args={[0.16, 0.6, 16]} />
          <meshStandardMaterial color="#ff7a1a" roughness={0.6} />
        </mesh>
      )
    case 'bottle':
      return (
        <mesh castShadow>
          <cylinderGeometry args={[0.03, 0.05, 0.3, 10]} />
          <meshStandardMaterial color="#1a6b4a" transparent opacity={0.7} roughness={0.1} />
        </mesh>
      )
    case 'chair':
      return (
        <group>
          <mesh material={mats.metal} position-y={0} castShadow>
            <boxGeometry args={[0.5, 0.06, 0.5]} />
          </mesh>
          <mesh material={mats.metal} position={[0, 0.3, -0.22]} castShadow>
            <boxGeometry args={[0.5, 0.6, 0.05]} />
          </mesh>
          <mesh material={mats.black} position-y={-0.23}>
            <boxGeometry args={[0.45, 0.45, 0.45]} />
          </mesh>
        </group>
      )
    case 'helmet':
      return (
        <mesh castShadow>
          <sphereGeometry args={[0.16, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#e6ff3a" roughness={0.5} />
        </mesh>
      )
    case 'pipe':
      return (
        <mesh material={mats.rust} rotation-z={Math.PI / 2} castShadow>
          <cylinderGeometry args={[0.05, 0.05, 1, 10]} />
        </mesh>
      )
  }
}

function TileMesh({ index }: { index: number }) {
  const code = useNet((s) => s.game?.armCode ?? '0000')
  const face = tileFaceTexture(code, index)
  const mats = getMats()
  return (
    <group>
      <mesh material={mats.concreteDark} castShadow receiveShadow>
        <boxGeometry args={[0.54, 0.54, 0.05]} />
      </mesh>
      <mesh position-z={0.027}>
        <planeGeometry args={[0.52, 0.52]} />
        <meshStandardMaterial map={face} emissiveMap={face} emissive="#ffffff" emissiveIntensity={0.35} roughness={0.5} />
      </mesh>
    </group>
  )
}

function HoseMesh() {
  return (
    <group rotation-x={Math.PI / 2}>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position-z={-0.08 + i * 0.08} castShadow>
          <torusGeometry args={[0.2, 0.04, 8, 24]} />
          <meshStandardMaterial color="#ff7a1a" roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0.22, 0, 0.12]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.05, 0.05, 0.16, 10]} />
        <meshStandardMaterial color="#9aa3ad" metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
  )
}

export type { ItemState }
