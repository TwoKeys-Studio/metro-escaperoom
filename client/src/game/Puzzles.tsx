import { useShallow } from 'zustand/react/shallow'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import {
  CHARGE_SOCKET, CODE_COLORS, CODE_SIGN_POS, DETONATOR_A, DETONATOR_B, KEYPAD_POS, LEVER_COUNT, LEVERS_POS,
  PIT_Y, POWER_PANEL_POS, SCHEMATIC_POS, VENDING_POS, powerSockets, type Vec3,
} from '../../../shared/level'
import { live, send, useNet } from '../net'
import { getMats } from './materials'
import { routeMapTexture, schematicTexture, signTexture, type SignOpts } from './textures'
import { interactables, type Interact } from './ui'
import { Expansion } from './Expansion'

export function useInteract(ref: React.RefObject<THREE.Object3D | null>, fn: () => Interact | null) {
  const fnRef = useRef(fn)
  fnRef.current = fn
  useEffect(() => {
    const o = ref.current
    if (!o) return
    interactables.set(o, () => fnRef.current())
    return () => {
      interactables.delete(o)
    }
  }, [ref])
}

// ---------- signs ----------
export function Sign({ text, p, r = 0, w, h, o = {}, needsPower = false, glow = 1.6 }: {
  text: string; p: Vec3; r?: number; w: number; h: number; o?: SignOpts; needsPower?: boolean; glow?: number
}) {
  const tex = useMemo(() => signTexture(text, { w: 1024, h: Math.round((1024 * h) / w), ...o }), [text, w, h, o])
  const mat = useRef<THREE.MeshBasicMaterial>(null)
  useFrame(({ clock }) => {
    const m = mat.current
    if (!m) return
    const power = !!useNet.getState().game?.power
    const black = performance.now() < live.blackoutUntil
    let k = glow
    if ((needsPower && !power) || black) k = Math.random() < 0.004 ? glow * 0.6 : 0.03
    else if (Math.random() < 0.006) k = glow * 0.3
    m.color.setScalar(k * (0.92 + 0.08 * Math.sin(clock.elapsedTime * 40)))
  })
  return (
    <mesh position={p} rotation-y={r}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial ref={mat} map={tex} transparent toneMapped={false} depthWrite={false} />
    </mesh>
  )
}

// Holographic ad with scanlines and glitch jitter.
const holoVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const holoFrag = /* glsl */ `
  uniform sampler2D map; uniform float time; uniform float on; uniform vec3 tint;
  varying vec2 vUv;
  float h(float n){ return fract(sin(n)*43758.5453); }
  void main(){
    vec2 uv = vUv;
    float band = step(0.985, h(floor(time*7.0) + floor(uv.y*24.0)));
    uv.x += band * (h(time) - 0.5) * 0.08;
    vec4 c = texture2D(map, uv);
    float scan = 0.75 + 0.25 * sin(uv.y * 420.0 + time * 6.0);
    float flick = 0.85 + 0.15 * h(floor(time * 24.0));
    vec3 col = c.rgb * tint * scan * flick * 2.2;
    float a = c.a * on * (0.55 + 0.45 * scan);
    a += on * 0.04 * smoothstep(0.0, 0.1, uv.y) * (1.0 - uv.y);
    gl_FragColor = vec4(col + tint * 0.05 * on, a);
  }
`
export function HoloAd({ text, sub, p, r = 0, w, h, color }: { text: string; sub?: string; p: Vec3; r?: number; w: number; h: number; color: string }) {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      map: { value: signTexture(text, { w: 1024, h: Math.round((1024 * h) / w), color: '#ffffff', sub, subColor: '#ffffff', glow: 18 }) },
      time: { value: 0 }, on: { value: 1 }, tint: { value: new THREE.Color(color) },
    },
    vertexShader: holoVert, fragmentShader: holoFrag, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
  }), [text, sub, w, h, color])
  useFrame(({ clock }) => {
    mat.uniforms.time.value = clock.elapsedTime
    const power = !!useNet.getState().game?.power
    const target = performance.now() < live.blackoutUntil ? 0 : power ? 1 : 0.18
    mat.uniforms.on.value += (target - mat.uniforms.on.value) * 0.1
  })
  return (
    <mesh position={p} rotation-y={r} material={mat}>
      <planeGeometry args={[w, h]} />
    </mesh>
  )
}

