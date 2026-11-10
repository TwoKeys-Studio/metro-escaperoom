import { Module } from '@nestjs/common'
import { AdminModule } from './admin/admin.module.ts'
import { ConfigModule } from './config/config.module.ts'
import { EggsModule } from './eggs/eggs.module.ts'
import { ItemsModule } from './items/items.module.ts'
import { LobbyModule } from './lobby/lobby.module.ts'
import { MatchModule } from './match/match.module.ts'
import { PuzzlesModule } from './puzzles/puzzles.module.ts'
import { WebModule } from './web/web.module.ts'

/**
 * Modules, from the outside in:
 *   web      — HTTP: /health and the built client
 *   lobby    — connections, room list, creating/joining rooms, the waiting room
 *   admin    — the operator panel
 *   match    — one running game: start, tick loop, ending
 *   items    — carrying things and snapping them into sockets
 *   puzzles  — one file per puzzle
 *   eggs     — easter eggs and the cipher kiosk
 *   game     — phases, scares, shared rules (used by everything above)
 *   rooms    — the Room data, the room registry, broadcasting
 *   connection — the WebSocket clients and the gateway plumbing
 */
@Module({
  imports: [ConfigModule, WebModule, LobbyModule, AdminModule, MatchModule, ItemsModule, PuzzlesModule, EggsModule],
})
export class AppModule {}
