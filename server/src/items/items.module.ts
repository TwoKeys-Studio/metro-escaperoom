import { Module } from '@nestjs/common'
import { EggsModule } from '../eggs/eggs.module.ts'
import { PuzzlesModule } from '../puzzles/puzzles.module.ts'
import { RoomsModule } from '../rooms/rooms.module.ts'
import { ItemsGateway } from './items.gateway.ts'
import { ItemsService } from './items.service.ts'
import { RatsService } from './rats.service.ts'
import { SocketsService } from './sockets.service.ts'

@Module({
  imports: [RoomsModule, PuzzlesModule, EggsModule],
  providers: [ItemsService, SocketsService, RatsService, ItemsGateway],
  exports: [ItemsService, RatsService],
})
export class ItemsModule {}
