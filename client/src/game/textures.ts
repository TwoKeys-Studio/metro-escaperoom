import * as THREE from 'three'

// Procedural canvas textures, generated once and cached.
const cache = new Map<string, THREE.Texture>()

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
  const size = o.size ?? Math.floor(h * 0.5)
  g.font = `${o.font ?? '800'} ${size}px Unbounded, sans-serif`
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
    g.font = `400 ${Math.floor(size * 0.32)}px "JetBrains Mono", monospace`
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
  const [c, g] = canvas(768, 1024)
  g.fillStyle = '#0b0e13'
  g.fillRect(0, 0, 768, 1024)
  g.strokeStyle = '#2b3546'
  g.lineWidth = 4
  g.strokeRect(16, 16, 736, 992)
  g.fillStyle = '#e6f1f4'
  g.font = '800 54px Unbounded, sans-serif'
  g.fillText('ЛИНИЯ 17', 52, 110)
  g.font = '400 26px "JetBrains Mono", monospace'
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
    g.font = '400 22px "JetBrains Mono", monospace'
    g.fillText('ЦИФРА НА ВЫВЕСКЕ ЭТОГО ЦВЕТА', 210, y + 50)
  })
  g.fillStyle = '#ff2e88'
  g.font = '400 22px "JetBrains Mono", monospace'
  g.fillText('ВВОДИТЬ СВЕРХУ ВНИЗ. 4 ЦИФРЫ.', 52, 975)
  const t = finish(c, [1, 1])
  cache.set(k, t)
  return t
}

export function schematicTexture(target: boolean[]) {
  const k = `schem:${target.join('')}`
  if (cache.has(k)) return cache.get(k)!
  const [c, g] = canvas(1024, 640)
  g.fillStyle = '#031014'
  g.fillRect(0, 0, 1024, 640)
  for (let y = 0; y < 640; y += 4) {
    g.fillStyle = 'rgba(34,240,255,0.04)'
    g.fillRect(0, y, 1024, 1)
  }
  g.fillStyle = '#22f0ff'
  g.shadowColor = '#22f0ff'
  g.shadowBlur = 16
  g.font = '700 40px "JetBrains Mono", monospace'
  g.fillText('РАСПРЕДКОРОБКА Т-17 · СХЕМА ПОДРЫВА', 48, 80)
  g.font = '400 24px "JetBrains Mono", monospace'
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
  const [c, g] = canvas(w, h)
  g.fillStyle = '#0b0e13'
  g.fillRect(0, 0, w, h)
  g.strokeStyle = color
  g.lineWidth = 6
  g.strokeRect(14, 14, w - 28, h - 28)
  g.fillStyle = color
  g.shadowColor = color
  g.shadowBlur = 14
  g.font = '800 46px Unbounded, sans-serif'
  g.fillText(title, 50, 96)
  g.shadowBlur = 0
  g.fillStyle = '#d7e3e8'
  const size = Math.min(40, Math.floor((h - 180) / Math.max(lines.length, 1) / 1.5))
  g.font = `400 ${size}px "JetBrains Mono", monospace`
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
  g.font = '800 230px Unbounded, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(code, 450, 470)
  g.shadowBlur = 0
  g.font = '600 46px Unbounded, sans-serif'
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
