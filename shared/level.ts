// Shared level data: positions used by both the server (rules) and the client (rendering).
// Units are meters, Y is up. Hall floor y=0, track pit floor y=PIT_Y.

export type Vec3 = [number, number, number]

export const PIT_Y = -1.3
export const HALL = { minX: -22, maxX: 22, minZ: -7, maxZ: 5, height: 6 }
export const PIT = { minZ: 5, maxZ: 11, minX: -50, maxX: 66 }
export const TUNNEL_HEIGHT = 4.2
export const MAINT = { minX: -14, maxX: -2, minZ: -17, maxZ: -7 }
export const ELEVATOR = { minX: 6, maxX: 10, minZ: -10.5, maxZ: -7 }

export const SPAWN: Vec3 = [0, 1, -2]

export type Difficulty = 'easy' | 'normal' | 'hard' | 'nightmare'

export interface DifficultyConfig {
  id: Difficulty
  label: string
  minutes: number
  cells: number // real cells needed
  fakeCells: number // overloaded cells: shock + blackout
  hints: boolean // dispatcher says the answers out loud
  eventEverySec: [number, number] // random creepy events interval
  fog: number
  ambient: number
  flashlightDrain: number // battery % per second, 0 = infinite
  evacSeconds: number
}

export const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  easy: {
    id: 'easy', label: 'Лёгкая', minutes: 28, cells: 3, fakeCells: 0, hints: true,
    eventEverySec: [70, 110], fog: 0.026, ambient: 0.55, flashlightDrain: 0, evacSeconds: 45,
  },
  normal: {
    id: 'normal', label: 'Нормальная', minutes: 22, cells: 3, fakeCells: 1, hints: false,
    eventEverySec: [45, 80], fog: 0.032, ambient: 0.42, flashlightDrain: 0, evacSeconds: 35,
  },
  hard: {
    id: 'hard', label: 'Сложная', minutes: 17, cells: 4, fakeCells: 1, hints: false,
    eventEverySec: [30, 55], fog: 0.04, ambient: 0.3, flashlightDrain: 0.25, evacSeconds: 28,
  },
  nightmare: {
    id: 'nightmare', label: 'Кошмар', minutes: 13, cells: 4, fakeCells: 2, hints: false,
    eventEverySec: [18, 35], fog: 0.05, ambient: 0.18, flashlightDrain: 0.45, evacSeconds: 22,
  },
}

export const MIN_PLAYERS = 4
export const MAX_PLAYERS = 12

// ---------- Items ----------
export type ItemKind =
  | 'cell' | 'charge' | 'crate' | 'can' | 'cone' | 'bottle' | 'chair' | 'pixel' | 'helmet' | 'pipe' | 'tile' | 'hose'

export interface ItemSpec { id: string; kind: ItemKind; pos: Vec3 }

// Spawn spots for energy cells. Server picks from these at random.
export const CELL_SPOTS: Vec3[] = [
  [-12.5, 0.15, -6.0], // under the bench in the hall
  [-38, PIT_Y + 0.4, 9.6], // west tunnel, between rails
  [-47, PIT_Y + 0.75, 8.6], // inside the dead train car
  [44, PIT_Y + 0.4, 6.0], // east tunnel near junction box
  [55.5, PIT_Y + 0.9, 9.8], // on the rubble near the collapse
  [19.6, 0.15, -6.3], // next to the vending machine
  [-20.5, 2.05, -6.4], // on top of the ticket booth (jump to reach)
  [-29, PIT_Y + 0.4, 6.4], // west tunnel
]

export const PROPS: ItemSpec[] = [
  { id: 'crate1', kind: 'crate', pos: [-16, 0.4, -4] },
  { id: 'crate2', kind: 'crate', pos: [-16, 1.2, -4] },
  { id: 'crate3', kind: 'crate', pos: [30, PIT_Y + 0.4, 9] },
  { id: 'can1', kind: 'can', pos: [16, 0.2, -5.5] },
  { id: 'can2', kind: 'can', pos: [3, 0.2, 1] },
  { id: 'cone1', kind: 'cone', pos: [19, 0.3, 3.8] },
  { id: 'cone2', kind: 'cone', pos: [-19, 0.3, 3.8] },
  { id: 'bottle1', kind: 'bottle', pos: [-4, 0.2, -1] },
  { id: 'chair1', kind: 'chair', pos: [-8, 0.5, -11] },
  { id: 'helmet1', kind: 'helmet', pos: [-12.5, 1.1, -12] },
  { id: 'pipe1', kind: 'pipe', pos: [36, PIT_Y + 0.2, 7] },
  { id: 'pixel', kind: 'pixel', pos: [17.5, 2.45, -6.3] }, // easter egg: robot cat on the vending machine
]

