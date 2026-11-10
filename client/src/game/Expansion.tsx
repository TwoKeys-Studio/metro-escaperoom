import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import {
  ARM_TERMINAL_POS, CAESAR_POS, CAESAR_SHIFT, HOSE_SOCKETS, KIOSK_POS, MORSE, MORSE_LAMP_POS, MORSE_TABLE_POS,
  MOSAIC_CENTER, MOSAIC_SOCKETS, PIT_Y, POEM_POS, POEMS, TLEVER_POS, VALVE_PLAQUE_POS, VALVE_POS, VALVE_RIDDLE,
  VALVE_SYMBOLS,
} from '../../../shared/level'
import { useNet } from '../net'
import { getMats } from './materials'
import { HoloAd, Poster, Sign, useInteract } from './Puzzles'
import { plaqueTexture } from './textures'

// Everything added in the expansion: transfer levers, pump valves & hoses, mosaic, arming terminal,
// info kiosk and the three hard eggs (Caesar, acrostic poem, Morse lamp).
export function Expansion() {
  const game = useNet((s) => s.game)
  if (!game) return null
  const order = game.pumpOrder
  const riddle = [
    `Сперва поверни ${VALVE_RIDDLE[order[0]]},`,
    `затем — ${VALVE_RIDDLE[order[1]]},`,
    `потом — ${VALVE_RIDDLE[order[2]]},`,
    `и последним — ${VALVE_RIDDLE[order[3]]}.`,
    'Ошибёшься — начнёшь сначала.',
  ]
  const poem = POEMS[game.poem]
  const morseRows = Object.entries(MORSE).map(([d, m]) => `${d}  ${m.replace(/\./g, '•').replace(/-/g, '—')}`)
  return (
    <group>
      {/* transfer door */}
      <Sign text="ПЕРЕХОД НА ВЕТКУ Б" p={[21.97, 3.2, -3]} r={-Math.PI / 2} w={2.6} h={0.4} o={{ color: '#ff9a1f', glow: 12 }} needsPower />
      <Poster tex={plaqueTexture('ЗАЖГИ ВСЕ ОГНИ', ['Каждый рычаг меняет', 'свой огонь и соседние.', 'Все пять горят — проход открыт.'], '#ff9a1f', 1024, 512)}
        p={[21.97, 2.35, 1]} r={-Math.PI / 2} w={1.6} h={0.8} emissive={0.25} />
      {TLEVER_POS.map((p, i) => <TransferLever key={i} index={i} p={p} />)}

      {/* pump room door: valves + riddle */}
      <Poster tex={plaqueTexture('ВЕНТИЛИ НАСОСНОЙ', riddle, '#22f0ff')} p={VALVE_PLAQUE_POS} w={2} h={1.5} emissive={0.25} />
      <Sign text="НАСОСНАЯ" p={[-35, PIT_Y + 2.95, 5.02]} w={2} h={0.35} o={{ color: '#22f0ff', glow: 10 }} />
      {VALVE_POS.map((p, i) => <Valve key={i} index={i} p={p} />)}
      <ValveProgress />

      {/* pump room insides */}
      <Sign text={game.pumpOn ? 'НАСОС РАБОТАЕТ' : 'НАСОС · ШЛАНГИ СЮДА'} p={[-35, PIT_Y + 2.4, -1.75]} w={3} h={0.45} o={{ color: game.pumpOn ? '#3dff8a' : '#e6ff3a', glow: 12 }} />
      {HOSE_SOCKETS.map((s) => <HosePort key={s.id} id={s.id} p={s.pos} />)}
      <Poster tex={plaqueTexture('АЗБУКА МОРЗЕ', morseRows, '#e6f1f4', 768, 1024)} p={MORSE_TABLE_POS} r={Math.PI / 2} w={1.1} h={1.45} emissive={0.22} />
      <PumpSpin />

      {/* branch B */}
      <Sign text="ЛИТЕЙНАЯ" p={[46, 4.2, -1.02]} r={Math.PI} w={6} h={1.1} o={{ color: '#ff9a1f', sub: 'ВЕТКА Б · ЗАКРЫТА В 1977', subColor: '#ff2e88' }} needsPower />
      <Sign text={game.caesar} p={CAESAR_POS} r={Math.PI} w={5} h={0.9} o={{ color: '#ff2e88', font: '600', glow: 6, sub: `ЛИНИЯ ${CAESAR_SHIFT} ЗНАЕТ СДВИГ`, subColor: '#e6f1f4' }} glow={0.9} />
      <HoloAd text="ВЕТКА Б" sub="ПЕРЕХОД ЗАКРЫТ НАВСЕГДА" p={[34.02, 3.4, -9]} r={Math.PI / 2} w={4} h={1.4} color="#ff9a1f" />
      <Mosaic code={game.armCode} done={game.mosaicDone} />
      <Sign text="КОД ВЗВОДА ПОМНИТ ЭТА СТЕНА" p={[57.97, 3.55, -8]} r={-Math.PI / 2} w={3.4} h={0.32} o={{ color: '#ff9a1f', glow: 8 }} needsPower />

      {/* corridor neon */}
      <mesh position={[28.2, 2.98, -3]} material={getMats().neonPink}>
        <boxGeometry args={[11, 0.04, 0.08]} />
      </mesh>

      <ArmTerminal />
      <Kiosk />
      <MorseLamp code={game.morse} />
      <Poster tex={plaqueTexture('СТИХИ МАШИНИСТА · 1977', [...poem.lines, '', 'Читай не строки — читай начала.'], '#ff2e88', 1024, 768)}
        p={POEM_POS} r={Math.PI} w={1.6} h={1.2} emissive={0.22} />
    </group>
  )
}

