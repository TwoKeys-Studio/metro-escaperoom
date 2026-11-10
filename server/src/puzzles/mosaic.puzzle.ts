import { Injectable } from '@nestjs/common'
import { MOSAIC_SOCKETS } from '../../../shared/level.ts'
import type { GameState, ItemState } from '../../../shared/protocol.ts'
import { RoomChannel } from '../rooms/room-channel.service.ts'
import type { Room } from '../rooms/room.ts'

/** Nine tiles in the frame on the «Литейная» wall. Assembled in order, the mosaic shows the arming code. */
@Injectable()
export class MosaicPuzzle {
  constructor(private readonly channel: RoomChannel) {}

  setup(): Pick<GameState, 'mosaicDone'> {
    return { mosaicDone: false }
  }

  /** A tile may be pulled back out of the frame to rearrange it, until the mosaic is finished. */
  takeOut(room: Room, tile: ItemState) {
    const s = room.state!
    if (!tile.socket?.startsWith('mos') || s.mosaicDone) return false
    tile.socket = null
    s.mosaicDone = false
    return true
  }

  onTilePlaced(room: Room) {
    const s = room.state!
    const done = MOSAIC_SOCKETS.every((sk, i) => room.items.get(`tile${i}`)?.socket === sk.id)
    if (done && !s.mosaicDone) {
      s.mosaicDone = true
      this.channel.say(room, 'ДИСПЕТЧЕР: Мозаика «Литейной» собрана. Запомните число — оно взводит детонатор.')
    }
    this.channel.sendGame(room)
  }
}