export const CHARGE_SPAWN: Vec3 = [-5, 0.45, -14]

// ---------- Sockets (places where items snap) ----------
export interface Socket { id: string; accepts: ItemKind; pos: Vec3; q?: [number, number, number, number] }

export const POWER_PANEL_POS: Vec3 = [-2, 1.4, -6.85]
export function powerSockets(count: number): Socket[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `slot${i}`,
    accepts: 'cell' as ItemKind,
    pos: [POWER_PANEL_POS[0] - ((count - 1) * 0.45) / 2 + i * 0.45, POWER_PANEL_POS[1], POWER_PANEL_POS[2] + 0.18] as Vec3,
  }))
}
export const CHARGE_SOCKET: Socket = { id: 'chargeSpot', accepts: 'charge', pos: [58.5, PIT_Y + 0.35, 8] }

// ---------- Interactables ----------
export const KEYPAD_POS: Vec3 = [-6.3, 1.4, -6.9]
export const SERVICE_DOOR = { x: -8, z: -7, width: 2.2, height: 2.8 }
export const LEVERS_POS: Vec3 = [40, PIT_Y + 1.5, 10.85] // junction box on the far tunnel wall
export const LEVER_COUNT = 4
export const SCHEMATIC_POS: Vec3 = [-13.9, 1.8, -12] // screen in the maintenance room
export const DETONATOR_A: Vec3 = [-15, 1.1, -6.4]
export const DETONATOR_B: Vec3 = [15, 1.1, -6.4]
export const BLAST_DOOR_X = 22.2
export const VENDING_POS: Vec3 = [17.5, 1.1, -6.4]
export const ELEVATOR_BUTTON: Vec3 = [5.4, 1.3, -6.9]

export const INTERACT_RANGE = 2.6

export function dist(a: Vec3, b: Vec3) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

export function inElevator(p: Vec3) {
  return p[0] > ELEVATOR.minX && p[0] < ELEVATOR.maxX && p[2] > ELEVATOR.minZ && p[2] < ELEVATOR.maxZ - 0.3
}

// Neon colour names used by the access-code puzzle (order shown on the route map poster).
export const CODE_COLORS = [
  { id: 'cyan', label: 'ЦИАН', hex: '#22f0ff' },
  { id: 'pink', label: 'РОЗОВЫЙ', hex: '#ff2e88' },
  { id: 'acid', label: 'КИСЛОТНЫЙ', hex: '#e6ff3a' },
  { id: 'amber', label: 'ЯНТАРНЫЙ', hex: '#ff9a1f' },
] as const

// Where each coloured digit hangs in the hall (index = colour index).
export const CODE_SIGN_POS: Vec3[] = [
  [-19, 4.2, -6.9],
  [12, 4.6, 4.6],
  [-3, 5.2, 4.6],
  [21.9, 3.4, -2],
]

// =====================================================================
// Expansion: pump room, transfer corridor, branch B station, ciphers.
// =====================================================================

// Pump room (north of the west tunnel, floor at track level)
export const PUMP = { minX: -44, maxX: -26, minZ: -7, maxZ: 4.6 }
export const PUMP_DOOR = { x: -35, z: 4.8, width: 2, height: 2.6 }
export const VALVE_POS: Vec3[] = [-39.6, -38.8, -38.0, -37.2].map((x) => [x, PIT_Y + 1.4, 5.05] as Vec3)
export const VALVE_SYMBOLS = ['○', '△', '□', '◇'] as const
export const VALVE_RIDDLE: Record<number, string> = {
  0: 'тот, что кругл, как полная луна',
  1: 'тот, у кого всего три угла',
  2: 'тот, что квадратен, как окно',
  3: 'тот, что стоит на остром углу',
}
export const VALVE_PLAQUE_POS: Vec3 = [-31.5, PIT_Y + 1.8, 5.02]
export const HOSE_SOCKETS: Socket[] = [-37, -35, -33].map((x, i) => ({ id: `hose${i}`, accepts: 'hose' as ItemKind, pos: [x, PIT_Y + 1.05, -1.55] as Vec3 }))
export const MORSE_TABLE_POS: Vec3 = [-43.97, PIT_Y + 2, -1]
export const PUMP_TIME_PER_HOSE = 45
export const PUMP_TIME_BONUS = 60

