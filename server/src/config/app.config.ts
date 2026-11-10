import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { Injectable } from '@nestjs/common'

/** Everything the server reads from the environment, in one place. */
@Injectable()
export class AppConfig {
  readonly port = Number(process.env.PORT ?? 2567)
  readonly adminPassword = process.env.ADMIN_PASSWORD ?? 'neon17'
  /** Players needed before the host may start (solo practice and the admin ignore it). */
  readonly minPlayers = Number(process.env.MIN_PLAYERS ?? 4)
  /** The built client (`npm run build` in /client), served by this process in production. */
  readonly clientDist = join(serverRoot(), '../client/dist')

  get usesDefaultAdminPassword() {
    return this.adminPassword === 'neon17'
  }
}

/** The `server/` folder: the nearest package.json above this file, in both `src` and `dist` layouts. */
function serverRoot() {
  let dir = import.meta.dirname
  while (!existsSync(join(dir, 'package.json')) && dirname(dir) !== dir) dir = dirname(dir)
  return dir
}
