import { Injectable } from '@nestjs/common'
import { DIFFICULTIES, SPAWN } from '../../../shared/level.ts'
import { rnd } from '../common/random.ts'
import { AppConfig } from '../config/app.config.ts'
import { EggsService } from '../eggs/eggs.service.ts'
import { LINES } from '../game/dispatcher.lines.ts'
import { WATER_START } from '../game/rules.ts'
import { ItemsService } from '../items/items.service.ts'
import { ArmCodePuzzle } from '../puzzles/arm-code.puzzle.ts'
import { BreakersPuzzle } from '../puzzles/breakers.puzzle.ts'
import { ChargePuzzle } from '../puzzles/charge.puzzle.ts'
import { DetonatorPuzzle } from '../puzzles/detonator.puzzle.ts'
import { DoorCodePuzzle } from '../puzzles/door-code.puzzle.ts'
import { GasPuzzle } from '../puzzles/gas.puzzle.ts'
import { JunctionLeversPuzzle } from '../puzzles/junction-levers.puzzle.ts'
import { MosaicPuzzle } from '../puzzles/mosaic.puzzle.ts'
import { PowerPuzzle } from '../puzzles/power.puzzle.ts'
import { PumpPuzzle } from '../puzzles/pump.puzzle.ts'
import { TransferDoorPuzzle } from '../puzzles/transfer-door.puzzle.ts'
import { RoomChannel } from '../rooms/room-channel.service.ts'
import type { Room } from '../rooms/room.ts'
import { MatchLoopService } from './match-loop.service.ts'

const INTRO_SECONDS = 7

/** Starting a game in a room and taking the room back to the lobby. */
@Injectable()
export class MatchLifecycleService {
  constructor(
    private readonly config: AppConfig,
    private readonly channel: RoomChannel,
    private readonly loop: MatchLoopService,
    private readonly items: ItemsService,
    private readonly eggs: EggsService,
    private readonly power: PowerPuzzle,
    private readonly doorCode: DoorCodePuzzle,
    private readonly charge: ChargePuzzle,
    private readonly levers: JunctionLeversPuzzle,
    private readonly armCode: ArmCodePuzzle,
    private readonly mosaic: MosaicPuzzle,
    private readonly transferDoor: TransferDoorPuzzle,
    private readonly pump: PumpPuzzle,
    private readonly detonator: DetonatorPuzzle,
    private readonly breakers: BreakersPuzzle,
    private readonly gas: GasPuzzle,
  ) {}

  /**
   * Starts the game. Returns the reason it can't start, or `null` on success.
   * `force` (solo practice, admin) skips the player count and readiness checks.
   */
  start(room: Room, force = false): string | null {
    if (room.phase !== 'lobby') return 'Игра уже идёт'
    if (!force) {
      if (room.members.size < this.config.minPlayers) return `Нужно минимум ${this.config.minPlayers} игрока`
      const notReady = room.players().filter((p) => !p.ready && !p.host)
      if (notReady.length) return 'Не все игроки готовы'
    }
    const cfg = DIFFICULTIES[room.difficulty]

    // every puzzle contributes its own part of the state; a new puzzle adds one line here
    room.state = {
      phase: 'intro', difficulty: room.difficulty, timeLeft: cfg.minutes * 60, totalTime: cfg.minutes * 60,
      paused: false, water: WATER_START, evacLeft: cfg.evacSeconds, blastDoorClosed: false, elevatorOpen: false,
      solo: room.solo,
      ...this.power.setup(room, cfg),
      ...this.doorCode.setup(),
      ...this.charge.setup(),
      ...this.levers.setup(),
      ...this.armCode.setup(),
      ...this.mosaic.setup(),
      ...this.transferDoor.setup(),
      ...this.pump.setup(),
      ...this.detonator.setup(),
      ...this.breakers.setup(),
      ...this.gas.setup(),
      ...this.eggs.setup(room),
    }
    this.items.spawn(room, cfg)

    // players start in a circle around the spawn point
    let i = 0
    for (const m of room.members.values()) {
      m.info.alive = true
      m.info.escaped = false
      const a = (i++ / Math.max(1, room.members.size)) * Math.PI * 2
      m.tf.p = [SPAWN[0] + Math.cos(a) * 1.6, SPAWN[1], SPAWN[2] + Math.sin(a) * 1.2]
    }
    room.phaseTimer = INTRO_SECONDS
    room.nextEventIn = rnd(...cfg.eventEverySec)
    this.channel.sendGame(room)
    this.channel.sendRoom(room)
    this.channel.broadcast(room, { t: 'event', type: 'quake' })
    setTimeout(() => this.channel.say(room, LINES.intro[0]), 1200)
    setTimeout(() => this.channel.say(room, LINES.intro[1]), 4800)
    this.loop.ensureRunning(room)
    return null
  }

  /** Back to the lobby: the game is thrown away, everyone is alive and not ready again. */
  reset(room: Room) {
    room.state = null
    room.items.clear()
    room.stopTimer()
    for (const m of room.members.values()) {
      m.info.ready = false
      m.info.alive = true
      m.info.escaped = false
    }
    this.channel.sendRoom(room)
  }
}
