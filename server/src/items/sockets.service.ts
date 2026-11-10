import { Injectable } from '@nestjs/common'
import { CHARGE_SOCKET, HOSE_SOCKETS, MOSAIC_SOCKETS, dist, type Socket } from '../../../shared/level.ts'
import type { ItemState } from '../../../shared/protocol.ts'
import { ChargePuzzle } from '../puzzles/charge.puzzle.ts'
import { MosaicPuzzle } from '../puzzles/mosaic.puzzle.ts'
import { PowerPuzzle } from '../puzzles/power.puzzle.ts'
import { PumpPuzzle } from '../puzzles/pump.puzzle.ts'
import { RoomChannel } from '../rooms/room-channel.service.ts'
import type { Member, Room } from '../rooms/room.ts'

/**
 * Sockets are the places an item snaps into: cells into the power panel, the charge at the collapse,
 * tiles into the mosaic frame, hoses into the pump. Snapping an item tells the puzzle it belongs to.
 */
@Injectable()
export class SocketsService {
  constructor(
    private readonly channel: RoomChannel,
    private readonly power: PowerPuzzle,
    private readonly charge: ChargePuzzle,
    private readonly mosaic: MosaicPuzzle,
    private readonly pump: PumpPuzzle,
  ) {}

  /** The nearest free socket that accepts the item and is within reach of where it was dropped. */
  find(room: Room, it: ItemState): Socket | null {
    const s = room.state!
    const candidates: Socket[] =
      it.kind === 'cell' ? room.sockets
      : it.kind === 'charge' ? [CHARGE_SOCKET]
      : it.kind === 'tile' ? MOSAIC_SOCKETS
      : it.kind === 'hose' ? HOSE_SOCKETS
      : []
    if (it.kind === 'cell' && s.phase !== 'power') return null
    if (it.kind === 'charge' && s.phase !== 'charge') return null
    const taken = new Set([...room.items.values()].map((o) => o.socket).filter(Boolean))
    const reach = it.kind === 'tile' ? 0.5 : 0.85
    let best: Socket | null = null
    let bestD = reach
    for (const sk of candidates) {
      if (sk.accepts !== it.kind || taken.has(sk.id)) continue
      const d = dist(it.p, sk.pos)
      if (d < bestD) {
        best = sk
        bestD = d
      }
    }
    return best
  }

  snap(room: Room, it: ItemState, socket: Socket, by: Member) {
    it.p = [...socket.pos]
    it.q = socket.q ?? [0, 0, 0, 1]
    it.socket = socket.id
    it.owner = null
    it.holder = null
    this.channel.broadcast(room, { t: 'item', item: it })
    if (it.kind === 'cell') this.power.onCellInserted(room, it, by)
    if (it.kind === 'tile') this.mosaic.onTilePlaced(room)
    if (it.kind === 'hose') this.pump.onHoseConnected(room)
    if (it.kind === 'charge') this.charge.onChargePlaced(room)
  }
}
