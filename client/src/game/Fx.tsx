import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { CHARGE_SOCKET, PIT_Y } from '../../../shared/level'
import { live, useNet } from '../net'
import { sfx } from './audio'

// ---------- rising water ----------
// Black flood water: rippled normals, Fresnel, and a cheap analytic "reflection" of the station's
// neon (ceiling tube rows in the hall, lamp pools in the tunnels) so it glints without a second render.
const waterVert = /* glsl */ `
  uniform float time; varying vec3 vPos;
  #include <fog_pars_vertex>
  void main(){
    vec3 p = position;
    p.z += sin(p.x*0.6 + time*1.3)*0.04 + cos(p.y*0.9 + time*0.8)*0.03;
    vPos = (modelMatrix * vec4(p,1.0)).xyz;
    vec4 mvPosition = modelViewMatrix * vec4(p,1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`
const waterFrag = /* glsl */ `
  uniform float time; uniform float glow; uniform float alarm; varying vec3 vPos;
  #include <fog_pars_fragment>
  float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
  float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
  float surf(vec2 q){ return n(q*0.9 + vec2(time*0.22, time*0.13)) * 0.6 + n(q*2.6 - vec2(time*0.3, -time*0.21)) * 0.3 + n(q*6.0 + time*0.5) * 0.1; }
  void main(){
    vec2 q = vPos.xz;
    float e = 0.12;
    float s0 = surf(q);
    vec3 nrm = normalize(vec3((s0 - surf(q + vec2(e, 0.0))) * 2.2, 1.0, (s0 - surf(q + vec2(0.0, e))) * 2.2));
    vec3 v = normalize(cameraPosition - vPos);
    float fres = pow(1.0 - max(dot(nrm, v), 0.0), 3.0);
    vec3 r = reflect(-v, nrm);
    // where the mirrored ray meets the ceiling
    vec2 c = q + r.xz / max(r.y, 0.3) * 4.5;
    float hall = smoothstep(23.5, 21.0, abs(c.x));
    float dash = smoothstep(0.1, 0.3, abs(fract(c.x / 4.2 + 0.02) - 0.5) * 2.0 + 0.55) ;
    vec3 env = vec3(0.13, 0.94, 1.0) * exp(-pow((c.y + 4.0) * 0.8, 2.0)) * dash;
    env += vec3(1.0, 0.18, 0.53) * exp(-pow((c.y - 1.5) * 0.8, 2.0)) * dash;
    // platform edge line (low), far-wall station sign and the two pendants over the track
    vec2 c2 = q + r.xz / max(r.y, 0.3) * 0.5;
    env += vec3(0.9, 1.0, 0.23) * exp(-pow((c2.y - 5.0) * 2.2, 2.0)) * 0.5;
    env += vec3(0.13, 0.94, 1.0) * exp(-pow((c.y - 10.6) * 0.7, 2.0)) * smoothstep(6.5, 3.5, abs(c.x)) * 0.7;
    env += vec3(0.9, 1.0, 0.23) * exp(-dot(c - vec2(-10.0, 6.0), c - vec2(-10.0, 6.0)) * 0.5);
    env += vec3(0.13, 0.94, 1.0) * exp(-dot(c - vec2(10.0, 6.0), c - vec2(10.0, 6.0)) * 0.5);
    env *= hall;
    vec2 d = vec2(mod(c.x + 50.0, 8.0) - 4.0, c.y - 5.4);
    env += vec3(1.0, 0.55, 0.25) * exp(-dot(d, d) * 0.35) * (1.0 - hall) * 0.45;
    env = env * glow + vec3(1.0, 0.1, 0.1) * alarm * exp(-pow((c.y + 6.0) * 0.25, 2.0)) * 0.25;
    float caust = smoothstep(0.55, 0.9, s0);
    vec3 deep = vec3(0.004, 0.03, 0.038) + vec3(0.02, 0.2, 0.24) * caust * 0.14 * (0.3 + glow);
    vec3 col = deep * (1.0 - fres) + (env * 1.1 + vec3(0.003, 0.009, 0.012)) * (0.15 + 0.85 * fres);
    gl_FragColor = vec4(col, mix(0.82, 0.97, fres));
    #include <fog_fragment>
  }
`
export function Water() {
  const mesh = useRef<THREE.Mesh>(null)
  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { time: { value: 0 }, glow: { value: 1 }, alarm: { value: 0 } }]),
    vertexShader: waterVert, fragmentShader: waterFrag, transparent: true, fog: true,
    side: THREE.DoubleSide, depthWrite: false,
  }), [])
  const y = useRef(PIT_Y - 0.4)
  useFrame(({ clock }, dt) => {
    const power = !!useNet.getState().game?.power
    const blackout = performance.now() < live.blackoutUntil
    const u = mat.uniforms
    u.time.value = clock.elapsedTime
    u.glow.value += ((blackout ? 0 : power ? 1 : 0.04) - u.glow.value) * Math.min(1, dt * 6)
    u.alarm.value += ((blackout || power ? 0 : 1) - u.alarm.value) * Math.min(1, dt * 6)
    y.current += (live.water - y.current) * Math.min(1, dt * 2)
    if (mesh.current) mesh.current.position.y = y.current
  })
  return (
    <mesh ref={mesh} rotation-x={-Math.PI / 2} position={[8, PIT_Y, 0]} material={mat} renderOrder={2}>
      <planeGeometry args={[116, 36, 120, 40]} />
    </mesh>
  )
}

