import type { INestApplicationContext } from '@nestjs/common'
import { WsAdapter } from '@nestjs/platform-ws'
import type { WebSocket, WebSocketServer } from 'ws'
import type { ClientMsg } from '../../../shared/protocol.ts'

/**
 * Maps the wire format `{ t: 'grab', ... }` onto Nest's `{ event, data }`, so gateways can use
 * `@SubscribeMessage('grab')` and receive the whole message as the body. Broken JSON is ignored.
 */
function parseClientMessage(raw: unknown): { event: string; data: ClientMsg } | void {
  try {
    const msg = JSON.parse(String(raw)) as ClientMsg
    return { event: msg.t, data: msg }
  } catch {
    return
  }
}

/** Nest's plain-WebSocket adapter, set up for this game's protocol. */
export class GameWsAdapter extends WsAdapter {
  constructor(app: INestApplicationContext) {
    super(app, { messageParser: parseClientMessage })
  }

  override create(port: number, options?: Record<string, any>) {
    const server: WebSocketServer = super.create(port, options)
    // every gateway listens on every socket, which is more listeners than Node's default warning limit
    server.on('connection', (ws: WebSocket) => ws.setMaxListeners(50))
    return server
  }
}
