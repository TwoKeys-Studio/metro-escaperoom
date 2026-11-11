import * as THREE from 'three'

// Procedural canvas textures, generated once and cached.
const cache = new Map<string, THREE.Texture>()

function canvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!] as const
}

// Posters and plaques are read from arm's length, so they are drawn at twice the resolution of their
// layout: the drawing code keeps working in layout pixels, the texture comes out twice as sharp.
const PRINT_SCALE = 2
function printCanvas(w: number, h: number) {
  const [c, g] = canvas(w * PRINT_SCALE, h * PRINT_SCALE)
  g.scale(PRINT_SCALE, PRINT_SCALE)
  return [c, g] as const
}

function rand(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}

function finish(c: HTMLCanvasElement, repeat: [number, number] = [1, 1], srgb = true) {
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(...repeat)
  t.anisotropy = 8
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  return t
}

function grime(g: CanvasRenderingContext2D, w: number, h: number, r: () => number, amount = 900, dark = 0.08) {
  for (let i = 0; i < amount; i++) {
    g.fillStyle = `rgba(0,0,0,${r() * dark})`
    const s = 2 + r() * 30
    g.beginPath()
    g.arc(r() * w, r() * h, s, 0, Math.PI * 2)
    g.fill()
  }
  // vertical leak streaks
  for (let i = 0; i < 26; i++) {
    const x = r() * w
    const grd = g.createLinearGradient(0, 0, 0, h * (0.3 + r() * 0.7))
    grd.addColorStop(0, `rgba(10,14,12,${0.25 + r() * 0.3})`)
    grd.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = grd
    g.fillRect(x, 0, 2 + r() * 8, h)
  }
}

export function tileTexture(key = 'tile', base = '#1b2a2e', repeat: [number, number] = [8, 3]) {
  const k = `${key}${repeat}`
  if (cache.has(k)) return cache.get(k)!
  const [c, g] = canvas(512, 512)
  const r = rand(7)
  g.fillStyle = '#05080a'
  g.fillRect(0, 0, 512, 512)
  const tw = 64
  const th = 32
  for (let y = 0; y < 512; y += th) {
    for (let x = 0; x < 512; x += tw) {
      const l = 0.75 + r() * 0.35
      const col = new THREE.Color(base).multiplyScalar(l)
      if (r() < 0.04) col.set('#0b1012') // missing / burnt tile
      g.fillStyle = `#${col.getHexString()}`
      g.fillRect(x + 2, y + 2, tw - 4, th - 4)
      g.fillStyle = 'rgba(255,255,255,0.05)'
      g.fillRect(x + 2, y + 2, tw - 4, 3)
      if (r() < 0.08) {
        g.strokeStyle = 'rgba(0,0,0,0.6)'
        g.beginPath()
        g.moveTo(x + r() * tw, y)
        g.lineTo(x + r() * tw, y + th)
        g.stroke()
      }
    }
  }
  grime(g, 512, 512, r, 500, 0.12)
  const t = finish(c, repeat)
  cache.set(k, t)
  return t
}

export function floorTexture(repeat: [number, number] = [10, 3]) {
  const k = `floor${repeat}`
  if (cache.has(k)) return cache.get(k)!
  const [c, g] = canvas(512, 512)
  const r = rand(3)
  g.fillStyle = '#121418'
  g.fillRect(0, 0, 512, 512)
  for (let y = 0; y < 512; y += 128) {
    for (let x = 0; x < 512; x += 128) {
      const l = 14 + r() * 10
      g.fillStyle = `rgb(${l},${l + 2},${l + 5})`
      g.fillRect(x + 1, y + 1, 126, 126)
      for (let i = 0; i < 160; i++) {
        const v = 30 + r() * 40
        g.fillStyle = `rgba(${v},${v},${v + 8},${r() * 0.35})`
        g.fillRect(x + r() * 128, y + r() * 128, 1 + r() * 2, 1 + r() * 2)
      }
    }
  }
  grime(g, 512, 512, r, 400, 0.18)
  const t = finish(c, repeat)
  cache.set(k, t)
  return t
}

export function concreteTexture(repeat: [number, number] = [6, 2], seed = 11) {
  const k = `conc${repeat}${seed}`
  if (cache.has(k)) return cache.get(k)!
  const [c, g] = canvas(512, 512)
  const r = rand(seed)
  g.fillStyle = '#23272b'
  g.fillRect(0, 0, 512, 512)
  for (let i = 0; i < 9000; i++) {
    const v = 20 + r() * 40
    g.fillStyle = `rgba(${v},${v + 2},${v + 4},${r() * 0.5})`
    g.fillRect(r() * 512, r() * 512, 1 + r() * 3, 1 + r() * 3)
  }
  // cracks
  g.strokeStyle = 'rgba(0,0,0,0.55)'
  for (let i = 0; i < 8; i++) {
    let x = r() * 512
    let y = r() * 512
    g.beginPath()
    g.moveTo(x, y)
    for (let j = 0; j < 12; j++) {
      x += (r() - 0.5) * 40
      y += (r() - 0.3) * 30
      g.lineTo(x, y)
    }
    g.lineWidth = 0.5 + r() * 1.5
    g.stroke()
  }
  grime(g, 512, 512, r, 700, 0.2)
  // moss / algae near the bottom (tunnels flood)
  const grd = g.createLinearGradient(0, 512, 0, 340)
  grd.addColorStop(0, 'rgba(20,60,50,0.55)')
  grd.addColorStop(1, 'rgba(20,60,50,0)')
  g.fillStyle = grd
  g.fillRect(0, 340, 512, 172)
  const t = finish(c, repeat)
  cache.set(k, t)
  return t
}