// ---------- leaking water & falling dust ----------
export function Particles() {
  const pts = useRef<THREE.Points>(null)
  const N = 900
  const data = useMemo(() => {
    const pos = new Float32Array(N * 3)
    const vel = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      pos[i * 3] = -20 + Math.random() * 84
      pos[i * 3 + 1] = Math.random() * 5
      pos[i * 3 + 2] = -6 + Math.random() * 16
      vel[i] = 0.2 + Math.random() * 0.6
    }
    return { pos, vel }
  }, [])
  useFrame((_, dt) => {
    const p = data.pos
    const fast = live.shake > 0.2 ? 6 : 1
    for (let i = 0; i < N; i++) {
      p[i * 3 + 1] -= data.vel[i] * dt * fast
      p[i * 3] += Math.sin(p[i * 3 + 1] + i) * 0.002
      if (p[i * 3 + 1] < live.water || p[i * 3 + 1] < PIT_Y) {
        p[i * 3 + 1] = 5.8
        p[i * 3] = live.me.p[0] - 18 + Math.random() * 36
        p[i * 3 + 2] = live.me.p[2] - 10 + Math.random() * 20
      }
    }
    if (pts.current) (pts.current.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
  })
  return (
    <points ref={pts}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data.pos, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.025} color="#9fb4c0" transparent opacity={0.5} depthWrite={false} />
    </points>
  )
}

// ---------- the ghost train ----------
export function GhostTrain() {
  const g = useRef<THREE.Group>(null)
  const light = useRef<THREE.SpotLight>(null)
  const target = useMemo(() => new THREE.Object3D(), [])
  const st = useRef({ active: false, x: -80, seen: 0 })
  useFrame((_, dt) => {
    const ev = live.events.find((e) => e.type === 'ghostTrain' && e.t > st.current.seen)
    if (ev) {
      st.current.seen = ev.t
      st.current.active = true
      st.current.x = -75
      sfx.horn([-40, 0, 8])
      live.shake = Math.max(live.shake, 0.6)
    }
    if (!g.current || !light.current) return
    if (st.current.active) {
      st.current.x += dt * 42
      g.current.position.x = st.current.x
      g.current.visible = true
      light.current.intensity = 400
      light.current.position.set(st.current.x + 13, PIT_Y + 1.8, 8)
      target.position.set(st.current.x + 40, PIT_Y + 1, 8)
      target.updateMatrixWorld()
      const near = Math.abs(live.me.p[0] - st.current.x) < 30 && live.me.p[2] > 4
      if (near) live.shake = Math.max(live.shake, 0.5)
      if (st.current.x > 90) {
        st.current.active = false
        g.current.visible = false
        light.current.intensity = 0
      }
    }
  })
  return (
    <>
      <primitive object={target} />
      <spotLight ref={light} target={target} angle={0.35} penumbra={0.4} distance={60} color="#e8fbff" intensity={0} />
      <group ref={g} visible={false} position={[-80, PIT_Y + 0.2, 8]}>
        {[0, -13.5].map((dx) => (
          <group key={dx} position-x={dx}>
            <mesh position-y={1.5}>
              <boxGeometry args={[13, 2.8, 2.9]} />
              <meshStandardMaterial color="#0b0e12" metalness={0.8} roughness={0.3} transparent opacity={0.75} />
            </mesh>
            {Array.from({ length: 6 }, (_, i) => (
              <mesh key={i} position={[-5 + i * 2, 1.9, -1.46]}>
                <planeGeometry args={[1.3, 0.8]} />
                <meshBasicMaterial color={new THREE.Color('#9ff7ff').multiplyScalar(2.2)} toneMapped={false} side={THREE.DoubleSide} />
              </mesh>
            ))}
          </group>
        ))}
        <mesh position={[6.55, 1.2, 0]}>
          <planeGeometry args={[0.1, 0.1]} />
          <meshBasicMaterial color="#fff" />
        </mesh>
      </group>
    </>
  )
}

