import { Injectable } from '@nestjs/common'
import { BREAKER_COUNT } from '../../../shared/level.ts'
import type { GameState } from '../../../shared/protocol.ts'
import type { Client } from '../connection/client.ts'
import { RoomChannel } from '../rooms/room-channel.service.ts'
import type { Room } from '../rooms/room.ts'

/**
 * Second floor, dispatch room: six breakers. Set to the pattern hidden in the clues around the floor,
 * they unlock the storage room, where the last gas cylinder is kept.
 */
@Injectable()
export class BreakersPuzzle {
  constructor(private readonly channel: RoomChannel) {}

  setup(): Pick<GameState, 'breakers' | 'breakerTarget' | 'storageOpen'> {
    // three of the six are up: never the all-down state the breakers start in
    const up = new Set<number>()
    while (up.size < 3) up.add(Math.floor(Math.random() * BREAKER_COUNT))
    return {
      breakers: Array<boolean>(BREAKER_COUNT).fill(false),
      breakerTarget: Array.from({ length: BREAKER_COUNT }, (_, i) => up.has(i)),
      storageOpen: false,
    }
  }

  toggle(room: Room, client: Client, index: number) {
    const s = room.state!
    // the floor is only reachable through the service door
    if (!s.doorOpen || s.storageOpen || !Number.isInteger(index) || index < 0 || index >= BREAKER_COUNT) return
    s.breakers[index] = !s.breakers[index]
    if (s.breakers.every((v, i) => v === s.breakerTarget[i])) {
      s.storageOpen = true
      this.channel.broadcast(room, { t: 'event', type: 'glitch', target: client.id })
      this.channel.say(room, 'ДИСПЕТЧЕР: Камера хранения разблокирована. Я не открывал её с семьдесят седьмого. Там кто-то... что-то осталось.')
    }
    this.channel.sendGame(room)
  }
}