export function metalTexture(repeat: [number, number] = [2, 2]) {
  const k = `metal${repeat}`
  if (cache.has(k)) return cache.get(k)!
  const [c, g] = canvas(256, 256)
  const r = rand(5)
  g.fillStyle = '#2a2f36'
  g.fillRect(0, 0, 256, 256)
  for (let y = 0; y < 256; y++) {
    const v = 36 + r() * 18
    g.fillStyle = `rgba(${v},${v + 3},${v + 8},0.5)`
    g.fillRect(0, y, 256, 1)
  }
  g.strokeStyle = 'rgba(0,0,0,0.5)'
  g.lineWidth = 3
  g.strokeRect(4, 4, 248, 248)
  for (const [x, y] of [[14, 14], [242, 14], [14, 242], [242, 242]]) {
    g.fillStyle = '#4a525c'
    g.beginPath()
    g.arc(x, y, 5, 0, Math.PI * 2)
    g.fill()
  }
  grime(g, 256, 256, r, 120, 0.25)
  const t = finish(c, repeat)
  cache.set(k, t)
  return t
}

export function hazardTexture(repeat: [number, number] = [20, 1]) {
  const k = `haz${repeat}`
  if (cache.has(k)) return cache.get(k)!
  const [c, g] = canvas(128, 32)
  g.fillStyle = '#e6ff3a'
  g.fillRect(0, 0, 128, 32)
  g.fillStyle = '#0a0a0a'
  for (let x = -32; x < 160; x += 32) {
    g.beginPath()
    g.moveTo(x, 32)
    g.lineTo(x + 16, 0)
    g.lineTo(x + 32, 0)
    g.lineTo(x + 16, 32)
    g.fill()
  }
  const t = finish(c, repeat)
  cache.set(k, t)
  return t
}

// ---------- text & signs ----------
export interface SignOpts {
  w?: number
  h?: number
  color?: string
  bg?: string
  font?: string
  size?: number
  align?: CanvasTextAlign
  glow?: number
  border?: string
  sub?: string
  subColor?: string
}

/**
 * Sets the font on `g`, shrunk from `size` px until `text` (every line of it) is no wider than `room`.
 * Returns the size used. Every text drawn into a texture goes through this: text that runs past the
 * canvas is silently cut off, and on a clue (a code digit, a riddle line) that breaks the puzzle.
 */
function fitText(g: CanvasRenderingContext2D, text: string, font: (px: number) => string, size: number, room: number) {
  g.font = font(size)
  const widest = Math.max(...text.split('\n').map((l) => g.measureText(l).width))
  if (widest > room) {
    size = Math.floor((size * room) / widest)
    g.font = font(size)
  }
  return size
}
const display = (weight: string | number) => (px: number) => `${weight} ${px}px Unbounded, sans-serif`
const mono = (weight: string | number) => (px: number) => `${weight} ${px}px "JetBrains Mono", monospace`

export function signTexture(text: string, o: SignOpts = {}) {
  const k = `sign:${text}:${JSON.stringify(o)}`
  if (cache.has(k)) return cache.get(k)!
  const w = o.w ?? 1024
  const h = o.h ?? 256
  const [c, g] = canvas(w, h)
  g.fillStyle = o.bg ?? 'rgba(0,0,0,0)'
  g.fillRect(0, 0, w, h)
  if (o.border) {
    g.strokeStyle = o.border
    g.lineWidth = 6
    g.shadowColor = o.border
    g.shadowBlur = 20
    g.strokeRect(10, 10, w - 20, h - 20)
  }
  const room = w - 96 // leaves space for the glow at both ends
  const size = fitText(g, text, display(o.font ?? '800'), o.size ?? Math.floor(h * 0.5), room)
  g.textAlign = o.align ?? 'center'
  g.textBaseline = 'middle'
  g.shadowColor = o.color ?? '#22f0ff'
  g.shadowBlur = o.glow ?? 28
  g.fillStyle = o.color ?? '#22f0ff'
  const x = g.textAlign === 'left' ? 40 : w / 2
  const lines = text.split('\n')
  const lh = size * 1.1
  const y0 = (o.sub ? h * 0.42 : h / 2) - ((lines.length - 1) * lh) / 2
  lines.forEach((l, i) => {
    g.fillText(l, x, y0 + i * lh)
    g.fillText(l, x, y0 + i * lh) // double pass for a hotter core
  })
  if (o.sub) {
    g.shadowBlur = 8
    fitText(g, o.sub, mono(400), Math.floor(size * 0.32), room)
    g.fillStyle = o.subColor ?? '#8693a3'
    g.fillText(o.sub, x, h * 0.8)
  }
  const t = finish(c, [1, 1])
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
  cache.set(k, t)
  return t
}

// Route-map poster: shows the colour order for the access code.
export function routeMapTexture(order: number[], colors: readonly { hex: string; label: string }[]) {
  const k = `route:${order.join('')}`
  if (cache.has(k)) return cache.get(k)!
  const [c, g] = printCanvas(768, 1024)
  g.fillStyle = '#0b0e13'
  g.fillRect(0, 0, 768, 1024)
  g.strokeStyle = '#2b3546'
  g.lineWidth = 4
  g.strokeRect(16, 16, 736, 992)
  g.fillStyle = '#e6f1f4'
  fitText(g, 'ЛИНИЯ 17', display(800), 54, 768 - 104)
  g.fillText('ЛИНИЯ 17', 52, 110)
  fitText(g, 'СХЕМА СЛУЖЕБНОГО ДОСТУПА', mono(400), 26, 768 - 104)
  g.fillStyle = '#8693a3'
  g.fillText('СХЕМА СЛУЖЕБНОГО ДОСТУПА', 52, 160)
  // route line
  g.lineWidth = 14
  g.strokeStyle = '#e6f1f4'
  g.beginPath()
  g.moveTo(130, 260)
  g.lineTo(130, 880)
  g.stroke()
  order.forEach((ci, i) => {
    const y = 290 + i * 180
    const col = colors[ci]
    g.fillStyle = col.hex
    g.shadowColor = col.hex
    g.shadowBlur = 30
    g.beginPath()
    g.arc(130, y, 42, 0, Math.PI * 2)
    g.fill()
    g.shadowBlur = 0
    g.fillStyle = '#0b0e13'
    g.font = '800 40px Unbounded, sans-serif'
    g.textAlign = 'center'
    g.fillText(String(i + 1), 130, y + 14)
    g.textAlign = 'left'
    g.fillStyle = '#e6f1f4'
    g.font = '600 34px Unbounded, sans-serif'
    g.fillText(['ВХОД', 'ПЕРЕХОД', 'ШЛЮЗ', 'ДЕПО'][i], 210, y + 12)
    g.fillStyle = '#4c5767'
    fitText(g, 'ЦИФРА НА ВЫВЕСКЕ ЭТОГО ЦВЕТА', mono(400), 22, 768 - 210 - 40)
    g.fillText('ЦИФРА НА ВЫВЕСКЕ ЭТОГО ЦВЕТА', 210, y + 50)
  })
  g.fillStyle = '#ff2e88'
  fitText(g, 'ВВОДИТЬ СВЕРХУ ВНИЗ. 4 ЦИФРЫ.', mono(400), 22, 768 - 104)
  g.fillText('ВВОДИТЬ СВЕРХУ ВНИЗ. 4 ЦИФРЫ.', 52, 975)
  const t = finish(c, [1, 1])
  cache.set(k, t)
  return t
}

