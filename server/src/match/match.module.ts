import { Module } from '@nestjs/common'
import { EggsModule } from '../eggs/eggs.module.ts'
import { GameModule } from '../game/game.module.ts'
import { ItemsModule } from '../items/items.module.ts'
import { PuzzlesModule } from '../puzzles/puzzles.module.ts'
import { RoomsModule } from '../rooms/rooms.module.ts'
import { EvacuationService } from './evacuation.service.ts'
import { MatchLifecycleService } from './match-lifecycle.service.ts'
import { MatchLoopService } from './match-loop.service.ts'
import { MatchGateway } from './match.gateway.ts'

/** Running one game from start to finish: building its state, the tick loop, the ending. */
@Module({
  imports: [RoomsModule, GameModule, PuzzlesModule, EggsModule, ItemsModule],
  providers: [MatchLifecycleService, MatchLoopService, EvacuationService, MatchGateway],
  exports: [MatchLifecycleService],
})
export class MatchModule {}