function TransferLever({ index, p }: { index: number; p: [number, number, number] }) {
  const hit = useRef<THREE.Mesh>(null)
  const lamp = useRef<THREE.MeshBasicMaterial>(null)
  const arm = useRef<THREE.Group>(null)
  const mats = getMats()
  useInteract(hit, () => {
    const g = useNet.getState().game
    if (!g?.power) return { kind: 'read', label: 'Нет питания' }
    if (g.transferOpen) return { kind: 'read', label: 'Переход открыт' }
    return { kind: 'tlever', index, label: `Рычаг перехода ${index + 1}` }
  })
  useFrame((_, dt) => {
    const g = useNet.getState().game
    const on = !!g?.transferLamps[index] && !!g?.power
    lamp.current?.color.set(on ? '#3dff8a' : g?.power ? '#ff1a1a' : '#200').multiplyScalar(on ? 4 : 2)
    if (arm.current) arm.current.rotation.z += ((on ? 0.7 : -0.7) - arm.current.rotation.z) * Math.min(1, dt * 10)
  })
  return (
    <group position={p} rotation-y={-Math.PI / 2}>
      <mesh material={mats.metal} position-z={-0.05}>
        <boxGeometry args={[0.5, 0.7, 0.1]} />
      </mesh>
      <mesh position={[0, 0.62, 0]}>
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshBasicMaterial ref={lamp} toneMapped={false} />
      </mesh>
      <group ref={arm} position-z={0.05}>
        <mesh material={mats.rail} position-y={0.17}>
          <cylinderGeometry args={[0.025, 0.025, 0.34, 8]} />
        </mesh>
        <mesh position-y={0.36}>
          <sphereGeometry args={[0.055, 10, 10]} />
          <meshStandardMaterial color="#ff9a1f" emissive="#ff9a1f" emissiveIntensity={0.5} />
        </mesh>
      </group>
      <mesh ref={hit} visible={false} position-z={0.2}>
        <boxGeometry args={[0.5, 0.9, 0.4]} />
      </mesh>
    </group>
  )
}

