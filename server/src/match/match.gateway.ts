import { MessageBody, SubscribeMessage } from '@nestjs/websockets'
import type { Msg } from '../connection/client.ts'
import { GameGateway } from '../connection/game-gateway.decorator.ts'
import { InGame, type ActivePlayer } from '../connection/sender.decorator.ts'

@GameGateway()
export class MatchGateway {
  /** Where the player stands and looks. The client moves itself; the server relays it with the next tick. */
  @SubscribeMessage('move')
  move(@InGame() p: ActivePlayer | null, @MessageBody() msg: Msg<'move'>): void {
    if (p) p.member.tf = { p: msg.p, yaw: msg.yaw, pitch: msg.pitch, crouch: msg.crouch, flash: msg.flash }
  }
}
