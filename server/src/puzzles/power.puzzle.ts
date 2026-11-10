import { Injectable } from '@nestjs/common'
import { powerSockets, type DifficultyConfig } from '../../../shared/level.ts'
import type { GameState, ItemState } from '../../../shared/protocol.ts'
import { LINES } from '../game/dispatcher.lines.ts'
import { PhaseService } from '../game/phase.service.ts'
import { RoomChannel } from '../rooms/room-channel.service.ts'
import type { Member, Room } from '../rooms/room.ts'

/** Phase `power`: put energy cells into the panel. Overloaded (fake) cells shock and burn out. */
@Injectable()
export class PowerPuzzle {
  constructor(private readonly channel: RoomChannel, private readonly phase: PhaseService) {}

  setup(room: Room, cfg: DifficultyConfig): Pick<GameState, 'power' | 'sockets'> {
    room.sockets = powerSockets(cfg.cells)
    return { power: false, sockets: room.sockets.map((s) => s.id) }
  }

  onCellInserted(room: Room, cell: ItemState, by: Member) {
    const s = room.state!
    if (cell.fake) {
      this.channel.broadcast(room, { t: 'shock', playerId: by.info.id })
      this.channel.broadcast(room, { t: 'event', type: 'blackout' })
      this.channel.say(room, LINES.fake)
      setTimeout(() => {
        room.items.delete(cell.id)
        this.channel.sendGame(room)
      }, 1600)
      return
    }
    const items = [...room.items.values()]
    const filled = room.sockets.filter((sk) => items.some((o) => o.socket === sk.id && !o.fake)).length
    if (filled >= room.sockets.length) {
      s.power = true
      this.phase.setPhase(room, 'access')
    } else {
      this.channel.say(room, `ДИСПЕТЧЕР: Ячейка принята. ${filled} из ${room.sockets.length}.`)
      this.channel.sendGame(room)
    }
  }
}
