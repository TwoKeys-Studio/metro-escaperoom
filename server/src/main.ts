import 'reflect-metadata'
import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { AppModule } from './app.module.ts'
import { AppConfig } from './config/app.config.ts'
import { GameWsAdapter } from './connection/game-ws.adapter.ts'

const app = await NestFactory.create<NestExpressApplication>(AppModule)
app.disable('x-powered-by')
app.useWebSocketAdapter(new GameWsAdapter(app))

const config = app.get(AppConfig)
await app.listen(config.port)
new Logger('НЕОН-17').log(
  `http://localhost:${config.port}  (ws: /ws, admin password: ${config.usesDefaultAdminPassword ? 'neon17 — смените ADMIN_PASSWORD' : 'из ADMIN_PASSWORD'})`,
)