export function schematicTexture(target: boolean[]) {
  const k = `schem:${target.join('')}`
  if (cache.has(k)) return cache.get(k)!
  const [c, g] = printCanvas(1024, 640)
  g.fillStyle = '#031014'
  g.fillRect(0, 0, 1024, 640)
  for (let y = 0; y < 640; y += 4) {
    g.fillStyle = 'rgba(34,240,255,0.04)'
    g.fillRect(0, y, 1024, 1)
  }
  g.fillStyle = '#22f0ff'
  g.shadowColor = '#22f0ff'
  g.shadowBlur = 16
  fitText(g, 'РАСПРЕДКОРОБКА Т-17 · СХЕМА ПОДРЫВА', mono(700), 40, 1024 - 96)
  g.fillText('РАСПРЕДКОРОБКА Т-17 · СХЕМА ПОДРЫВА', 48, 80)
  fitText(g, 'ВОСТОЧНЫЙ ТОННЕЛЬ, ЛЕВЫЙ → ПРАВЫЙ', mono(400), 24, 1024 - 96)
  g.fillStyle = '#8693a3'
  g.fillText('ВОСТОЧНЫЙ ТОННЕЛЬ, ЛЕВЫЙ → ПРАВЫЙ', 48, 124)
  target.forEach((up, i) => {
    const x = 140 + i * 220
    g.strokeStyle = '#22f0ff'
    g.lineWidth = 6
    g.strokeRect(x - 60, 200, 120, 300)
    g.fillStyle = up ? '#e6ff3a' : '#ff2e88'
    g.shadowColor = g.fillStyle
    g.fillRect(x - 14, up ? 220 : 380, 28, 100)
    g.font = '800 64px Unbounded, sans-serif'
    g.textAlign = 'center'
    g.fillText(up ? '▲' : '▼', x, 590)
    g.textAlign = 'left'
  })
  const t = finish(c, [1, 1])
  cache.set(k, t)
  return t
}

export function nameTagTexture(name: string, color: string) {
  return signTexture(name, { w: 512, h: 96, size: 44, color, glow: 12, font: '600' })
}

// ---------- expansion ----------
export function plaqueTexture(title: string, lines: string[], color = '#e6ff3a', w = 1024, h = 768) {
  const k = `plaque:${title}:${lines.join('|')}:${color}:${w}x${h}`
  if (cache.has(k)) return cache.get(k)!
  const [c, g] = printCanvas(w, h)
  g.fillStyle = '#0b0e13'
  g.fillRect(0, 0, w, h)
  g.strokeStyle = color
  g.lineWidth = 6
  g.strokeRect(14, 14, w - 28, h - 28)
  g.fillStyle = color
  g.shadowColor = color
  g.shadowBlur = 14
  fitText(g, title, display(800), 46, w - 100)
  g.fillText(title, 50, 96)
  g.shadowBlur = 0
  g.fillStyle = '#eef6f8'
  // one size for the whole block, as large as the plaque allows: limited by the number of lines and by
  // the longest of them. Lines are never wrapped: the poem is an acrostic and must keep its line starts.
  const size = fitText(g, lines.join('\n'), mono(400), Math.min(64, Math.floor((h - 200) / Math.max(lines.length, 1) / 1.5)), w - 100)
  lines.forEach((l, i) => g.fillText(l, 50, 170 + i * size * 1.5))
  const t = finish(c, [1, 1])
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
  cache.set(k, t)
  return t
}

// The mosaic picture: an art-deco panel with the arming code across the middle.
// Each tile shows one ninth of it (see tileTexture).
export function mosaicTexture(code: string) {
  const k = `mosaic:${code}`
  if (cache.has(k)) return cache.get(k)!
  const [c, g] = canvas(900, 900)
  const grd = g.createRadialGradient(450, 450, 40, 450, 450, 640)
  grd.addColorStop(0, '#163a40')
  grd.addColorStop(1, '#07090c')
  g.fillStyle = grd
  g.fillRect(0, 0, 900, 900)
  // sun-ray pattern
  g.strokeStyle = '#ff9a1f55'
  g.lineWidth = 6
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 18) {
    g.beginPath()
    g.moveTo(450, 450)
    g.lineTo(450 + Math.cos(a) * 700, 450 + Math.sin(a) * 700)
    g.stroke()
  }
  for (const [r, col] of [[400, '#22f0ff'], [300, '#ff2e88'], [190, '#e6ff3a']] as const) {
    g.strokeStyle = col
    g.lineWidth = 10
    g.beginPath()
    g.arc(450, 450, r, 0, Math.PI * 2)
    g.stroke()
  }
  // small chips so the pieces' edges can be matched
  const r = rand(code.length * 77 + Number(code))
  for (let i = 0; i < 500; i++) {
    g.fillStyle = ['#22f0ff33', '#ff2e8833', '#e6ff3a33', '#ffffff18'][i % 4]
    g.fillRect(r() * 900, r() * 900, 14, 14)
  }
  g.fillStyle = '#ffffff'
  g.shadowColor = '#ff9a1f'
  g.shadowBlur = 30
  fitText(g, code, display(800), 230, 900 - 120)
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(code, 450, 470)
  g.shadowBlur = 0
  g.font = display(600)(46)
  g.fillStyle = '#ff9a1f'
  g.fillText('ЛИТЕЙНАЯ · 1977', 450, 170)
  g.fillText('КОД ВЗВОДА', 450, 740)
  const t = finish(c, [1, 1])
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
  cache.set(k, t)
  return t
}

