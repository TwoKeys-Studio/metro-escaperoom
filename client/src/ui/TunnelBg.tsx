import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing'

// Background for the menus: an endless ride through a dead neon tunnel.
function Rings() {
  const group = useRef<THREE.Group>(null)
  const N = 26
  const rings = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => ({
        z: -i * 4,
        color: new THREE.Color(i % 5 === 0 ? '#ff2e88' : i % 7 === 0 ? '#e6ff3a' : '#22f0ff').multiplyScalar(i % 3 === 0 ? 2.4 : 0.5),
        broken: Math.random() < 0.25,
      })),
    [],
  )
  useFrame(({ clock, camera }, dt) => {
    const g = group.current
    if (!g) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    g.children.forEach((c, i) => {
      if (!reduce) c.position.z += dt * 6
      if (c.position.z > 4) c.position.z -= N * 4
      const m = (c as THREE.Mesh).material as THREE.MeshBasicMaterial
      if (rings[i].broken) m.opacity = Math.random() < 0.08 ? 0.1 : 1
    })
    camera.position.x = Math.sin(clock.elapsedTime * 0.3) * 0.4
    camera.position.y = Math.cos(clock.elapsedTime * 0.21) * 0.25
    camera.lookAt(0, 0, -30)
  })
  return (
    <group ref={group}>
      {rings.map((r, i) => (
        <mesh key={i} position-z={r.z}>
          <torusGeometry args={[3.2, 0.03, 6, 6]} />
          <meshBasicMaterial color={r.color} toneMapped={false} transparent />
        </mesh>
      ))}
    </group>
  )
}

function Rails() {
  return (
    <group position-y={-2.6}>
      {[-0.7, 0.7].map((x) => (
        <mesh key={x} position={[x, 0, -40]}>
          <boxGeometry args={[0.06, 0.06, 100]} />
          <meshBasicMaterial color={new THREE.Color('#22f0ff').multiplyScalar(0.9)} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

export function TunnelBg() {
  return (
    <Canvas className="bg-canvas" dpr={[1, 1.5]} camera={{ fov: 70, position: [0, 0, 3] }} gl={{ antialias: false }} aria-hidden>
      <color attach="background" args={['#030406']} />
      <fog attach="fog" args={['#030406', 6, 70]} />
      <Rings />
      <Rails />
      <EffectComposer multisampling={0}>
        <Bloom mipmapBlur intensity={1.3} luminanceThreshold={0.7} />
        <Noise opacity={0.08} premultiply />
        <Vignette offset={0.2} darkness={0.9} />
      </EffectComposer>
    </Canvas>
  )
}
