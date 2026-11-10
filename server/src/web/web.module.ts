import { Module } from '@nestjs/common'
import { ClientAppController } from './client-app.controller.ts'
import { HealthController } from './health.controller.ts'

/** Plain HTTP. `HealthController` comes first: the client app controller catches every other path. */
@Module({ controllers: [HealthController, ClientAppController] })
export class WebModule {}
