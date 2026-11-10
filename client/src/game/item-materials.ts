import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// Materials, label textures and geometry for the things players carry. Everything here is built once,
// on first use, and shared by every item of a kind: static parts with the same material are merged
// into a single geometry, so a prop is a handful of draw calls however detailed it looks.

// ---------- textures ----------
function canvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!] as const
}

function rand(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}

function finish(c: HTMLCanvasElement, repeat: [number, number] = [1, 1]) {
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(...repeat)
  t.anisotropy = 8
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

const DISPLAY = '800 {s}px Unbounded, system-ui, sans-serif'
const MONO = '700 {s}px "JetBrains Mono", ui-monospace, monospace'
const font = (f: string, s: number) => f.replace('{s}', String(s))

/** Worn paint or plastic: a flat colour with smudges, a few light scratches and darker lower edge. */
function scuffTexture(base: string, seed: number, wear = 1) {
  const [c, g] = canvas(256, 256)
  const r = rand(seed)
  g.fillStyle = base
  g.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 90 * wear; i++) {
    g.fillStyle = `rgba(0,0,0,${r() * 0.07})`
    g.beginPath()
    g.arc(r() * 256, r() * 256, 3 + r() * 26, 0, Math.PI * 2)
    g.fill()
  }
  for (let i = 0; i < 40 * wear; i++) {
    g.strokeStyle = r() < 0.6 ? `rgba(255,255,255,${0.05 + r() * 0.12})` : `rgba(0,0,0,${0.1 + r() * 0.2})`
    g.lineWidth = 0.5 + r() * 1.2
    const x = r() * 256
    const y = r() * 256
    const a = r() * Math.PI * 2
    const l = 4 + r() * 30
    g.beginPath()
    g.moveTo(x, y)
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l)
    g.stroke()
  }
  const grd = g.createLinearGradient(0, 256, 0, 150)
  grd.addColorStop(0, `rgba(0,0,0,${0.3 * wear})`)
  grd.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grd
  g.fillRect(0, 150, 256, 106)
  return finish(c)
}

/** One face of the crate: five planks with grain, nail heads and a stencil in the upper left. */
function plankTexture() {
  const [c, g] = canvas(512, 512)
  const r = rand(41)
  g.fillStyle = '#17100b'
  g.fillRect(0, 0, 512, 512)
  const n = 5
  const ph = 512 / n
  for (let i = 0; i < n; i++) {
    const l = 0.82 + r() * 0.32
    const col = new THREE.Color('#6b4a30').multiplyScalar(l)
    g.fillStyle = `#${col.getHexString()}`
    g.fillRect(0, i * ph + 3, 512, ph - 6)
    for (let k = 0; k < 46; k++) {
      g.strokeStyle = r() < 0.5 ? `rgba(20,10,4,${0.1 + r() * 0.25})` : `rgba(255,220,170,${0.03 + r() * 0.07})`
      g.lineWidth = 0.6 + r() * 1.4
      const y = i * ph + 6 + r() * (ph - 12)
      const x = r() * 512
      const len = 60 + r() * 260
      g.beginPath()
      g.moveTo(x, y)
      g.bezierCurveTo(x + len * 0.3, y + (r() - 0.5) * 7, x + len * 0.7, y + (r() - 0.5) * 7, x + len, y + (r() - 0.5) * 4)
      g.stroke()
    }
    if (r() < 0.7) {
      // a knot
      const x = 80 + r() * 350
      const y = i * ph + ph * (0.3 + r() * 0.4)
      for (let k = 4; k > 0; k--) {
        g.strokeStyle = `rgba(25,12,5,${0.18 + k * 0.06})`
        g.lineWidth = 1.5
        g.beginPath()
        g.ellipse(x, y, k * 5, k * 2.6, 0, 0, Math.PI * 2)
        g.stroke()
      }
    }
    for (const x of [58, 454]) {
      for (const dy of [0.3, 0.7]) {
        g.fillStyle = '#1b1d20'
        g.beginPath()
        g.arc(x, i * ph + ph * dy, 3.4, 0, Math.PI * 2)
        g.fill()
        g.fillStyle = 'rgba(255,255,255,0.25)'
        g.fillRect(x - 1.5, i * ph + ph * dy - 2, 2, 1.4)
      }
    }
  }
  // stencilled paint, deliberately patchy
  g.save()
  g.globalAlpha = 0.78
  g.fillStyle = '#e6ff3a'
  g.textBaseline = 'middle'
  g.font = font(DISPLAY, 40)
  g.fillText('НЕОН-17', 78, 78)
  g.font = font(MONO, 22)
  g.fillStyle = '#d8d2c0'
  g.fillText('ДЕПО · ГРУЗ 08', 80, 122)
  g.globalCompositeOperation = 'destination-out'
  for (let i = 0; i < 260; i++) {
    g.globalAlpha = r() * 0.5
    g.fillRect(70 + r() * 290, 50 + r() * 90, 1 + r() * 9, 1 + r() * 2)
  }
  g.restore()
  // grime towards the bottom
  const grd = g.createLinearGradient(0, 512, 0, 300)
  grd.addColorStop(0, 'rgba(0,0,0,0.5)')
  grd.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grd
  g.fillRect(0, 300, 512, 212)
  return finish(c)
}