// Transfer corridor from the hall's east wall to branch B
export const TRANSFER_DOOR = { x: 22.2, z: -3, width: 2, height: 2.8 }
export const TRANSFER = { minX: 22.4, maxX: 34, minZ: -4.2, maxZ: -1.8 }
export const TLEVER_COUNT = 5
export const TLEVER_POS: Vec3[] = Array.from({ length: TLEVER_COUNT }, (_, i) => [21.88, 1.2, -0.6 + i * 0.7] as Vec3)

// Branch B — "Литейная" station
export const BRANCH = { minX: 34, maxX: 58, minZ: -16, maxZ: -1 }
export const MOSAIC_CENTER: Vec3 = [57.88, 2.2, -8]
export const MOSAIC_Q: [number, number, number, number] = [0, -Math.SQRT1_2, 0, Math.SQRT1_2] // face -x
export const MOSAIC_SOCKETS: Socket[] = Array.from({ length: 9 }, (_, i) => {
  const r = Math.floor(i / 3)
  const c = i % 3
  return { id: `mos${i}`, accepts: 'tile' as ItemKind, pos: [MOSAIC_CENTER[0], MOSAIC_CENTER[1] + (1 - r) * 0.6, MOSAIC_CENTER[2] + (c - 1) * 0.6] as Vec3 }
})
export const TILE_SPOTS: Vec3[] = [
  [38, 0.1, -12.5], [44, 0.1, -10.5], [50, 0.45, -12.6], [55, 0.1, -3], [41, 0.45, -4.2],
  [26, 0.1, -3.6], [31, 0.1, -2.4], [-41, PIT_Y + 0.1, 2], [57.2, PIT_Y + 0.7, 6],
]
export const DIRT_PILES: Vec3[] = [[50, 0, -12.6], [41, 0, -4.2], [38.5, 0, -12.2], [55.5, 0, -3.4]]
export const HOSE_SPOTS: Vec3[] = [[-29, PIT_Y + 0.2, -5], [52, 0.2, -6], [-44.5, PIT_Y + 0.6, 7.6]]
export const ARM_TERMINAL_POS: Vec3 = [46, PIT_Y + 1.4, 10.85]
export const CAESAR_POS: Vec3 = [46, 3.1, -1.02]
export const CAESAR_SHIFT = 17

// Hall extras
export const KIOSK_POS: Vec3 = [3.2, 1.0, -6.7]
export const MORSE_LAMP_POS: Vec3 = [-8, 2.6, -16.93]
export const POEM_POS: Vec3 = [-45.75, PIT_Y + 2.05, 9.87]

export function inEastTunnel(p: Vec3) {
  return p[0] > 21.8 && p[2] > 4.8
}

// ---------- ciphers ----------
export const RU = 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'
export function caesar(text: string, shift: number) {
  return [...text].map((ch) => {
    const i = RU.indexOf(ch)
    return i < 0 ? ch : RU[(i + shift + RU.length * 4) % RU.length]
  }).join('')
}
export const CAESAR_WORDS = ['ГЛУБИНА', 'ПИКСЕЛЬ', 'НЕОНОВЫЙ', 'МАШИНИСТ', 'ПЕРЕХОД']

export const POEMS: { answer: string; lines: string[] }[] = [
  {
    answer: 'НАСОС',
    lines: [
      'Не слышно поездов который год,',
      'А вода всё ближе подступает,',
      'Свет неона гаснет у ворот,',
      'Острый холод шею обнимает,',
      'Сердце станции под нами замирает.',
    ],
  },
  {
    answer: 'КОШКА',
    lines: [
      'Кто-то смотрит из пустых вагонов,',
      'Одиноко светятся глаза,',
      'Шорох лап среди бетонных стонов,',
      'Каплет ржавая слеза,',
      'А диспетчер шепчет: «Ей нельзя».',
    ],
  },
  {
    answer: 'ЛИФТ',
    lines: [
      'Ломаный неон над головой,',
      'Искры падают в чёрную воду,',
      'Фонарь дрожит в руке живой,',
      'Тоннель не отпустит на свободу.',
    ],
  },
]

export const MORSE: Record<string, string> = {
  '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-',
  '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
}
