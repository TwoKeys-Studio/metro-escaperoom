import type { WebSocket } from 'ws'
import type { ClientMsg, ServerMsg } from '../../../shared/protocol.ts'
import type { Room } from '../rooms/room.ts'

/** One browser tab connected over WebSocket. */
export interface Client {
  id: string
  ws: WebSocket
  name: string
  /** Room the client plays in. */
  room: Room | null
  admin: boolean
  /** Room an admin is spectating. */
  watching: Room | null
}

/** The raw socket with our `Client` attached on connection. */
export type GameSocket = WebSocket & { client?: Client }

/** A client message of one kind, e.g. `Msg<'grab'>`. */
export type Msg<T extends ClientMsg['t']> = Extract<ClientMsg, { t: T }>

export function send(client: Client, msg: ServerMsg) {
  if (client.ws.readyState === 1) client.ws.send(JSON.stringify(msg))
}
