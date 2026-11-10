import { Module } from '@nestjs/common'
import { RoomsModule } from '../rooms/rooms.module.ts'
import { EggsGateway } from './eggs.gateway.ts'
import { EggsService } from './eggs.service.ts'
import { KioskService } from './kiosk.service.ts'

@Module({
  imports: [RoomsModule],
  providers: [EggsService, KioskService, EggsGateway],
  exports: [EggsService],
})
export class EggsModule {}
