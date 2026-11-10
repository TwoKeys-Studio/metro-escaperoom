import { Injectable } from '@nestjs/common'
import { LEVER_COUNT } from '../../../shared/level.ts'
import type { GameState } from '../../../shared/protocol.ts'
import { RoomChannel } from '../rooms/room-channel.service.ts'
import type { Room } from '../rooms/room.ts'
import { ChargeStage } from './charge-stage.service.ts'

/** Levers on the tunnel junction box must match the schematic shown in the maintenance room. */
@Injectable()
export class JunctionLeversPuzzle {
  constructor(private readonly channel: RoomChannel, private readonly stage: ChargeStage) {}

  setup(): Pick<GameState, 'levers' | 'leverTarget' | 'leversOk'> {
    const leverTarget = Array.from({ length: LEVER_COUNT }, () => Math.random() > 0.5)
    // all levers start down, so an all-down target would be solved before anyone touches it
    if (leverTarget.every((v) => !v)) leverTarget[1] = true
    return { levers: Array(LEVER_COUNT).fill(false), leverTarget, leversOk: false }
  }

  toggle(room: Room, index: number) {
    const s = room.state!
    if (!s.doorOpen || index < 0 || index >= LEVER_COUNT) return
    if (s.phase !== 'charge') return
    s.levers[index] = !s.levers[index]
    s.leversOk = s.levers.every((v, i) => v === s.leverTarget[i])
    this.stage.check(room)
    this.channel.sendGame(room)
  }
}
