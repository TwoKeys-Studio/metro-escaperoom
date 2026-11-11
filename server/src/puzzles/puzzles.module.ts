import { Module } from '@nestjs/common'
import { GameModule } from '../game/game.module.ts'
import { RoomsModule } from '../rooms/rooms.module.ts'
import { ArmCodePuzzle } from './arm-code.puzzle.ts'
import { BreakersPuzzle } from './breakers.puzzle.ts'
import { ChargeStage } from './charge-stage.service.ts'
import { ChargePuzzle } from './charge.puzzle.ts'
import { DetonatorPuzzle } from './detonator.puzzle.ts'
import { DoorCodePuzzle } from './door-code.puzzle.ts'
import { GasPuzzle } from './gas.puzzle.ts'
import { JunctionLeversPuzzle } from './junction-levers.puzzle.ts'
import { MosaicPuzzle } from './mosaic.puzzle.ts'
import { PowerPuzzle } from './power.puzzle.ts'
import { PumpPuzzle } from './pump.puzzle.ts'
import { PuzzlesGateway } from './puzzles.gateway.ts'
import { TransferDoorPuzzle } from './transfer-door.puzzle.ts'

const PUZZLES = [
  PowerPuzzle, DoorCodePuzzle, ChargePuzzle, JunctionLeversPuzzle, ArmCodePuzzle, MosaicPuzzle,
  TransferDoorPuzzle, PumpPuzzle, DetonatorPuzzle, BreakersPuzzle, GasPuzzle,
]

/**
 * One file per puzzle. A puzzle owns its slice of the game state: `setup()` returns the starting values,
 * the other methods react to what players do.
 */
@Module({
  imports: [RoomsModule, GameModule],
  providers: [...PUZZLES, ChargeStage, PuzzlesGateway],
  exports: PUZZLES,
})
export class PuzzlesModule {}
