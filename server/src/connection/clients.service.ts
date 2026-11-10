import { randomUUID } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import type { Client, GameSocket } from './client.ts'

/** Every open connection: players, people in the menu, admins. */
@Injectable()
export class ClientsService {
  private readonly clients = new Set<Client>()

  connect(ws: GameSocket): Client {
    const client: Client = { id: randomUUID().slice(0, 8), ws, name: 'Пассажир', room: null, admin: false, watching: null }
    ws.client = client
    this.clients.add(client)
    return client
  }

  disconnect(client: Client) {
    this.clients.delete(client)
  }

  all(): Iterable<Client> {
    return this.clients
  }
}