export function tileFaceTexture(code: string, index: number) {
  const k = `tile:${code}:${index}`
  if (cache.has(k)) return cache.get(k)!
  const t = mosaicTexture(code).clone()
  const r = Math.floor(index / 3)
  const c = index % 3
  t.repeat.set(1 / 3, 1 / 3)
  t.offset.set(c / 3, (2 - r) / 3)
  t.needsUpdate = true
  cache.set(k, t)
  return t
}

// =====================================================================
// Surface sets: colour + normal + roughness, built together so they line up.
// All of them tile seamlessly and are generated once.
// =====================================================================
export interface TexSet { map: THREE.Texture; normalMap: THREE.Texture; roughnessMap: THREE.Texture }
const sets = new Map<string, TexSet>()
const noises = new Map<string, HTMLCanvasElement>()

// Tileable value noise (fbm) as a greyscale canvas. `lo`/`hi` window the noise, `a`/`b` are the output greys.
function noiseCanvas(size: number, cell: number, seed: number, lo = 0, hi = 1, a = 0, b = 255, octaves = 4) {
  const k = `${size}|${cell}|${seed}|${lo}|${hi}|${a}|${b}|${octaves}`
  const hit = noises.get(k)
  if (hit) return hit
  const r = rand(seed)
  const data = new Float32Array(size * size)
  let amp = 1
  let total = 0
  for (let o = 0; o < octaves; o++) {
    const n = Math.max(2, Math.round((size / cell) * 2 ** o))
    const lat = new Float32Array(n * n)
    for (let i = 0; i < lat.length; i++) lat[i] = r()
    const s = n / size
    for (let y = 0; y < size; y++) {
      const fy = y * s
      const y0 = Math.floor(fy)
      let ty = fy - y0
      ty = ty * ty * (3 - 2 * ty)
      const r0 = (y0 % n) * n
      const r1 = ((y0 + 1) % n) * n
      for (let x = 0; x < size; x++) {
        const fx = x * s
        const x0 = Math.floor(fx)
        let tx = fx - x0
        tx = tx * tx * (3 - 2 * tx)
        const c0 = x0 % n
        const c1 = (x0 + 1) % n
        const top = lat[r0 + c0] + (lat[r0 + c1] - lat[r0 + c0]) * tx
        const bot = lat[r1 + c0] + (lat[r1 + c1] - lat[r1 + c0]) * tx
        data[y * size + x] += amp * (top + (bot - top) * ty)
      }
    }
    total += amp
    amp *= 0.5
  }
  const [c, g] = canvas(size, size)
  const img = g.createImageData(size, size)
  for (let i = 0; i < data.length; i++) {
    const v = Math.min(1, Math.max(0, (data[i] / total - lo) / (hi - lo)))
    const s = v * v * (3 - 2 * v)
    const out = a + (b - a) * s
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = out
    img.data[i * 4 + 3] = 255
  }
  g.putImageData(img, 0, 0)
  noises.set(k, c)
  return c
}

function blend(g: CanvasRenderingContext2D, src: HTMLCanvasElement, op: GlobalCompositeOperation, alpha = 1) {
  g.save()
  g.globalCompositeOperation = op
  g.globalAlpha = alpha
  g.drawImage(src, 0, 0, g.canvas.width, g.canvas.height)
  g.restore()
}

// Height (greyscale canvas) → tangent-space normal map, wrapping at the edges.
function normalFrom(height: HTMLCanvasElement, strength: number, outSize = height.width) {
  const [hc, hg] = canvas(outSize, outSize)
  hg.drawImage(height, 0, 0, outSize, outSize)
  const src = hg.getImageData(0, 0, outSize, outSize).data
  const out = hg.createImageData(outSize, outSize)
  const w = outSize
  for (let y = 0; y < w; y++) {
    const yu = ((y - 1 + w) % w) * w
    const yd = ((y + 1) % w) * w
    for (let x = 0; x < w; x++) {
      const l = src[(y * w + ((x - 1 + w) % w)) * 4]
      const r = src[(y * w + ((x + 1) % w)) * 4]
      const u = src[(yu + x) * 4]
      const d = src[(yd + x) * 4]
      const nx = ((l - r) / 255) * strength
      const ny = ((d - u) / 255) * strength
      const inv = 1 / Math.hypot(nx, ny, 1)
      const i = (y * w + x) * 4
      out.data[i] = (nx * inv * 0.5 + 0.5) * 255
      out.data[i + 1] = (ny * inv * 0.5 + 0.5) * 255
      out.data[i + 2] = (inv * 0.5 + 0.5) * 255
      out.data[i + 3] = 255
    }
  }
  hg.putImageData(out, 0, 0)
  return hc
}

function shrink(src: HTMLCanvasElement, size: number) {
  if (src.width === size) return src
  const [c, g] = canvas(size, size)
  g.drawImage(src, 0, 0, size, size)
  return c
}

function makeSet(key: string, col: HTMLCanvasElement, height: HTMLCanvasElement, rough: HTMLCanvasElement, strength: number, auxSize = 512): TexSet {
  const set: TexSet = {
    map: finish(col),
    normalMap: finish(normalFrom(height, strength, auxSize), [1, 1], false),
    roughnessMap: finish(shrink(rough, auxSize), [1, 1], false),
  }
  sets.set(key, set)
  return set
}

