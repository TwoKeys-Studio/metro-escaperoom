import { MessageBody, SubscribeMessage, type OnGatewayConnection, type OnGatewayDisconnect } from '@nestjs/websockets'
import { DIFFICULTIES } from '../../../shared/level.ts'
import { send, type Client, type GameSocket, type Msg } from '../connection/client.ts'
import { ClientsService } from '../connection/clients.service.ts'
import { GameGateway } from '../connection/game-gateway.decorator.ts'
import { InRoom, Sender, type Player } from '../connection/sender.decorator.ts'
import { MatchLifecycleService } from '../match/match-lifecycle.service.ts'
import { RoomChannel } from '../rooms/room-channel.service.ts'
import { RoomsService } from '../rooms/rooms.service.ts'
import { MembershipService } from './membership.service.ts'

/** Everything before the game starts: connecting, the room list, creating and joining rooms, the waiting room. */
@GameGateway()
export class LobbyGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    private readonly clients: ClientsService,
    private readonly rooms: RoomsService,
    private readonly channel: RoomChannel,
    private readonly membership: MembershipService,
    private readonly match: MatchLifecycleService,
  ) {}

  handleConnection(ws: GameSocket) {
    const client = this.clients.connect(ws)
    send(client, { t: 'welcome', id: client.id })
    send(client, { t: 'rooms', rooms: this.rooms.publicList() })
  }

  handleDisconnect(ws: GameSocket) {
    const client = ws.client
    if (!client) return
    this.clients.disconnect(client)
    if (client.room) this.membership.remove(client.room, client.id)
    client.watching?.watchers.delete(client)
    this.rooms.requestListPush()
  }

  // ---------------- menu ----------------

  @SubscribeMessage('hello')
  hello(@Sender() client: Client, @MessageBody() msg: Msg<'hello'>): void {
    client.name = msg.name.trim().slice(0, 18) || 'Пассажир'
  }

  @SubscribeMessage('create')
  create(@Sender() client: Client, @MessageBody() msg: Msg<'create'>): void {
    if (client.room) this.membership.remove(client.room, client.id)
    const difficulty = DIFFICULTIES[msg.difficulty] ? msg.difficulty : 'normal'
    const room = this.rooms.create(msg.solo ? `Тренировка · ${client.name}` : msg.name, difficulty, msg.password)
    room.solo = !!msg.solo
    this.membership.add(room, client)
    if (room.solo) this.match.start(room, true)
    this.rooms.requestListPush()
  }

  @SubscribeMessage('join')
  join(@Sender() client: Client, @MessageBody() msg: Msg<'join'>): void {
    const room = this.rooms.get(msg.roomId.toUpperCase())
    if (!room) return send(client, { t: 'error', text: 'Комната не найдена' })
    const refusal = this.membership.canJoin(room, msg.password)
    if (refusal) return send(client, { t: 'error', text: refusal })
    if (client.room) this.membership.remove(client.room, client.id)
    this.membership.add(room, client)
    this.rooms.requestListPush()
  }

  @SubscribeMessage('leave')
  leave(@Sender() client: Client): void {
    if (client.room) this.membership.remove(client.room, client.id, 'Вы вышли из комнаты')
    this.rooms.requestListPush()
  }

  // ---------------- inside a room ----------------

  @SubscribeMessage('ready')
  ready(@InRoom() p: Player | null, @MessageBody() msg: Msg<'ready'>): void {
    if (!p) return
    p.member.info.ready = msg.ready
    this.channel.sendRoom(p.room)
  }

  @SubscribeMessage('difficulty')
  difficulty(@InRoom() p: Player | null, @MessageBody() msg: Msg<'difficulty'>): void {
    if (!p || !p.member.info.host || p.room.phase !== 'lobby') return
    p.room.difficulty = msg.difficulty
    this.channel.sendRoom(p.room)
  }

  /** The host's button: starts the game from the lobby, or returns to the lobby from the end screen. */
  @SubscribeMessage('start')
  start(@InRoom() p: Player | null): void {
    if (!p || !p.member.info.host) return
    const { room, client } = p
    if (room.phase === 'won' || room.phase === 'lost') {
      this.match.reset(room)
      if (room.solo) this.match.start(room, true) // practice restarts right away
      return
    }
    const refusal = this.match.start(room)
    if (refusal) send(client, { t: 'error', text: refusal })
  }

  @SubscribeMessage('chat')
  chat(@InRoom() p: Player | null, @MessageBody() msg: Msg<'chat'>): void {
    if (!p) return
    const text = msg.text.trim().slice(0, 200)
    if (text) this.channel.broadcast(p.room, { t: 'chat', from: p.client.id, name: p.member.info.name, color: p.member.info.color, text })
  }
}
