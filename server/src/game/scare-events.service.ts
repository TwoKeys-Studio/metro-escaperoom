import { Injectable } from '@nestjs/common'
import type { EventType } from '../../../shared/protocol.ts'
import { pick } from '../common/random.ts'
import { RoomChannel } from '../rooms/room-channel.service.ts'
import type { Room } from '../rooms/room.ts'
import { LINES } from './dispatcher.lines.ts'

/** Scares: blackout, ghost train, quake, whisper, shadow, glitch, scream. Random on a timer, or picked by the admin. */
@Injectable()
export class ScareEventsService {
  constructor(private readonly channel: RoomChannel) {}

  /** Plays `type` (random when omitted) aimed at a random living player. */
  trigger(room: Room, type?: EventType, announce = true) {
    if (!room.state) return
    const alive = [...room.members.values()].filter((m) => m.info.alive)
    const t = type ?? pick<EventType>(['blackout', 'ghostTrain', 'quake', 'whisper', 'shadow', 'glitch', 'shadow', 'whisper'])
    const target = pick(alive)?.info.id
    this.channel.broadcast(room, { t: 'event', type: t, target })
    if (announce && Math.random() < 0.55) setTimeout(() => this.channel.say(room, pick(LINES.creepy)), 1500)
  }
}
