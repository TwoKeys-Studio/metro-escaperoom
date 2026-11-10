import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import {
  ARM_TERMINAL_POS, CHARGE_SOCKET, CODE_COLORS, CODE_SIGN_POS, DETONATOR_A, DETONATOR_B, HOSE_SOCKETS, KEYPAD_POS,
  LEVERS_POS, MOSAIC_CENTER, POWER_PANEL_POS, SCHEMATIC_POS, TLEVER_POS, VALVE_POS, type Vec3,
} from '../../../shared/level'
import { live, useNet } from '../net'
import { useUi } from './ui'

interface Target { key: string; label: string; p: Vec3; item?: string; color?: string }

// The DOM overlay needs the 3D camera; this lives inside the Canvas and hands it over.
const cam: { current: THREE.Camera | null } = { current: null }
export function CameraBridge() {
  const { camera } = useThree()
  useEffect(() => {
    cam.current = camera
    return () => {
      cam.current = null
    }
  }, [camera])
  return null
}

// Objective markers for practice runs and the easy difficulty. Off-screen targets stick to the
// screen edge with an arrow, so you always know which way to turn.
export function Markers() {
  const game = useNet((s) => s.game)
  const items = useNet((s) => s.items)
  const holding = useUi((s) => s.holding)
  if (!game || !(game.solo || game.difficulty === 'easy')) return null
  const heldKind = holding ? items[holding]?.kind : null
  const t: Target[] = []

  switch (game.phase) {
    case 'power':
      if (heldKind === 'cell') t.push({ key: 'panel', label: 'Щит питания', p: POWER_PANEL_POS })
      else
        for (const it of Object.values(items))
          if (it.kind === 'cell' && !it.socket && !it.fake) t.push({ key: it.id, label: 'Ячейка', p: it.p, item: it.id })
      break
    case 'access':
      CODE_SIGN_POS.forEach((p, i) => t.push({ key: `sign${i}`, label: `Цифра · ${CODE_COLORS[i].label}`, p, color: CODE_COLORS[i].hex }))
      t.push({ key: 'poster', label: 'Порядок цветов', p: [-4.3, 1.9, -6.9] })
      t.push({ key: 'keypad', label: 'Кодовый замок', p: KEYPAD_POS })
      break
    case 'charge':
      if (!game.chargePlaced) {
        if (heldKind === 'charge') t.push({ key: 'spot', label: 'Место для заряда', p: CHARGE_SOCKET.pos })
        else t.push({ key: 'charge', label: 'Заряд', p: items.charge?.p ?? [0, 0, 0], item: 'charge' })
      }
      if (!game.leversOk) {
        t.push({ key: 'levers', label: 'Рычаги', p: LEVERS_POS })
        t.push({ key: 'schem', label: 'Схема рычагов', p: SCHEMATIC_POS })
      }
      if (!game.armCodeOk) {
        if (!game.transferOpen) t.push({ key: 'tl', label: 'Переход: зажги все огни', p: TLEVER_POS[2] })
        else if (game.mosaicDone) t.push({ key: 'arm', label: 'Пульт подрыва: код взвода', p: ARM_TERMINAL_POS })
        else if (heldKind === 'tile') t.push({ key: 'mos', label: 'Мозаика', p: MOSAIC_CENTER })
        else
          for (const it of Object.values(items))
            if (it.kind === 'tile' && !it.socket) t.push({ key: it.id, label: 'Плитка', p: it.p, item: it.id })
      }
      break
    case 'arm':
      t.push({ key: 'a', label: 'Пульт A', p: DETONATOR_A })
      t.push({ key: 'b', label: 'Пульт B', p: DETONATOR_B })
      break
    case 'evac':
      t.push({ key: 'safe', label: 'Укрытие — зал', p: [0, 1.2, -2] })
      break
    case 'escape':
      t.push({ key: 'lift', label: 'Лифт', p: [8, 1.4, -8.8] })
      break
  }
  // side task once the power is on: the pump buys time
  const side = '#22f0ff'
  if (game.power && !game.pumpOn && ['access', 'charge', 'arm'].includes(game.phase)) {
    if (!game.pumpDoorOpen) t.push({ key: 'valves', label: 'Насосная: вентили', p: VALVE_POS[1], color: side })
    else if (heldKind === 'hose') t.push({ key: 'pump', label: 'Насос', p: HOSE_SOCKETS[1].pos, color: side })
    else
      for (const it of Object.values(items))
        if (it.kind === 'hose' && !it.socket) t.push({ key: it.id, label: 'Шланг', p: it.p, item: it.id, color: side })
  }
  return (
    <div className="markers" aria-hidden>
      {t.map((x) => (
        <Marker key={x.key} target={x} />
      ))}
    </div>
  )
}

const v = new THREE.Vector3()
const fwd = new THREE.Vector3()

function Marker({ target }: { target: Target }) {
  const el = useRef<HTMLDivElement>(null)
  const dist = useRef<HTMLSpanElement>(null)
  const arrow = useRef<HTMLElement>(null)
  const tRef = useRef(target)
  tRef.current = target

  useEffect(() => {
    let raf = 0
    const loop = () => {
      raf = requestAnimationFrame(loop)
      const c = cam.current
      const node = el.current
      if (!c || !node) return
      const t = tRef.current
      const p = t.item ? live.items.get(t.item)?.p ?? t.p : t.p
      v.set(p[0], p[1] + 0.5, p[2])
      c.getWorldDirection(fwd)
      const behind = fwd.dot(v.clone().sub(c.position)) < 0
      v.project(c)
      let x = v.x
      let y = v.y
      if (behind) {
        x = -x
        y = -y
      }
      const W = window.innerWidth
      const H = window.innerHeight
      const m = 0.88
      const off = behind || Math.abs(x) > m || Math.abs(y) > m
      if (off) {
        // push onto the screen edge along the direction to the target
        const k = m / Math.max(Math.abs(x), Math.abs(y), 1e-4)
        x *= k
        y *= k
        if (behind && Math.abs(y) > Math.abs(x)) y = -m // behind you: keep it at the bottom
      }
      const sx = ((x + 1) / 2) * W
      const sy = ((1 - y) / 2) * H
      node.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -50%)`
      node.classList.toggle('edge', off)
      if (arrow.current) arrow.current.style.transform = `rotate(${Math.atan2(-y, x)}rad)`
      const d = Math.hypot(p[0] - live.me.p[0], p[1] - live.me.p[1], p[2] - live.me.p[2])
      if (dist.current) dist.current.textContent = `${d.toFixed(0)} м`
    }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div ref={el} className="marker" style={target.color ? { ['--mc' as string]: target.color } : undefined}>
      <i />
      <em ref={arrow}>➜</em>
      <b>{target.label}</b>
      <span ref={dist} />
    </div>
  )
}