function grey(v: number) {
  const n = Math.round(Math.min(255, Math.max(0, v)))
  return `rgb(${n},${n},${n})`
}

// Vertical leak streaks that wrap top/bottom.
function drips(g: CanvasRenderingContext2D, S: number, r: () => number, n: number, rgb: string, alpha: number, maxW = 10) {
  for (let i = 0; i < n; i++) {
    const x = r() * S
    const y = r() * S
    const len = S * (0.15 + r() * 0.45)
    const w = 1.5 + r() * maxW
    for (const oy of [0, -S]) {
      const grd = g.createLinearGradient(0, y + oy, 0, y + oy + len)
      const a = alpha * (0.4 + r() * 0.6)
      grd.addColorStop(0, `rgba(${rgb},0)`)
      grd.addColorStop(0.08, `rgba(${rgb},${a})`)
      grd.addColorStop(1, `rgba(${rgb},0)`)
      g.fillStyle = grd
      g.fillRect(x - w / 2, y + oy, w, len)
    }
  }
}

// Glazed metro wall tile in running bond; 1 repeat = 2 m at uv scale 2 (tiles 25 x 12.5 cm).
export function tileSet(key: string, base: string): TexSet {
  const hit = sets.get(`tile:${key}`)
  if (hit) return hit
  const S = 1024
  const TW = 128
  const TH = 64
  const [cc, c] = canvas(S, S)
  const [hc, h] = canvas(S, S)
  const [qc, q] = canvas(S, S)
  const r = rand(7)
  c.fillStyle = '#090b0c'
  c.fillRect(0, 0, S, S)
  h.fillStyle = grey(70)
  h.fillRect(0, 0, S, S)
  q.fillStyle = grey(235)
  q.fillRect(0, 0, S, S)
  const tint = new THREE.Color()
  for (let row = 0; row < S / TH; row++) {
    for (let colI = 0; colI < S / TW; colI++) {
      const x0 = colI * TW + (row % 2 ? TW / 2 : 0)
      const y = row * TH
      const missing = r() < 0.03
      const l = 0.78 + r() * 0.34
      tint.set(base).multiplyScalar(l).offsetHSL((r() - 0.5) * 0.025, (r() - 0.5) * 0.06, 0)
      const fill = `#${tint.getHexString()}`
      const rough = 40 + r() * 38
      const crack = !missing && r() < 0.07
      const cx0 = r() * TW
      const cx1 = r() * TW
      const chip = !missing && r() < 0.1
      const chx = r() < 0.5 ? 2 : TW - 12
      const chy = r() < 0.5 ? 2 : TH - 10
      const specks = Array.from({ length: missing ? 26 : 0 }, () => [r() * (TW - 8) + 2, r() * (TH - 8) + 2, r()])
      for (const x of x0 + TW > S ? [x0, x0 - S] : [x0]) {
        if (missing) {
          c.fillStyle = '#17130f'
          c.fillRect(x + 1, y + 1, TW - 2, TH - 2)
          for (const [sx, sy, sv] of specks) {
            c.fillStyle = `rgba(${90 * sv + 20},${80 * sv + 16},${60 * sv + 12},0.5)`
            c.fillRect(x + sx, y + sy, 3, 2)
          }
          h.fillStyle = grey(88)
          h.fillRect(x + 1, y + 1, TW - 2, TH - 2)
          continue
        }
        c.fillStyle = fill
        c.fillRect(x + 2, y + 2, TW - 4, TH - 4)
        // glaze: soft highlight at the top edge, shadow at the bottom
        let grd = c.createLinearGradient(0, y + 2, 0, y + 16)
        grd.addColorStop(0, 'rgba(255,255,255,0.13)')
        grd.addColorStop(1, 'rgba(255,255,255,0)')
        c.fillStyle = grd
        c.fillRect(x + 2, y + 2, TW - 4, 14)
        grd = c.createLinearGradient(0, y + TH - 10, 0, y + TH - 2)
        grd.addColorStop(0, 'rgba(0,0,0,0)')
        grd.addColorStop(1, 'rgba(0,0,0,0.3)')
        c.fillStyle = grd
        c.fillRect(x + 2, y + TH - 10, TW - 4, 8)
        h.fillStyle = grey(150)
        h.fillRect(x + 2, y + 2, TW - 4, TH - 4)
        h.fillStyle = grey(190)
        h.fillRect(x + 4, y + 4, TW - 8, TH - 8)
        h.fillStyle = grey(208)
        h.fillRect(x + 7, y + 7, TW - 14, TH - 14)
        q.fillStyle = grey(rough)
        q.fillRect(x + 2, y + 2, TW - 4, TH - 4)
        if (crack) {
          for (const [g, style, lw] of [[c, 'rgba(0,0,0,0.75)', 1.4], [h, grey(90), 2], [q, grey(220), 2]] as const) {
            g.strokeStyle = style
            g.lineWidth = lw
            g.beginPath()
            g.moveTo(x + cx0, y + 2)
            g.lineTo(x + (cx0 + cx1) / 2 + 6, y + TH / 2)
            g.lineTo(x + cx1, y + TH - 2)
            g.stroke()
          }
        }
        if (chip) {
          c.fillStyle = '#1c1915'
          c.fillRect(x + chx, y + chy, 10, 8)
          h.fillStyle = grey(95)
          h.fillRect(x + chx, y + chy, 10, 8)
          q.fillStyle = grey(240)
          q.fillRect(x + chx, y + chy, 10, 8)
        }
      }
    }
  }
  // dirt: mottling, grime clouds, leak streaks and limescale
  blend(c, noiseCanvas(512, 96, 31, 0.2, 0.8), 'overlay', 0.2)
  blend(c, noiseCanvas(512, 256, 32, 0.25, 0.75, 165, 255), 'multiply', 1)
  drips(c, S, r, 34, '8,7,4', 0.55)
  drips(c, S, r, 12, '170,190,180', 0.1, 6)
  drips(c, S, r, 8, '70,34,10', 0.28, 5)
  blend(q, noiseCanvas(512, 256, 32, 0.25, 0.75, 150, 0), 'lighten', 1)
  drips(q, S, r, 30, '235,235,235', 0.5)
  return makeSet(`tile:${key}`, cc, hc, qc, 2.2)
}

