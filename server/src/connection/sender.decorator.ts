import { createParamDecorator, type ExecutionContext } from '@nestjs/common'
import type { GameState } from '../../../shared/protocol.ts'
import type { Member, Room } from '../rooms/room.ts'
import type { Client, GameSocket } from './client.ts'

/** The sender as a member of the room they are in. */
export interface Player {
  client: Client
  room: Room
  member: Member
}

/** A player whose room has a game running. */
export interface ActivePlayer extends Player {
  state: GameState
}

const clientOf = (ctx: ExecutionContext) => ctx.switchToWs().getClient<GameSocket>().client!

function playerOf(client: Client): Player | null {
  const room = client.room
  const member = room?.members.get(client.id)
  return room && member ? { client, room, member } : null
}

/** The connection that sent the message. */
export const Sender = createParamDecorator((_: unknown, ctx: ExecutionContext): Client => clientOf(ctx))

/** The sender as a room member, or `null` when they are not in a room. */
export const InRoom = createParamDecorator((_: unknown, ctx: ExecutionContext): Player | null => playerOf(clientOf(ctx)))

/** The sender as a player of a running game, or `null` when there is no game. */
export const InGame = createParamDecorator((_: unknown, ctx: ExecutionContext): ActivePlayer | null => {
  const player = playerOf(clientOf(ctx))
  const state = player?.room.state
  return player && state ? { ...player, state } : null
})
