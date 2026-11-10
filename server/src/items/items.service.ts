import { Injectable } from '@nestjs/common'
import { CELL_SPOTS, CHARGE_SPAWN, HOSE_SPOTS, PROPS, TILE_SPOTS, dist, type DifficultyConfig, type Vec3 } from '../../../shared/level.ts'
import type { ItemState } from '../../../shared/protocol.ts'
import { shuffle } from '../common/random.ts'
import type { ActivePlayer } from '../connection/sender.decorator.ts'
import { EggsService } from '../eggs/eggs.service.ts'
import { MosaicPuzzle } from '../puzzles/mosaic.puzzle.ts'
import { RoomChannel } from '../rooms/room-channel.service.ts'
import type { Room } from '../rooms/room.ts'
import { SocketsService } from './sockets.service.ts'

type Quat = ItemState['q']

/** How far a player can reach to pick something up. */
const GRAB_RANGE = 4.5

/**
 * Things players carry and throw. An item has a `holder` (who carries it) and an `owner`: the client
 * that simulates its physics after a throw until it comes to rest. The server only checks and relays.
 */
@Injectable()
export class ItemsService {
  constructor(
    private readonly channel: RoomChannel,
    private readonly sockets: SocketsService,
    private readonly mosaic: MosaicPuzzle,
    private readonly eggs: EggsService,
  ) {}

  /** Places every item of a new game. Spots are shuffled so every run differs. */
  spawn(room: Room, cfg: DifficultyConfig) {
    room.items.clear()
    const cellSpots = shuffle([...CELL_SPOTS])
    const total = cfg.cells + cfg.fakeCells
    for (let i = 0; i < total; i++) room.addItem(`cell${i}`, 'cell', cellSpots[i % cellSpots.length], i >= cfg.cells)
    room.addItem('charge', 'charge', CHARGE_SPAWN)
    const tileSpots = shuffle([...TILE_SPOTS])
    for (let i = 0; i < 9; i++) room.addItem(`tile${i}`, 'tile', tileSpots[i])
    HOSE_SPOTS.forEach((p, i) => room.addItem(`hose${i}`, 'hose', p))
    for (const p of PROPS) room.addItem(p.id, p.kind, p.pos)
  }

  grab({ room, client, member }: ActivePlayer, id: string) {
    if (!member.info.alive) return
    const it = room.items.get(id)
    if (!it || it.holder) return
    // snapped items stay put, except mosaic tiles
    if (it.socket && !this.mosaic.takeOut(room, it)) return
    if (dist(it.p, member.tf.p) > GRAB_RANGE) return
    for (const other of room.items.values()) if (other.holder === client.id) return // one item at a time
    it.holder = client.id
    it.owner = client.id
    this.channel.broadcast(room, { t: 'item', item: it })
    if (it.kind === 'pixel') this.eggs.find(room, 'pixel')
  }

  /** Position updates from whoever carries or simulates the item; sent to the others with the next tick. */
  move({ room, client }: ActivePlayer, id: string, p: Vec3, q: Quat) {
    const it = room.items.get(id)
    if (!it || (it.holder !== client.id && it.owner !== client.id)) return
    it.p = p
    it.q = q
    room.dirtyItems.add(it.id)
  }

  /** The player let go (dropped or threw). The item snaps if it was released at a socket. */
  release({ room, client, member }: ActivePlayer, id: string, p: Vec3, q: Quat) {
    const it = room.items.get(id)
    if (!it || it.holder !== client.id) return
    it.holder = null
    it.p = p
    it.q = q
    const socket = this.sockets.find(room, it)
    if (socket) {
      this.sockets.snap(room, it, socket, member)
      return
    }
    it.owner = client.id
    this.channel.broadcast(room, { t: 'item', item: it })
  }

  /** A thrown item stopped moving. It can also land in a socket. */
  rest({ room, client, member }: ActivePlayer, id: string, p: Vec3, q: Quat) {
    const it = room.items.get(id)
    if (!it || it.owner !== client.id || it.holder) return
    it.p = p
    it.q = q
    it.owner = null
    const socket = this.sockets.find(room, it)
    if (socket) this.sockets.snap(room, it, socket, member)
    else this.channel.broadcast(room, { t: 'item', item: it })
  }

  /** A player left the room: whatever they carried or simulated is freed where it is. */
  dropAllOf(room: Room, clientId: string) {
    for (const it of room.items.values()) {
      if (it.holder === clientId || it.owner === clientId) {
        it.holder = null
        it.owner = null
        this.channel.broadcast(room, { t: 'item', item: it })
      }
    }
  }
}
