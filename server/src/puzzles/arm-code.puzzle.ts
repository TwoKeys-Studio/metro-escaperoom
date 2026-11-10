import { Injectable } from '@nestjs/common'
import type { GameState } from '../../../shared/protocol.ts'
import type { Client } from '../connection/client.ts'
import { RoomChannel } from '../rooms/room-channel.service.ts'
import type { Room } from '../rooms/room.ts'
import { ChargeStage } from './charge-stage.service.ts'

/** The detonator arming code. Players read it off the finished mosaic and type it at the arming terminal. */
@Injectable()
export class ArmCodePuzzle {
  constructor(private readonly channel: RoomChannel, private readonly stage: ChargeStage) {}

  setup(): Pick<GameState, 'armCode' | 'armCodeOk'> {
    return { armCode: String(1000 + Math.floor(Math.random() * 9000)), armCodeOk: false }
  }

  submit(room: Room, client: Client, code: string) {
    const s = room.state!
    if (s.phase !== 'charge' || s.armCodeOk) return
    if (code === s.armCode) {
      s.armCodeOk = true
      this.channel.say(room, 'ДИСПЕТЧЕР: Код взвода принят. Детонатор ждёт заряд и цепь.')
      this.stage.check(room)
      this.channel.sendGame(room)
    } else {
      this.channel.broadcast(room, { t: 'event', type: 'glitch', target: client.id })
      this.channel.say(room, 'ДИСПЕТЧЕР: Код взвода неверен. Мозаика не врёт — врут глаза.')
    }
  }
}
