import { MessageBody, SubscribeMessage } from '@nestjs/websockets'
import { AppConfig } from '../config/app.config.ts'
import { send, type Client, type Msg } from '../connection/client.ts'
import { GameGateway } from '../connection/game-gateway.decorator.ts'
import { Sender } from '../connection/sender.decorator.ts'
import { RoomChannel } from '../rooms/room-channel.service.ts'
import { RoomsService } from '../rooms/rooms.service.ts'
import { AdminService } from './admin.service.ts'

/** The `/admin` page. A connection becomes an admin after `adminAuth`; everything else requires it. */
@GameGateway()
export class AdminGateway {
  constructor(
    private readonly config: AppConfig,
    private readonly rooms: RoomsService,
    private readonly channel: RoomChannel,
    private readonly admin: AdminService,
  ) {}

  @SubscribeMessage('adminAuth')
  auth(@Sender() client: Client, @MessageBody() msg: Msg<'adminAuth'>): void {
    if (msg.password !== this.config.adminPassword) return send(client, { t: 'error', text: 'Неверный пароль администратора' })
    client.admin = true
    send(client, { t: 'adminOk' })
    this.rooms.pushAdmin()
  }

  /** Starts spectating a room (the 3D free camera), or stops when `roomId` is null. */
  @SubscribeMessage('adminWatch')
  watch(@Sender() client: Client, @MessageBody() msg: Msg<'adminWatch'>): void {
    if (!client.admin) return
    client.watching?.watchers.delete(client)
    client.watching = null
    if (!msg.roomId) return
    const room = this.rooms.get(msg.roomId)
    if (!room) return
    room.watchers.add(client)
    client.watching = room
    send(client, { t: 'room', id: room.id, name: room.name, players: room.players(), difficulty: room.difficulty, phase: room.phase })
    this.channel.sendGame(room, client)
  }

  @SubscribeMessage('admin')
  command(@Sender() client: Client, @MessageBody() msg: Msg<'admin'>): void {
    if (!client.admin) return
    const room = this.rooms.get(msg.roomId)
    if (!room) return
    this.admin.execute(room, msg.cmd)
    if (msg.cmd.c === 'close') this.rooms.delete(room.id)
    this.rooms.requestListPush()
  }
}
