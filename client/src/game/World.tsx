import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { Reflector } from 'three/examples/jsm/objects/Reflector.js'
import { CODE_SIGN_POS, DIRT_PILES, PIT_Y, PUMP_DOOR, SERVICE_DOOR, TRANSFER_DOOR, type Vec3 } from '../../../shared/level'
import { BatchSet, boxGeo } from './geo'
import { Floor2, STAIR_DOOR } from './Floor2'
import { TrainCar } from './TrainCar'
import { getMats, type MatKey } from './materials'
import { useNet } from '../net'

// c: false = no collider; v: false = collider only (the visual is drawn elsewhere)
interface BoxDef { p: Vec3; s: Vec3; m: MatKey; c?: boolean; uv?: number; r?: Vec3; shadow?: boolean; v?: boolean }

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
  // west wall, with the doorway to the stairwell up to the second floor (Floor2.tsx)
  {
    const d0 = STAIR_DOOR.z - STAIR_DOOR.width / 2
    const d1 = STAIR_DOOR.z + STAIR_DOOR.width / 2
    add([-14.2, 1.6, (-17 + d0) / 2], [0.4, 3.2, d0 + 17], 'concrete')
    add([-14.2, 1.6, (d1 - 7) / 2], [0.4, 3.2, -7 - d1], 'concrete')
    add([-14.2, (STAIR_DOOR.height + 3.2) / 2, STAIR_DOOR.z], [0.4, 3.2 - STAIR_DOOR.height, STAIR_DOOR.width], 'concrete')
  }
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

  // the 1977 train car in the west tunnel is its own component: see TrainCar.tsx

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
  // all static blocks merged per material: a dozen draw calls instead of ~200
  const merged = useMemo(() => {
    const cast = new BatchSet<MatKey>()
    const flat = new BatchSet<MatKey>()
    for (const b of boxes) if (b.v !== false) (b.s[1] < 3 ? cast : flat).of(b.m).box(b.p, b.s, b.uv ?? (b.m === 'concrete' || b.m === 'concreteDark' ? 3 : 2), b.r)
    return { cast: cast.build(), flat: flat.build() }
  }, [boxes])
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
      {merged.cast.map(([m, g]) => <mesh key={`c${m}`} geometry={g} material={mats[m]} receiveShadow castShadow />)}
      {merged.flat.map(([m, g]) => <mesh key={`f${m}`} geometry={g} material={mats[m]} receiveShadow />)}
      <WetFloor />
      <Tracks />
      <TrainCar />
      <Floor2 />
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

// Wet granite platform. A lit standard material (so the flashlight and station lights work on it)
// plus a planar reflection added on top: sharp in the puddles, smeared on the damp stone.
function WetFloor() {
  const mats = getMats()
  const refl = useMemo(() => {
    const geo = new THREE.PlaneGeometry(44, 11.4)
    const pos = geo.attributes.position
    const uv = geo.attributes.uv
    // same world-metre UVs as the floor slab underneath (1 repeat = 3 m)
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 3, (-pos.getY(i) - 1.2) / 3)
    const r = new Reflector(geo, { textureWidth: 512, textureHeight: 512, clipBias: 0.003, multisample: 0 })
    const stock = r.material as THREE.ShaderMaterial
    const tex = r.getRenderTarget().texture
    const matrix = stock.uniforms.textureMatrix.value as THREE.Matrix4
    const src = mats.floor
    const mat = new THREE.MeshStandardMaterial({
      map: src.map, normalMap: src.normalMap, roughnessMap: src.roughnessMap, roughness: 1, metalness: 0.1,
      normalScale: new THREE.Vector2(0.6, 0.6),
    })
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.tRefl = { value: tex }
      sh.uniforms.reflMatrix = { value: matrix }
      sh.vertexShader = 'uniform mat4 reflMatrix;\nvarying vec4 vRefl;\n' + sh.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvRefl = reflMatrix * vec4(transformed, 1.0);',
      )
      sh.fragmentShader = 'uniform sampler2D tRefl;\nvarying vec4 vRefl;\n' + sh.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        /* glsl */ `#include <emissivemap_fragment>
        {
          vec2 ruv = vRefl.xy / vRefl.w;
          vec3 nt = texture2D(normalMap, vNormalMapUv).xyz * 2.0 - 1.0;
          float wet = 1.0 - smoothstep(0.1, 0.55, roughnessFactor);
          ruv += nt.xy * mix(0.012, 0.03, wet);
          vec2 sp = vec2(0.004, 0.014) * mix(1.0, 0.25, wet);
          vec3 acc = texture2D(tRefl, ruv).rgb * 0.28;
          acc += texture2D(tRefl, ruv + vec2(sp.x, sp.y)).rgb * 0.18;
          acc += texture2D(tRefl, ruv + vec2(-sp.x, sp.y * 0.6)).rgb * 0.18;
          acc += texture2D(tRefl, ruv + vec2(sp.x * 0.5, -sp.y)).rgb * 0.18;
          acc += texture2D(tRefl, ruv + vec2(-sp.x * 0.6, -sp.y * 0.5)).rgb * 0.18;
          acc = min(acc, vec3(2.5));
          float fres = pow(1.0 - saturate(dot(normalize(vViewPosition), normal)), 2.5);
          totalEmissiveRadiance += acc * (0.07 + 0.93 * fres) * mix(0.3, 1.0, wet);
        }`,
      )
    }
    stock.dispose()
    r.material = mat
    r.rotation.x = -Math.PI / 2
    r.position.set(0, 0.003, -1.2)
    r.receiveShadow = true
    // budget: the mirror pass redraws the scene, so run it every other frame and only while the
    // camera is somewhere the platform can actually be seen from (not deep in the tunnels / branch B)
    const pass = r.onBeforeRender
    const eye = new THREE.Vector3()
    let frame = 0
    r.onBeforeRender = function (this: THREE.Object3D, ...args: Parameters<THREE.Object3D['onBeforeRender']>) {
      eye.setFromMatrixPosition(args[2].matrixWorld)
      if (eye.y < 0.05 || eye.x < -23 || eye.x > 36 || eye.z < -18) return
      if (frame++ % 2) return
      pass.apply(this, args)
    }
    return r
  }, [mats])
  return <primitive object={refl} />
}

