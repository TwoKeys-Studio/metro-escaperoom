import { Injectable } from '@nestjs/common'
import { DIFFICULTIES } from '../../../shared/level.ts'
import type { PlayerTf } from '../../../shared/protocol.ts'
import { rnd } from '../common/random.ts'
import { LINES } from '../game/dispatcher.lines.ts'
import { PhaseService } from '../game/phase.service.ts'
import { ACTIVE_PHASES, waterLevel } from '../game/rules.ts'
import { ScareEventsService } from '../game/scare-events.service.ts'
import { DetonatorPuzzle } from '../puzzles/detonator.puzzle.ts'
import { RoomChannel } from '../rooms/room-channel.service.ts'
import type { Room } from '../rooms/room.ts'
import { EvacuationService } from './evacuation.service.ts'

const TICK_MS = 50

/** The heartbeat of a running game: 20 times a second it advances time and sends everyone the positions. */
@Injectable()
export class MatchLoopService {
  constructor(
    private readonly channel: RoomChannel,
    private readonly phase: PhaseService,
    private readonly scares: ScareEventsService,
    private readonly detonator: DetonatorPuzzle,
    private readonly evacuation: EvacuationService,
  ) {}

  ensureRunning(room: Room) {
    if (!room.timer) room.timer = setInterval(() => this.tick(room, TICK_MS / 1000), TICK_MS)
  }

  private tick(room: Room, dt: number) {
    const s = room.state
    if (!s) return
    if (!s.paused) {
      if (s.phase === 'intro') {
        room.phaseTimer -= dt
        if (room.phaseTimer <= 0) this.phase.setPhase(room, 'power')
      }
      if (ACTIVE_PHASES.includes(s.phase)) {
        s.timeLeft = Math.max(0, s.timeLeft - dt)
        s.water = waterLevel(1 - s.timeLeft / s.totalTime)
        if (s.timeLeft <= 0) {
          s.outcome = LINES.lost
          this.phase.setPhase(room, 'lost')
        }
        room.nextEventIn -= dt
        if (room.nextEventIn <= 0) {
          room.nextEventIn = rnd(...DIFFICULTIES[room.difficulty].eventEverySec)
          this.scares.trigger(room)
        }
      }
      if (s.phase === 'arm') this.detonator.tick(room, dt)
      if (s.phase === 'evac') this.evacuation.tickCountdown(room, dt)
      if (s.phase === 'escape') this.evacuation.tickEscape(room, dt)
    }

    // positions go out even while paused, so players still see each other move
    const players: Record<string, PlayerTf> = {}
    for (const [id, m] of room.members) players[id] = m.tf
    const items = [...room.dirtyItems].map((id) => room.items.get(id)).filter((it) => !!it).map((it) => ({ id: it.id, p: it.p, q: it.q }))
    room.dirtyItems.clear()
    this.channel.broadcast(room, { t: 'tick', time: s.timeLeft, water: s.water, players, items })
  }
}
