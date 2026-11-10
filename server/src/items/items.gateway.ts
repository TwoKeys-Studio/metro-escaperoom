import { MessageBody, SubscribeMessage } from '@nestjs/websockets'
import type { Msg } from '../connection/client.ts'
import { GameGateway } from '../connection/game-gateway.decorator.ts'
import { InGame, type ActivePlayer } from '../connection/sender.decorator.ts'
import { ItemsService } from './items.service.ts'

@GameGateway()
export class ItemsGateway {
  constructor(private readonly items: ItemsService) {}

  @SubscribeMessage('grab')
  grab(@InGame() p: ActivePlayer | null, @MessageBody() msg: Msg<'grab'>): void {
    if (p) this.items.grab(p, msg.id)
  }

  @SubscribeMessage('itemTf')
  itemTransform(@InGame() p: ActivePlayer | null, @MessageBody() msg: Msg<'itemTf'>): void {
    if (p) this.items.move(p, msg.id, msg.p, msg.q)
  }

  @SubscribeMessage('release')
  release(@InGame() p: ActivePlayer | null, @MessageBody() msg: Msg<'release'>): void {
    if (p) this.items.release(p, msg.id, msg.p, msg.q)
  }

  @SubscribeMessage('rest')
  rest(@InGame() p: ActivePlayer | null, @MessageBody() msg: Msg<'rest'>): void {
    if (p) this.items.rest(p, msg.id, msg.p, msg.q)
  }
}