function Valve({ index, p }: { index: number; p: [number, number, number] }) {
  const hit = useRef<THREE.Mesh>(null)
  const wheel = useRef<THREE.Group>(null)
  const mats = getMats()
  const turn = useRef(0)
  const last = useRef(0)
  useInteract(hit, () => {
    const g = useNet.getState().game
    if (!g?.power) return { kind: 'read', label: 'Нет питания' }
    if (g.pumpDoorOpen) return { kind: 'read', label: 'Насосная открыта' }
    return { kind: 'valve', index, label: `Повернуть вентиль ${VALVE_SYMBOLS[index]}` }
  })
  useFrame((_, dt) => {
    const g = useNet.getState().game
    // spin a little whenever progress changes, so the press feels physical
    const prog = g?.pumpProgress ?? 0
    if (prog !== last.current) {
      turn.current += Math.PI
      last.current = prog
    }
    if (wheel.current) wheel.current.rotation.z += (turn.current - wheel.current.rotation.z) * Math.min(1, dt * 6)
  })
  return (
    <group position={p}>
      <mesh material={mats.black} position-z={-0.05} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.05, 0.05, 0.12, 8]} />
      </mesh>
      <group ref={wheel} position-z={0.04}>
        <mesh>
          <torusGeometry args={[0.2, 0.025, 8, 24]} />
          <meshStandardMaterial color="#c4102e" metalness={0.6} roughness={0.4} />
        </mesh>
        {[0, Math.PI / 2].map((r) => (
          <mesh key={r} rotation-z={r} material={mats.rail}>
            <boxGeometry args={[0.4, 0.03, 0.02]} />
          </mesh>
        ))}
      </group>
      <Sign text={VALVE_SYMBOLS[index]} p={[0, 0.42, 0]} w={0.3} h={0.3} o={{ color: '#e6f1f4', glow: 10, font: '400' }} />
      <mesh ref={hit} visible={false} position-z={0.15}>
        <boxGeometry args={[0.5, 0.6, 0.3]} />
      </mesh>
    </group>
  )
}

function ValveProgress() {
  const mats = useRef<(THREE.MeshBasicMaterial | null)[]>([])
  useFrame(() => {
    const g = useNet.getState().game
    mats.current.forEach((m, i) => {
      const on = g?.pumpDoorOpen || (g?.pumpProgress ?? 0) > i
      m?.color.set(on ? '#22f0ff' : '#111').multiplyScalar(on ? 3 : 1)
    })
  })
  return (
    <group position={[-38.4, PIT_Y + 2.1, 5.03]}>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position-x={-1.2 + i * 0.8}>
          <planeGeometry args={[0.5, 0.06]} />
          <meshBasicMaterial ref={(el) => { mats.current[i] = el }} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

function HosePort({ id, p }: { id: string; p: [number, number, number] }) {
  const filled = useNet((s) => Object.values(s.items).some((i) => i.socket === id))
  return (
    <group position={[p[0], p[1] - 0.3, p[2] - 0.1]}>
      <mesh rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.16, 0.16, 0.2, 16]} />
        <meshStandardMaterial color="#2a2f36" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position-z={0.11} rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.16, 0.02, 6, 20]} />
        <meshBasicMaterial color={new THREE.Color(filled ? '#3dff8a' : '#e6ff3a').multiplyScalar(3)} toneMapped={false} />
      </mesh>
    </group>
  )
}

function PumpSpin() {
  const g = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    const on = !!useNet.getState().game?.pumpOn
    if (g.current) g.current.rotation.x += dt * (on ? 8 : 0)
  })
  return (
    <group ref={g} position={[-35, PIT_Y + 1.5, -2.35]}>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} rotation-x={(i * Math.PI) / 2} material={getMats().metal}>
          <boxGeometry args={[6, 0.08, 0.6]} />
        </mesh>
      ))}
    </group>
  )
}

function Mosaic({ code, done }: { code: string; done: boolean }) {
  void code
  const frame = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false }), [])
  const mats = getMats()
  useFrame(({ clock }) => {
    frame.color.set(done ? '#ff9a1f' : '#22f0ff').multiplyScalar(done ? 3 + Math.sin(clock.elapsedTime * 3) : 1.5)
  })
  return (
    <group position={[MOSAIC_CENTER[0] + 0.05, MOSAIC_CENTER[1], MOSAIC_CENTER[2]]} rotation-y={-Math.PI / 2}>
      <mesh material={mats.black} position-z={-0.04}>
        <boxGeometry args={[2.1, 2.1, 0.05]} />
      </mesh>
      {MOSAIC_SOCKETS.map((s, i) => (
        <mesh key={s.id} position={[((i % 3) - 1) * 0.6, (1 - Math.floor(i / 3)) * 0.6, -0.005]}>
          <planeGeometry args={[0.56, 0.56]} />
          <meshBasicMaterial color="#0a1a1e" transparent opacity={0.6} />
        </mesh>
      ))}
      {[[0, 1.02, 2.1, 0.04], [0, -1.02, 2.1, 0.04], [1.02, 0, 0.04, 2.1], [-1.02, 0, 0.04, 2.1]].map(([x, y, w, h], i) => (
        <mesh key={i} position={[x, y, 0]} material={frame}>
          <planeGeometry args={[w, h]} />

        </mesh>
      ))}
    </group>
  )
}

