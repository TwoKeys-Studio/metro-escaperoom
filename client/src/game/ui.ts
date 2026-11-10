import { create } from 'zustand'
import * as THREE from 'three'
import type { ItemKind } from '../../../shared/level'

export type Interact =
  | { kind: 'item'; id: string; label: string }
  | { kind: 'keypad'; target: 'door' | 'arm'; label: string }
  | { kind: 'tlever'; index: number; label: string }
  | { kind: 'valve'; index: number; label: string }
  | { kind: 'kiosk'; label: string }
  | { kind: 'lever'; index: number; label: string }
  | { kind: 'console'; which: 'a' | 'b'; label: string }
  | { kind: 'vending'; label: string }
  | { kind: 'read'; label: string }

// Objects the crosshair can target. Components register their meshes here.
export const interactables = new Map<THREE.Object3D, () => Interact | null>()

export const hold = {
  id: null as string | null,
  /** Extra turn about the vertical the player gave the carried item with R, radians. */
  rotate: 0,
  throwReq: false,
  dropReq: false,
  console: null as 'a' | 'b' | null,
  /** Where the carried item is, in camera space. The right hand wraps around this point. */
  view: new THREE.Vector3(),
  /** What is being carried: the right hand picks its grip from this. */
  kind: null as ItemKind | null,
}

export const keys = new Set<string>()

interface UiStore {
  locked: boolean
  focus: Interact | null
  holding: string | null
  keypad: null | 'door' | 'arm'
  kiosk: boolean
  chat: boolean
  scores: boolean
  flash: boolean
  underwater: boolean
  set: (p: Partial<UiStore>) => void
}

export const useUi = create<UiStore>((set) => ({
  locked: false,
  focus: null,
  holding: null,
  keypad: null,
  kiosk: false,
  chat: false,
  scores: false,
  flash: true,
  underwater: false,
  set: (p) => set(p),
}))

export const itemLabels: Record<string, string> = {
  cell: 'энергоячейку',
  charge: 'подрывной заряд',
  crate: 'ящик',
  can: 'банку «Неон-колы»',
  cone: 'конус',
  bottle: 'бутылку',
  chair: 'стул',
  pixel: 'робокота Пикселя',
  helmet: 'каску',
  pipe: 'обрезок трубы',
  tile: 'плитку мозаики',
  hose: 'шланг',
}
