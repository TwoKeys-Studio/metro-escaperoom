import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

type V3 = [number, number, number]

// Box geometry whose UVs are in world meters / `scale`, so textures tile evenly at any size.
const cache = new Map<string, THREE.BoxGeometry>()
export function boxGeo(w: number, h: number, d: number, scale = 2) {
  const k = `${w}|${h}|${d}|${scale}`
  const hit = cache.get(k)
  if (hit) return hit
  const g = new THREE.BoxGeometry(w, h, d)
  const uv = g.attributes.uv as THREE.BufferAttribute
  // face order: +x, -x, +y, -y, +z, -z ; 4 verts each
  const dims: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v
      uv.setXY(i, (uv.getX(i) * dims[f][0]) / scale, (uv.getY(i) * dims[f][1]) / scale)
    }
  }
  uv.needsUpdate = true
  cache.set(k, g)
  return g
}

// Collects many static pieces and merges them into one geometry (one draw call per material).
// Axis-aligned boxes get world-space UVs, so a texture runs unbroken across neighbouring blocks.
const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3(1, 1, 1)
export class Batch {
  private parts: THREE.BufferGeometry[] = []
  get empty() {
    return this.parts.length === 0
  }

  private push(g: THREE.BufferGeometry, p: V3, r?: V3, scale?: V3) {
    _m.compose(_p.set(...p), r ? _q.setFromEuler(_e.set(...r)) : _q.identity(), scale ? _s.set(...scale) : _s.set(1, 1, 1))
    g.applyMatrix4(_m)
    this.parts.push(g)
    return this
  }

  box(p: V3, s: V3, uv = 2, r?: V3) {
    if (r) return this.push(boxGeo(s[0], s[1], s[2], uv).clone(), p, r)
    const g = new THREE.BoxGeometry(s[0], s[1], s[2])
    g.translate(p[0], p[1], p[2])
    const pos = g.attributes.position as THREE.BufferAttribute
    const t = g.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      const f = Math.floor(i / 8) // 0: ±x, 1: ±y, 2: ±z
      const x = pos.getX(i)
      const y = pos.getY(i)
      const z = pos.getZ(i)
      if (f === 0) t.setXY(i, z / uv, y / uv)
      else if (f === 1) t.setXY(i, x / uv, z / uv)
      else t.setXY(i, x / uv, y / uv)
    }
    this.parts.push(g)
    return this
  }

  // cylinder along an axis; `len` is its length
  cyl(p: V3, radius: number, len: number, axis: 'x' | 'y' | 'z' = 'y', seg = 8, radiusTop = radius) {
    const g = new THREE.CylinderGeometry(radiusTop, radius, len, seg, 1)
    return this.push(g, p, axis === 'x' ? [0, 0, Math.PI / 2] : axis === 'z' ? [Math.PI / 2, 0, 0] : undefined)
  }

  // flat quad facing `face`; w along the first free axis, h along the second
  quad(p: V3, w: number, h: number, face: '+x' | '-x' | '+y' | '-y' | '+z' | '-z') {
    const r: Record<string, V3> = {
      '+z': [0, 0, 0], '-z': [0, Math.PI, 0], '+x': [0, Math.PI / 2, 0], '-x': [0, -Math.PI / 2, 0],
      '+y': [-Math.PI / 2, 0, 0], '-y': [Math.PI / 2, 0, 0],
    }
    return this.push(new THREE.PlaneGeometry(w, h), p, r[face])
  }

  // takes ownership of `g` (it is transformed in place): pass a fresh geometry
  add(g: THREE.BufferGeometry, p: V3 = [0, 0, 0], r?: V3, scale?: V3) {
    return this.push(g, p, r, scale)
  }

  build() {
    if (!this.parts.length) return new THREE.BufferGeometry()
    const g = mergeGeometries(this.parts, false)
    for (const x of this.parts) x.dispose()
    this.parts = []
    return g
  }
}

// One Batch per material key; `meshes()` hands back [key, geometry] pairs to render.
export class BatchSet<K extends string> {
  private map = new Map<K, Batch>()
  of(key: K) {
    let b = this.map.get(key)
    if (!b) this.map.set(key, (b = new Batch()))
    return b
  }

  build(): [K, THREE.BufferGeometry][] {
    return [...this.map.entries()].filter(([, b]) => !b.empty).map(([k, b]) => [k, b.build()])
  }
}
