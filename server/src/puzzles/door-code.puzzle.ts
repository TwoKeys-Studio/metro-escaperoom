import { Injectable } from '@nestjs/common'
import type { GameState } from '../../../shared/protocol.ts'
import { pick, shuffle } from '../common/random.ts'
import type { Client } from '../connection/client.ts'
import { LINES } from '../game/dispatcher.lines.ts'
import { PhaseService } from '../game/phase.service.ts'
import { doorCodeDigits } from '../game/rules.ts'
import { RoomChannel } from '../rooms/room-channel.service.ts'
import type { Room } from '../rooms/room.ts'

/** Phase `access`: four neon signs show digits, the route map gives their order, the keypad opens the service door. */
@Injectable()
export class DoorCodePuzzle {
  constructor(private readonly channel: RoomChannel, private readonly phase: PhaseService) {}

  setup(): Pick<GameState, 'doorOpen' | 'codeDigits' | 'codeOrder'> {
    return {
      doorOpen: false,
      codeDigits: Array.from({ length: 4 }, () => Math.floor(Math.random() * 10)),
      codeOrder: shuffle([0, 1, 2, 3]),
    }
  }

  submit(room: Room, client: Client, code: string) {
    const s = room.state!
    if (s.phase !== 'access' || !s.power) return
    if (code === doorCodeDigits(s).join('')) {
      s.doorOpen = true
      this.phase.setPhase(room, 'charge')
      return
    }
    this.channel.broadcast(room, { t: 'event', type: 'glitch', target: client.id })
    this.channel.say(room, pick(LINES.wrongCode))
    if (room.difficulty === 'hard' || room.difficulty === 'nightmare') {
      s.timeLeft = Math.max(1, s.timeLeft - 15)
      this.channel.say(room, 'ДИСПЕТЧЕР: Штраф: минус 15 секунд.')
    }
  }
}
