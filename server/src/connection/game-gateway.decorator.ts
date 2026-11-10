import { applyDecorators, Catch, Logger, UseFilters, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common'
import { WebSocketGateway } from '@nestjs/websockets'

/** A handler that throws is logged and the message dropped; nothing is sent back to the client. */
@Catch()
export class SilentWsExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Gateway')

  catch(error: unknown, host: ArgumentsHost) {
    this.logger.error(`message failed: ${host.switchToWs().getPattern()}`, error instanceof Error ? error.stack : String(error))
  }
}

/**
 * Marks a class as a gateway on the game's single WebSocket endpoint (`/ws`, same port as HTTP).
 * All gateways share that endpoint; each handles its own message kinds via `@SubscribeMessage('<t>')`.
 *
 * Handlers must return nothing (a returned value would be sent to the client) and must take their
 * arguments through parameter decorators without guards: that keeps every handler the same number of
 * async steps deep, so one client's messages are always handled in the order they were sent.
 */
export const GameGateway = () => applyDecorators(WebSocketGateway({ path: '/ws' }), UseFilters(SilentWsExceptionFilter))