// Track bed: ballast, concrete sleepers with tie plates, profiled rails and the maglev guide strip.
function Tracks() {
  const mats = getMats()
  const geos = useMemo(() => {
    const B = new BatchSet<MatKey>()
    B.of('gravel').box([8, PIT_Y + 0.004, 8], [116, 0.02, 3.5], 2)
    for (let i = 0; i < 140; i++) {
      const x = -49.5 + i * 0.82
      B.of('concreteDark').box([x, PIT_Y + 0.04, 8], [0.25, 0.08, 2.4], 1)
      for (const z of [7.25, 8.75]) B.of('paint').box([x, PIT_Y + 0.088, z], [0.2, 0.016, 0.3], 1)
    }
    for (const z of [7.25, 8.75]) {
      B.of('rail').box([8, PIT_Y + 0.102, z], [116, 0.02, 0.15], 1) // foot
      B.of('rail').box([8, PIT_Y + 0.15, z], [116, 0.08, 0.025], 1) // web
      B.of('rail').box([8, PIT_Y + 0.2, z], [116, 0.035, 0.07], 1) // head
    }
    // maglev guide strip in a steel channel, with its glow on the ballast
    B.of('paint').box([8, PIT_Y + 0.05, 8], [116, 0.09, 0.16], 1)
    B.of('neonCyan').box([8, PIT_Y + 0.1, 8], [116, 0.02, 0.06], 1)
    B.of('stripCyan').quad([8, PIT_Y + 0.1, 8], 116, 1.5, '+y')
    return B.build()
  }, [])
  return (
    <group>
      {geos.map(([m, g]) => <mesh key={m} geometry={g} material={mats[m]} receiveShadow={!NO_SHADOW.test(m)} />)}
    </group>
  )
}

// ---------- decoration: no colliders, hugs walls and ceilings, merged per material ----------
type Deco = BatchSet<MatKey>
type Face = '+x' | '-x' | '+y' | '-y' | '+z' | '-z'
const NORMAL: Record<Face, Vec3> = { '+x': [1, 0, 0], '-x': [-1, 0, 0], '+y': [0, 1, 0], '-y': [0, -1, 0], '+z': [0, 0, 1], '-z': [0, 0, -1] }

// additive light card lying on a surface whose outward normal is `face`
function card(B: Deco, key: MatKey, p: Vec3, w: number, h: number, face: Face, roll = false) {
  if (!roll) return void B.of(key).quad(p, w, h, face)
  const g = new THREE.PlaneGeometry(h, w)
  g.rotateZ(Math.PI / 2)
  const r: Record<Face, Vec3> = {
    '+z': [0, 0, 0], '-z': [0, Math.PI, 0], '+x': [0, Math.PI / 2, 0], '-x': [0, -Math.PI / 2, 0],
    '+y': [-Math.PI / 2, 0, 0], '-y': [Math.PI / 2, 0, 0],
  }
  B.of(key).add(g, p, r[face])
}

// caged bulkhead lamp on a wall, with its pool of light on the wall behind
function bulkhead(B: Deco, p: Vec3, face: Face, lamp: MatKey, glow: MatKey, size = 1) {
  const n = NORMAL[face]
  const alongX = n[0] === 0
  const w = 0.5 * size
  const at = (d: number, dy = 0): Vec3 => [p[0] + n[0] * d, p[1] + dy, p[2] + n[2] * d]
  const sz = (len: number, hgt: number, dep: number): Vec3 => (alongX ? [len, hgt, dep] : [dep, hgt, len])
  B.of('paint').box(at(0.03), sz(w + 0.14, 0.26 * size, 0.06), 1)
  B.of(lamp).box(at(0.09), sz(w, 0.13 * size, 0.08), 1)
  for (const k of [-0.33, 0, 0.33]) {
    const o: Vec3 = alongX ? [k * w, 0, 0] : [0, 0, k * w]
    const c = at(0.11)
    B.of('paint').box([c[0] + o[0], c[1], c[2] + o[2]], sz(0.018, 0.2 * size, 0.1), 1)
  }
  card(B, glow, at(0.012), 3 * size, 3 * size, face)
}

