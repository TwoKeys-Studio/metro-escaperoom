import { Suspense, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { Bloom, ChromaticAberration, EffectComposer, Glitch, Noise, Vignette } from '@react-three/postprocessing'
import { GlitchMode, type ChromaticAberrationEffect, type GlitchEffect } from 'postprocessing'
import { DIFFICULTIES, SPAWN, type Vec3 } from '../../../shared/level'
import { live, send, useNet } from '../net'
import { sfx } from './audio'
import { EventAudio, GhostTrain, Particles, Shadow, Water } from './Fx'
import { Hud } from './Hud'
import { Items } from './Items'
import { Apparitions } from './Apparitions'
import { Hands, handState } from './Hands'
import { Lights } from './Lights'
import { CameraBridge, Markers } from './Markers'
import { Player, type PlayerMode } from './Player'
import { Puzzles } from './Puzzles'
import { Remotes } from './Remotes'
import { hold, keys, useUi } from './ui'
import { World } from './World'

const NO_PLAYERS: never[] = []

export function Game({ spectator = false }: { spectator?: boolean }) {
  const [fontsReady, setFontsReady] = useState(false)
  const myId = useNet((s) => s.myId)
  const me = useNet((s) => s.room?.players.find((p) => p.id === s.myId))
  const players = useNet((s) => s.room?.players ?? NO_PLAYERS)
  const difficulty = useNet((s) => s.game?.difficulty ?? 'normal')
  const wrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    Promise.all([
      document.fonts.load('800 40px Unbounded'),
      document.fonts.load('600 40px Unbounded'),
      document.fonts.load('400 20px "JetBrains Mono"'),
      document.fonts.load('700 20px "JetBrains Mono"'),
    ]).finally(() => setFontsReady(true))
  }, [])

  useInput(spectator)

  const index = Math.max(0, players.findIndex((p) => p.id === myId))
  const a = (index / Math.max(1, players.length)) * Math.PI * 2
  const spawn: Vec3 = [SPAWN[0] + Math.cos(a) * 1.6, SPAWN[1] + 0.2, SPAWN[2] + Math.sin(a) * 1.2]
  const mode: PlayerMode = spectator ? 'spectator' : me && !me.alive ? 'ghost' : 'player'
  const cfg = DIFFICULTIES[difficulty]

  return (
    <div ref={wrap} style={{ position: 'fixed', inset: 0, background: '#000' }}>
      {fontsReady && (
        <Canvas
          shadows
          dpr={[1, 1.5]}
          camera={{ fov: 74, near: 0.05, far: 140, position: spawn }}
          gl={{ antialias: false, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping }}
          onPointerDown={() => {
            sfx.startAmbient()
            const ui = useUi.getState()
            if (!ui.keypad && !ui.kiosk && !ui.chat && !document.pointerLockElement) wrap.current?.querySelector('canvas')?.requestPointerLock()
          }}
        >
          <color attach="background" args={['#020304']} />
          <fogExp2 attach="fog" args={['#050a0d', cfg.fog]} />
          <Suspense fallback={null}>
            <Physics gravity={[0, -14, 0]}>
              <World />
              <Items />
              <Player key={mode} mode={mode} spawn={spawn} />
            </Physics>
            <Lights />
            <Puzzles />
            <Remotes />
            <Water />
            <Particles />
            <GhostTrain />
            <Shadow />
            <Apparitions />
            <EventAudio />
            <CameraBridge />
            {mode === 'player' && <Hands />}
            <Post />
          </Suspense>
        </Canvas>
      )}
      {!spectator && <Markers />}
      <Hud spectator={spectator} />
    </div>
  )
}

function Post() {
  const ca = useRef<ChromaticAberrationEffect>(null)
  const glitch = useRef<GlitchEffect>(null)
  useFrame(() => {
    const now = performance.now()
    const g = now < live.glitchUntil || now < live.shockUntil
    if (glitch.current) glitch.current.mode = g ? GlitchMode.CONSTANT_WILD : GlitchMode.DISABLED
    if (ca.current) {
      const k = 0.0008 + (g ? 0.008 : 0) + live.shake * 0.003
      ca.current.offset.set(k, k * 0.6)
    }
  })
  return (
    <EffectComposer multisampling={0}>
      <Bloom mipmapBlur intensity={1.1} luminanceThreshold={0.85} luminanceSmoothing={0.2} radius={0.75} />
      <ChromaticAberration ref={ca} offset={new THREE.Vector2(0.0008, 0.0005)} radialModulation={false} modulationOffset={0} />
      <Glitch ref={glitch} mode={GlitchMode.DISABLED} delay={new THREE.Vector2(0, 0)} duration={new THREE.Vector2(0.1, 0.3)} strength={new THREE.Vector2(0.2, 0.5)} />
      <Noise opacity={0.05} premultiply />
      <Vignette eskil={false} offset={0.28} darkness={0.72} />
    </EffectComposer>
  )
}