/** Label that wraps the «Неон-кола» can: the name appears twice around it. */
function canTexture() {
  const [c, g] = canvas(512, 214)
  g.scale(1, 214 / 160) // drawn on a 512 x 160 layout, stretched to the can's real proportions
  const grd = g.createLinearGradient(0, 0, 0, 160)
  grd.addColorStop(0, '#ff5aa2')
  grd.addColorStop(0.55, '#ff2e88')
  grd.addColorStop(1, '#a3124f')
  g.fillStyle = grd
  g.fillRect(0, 0, 512, 160)
  g.fillStyle = '#0a0d12'
  g.fillRect(0, 0, 512, 12)
  g.fillRect(0, 146, 512, 14)
  g.fillStyle = '#22f0ff'
  g.fillRect(0, 12, 512, 5)
  g.fillRect(0, 141, 512, 5)
  for (let i = 0; i < 2; i++) {
    const x = i * 256
    // lightning bolt
    g.fillStyle = '#22f0ff'
    g.beginPath()
    g.moveTo(x + 214, 28)
    g.lineTo(x + 190, 84)
    g.lineTo(x + 208, 84)
    g.lineTo(x + 196, 132)
    g.lineTo(x + 236, 70)
    g.lineTo(x + 216, 70)
    g.lineTo(x + 232, 28)
    g.fill()
    g.fillStyle = '#ffffff'
    g.textBaseline = 'middle'
    g.font = font(DISPLAY, 44)
    g.fillText('НЕОН', x + 18, 62)
    g.fillStyle = '#0a0d12'
    g.font = font(DISPLAY, 30)
    g.fillText('КОЛА', x + 20, 106)
    g.fillStyle = 'rgba(255,255,255,0.85)'
    g.font = font(MONO, 11)
    g.fillText('0,33 Л · ЗАРЯД ВКУСА', x + 20, 130)
  }
  return finish(c)
}

