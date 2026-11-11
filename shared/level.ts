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
    id: 'easy', label: 'Лёгкая', minutes: 90, cells: 3, fakeCells: 0, hints: true,
    eventEverySec: [70, 110], fog: 0.026, ambient: 0.55, flashlightDrain: 0, evacSeconds: 45,
  },
  normal: {
    id: 'normal', label: 'Нормальная', minutes: 60, cells: 3, fakeCells: 1, hints: false,
    eventEverySec: [45, 80], fog: 0.032, ambient: 0.42, flashlightDrain: 0, evacSeconds: 35,
  },
  hard: {
    id: 'hard', label: 'Сложная', minutes: 45, cells: 4, fakeCells: 1, hints: false,
    eventEverySec: [30, 55], fog: 0.04, ambient: 0.3, flashlightDrain: 0.1, evacSeconds: 28,
  },
  nightmare: {
    id: 'nightmare', label: 'Кошмар', minutes: 30, cells: 4, fakeCells: 2, hints: false,
    eventEverySec: [18, 35], fog: 0.05, ambient: 0.18, flashlightDrain: 0.22, evacSeconds: 22,
  },
}

export const MIN_PLAYERS = 4
export const MAX_PLAYERS = 12

// ---------- Items ----------
export type ItemKind =
  | 'cell' | 'charge' | 'crate' | 'can' | 'cone' | 'bottle' | 'chair' | 'pixel' | 'helmet' | 'pipe' | 'tile' | 'hose'
  | 'gas' | 'rat' | 'doll' | 'skull' | 'book' | 'mask' | 'jar'

export interface ItemSpec { id: string; kind: ItemKind; pos: Vec3 }

