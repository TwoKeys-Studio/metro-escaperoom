import { Injectable } from '@nestjs/common'
import { GAS_COUNT, GAS_DIAL_STEPS, GAS_SOCKETS } from '../../../shared/level.ts'
import type { GameState } from '../../../shared/protocol.ts'
import { RoomChannel } from '../rooms/room-channel.service.ts'
import type { Room } from '../rooms/room.ts'
import { ChargeStage } from './charge-stage.service.ts'

/**
 * Second floor, boiler room: the gas rig that feeds the detonator. Three cylinders have to be carried
 * into it, then each regulator is clicked round to its pressure. The pressures are written, plainly and
 * in riddles, in the other rooms. Part of the `charge` stage: see ChargeStage.
 */
@Injectable()
export class GasPuzzle {
  constructor(private readonly channel: RoomChannel, private readonly stage: ChargeStage) {}

  setup(): Pick<GameState, 'gasLoaded' | 'gasDials' | 'gasTarget' | 'gasOk'> {
    return {
      gasLoaded: 0,
      gasDials: Array<number>(GAS_COUNT).fill(0),
      // 1..5: zero is where the regulators start, so no target is solved by doing nothing
      gasTarget: Array.from({ length: GAS_COUNT }, () => 1 + Math.floor(Math.random() * (GAS_DIAL_STEPS - 1))),
      gasOk: false,
    }
  }

  onCylinderLoaded(room: Room) {
    const s = room.state!
    const items = [...room.items.values()]
    s.gasLoaded = GAS_SOCKETS.filter((sk) => items.some((o) => o.socket === sk.id)).length
    this.channel.say(room, s.gasLoaded >= GAS_COUNT
      ? 'ДИСПЕТЧЕР: Все баллоны в рампе. Теперь давление. Каждый редуктор — на своё деление.'
      : `ДИСПЕТЧЕР: Баллон подключён (${s.gasLoaded}/${GAS_COUNT}).`)
    this.check(room)
    this.channel.sendGame(room)
  }

  turnDial(room: Room, index: number) {
    const s = room.state!
    if (!s.doorOpen || s.gasOk || !Number.isInteger(index) || index < 0 || index >= GAS_COUNT) return
    s.gasDials[index] = (s.gasDials[index] + 1) % GAS_DIAL_STEPS
    this.check(room)
    this.channel.sendGame(room)
  }

  private check(room: Room) {
    const s = room.state!
    if (s.gasOk || s.gasLoaded < GAS_COUNT || !s.gasDials.every((v, i) => v === s.gasTarget[i])) return
    s.gasOk = true
    this.channel.say(room, 'ДИСПЕТЧЕР: Давление в норме. Газ пошёл к детонатору. Слышите, как шипит? Это не газ.')
    this.stage.check(room)
  }
}
