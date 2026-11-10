import { Injectable } from '@nestjs/common'
import { TLEVER_COUNT } from '../../../shared/level.ts'
import type { GameState } from '../../../shared/protocol.ts'
import { RoomChannel } from '../rooms/room-channel.service.ts'
import type { Room } from '../rooms/room.ts'

const flip = (lamps: boolean[], index: number) => {
  for (const j of [index - 1, index, index + 1]) if (j >= 0 && j < TLEVER_COUNT) lamps[j] = !lamps[j]
}

/** «Зажги все огни»: each lever flips its lamp and the neighbours. All lit opens the transfer to branch B. */
@Injectable()
export class TransferDoorPuzzle {
  constructor(private readonly channel: RoomChannel) {}

  setup(): Pick<GameState, 'transferLamps' | 'transferOpen'> {
    // start solved, then press a few random levers — always solvable
    const lamps = Array<boolean>(TLEVER_COUNT).fill(true)
    do {
      for (let k = 0; k < 3; k++) flip(lamps, Math.floor(Math.random() * TLEVER_COUNT))
    } while (lamps.every(Boolean))
    return { transferLamps: lamps, transferOpen: false }
  }

  pull(room: Room, index: number) {
    const s = room.state!
    if (!s.power || s.transferOpen || index < 0 || index >= TLEVER_COUNT) return
    flip(s.transferLamps, index)
    if (s.transferLamps.every(Boolean)) {
      s.transferOpen = true
      this.channel.say(room, 'ДИСПЕТЧЕР: Переход на ветку Б открыт. «Литейная» не принимала пассажиров сорок лет.')
    }
    this.channel.sendGame(room)
  }
}