// Spawn spots for energy cells. Server picks from these at random.
export const CELL_SPOTS: Vec3[] = [
  [-12.5, 0.15, -6.0], // under the bench in the hall
  [-38, PIT_Y + 0.4, 9.6], // west tunnel, between rails
  [-47, PIT_Y + 1.02, 8.6], // inside the dead train car, standing on its floor (0.8 m above the track: TrainCar.tsx)
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

// =====================================================================
// Second floor: the service level above the maintenance room.
// A stairwell west of the maintenance room (reached through the service door, so only after the door
// code) climbs to a corridor with five rooms. Two things up here are needed to win: the breakers in the
// dispatch room unlock the storage room, and the gas rig in the boiler room feeds the detonator.
// =====================================================================
export const F2_Y = 7 // floor height
export const F2_H = 3 // ceiling height above the floor
export const F2_CORRIDOR = { minX: -20, maxX: 8, minZ: -19.6, maxZ: -17 }
export const F2_ROOM_Z = { minZ: -27.6, maxZ: -19.8 }
export const F2_ROOMS = [
  { id: 'archive', name: 'АРХИВ', minX: -20, maxX: -14.4 },
  { id: 'medbay', name: 'МЕДПУНКТ', minX: -14.4, maxX: -8.8 },
  { id: 'dispatch', name: 'ДИСПЕТЧЕРСКАЯ', minX: -8.8, maxX: -3.2 },
  { id: 'boiler', name: 'КОТЕЛЬНАЯ', minX: -3.2, maxX: 2.4 },
  { id: 'storage', name: 'КАМЕРА ХРАНЕНИЯ', minX: 2.4, maxX: 8 },
] as const
export type F2RoomId = (typeof F2_ROOMS)[number]['id']
export const f2Room = (id: F2RoomId) => F2_ROOMS.find((r) => r.id === id)!
const roomX = (id: F2RoomId) => (f2Room(id).minX + f2Room(id).maxX) / 2
/** The stairwell: x/z footprint from the ground (y = 0) up to the second floor. */
export const STAIRWELL = { minX: -20, maxX: -14.4, minZ: -17, maxZ: -7.6 }

// Dispatch room: six breakers on the far wall. Setting them to the hidden pattern unlocks the storage room.
export const BREAKER_COUNT = 6
export const BREAKER_POS: Vec3[] = Array.from({ length: BREAKER_COUNT }, (_, i) => [roomX('dispatch') + (i - 2.5) * 0.5, F2_Y + 1.45, F2_ROOM_Z.minZ + 0.14] as Vec3)
export const STORAGE_DOOR = { x: roomX('storage'), z: F2_ROOM_Z.maxZ, width: 1.3, height: 2.3 }

// Boiler room: three gas cylinders go into the rig, then each regulator is set to its pressure (0–5).
export const GAS_COUNT = 3
export const GAS_DIAL_STEPS = 6
export const GAS_SOCKETS: Socket[] = Array.from({ length: GAS_COUNT }, (_, i) => ({
  id: `gas${i}`, accepts: 'gas' as ItemKind, pos: [roomX('boiler') + (i - 1) * 1.1, F2_Y + 0.62, F2_ROOM_Z.minZ + 0.5] as Vec3,
}))
export const GAS_DIAL_POS: Vec3[] = GAS_SOCKETS.map((s) => [s.pos[0], F2_Y + 1.75, F2_ROOM_Z.minZ + 0.14] as Vec3)
/** Where the cylinders start, standing on the floor: archive, medbay, and the locked storage room. */
export const GAS_SPOTS: Vec3[] = [
  [roomX('archive') - 1.6, F2_Y + 0.43, -26.4],
  [roomX('medbay') + 1.7, F2_Y + 0.43, -25.2],
  [roomX('storage') + 1.5, F2_Y + 0.43, -26.2],
]

/** Rats: they scurry around these spots on their own until someone picks them up. */
export const RAT_SPOTS: Vec3[] = [
  [roomX('archive') + 0.4, F2_Y + 0.05, -23.5],
  [roomX('medbay') - 0.5, F2_Y + 0.05, -24.2],
  [roomX('boiler') + 0.4, F2_Y + 0.05, -23],
  [roomX('storage') - 0.4, F2_Y + 0.05, -23.6],
  [-6, F2_Y + 0.05, -18.3], // corridor
  [-17.6, 0.05, -16.1], // foot of the stairs
  [-8, 0.05, -13], // maintenance room
  [-36, PIT_Y + 0.05, 8], // west tunnel
]
/** How far a rat strays from its spot. */
export const RAT_RANGE = 0.9

/** Loose things on the second floor. Heights match the furniture in client/src/game/Floor2.tsx (tops at +0.9, the gurney at +0.55). */
export const F2_PROPS: ItemSpec[] = [
  { id: 'book1', kind: 'book', pos: [roomX('archive') + 0.8, F2_Y + 0.94, -27.05] },
  { id: 'book2', kind: 'book', pos: [roomX('archive') + 1.6, F2_Y + 0.04, -22] },
  { id: 'book3', kind: 'book', pos: [roomX('dispatch') + 2.0, F2_Y + 0.94, -24] },
  { id: 'skull1', kind: 'skull', pos: [roomX('archive') + 1.9, F2_Y + 1.02, -27.05] },
  { id: 'skull2', kind: 'skull', pos: [roomX('storage') - 1.8, F2_Y + 0.12, -26.8] },
  { id: 'jar1', kind: 'jar', pos: [roomX('medbay') - 1.9, F2_Y + 1.02, -27.2] },
  { id: 'jar2', kind: 'jar', pos: [roomX('medbay') - 1.3, F2_Y + 1.02, -27.2] },
  { id: 'jar3', kind: 'jar', pos: [roomX('medbay') + 0.4, F2_Y + 0.12, -21.5] },
  { id: 'mask1', kind: 'mask', pos: [roomX('boiler') - 1.9, F2_Y + 0.14, -21.2] },
  { id: 'mask2', kind: 'mask', pos: [roomX('dispatch') - 2.2, F2_Y + 1.04, -25.4] },
  { id: 'doll1', kind: 'doll', pos: [roomX('storage') + 0.2, F2_Y + 0.21, -25.5] },
  { id: 'doll2', kind: 'doll', pos: [roomX('medbay') + 1.9, F2_Y + 0.76, -21.3] },
  { id: 'crate4', kind: 'crate', pos: [roomX('storage') - 1.6, F2_Y + 0.41, -21.4] },
  { id: 'chair2', kind: 'chair', pos: [roomX('dispatch') - 0.4, F2_Y + 0.46, -25.6] },
  { id: 'bottle2', kind: 'bottle', pos: [roomX('boiler') + 1.8, F2_Y + 0.16, -21.3] },
  { id: 'helmet2', kind: 'helmet', pos: [-12, F2_Y + 0.17, -18.2] },
]

export function onFloor2(p: Vec3) {
  return p[1] > F2_Y - 0.5
}
