import { Injectable } from '@nestjs/common'
import { HOSE_SOCKETS, PUMP_TIME_BONUS, PUMP_TIME_PER_HOSE } from '../../../shared/level.ts'
import type { GameState } from '../../../shared/protocol.ts'
import { shuffle } from '../common/random.ts'
import type { Client } from '../connection/client.ts'
import { addTime } from '../game/rules.ts'
import { RoomChannel } from '../rooms/room-channel.service.ts'
import type { Room } from '../rooms/room.ts'

/**
 * Optional side quest. Four valves, turned in the order of the riddle on the plaque, open the pump room;
 * every hose plugged into the pump buys time, and the third one starts the pump for a bonus.
 */
@Injectable()
export class PumpPuzzle {
  constructor(private readonly channel: RoomChannel) {}

  setup(): Pick<GameState, 'pumpOrder' | 'pumpProgress' | 'pumpDoorOpen' | 'hoses' | 'pumpOn'> {
    return { pumpOrder: shuffle([0, 1, 2, 3]), pumpProgress: 0, pumpDoorOpen: false, hoses: 0, pumpOn: false }
  }

  turnValve(room: Room, client: Client, index: number) {
    const s = room.state!
    if (!s.power || s.pumpDoorOpen || index < 0 || index > 3) return
    if (s.pumpOrder[s.pumpProgress] === index) {
      s.pumpProgress++
      if (s.pumpProgress >= 4) {
        s.pumpDoorOpen = true
        this.channel.say(room, 'ДИСПЕТЧЕР: Насосная открыта. Шланги — в насос. Каждый шланг — немного времени.')
      }
    } else {
      s.pumpProgress = 0
      this.channel.broadcast(room, { t: 'event', type: 'glitch', target: client.id })
    }
    this.channel.sendGame(room)
  }

  onHoseConnected(room: Room) {
    const s = room.state!
    const items = [...room.items.values()]
    s.hoses = HOSE_SOCKETS.filter((sk) => items.some((o) => o.socket === sk.id)).length
    addTime(s, PUMP_TIME_PER_HOSE)
    if (s.hoses >= HOSE_SOCKETS.length && !s.pumpOn) {
      s.pumpOn = true
      addTime(s, PUMP_TIME_BONUS)
      this.channel.say(room, `ДИСПЕТЧЕР: Насос запущен. Вода отступает. +${PUMP_TIME_PER_HOSE + PUMP_TIME_BONUS} с.`)
    } else this.channel.say(room, `ДИСПЕТЧЕР: Шланг подключён (${s.hoses}/3). Откачка +${PUMP_TIME_PER_HOSE} с.`)
    this.channel.sendGame(room)
  }
}
