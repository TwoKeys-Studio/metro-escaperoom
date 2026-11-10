import { Module } from '@nestjs/common'
import { ClientsService } from './clients.service.ts'

@Module({ providers: [ClientsService], exports: [ClientsService] })
export class ConnectionModule {}
