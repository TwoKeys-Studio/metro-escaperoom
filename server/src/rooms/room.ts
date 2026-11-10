import type { Difficulty, ItemKind, Socket, Vec3 } from '../../../shared/level.ts'
import type { GameState, ItemState, Phase, PlayerInfo, PlayerTf, RoomSummary } from '../../../shared/protocol.ts'
import type { Client } from '../connection/client.ts'

export interface Member {
  client: Client
  info: PlayerInfo
  tf: PlayerTf
}

/**
 * Everything one room knows: who is in it and, while a game runs, the game itself.
 * This class only holds data and answers simple questions about it. The rules that change it live in
 * services (lobby, match, puzzles, items, eggs, admin), which all take the room as their first argument.
 */
export class Room {
  readonly id: string
  name: string
  difficulty: Difficulty
  password?: string
  /** Solo practice: one player, hints, objective markers. */
  solo = false
  closed = false

  readonly members = new Map<string, Member>()
  /** Admins spectating the room; they receive every broadcast. */
  readonly watchers = new Set<Client>()

  /** `null` in the lobby; set while a game is running or showing its end screen. */
  state: GameState | null = null
  readonly items = new Map<string, ItemState>()
  /** Power panel sockets of the current game (their number depends on difficulty). */
  sockets: Socket[] = []
  /** Items that moved since the last tick. */
  readonly dirtyItems = new Set<string>()

  timer: NodeJS.Timeout | null = null
  /** Seconds left of the intro cutscene. */
  phaseTimer = 0
  /** Seconds until the next random scare. */
  nextEventIn = 60
  vendingCount = 0
  /** Answer to the Caesar cipher on the branch B wall. */
  caesarPlain = ''

  constructor(id: string, name: string, difficulty: Difficulty, password?: string) {
    this.id = id
    this.name = name
    this.difficulty = difficulty
    this.password = password
  }

  get phase(): Phase {
    return this.state?.phase ?? 'lobby'
  }

  summary(): RoomSummary {
    return {
      id: this.id, name: this.name, players: this.members.size, phase: this.phase,
      difficulty: this.difficulty, locked: !!this.password,
    }
  }

  players(): PlayerInfo[] {
    return [...this.members.values()].map((m) => m.info)
  }

  alivePlayers() {
    return this.players().filter((p) => p.alive).length
  }

  addItem(id: string, kind: ItemKind, p: Vec3, fake = false) {
    const it: ItemState = { id, kind, p: [...p], q: [0, 0, 0, 1], holder: null, owner: null, socket: null }
    if (fake) it.fake = true
    this.items.set(id, it)
    return it
  }

  stopTimer() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }
}
