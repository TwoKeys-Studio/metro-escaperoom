import { stat } from 'node:fs/promises'
import { join, normalize } from 'node:path'
import { Controller, Get, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
import { AppConfig } from '../config/app.config.ts'

/**
 * Serves the built client in production, so one process hosts both the game page and its WebSocket.
 * In development Vite serves the client and this controller is not used.
 */
@Controller()
export class ClientAppController {
  constructor(private readonly config: AppConfig) {}

  @Get('{*path}')
  async serve(@Req() req: Request, @Res() res: Response) {
    const dist = this.config.clientDist
    let file = normalize(join(dist, decodeURIComponent(req.path)))
    if (!file.startsWith(dist)) return res.status(403).end()
    const isFile = await stat(file).then((s) => s.isFile(), () => false)
    if (!isFile) file = join(dist, 'index.html') // SPA fallback: /admin and friends are client-side routes
    res.sendFile(file, (err) => {
      if (err && !res.headersSent) res.status(404).send('Сначала соберите клиент: cd client && npm run build')
    })
  }
}