// pipe / cable run along x with wall brackets
function runX(B: Deco, key: MatKey, x0: number, x1: number, y: number, z: number, r: number, seg = 8) {
  B.of(key).cyl([(x0 + x1) / 2, y, z], r, x1 - x0, 'x', seg)
}

function hallDecor(B: Deco) {
  // ceiling: transverse beams, a spine over the pillar row and a fascia over the platform edge
  for (let x = -21.1; x < 22; x += 4.2) B.of('concreteDark').box([x, 5.78, 2], [0.5, 0.44, 18.4])
  B.of('concreteDark').box([0, 5.7, -0.5], [44, 0.6, 1.1])
  B.of('concreteDark').box([0, 5.6, 4.95], [44, 0.8, 0.5])
  B.of('paint').box([0, 5.17, 4.95], [44, 0.06, 0.56], 1)

  // hanging tube fixtures: cyan row over the concourse, pink row over the platform
  const fixture = (x: number, z: number, neon: MatKey, glow: MatKey) => {
    B.of('paint').box([x, 5.53, z], [3.16, 0.07, 0.2], 1)
    B.of(neon).cyl([x, 5.455, z], 0.04, 3, 'x', 8)
    for (const dx of [-1.3, 1.3]) {
      B.of('paint').cyl([x + dx, 5.78, z], 0.012, 0.44, 'y', 5)
      B.of('paint').box([x + dx * 1.17, 5.46, z], [0.06, 0.1, 0.1], 1)
    }
    card(B, glow, [x, 5.995, z], 4.6, 2.6, '-y')
  }
  for (let x = -19; x <= 19; x += 4.2) {
    fixture(x, -4, 'neonCyan', 'stripCyan')
    fixture(Math.min(x + 2, 20.2), 1.5, 'neonPink', 'stripPink')
  }

  // pillars: plinth, capital, neon in a channel with its wash on the tile
  for (const x of [-15, -7.5, 7.5, 15]) {
    B.of('stone').box([x, 0.16, -0.5], [1.06, 0.32, 1.06], 1)
    B.of('trim').box([x, 0.335, -0.5], [1.0, 0.03, 1.0], 1)
    B.of('stone').box([x, 5.0, -0.5], [1.04, 0.1, 1.04], 1)
    B.of('stone').box([x, 5.25, -0.5], [1.3, 0.4, 1.3], 1)
    const front: MatKey = x < 0 ? 'neonPink' : 'neonCyan'
    const back: MatKey = x < 0 ? 'neonCyan' : 'neonPink'
    for (const [z, key, face] of [[-0.02, front, '+z'], [-0.98, back, '-z']] as const) {
      B.of(key).cyl([x, 2.7, z], 0.028, 4.3, 'y', 6)
      B.of('paint').box([x, 0.5, z], [0.1, 0.1, 0.08], 1)
      B.of('paint').box([x, 4.9, z], [0.1, 0.1, 0.08], 1)
      card(B, key === 'neonPink' ? 'stripPink' : 'stripCyan', [x, 2.7, z < -0.5 ? -0.953 : -0.047], 0.86, 4.6, face, true)
    }
  }

  // walls: stone skirting + steel dado rail, broken at the doorways
  const north: [number, number][] = [[-22, -9.25], [-6.75, 5.85], [10.15, 22]]
  for (const [a, b] of north) {
    B.of('stone').box([(a + b) / 2, 0.15, -6.97], [b - a, 0.3, 0.06], 1)
    B.of('trim').box([(a + b) / 2, 0.315, -6.975], [b - a, 0.03, 0.05], 1)
  }
  B.of('stone').box([-21.97, 0.15, -1], [0.06, 0.3, 12], 1)
  for (const [a, b] of [[-7, -4.15], [-1.85, 5]]) B.of('stone').box([21.97, 0.15, (a + b) / 2], [0.06, 0.3, b - a], 1)

  // cable tray under the ceiling of the north wall, with drops to the panel, keypad and kiosk
  B.of('paint').box([0, 5.02, -6.84], [44, 0.03, 0.3], 1)
  B.of('paint').box([0, 5.07, -6.7], [44, 0.08, 0.02], 1)
  for (let x = -21; x <= 21; x += 3) B.of('paint').box([x, 4.94, -6.86], [0.05, 0.14, 0.26], 1)
  runX(B, 'cable', -22, 22, 5.075, -6.9, 0.04, 6)
  runX(B, 'cable', -22, 22, 5.07, -6.81, 0.03, 6)
  runX(B, 'pipeTeal', -22, 22, 5.08, -6.74, 0.022, 6)
  for (const [x, y0] of [[-2.9, 2.2], [-6.3, 1.66], [3.2, 2.0], [-1.1, 2.2]]) B.of('cable').cyl([x, (y0 + 5.02) / 2, -6.97], 0.022, 5.02 - y0, 'y', 6)

  // emergency bulkheads
  for (const x of [-18, -6, 6, 18]) bulkhead(B, [x, 5.4, -7], '+z', 'emergency', 'glowRed')

  // door frames
  const frameZ = (x: number, w: number, hgt: number, key: MatKey) => {
    for (const s of [-1, 1]) B.of(key).box([x + s * (w / 2 + 0.08), hgt / 2, -6.94], [0.16, hgt, 0.14], 1)
    B.of(key).box([x, hgt + 0.08, -6.94], [w + 0.32, 0.16, 0.14], 1)
  }
  frameZ(-8, 2.2, 2.8, 'paint')
  frameZ(8, 4, 2.8, 'trim')
  B.of('hazard').box([-8, 2.98, -6.93], [2.52, 0.06, 0.15], 1)
  for (const s of [-1, 1]) B.of('paint').box([21.94, 1.4, -3 + s * 1.08], [0.14, 2.8, 0.16], 1)
  B.of('paint').box([21.94, 2.88, -3], [0.14, 0.16, 2.32], 1)

  // platform edge: steel nosing, service cables under the lip
  B.of('trim').box([0, -0.045, 5.05], [44, 0.09, 0.12], 1)
  runX(B, 'cable', -19.8, 19.8, -0.34, 5.05, 0.035, 6)
  runX(B, 'cable', -19.8, 19.8, -0.43, 5.04, 0.025, 6)
  for (let x = -19; x <= 19; x += 2) B.of('paint').box([x, -0.38, 5.03], [0.05, 0.2, 0.06], 1)

  // far wall of the track pit: pilasters, kerb, enamel board behind the station name
  for (let x = -19.8; x <= 20; x += 4.4) {
    if (Math.abs(x) < 5.5) continue
    B.of('tileDark').box([x, 2.35, 10.93], [0.7, 7.3, 0.14], 2)
    B.of('stone').box([x, PIT_Y + 0.35, 10.93], [0.84, 0.7, 0.14], 1)
  }
  B.of('stone').box([0, PIT_Y + 0.04, 10.9], [44, 0.08, 0.2], 1)
  B.of('paint').box([0, 3.9, 10.992], [9.8, 2.2, 0.03], 1)
  for (const dy of [-1.12, 1.12]) B.of('trim').box([0, 3.9 + dy, 10.975], [9.9, 0.05, 0.05], 1)
  for (const dx of [-4.93, 4.93]) B.of('trim').box([dx, 3.9, 10.975], [0.05, 2.3, 0.05], 1)
  card(B, 'glowCyan', [0, 3.9, 10.972], 13, 5, '-z')

  // pendant lamps over the tracks
  for (const [x, neon, glow] of [[-10, 'neonAcid', 'glowAcid'], [10, 'neonCyan', 'glowCyan']] as const) {
    B.of('paint').cyl([x, 5.2, 6], 0.015, 1.6, 'y', 5)
    B.of('paint').cyl([x, 4.3, 6], 0.5, 0.26, 'y', 14, 0.12)
    B.of(neon).cyl([x, 4.165, 6], 0.4, 0.02, 'y', 14)
    card(B, glow, [x, 5.994, 6], 5, 5, '-y')
  }

  // hangers for the two code signs over the platform edge (the signs themselves live in Puzzles)
  for (const [x, y] of [[CODE_SIGN_POS[1][0], CODE_SIGN_POS[1][1]], [CODE_SIGN_POS[2][0], CODE_SIGN_POS[2][1]]]) {
    B.of('paint').box([x, y, 4.66], [3.6, 1.06, 0.06], 1)
    for (const dx of [-1.5, 1.5]) B.of('paint').cyl([x + dx, (y + 0.5 + 5.2) / 2, 4.66], 0.015, 5.2 - y - 0.5, 'y', 5)
  }

  // benches: back rest and arm rails
  for (const x of [-12.5, 12.5]) {
    B.of('wood').box([x, 0.82, -6.56], [2.4, 0.34, 0.05], 1, [-0.14, 0, 0])
    B.of('wood').box([x, 0.49, -6.2], [2.4, 0.012, 0.18], 1)
    for (const s of [-1.16, 1.16]) {
      B.of('trim').box([x + s, 0.5, -6.6], [0.05, 1.0, 0.05], 1)
      B.of('trim').box([x + s, 0.68, -6.25], [0.05, 0.04, 0.7], 1)
      B.of('trim').box([x + s, 0.34, -5.92], [0.05, 0.68, 0.05], 1)
    }
  }

  // ticket booth: roof rim, counter, dark window
  B.of('paint').box([-20.5, 1.87, -6.3], [2.36, 0.06, 1.56], 1)
  B.of('trim').box([-20.5, 0.72, -5.56], [1.8, 0.04, 0.16], 1)
  B.of('glass').box([-20.5, 1.02, -5.595], [1.6, 0.5, 0.012], 1)
  for (const dy of [-0.27, 0.27]) B.of('trim').box([-20.5, 1.02 + dy, -5.59], [1.68, 0.04, 0.03], 1)
  for (const dx of [-0.82, 0, 0.82]) B.of('trim').box([-20.5 + dx, 1.02, -5.59], [0.04, 0.5, 0.03], 1)
}

