import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { live, useNet } from '../net'
import { nameTagTexture } from './textures'

const NO_PLAYERS: never[] = []

export function Remotes() {
  const myId = useNet((s) => s.myId)
  const players = useNet((s) => s.room?.players ?? NO_PLAYERS)
  return (
    <>
      {players.filter((p) => p.id !== myId && p.alive).map((p) => (
        <Avatar key={p.id} id={p.id} name={p.name} color={p.color} />
      ))}
      <RemoteFlashlights />
    </>
  )
}

function Avatar({ id, name, color }: { id: string; name: string; color: string }) {
  const g = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const body = useRef<THREE.Mesh>(null)
  const tag = useMemo(() => nameTagTexture(name, color), [name, color])
  const visor = useMemo(() => new THREE.Color(color).multiplyScalar(3), [color])
  const st = useRef({ init: false, walk: 0 })

  useFrame((_, dt) => {
    const tf = live.players.get(id)
    const o = g.current
    if (!tf || !o) return
    // body center is sent; avatar origin = feet
    const tx = tf.p[0]
    const ty = tf.p[1] - 0.9
    const tz = tf.p[2]
    if (!st.current.init) {
      o.position.set(tx, ty, tz)
      st.current.init = true
    }
    const a = Math.min(1, dt * 10)
    const before = o.position.clone()
    o.position.x += (tx - o.position.x) * a
    o.position.y += (ty - o.position.y) * a
    o.position.z += (tz - o.position.z) * a
    let dy = tf.yaw - o.rotation.y
    dy = Math.atan2(Math.sin(dy), Math.cos(dy))
    o.rotation.y += dy * a
    if (head.current) head.current.rotation.x = tf.pitch * 0.8
    const speed = before.distanceTo(o.position) / Math.max(dt, 1e-3)
    st.current.walk += speed * dt * 3
    if (body.current) {
      body.current.position.y = (tf.crouch ? 0.55 : 0.85) + Math.abs(Math.sin(st.current.walk)) * 0.04
      body.current.scale.y = tf.crouch ? 0.7 : 1
    }
    if (head.current) head.current.position.y = tf.crouch ? 1.15 : 1.6
  })

  return (
    <group ref={g}>
      <mesh ref={body} castShadow position-y={0.85}>
        <capsuleGeometry args={[0.3, 0.9, 6, 12]} />
        <meshStandardMaterial color="#14181f" roughness={0.5} metalness={0.4} />
      </mesh>
      <group ref={head} position-y={1.6}>
        <mesh castShadow>
          <boxGeometry args={[0.32, 0.3, 0.32]} />
          <meshStandardMaterial color="#0c0e12" roughness={0.3} metalness={0.6} />
        </mesh>
        <mesh position={[0, 0.02, -0.165]}>
          <planeGeometry args={[0.28, 0.07]} />
          <meshBasicMaterial color={visor} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      </group>
      <mesh position={[0, 0.9, -0.31]}>
        <planeGeometry args={[0.04, 0.6]} />
        <meshBasicMaterial color={visor} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <sprite position-y={2.1} scale={[1.2, 0.225, 1]}>
        <spriteMaterial map={tag} transparent depthWrite={false} toneMapped={false} />
      </sprite>
    </group>
  )
}

// Four shared spotlights follow the nearest teammates with flashlights on (fixed light count).
function RemoteFlashlights() {
  const lights = useRef<(THREE.SpotLight | null)[]>([])
  const targets = useMemo(() => Array.from({ length: 4 }, () => new THREE.Object3D()), [])
  const myId = useNet((s) => s.myId)
  useFrame(() => {
    const me = live.me.p
    const list = [...live.players.entries()]
      .filter(([id, tf]) => id !== myId && tf.flash)
      .sort((a, b) => dist2(a[1].p, me) - dist2(b[1].p, me))
      .slice(0, 4)
    lights.current.forEach((l, i) => {
      if (!l) return
      const e = list[i]
      if (!e) {
        l.intensity = 0
        return
      }
      const tf = e[1]
      const eye = new THREE.Vector3(tf.p[0], tf.p[1] + 0.6, tf.p[2])
      const dir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(tf.pitch, tf.yaw, 0, 'YXZ'))
      l.position.copy(eye).addScaledVector(dir, 0.3)
      targets[i].position.copy(eye).addScaledVector(dir, 8)
      targets[i].updateMatrixWorld()
      l.intensity = 40
    })
  })
  return (
    <>
      {targets.map((t, i) => (
        <group key={i}>
          <primitive object={t} />
          <spotLight ref={(el) => { lights.current[i] = el }} target={t} angle={0.5} penumbra={0.6} distance={20} decay={1.5} color="#cfefff" intensity={0} />
        </group>
      ))}
    </>
  )
}

const dist2 = (a: number[], b: number[]) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2
