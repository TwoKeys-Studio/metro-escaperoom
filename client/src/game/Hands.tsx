import { Suspense, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { live } from '../net'
import type { ItemKind } from '../../../shared/level'
import { hold, useUi } from './ui'

// First-person arms in tactical gloves. The left hand holds the flashlight in a fist; the right hand
// hangs relaxed, opens when it reaches for something, and wraps its fingers around whatever is carried.
export const handState = { reachUntil: 0 }

// The arms are modelled life-size but drawn shrunk towards the eye. On screen that looks exactly the
// same, while in depth they sit a hand's width from the camera and so never sink into a wall the player
// is facing. The right arm goes back to life size while it carries something, so that the item hides the
// fingers behind it.
const VIEW_SCALE = 0.25

// Elbows, in camera space: fixed points below the view that the forearms always run from.
const ELBOW_R = new THREE.Vector3(0.44, -0.56, 0.12)
const ELBOW_L = new THREE.Vector3(-0.42, -0.6, 0.1)
// While carrying something the hand can wrap around, the elbow swings out so the hand is seen from its back.
const ELBOW_CARRY = new THREE.Vector3(0.78, -0.78, -0.2)

// Hand frame used everywhere below, in metres: the wrist is at the origin, fingers point to -z, the palm
// faces -y and the thumb is on the -x side of a right hand (+x for the left).
//
// The hands themselves are the MIT-licensed WebXR "generic hand" models (see public/models/README.md).
// Their skeleton is flat: every joint is a direct child of the armature, positioned in armature space.
// So bending a finger is done here by hand: each joint is rotated about the finger's flexion axis and
// moved along with the joints before it.
const MODEL = { 1: '/models/hand-right.glb', [-1]: '/models/hand-left.glb' } as const
const GLOVE_SCALE = 1.1 // a glove is a little bulkier than the bare hand
const FINGERS = ['index-finger', 'middle-finger', 'ring-finger', 'pinky-finger']
const FINGER_JOINTS = ['phalanx-proximal', 'phalanx-intermediate', 'phalanx-distal', 'tip']
const THUMB_JOINTS = ['thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip']
// How much of a finger's curl each joint takes, knuckle to tip (the tip only follows).
const FINGER_BEND = [0.75, 1, 0.7, 0]
const THUMB_BEND = [0.25, 0.6, 0.55, 0]

interface Chain {
  bones: THREE.Object3D[]
  /** Rest position and rotation of each joint, in armature space. */
  p: THREE.Vector3[]
  q: THREE.Quaternion[]
  /** Flexion axis: a positive turn about it closes the finger towards the palm. */
  axis: THREE.Vector3
}
interface Rig {
  fingers: Chain[]
  thumb: Chain
}

const _r = new THREE.Quaternion()
const _p = new THREE.Vector3()
const _prev = new THREE.Vector3()

function bend(chain: Chain, amount: number, share: number[]) {
  let angle = 0
  _prev.copy(chain.p[0])
  chain.bones.forEach((bone, i) => {
    if (i > 0) {
      // carried along by every joint before it
      _p.copy(chain.p[i]).sub(chain.p[i - 1]).applyQuaternion(_r.setFromAxisAngle(chain.axis, angle)).add(_prev)
      bone.position.copy(_p)
      _prev.copy(_p)
    }
    angle += amount * share[i]
    bone.quaternion.setFromAxisAngle(chain.axis, angle).multiply(chain.q[i])
  })
}

/** `curl` 0 = flat hand, about 1.3 = fist. */
function setCurl(rig: Rig, curl: number, thumb: number) {
  rig.fingers.forEach((chain, f) => bend(chain, curl * (1 + f * 0.06), FINGER_BEND)) // outer fingers close a little more
  bend(rig.thumb, thumb, THUMB_BEND)
}

function useArmMats() {
  return useMemo(() => ({
    sleeve: new THREE.MeshStandardMaterial({ color: '#2a323d', emissive: '#0c1117', roughness: 0.85, metalness: 0.1 }),
    glove: new THREE.MeshStandardMaterial({ color: GLOVE, emissive: '#0a0d11', roughness: 0.7, metalness: 0.12 }),
    // the hand itself: glove and skin are painted per vertex (see paintGlove)
    hand: new THREE.MeshStandardMaterial({ vertexColors: true, emissive: '#0b0a0a', roughness: 0.62, metalness: 0.04 }),
    cuff: new THREE.MeshStandardMaterial({ color: '#36414f', emissive: '#0c1117', roughness: 0.8, metalness: 0.1 }),
    strap: new THREE.MeshStandardMaterial({ color: '#4b5665', emissive: '#0e1319', roughness: 0.35, metalness: 0.75 }),
    led: new THREE.MeshBasicMaterial({ color: new THREE.Color('#22f0ff').multiplyScalar(1.6), toneMapped: false }),
    torch: new THREE.MeshStandardMaterial({ color: '#69737f', emissive: '#10151b', roughness: 0.38, metalness: 0.7 }),
    lens: new THREE.MeshBasicMaterial({ color: new THREE.Color('#e8fbff').multiplyScalar(1.2), toneMapped: false }),
  }), [])
}
type Mats = ReturnType<typeof useArmMats>

const GLOVE = '#232830'
const SKIN = '#c9987c'
// Fingerless gloves: the two outer bones of every finger (one for the thumb) are bare.
const BARE = /(phalanx-intermediate|phalanx-distal|-tip)$/
const isBare = (bone: string) => BARE.test(bone) && bone !== 'thumb-phalanx-proximal'

/** Colours each vertex glove or skin by how much it follows the bare finger bones. */
function paintGlove(mesh: THREE.SkinnedMesh) {
  const geo = mesh.geometry.clone()
  const bare = mesh.skeleton.bones.map((b) => isBare(b.name))
  const index = geo.getAttribute('skinIndex')
  const weight = geo.getAttribute('skinWeight')
  const glove = new THREE.Color(GLOVE)
  const skin = new THREE.Color(SKIN)
  const c = new THREE.Color()
  const colors = new Float32Array(index.count * 3)
  for (let v = 0; v < index.count; v++) {
    let w = 0
    for (let k = 0; k < 4; k++) if (bare[index.getComponent(v, k)]) w += weight.getComponent(v, k)
    c.copy(glove).lerp(skin, THREE.MathUtils.smoothstep(w, 0.4, 0.6)) // a crisp hem, not a gradient
    c.toArray(colors, v * 3)
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  mesh.geometry = geo
}

/** Loads one hand, works out which way it faces, and prepares its fingers for bending. */
function useHand(side: 1 | -1, mats: Mats) {
  const gltf = useGLTF(MODEL[side], false)
  return useMemo(() => {
    const scene = cloneSkinned(gltf.scene)
    const joint = (name: string) => scene.getObjectByName(name)!
    scene.traverse((o) => {
      const mesh = o as THREE.SkinnedMesh
      if (!mesh.isSkinnedMesh) return
      mesh.material = mats.hand
      paintGlove(mesh)
      mesh.frustumCulled = false // its bounds are those of the rest pose
    })

    // the model's own axes, read off its skeleton
    const wrist = joint('wrist').position.clone()
    const fingersDir = joint('middle-finger-phalanx-proximal').position.clone().sub(wrist).normalize()
    const thumbDir = joint('index-finger-metacarpal').position.clone().sub(joint('pinky-finger-metacarpal').position)
    thumbDir.addScaledVector(fingersDir, -thumbDir.dot(fingersDir)).normalize()
    const palmDir = side === 1 ? thumbDir.clone().cross(fingersDir) : fingersDir.clone().cross(thumbDir)

    const chain = (names: string[], towards: (dir: THREE.Vector3) => THREE.Vector3): Chain => {
      const bones = names.map(joint)
      const p = bones.map((b) => b.position.clone())
      const dir = p[p.length - 1].clone().sub(p[0]).normalize()
      return { bones, p, q: bones.map((b) => b.quaternion.clone()), axis: dir.clone().cross(towards(dir)).normalize() }
    }
    const rig: Rig = {
      fingers: FINGERS.map((f) => chain(FINGER_JOINTS.map((j) => `${f}-${j}`), () => palmDir)),
      // the thumb closes across the palm, towards the base of the index finger
      thumb: chain(THUMB_JOINTS, () => joint('index-finger-phalanx-proximal').position.clone().addScaledVector(palmDir, 0.035).sub(joint('thumb-phalanx-proximal').position).normalize()),
    }

    // from the model's axes to the hand frame described at the top
    const basis = new THREE.Matrix4().makeBasis(thumbDir.clone().multiplyScalar(-side), palmDir.clone().negate(), fingersDir.clone().negate())
    const rotation = new THREE.Quaternion().setFromRotationMatrix(basis).invert()
    const position = wrist.clone().applyQuaternion(rotation).multiplyScalar(-GLOVE_SCALE)
    return { scene, rig, rotation, position }
  }, [gltf, side, mats])
}

function Arm({ side, mats, hand }: { side: 1 | -1; mats: Mats; hand: ReturnType<typeof useHand> }) {
  return (
    <group>
      {/* sleeve: long enough that its far end is always off screen, even when reaching out to a crate */}
      <mesh material={mats.sleeve} position={[0, -0.004, 0.63]} rotation-x={Math.PI / 2} scale={[1.14, 1, 0.86]}>
        <cylinderGeometry args={[0.036, 0.064, 1.1, 18]} />
      </mesh>
      {/* jacket cuff, a little wider than the sleeve it ends */}
      <mesh material={mats.cuff} position={[0, -0.004, 0.105]} rotation-x={Math.PI / 2} scale={[1.14, 1, 0.86]}>
        <cylinderGeometry args={[0.0395, 0.041, 0.05, 18]} />
      </mesh>
      <mesh material={mats.led} position={[0.047 * side, 0.004, 0.24]} rotation-x={Math.PI / 2}>
        <boxGeometry args={[0.004, 0.14, 0.008]} />
      </mesh>
      {/* glove cuff with a strap */}
      <mesh material={mats.glove} position={[0, -0.004, 0.035]} rotation-x={Math.PI / 2} scale={[1.08, 1, 0.76]}>
        <cylinderGeometry args={[0.033, 0.037, 0.08, 18]} />
      </mesh>
      <mesh material={mats.strap} position={[0, -0.004, 0.05]} rotation-x={Math.PI / 2} scale={[1.08, 1, 0.76]}>
        <cylinderGeometry args={[0.0375, 0.0375, 0.012, 18]} />
      </mesh>
      <group position={hand.position} quaternion={hand.rotation} scale={GLOVE_SCALE}>
        <primitive object={hand.scene} />
      </group>
    </group>
  )
}

type V3 = [number, number, number]
/**
 * How the right hand holds each kind of item. Carried items always face the player the same way, so a
 * grip can name an exact place on the item, in camera space and metres:
 * `wrist` is where the wrist goes relative to the item's centre, `elbow` where the forearm comes from
 * relative to the wrist, `palm` the way the palm faces. Without `wrist` the hand simply closes over the
 * item from its near upper side, `reach` from its centre.
 */
interface Grip {
  curl: number
  thumb: number
  reach: number
  wrist?: V3
  elbow?: V3
  palm?: V3
}
const over = (reach: number, curl: number, thumb = 0.9): Grip => ({ reach, curl, thumb })
const DEFAULT_GRIP = over(0.1, 0.6)
// round the near side of something tall, fingers running across it
const AROUND = { elbow: [0.6, -0.24, 0.03] as V3, palm: [0, 0, -1] as V3, reach: 0 }
// an open hand on the face turned to the player, the arm coming up from below
const AGAINST = { elbow: [0.25, -0.6, 0.12] as V3, palm: [0, 0, -1] as V3, reach: 0, curl: 0.1, thumb: 0.15 }
const GRIPS: Partial<Record<ItemKind, Grip>> = {
  can: over(0.04, 0.75),
  pipe: over(0.08, 0.6),
  helmet: over(0.16, 0.25, 0.4),
  pixel: over(0.24, 0.2, 0.3),
  hose: over(0.2, 0.25, 0.4),
  cell: { ...AROUND, wrist: [0.1, -0.07, 0.135], curl: 0.4, thumb: 0.5 },
  bottle: { ...AROUND, wrist: [0.055, -0.03, 0.085], curl: 0.7, thumb: 0.8 },
  cone: { ...AROUND, wrist: [0.07, 0.1, 0.1], curl: 0.5, thumb: 0.6 },
  // held by its lower right corner, so the picture stays in view
  tile: { wrist: [0.25, -0.35, 0.08], elbow: [0.3, -0.5, 0.05], palm: [0, 0, -1], reach: 0, curl: 0.15, thumb: 0.3 },
  crate: { ...AGAINST, wrist: [0.16, -0.04, 0.42] },
  gas: { ...AROUND, wrist: [0.12, -0.02, 0.155], curl: 0.36, thumb: 0.5 },
  rat: over(0.05, 0.85),
  doll: { ...AROUND, wrist: [0.06, -0.1, 0.1], curl: 0.75, thumb: 0.8 },
  skull: over(0.12, 0.4, 0.5),
  book: over(0.05, 0.5, 0.7),
  mask: over(0.14, 0.35, 0.5),
  jar: { ...AROUND, wrist: [0.07, -0.02, 0.1], curl: 0.6, thumb: 0.7 },
  chair: { ...AGAINST, wrist: [0.12, 0.05, 0.28] },
  charge: { ...AGAINST, wrist: [0.18, 0, 0.23] },
}

const _x = new THREE.Vector3()
const _y = new THREE.Vector3()
const _z = new THREE.Vector3()
const _m = new THREE.Matrix4()

/** Turns the hand so the forearm runs along `forearm` and the back of the hand faces `back` as nearly as it can. */
function orient(q: THREE.Quaternion, forearm: THREE.Vector3, back: THREE.Vector3) {
  _z.copy(forearm).negate()
  _y.copy(back).addScaledVector(_z, -back.dot(_z)).normalize()
  _x.crossVectors(_y, _z)
  q.setFromRotationMatrix(_m.makeBasis(_x, _y, _z))
}

/** Mounted inside the game canvas. Shows nothing until the two hand models have loaded. */
export function Hands() {
  return (
    <Suspense fallback={null}>
      <HandsInner />
    </Suspense>
  )
}

function HandsInner() {
  const root = useRef<THREE.Group>(null)
  const rightView = useRef<THREE.Group>(null)
  const right = useRef<THREE.Group>(null)
  const left = useRef<THREE.Group>(null)
  const { camera } = useThree()
  const mats = useArmMats()
  const rightHand = useHand(1, mats)
  const leftHand = useHand(-1, mats)
  const st = useRef({ last: new THREE.Vector3(), sway: 0, speed: 0, grip: 0, reach: 0 })
  const v = useMemo(() => ({
    wrist: new THREE.Vector3(), palm: new THREE.Vector3(), forearm: new THREE.Vector3(), back: new THREE.Vector3(),
    holdWrist: new THREE.Vector3(0.3, -0.3, -0.6), holdPalm: new THREE.Vector3(-0.8, 0.6, 0),
    q: new THREE.Quaternion(), elbow: new THREE.Vector3(), holdElbow: ELBOW_CARRY.clone(),
  }), [])

  useFrame(({ clock }, dt) => {
    const g = root.current
    if (!g || !right.current || !left.current || !rightView.current) return
    g.position.copy(camera.position)
    g.quaternion.copy(camera.quaternion)
    const s = st.current
    const speed = camera.position.distanceTo(s.last) / Math.max(dt, 1e-3)
    s.last.copy(camera.position)
    s.speed += (Math.min(speed, 6) - s.speed) * Math.min(1, dt * 8)
    s.sway += dt * (2 + s.speed * 1.6)
    const bobX = Math.sin(s.sway) * 0.012 * Math.min(1, s.speed / 3)
    const bobY = Math.abs(Math.cos(s.sway)) * 0.014 * Math.min(1, s.speed / 3)
    const breathe = Math.sin(clock.elapsedTime * 1.4) * 0.004
    const shock = performance.now() < live.shockUntil ? (Math.random() - 0.5) * 0.03 : 0

    // ---- right hand: relaxed → reaching → gripping the carried item
    // an item that was just grabbed flies in from up to a few metres away; the hand closes on it once it is near
    const carrying = !!hold.id && hold.view.length() < 1.7
    const reaching = performance.now() < handState.reachUntil
    s.grip += ((carrying ? 1 : 0) - s.grip) * Math.min(1, dt * 12)
    s.reach += ((reaching ? 1 : 0) - s.reach) * Math.min(1, dt * (reaching ? 18 : 6))

    const grip = (hold.kind && GRIPS[hold.kind]) || DEFAULT_GRIP
    if (carrying && grip.wrist) {
      // a fixed grip: the hand goes to a set place on the item, which always faces the player the same way
      v.holdWrist.copy(hold.view).add(v.back.set(...grip.wrist))
      v.holdElbow.copy(v.holdWrist).add(v.back.set(...grip.elbow!))
      v.holdPalm.set(...grip.palm!)
    } else if (carrying) {
      // small things: the hand takes the item from its near upper side, so the back of the hand faces the
      // eye and the fingers drape over the item
      v.holdElbow.copy(ELBOW_CARRY)
      v.forearm.copy(hold.view).sub(ELBOW_CARRY).normalize()
      v.holdPalm.set(-0.15, -0.7, -0.7)
      v.holdPalm.addScaledVector(v.forearm, -v.holdPalm.dot(v.forearm)).normalize()
      v.holdWrist.copy(hold.view).addScaledVector(v.forearm, -0.075).addScaledVector(v.holdPalm, -(grip.reach + 0.02))
    }
    v.wrist.set(0.27 + bobX + shock - s.reach * 0.12, -0.27 - bobY + breathe + s.reach * 0.08, -0.45 - s.reach * 0.2).lerp(v.holdWrist, s.grip)
    v.palm.set(0.12 + s.reach * 0.1, -1, 0.12).normalize().lerp(v.holdPalm, s.grip)
    v.elbow.copy(ELBOW_R).lerp(v.holdElbow, s.grip)
    orient(v.q, v.forearm.copy(v.wrist).sub(v.elbow).normalize(), v.back.copy(v.palm).negate())
    right.current.position.copy(v.wrist)
    right.current.quaternion.copy(v.q)
    rightView.current.scale.setScalar(carrying ? 1 : VIEW_SCALE)
    setCurl(rightHand.rig, THREE.MathUtils.lerp(0.42, grip.curl, s.grip) * (1 - 0.8 * s.reach), THREE.MathUtils.lerp(0.35, grip.thumb, s.grip))

    // ---- left hand: a fist around the flashlight, which points where the player looks
    const flashOn = useUi.getState().flash
    v.wrist.set(-0.27 - bobX + shock, -0.28 - bobY + breathe + (flashOn ? 0 : -0.12), -0.45)
    v.forearm.copy(v.wrist).sub(ELBOW_L).normalize()
    // the flashlight lies across the palm, lens on the thumb side; aiming it forward fixes the roll of the fist
    v.back.set(0.06, 0.04, -1).cross(v.forearm)
    orient(v.q, v.forearm, v.back)
    left.current.position.copy(v.wrist)
    left.current.quaternion.copy(v.q)
    setCurl(leftHand.rig, 1.32, 1.0)
  })

  return (
    <group ref={root}>
      <group ref={rightView} scale={VIEW_SCALE}>
        <group ref={right}>
          <Arm side={1} mats={mats} hand={rightHand} />
        </group>
      </group>
      <group scale={VIEW_SCALE}>
        <group ref={left}>
          <Arm side={-1} mats={mats} hand={leftHand} />
          {/* flashlight, gripped across the palm */}
          <group position={[0.02, -0.036, -0.082]} rotation-z={-Math.PI / 2}>
            <mesh material={mats.torch}>
              <cylinderGeometry args={[0.021, 0.018, 0.17, 14]} />
            </mesh>
            <mesh material={mats.torch} position-y={0.095}>
              <cylinderGeometry args={[0.027, 0.021, 0.03, 14]} />
            </mesh>
            <mesh material={mats.lens} position-y={0.1105} rotation-x={-Math.PI / 2}>
              <circleGeometry args={[0.024, 18]} />
            </mesh>
            {/* tail cap with a glowing switch: the end the player actually sees */}
            <mesh material={mats.strap} position-y={-0.09}>
              <cylinderGeometry args={[0.019, 0.02, 0.014, 14]} />
            </mesh>
            <mesh material={mats.led} position-y={-0.098} rotation-x={Math.PI / 2}>
              <circleGeometry args={[0.007, 12]} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  )
}

useGLTF.preload(MODEL[1], false)
useGLTF.preload(MODEL[-1], false)
