import { MessageBody, SubscribeMessage } from '@nestjs/websockets'
import type { Msg } from '../connection/client.ts'
import { GameGateway } from '../connection/game-gateway.decorator.ts'
import { InGame, type ActivePlayer } from '../connection/sender.decorator.ts'
import { ArmCodePuzzle } from './arm-code.puzzle.ts'
import { DetonatorPuzzle } from './detonator.puzzle.ts'
import { DoorCodePuzzle } from './door-code.puzzle.ts'
import { JunctionLeversPuzzle } from './junction-levers.puzzle.ts'
import { PumpPuzzle } from './pump.puzzle.ts'
import { TransferDoorPuzzle } from './transfer-door.puzzle.ts'

/** Messages from the things players press: keypads, levers, valves, detonator consoles. */
@GameGateway()
export class PuzzlesGateway {
  constructor(
    private readonly doorCode: DoorCodePuzzle,
    private readonly armCode: ArmCodePuzzle,
    private readonly levers: JunctionLeversPuzzle,
    private readonly transferDoor: TransferDoorPuzzle,
    private readonly pump: PumpPuzzle,
    private readonly detonator: DetonatorPuzzle,
  ) {}

  @SubscribeMessage('keypad')
  keypad(@InGame() p: ActivePlayer | null, @MessageBody() msg: Msg<'keypad'>): void {
    if (!p) return
    if (msg.target === 'arm') this.armCode.submit(p.room, p.client, msg.code)
    else this.doorCode.submit(p.room, p.client, msg.code)
  }

  @SubscribeMessage('lever')
  lever(@InGame() p: ActivePlayer | null, @MessageBody() msg: Msg<'lever'>): void {
    if (p) this.levers.toggle(p.room, msg.index)
  }

  @SubscribeMessage('tlever')
  transferLever(@InGame() p: ActivePlayer | null, @MessageBody() msg: Msg<'tlever'>): void {
    if (p) this.transferDoor.pull(p.room, msg.index)
  }

  @SubscribeMessage('valve')
  valve(@InGame() p: ActivePlayer | null, @MessageBody() msg: Msg<'valve'>): void {
    if (p) this.pump.turnValve(p.room, p.client, msg.index)
  }

  @SubscribeMessage('hold')
  hold(@InGame() p: ActivePlayer | null, @MessageBody() msg: Msg<'hold'>): void {
    if (p) this.detonator.hold(p.room, p.member, msg.console, msg.down)
  }
}