/** Paper label of the bottle. */
function bottleTexture() {
  const [c, g] = canvas(512, 128)
  const r = rand(77)
  g.fillStyle = '#d9cfb4'
  g.fillRect(0, 0, 512, 128)
  for (let i = 0; i < 60; i++) {
    g.fillStyle = `rgba(90,60,20,${r() * 0.08})`
    g.beginPath()
    g.arc(r() * 512, r() * 128, 3 + r() * 20, 0, Math.PI * 2)
    g.fill()
  }
  g.strokeStyle = '#b3541a'
  g.lineWidth = 4
  g.strokeRect(8, 8, 496, 112)
  for (let i = 0; i < 2; i++) {
    const x = i * 256
    g.fillStyle = '#b3541a'
    g.beginPath()
    g.arc(x + 44, 64, 24, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#d9cfb4'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.font = font(DISPLAY, 24)
    g.fillText('17', x + 44, 66)
    g.textAlign = 'left'
    g.fillStyle = '#1b1712'
    g.font = font(DISPLAY, 30)
    g.fillText('ТОННЕЛЬ', x + 78, 52)
    g.fillStyle = '#5b4a36'
    g.font = font(MONO, 15)
    g.fillText('ТЁМНОЕ · 0,5 Л', x + 80, 88)
  }
  return finish(c)
}

/** Diagonal warning stripes. */
function stripeTexture(repeat: [number, number]) {
  const [c, g] = canvas(64, 64)
  g.fillStyle = '#e6ff3a'
  g.fillRect(0, 0, 64, 64)
  g.fillStyle = '#0b0c0e'
  for (let x = -64; x < 128; x += 32) {
    g.beginPath()
    g.moveTo(x, 64)
    g.lineTo(x + 64, 0)
    g.lineTo(x + 80, 0)
    g.lineTo(x + 16, 64)
    g.fill()
  }
  const r = rand(9)
  for (let i = 0; i < 26; i++) {
    g.fillStyle = `rgba(0,0,0,${r() * 0.14})`
    g.beginPath()
    g.arc(r() * 64, r() * 64, 1 + r() * 7, 0, Math.PI * 2)
    g.fill()
  }
  return finish(c, repeat)
}

/** Data plate on the front of the demolition charge. */
function chargePlateTexture() {
  const [c, g] = canvas(512, 112)
  g.fillStyle = '#0b0d10'
  g.fillRect(0, 0, 512, 112)
  g.strokeStyle = '#ff9a1f'
  g.lineWidth = 4
  g.strokeRect(5, 5, 502, 102)
  // warning triangle
  g.fillStyle = '#ff9a1f'
  g.beginPath()
  g.moveTo(58, 20)
  g.lineTo(100, 92)
  g.lineTo(16, 92)
  g.fill()
  g.fillStyle = '#0b0d10'
  g.fillRect(54, 42, 8, 28)
  g.fillRect(54, 76, 8, 8)
  g.fillStyle = '#ff9a1f'
  g.textBaseline = 'middle'
  g.font = font(DISPLAY, 40)
  g.fillText('ЗАРЯД ПЗ-17', 122, 42)
  g.fillStyle = '#c9d1da'
  g.font = font(MONO, 20)
  g.fillText('ВЗРЫВООПАСНО · 25 КГ', 124, 84)
  return finish(c)
}

/** The little amber readout on the detonator. */
function timerTexture() {
  const [c, g] = canvas(128, 48)
  g.fillStyle = '#120800'
  g.fillRect(0, 0, 128, 48)
  g.fillStyle = '#ffb347'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = font(MONO, 34)
  g.fillText('00:17', 64, 26)
  return finish(c)
}

/** Woven jacket of the fire hose. */
function weaveTexture() {
  const [c, g] = canvas(64, 64)
  g.fillStyle = '#d9541a'
  g.fillRect(0, 0, 64, 64)
  for (let i = -64; i < 128; i += 8) {
    g.strokeStyle = 'rgba(60,14,0,0.45)'
    g.lineWidth = 2
    g.beginPath()
    g.moveTo(i, 0)
    g.lineTo(i + 64, 64)
    g.stroke()
    g.strokeStyle = 'rgba(255,190,130,0.22)'
    g.beginPath()
    g.moveTo(i + 64, 0)
    g.lineTo(i, 64)
    g.stroke()
  }
  // a darker seam where the flat hose folds
  g.fillStyle = 'rgba(40,10,0,0.35)'
  g.fillRect(0, 28, 64, 5)
  return finish(c, [36, 2])
}

// ---------- materials ----------
const glow = (hex: string, k: number) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k), toneMapped: false })

