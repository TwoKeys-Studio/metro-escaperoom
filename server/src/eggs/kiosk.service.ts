import { Injectable } from '@nestjs/common'
import { POEMS } from '../../../shared/level.ts'
import { addTime, doorCodeDigits } from '../game/rules.ts'
import { RoomChannel } from '../rooms/room-channel.service.ts'
import type { Room } from '../rooms/room.ts'

const SOLVED: Record<string, string> = {
  caesar: 'Шифр «Литейной» разгадан',
  poem: 'Стихи машиниста прочитаны',
  morse: 'Морзянка расшифрована',
}

/**
 * Hard easter eggs. Three ciphers are hidden around the map (Caesar on the branch B wall, the driver's
 * acrostic poem, a lamp blinking Morse); answers are typed at the hall kiosk. Each one gives +60 s and
 * makes the dispatcher give away the next secret the team still needs.
 */
@Injectable()
export class KioskService {
  constructor(private readonly channel: RoomChannel) {}

  answer(room: Room, raw: string) {
    const s = room.state
    if (!s) return
    const text = raw.toUpperCase().replace(/Ё/g, 'Е').replace(/[^А-ЯA-Z0-9]/g, '')
    const answers: Record<string, string> = { caesar: room.caesarPlain, poem: POEMS[s.poem].answer, morse: s.morse }
    const hit = Object.entries(answers).find(([, a]) => a === text)
    if (!hit) {
      this.channel.say(room, 'ДИСПЕТЧЕР: Инфокиоск не понимает. Попробуйте думать.')
      return
    }
    const [id] = hit
    if (s.eggsFound.includes(id)) {
      this.channel.say(room, 'ДИСПЕТЧЕР: Это вы уже разгадали.')
      return
    }
    s.eggsFound.push(id)
    addTime(s, 60)
    this.channel.say(room, `ДИСПЕТЧЕР: ${SOLVED[id]}. +60 секунд.`)
    setTimeout(() => this.reveal(room), 2500)
    this.channel.sendGame(room)
  }

  /** Gives away the first unsolved secret: door code, then lever schematic, then arming code; after that, +30 s. */
  private reveal(room: Room) {
    const s = room.state
    if (!s) return
    let text = 'ДИСПЕТЧЕР: Секретов больше нет. Держите ещё 30 секунд.'
    if (!s.doorOpen && !s.reveals.includes('code')) {
      s.reveals.push('code')
      text = `ДИСПЕТЧЕР: Секрет: код служебного шлюза — ${doorCodeDigits(s).join(' ')}.`
    } else if (!s.leversOk && !s.reveals.includes('levers')) {
      s.reveals.push('levers')
      text = `ДИСПЕТЧЕР: Секрет: рычаги в тоннеле, слева направо — ${s.leverTarget.map((v) => (v ? 'вверх' : 'вниз')).join(', ')}.`
    } else if (!s.armCodeOk && !s.reveals.includes('arm')) {
      s.reveals.push('arm')
      text = `ДИСПЕТЧЕР: Секрет: код взвода детонатора — ${s.armCode.split('').join(' ')}.`
    } else addTime(s, 30)
    this.channel.say(room, text)
    this.channel.sendGame(room)
  }
}
