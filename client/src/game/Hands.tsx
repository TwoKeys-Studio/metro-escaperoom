import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { live } from '../net'
import { hold, useUi } from './ui'

// First-person arms. They are drawn on top of the world (no depth test), so they never poke through walls.
// Left hand holds the flashlight, right hand reaches when you use or carry something.
export const handState = { reachUntil: 0 }

function useArmMats() {
  return useMemo(() => {
    const top = (m: THREE.Material, order: number) => {
      m.depthTest = false
      m.depthWrite = false
      return { m, order }
    }
    return {
      sleeve: top(new THREE.MeshStandardMaterial({ color: '#262c35', emissive: '#0b0f14', roughness: 0.75, metalness: 0.2 }), 10),
      glove: top(new THREE.MeshStandardMaterial({ color: '#16191e', emissive: '#07090c', roughness: 0.55, metalness: 0.35 }), 11),
      led: top(new THREE.MeshBasicMaterial({ color: new THREE.Color('#22f0ff').multiplyScalar(1.6), toneMapped: false }), 12),
      torch: top(new THREE.MeshStandardMaterial({ color: '#2a2f36', roughness: 0.3, metalness: 0.8 }), 12),
      lens: top(new THREE.MeshBasicMaterial({ color: new THREE.Color('#e8fbff').multiplyScalar(1.2), toneMapped: false }), 13),
    }
  }, [])
}

function Arm({ side, mats }: { side: 1 | -1; mats: ReturnType<typeof useArmMats> }) {
  const M = (k: keyof typeof mats) => ({ material: mats[k].m, renderOrder: mats[k].order })
  return (
    <group>
      {/* forearm runs from the elbow (behind, out of view) to the wrist at the origin */}
      <mesh {...M('sleeve')} position={[0, 0, 0.22]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.045, 0.06, 0.44, 10]} />
      </mesh>
      <mesh {...M('led')} position={[0.047 * side, 0.012, 0.16]} rotation-x={Math.PI / 2}>
        <boxGeometry args={[0.004, 0.14, 0.008]} />
      </mesh>
      {/* glove */}
      <mesh {...M('glove')} position={[0, 0, -0.05]}>
        <boxGeometry args={[0.085, 0.04, 0.1]} />
      </mesh>
      {[-0.03, -0.01, 0.01, 0.03].map((x) => (
        <mesh key={x} {...M('glove')} position={[x, -0.004, -0.12]}>
          <boxGeometry args={[0.016, 0.022, 0.06]} />
        </mesh>
      ))}
      <mesh {...M('glove')} position={[-0.05 * side, 0, -0.06]} rotation-y={0.6 * side}>
        <boxGeometry args={[0.018, 0.022, 0.05]} />
      </mesh>
    </group>
  )
}

export function Hands() {
  const root = useRef<THREE.Group>(null)
  const right = useRef<THREE.Group>(null)
  const left = useRef<THREE.Group>(null)
  const torch = useRef<THREE.Group>(null)
  const { camera } = useThree()
  const mats = useArmMats()
  const st = useRef({ last: new THREE.Vector3(), sway: 0, speed: 0, grip: 0, reach: 0 })

  useFrame(({ clock }, dt) => {
    const g = root.current
    if (!g) return
    g.position.copy(camera.position)
    g.quaternion.copy(camera.quaternion)
    const s = st.current
    const v = camera.position.distanceTo(s.last) / Math.max(dt, 1e-3)
    s.last.copy(camera.position)
    s.speed += (Math.min(v, 6) - s.speed) * Math.min(1, dt * 8)
    s.sway += dt * (2 + s.speed * 1.6)
    const bobX = Math.sin(s.sway) * 0.012 * Math.min(1, s.speed / 3)
    const bobY = Math.abs(Math.cos(s.sway)) * 0.014 * Math.min(1, s.speed / 3)
    const breathe = Math.sin(clock.elapsedTime * 1.4) * 0.004

    const holding = !!hold.id
    const reaching = performance.now() < handState.reachUntil
    s.grip += ((holding ? 1 : 0) - s.grip) * Math.min(1, dt * 10)
    s.reach += ((reaching ? 1 : 0) - s.reach) * Math.min(1, dt * (reaching ? 18 : 6))
    const shock = performance.now() < live.shockUntil ? (Math.random() - 0.5) * 0.03 : 0

    if (right.current) {
      right.current.position.set(
        0.32 - s.grip * 0.1 + bobX + shock,
        -0.31 + s.grip * 0.1 + s.reach * 0.07 - bobY + breathe,
        -0.55 - s.grip * 0.12 - s.reach * 0.16,
      )
      right.current.rotation.set(0.15 - s.grip * 0.35, 0.25 - s.grip * 0.2, -0.15)
    }
    if (left.current) {
      const flashOn = useUi.getState().flash
      left.current.position.set(-0.32 - bobX + shock, -0.31 - bobY + breathe + (flashOn ? 0 : -0.1), -0.55)
      left.current.rotation.set(0.12, -0.18, 0.12)
    }
    if (torch.current) torch.current.visible = true
  })

  return (
    <group ref={root}>
      <group ref={right}>
        <Arm side={1} mats={mats} />
      </group>
      <group ref={left}>
        <Arm side={-1} mats={mats} />
        <group ref={torch} position={[0.005, 0.03, -0.11]}>
          <mesh material={mats.torch.m} renderOrder={mats.torch.order} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.018, 0.021, 0.16, 12]} />
          </mesh>
          <mesh material={mats.lens.m} renderOrder={mats.lens.order} position-z={-0.081}>
            <circleGeometry args={[0.019, 16]} />
          </mesh>
        </group>
      </group>
    </group>
  )
}