// Both running tunnels (x −50…−22 and 22…66). The 1977 car's footprint (x −49.5…−42, z 6…10) stays clear.
function tunnelDecor(B: Deco) {
  const spans: [number, number][] = [[-50, -22], [22, 60.5]]
  const inAny = (x: number, list: [number, number][]) => list.some(([a, b]) => x > a && x < b)
  // places on each wall that carry puzzle pieces or signs: nothing decorative goes over them
  const northBusy: [number, number][] = [[-40.6, -30], [38, 42]]
  const southBusy: [number, number][] = [[-32.6, -27.4], [38.3, 41.7], [45.2, 46.8]]
  for (const [a, b] of spans) {
    const mid = (a + b) / 2
    const len = b - a
    // low drain covers along both walls (kept flat so a dropped item can never hide behind them)
    B.of('stone').box([mid, PIT_Y + 0.025, 10.82], [len, 0.05, 0.36], 1)
    for (const [k0, k1] of a < 0 ? [[a, -36.2], [-33.8, b]] : [[a, b]]) B.of('stone').box([(k0 + k1) / 2, PIT_Y + 0.025, 5.18], [k1 - k0, 0.05, 0.36], 1)
    // lamp conduit along the north wall, second pipe along the south wall
    runX(B, 'cable', a, b, PIT_Y + 3.52, 5.04, 0.02, 5)
    runX(B, 'pipeTeal', a, b, PIT_Y + 3.95, 10.86, 0.08, 8)
    // structural ribs every 4 m, with pipe saddles on the south wall
    for (let x = Math.ceil(a / 4) * 4 + (a < 0 ? 2 : 2); x < b; x += 4) {
      if (!inAny(x, northBusy)) B.of('concreteDark').box([x, PIT_Y + 2.1, 5.06], [0.32, 4.2, 0.12], 1)
      if (!inAny(x, southBusy)) B.of('concreteDark').box([x, PIT_Y + 2.1, 10.94], [0.32, 4.2, 0.12], 1)
      if (x > -41.4) B.of('concreteDark').box([x, T - 0.07, 8], [0.32, 0.14, 5.8], 1)
      B.of('paint').box([x, PIT_Y + 3.6, 10.72], [0.08, 0.56, 0.5], 1)
      B.of('pipe').cyl([x + 1.3, PIT_Y + 3.6, 10.6], 0.27, 0.07, 'x', 12)
      B.of('paint').box([x, PIT_Y + 2.62, 10.9], [0.06, 0.2, 0.2], 1)
    }
    // junction boxes on the south wall
    for (let x = a + 5; x < b; x += 12) {
      if (inAny(x, southBusy) || inAny(x + 0.01, [[-49.5, -42]])) continue
      B.of('paint').box([x, PIT_Y + 1.9, 10.93], [0.45, 0.6, 0.14], 1)
      B.of('cable').cyl([x, PIT_Y + 2.4, 10.95], 0.018, 0.4, 'y', 5)
      B.of('emergency').box([x + 0.14, PIT_Y + 2.1, 10.855], [0.04, 0.04, 0.02], 1)
    }
  }
  // bulkhead lamps on the north wall with their pools of light on wall and ballast
  for (let x = -46; x <= 62; x += 8) {
    if (x > -22 && x < 22) continue
    const red = x % 16 === 0
    bulkhead(B, [x, PIT_Y + 3.2, 5], '+z', red ? 'emergency' : 'tunnelLamp', red ? 'glowRed' : 'glowWarm', 0.9)
    B.of('cable').cyl([x, PIT_Y + 3.42, 5.04], 0.018, 0.2, 'y', 5)
    if (x > -41) card(B, red ? 'glowRed' : 'glowWarm', [x, PIT_Y + 0.03, 6.3], 4.4, 3, '+y')
  }
  // tunnel portals at both ends of the platform: hazard jambs and a steel lintel
  for (const s of [-1, 1]) {
    for (const z of [5.16, 10.84]) B.of('hazard').box([s * 21.95, PIT_Y + 2.1, z], [0.3, 4.2, 0.3], 1)
    B.of('paint').box([s * 21.95, T + 0.16, 8], [0.34, 0.32, 6.4], 1)
    B.of('trim').box([s * 21.95, T - 0.02, 8], [0.36, 0.04, 5.4], 1)
  }
}

