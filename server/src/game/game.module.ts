import { Module } from '@nestjs/common'
import { RoomsModule } from '../rooms/rooms.module.ts'
import { PhaseService } from './phase.service.ts'
import { ScareEventsService } from './scare-events.service.ts'

/** Rules every other game module builds on: phases, scares, shared lines and formulas. */
@Module({
  imports: [RoomsModule],
  providers: [PhaseService, ScareEventsService],
  exports: [PhaseService, ScareEventsService],
})
export class GameModule {}