function buildMats() {
  const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(o)
  const can = canTexture()
  const timer = timerTexture()
  return {
    // metals are kept well below full metalness: the station has no environment map, so a pure
    // metal would go black wherever a lamp does not hit it directly
    steel: std({ color: '#9aa3ad', roughness: 0.36, metalness: 0.6 }),
    darkSteel: std({ color: '#2c323a', roughness: 0.5, metalness: 0.5 }),
    brass: std({ color: '#c79a3c', roughness: 0.32, metalness: 0.6 }),
    alu: std({ color: '#cfd6dd', roughness: 0.28, metalness: 0.55 }),
    rubber: std({ color: '#0c0d10', roughness: 0.92 }),
    gloss: std({ color: '#05070a', roughness: 0.12, metalness: 0.2 }),
    // energy cell
    cellGlass: new THREE.MeshPhysicalMaterial({ color: '#aaf6ff', transparent: true, opacity: 0.2, roughness: 0.02, clearcoat: 1, depthWrite: false }),
    acidPaint: std({ color: '#d8f032', roughness: 0.55 }),
    // demolition charge
    chargeShell: std({ map: scuffTexture('#3b4640', 12, 1.3), roughness: 0.62, metalness: 0.25 }),
    stripes: std({ map: stripeTexture([1, 4]), roughness: 0.6 }),
    chargePlate: std({ map: chargePlateTexture(), roughness: 0.5, metalness: 0.2 }),
    timer: new THREE.MeshBasicMaterial({ map: timer, color: new THREE.Color(1.7, 1.7, 1.7), toneMapped: false }),
    wire: std({ color: '#ff2e88', emissive: '#ff2e88', emissiveIntensity: 0.35, roughness: 0.45 }),
    // crate
    planks: std({ map: plankTexture(), roughness: 0.86 }),
    beam: std({ color: '#4a3220', roughness: 0.9 }),
    // can
    canLabel: std({ map: can, emissiveMap: can, emissive: '#ffffff', emissiveIntensity: 0.3, roughness: 0.3, metalness: 0.45 }),
    // cone
    coneOrange: std({ map: scuffTexture('#ff5a14', 5, 1.2), roughness: 0.58 }),
    reflective: std({ color: '#eef2f4', emissive: '#dfe9ee', emissiveIntensity: 0.22, roughness: 0.3 }),
    // bottle
    bottleGlass: new THREE.MeshPhysicalMaterial({ color: '#1f8a5c', transparent: true, opacity: 0.62, roughness: 0.06, clearcoat: 1, depthWrite: false }),
    drink: std({ color: '#0d3a22', emissive: '#7dff5a', emissiveIntensity: 0.12, roughness: 0.3 }),
    bottleLabel: std({ map: bottleTexture(), roughness: 0.8 }),
    capAmber: std({ color: '#ff9a1f', roughness: 0.35, metalness: 0.5 }),
    // chair
    seat: std({ map: scuffTexture('#c9c2ad', 19, 1), roughness: 0.5 }),
    // robot cat
    shell: std({ map: scuffTexture('#e3e7eb', 27, 0.45), roughness: 0.32, metalness: 0.08 }),
    collar: std({ color: '#ff2e88', emissive: '#ff2e88', emissiveIntensity: 0.5, roughness: 0.4 }),
    // helmet
    helmet: std({ map: scuffTexture('#e6ff3a', 33, 0.9), roughness: 0.42 }),
    // pipe
    amberPaint: std({ color: '#ff9a1f', roughness: 0.6, metalness: 0.1 }),
    // mosaic tile
    bronze: std({ color: '#7a5a34', roughness: 0.4, metalness: 0.6 }),
    // hose
    weave: std({ map: weaveTexture(), roughness: 0.85 }),
    // small lit accents: steady, unlike the station neon in materials.ts that flickers with the power
    glowCyan: glow('#22f0ff', 2.4),
    glowPink: glow('#ff2e88', 2.2),
    glowAcid: glow('#e6ff3a', 1.8),
    glowAmber: glow('#ff9a1f', 2.2),
    glowLamp: glow('#ffd9a0', 2.2),
  }
}

let mats: ReturnType<typeof buildMats> | null = null
export function getItemMats() {
  if (!mats) mats = buildMats()
  return mats
}

// ---------- geometry ----------
type V3 = [number, number, number]
const H = Math.PI / 2
const m4 = new THREE.Matrix4()
const eul = new THREE.Euler()

function place<T extends THREE.BufferGeometry>(g: T, p?: V3, r?: V3) {
  if (r) g.applyMatrix4(m4.makeRotationFromEuler(eul.set(r[0], r[1], r[2])))
  if (p) g.translate(p[0], p[1], p[2])
  return g
}
const box = (w: number, h: number, d: number, p?: V3, r?: V3) => place(new THREE.BoxGeometry(w, h, d), p, r)
const rbox = (w: number, h: number, d: number, rad: number, p?: V3, r?: V3) => place(new RoundedBoxGeometry(w, h, d, 2, rad), p, r)
const cyl = (rt: number, rb: number, h: number, seg: number, p?: V3, r?: V3, open = false) =>
  place(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), p, r)
const torus = (R: number, t: number, rs: number, ts: number, arc: number, p?: V3, r?: V3) =>
  place(new THREE.TorusGeometry(R, t, rs, ts, arc), p, r)

/** Several parts as one geometry (one draw call). */
function merge(...parts: THREE.BufferGeometry[]) {
  const flat = parts.map((g) => (g.index ? g.toNonIndexed() : g))
  const out = mergeGeometries(flat, false)
  for (const g of parts) g.dispose()
  for (const g of flat) g.dispose()
  return out
}
/** The same part repeated around the Y axis. */
const ring = (n: number, make: (a: number, i: number) => THREE.BufferGeometry) => Array.from({ length: n }, (_, i) => make((i / n) * Math.PI * 2, i))