function maintDecor(B: Deco) {
  // strip light as a proper fitting, with its wash on the ceiling
  B.of('paint').box([-8, 3.185, -12], [6.3, 0.03, 0.3], 1)
  card(B, 'stripCyan', [-8, 3.196, -12], 8.5, 3.4, '-y')
  // ceiling services: duct along the west side with grilles, two pipes along the east side
  B.of('paint').box([-12.9, 2.98, -12], [0.7, 0.36, 9.9], 1)
  for (const z of [-15, -12, -9]) B.of('black').box([-12.9, 2.795, z], [0.5, 0.01, 0.8], 1)
  B.of('pipe').cyl([-2.75, 2.98, -12], 0.09, 10, 'z', 8)
  B.of('pipeTeal').cyl([-3.05, 3.02, -12], 0.05, 10, 'z', 8)
  for (const z of [-15.5, -12, -8.5]) B.of('paint').box([-2.85, 3.1, z], [0.5, 0.2, 0.06], 1)
  // skirting
  B.of('stone').box([-8, 0.1, -16.96], [12, 0.2, 0.08], 1)
  B.of('stone').box([-13.96, 0.1, -11.2], [0.08, 0.2, 8.4], 1) // stops short of the stairwell doorway
  B.of('stone').box([-2.04, 0.1, -12], [0.08, 0.2, 10], 1)
  // lockers on the east wall
  for (let i = 0; i < 4; i++) {
    const z = -10 - i * 0.66
    B.of('metal').box([-2.17, 0.98, z], [0.26, 1.96, 0.62], 1)
    B.of('paint').box([-2.305, 1.5, z], [0.012, 0.12, 0.34], 1)
    B.of('trim').box([-2.31, 1.0, z + 0.22], [0.02, 0.12, 0.03], 1)
  }
  // shelving above the rack on the back wall (kept shallow so the lamp to its right stays in view)
  for (const x of [-11.45, -8.55]) B.of('trim').box([x, 1.2, -16.9], [0.05, 2.4, 0.05], 1)
  for (const y of [1.5, 2.05]) B.of('rust').box([-10, y, -16.7], [2.9, 0.04, 0.5], 1)
  for (const [x, y, w, h, k] of [[-11, 1.66, 0.5, 0.28, 'wood'], [-10.2, 1.62, 0.4, 0.2, 'paint'], [-9.2, 1.7, 0.55, 0.36, 'wood'], [-10.7, 2.2, 0.6, 0.26, 'paint'], [-9.5, 2.17, 0.36, 0.2, 'pipeTeal']] as const) {
    B.of(k).box([x, y, -16.7], [w, h, 0.36], 1)
  }
  // legs for the charge table, frame for the schematic screen, plate behind the signal lamp
  for (const dx of [-0.72, 0.72]) for (const dz of [-0.42, 0.42]) B.of('trim').box([-4.6 + dx, 0.19, -14 + dz], [0.05, 0.38, 0.05], 1)
  for (const dy of [-0.73, 0.73]) B.of('paint').box([-13.97, 1.8 + dy, -12], [0.05, 0.08, 2.4], 1)
  for (const dz of [-1.16, 1.16]) B.of('paint').box([-13.97, 1.8, -12 + dz], [0.05, 1.54, 0.08], 1)
  B.of('paint').box([-8, 2.6, -16.985], [0.34, 0.34, 0.03], 1)
  B.of('cable').cyl([-8, 2.98, -16.97], 0.015, 0.44, 'y', 5)

  // elevator cabin: hand rails, corner trims, light wash
  B.of('trim').box([8, 1.0, -10.44], [3.9, 0.05, 0.05], 1)
  for (const x of [6.06, 9.94]) {
    B.of('trim').box([x, 1.0, -8.9], [0.05, 0.05, 3.0], 1)
    B.of('paint').box([x, 1.45, -10.44], [0.08, 2.9, 0.08], 1)
  }
  B.of('paint').box([8, 2.895, -8.85], [2.2, 0.02, 0.8], 1)
  card(B, 'stripAcid', [8, 2.896, -8.85], 3.6, 2.6, '-y')
}

