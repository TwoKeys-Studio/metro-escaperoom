import { create } from 'zustand'
import type { Difficulty } from '../../shared/level'
import type {
  ClientMsg, EventType, GameState, ItemState, PlayerInfo, PlayerTf, RoomSummary, ServerMsg,
} from '../../shared/protocol'

export interface FeedLine { id: number; from: 'ai' | 'admin' | 'chat'; name?: string; color?: string; text: string; at: number }
export interface RoomInfo { id: string; name: string; players: PlayerInfo[]; difficulty: Difficulty; phase: GameState['phase'] }
type AdminRoom = RoomSummary & { list: PlayerInfo[]; state: GameState | null }

interface NetStore {
  connected: boolean
  myId: string | null
  name: string
  rooms: RoomSummary[]
  room: RoomInfo | null
  game: GameState | null
  items: Record<string, ItemState>
  feed: FeedLine[]
  error: string | null
  leftReason: string | null
  admin: boolean
  adminRooms: AdminRoom[]
  setName: (n: string) => void
  send: (m: ClientMsg) => void
  clearError: () => void
}

// Hot data that changes every frame: kept outside React to avoid re-renders.
export const live = {
  players: new Map<string, PlayerTf>(),
  items: new Map<string, { p: [number, number, number]; q: [number, number, number, number] }>(),
  time: 0,
  water: -2,
  shake: 0,
  blackoutUntil: 0,
  glitchUntil: 0,
  shockUntil: 0,
  flashUntil: 0,
  events: [] as { type: EventType; target?: string; at?: [number, number, number]; t: number }[],
  me: { p: [0, 1, 0] as [number, number, number], yaw: 0, pitch: 0 },
  battery: 100,
}

let ws: WebSocket | null = null
let feedSeq = 0
const queue: string[] = []

const savedName = (() => {
  try {
    return localStorage.getItem('neon17.name') ?? ''
  } catch {
    return ''
  }
})()

export const useNet = create<NetStore>((set, get) => ({
  connected: false,
  myId: null,
  name: savedName,
  rooms: [],
  room: null,
  game: null,
  items: {},
  feed: [],
  error: null,
  leftReason: null,
  admin: false,
  adminRooms: [],
  setName: (name) => {
    set({ name })
    try {
      localStorage.setItem('neon17.name', name)
    } catch {
      /* private mode */
    }
    get().send({ t: 'hello', name })
  },
  send: (m) => {
    const data = JSON.stringify(m)
    if (ws && ws.readyState === 1) ws.send(data)
    else {
      queue.push(data)
      connect()
    }
  },
  clearError: () => set({ error: null }),
}))

function pushFeed(line: Omit<FeedLine, 'id' | 'at'>) {
  const feed = [...useNet.getState().feed, { ...line, id: ++feedSeq, at: performance.now() }].slice(-40)
  useNet.setState({ feed })
}

export function connect() {
  if (ws && (ws.readyState === 0 || ws.readyState === 1)) return
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  ws = new WebSocket(`${proto}://${location.host}/ws`)
  ws.onopen = () => {
    useNet.setState({ connected: true })
    const name = useNet.getState().name
    if (name) ws!.send(JSON.stringify({ t: 'hello', name }))
    while (queue.length) ws!.send(queue.shift()!)
  }
  ws.onclose = () => {
    useNet.setState({ connected: false, room: null, game: null, admin: false })
    setTimeout(connect, 1500)
  }
  ws.onmessage = (e) => onMessage(JSON.parse(e.data) as ServerMsg)
}

function onMessage(msg: ServerMsg) {
  switch (msg.t) {
    case 'welcome':
      useNet.setState({ myId: msg.id })
      return
    case 'rooms':
      useNet.setState({ rooms: msg.rooms })
      return
    case 'room': {
      const prev = useNet.getState().room
      useNet.setState({
        room: { id: msg.id, name: msg.name, players: msg.players, difficulty: msg.difficulty, phase: msg.phase },
        leftReason: null,
      })
      if (msg.phase === 'lobby') useNet.setState({ game: null, items: {} })
      if (!prev || prev.id !== msg.id) useNet.setState({ feed: [] })
      return
    }
    case 'left':
      useNet.setState({ room: null, game: null, items: {}, leftReason: msg.reason ?? null })
      return
    case 'error':
      useNet.setState({ error: msg.text })
      setTimeout(() => useNet.getState().error === msg.text && useNet.setState({ error: null }), 4000)
      return
    case 'game': {
      const items: Record<string, ItemState> = {}
      for (const it of msg.items) {
        items[it.id] = it
        if (!live.items.has(it.id) || !it.owner) live.items.set(it.id, { p: it.p, q: it.q })
      }
      for (const id of [...live.items.keys()]) if (!items[id]) live.items.delete(id)
      live.water = msg.state.water
      live.time = msg.state.timeLeft
      useNet.setState({ game: msg.state, items })
      return
    }
    case 'item': {
      live.items.set(msg.item.id, { p: msg.item.p, q: msg.item.q })
      useNet.setState({ items: { ...useNet.getState().items, [msg.item.id]: msg.item } })
      return
    }
    case 'tick': {
      live.time = msg.time
      live.water = msg.water
      const seen = new Set<string>()
      for (const [id, tf] of Object.entries(msg.players)) {
        live.players.set(id, tf)
        seen.add(id)
      }
      for (const id of [...live.players.keys()]) if (!seen.has(id)) live.players.delete(id)
      for (const it of msg.items) live.items.set(it.id, { p: it.p, q: it.q })
      return
    }
    case 'event': {
      const now = performance.now()
      live.events.push({ type: msg.type, target: msg.target, at: msg.at, t: now })
      if (live.events.length > 20) live.events.shift()
      if (msg.type === 'blackout') live.blackoutUntil = now + 6500
      if (msg.type === 'glitch') live.glitchUntil = now + 1400
      if (msg.type === 'quake') live.shake = Math.max(live.shake, msg.at ? 1.6 : 1)
      return
    }
    case 'shock':
      if (msg.playerId === useNet.getState().myId) {
        live.shockUntil = performance.now() + 1800
        live.shake = 1.2
      }
      return
    case 'say':
      pushFeed({ from: msg.from, text: msg.text })
      return
    case 'chat':
      pushFeed({ from: 'chat', name: msg.name, color: msg.color, text: msg.text })
      return
    case 'adminOk':
      useNet.setState({ admin: true })
      return
    case 'adminRooms':
      useNet.setState({ adminRooms: msg.rooms })
      return
  }
}

export const send = (m: ClientMsg) => useNet.getState().send(m)