export function Poster({ tex, p, r = 0, w, h, emissive = 0.25 }: { tex: THREE.Texture; p: Vec3; r?: number; w: number; h: number; emissive?: number }) {
  return (
    <mesh position={p} rotation-y={r}>
      <planeGeometry args={[w, h]} />
      <meshStandardMaterial map={tex} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={emissive} roughness={0.7} />
    </mesh>
  )
}

// ---------- the whole puzzle set ----------
export function Puzzles() {
  const game = useNet((s) => s.game)
  if (!game) return null
  const codeWords = ['ПЛАТФОРМА', 'УРОВЕНЬ', 'ВАГОН', 'СЕКТОР']
  const codeRot = [0, Math.PI, Math.PI, -Math.PI / 2]
  return (
    <group>
      {/* station identity */}
      <Sign text="НЕОН-17" p={[0, 3.9, 10.97]} r={Math.PI} w={9} h={1.7} o={{ color: '#22f0ff', sub: 'СТАНЦИЯ · ЛИНИЯ 17 · ГЛУБИНА 84 М', subColor: '#ff2e88' }} />
      <Sign text="← ЗАПАД · ДЕПО" p={[-21.97, 4.6, 8]} r={Math.PI / 2} w={4.5} h={0.7} o={{ color: '#ff9a1f', glow: 14 }} />
      <Sign text="ВОСТОК · ВЫХОД НЕТ →" p={[21.97, 4.6, 8]} r={-Math.PI / 2} w={4.5} h={0.7} o={{ color: '#ff2e88', glow: 14 }} />
      <Sign text="ОНИ В ТОННЕЛЕ" p={[-30, PIT_Y + 1.6, 10.98]} r={Math.PI} w={4} h={0.9} o={{ color: '#ff2e88', font: '600', glow: 6 }} glow={0.7} />
      <Sign text="СЛУЖЕБНЫЙ ВХОД" p={[-8, 3.15, -6.98]} w={2.4} h={0.35} o={{ color: '#e6ff3a', glow: 10 }} needsPower />
      <Sign text="ЛИФТ НАВЕРХ" p={[8, 3.15, -6.98]} w={3} h={0.4} o={{ color: game.elevatorOpen ? '#3dff8a' : '#ff2e88', glow: 12 }} />
      <Sign text="КАССА" p={[-20.5, 1.5, -5.59]} w={1.4} h={0.35} o={{ color: '#ff9a1f' }} needsPower />
      <HoloAd text="НЕОН-КОЛА" sub="ВКУС ПОСЛЕДНЕГО ПОЕЗДА" p={[12, 3.6, -6.9]} w={5} h={2} color="#ff2e88" />
      <HoloAd text="ОКО-9" sub="ИМПЛАНТЫ ЗРЕНИЯ · −40%" p={[-13, 3.8, -6.9]} w={4.5} h={1.8} color="#22f0ff" />
      <HoloAd text="НЕ ЗАХОДИ ЗА ЖЁЛТУЮ ЛИНИЮ" p={[-21.9, 3, -1]} r={Math.PI / 2} w={6} h={0.9} color="#e6ff3a" />
      <HoloAd text="ТЫ НЕ ОДИН" p={[40, PIT_Y + 2, 4.98]} w={3} h={0.9} color="#ff2e88" />

      {/* access code: four coloured digits around the hall + route poster */}
      {CODE_SIGN_POS.map((pos, ci) => (
        <Sign
          key={ci}
          text={`${codeWords[ci]} ${game.codeDigits[ci]}`}
          p={pos}
          r={codeRot[ci]}
          w={3.4}
          h={0.9}
          o={{ color: CODE_COLORS[ci].hex, glow: 20 }}
          needsPower
          glow={2}
        />
      ))}
      <Poster tex={routeMapTexture(game.codeOrder, CODE_COLORS)} p={[-4.3, 1.9, -6.98]} w={0.9} h={1.2} />
      <Poster tex={schematicTexture(game.leverTarget)} p={SCHEMATIC_POS} r={Math.PI / 2} w={2.2} h={1.375} emissive={0.9} />

      <PowerPanel />
      <Keypad />
      <Levers />
      <Detonator which="a" p={DETONATOR_A} />
      <Detonator which="b" p={DETONATOR_B} />
      <ChargeSpot />
      <Vending />
      <TrainEgg />
      <Expansion />
    </group>
  )
}

