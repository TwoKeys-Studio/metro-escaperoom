import { Injectable } from '@nestjs/common'
import type { GameState } from '../../../shared/protocol.ts'
import { PhaseService } from '../game/phase.service.ts'
import { RoomChannel } from '../rooms/room-channel.service.ts'
import type { Member, Room } from '../rooms/room.ts'

/** Seconds both consoles must be held. */
const HOLD_SECONDS = 2.5

/** Phase `arm`: two players hold consoles A and B at the same time (one is enough when only one is alive). */
@Injectable()
export class DetonatorPuzzle {
  constructor(private readonly channel: RoomChannel, private readonly phase: PhaseService) {}

  setup(): Pick<GameState, 'detonator'> {
    return { detonator: { a: false, b: false, progress: 0 } }
  }

  hold(room: Room, member: Member, side: 'a' | 'b', down: boolean) {
    const s = room.state!
    if (s.phase !== 'arm' || !member.info.alive) return
    s.detonator[side] = down
    this.channel.sendGame(room)
  }

  /** Called every tick during `arm`: charges while enough consoles are held, drops to zero when one is released. */
  tick(room: Room, dt: number) {
    const s = room.state!
    const det = s.detonator
    const armedBy = (det.a ? 1 : 0) + (det.b ? 1 : 0)
    const step = dt / HOLD_SECONDS
    if (armedBy >= Math.min(2, room.alivePlayers())) {
      det.progress = Math.min(1, det.progress + step)
      if (det.progress >= 1) this.phase.setPhase(room, 'evac')
      // resend the state every 5 % so clients can draw the progress bar
      else if (Math.round(det.progress * 20) !== Math.round((det.progress - step) * 20)) this.channel.sendGame(room)
    } else if (det.progress > 0) {
      det.progress = 0
      this.channel.sendGame(room)
    }
  }

  /** A player left: holds are tracked per console, not per player, so both may be stale. */
  releaseAll(room: Room) {
    const s = room.state!
    if (s.phase !== 'arm') return
    s.detonator.a = false
    s.detonator.b = false
    s.detonator.progress = 0
  }
}