// Polished granite platform slabs with standing water; 1 repeat = 3 m (slabs 75 cm).
export function floorSet(): TexSet {
  const hit = sets.get('floor')
  if (hit) return hit
  const S = 1024
  const N = 4
  const T = S / N
  const [cc, c] = canvas(S, S)
  const [hc, h] = canvas(S, S)
  const [qc, q] = canvas(S, S)
  const r = rand(3)
  c.fillStyle = '#050607'
  c.fillRect(0, 0, S, S)
  h.fillStyle = grey(90)
  h.fillRect(0, 0, S, S)
  q.fillStyle = grey(225)
  q.fillRect(0, 0, S, S)
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const x = i * T
      const y = j * T
      const l = ((i + j) % 2 ? 30 : 20) + r() * 7
      c.fillStyle = `rgb(${l},${l + 2},${l + 5})`
      c.fillRect(x + 2, y + 2, T - 4, T - 4)
      for (let k = 0; k < 520; k++) {
        const v = r() < 0.6 ? 46 + r() * 50 : 4
        c.fillStyle = `rgba(${v},${v + 2},${v + 8},${0.15 + r() * 0.4})`
        c.fillRect(x + 3 + r() * (T - 8), y + 3 + r() * (T - 8), 1 + r() * 2.5, 1 + r() * 2.5)
      }
      h.fillStyle = grey(196 + r() * 10)
      h.fillRect(x + 2, y + 2, T - 4, T - 4)
      q.fillStyle = grey(96 + r() * 34)
      q.fillRect(x + 2, y + 2, T - 4, T - 4)
    }
  }
  // scuffs
  for (let k = 0; k < 90; k++) {
    const x = r() * S
    const y = r() * S
    const a = r() * Math.PI
    const len = 20 + r() * 90
    for (const [g, style] of [[c, `rgba(150,160,170,${0.04 + r() * 0.07})`], [q, 'rgba(210,210,210,0.35)']] as const) {
      g.strokeStyle = style
      g.lineWidth = 0.6 + r()
      g.beginPath()
      g.moveTo(x, y)
      g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len)
      g.stroke()
    }
  }
  blend(c, noiseCanvas(512, 128, 41, 0.2, 0.8), 'overlay', 0.3)
  blend(c, noiseCanvas(512, 256, 42, 0.2, 0.8, 110, 255), 'multiply', 1)
  // puddles: dark and mirror-smooth
  const puddle = noiseCanvas(512, 300, 44, 0.47, 0.63, 255, 18, 3)
  blend(q, puddle, 'multiply', 1)
  blend(c, puddle, 'multiply', 0.35)
  blend(h, noiseCanvas(512, 300, 44, 0.5, 0.6, 0, 255, 3), 'lighten', 0.8)
  return makeSet('floor', cc, hc, qc, 1.6)
}

// Board-formed concrete; 1 repeat = 2 m.
export function concreteSet(seed = 11): TexSet {
  const hit = sets.get(`conc:${seed}`)
  if (hit) return hit
  const S = 512
  const [cc, c] = canvas(S, S)
  const [hc, h] = canvas(S, S)
  const [qc, q] = canvas(S, S)
  const r = rand(seed)
  c.fillStyle = '#34383b'
  c.fillRect(0, 0, S, S)
  h.fillStyle = grey(128)
  h.fillRect(0, 0, S, S)
  q.fillStyle = grey(232)
  q.fillRect(0, 0, S, S)
  blend(c, noiseCanvas(512, 64, seed + 1, 0.15, 0.85), 'overlay', 0.4)
  blend(h, noiseCanvas(512, 48, seed + 2, 0.1, 0.9), 'overlay', 0.5)
  // pores
  for (let i = 0; i < 1500; i++) {
    const x = r() * S
    const y = r() * S
    const s = 0.6 + r() * 1.8
    c.fillStyle = `rgba(0,0,0,${0.2 + r() * 0.45})`
    c.fillRect(x, y, s, s)
    h.fillStyle = grey(70)
    h.fillRect(x, y, s, s)
  }
  // formwork seams every 50 cm, tie holes
  for (let y = 0; y < S; y += 128) {
    c.fillStyle = 'rgba(0,0,0,0.5)'
    c.fillRect(0, y, S, 2)
    c.fillStyle = 'rgba(255,255,255,0.045)'
    c.fillRect(0, y + 2, S, 2)
    h.fillStyle = grey(70)
    h.fillRect(0, y, S, 3)
    for (let x = 64; x < S; x += 256) {
      const xx = x + ((y / 128) % 2) * 128
      for (const [g, style] of [[c, 'rgba(0,0,0,0.7)'], [h, grey(30)]] as const) {
        g.fillStyle = style
        g.beginPath()
        g.arc(xx, y + 64, 5, 0, Math.PI * 2)
        g.fill()
      }
      const grd = c.createLinearGradient(0, y + 66, 0, y + 150)
      grd.addColorStop(0, 'rgba(92,44,14,0.16)')
      grd.addColorStop(1, 'rgba(92,44,14,0)')
      c.fillStyle = grd
      c.fillRect(xx - 3, y + 66, 6, 84)
    }
  }
  c.fillStyle = 'rgba(0,0,0,0.35)'
  c.fillRect(0, 0, 2, S)
  h.fillStyle = grey(80)
  h.fillRect(0, 0, 2, S)
  // cracks
  for (let i = 0; i < 6; i++) {
    let x = 40 + r() * (S - 80)
    let y = 30 + r() * (S - 200)
    const pts: [number, number][] = [[x, y]]
    for (let j = 0; j < 10; j++) {
      x = Math.min(S - 4, Math.max(4, x + (r() - 0.5) * 34))
      y = Math.min(S - 4, y + r() * 22)
      pts.push([x, y])
    }
    for (const [g, style, lw] of [[c, 'rgba(0,0,0,0.6)', 0.6 + r() * 1.2], [h, grey(40), 2]] as const) {
      g.strokeStyle = style
      g.lineWidth = lw
      g.beginPath()
      pts.forEach(([px, py], k) => (k ? g.lineTo(px, py) : g.moveTo(px, py)))
      g.stroke()
    }
  }
  blend(c, noiseCanvas(512, 256, seed + 3, 0.25, 0.75, 170, 255), 'multiply', 1)
  drips(c, S, r, 22, '6,8,7', 0.5, 14)
  drips(c, S, r, 8, '150,165,160', 0.09, 8)
  // damp patches shine
  blend(q, noiseCanvas(512, 220, seed + 4, 0.52, 0.66, 255, 120, 3), 'multiply', 1)
  blend(c, noiseCanvas(512, 220, seed + 4, 0.52, 0.66, 255, 205, 3), 'multiply', 1)
  return makeSet(`conc:${seed}`, cc, hc, qc, 1.5)
}