function PowerPanel() {
  const sockets = useNet((s) => s.game?.sockets.length ?? 3)
  const filled = useNet(useShallow((s) => Object.values(s.items).filter((i) => i.socket?.startsWith('slot')).map((i) => i.socket)))
  const phase = useNet((s) => s.game?.phase)
  const list = powerSockets(sockets)
  const mats = getMats()
  return (
    <group>
      <Sign text="ЩИТ ПИТАНИЯ" p={[POWER_PANEL_POS[0], POWER_PANEL_POS[1] + 0.62, -6.86]} w={1.6} h={0.25} o={{ color: '#ff9a1f', glow: 10 }} />
      {list.map((s) => {
        const on = filled.includes(s.id)
        return (
          <group key={s.id} position={[s.pos[0], s.pos[1], -6.86]}>
            <mesh material={mats.black} rotation-x={Math.PI / 2}>
              <cylinderGeometry args={[0.13, 0.13, 0.06, 16]} />
            </mesh>
            <mesh position-z={0.035} rotation-x={Math.PI / 2}>
              <torusGeometry args={[0.13, 0.012, 6, 24]} />
              <meshBasicMaterial color={new THREE.Color(on ? '#3dff8a' : phase === 'power' ? '#ff2e88' : '#333').multiplyScalar(on ? 3 : 2)} toneMapped={false} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

function Keypad() {
  const ref = useRef<THREE.Mesh>(null)
  const screen = useRef<THREE.MeshBasicMaterial>(null)
  useInteract(ref, () => {
    const g = useNet.getState().game
    if (!g) return null
    if (g.doorOpen) return { kind: 'read', label: 'Шлюз открыт' }
    if (!g.power) return { kind: 'read', label: 'Нет питания. Сначала щит' }
    return { kind: 'keypad', target: 'door', label: 'Ввести код доступа' }
  })
  useFrame(() => {
    const g = useNet.getState().game
    screen.current?.color.set(g?.doorOpen ? '#3dff8a' : g?.power ? '#22f0ff' : '#220006').multiplyScalar(g?.power ? 2.5 : 1)
  })
  const mats = getMats()
  return (
    <group position={KEYPAD_POS}>
      <mesh ref={ref} material={mats.metal}>
        <boxGeometry args={[0.36, 0.5, 0.1]} />
      </mesh>
      <mesh position={[0, 0.13, 0.052]}>
        <planeGeometry args={[0.26, 0.1]} />
        <meshBasicMaterial ref={screen} toneMapped={false} />
      </mesh>
      {Array.from({ length: 12 }, (_, i) => (
        <mesh key={i} position={[-0.08 + (i % 3) * 0.08, 0.02 - Math.floor(i / 3) * 0.055, 0.053]} material={mats.black}>
          <boxGeometry args={[0.06, 0.04, 0.01]} />
        </mesh>
      ))}
    </group>
  )
}

function Levers() {
  const levers = useNet(useShallow((s) => s.game?.levers ?? []))
  const ok = useNet((s) => !!s.game?.leversOk)
  const mats = getMats()
  return (
    <group position={LEVERS_POS}>
      <mesh material={mats.metal} position-z={0.05}>
        <boxGeometry args={[2.6, 1.3, 0.2]} />
      </mesh>
      <Sign text="Т-17 РАСПРЕДКОРОБКА" p={[0, 0.8, -0.06]} r={Math.PI} w={2.4} h={0.25} o={{ color: '#e6ff3a', glow: 10 }} />
      <mesh position={[1.15, 0.45, -0.07]}>
        <sphereGeometry args={[0.05, 10, 10]} />
        <meshBasicMaterial color={new THREE.Color(ok ? '#3dff8a' : '#ff1a1a').multiplyScalar(4)} toneMapped={false} />
      </mesh>
      {Array.from({ length: LEVER_COUNT }, (_, i) => (
        <Lever key={i} index={i} up={!!levers[i]} x={0.75 - i * 0.5} />
      ))}
      <mesh material={mats.black} position={[0, -0.6, -0.04]}>
        <boxGeometry args={[2.5, 0.06, 0.04]} />
      </mesh>
    </group>
  )
}

function Lever({ index, up, x }: { index: number; up: boolean; x: number }) {
  const arm = useRef<THREE.Group>(null)
  const hit = useRef<THREE.Mesh>(null)
  const mats = getMats()
  useInteract(hit, () => {
    const g = useNet.getState().game
    if (!g?.doorOpen || g.phase !== 'charge') return { kind: 'read', label: 'Коробка обесточена' }
    // levers are numbered left→right as seen from the track (facing +z), x decreases
    return { kind: 'lever', index, label: `Переключить рычаг ${index + 1}` }
  })
  useFrame((_, dt) => {
    if (!arm.current) return
    const target = up ? -0.7 : 0.7
    arm.current.rotation.x += (target - arm.current.rotation.x) * Math.min(1, dt * 10)
  })
  return (
    <group position={[x, 0, -0.1]}>
      <mesh material={mats.black} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.07, 0.07, 0.08, 12]} />
      </mesh>
      <group ref={arm}>
        <mesh material={mats.rail} position={[0, 0, -0.2]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.025, 0.025, 0.4, 8]} />
        </mesh>
        <mesh position={[0, 0, -0.42]}>
          <sphereGeometry args={[0.06, 10, 10]} />
          <meshStandardMaterial color="#ff2e88" emissive="#ff2e88" emissiveIntensity={0.5} />
        </mesh>
      </group>
      <mesh ref={hit} position={[0, 0, -0.25]} visible={false}>
        <boxGeometry args={[0.3, 0.9, 0.5]} />
      </mesh>
    </group>
  )
}

function Detonator({ which, p }: { which: 'a' | 'b'; p: Vec3 }) {
  const btn = useRef<THREE.Mesh>(null)
  const ring = useRef<THREE.MeshBasicMaterial>(null)
  useInteract(btn, () => {
    const g = useNet.getState().game
    if (g?.phase !== 'arm') return { kind: 'read', label: 'Детонатор не взведён' }
    return { kind: 'console', which, label: `Держать [E] — пульт ${which.toUpperCase()}` }
  })
  useFrame(({ clock }) => {
    const g = useNet.getState().game
    if (!ring.current || !g) return
    const held = g.detonator[which]
    const armed = g.phase === 'arm'
    const c = held ? '#3dff8a' : armed ? (Math.sin(clock.elapsedTime * 6) > 0 ? '#ff1a1a' : '#330000') : '#222'
    ring.current.color.set(c).multiplyScalar(held || armed ? 3 : 1)
  })
  return (
    <group position={[p[0], 1.02, p[2]]}>
      <mesh ref={btn} position-y={0.04}>
        <cylinderGeometry args={[0.14, 0.16, 0.08, 20]} />
        <meshStandardMaterial color="#c4102e" emissive="#ff1a1a" emissiveIntensity={0.4} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.005}>
        <ringGeometry args={[0.2, 0.26, 32]} />
        <meshBasicMaterial ref={ring} toneMapped={false} />
      </mesh>
      <Sign text={`ПУЛЬТ ${which.toUpperCase()}`} p={[0, 0.5, 0]} w={1} h={0.25} o={{ color: '#ff2e88', glow: 10 }} />
    </group>
  )
}

function ChargeSpot() {
  const phase = useNet((s) => s.game?.phase)
  const mat = useRef<THREE.MeshBasicMaterial>(null)
  useFrame(({ clock }) => {
    if (mat.current) mat.current.opacity = phase === 'charge' ? 0.5 + 0.4 * Math.sin(clock.elapsedTime * 4) : 0.15
  })
  return (
    <group position={[CHARGE_SOCKET.pos[0], PIT_Y + 0.02, CHARGE_SOCKET.pos[2]]}>
      <mesh rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.45, 0.6, 32]} />
        <meshBasicMaterial ref={mat} color={new THREE.Color('#e6ff3a').multiplyScalar(3)} transparent toneMapped={false} />
      </mesh>
      {phase === 'charge' && <Sign text="ЗАРЯД СЮДА" p={[0, 1.4, 0]} r={-Math.PI / 2} w={1.8} h={0.4} o={{ color: '#e6ff3a', glow: 12 }} />}
    </group>
  )
}

function Vending() {
  const ref = useRef<THREE.Mesh>(null)
  useInteract(ref, () => ({ kind: 'vending', label: 'Купить «Неон-колу»' }))
  return (
    <group position={[VENDING_POS[0], VENDING_POS[1], VENDING_POS[2] + 0.41]}>
      <mesh ref={ref} position-y={0.2}>
        <planeGeometry args={[1, 1.5]} />
        <meshStandardMaterial color="#120a10" emissive="#ff2e88" emissiveIntensity={0.25} roughness={0.2} />
      </mesh>
      <Sign text="НЕОН-КОЛА" p={[0, 0.85, 0.01]} w={1} h={0.25} o={{ color: '#ff2e88', glow: 14 }} />
    </group>
  )
}

function TrainEgg() {
  const sent = useRef(false)
  useFrame(() => {
    if (sent.current) return
    const [x, , z] = live.me.p
    if (x > -49.3 && x < -42.2 && z > 6.2 && z < 9.8) {
      sent.current = true
      send({ t: 'egg', id: 'train' })
    }
  })
  return null
}