function pumpDecor(B: Deco) {
  const P = PIT_Y
  // ceiling beams and kerb (broken at the doorway)
  for (const x of [-41.75, -37.25, -32.75, -28.25]) B.of('concreteDark').box([x, P + 3.87, -1.2], [0.34, 0.26, 12], 1)
  B.of('stone').box([-35, P + 0.1, -6.95], [18, 0.2, 0.1], 1)
  for (const x of [-43.95, -26.05]) B.of('stone').box([x, P + 0.1, -1.2], [0.1, 0.2, 11.6], 1)
  for (const [a, b] of [[-44, -36.2], [-33.8, -26]]) B.of('stone').box([(a + b) / 2, P + 0.1, 4.55], [b - a, 0.2, 0.1], 1)
  // tanks: hoops, hatch, gauge, risers into the ceiling
  for (const x of [-40.5, -29.5]) {
    for (const y of [0.5, 1.6, 2.7]) B.of('trim').box([x, P + y, -5.6], [2.27, 0.09, 2.27], 1)
    B.of('paint').cyl([x - 0.5, P + 1.1, -4.47], 0.32, 0.06, 'z', 14)
    B.of('trim').cyl([x - 0.5, P + 1.1, -4.44], 0.06, 0.06, 'z', 8)
    B.of('paint').cyl([x + 0.6, P + 2.1, -4.48], 0.16, 0.04, 'z', 12)
    B.of('neonAmber').box([x + 0.6, P + 2.1, -4.455], [0.02, 0.1, 0.01], 1)
    B.of('pipe').cyl([x, P + 3.6, -5.6], 0.16, 0.8, 'y', 10)
    B.of('pipe').cyl([x, P + 3.24, -5.6], 0.24, 0.07, 'y', 10)
  }
  // manifold between the tanks, feeding the pump from above
  B.of('pipeTeal').cyl([-35, P + 2.6, -5.6], 0.13, 8.8, 'x', 10)
  B.of('pipeTeal').cyl([-35, P + 2.6, -4.7], 0.13, 1.8, 'z', 10)
  B.of('pipeTeal').cyl([-35, P + 2.2, -3.8], 0.13, 0.9, 'y', 10)
  for (const p of [[-35, P + 2.6, -5.6], [-35, P + 2.6, -3.8]] as Vec3[]) B.of('pipeTeal').add(new THREE.SphereGeometry(0.17, 10, 8), p)
  for (const x of [-38, -32]) B.of('paint').cyl([x, P + 2.6, -5.6], 0.19, 0.08, 'x', 10)
  B.of('trim').cyl([-35, P + 1.82, -3.8], 0.2, 0.06, 'y', 10)
  // wall runs
  runX(B, 'pipe', -44, -26, P + 3.3, -6.84, 0.11, 8)
  runX(B, 'cable', -44, -26, P + 3.62, -6.92, 0.04, 6)
  for (let x = -43; x <= -27; x += 4) B.of('paint').box([x, P + 3.3, -6.9], [0.08, 0.34, 0.2], 1)
  B.of('pipeTeal').cyl([-43.86, P + 3.4, -1.2], 0.07, 11.6, 'z', 8)
  // floor drains
  for (const x of [-39, -31]) {
    B.of('black').box([x, P + 0.004, 1.2], [1.4, 0.01, 0.5], 1)
    for (let i = -3; i <= 3; i++) B.of('trim').box([x + i * 0.2, P + 0.012, 1.2], [0.04, 0.012, 0.5], 1)
  }
  // work lamp over the pump
  B.of('paint').cyl([-35, P + 3.75, -1], 0.015, 0.5, 'y', 5)
  B.of('paint').cyl([-35, P + 3.42, -1], 0.5, 0.24, 'y', 14, 0.12)
  B.of('neonCyan').cyl([-35, P + 3.29, -1], 0.4, 0.02, 'y', 14)
  card(B, 'glowCyan', [-35, P + 3.995, -1], 7, 7, '-y')
  card(B, 'glowCyan', [-35, P + 0.02, 1.2], 9, 6, '+y')
}