// Riveted steel plate (1 repeat = 1 m) or the same plate eaten by rust with flakes of old paint.
export function metalSet(kind: 'plate' | 'rust' = 'plate'): TexSet {
  const hit = sets.get(`metal:${kind}`)
  if (hit) return hit
  const S = 512
  const [cc, c] = canvas(S, S)
  const [hc, h] = canvas(S, S)
  const [qc, q] = canvas(S, S)
  const r = rand(kind === 'plate' ? 5 : 9)
  const rust = kind === 'rust'
  c.fillStyle = rust ? '#3d2a20' : '#30353c'
  c.fillRect(0, 0, S, S)
  h.fillStyle = grey(170)
  h.fillRect(0, 0, S, S)
  q.fillStyle = grey(rust ? 215 : 105)
  q.fillRect(0, 0, S, S)
  // brushed streaks
  for (let y = 0; y < S; y++) {
    const v = r()
    c.fillStyle = `rgba(${rust ? '120,70,40' : '150,165,185'},${v * 0.09})`
    c.fillRect(0, y, S, 1)
    q.fillStyle = `rgba(255,255,255,${v * 0.12})`
    q.fillRect(0, y, S, 1)
  }
  if (rust) {
    // remains of teal paint, then rust blooms over it
    const paint = noiseCanvas(512, 180, 51, 0.48, 0.58, 0, 255, 4)
    const [pc, pg] = canvas(S, S)
    pg.fillStyle = '#243638'
    pg.fillRect(0, 0, S, S)
    pg.globalCompositeOperation = 'destination-in'
    const [mc, mg] = canvas(S, S)
    const img = paint.getContext('2d')!.getImageData(0, 0, S, S)
    for (let i = 0; i < img.data.length; i += 4) img.data[i + 3] = img.data[i]
    mg.putImageData(img, 0, 0)
    pg.drawImage(mc, 0, 0)
    c.globalAlpha = 0.5
    c.drawImage(pc, 0, 0)
    c.globalAlpha = 1
    blend(h, paint, 'lighten', 0.25)
    blend(q, noiseCanvas(512, 180, 51, 0.48, 0.58, 255, 120, 4), 'multiply', 1)
    blend(c, noiseCanvas(512, 90, 52, 0.2, 0.8), 'overlay', 0.35)
    for (let i = 0; i < 220; i++) {
      const x = r() * S
      const y = r() * S
      const s = 3 + r() * 22
      for (const ox of [0, -S]) for (const oy of [0, -S]) {
        const grd = c.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, s)
        grd.addColorStop(0, `rgba(${104 + r() * 40},${50 + r() * 22},22,${0.14 + r() * 0.2})`)
        grd.addColorStop(1, 'rgba(120,50,16,0)')
        c.fillStyle = grd
        c.fillRect(x + ox - s, y + oy - s, s * 2, s * 2)
      }
    }
    drips(c, S, r, 26, '70,30,10', 0.5, 9)
  } else {
    blend(c, noiseCanvas(512, 128, 53, 0.2, 0.8), 'overlay', 0.14)
    for (let i = 0; i < 70; i++) {
      const x = r() * S
      const y = r() * S
      const a = (r() - 0.5) * 0.8
      const len = 10 + r() * 70
      for (const [g, style] of [[c, `rgba(190,205,220,${0.05 + r() * 0.1})`], [q, 'rgba(40,40,40,0.5)']] as const) {
        g.strokeStyle = style
        g.lineWidth = 0.7
        g.beginPath()
        g.moveTo(x, y)
        g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len)
        g.stroke()
      }
    }
    drips(c, S, r, 12, '5,6,8', 0.4, 8)
  }
  // panel seams + rivets
  for (const [g, seam, light] of [[c, 'rgba(0,0,0,0.6)', 'rgba(255,255,255,0.07)'], [h, grey(60), grey(200)]] as const) {
    g.fillStyle = seam
    g.fillRect(0, 0, S, 3)
    g.fillRect(0, 0, 3, S)
    g.fillRect(0, S / 2, S, 2)
    g.fillStyle = light
    g.fillRect(0, 3, S, 2)
    g.fillRect(3, 0, 2, S)
    g.fillRect(0, S / 2 + 2, S, 2)
  }
  for (let x = 32; x < S; x += 64) {
    for (const y of [16, S / 2 - 14, S / 2 + 18, S - 14]) {
      c.fillStyle = 'rgba(0,0,0,0.5)'
      c.beginPath()
      c.arc(x + 1, y + 1.5, 5, 0, Math.PI * 2)
      c.fill()
      c.fillStyle = rust ? '#6a4630' : '#59626d'
      c.beginPath()
      c.arc(x, y, 4, 0, Math.PI * 2)
      c.fill()
      c.fillStyle = 'rgba(255,255,255,0.22)'
      c.beginPath()
      c.arc(x - 1, y - 1, 1.5, 0, Math.PI * 2)
      c.fill()
      const grd = h.createRadialGradient(x, y, 0, x, y, 6)
      grd.addColorStop(0, grey(255))
      grd.addColorStop(1, 'rgba(170,170,170,0)')
      h.fillStyle = grd
      h.fillRect(x - 6, y - 6, 12, 12)
    }
  }
  blend(c, noiseCanvas(512, 256, 54, 0.25, 0.75, rust ? 150 : 205, 255), 'multiply', 1)
  return makeSet(`metal:${kind}`, cc, hc, qc, rust ? 2.6 : 1.8)
}

