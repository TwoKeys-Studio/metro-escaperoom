import { Injectable } from '@nestjs/common'
import { PhaseService } from '../game/phase.service.ts'
import type { Room } from '../rooms/room.ts'

/**
 * Phase `charge` needs four things in any order: the charge at the collapse, the junction levers
 * matching the schematic, the arming code, and gas pressure from the rig on the second floor. Each of
 * those puzzles calls `check` after it changes.
 */
@Injectable()
export class ChargeStage {
  constructor(private readonly phase: PhaseService) {}

  check(room: Room) {
    const s = room.state!
    if (s.phase === 'charge' && s.chargePlaced && s.leversOk && s.armCodeOk && s.gasOk) this.phase.setPhase(room, 'arm')
  }
}
