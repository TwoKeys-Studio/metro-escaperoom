import { Module } from '@nestjs/common'
import { GameModule } from '../game/game.module.ts'
import { LobbyModule } from '../lobby/lobby.module.ts'
import { MatchModule } from '../match/match.module.ts'
import { RoomsModule } from '../rooms/rooms.module.ts'
import { AdminGateway } from './admin.gateway.ts'
import { AdminService } from './admin.service.ts'

@Module({
  imports: [RoomsModule, GameModule, MatchModule, LobbyModule],
  providers: [AdminService, AdminGateway],
})
export class AdminModule {}