// Track ballast: crushed stone, oily between the rails. 1 repeat = 2 m.
export function gravelSet(): TexSet {
  const hit = sets.get('gravel')
  if (hit) return hit
  const S = 512
  const [cc, c] = canvas(S, S)
  const [hc, h] = canvas(S, S)
  const [qc, q] = canvas(S, S)
  const r = rand(77)
  c.fillStyle = '#0d0e0f'
  c.fillRect(0, 0, S, S)
  h.fillStyle = grey(30)
  h.fillRect(0, 0, S, S)
  q.fillStyle = grey(230)
  q.fillRect(0, 0, S, S)
  for (let i = 0; i < 2600; i++) {
    const x = r() * S
    const y = r() * S
    const s = 3 + r() * 8
    const v = 22 + r() * 34
    const a = r() * Math.PI
    const hv = 110 + r() * 140
    for (const ox of x + s > S ? [0, -S] : [0]) for (const oy of y + s > S ? [0, -S] : [0]) {
      c.fillStyle = `rgb(${v + r() * 6},${v + 1},${v - 2})`
      c.beginPath()
      c.ellipse(x + ox, y + oy, s, s * (0.55 + r() * 0.3), a, 0, Math.PI * 2)
      c.fill()
      const grd = h.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, s)
      grd.addColorStop(0, grey(hv))
      grd.addColorStop(1, grey(hv * 0.4))
      h.fillStyle = grd
      h.beginPath()
      h.ellipse(x + ox, y + oy, s, s * 0.7, a, 0, Math.PI * 2)
      h.fill()
    }
  }
  blend(c, noiseCanvas(512, 256, 78, 0.25, 0.75, 90, 255), 'multiply', 1)
  blend(q, noiseCanvas(512, 256, 79, 0.5, 0.62, 255, 90, 3), 'multiply', 1)
  return makeSet('gravel', cc, hc, qc, 3)
}

// Worn hazard paint, 45° stripes. 1 repeat = 1 m.
export function hazardSet(): TexSet {
  const hit = sets.get('hazard')
  if (hit) return hit
  const S = 256
  const [cc, c] = canvas(S, S)
  const [hc, h] = canvas(S, S)
  const [qc, q] = canvas(S, S)
  const r = rand(19)
  c.fillStyle = '#d7ee36'
  c.fillRect(0, 0, S, S)
  c.fillStyle = '#0b0b0b'
  for (let x = -S; x < S * 2; x += 64) {
    c.beginPath()
    c.moveTo(x, S)
    c.lineTo(x + S, 0)
    c.lineTo(x + S + 32, 0)
    c.lineTo(x + 32, S)
    c.fill()
  }
  h.fillStyle = grey(180)
  h.fillRect(0, 0, S, S)
  q.fillStyle = grey(150)
  q.fillRect(0, 0, S, S)
  // chipped paint and scratches down to bare steel
  for (let i = 0; i < 160; i++) {
    const x = r() * S
    const y = r() * S
    const w = 2 + r() * 14
    const hh = 1 + r() * 5
    c.fillStyle = `rgba(${40 + r() * 30},${42 + r() * 30},${46 + r() * 30},${0.5 + r() * 0.4})`
    c.fillRect(x, y, w, hh)
    h.fillStyle = grey(120)
    h.fillRect(x, y, w, hh)
    q.fillStyle = grey(70)
    q.fillRect(x, y, w, hh)
  }
  blend(c, noiseCanvas(256, 128, 20, 0.2, 0.8, 110, 255), 'multiply', 1)
  drips(c, S, r, 10, '10,8,4', 0.45, 8)
  return makeSet('hazard', cc, hc, qc, 1.2, 256)
}

// Soft radial falloff for additive "light cards" (spill from neon onto nearby surfaces).
export function glowTexture(kind: 'round' | 'strip' = 'round') {
  const k = `glow:${kind}`
  if (cache.has(k)) return cache.get(k)!
  const [c, g] = canvas(128, 128)
  g.fillStyle = '#000'
  g.fillRect(0, 0, 128, 128)
  if (kind === 'round') {
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    grd.addColorStop(0, 'rgba(255,255,255,1)')
    grd.addColorStop(0.2, 'rgba(255,255,255,0.55)')
    grd.addColorStop(0.5, 'rgba(255,255,255,0.16)')
    grd.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grd
    g.fillRect(0, 0, 128, 128)
  } else {
    // bright along the middle row, fading up/down and at both ends
    const img = g.createImageData(128, 128)
    for (let y = 0; y < 128; y++) {
      for (let x = 0; x < 128; x++) {
        const dy = Math.abs(y - 63.5) / 64
        const ex = Math.min(1, Math.min(x, 127 - x) / 14)
        const v = Math.pow(1 - dy, 2.6) * ex * ex * (3 - 2 * ex)
        const i = (y * 128 + x) * 4
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v * 255
        img.data[i + 3] = 255
      }
    }
    g.putImageData(img, 0, 0)
  }
  const t = finish(c, [1, 1])
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
  cache.set(k, t)
  return t
}
