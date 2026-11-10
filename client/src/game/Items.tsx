import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { BallCollider, CuboidCollider, CylinderCollider, RigidBody, useRapier, type RapierRigidBody } from '@react-three/rapier'
import type { ItemKind } from '../../../shared/level'
import type { ItemState } from '../../../shared/protocol'
import { live, send, useNet } from '../net'
import { sfx } from './audio'
import { getItemGeo, getItemMats } from './item-materials'
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
  const tmp = useMemo(() => ({ v: new THREE.Vector3(), q: new THREE.Quaternion(), t: new THREE.Vector3(), a: new THREE.Vector3(), q2: new THREE.Quaternion() }), [])

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
      hold.rotate = 0
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
      // the item turns to face the player the same way every time (a tile shows its picture, a cell stands
      // upright in the hand); R turns it about its vertical
      if (keys.has('KeyR')) hold.rotate += dt * 3
      const r = rb.rotation()
      const turn = tmp.q.setFromAxisAngle(tmp.a.set(0, 1, 0), hold.rotate).premultiply(camera.quaternion).multiply(tmp.q2.set(r.x, r.y, r.z, r.w).invert())
      if (turn.w < 0) turn.set(-turn.x, -turn.y, -turn.z, -turn.w)
      const half = Math.sqrt(1 - Math.min(1, turn.w * turn.w))
      const spin = half < 1e-4 ? 0 : (2 * Math.acos(Math.min(1, turn.w)) * 12) / half
      rb.setAngvel({ x: turn.x * spin, y: turn.y * spin, z: turn.z * spin }, true)
      hold.view.set(p.x, p.y, p.z).sub(camera.position).applyQuaternion(tmp.q.copy(camera.quaternion).invert())
      hold.kind = it.kind

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

// ---------- what the items look like ----------
// Geometry and materials live in item-materials.ts and are shared by every item of a kind
// (dispose={null} keeps React from freeing them when one item unmounts). Every prop stays inside its
// collider above.

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
  const m = getItemMats()
  const g = getItemGeo().cell
  return (
    <group dispose={null}>
      <mesh geometry={g.core}>
        <meshBasicMaterial ref={core} toneMapped={false} />
      </mesh>
      <mesh geometry={g.frame} material={m.darkSteel} castShadow />
      <mesh geometry={g.terminals} material={m.brass} />
      <mesh geometry={g.paint} material={m.acidPaint} />
      <mesh geometry={g.glass} material={m.cellGlass} />
    </group>
  )
}

function ChargeMesh() {
  const led = useRef<THREE.MeshBasicMaterial>(null)
  useFrame(({ clock }) => {
    if (led.current) led.current.color.setRGB(Math.sin(clock.elapsedTime * 8) > 0 ? 5 : 0.2, 0, 0)
  })
  const m = getItemMats()
  const g = getItemGeo().charge
  return (
    <group dispose={null}>
      <mesh geometry={g.body} material={m.chargeShell} castShadow />
      <mesh geometry={g.bands} material={m.stripes} />
      <mesh geometry={g.panel} material={m.rubber} />
      <mesh geometry={g.sticks} material={m.brass} />
      <mesh geometry={g.plate} material={m.chargePlate} />
      <mesh geometry={g.rubber} material={m.rubber} castShadow />
      <mesh geometry={g.display} material={m.timer} />
      <mesh geometry={g.wire} material={m.wire} />
      <mesh geometry={g.bolts} material={m.steel} />
      <mesh geometry={g.led}>
        <meshBasicMaterial ref={led} toneMapped={false} />
      </mesh>
    </group>
  )
}

function PixelMesh() {
  const m = getItemMats()
  const g = getItemGeo().pixel
  return (
    <group dispose={null}>
      <mesh geometry={g.shell} material={m.shell} castShadow />
      <mesh geometry={g.dark} material={m.darkSteel} castShadow />
      <mesh geometry={g.visor} material={m.gloss} />
      <mesh geometry={g.collar} material={m.collar} />
      <mesh geometry={g.cyan} material={m.glowCyan} />
      <mesh geometry={g.pink} material={m.glowPink} />
    </group>
  )
}

