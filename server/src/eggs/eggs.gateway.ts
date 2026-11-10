import { MessageBody, SubscribeMessage } from '@nestjs/websockets'
import type { Msg } from '../connection/client.ts'
import { GameGateway } from '../connection/game-gateway.decorator.ts'
import { InGame, type ActivePlayer } from '../connection/sender.decorator.ts'
import { EggsService } from './eggs.service.ts'
import { KioskService } from './kiosk.service.ts'

@GameGateway()
export class EggsGateway {
  constructor(private readonly eggs: EggsService, private readonly kioskService: KioskService) {}

  @SubscribeMessage('kiosk')
  kiosk(@InGame() p: ActivePlayer | null, @MessageBody() msg: Msg<'kiosk'>): void {
    if (p) this.kioskService.answer(p.room, msg.text)
  }

  @SubscribeMessage('vending')
  vending(@InGame() p: ActivePlayer | null): void {
    if (p) this.eggs.vend(p.room, p.member)
  }

  /** Eggs the client detects by itself (walking into the 1977 car). */
  @SubscribeMessage('egg')
  egg(@InGame() p: ActivePlayer | null, @MessageBody() msg: Msg<'egg'>): void {
    if (p && msg.id === 'train') this.eggs.find(p.room, 'train')
  }
}