function branchDecor(B: Deco) {
  // ---- transfer corridor ----
  for (let x = 23.4; x < 34; x += 2.3) B.of('concreteDark').box([x, 2.95, -3], [0.22, 0.1, 2.4], 1)
  for (const z of [-4.17, -1.83]) B.of('stone').box([28.2, 0.1, z], [11.4, 0.2, 0.06], 1)
  runX(B, 'cable', 22.4, 34, 2.62, -1.85, 0.035, 6)
  runX(B, 'cable', 22.4, 34, 2.72, -1.84, 0.025, 6)
  for (let x = 23; x < 34; x += 2.3) B.of('paint').box([x, 2.67, -1.84], [0.05, 0.22, 0.08], 1)
  B.of('paint').box([28.2, 2.9, -3], [11.1, 0.03, 0.14], 1)
  card(B, 'stripPink', [28.2, 2.994, -3], 12.4, 2.4, '-y')

  // ---- «Литейная» ----
  for (const x of [37, 43, 49, 55]) B.of('concreteDark').box([x, 4.8, -8.5], [0.5, 0.4, 15], 2)
  B.of('concreteDark').box([46, 4.74, -8], [24, 0.52, 1])
  for (const [x, neon, glow] of [[40, 'neonAmber', 'glowAmber'], [46, 'black', null], [52, 'neonCyan', 'glowCyan']] as const) {
    B.of('stone').box([x, 0.16, -8], [0.96, 0.32, 0.96], 1)
    B.of('stone').box([x, 4.3, -8], [1.16, 0.36, 1.16], 1)
    // neon collar under the capital (the middle one is dead)
    for (const s of [-1, 1]) {
      B.of(neon).box([x, 4.02, -8 + s * 0.46], [0.98, 0.05, 0.05], 1)
      B.of(neon).box([x + s * 0.46, 4.02, -8], [0.05, 0.05, 0.98], 1)
    }
    B.of('paint').box([x, 4.09, -8], [1.02, 0.04, 1.02], 1)
    if (!glow) continue
    card(B, glow, [x, 4.994, -8], 8, 8, '-y')
    for (const [f, dx, dz] of [['+z', 0, 0.403], ['-z', 0, -0.403], ['+x', 0.403, 0], ['-x', -0.403, 0]] as const) card(B, glow, [x + dx, 3.5, -8 + dz], 0.8, 2.4, f)
  }
  // skirting (the west wall one stops at the corridor mouth)
  B.of('stone').box([46, 0.12, -1.03], [24, 0.24, 0.06], 1)
  B.of('stone').box([57.97, 0.12, -8.5], [0.06, 0.24, 15], 1)
  B.of('stone').box([34.03, 0.12, -10.2], [0.06, 0.24, 11.6], 1)
  // enamel board behind the station name, picture light over the mosaic
  B.of('paint').box([46, 4.2, -1.008], [6.6, 1.5, 0.012], 1)
  for (const dy of [-0.77, 0.77]) B.of('trim').box([46, 4.2 + dy, -1.02], [6.7, 0.04, 0.04], 1)
  for (const dz of [-0.7, 0.7]) B.of('paint').box([57.7, 3.92, -8 + dz], [0.6, 0.03, 0.03], 1)
  B.of('paint').box([57.4, 3.94, -8], [0.12, 0.08, 1.9], 1)
  B.of('tunnelLamp').box([57.4, 3.89, -8], [0.07, 0.03, 1.7], 1)
  card(B, 'glowWarm', [57.992, 2.3, -8], 5, 4.6, '-x')
  // dead branch-B train along the south wall: roof edge, stripe, windows, doors, skirt
  B.of('paint').box([46, 3.03, -15], [20.1, 0.1, 1.7], 1)
  B.of('pipeTeal').box([46, 1.18, -14.19], [20, 0.22, 0.02], 1)
  B.of('black').box([46, 0.22, -14.18], [20, 0.44, 0.04], 1)
  for (let i = 0; i < 4; i++) {
    const x0 = 36.5 + i * 5
    for (const dx of [1.1, 3.1]) {
      B.of('black').box([x0 + dx, 2.0, -14.19], [1.5, 0.9, 0.02], 1)
      B.of('trim').box([x0 + dx, 2.48, -14.18], [1.6, 0.05, 0.03], 1)
      B.of('trim').box([x0 + dx, 1.52, -14.18], [1.6, 0.05, 0.03], 1)
    }
    // sliding doors
    B.of('paint').box([x0 + 4.5, 1.4, -14.185], [1.3, 2.3, 0.03], 1)
    B.of('black').box([x0 + 4.5, 1.4, -14.165], [0.03, 2.3, 0.02], 1)
    for (const s of [-0.33, 0.33]) B.of('black').box([x0 + 4.5 + s, 1.95, -14.166], [0.42, 0.8, 0.02], 1)
  }
  for (const x of [37.5, 54.5]) for (const s of [-0.8, 0.8]) B.of('black').cyl([x + s, 0.3, -14.3], 0.3, 0.12, 'z', 12)
  // benches: legs and back rests
  for (const x of [38, 54]) {
    B.of('wood').box([x, 0.82, -1.1], [2.2, 0.34, 0.05], 1, [0.14, 0, 0])
    for (const s of [-1.02, 1.02]) {
      B.of('trim').box([x + s, 0.21, -1.4], [0.05, 0.42, 0.5], 1)
      B.of('trim').box([x + s, 0.72, -1.08], [0.05, 0.6, 0.05], 1)
    }
  }
  // dead ceiling fittings; one has dropped an end
  for (const [x, z, drop] of [[37, -4.5, 0], [43, -11.5, 0.5], [49, -4.5, 0], [55, -11.5, 0]] as const) {
    B.of('paint').add(boxGeo(2.6, 0.07, 0.2, 1).clone(), [x + 1.6, 4.6 - drop * 0.6, z], [0, 0, drop * 0.48])
    B.of('black').add(new THREE.CylinderGeometry(0.035, 0.035, 2.5, 6).rotateZ(Math.PI / 2), [x + 1.6, 4.53 - drop * 0.6, z], [0, 0, drop * 0.48])
    B.of('paint').cyl([x + 2.7, 4.8, z], 0.012, 0.4, 'y', 5)
    if (!drop) B.of('paint').cyl([x + 0.5, 4.8, z], 0.012, 0.4, 'y', 5)
  }
  // cable tray above the train
  B.of('paint').box([46, 4.1, -15.85], [24, 0.03, 0.26], 1)
  runX(B, 'cable', 34, 58, 4.15, -15.88, 0.04, 6)
  runX(B, 'pipe', 34, 58, 4.45, -15.84, 0.09, 8)
}

