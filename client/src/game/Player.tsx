import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { CapsuleCollider, RigidBody, useRapier, type RapierRigidBody } from '@react-three/rapier'
import type { Collider } from '@dimforge/rapier3d-compat'
import { DIFFICULTIES, INTERACT_RANGE, PIT_Y, SPAWN, type Vec3 } from '../../../shared/level'
import { live, send, useNet } from '../net'
import { sfx } from './audio'
import { hold, interactables, keys, useUi, type Interact } from './ui'

const HALF = 0.55
const RADIUS = 0.35
const EYE = 0.72
const GRAVITY = 18
const JUMP = 5.8

export type PlayerMode = 'player' | 'ghost' | 'spectator'

export function Player({ mode, spawn }: { mode: PlayerMode; spawn: Vec3 }) {
  const body = useRef<RapierRigidBody>(null)
  const collider = useRef<Collider>(null)
  const { camera } = useThree()
  const { world, rapier } = useRapier()
  const flash = useRef<THREE.SpotLight>(null)
  const flashTarget = useMemo(() => new THREE.Object3D(), [])
  const s = useRef({
    yaw: Math.PI, pitch: 0, vy: 0, grounded: false, crouch: 0, bob: 0, stepDist: 0, sendT: 0,
    pos: new THREE.Vector3(...spawn), lastFocus: '' as string, wet: false,
  })
  const ray = useMemo(() => new THREE.Raycaster(), [])
  const ctrl = useRef<ReturnType<typeof world.createCharacterController> | null>(null)
  useEffect(() => {
    const c = world.createCharacterController(0.03)
    c.enableAutostep(0.5, 0.25, true)
    c.enableSnapToGround(0.4)
    c.setMaxSlopeClimbAngle((50 * Math.PI) / 180)
    c.setApplyImpulsesToDynamicBodies(true)
    ctrl.current = c
    return () => {
      ctrl.current = null
      world.removeCharacterController(c)
    }
  }, [world])

  // mouse look
  useEffect(() => {
    if (import.meta.env.DEV) {
      const w = window as unknown as { __setYaw: (y: number, p?: number) => void; __tp: (x: number, y: number, z: number) => void }
      w.__setYaw = (y, p = 0) => { s.current.yaw = y; s.current.pitch = p }
      w.__tp = (x, y, z) => { body.current?.setTranslation({ x, y, z }, true); s.current.pos.set(x, y, z) }
    }
    const onMove = (e: MouseEvent) => {
      if (!document.pointerLockElement) return
      const sens = 0.0022
      s.current.yaw -= e.movementX * sens
      s.current.pitch = THREE.MathUtils.clamp(s.current.pitch - e.movementY * sens, -1.5, 1.5)
    }
    document.addEventListener('mousemove', onMove)
    return () => document.removeEventListener('mousemove', onMove)
  }, [])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const st = s.current
    const ui = useUi.getState()
    const game = useNet.getState().game
    const typing = ui.chat || !!ui.keypad || ui.kiosk
    const k = (c: string) => !typing && keys.has(c)
    const fwdIn = (k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0)
    const sideIn = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0)
    const shocked = performance.now() < live.shockUntil
    const heavy = hold.id === 'charge'
    const forward = new THREE.Vector3(-Math.sin(st.yaw), 0, -Math.cos(st.yaw))
    const right = new THREE.Vector3(-forward.z, 0, forward.x)

    if (mode !== 'player') {
      // free-fly camera for the dead and for admins
      const speed = (k('ShiftLeft') ? 14 : 6) * dt
      const look = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(st.pitch, st.yaw, 0, 'YXZ'))
      st.pos.addScaledVector(look, fwdIn * speed).addScaledVector(right, sideIn * speed)
      if (k('Space')) st.pos.y += speed
      if (k('KeyC') || k('ControlLeft')) st.pos.y -= speed
      camera.position.copy(st.pos)
    } else if (body.current && collider.current && ctrl.current) {
      const controller = ctrl.current
      const crouching = k('KeyC') || k('ControlLeft')
      st.crouch += ((crouching ? 1 : 0) - st.crouch) * Math.min(1, dt * 10)
      const feetY = body.current.translation().y - HALF - RADIUS
      const inWater = live.water > feetY + 0.45
      let speed = k('ShiftLeft') && !heavy && !crouching ? 5.8 : 3.4
      if (crouching) speed = 1.8
      if (heavy) speed *= 0.62
      if (inWater) speed *= 0.6
      if (shocked) speed *= 0.2
      const move = new THREE.Vector3().addScaledVector(forward, fwdIn).addScaledVector(right, sideIn)
      if (move.lengthSq() > 1) move.normalize()
      move.multiplyScalar(speed * dt)

      if (st.grounded && k('Space') && !heavy) st.vy = JUMP
      st.vy -= GRAVITY * dt
      if (st.grounded && st.vy < 0) st.vy = -1
      move.y = st.vy * dt

      controller.computeColliderMovement(collider.current, move, undefined, undefined, (c) => {
        const rb = c.parent()
        return !(rb && hold.id && (rb.userData as { item?: string } | undefined)?.item === hold.id)
      })
      const m = controller.computedMovement()
      st.grounded = controller.computedGrounded()
      if (st.grounded && st.vy < 0) st.vy = 0
      const t = body.current.translation()
      const next = { x: t.x + m.x, y: t.y + m.y, z: t.z + m.z }
      if (next.y < PIT_Y - 5) Object.assign(next, { x: SPAWN[0], y: SPAWN[1] + 1, z: SPAWN[2] }) // fell out of the world
      body.current.setNextKinematicTranslation(next)

      // footsteps & bob
      const moved = Math.hypot(m.x, m.z)
      if (st.grounded && moved > 0.001) {
        st.bob += moved * 2.4
        st.stepDist += moved
        if (st.stepDist > (speed > 4 ? 0.75 : 0.62)) {
          st.stepDist = 0
          sfx.step(crouching ? 0.02 : 0.05, inWater)
        }
      }
      st.wet = inWater
      const eye = EYE - st.crouch * 0.6
      st.pos.set(next.x, next.y + eye + Math.sin(st.bob) * 0.035, next.z)
      camera.position.copy(st.pos)
    }

    // shake
    live.shake = Math.max(0, live.shake - dt * 0.8)
    const sh = live.shake * 0.08 + (shocked ? 0.03 : 0)
    const ex = (Math.random() - 0.5) * sh
    const ey = (Math.random() - 0.5) * sh
    camera.rotation.set(st.pitch + ey, st.yaw + ex, 0, 'YXZ')
    if ('fov' in camera) {
      const pc = camera as THREE.PerspectiveCamera
      const targetFov = k('ShiftLeft') && fwdIn > 0 && mode === 'player' ? 80 : 74
      pc.fov += (targetFov - pc.fov) * Math.min(1, dt * 6)
      pc.updateProjectionMatrix()
    }

    // flashlight + battery
    const cfg = DIFFICULTIES[game?.difficulty ?? 'normal']
    const on = ui.flash && live.battery > 0 && mode === 'player'
    if (on && cfg.flashlightDrain) live.battery = Math.max(0, live.battery - cfg.flashlightDrain * dt)
    if (!on && live.battery < 100) live.battery = Math.min(100, live.battery + dt * 1.2)
    if (flash.current) {
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
      flash.current.position.copy(camera.position).addScaledVector(right, -0.2).addScaledVector(dir, 0.45).add(new THREE.Vector3(0, -0.16, 0))
      flashTarget.position.copy(camera.position).addScaledVector(dir, 10)
      flashTarget.updateMatrixWorld()
      const low = live.battery < 15 ? (Math.random() < 0.1 ? 0.2 : 1) : 1
      flash.current.intensity = on ? 85 * low * (live.battery < 30 ? 0.6 : 1) : 0
    }

    // audio listener
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
    sfx.setListener([camera.position.x, camera.position.y, camera.position.z], [fwd.x, fwd.y, fwd.z])
    if (game) sfx.update(dt, Math.max(0, Math.min(1, (live.water - PIT_Y) / 1.8)), game.power, [camera.position.x, camera.position.y, camera.position.z])

    const under = camera.position.y < live.water
    if (under !== ui.underwater) useUi.setState({ underwater: under })

    live.me.p = [st.pos.x, st.pos.y, st.pos.z]
    live.me.yaw = st.yaw
    live.me.pitch = st.pitch

    // focus (what the crosshair is on)
    if (mode === 'player') updateFocus()

    // network
    st.sendT -= dt
    if (st.sendT <= 0 && mode !== 'spectator') {
      st.sendT = 1 / 15
      const b = body.current?.translation()
      send({
        t: 'move',
        p: b ? [round(b.x), round(b.y), round(b.z)] : [round(st.pos.x), round(st.pos.y), round(st.pos.z)],
        yaw: round(st.yaw), pitch: round(st.pitch), crouch: st.crouch > 0.5, flash: on,
      })
    }
  })

  function updateFocus() {
    const objs = [...interactables.keys()]
    ray.setFromCamera(new THREE.Vector2(0, 0), camera)
    ray.far = INTERACT_RANGE
    const hits = ray.intersectObjects(objs, true)
    let found: Interact | null = null
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object
      while (o && !interactables.has(o)) o = o.parent
      if (!o) continue
      const it = interactables.get(o)!()
      if (it && !(it.kind === 'item' && it.id === hold.id)) {
        // occlusion check against physics geometry
        const wall = castWorld(camera.position, ray.ray.direction, h.distance)
        if (wall < h.distance - 0.25) break
        found = it
        break
      }
    }
    const key = found ? JSON.stringify(found) : ''
    if (key !== s.current.lastFocus) {
      s.current.lastFocus = key
      useUi.setState({ focus: found })
      if (hold.console && (!found || found.kind !== 'console')) {
        send({ t: 'hold', console: hold.console, down: false })
        hold.console = null
      }
    }
  }

  // distance to the first static collider along the ray (ignores the player and items)
  function castWorld(o: THREE.Vector3, d: THREE.Vector3, max: number) {
    const r = new rapier.Ray({ x: o.x, y: o.y, z: o.z }, { x: d.x, y: d.y, z: d.z })
    const hit = world.castRay(r, max, true, undefined, undefined, undefined, undefined, (c) => {
      const rb = c.parent()
      if (!rb) return true
      const ud = rb.userData as { item?: string; player?: boolean } | undefined
      return !(ud?.item || ud?.player)
    })
    if (!hit) return Infinity
    const h = hit as unknown as { timeOfImpact?: number; toi?: number }
    return h.timeOfImpact ?? h.toi ?? Infinity
  }

  return (
    <>
      {mode === 'player' && (
        <RigidBody ref={body} type="kinematicPosition" colliders={false} position={spawn} userData={{ player: true }} enabledRotations={[false, false, false]}>
          <CapsuleCollider ref={collider} args={[HALF, RADIUS]} />
        </RigidBody>
      )}
      <primitive object={flashTarget} />
      <spotLight
        ref={flash}
        target={flashTarget}
        angle={0.6}
        penumbra={0.55}
        distance={26}
        decay={1.4}
        color="#d9f6ff"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-camera-near={0.2}
        shadow-camera-far={26}
      />
    </>
  )
}

const round = (n: number) => Math.round(n * 100) / 100
