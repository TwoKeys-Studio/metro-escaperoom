import type { Difficulty, ItemKind, Vec3 } from './level.ts'

export type Phase =
  | 'lobby'
  | 'intro' // cutscene: quake, lights die
  | 'power' // find & insert energy cells
  | 'access' // crack the service door code
  | 'charge' // carry the charge to the collapse, set the junction levers
  | 'arm' // two players hold the detonator consoles together
  | 'evac' // countdown, get behind the blast door
  | 'escape' // elevator is open
  | 'won'
  | 'lost'

export type EventType = 'blackout' | 'ghostTrain' | 'quake' | 'whisper' | 'shadow' | 'glitch' | 'scream'

export interface PlayerInfo {
  id: string
  name: string
  color: string
  ready: boolean
  host: boolean
  alive: boolean
  escaped: boolean
}

export interface ItemState {
  id: string
  kind: ItemKind
  p: Vec3
  q: [number, number, number, number]
  holder: string | null // player id currently carrying it
  owner: string | null // player id simulating its physics
  socket: string | null // socket id when snapped
  fake?: boolean // only revealed after insertion
}

export interface GameState {
  phase: Phase
  difficulty: Difficulty
  timeLeft: number // seconds
  totalTime: number
  paused: boolean
  water: number // world Y of the water surface
  power: boolean
  doorOpen: boolean
  levers: boolean[]
  leversOk: boolean
  chargePlaced: boolean
  detonator: { a: boolean; b: boolean; progress: number }
  evacLeft: number
  blastDoorClosed: boolean
  elevatorOpen: boolean
  sockets: string[] // power socket ids for this difficulty
  // clue data (clients render it into the world)
  codeDigits: number[] // digit shown on each coloured sign
  codeOrder: number[] // colour order on the route-map poster
  leverTarget: boolean[] // schematic shown in the maintenance room
  eggs: boolean
  eggsFound: string[]
  solo: boolean // practice run: one player, hints and objective markers
  // transfer door: "lights out" levers
  transferLamps: boolean[]
  transferOpen: boolean
  // pump room door: valves in riddle order; hoses into the pump
  pumpOrder: number[]
  pumpProgress: number
  pumpDoorOpen: boolean
  hoses: number
  pumpOn: boolean
  // branch B mosaic → detonator arming code
  armCode: string
  mosaicDone: boolean
  armCodeOk: boolean
  // hard easter eggs (answers are checked on the server)
  caesar: string
  poem: number
  morse: string
  reveals: string[]
  outcome?: string
}

export interface RoomSummary {
  id: string
  name: string
  players: number
  phase: Phase
  difficulty: Difficulty
  locked: boolean
}

// ---------------- client -> server ----------------
export type ClientMsg =
  | { t: 'hello'; name: string }
  | { t: 'create'; name: string; difficulty: Difficulty; password?: string; solo?: boolean }
  | { t: 'join'; roomId: string; password?: string }
  | { t: 'leave' }
  | { t: 'ready'; ready: boolean }
  | { t: 'difficulty'; difficulty: Difficulty }
  | { t: 'start' }
  | { t: 'chat'; text: string }
  | { t: 'move'; p: Vec3; yaw: number; pitch: number; crouch: boolean; flash: boolean }
  | { t: 'grab'; id: string }
  | { t: 'itemTf'; id: string; p: Vec3; q: [number, number, number, number] }
  | { t: 'release'; id: string; p: Vec3; q: [number, number, number, number]; v: Vec3 }
  | { t: 'rest'; id: string; p: Vec3; q: [number, number, number, number] }
  | { t: 'keypad'; code: string; target?: 'door' | 'arm' }
  | { t: 'kiosk'; text: string }
  | { t: 'valve'; index: number }
  | { t: 'tlever'; index: number }
  | { t: 'lever'; index: number }
  | { t: 'hold'; console: 'a' | 'b'; down: boolean }
  | { t: 'vending' }
  | { t: 'egg'; id: string }
  // admin
  | { t: 'adminAuth'; password: string }
  | { t: 'adminWatch'; roomId: string | null }
  | { t: 'admin'; roomId: string; cmd: AdminCmd }

export type AdminCmd =
  | { c: 'addTime'; sec: number }
  | { c: 'pause'; paused: boolean }
  | { c: 'event'; type: EventType }
  | { c: 'say'; text: string }
  | { c: 'kick'; playerId: string }
  | { c: 'forceStart' }
  | { c: 'end'; result: 'won' | 'lost' }
  | { c: 'reset' }
  | { c: 'difficulty'; difficulty: Difficulty }
  | { c: 'eggs'; on: boolean }
  | { c: 'skipPhase' }
  | { c: 'close' }

// ---------------- server -> client ----------------
export interface PlayerTf { p: Vec3; yaw: number; pitch: number; crouch: boolean; flash: boolean }

export type ServerMsg =
  | { t: 'welcome'; id: string }
  | { t: 'rooms'; rooms: RoomSummary[] }
  | { t: 'room'; id: string; name: string; players: PlayerInfo[]; difficulty: Difficulty; phase: Phase }
  | { t: 'left'; reason?: string }
  | { t: 'error'; text: string }
  | { t: 'game'; state: GameState; items: ItemState[] }
  | { t: 'tick'; time: number; water: number; players: Record<string, PlayerTf>; items: Pick<ItemState, 'id' | 'p' | 'q'>[] }
  | { t: 'item'; item: ItemState }
  | { t: 'event'; type: EventType; target?: string; at?: Vec3 }
  | { t: 'say'; from: 'ai' | 'admin'; text: string }
  | { t: 'chat'; from: string; name: string; color: string; text: string }
  | { t: 'shock'; playerId: string }
  | { t: 'adminOk' }
  | { t: 'adminRooms'; rooms: (RoomSummary & { list: PlayerInfo[]; state: GameState | null })[] }