function ArmTerminal() {
  const ref = useRef<THREE.Mesh>(null)
  const screen = useRef<THREE.MeshBasicMaterial>(null)
  const mats = getMats()
  useInteract(ref, () => {
    const g = useNet.getState().game
    if (!g) return null
    if (g.armCodeOk) return { kind: 'read', label: 'Детонатор взведён кодом' }
    if (g.phase !== 'charge') return { kind: 'read', label: 'Пульт подрыва: недоступен' }
    return { kind: 'keypad', target: 'arm', label: 'Ввести код взвода' }
  })
  useFrame(({ clock }) => {
    const g = useNet.getState().game
    const c = g?.armCodeOk ? '#3dff8a' : g?.phase === 'charge' ? (Math.sin(clock.elapsedTime * 4) > 0 ? '#ff2e88' : '#3a0016') : '#111'
    screen.current?.color.set(c).multiplyScalar(2.5)
  })
  return (
    <group position={ARM_TERMINAL_POS} rotation-y={Math.PI}>
      <mesh ref={ref} material={mats.metal}>
        <boxGeometry args={[0.6, 0.8, 0.12]} />
      </mesh>
      <mesh position={[0, 0.18, 0.065]}>
        <planeGeometry args={[0.46, 0.2]} />
        <meshBasicMaterial ref={screen} toneMapped={false} />
      </mesh>
      <Sign text="ПУЛЬТ ПОДРЫВА" p={[0, 0.6, 0.07]} w={1.2} h={0.22} o={{ color: '#ff2e88', glow: 10 }} />
    </group>
  )
}

function Kiosk() {
  const ref = useRef<THREE.Mesh>(null)
  const mats = getMats()
  useInteract(ref, () => ({ kind: 'kiosk', label: 'Инфокиоск: ввести разгадку' }))
  return (
    <group position={KIOSK_POS}>
      <mesh material={mats.black} position-y={0}>
        <boxGeometry args={[0.9, 2, 0.5]} />
      </mesh>
      <mesh ref={ref} position={[0, 0.35, 0.26]}>
        <planeGeometry args={[0.7, 0.9]} />
        <meshStandardMaterial color="#04161a" emissive="#22f0ff" emissiveIntensity={0.35} roughness={0.2} />
      </mesh>
      <Sign text="ИНФО" p={[0, 0.95, 0.27]} w={0.7} h={0.22} o={{ color: '#22f0ff', glow: 12 }} />
    </group>
  )
}

// Blinks the morse digits forever: dot = 0.25 s, dash = 0.75 s, pause between digits 1.5 s, long pause 4 s.
function MorseLamp({ code }: { code: string }) {
  const mat = useRef<THREE.MeshBasicMaterial>(null)
  const light = useRef<THREE.PointLight>(null)
  const schedule = useMemo(() => {
    const seq: [boolean, number][] = []
    for (const d of code) {
      for (const s of MORSE[d]) {
        seq.push([true, s === '.' ? 0.25 : 0.75])
        seq.push([false, 0.25])
      }
      seq.push([false, 1.25])
    }
    seq.push([false, 3])
    const total = seq.reduce((n, [, t]) => n + t, 0)
    return { seq, total }
  }, [code])
  useFrame(({ clock }) => {
    let t = clock.elapsedTime % schedule.total
    let on = false
    for (const [state, dur] of schedule.seq) {
      if (t < dur) {
        on = state
        break
      }
      t -= dur
    }
    mat.current?.color.set(on ? '#fff3c4' : '#1a1408').multiplyScalar(on ? 5 : 1)
    if (light.current) light.current.intensity = on ? 4 : 0
  })
  return (
    <group position={MORSE_LAMP_POS}>
      <mesh>
        <sphereGeometry args={[0.09, 12, 12]} />
        <meshBasicMaterial ref={mat} toneMapped={false} />
      </mesh>
      <pointLight ref={light} distance={6} color="#fff3c4" intensity={0} position-z={0.2} />
    </group>
  )
}
