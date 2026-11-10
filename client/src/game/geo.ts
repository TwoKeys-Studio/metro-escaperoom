import * as THREE from 'three'

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