export function ItemMesh({ kind, socketed, fake, id }: { kind: ItemKind; socketed: boolean; fake: boolean; id: string }) {
  const mats = getMats()
  const m = getItemMats()
  const geo = getItemGeo()
  switch (kind) {
    case 'tile': return <TileMesh index={Number(id.replace('tile', ''))} />
    case 'hose': return <HoseMesh />
    case 'cell': return <CellMesh socketed={socketed} fake={fake} />
    case 'charge': return <ChargeMesh />
    case 'pixel': return <PixelMesh />
    case 'crate':
      return (
        <group dispose={null}>
          <mesh geometry={geo.crate.panels} material={m.planks} castShadow receiveShadow />
          <mesh geometry={geo.crate.beams} material={m.beam} castShadow receiveShadow />
          <mesh geometry={geo.crate.corners} material={m.darkSteel} />
          <mesh geometry={geo.crate.tags} material={m.glowCyan} />
        </group>
      )
    case 'can':
      return (
        <group dispose={null}>
          <mesh geometry={geo.can.label} material={m.canLabel} castShadow />
          <mesh geometry={geo.can.alu} material={m.alu} />
        </group>
      )
    case 'cone':
      return (
        <group dispose={null}>
          <mesh geometry={geo.cone.body} material={m.coneOrange} castShadow />
          <mesh geometry={geo.cone.base} material={m.rubber} castShadow />
          <mesh geometry={geo.cone.bands} material={m.reflective} />
        </group>
      )
    case 'bottle':
      return (
        <group dispose={null}>
          <mesh geometry={geo.bottle.drink} material={m.drink} />
          <mesh geometry={geo.bottle.label} material={m.bottleLabel} />
          <mesh geometry={geo.bottle.cap} material={m.capAmber} />
          <mesh geometry={geo.bottle.glass} material={m.bottleGlass} castShadow />
        </group>
      )
    case 'chair':
      return (
        <group dispose={null}>
          <mesh geometry={geo.chair.frame} material={m.steel} castShadow />
          <mesh geometry={geo.chair.shell} material={m.seat} castShadow />
          <mesh geometry={geo.chair.feet} material={m.rubber} />
          <mesh geometry={geo.chair.bolts} material={m.steel} />
          <mesh geometry={geo.chair.tag} material={m.glowAcid} />
        </group>
      )
    case 'helmet':
      return (
        <group dispose={null}>
          <mesh geometry={geo.helmet.shell} material={m.helmet} castShadow />
          <mesh geometry={geo.helmet.dark} material={m.rubber} />
          <mesh geometry={geo.helmet.lens} material={m.glowLamp} />
        </group>
      )
    case 'pipe':
      return (
        <group rotation-z={Math.PI / 2} dispose={null}>
          <mesh geometry={geo.pipe.tube} material={mats.rust} castShadow />
          <mesh geometry={geo.pipe.fittings} material={m.steel} castShadow />
          <mesh geometry={geo.pipe.paint} material={m.amberPaint} />
          <mesh geometry={geo.pipe.bore} material={m.rubber} />
        </group>
      )
  }
}

function TileMesh({ index }: { index: number }) {
  const code = useNet((s) => s.game?.armCode ?? '0000')
  const face = tileFaceTexture(code, index)
  const mats = getMats()
  const m = getItemMats()
  const g = getItemGeo().tile
  return (
    <group dispose={null}>
      <mesh geometry={g.slab} material={mats.concreteDark} castShadow receiveShadow />
      <mesh geometry={g.back} material={mats.concrete} />
      <mesh geometry={g.frame} material={m.bronze} />
      <mesh geometry={g.face} position-z={0.027}>
        <meshStandardMaterial map={face} emissiveMap={face} emissive="#ffffff" emissiveIntensity={0.35} roughness={0.32} />
      </mesh>
    </group>
  )
}

function HoseMesh() {
  const m = getItemMats()
  const g = getItemGeo().hose
  return (
    <group dispose={null}>
      <mesh geometry={g.coils} material={m.weave} castShadow />
      <mesh geometry={g.straps} material={m.rubber} />
      <mesh geometry={g.buckles} material={m.steel} />
      <mesh geometry={g.nozzle} material={m.brass} castShadow />
      <mesh geometry={g.grip} material={m.rubber} />
      <mesh geometry={g.tag} material={m.glowAmber} />
    </group>
  )
}

export type { ItemState }
