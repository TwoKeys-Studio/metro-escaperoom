import { Injectable } from '@nestjs/common'
import { MAX_PLAYERS, SPAWN } from '../../../shared/level.ts'
import type { PlayerInfo } from '../../../shared/protocol.ts'
import { pick } from '../common/random.ts'
import { send, type Client } from '../connection/client.ts'
import { PhaseService } from '../game/phase.service.ts'
import { ACTIVE_PHASES } from '../game/rules.ts'
import { ItemsService } from '../items/items.service.ts'
import { DetonatorPuzzle } from '../puzzles/detonator.puzzle.ts'
import { RoomChannel } from '../rooms/room-channel.service.ts'
import type { Room } from '../rooms/room.ts'

const COLORS = ['#22f0ff', '#ff2e88', '#e6ff3a', '#ff9a1f', '#3dff8a', '#4da3ff', '#ff5a3d', '#f2f2f2', '#00c2a8', '#ffd23d', '#ff6fd8', '#9cff2e']

/** Who is in a room: joining, leaving (also mid-game), being removed. */
@Injectable()
export class MembershipService {
  constructor(
    private readonly channel: RoomChannel,
    private readonly phase: PhaseService,
    private readonly items: ItemsService,
    private readonly detonator: DetonatorPuzzle,
  ) {}

  /** Why the room can't be joined, or `null` when it can. */
  canJoin(room: Room, password?: string): string | null {
    if (room.solo) return 'Это одиночная тренировка'
    if (room.members.size >= MAX_PLAYERS) return 'Комната заполнена (максимум 12)'
    if (room.phase !== 'lobby') return 'Игра уже идёт'
    if (room.password && room.password !== password) return 'Неверный пароль комнаты'
    return null
  }

  /** The first member becomes the host; everyone gets a colour nobody else in the room has. */
  add(room: Room, client: Client) {
    const used = new Set(room.players().map((p) => p.color))
    const color = COLORS.find((c) => !used.has(c)) ?? pick(COLORS)
    const info: PlayerInfo = {
      id: client.id, name: client.name, color, ready: false, host: room.members.size === 0, alive: true, escaped: false,
    }
    room.members.set(client.id, { client, info, tf: { p: [...SPAWN], yaw: 0, pitch: 0, crouch: false, flash: true } })
    client.room = room
    this.channel.sendRoom(room)
  }

  /** `reason` is shown to the removed player; omit it when their connection is already gone. */
  remove(room: Room, clientId: string, reason?: string) {
    const m = room.members.get(clientId)
    if (!m) return
    room.members.delete(clientId)
    m.client.room = null
    if (reason) send(m.client, { t: 'left', reason })
    this.items.dropAllOf(room, clientId)
    if (m.info.host) {
      const next = room.members.values().next().value
      if (next) next.info.host = true
    }
    if (room.state) this.detonator.releaseAll(room)
    this.channel.sendRoom(room)
    if (room.state && ACTIVE_PHASES.includes(room.state.phase)) this.phase.checkAllDead(room)
  }

  /** Closes the room for good and sends everyone back to the menu. */
  closeRoom(room: Room) {
    room.closed = true
    room.stopTimer()
    for (const id of [...room.members.keys()]) this.remove(room, id, 'Комнату закрыл администратор')
  }
}
