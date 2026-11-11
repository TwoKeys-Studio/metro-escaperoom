import { Injectable } from '@nestjs/common'
import { DIFFICULTIES } from '../../../shared/level.ts'
import type { Phase } from '../../../shared/protocol.ts'
import { RoomChannel } from '../rooms/room-channel.service.ts'
import type { Room } from '../rooms/room.ts'
import { LINES } from './dispatcher.lines.ts'
import { doorCodeDigits } from './rules.ts'

/**
 * Moves a game from one phase to the next:
 * intro → power → access → charge → arm → evac → escape → won / lost.
 * Puzzles decide *when* a phase is over; this service does what entering the next one involves.
 */
@Injectable()
export class PhaseService {
  constructor(private readonly channel: RoomChannel) {}

  setPhase(room: Room, phase: Phase) {
    const s = room.state
    if (!s) return
    s.phase = phase
    const cfg = DIFFICULTIES[room.difficulty]
    const hints = cfg.hints || room.solo
    const say = (text: string) => this.channel.say(room, text)

    if (phase === 'power') {
      say(LINES.power)
      if (room.solo) setTimeout(() => say('ДИСПЕТЧЕР: Тренировка. Ромбы над предметами покажут, куда идти. Щит питания — у задней стены зала.'), 4000)
    }
    if (phase === 'access') {
      say(LINES.powerOn)
      if (hints) {
        const code = doorCodeDigits(s).join(' ')
        setTimeout(() => say(`ДИСПЕТЧЕР: Подсказка для слабых. Код — ${code}.`), 6000)
      }
    }
    if (phase === 'charge') {
      say(LINES.access)
      if (hints) setTimeout(() => say('ДИСПЕТЧЕР: Заряд — к завалу в конце восточного тоннеля. Рычаги — на стене тоннеля, схема — в техкомнате. Код взвода спрятан в мозаике ветки Б, вход через переход в восточной стене зала. Газ для детонатора — на втором этаже: лестница из техкомнаты, три баллона в рампу котельной, редукторы по подсказкам. Камеру хранения открывают рубильники диспетчерской.'), 5000)
    }
    if (phase === 'arm') say(room.alivePlayers() === 1 ? 'ДИСПЕТЧЕР: Вы один. Детонатор примет одного оператора. Держите любой пульт.' : LINES.levers)
    if (phase === 'evac') {
      s.evacLeft = cfg.evacSeconds
      say(LINES.evac)
    }
    if (phase === 'escape') {
      s.elevatorOpen = true
      say(LINES.blast)
    }
    if (phase === 'won') say(LINES.won)
    if (phase === 'lost') say(s.outcome ?? LINES.lost)
    this.channel.sendGame(room)
    this.channel.sendRoom(room)
  }

  /** Ends the game as lost when nobody is left alive. Returns whether it did. */
  checkAllDead(room: Room) {
    if (!room.state) return false
    if (room.alivePlayers() === 0 && room.members.size > 0) {
      room.state.outcome = 'ДИСПЕТЧЕР: Никто не выжил. Станция снова тихая.'
      this.setPhase(room, 'lost')
      return true
    }
    return false
  }
}