function interact() {
  const ui = useUi.getState()
  if (hold.id) {
    hold.dropReq = true
    return
  }
  const f = ui.focus
  if (!f) return
  handState.reachUntil = performance.now() + 220
  switch (f.kind) {
    case 'item':
      send({ t: 'grab', id: f.id })
      break
    case 'keypad':
      document.exitPointerLock()
      useUi.setState({ keypad: f.target })
      break
    case 'kiosk':
      document.exitPointerLock()
      useUi.setState({ kiosk: true })
      break
    case 'tlever':
      send({ t: 'tlever', index: f.index })
      sfx.lever()
      break
    case 'valve':
      send({ t: 'valve', index: f.index })
      sfx.lever()
      break
    case 'lever':
      send({ t: 'lever', index: f.index })
      sfx.lever()
      break
    case 'breaker':
      send({ t: 'breaker', index: f.index })
      sfx.lever()
      break
    case 'dial':
      send({ t: 'dial', index: f.index })
      sfx.tone(520, 'square', 0.05, 0.07)
      break
    case 'console':
      if (hold.console !== f.which) {
        hold.console = f.which
        send({ t: 'hold', console: f.which, down: true })
        sfx.beep(true)
      }
      break
    case 'vending':
      send({ t: 'vending' })
      sfx.tone(440, 'square', 0.1, 0.06)
      setTimeout(() => sfx.drop(), 500)
      break
  }
}

function releaseConsole() {
  if (hold.console) {
    send({ t: 'hold', console: hold.console, down: false })
    hold.console = null
  }
}

function useInput(spectator: boolean) {
  useEffect(() => {
    const typing = () => useUi.getState().chat || !!useUi.getState().keypad || useUi.getState().kiosk
    const down = (e: KeyboardEvent) => {
      if (typing()) return
      if (e.code === 'Tab') {
        e.preventDefault()
        useUi.setState({ scores: true })
        return
      }
      if (e.code === 'Enter' || e.code === 'KeyT') {
        e.preventDefault()
        document.exitPointerLock()
        useUi.setState({ chat: true })
        return
      }
      if (e.repeat) return
      keys.add(e.code)
      if (spectator) return
      sfx.startAmbient()
      if (e.code === 'KeyE') interact()
      if (e.code === 'KeyF') {
        useUi.setState({ flash: !useUi.getState().flash })
        sfx.tone(1800, 'square', 0.03, 0.05)
      }
      if (e.code === 'KeyQ' && hold.id) hold.dropReq = true
      if (e.code === 'KeyG' && hold.id) hold.throwReq = true
    }
    const up = (e: KeyboardEvent) => {
      keys.delete(e.code)
      if (e.code === 'Tab') useUi.setState({ scores: false })
      if (e.code === 'KeyE') releaseConsole()
    }
    const mdown = (e: MouseEvent) => {
      if (!document.pointerLockElement || spectator) return
      if (e.button === 0) interact()
      if (e.button === 2 && hold.id) hold.throwReq = true
    }
    const mup = (e: MouseEvent) => {
      if (e.button === 0) releaseConsole()
    }
    const lock = () => useUi.setState({ locked: !!document.pointerLockElement })
    const blur = () => {
      keys.clear()
      releaseConsole()
    }
    const ctx = (e: Event) => e.preventDefault()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('mousedown', mdown)
    window.addEventListener('mouseup', mup)
    window.addEventListener('blur', blur)
    window.addEventListener('contextmenu', ctx)
    document.addEventListener('pointerlockchange', lock)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('mousedown', mdown)
      window.removeEventListener('mouseup', mup)
      window.removeEventListener('blur', blur)
      window.removeEventListener('contextmenu', ctx)
      document.removeEventListener('pointerlockchange', lock)
      keys.clear()
      if (document.pointerLockElement) document.exitPointerLock()
    }
  }, [spectator])
}
