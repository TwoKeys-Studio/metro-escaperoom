import { Module } from '@nestjs/common'
import { ConnectionModule } from '../connection/connection.module.ts'
import { RoomChannel } from './room-channel.service.ts'
import { RoomsService } from './rooms.service.ts'

@Module({
  imports: [ConnectionModule],
  providers: [RoomsService, RoomChannel],
  exports: [RoomsService, RoomChannel],
})
export class RoomsModule {}
