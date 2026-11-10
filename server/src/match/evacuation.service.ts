import { Injectable } from '@nestjs/common'
import { CHARGE_SOCKET, PIT_Y, inEastTunnel, inElevator } from '../../../shared/level.ts'
import { PhaseService } from '../game/phase.service.ts'
import { RoomChannel } from '../rooms/room-channel.service.ts'
import type { Room } from '../rooms/room.ts'

/** The ending: countdown to the blast, the blast itself, and the elevator ride out. */
@Injectable()
export class EvacuationService {
  constructor(private readonly channel: RoomChannel, private readonly phase: PhaseService) {}

  /** Phase `evac`: counts down, then detonates. */
  tickCountdown(room: Room, dt: number) {
    const s = room.state!
    s.evacLeft = Math.max(0, s.evacLeft - dt)
    if (s.evacLeft <= 0) this.detonate(room)
  }

  /** Seals the east tunnel. Whoever is still inside dies; if anyone is left, the elevator opens. */
  private detonate(room: Room) {
    const s = room.state!
    s.blastDoorClosed = true
    s.water = Math.min(s.water, PIT_Y + 0.2)
    this.channel.broadcast(room, { t: 'event', type: 'quake', at: CHARGE_SOCKET.pos })
    for (const m of room.members.values()) {
      if (m.info.alive && inEastTunnel(m.tf.p)) {
        m.info.alive = false
        this.channel.say(room, `ДИСПЕТЧЕР: Пассажир ${m.info.name} остался в тоннеле.`)
      }
    }
    this.channel.sendRoom(room)
    if (this.phase.checkAllDead(room)) return
    this.phase.setPhase(room, 'escape')
  }

  /** Phase `escape`: the water recedes, and the game is won once every living player is in the elevator. */
  tickEscape(room: Room, dt: number) {
    const s = room.state!
    s.water = Math.max(PIT_Y - 0.5, s.water - dt * 0.02)
    let alive = 0
    let inside = 0
    for (const m of room.members.values()) {
      if (!m.info.alive) continue
      alive++
      if (inElevator(m.tf.p)) inside++
    }
    if (alive > 0 && inside === alive) {
      for (const m of room.members.values()) if (m.info.alive) m.info.escaped = true
      this.phase.setPhase(room, 'won')
    }
  }
}
