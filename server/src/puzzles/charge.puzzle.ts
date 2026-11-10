import { Injectable } from '@nestjs/common'
import type { GameState } from '../../../shared/protocol.ts'
import { LINES } from '../game/dispatcher.lines.ts'
import { RoomChannel } from '../rooms/room-channel.service.ts'
import type { Room } from '../rooms/room.ts'
import { ChargeStage } from './charge-stage.service.ts'

/** Carry the heavy charge from the maintenance room to the collapse in the east tunnel. */
@Injectable()
export class ChargePuzzle {
  constructor(private readonly channel: RoomChannel, private readonly stage: ChargeStage) {}

  setup(): Pick<GameState, 'chargePlaced'> {
    return { chargePlaced: false }
  }

  onChargePlaced(room: Room) {
    room.state!.chargePlaced = true
    this.channel.say(room, LINES.chargePlaced)
    this.stage.check(room)
    this.channel.sendGame(room)
  }
}
