import { Injectable } from '@nestjs/common'
import { CAESAR_SHIFT, CAESAR_WORDS, POEMS, VENDING_POS, caesar, dist } from '../../../shared/level.ts'
import type { GameState } from '../../../shared/protocol.ts'
import { pick } from '../common/random.ts'
import { LINES } from '../game/dispatcher.lines.ts'
import { RoomChannel } from '../rooms/room-channel.service.ts'
import type { Member, Room } from '../rooms/room.ts'

const MAX_CANS = 6

/** Simple easter eggs: the robot cat Pixel, the «Неон-кола» vending machine, the 1977 train car. */
@Injectable()
export class EggsService {
  constructor(private readonly channel: RoomChannel) {}

  /** Also picks this run's answers for the kiosk ciphers (see `KioskService`). */
  setup(room: Room): Pick<GameState, 'eggs' | 'eggsFound' | 'caesar' | 'poem' | 'morse' | 'reveals'> {
    room.vendingCount = 0
    room.caesarPlain = pick(CAESAR_WORDS)
    return {
      eggs: room.state?.eggs ?? true,
      eggsFound: [],
      caesar: caesar(room.caesarPlain, CAESAR_SHIFT),
      poem: Math.floor(Math.random() * POEMS.length),
      morse: String(100 + Math.floor(Math.random() * 900)),
      reveals: [],
    }
  }

  /** Marks an egg as found (once, and only while the admin has eggs enabled). */
  find(room: Room, id: string) {
    const s = room.state
    if (!s || !s.eggs || s.eggsFound.includes(id)) return
    s.eggsFound.push(id)
    if (LINES.eggs[id]) this.channel.say(room, LINES.eggs[id])
    if (id === 'pixel') {
      s.timeLeft += 30
      this.channel.say(room, 'ДИСПЕТЧЕР: Пиксель мурлычет. +30 секунд.')
    }
    this.channel.sendGame(room)
  }

  /** The vending machine drops a can next to itself; the first one counts as an egg. */
  vend(room: Room, member: Member) {
    if (room.vendingCount >= MAX_CANS || dist(member.tf.p, VENDING_POS) > 4) return
    const can = room.addItem(`cola${room.vendingCount++}`, 'can', [VENDING_POS[0], 0.35, VENDING_POS[2] + 0.55])
    this.channel.broadcast(room, { t: 'item', item: can })
    if (room.vendingCount === 1) this.find(room, 'vending')
  }
}
