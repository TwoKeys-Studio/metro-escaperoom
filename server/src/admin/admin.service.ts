import { Injectable } from '@nestjs/common'
import { CHARGE_SOCKET } from '../../../shared/level.ts'
import type { AdminCmd } from '../../../shared/protocol.ts'
import { PhaseService } from '../game/phase.service.ts'
import { ScareEventsService } from '../game/scare-events.service.ts'
import { MembershipService } from '../lobby/membership.service.ts'
import { MatchLifecycleService } from '../match/match-lifecycle.service.ts'
import { RoomChannel } from '../rooms/room-channel.service.ts'
import type { Room } from '../rooms/room.ts'

/** What the operator can do to a room from the admin panel. */
@Injectable()
export class AdminService {
  constructor(
    private readonly channel: RoomChannel,
    private readonly phase: PhaseService,
    private readonly scares: ScareEventsService,
    private readonly membership: MembershipService,
    private readonly match: MatchLifecycleService,
  ) {}

  execute(room: Room, cmd: AdminCmd) {
    const s = room.state
    switch (cmd.c) {
      case 'addTime':
        if (!s) return
        s.timeLeft = Math.max(1, s.timeLeft + cmd.sec)
        s.totalTime = Math.max(s.totalTime, s.timeLeft)
        this.channel.say(room, `ДИСПЕТЧЕР: Расчётное время до затопления изменено: ${cmd.sec > 0 ? '+' : ''}${cmd.sec} с.`, 'admin')
        this.channel.sendGame(room)
        return
      case 'pause':
        if (!s) return
        s.paused = cmd.paused
        this.channel.sendGame(room)
        return
      case 'event':
        this.scares.trigger(room, cmd.type, false)
        return
      case 'say':
        this.channel.say(room, cmd.text.slice(0, 240), 'admin')
        return
      case 'kick':
        this.membership.remove(room, cmd.playerId, 'Вас исключил администратор')
        return
      case 'forceStart':
        if (room.phase === 'lobby') this.match.start(room, true)
        return
      case 'end':
        if (!s || s.phase === 'won' || s.phase === 'lost') return
        s.outcome = cmd.result === 'lost' ? 'ДИСПЕТЧЕР: Игра остановлена оператором.' : undefined
        this.phase.setPhase(room, cmd.result)
        return
      case 'reset':
        this.match.reset(room)
        return
      case 'difficulty':
        if (room.phase !== 'lobby') return
        room.difficulty = cmd.difficulty
        this.channel.sendRoom(room)
        return
      case 'eggs':
        if (!s) return
        s.eggs = cmd.on
        this.channel.sendGame(room)
        return
      case 'skipPhase':
        this.skipPhase(room)
        return
      case 'close':
        this.membership.closeRoom(room)
        return
    }
  }

  /** Solves the current phase for the players, exactly as if they had done it. */
  private skipPhase(room: Room) {
    const s = room.state
    if (!s) return
    if (s.phase === 'power') {
      s.power = true
      this.phase.setPhase(room, 'access')
    } else if (s.phase === 'access') {
      s.doorOpen = true
      this.phase.setPhase(room, 'charge')
    } else if (s.phase === 'charge') {
      s.chargePlaced = true
      s.levers = [...s.leverTarget]
      s.leversOk = true
      s.armCodeOk = true
      s.breakers = [...s.breakerTarget]
      s.storageOpen = true
      s.gasDials = [...s.gasTarget]
      s.gasLoaded = s.gasTarget.length
      s.gasOk = true
      const charge = room.items.get('charge')
      if (charge) {
        charge.p = [...CHARGE_SOCKET.pos]
        charge.socket = CHARGE_SOCKET.id
        charge.holder = null
        charge.owner = null
      }
      this.phase.setPhase(room, 'arm')
    } else if (s.phase === 'arm') this.phase.setPhase(room, 'evac')
    else if (s.phase === 'evac') s.evacLeft = 0.01 // the blast goes off on the next tick
  }
}