function buildGeo() {
  // --- energy cell: 0.4 tall, r 0.09, axis Y
  const cell = {
    core: cyl(0.06, 0.06, 0.29, 14),
    glass: cyl(0.079, 0.079, 0.28, 18, undefined, undefined, true),
    frame: merge(
      cyl(0.089, 0.089, 0.045, 18, [0, 0.1625, 0]),
      cyl(0.089, 0.089, 0.045, 18, [0, -0.1625, 0]),
      cyl(0.066, 0.089, 0.011, 18, [0, 0.1905, 0]),
      cyl(0.089, 0.066, 0.011, 18, [0, -0.1905, 0]),
      ...ring(3, (a) => box(0.016, 0.285, 0.022, [Math.sin(a) * 0.083, 0, Math.cos(a) * 0.083], [0, a, 0])),
      // grip notches on both caps
      ...ring(9, (a) => box(0.012, 0.03, 0.006, [Math.sin(a + 0.35) * 0.089, 0.165, Math.cos(a + 0.35) * 0.089], [0, a + 0.35, 0])),
      ...ring(9, (a) => box(0.012, 0.03, 0.006, [Math.sin(a + 0.35) * 0.089, -0.165, Math.cos(a + 0.35) * 0.089], [0, a + 0.35, 0])),
    ),
    terminals: merge(cyl(0.034, 0.034, 0.005, 14, [0, 0.1975, 0]), cyl(0.022, 0.022, 0.005, 14, [0, -0.1975, 0]),
      cyl(0.072, 0.072, 0.006, 14, [0, 0.139, 0]), cyl(0.072, 0.072, 0.006, 14, [0, -0.139, 0])),
    paint: cyl(0.0895, 0.0895, 0.008, 18, [0, 0.178, 0], undefined, true),
  }

  // --- demolition charge: 0.6 x 0.4 x 0.4, front is +Z
  const charge = {
    body: rbox(0.56, 0.27, 0.36, 0.03, [0, -0.06, 0]),
    bands: merge(box(0.06, 0.276, 0.366, [-0.2, -0.06, 0]), box(0.06, 0.276, 0.366, [0.2, -0.06, 0])),
    panel: rbox(0.3, 0.17, 0.014, 0.006, [0, -0.06, 0.18]),
    sticks: merge(
      ...[-0.095, 0, 0.095].flatMap((x) => [
        cyl(0.037, 0.037, 0.012, 14, [x, -0.095, 0.189], [H, 0, 0]),
        cyl(0.024, 0.03, 0.006, 14, [x, -0.095, 0.196], [H, 0, 0]),
      ]),
    ),
    plate: place(new THREE.PlaneGeometry(0.27, 0.058), [0, -0.012, 0.1875]),
    rubber: merge(
      rbox(0.2, 0.05, 0.16, 0.012, [0.13, 0.1, 0.02]),
      box(0.026, 0.085, 0.03, [-0.24, 0.115, -0.13]),
      box(0.026, 0.085, 0.03, [0.06, 0.115, -0.13]),
      cyl(0.016, 0.016, 0.3, 8, [-0.09, 0.17, -0.13], [0, 0, H]),
      cyl(0.021, 0.021, 0.17, 10, [-0.09, 0.17, -0.13], [0, 0, H]),
      cyl(0.005, 0.006, 0.06, 6, [0.205, 0.153, -0.04]),
    ),
    display: place(new THREE.PlaneGeometry(0.085, 0.032), [0.105, 0.1256, 0.035], [-H, 0, 0]),
    led: place(new THREE.SphereGeometry(0.013, 10, 8), [0.19, 0.128, 0.035]),
    wire: merge(
      torus(0.045, 0.006, 6, 12, Math.PI, [0.09, 0.075, 0.137], [0, H, 0]),
      cyl(0.006, 0.006, 0.05, 6, [0.09, 0.052, 0.186]),
    ),
    bolts: merge(
      ...[-0.2, 0.2].flatMap((x) => [-0.17, 0.05].map((y) => cyl(0.013, 0.013, 0.008, 6, [x, y, 0.185], [H, 0, 0]))),
      ...[-0.2, 0.2].flatMap((x) => [-0.17, 0.05].map((y) => cyl(0.013, 0.013, 0.008, 6, [x, y, -0.185], [H, 0, 0]))),
      cyl(0.008, 0.008, 0.02, 6, [0.09, 0.03, 0.186]),
    ),
  }

  // --- crate: 0.8 cube
  const E = 0.36 // beam centre
  const crate = {
    panels: box(0.74, 0.74, 0.74),
    beams: merge(
      ...[-E, E].flatMap((a) => [-E, E].flatMap((b) => [
        box(0.79, 0.07, 0.07, [0, a, b]),
        box(0.07, 0.65, 0.07, [a, 0, b]),
        box(0.07, 0.07, 0.65, [a, b, 0]),
      ])),
      box(0.86, 0.06, 0.02, [0, 0, 0.379], [0, 0, Math.PI / 4]),
      box(0.86, 0.06, 0.02, [0, 0, -0.379], [0, 0, -Math.PI / 4]),
      box(0.02, 0.06, 0.86, [0.379, 0, 0], [Math.PI / 4, 0, 0]),
      box(0.02, 0.06, 0.86, [-0.379, 0, 0], [-Math.PI / 4, 0, 0]),
    ),
    corners: merge(
      ...[-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => rbox(0.11, 0.11, 0.11, 0.012, [x * 0.345, y * 0.345, z * 0.345])))),
    ),
    tags: merge(box(0.13, 0.035, 0.006, [0.17, -0.22, 0.372]), box(0.13, 0.035, 0.006, [-0.17, -0.22, -0.372])),
  }

  // --- can: 0.14 tall, r 0.04
  const can = {
    label: cyl(0.038, 0.038, 0.1, 18, undefined, undefined, true),
    alu: merge(
      cyl(0.031, 0.038, 0.013, 18, [0, 0.0565, 0]),
      cyl(0.0325, 0.031, 0.006, 18, [0, 0.066, 0]),
      cyl(0.038, 0.03, 0.013, 18, [0, -0.0565, 0]),
      cyl(0.03, 0.027, 0.006, 18, [0, -0.066, 0]),
      // ring pull
      box(0.013, 0.0016, 0.024, [0, 0.0696, 0.004]),
      cyl(0.006, 0.006, 0.002, 8, [0, 0.0698, -0.004]),
    ),
  }

  // --- traffic cone: 0.6 tall, r 0.16
  const cone = {
    base: merge(cyl(0.158, 0.158, 0.02, 8, [0, -0.29, 0], [0, Math.PI / 8, 0]), cyl(0.012, 0.012, 0.012, 8, [0, 0.293, 0])),
    body: merge(
      cyl(0.022, 0.115, 0.565, 20, [0, 0.0075, 0]),
      cyl(0.118, 0.134, 0.012, 20, [0, -0.275, 0]),
      cyl(0.017, 0.024, 0.008, 12, [0, 0.293, 0], undefined, true),
    ),
    bands: merge(
      cyl(0.0633, 0.0798, 0.1, 20, [0, 0, 0], undefined, true),
      cyl(0.04, 0.0499, 0.06, 20, [0, 0.16, 0], undefined, true),
    ),
  }

  // --- bottle: 0.3 tall, r 0.05
  const profile: [number, number][] = [
    [0, -0.146], [0.03, -0.15], [0.039, -0.148], [0.042, -0.14], [0.042, -0.012], [0.04, 0.006], [0.031, 0.03],
    [0.02, 0.052], [0.016, 0.068], [0.0155, 0.118], [0.0195, 0.121], [0.0195, 0.13], [0.015, 0.133],
  ]
  const bottle = {
    glass: new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), 16),
    drink: merge(cyl(0.036, 0.036, 0.1, 12, [0, -0.092, 0])),
    label: cyl(0.0426, 0.0426, 0.07, 16, [0, -0.08, 0], undefined, true),
    cap: merge(cyl(0.019, 0.021, 0.013, 12, [0, 0.139, 0]), cyl(0.0165, 0.0165, 0.02, 12, [0, 0.108, 0], undefined, true)),
  }

  // --- chair: 0.5 x 0.9 x 0.5, back towards -Z, floor at -0.45
  const tube = 0.013
  const chair = {
    frame: merge(
      ...[-0.2, 0.2].flatMap((x) => [
        cyl(tube, tube, 0.43, 8, [x, -0.225, 0.2]),
        cyl(tube, tube, 0.87, 8, [x, -0.005, -0.215]),
        cyl(tube, tube, 0.415, 8, [x, -0.026, -0.0075], [H, 0, 0]),
        cyl(tube * 0.8, tube * 0.8, 0.415, 8, [x, -0.3, -0.0075], [H, 0, 0]),
      ]),
      cyl(tube, tube, 0.4, 8, [0, -0.026, 0.2], [0, 0, H]),
      cyl(tube, tube, 0.4, 8, [0, -0.026, -0.215], [0, 0, H]),
      cyl(tube * 0.8, tube * 0.8, 0.4, 8, [0, -0.22, -0.215], [0, 0, H]),
      cyl(tube, tube, 0.426, 8, [0, 0.43, -0.215], [0, 0, H]),
    ),
    feet: merge(...[-0.2, 0.2].flatMap((x) => [0.2, -0.215].map((z) => cyl(0.017, 0.019, 0.022, 8, [x, -0.439, z])))),
    shell: merge(rbox(0.46, 0.03, 0.44, 0.013, [0, 0, 0]), rbox(0.44, 0.2, 0.026, 0.012, [0, 0.3, -0.19])),
    bolts: merge(
      ...[-0.17, 0.17].flatMap((x) => [0.25, 0.35].map((y) => cyl(0.011, 0.011, 0.006, 6, [x, y, -0.176], [H, 0, 0]))),
      ...[-0.17, 0.17].flatMap((x) => [-0.16, 0.16].map((z) => cyl(0.011, 0.011, 0.005, 6, [x, 0.016, z]))),
    ),
    tag: box(0.1, 0.012, 0.003, [0, 0.375, -0.1765]),
  }

  // --- robot cat: 0.44 x 0.34 x 0.24, nose towards +X
  const pixel = {
    shell: merge(
      rbox(0.25, 0.14, 0.16, 0.04, [-0.05, -0.02, 0]),
      rbox(0.15, 0.13, 0.17, 0.04, [0.13, 0.055, 0]),
      ...[-0.05, 0.05].map((z) => place(new THREE.ConeGeometry(0.036, 0.058, 4), [0.125, 0.14, z], [0, Math.PI / 4, 0])),
      ...[-0.13, 0.03].flatMap((x) => [-0.05, 0.05].map((z) => cyl(0.026, 0.029, 0.022, 10, [x + 0.008, -0.159, z]))),
    ),
    dark: merge(
      ...[-0.13, 0.03].flatMap((x) => [-0.05, 0.05].map((z) => cyl(0.02, 0.02, 0.07, 8, [x, -0.12, z]))),
      rbox(0.1, 0.008, 0.08, 0.003, [-0.06, 0.051, 0]),
      cyl(0.009, 0.012, 0.13, 6, [-0.186, 0.085, 0], [0, 0, 0.3]),
      cyl(0.066, 0.066, 0.012, 14, [0.052, 0.02, 0], [0, 0, H]),
    ),
    visor: rbox(0.012, 0.074, 0.14, 0.005, [0.207, 0.06, 0]),
    cyan: merge(
      ...[-0.036, 0.036].map((z) => rbox(0.004, 0.032, 0.026, 0.0018, [0.2135, 0.066, z])),
      box(0.07, 0.008, 0.003, [-0.05, -0.005, 0.0805]),
      box(0.07, 0.008, 0.003, [-0.05, -0.005, -0.0805]),
    ),
    pink: merge(
      ...[-0.05, 0.05].map((z) => place(new THREE.ConeGeometry(0.019, 0.034, 4), [0.139, 0.133, z], [0, Math.PI / 4, 0])),
      box(0.004, 0.007, 0.014, [0.2135, 0.038, 0]),
      place(new THREE.SphereGeometry(0.016, 10, 8), [-0.205, 0.148, 0]),
    ),
    collar: torus(0.07, 0.007, 6, 18, Math.PI * 2, [0.052, 0.02, 0], [0, H, 0]),
  }

  // --- hard hat: inside a ball of r 0.16
  const Y0 = -0.04
  const helmet = {
    shell: merge(
      place(new THREE.SphereGeometry(0.135, 20, 9, 0, Math.PI * 2, 0, H), [0, Y0, 0]),
      cyl(0.152, 0.152, 0.01, 22, [0, Y0 - 0.003, 0]),
      torus(0.134, 0.008, 6, 14, Math.PI, [0, Y0, 0], [0, H, 0]),
      torus(0.126, 0.007, 6, 14, Math.PI, [0.046, Y0, 0], [0, H, 0]),
      torus(0.126, 0.007, 6, 14, Math.PI, [-0.046, Y0, 0], [0, H, 0]),
    ),
    dark: merge(
      cyl(0.1338, 0.1362, 0.022, 22, [0, Y0 + 0.016, 0], undefined, true),
      place(new THREE.CircleGeometry(0.15, 22), [0, Y0 - 0.0085, 0], [H, 0, 0]),
      cyl(0.031, 0.026, 0.032, 12, [0, Y0 + 0.03, 0.134], [H, 0, 0]),
    ),
    lens: cyl(0.025, 0.025, 0.004, 12, [0, Y0 + 0.03, 0.1505], [H, 0, 0]),
  }

  // --- pipe: 1 long, r 0.05, built along Y (the mesh lays it along X)
  const pipe = {
    tube: cyl(0.034, 0.034, 0.96, 12),
    fittings: merge(
      ...[-1, 1].flatMap((s) => [
        cyl(0.05, 0.05, 0.02, 14, [0, s * 0.49, 0]),
        cyl(0.041, 0.041, 0.03, 12, [0, s * 0.465, 0]),
        ...ring(6, (a) => cyl(0.0065, 0.0065, 0.009, 6, [Math.sin(a) * 0.042, s * 0.4765, Math.cos(a) * 0.042])),
      ]),
      cyl(0.044, 0.044, 0.07, 6, [0, -0.14, 0]),
      cyl(0.039, 0.039, 0.014, 12, [0, -0.096, 0]),
      cyl(0.039, 0.039, 0.014, 12, [0, -0.184, 0]),
    ),
    bore: merge(cyl(0.027, 0.027, 0.002, 12, [0, 0.5, 0]), cyl(0.027, 0.027, 0.002, 12, [0, -0.5, 0])),
    paint: merge(
      cyl(0.0348, 0.0348, 0.06, 12, [0, 0.22, 0], undefined, true),
      cyl(0.0348, 0.0348, 0.014, 12, [0, 0.275, 0], undefined, true),
    ),
  }

  // --- mosaic tile: 0.54 x 0.54 x 0.06, picture on +Z
  const tile = {
    slab: box(0.54, 0.54, 0.05),
    face: new THREE.PlaneGeometry(0.52, 0.52),
    frame: merge(
      box(0.54, 0.01, 0.006, [0, 0.265, 0.026]),
      box(0.54, 0.01, 0.006, [0, -0.265, 0.026]),
      box(0.01, 0.52, 0.006, [0.265, 0, 0.026]),
      box(0.01, 0.52, 0.006, [-0.265, 0, 0.026]),
      box(0.14, 0.03, 0.004, [0, 0.2, -0.027]),
    ),
    back: merge(...[-0.15, -0.05, 0.05, 0.13].map((y) => box(0.44, 0.03, 0.004, [0, y, -0.027]))),
  }

  // --- coiled fire hose: r 0.28, 0.24 thick, axis Y
  const hose = {
    coils: merge(
      torus(0.2, 0.034, 8, 30, Math.PI * 2, [0, -0.068, 0], [H, 0, 0]),
      torus(0.205, 0.034, 8, 30, Math.PI * 2, [0, 0, 0], [H, 0, 0.6]),
      torus(0.198, 0.034, 8, 30, Math.PI * 2, [0, 0.068, 0], [H, 0, 1.3]),
    ),
    straps: merge(...[1.1, 4.2].map((a) => box(0.03, 0.212, 0.092, [Math.sin(a) * 0.2015, 0, Math.cos(a) * 0.2015], [0, a, 0]))),
    buckles: merge(...[1.1, 4.2].map((a) => box(0.036, 0.034, 0.006, [Math.sin(a) * 0.249, 0.03, Math.cos(a) * 0.249], [0, a, 0]))),
    tag: box(0.02, 0.026, 0.004, [Math.sin(4.2) * 0.2495, -0.04, Math.cos(4.2) * 0.2495], [0, 4.2, 0]),
    nozzle: place(merge(
      cyl(0.03, 0.03, 0.045, 12, [0, -0.13, 0]),
      cyl(0.036, 0.036, 0.012, 6, [0, -0.13, 0]),
      cyl(0.017, 0.026, 0.13, 12, [0, -0.04, 0]),
      cyl(0.021, 0.021, 0.026, 12, [0, 0.038, 0]),
    ), [0.01, 0, 0.02], [0, 0.35, -H]),
    grip: place(cyl(0.0275, 0.0275, 0.045, 12, [0, -0.075, 0]), [0.01, 0, 0.02], [0, 0.35, -H]),
  }

  return { cell, charge, crate, can, cone, bottle, chair, pixel, helmet, pipe, tile, hose }
}

let geo: ReturnType<typeof buildGeo> | null = null
export function getItemGeo() {
  if (!geo) geo = buildGeo()
  return geo
}