// ---------- the "passenger": a figure that appears behind someone ----------
export function Shadow() {
  const g = useRef<THREE.Group>(null)
  const st = useRef({ until: 0, seen: 0 })
  const myId = useNet((s) => s.myId)
  useFrame(() => {
    const ev = live.events.find((e) => e.type === 'shadow' && e.t > st.current.seen)
    const o = g.current
    if (!o) return
    if (ev) {
      st.current.seen = ev.t
      // only the target sees it, placed behind them
      if (ev.target === myId) {
        const yaw = live.me.yaw
        const back = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(6)
        const base = new THREE.Vector3(...live.me.p).add(back)
        o.position.set(base.x, Math.max(live.me.p[1] - 1.6, PIT_Y), base.z)
        o.lookAt(live.me.p[0], o.position.y, live.me.p[2])
        st.current.until = performance.now() + 7000
        o.visible = true
        sfx.whisper([base.x, base.y + 1.5, base.z])
      }
    }
    if (o.visible) {
      const toFig = new THREE.Vector3().subVectors(o.position, new THREE.Vector3(...live.me.p)).setY(0).normalize()
      const look = new THREE.Vector3(-Math.sin(live.me.yaw), 0, -Math.cos(live.me.yaw))
      // vanishes when you finally look at it — or when its time runs out
      if (look.dot(toFig) > 0.93 || performance.now() > st.current.until) {
        if (look.dot(toFig) > 0.93) {
          live.glitchUntil = performance.now() + 500
          sfx.scream()
          live.shake = 0.6
        }
        o.visible = false
      }
    }
  })
  return (
    <group ref={g} visible={false}>
      <mesh position-y={1.05}>
        <capsuleGeometry args={[0.24, 1.5, 4, 8]} />
        <meshBasicMaterial color="#000" />
      </mesh>
      {[-0.07, 0.07].map((x) => (
        <mesh key={x} position={[x, 1.85, 0.2]}>
          <sphereGeometry args={[0.022, 6, 6]} />
          <meshBasicMaterial color={new THREE.Color('#ff1a1a').multiplyScalar(6)} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

// ---------- event sounds, siren, explosion flash ----------
export function EventAudio() {
  const seen = useRef(0)
  const phase = useNet((s) => s.game?.phase)
  const myId = useNet((s) => s.myId)
  const flash = useRef<THREE.PointLight>(null)
  useFrame((_, dt) => {
    for (const e of live.events) {
      if (e.t <= seen.current) continue
      seen.current = e.t
      if (e.type === 'quake') {
        if (e.at) {
          sfx.explosion()
          live.flashUntil = performance.now() + 900
          live.shake = 2
        } else sfx.rumble()
      }
      if (e.type === 'blackout') sfx.tone(60, 'sawtooth', 0.4, 0.2, undefined, 30)
      if (e.type === 'glitch') sfx.glitch()
      if (e.type === 'whisper' && (!e.target || e.target === myId)) {
        const yaw = live.me.yaw + Math.PI * (Math.random() > 0.5 ? 0.5 : -0.5)
        sfx.whisper([live.me.p[0] - Math.sin(yaw) * 2, live.me.p[1], live.me.p[2] - Math.cos(yaw) * 2])
      }
      if (e.type === 'scream') sfx.scream()
    }
    if (flash.current) {
      const on = performance.now() < live.flashUntil
      flash.current.intensity += ((on ? 3000 : 0) - flash.current.intensity) * Math.min(1, dt * 8)
    }
  })
  useEffect(() => {
    if (phase !== 'evac') return
    const stop = sfx.siren()
    return stop
  }, [phase])
  useEffect(() => {
    if (phase === 'won' || phase === 'access' || phase === 'charge' || phase === 'arm') sfx.success()
    if (phase === 'escape') sfx.ding()
  }, [phase])
  return <pointLight ref={flash} position={[CHARGE_SOCKET.pos[0] - 6, 1, 8]} color="#ffb36b" distance={60} intensity={0} />
}
