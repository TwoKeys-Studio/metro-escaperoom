import { Module } from '@nestjs/common'
import { ConnectionModule } from '../connection/connection.module.ts'
import { GameModule } from '../game/game.module.ts'
import { ItemsModule } from '../items/items.module.ts'
import { MatchModule } from '../match/match.module.ts'
import { PuzzlesModule } from '../puzzles/puzzles.module.ts'
import { RoomsModule } from '../rooms/rooms.module.ts'
import { LobbyGateway } from './lobby.gateway.ts'
import { MembershipService } from './membership.service.ts'

@Module({
  imports: [ConnectionModule, RoomsModule, GameModule, PuzzlesModule, ItemsModule, MatchModule],
  providers: [MembershipService, LobbyGateway],
  exports: [MembershipService],
})
export class LobbyModule {}