function Decor() {
  const mats = getMats()
  const geos = useMemo(() => {
    const B: Deco = new BatchSet<MatKey>()
    hallDecor(B)
    // platform edge light line
    B.of('neonAcid').box([0, 0.02, 4.98], [44, 0.03, 0.04], 1)
    tunnelDecor(B)
    maintDecor(B)
    pumpDecor(B)
    branchDecor(B)
    // maintenance room strip
    B.of('neonCyan').cyl([-8, 3.14, -12], 0.035, 6, 'x', 8)
    // elevator light
    B.of('neonAcid').box([8, 2.88, -8.85], [2, 0.02, 0.6], 1)
    // cable bundles along the tunnel walls
    for (const [x, len] of [[-36, 28], [44, 44]]) {
      [0.6, 0.75, 0.9].forEach((y, k) => B.of('cable').cyl([x, PIT_Y + 2.4 + y * 0.3, 10.9], 0.04 + k * 0.01, len, 'x', 6))
    }
    // big pipe
    B.of('pipe').cyl([8, PIT_Y + 3.6, 10.6], 0.22, 116, 'x', 12)
    // broken hanging cable near the hall east mouth
    B.of('cable').add(new THREE.CylinderGeometry(0.025, 0.025, 2.2, 5), [24, PIT_Y + 3, 7.5], [0.2, 0, 0])
    return B.build()
  }, [])
  return (
    <group>
      {geos.map(([m, g]) => <mesh key={m} geometry={g} material={mats[m]} receiveShadow={!NO_SHADOW.test(m)} />)}
    </group>
  )
}
const NO_SHADOW = /^(neon|glow|strip|emergency|tunnelLamp|glass)/

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
