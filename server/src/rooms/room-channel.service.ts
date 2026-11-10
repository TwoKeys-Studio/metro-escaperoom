import { Injectable } from '@nestjs/common'
import type { ServerMsg } from '../../../shared/protocol.ts'
import { send, type Client } from '../connection/client.ts'
import type { Room } from './room.ts'
import { RoomsService } from './rooms.service.ts'

/** Sending messages to everyone in a room (players and watching admins). */
@Injectable()
export class RoomChannel {
  constructor(private readonly rooms: RoomsService) {}

  broadcast(room: Room, msg: ServerMsg) {
    const data = JSON.stringify(msg)
    for (const m of room.members.values()) if (m.client.ws.readyState === 1) m.client.ws.send(data)
    for (const w of room.watchers) if (w.ws.readyState === 1) w.ws.send(data)
  }

  /** A line from the dispatcher AI (or from the admin speaking through it). */
  say(room: Room, text: string, from: 'ai' | 'admin' = 'ai') {
    this.broadcast(room, { t: 'say', from, text })
  }

  /** Who is in the room and which phase it is in. Also refreshes the menu's room list. */
  sendRoom(room: Room) {
    this.broadcast(room, { t: 'room', id: room.id, name: room.name, players: room.players(), difficulty: room.difficulty, phase: room.phase })
    this.rooms.requestListPush()
  }

  /** The whole game state and every item; to one client or to the room. */
  sendGame(room: Room, to?: Client) {
    if (!room.state) return
    // fake cells are sent too: the client only betrays them with a rare red twitch
    const msg: ServerMsg = { t: 'game', state: room.state, items: [...room.items.values()] }
    if (to) send(to, msg)
    else this.broadcast(room, msg)
  }
}
