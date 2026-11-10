import type { WebSocket } from 'ws'
import {
  CELL_SPOTS, CHARGE_SOCKET, CHARGE_SPAWN, DIFFICULTIES, LEVER_COUNT, MAX_PLAYERS, PIT_Y, PROPS,
  SPAWN, VENDING_POS, dist, inElevator, powerSockets,
  CAESAR_SHIFT, CAESAR_WORDS, HOSE_SOCKETS, HOSE_SPOTS, MOSAIC_Q, MOSAIC_SOCKETS, POEMS, PUMP_TIME_BONUS,
  PUMP_TIME_PER_HOSE, TILE_SPOTS, TLEVER_COUNT, caesar, inEastTunnel,
  type Difficulty, type ItemKind, type Socket, type Vec3,
} from '../../shared/level.ts'
import type {
  AdminCmd, ClientMsg, EventType, GameState, ItemState, Phase, PlayerInfo, PlayerTf, RoomSummary, ServerMsg,
} from '../../shared/protocol.ts'

export const MIN_TO_START = Number(process.env.MIN_PLAYERS ?? 4)

const COLORS = ['#22f0ff', '#ff2e88', '#e6ff3a', '#ff9a1f', '#3dff8a', '#4da3ff', '#ff5a3d', '#f2f2f2', '#00c2a8', '#ffd23d', '#ff6fd8', '#9cff2e']
const ACTIVE: Phase[] = ['power', 'access', 'charge', 'arm', 'evac']
const WATER_END = 0.45 // platform drowns when water reaches this height
const TICK_MS = 50

export interface Client {
  id: string
  ws: WebSocket
  name: string
  room: Room | null
  admin: boolean
  watching: Room | null
}

interface Member {
  client: Client
  info: PlayerInfo
  tf: PlayerTf
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a)
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)]
const shuffle = <T,>(arr: T[]) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

const AI = {
  intro: [
    'ДИСПЕТЧЕР: Сейсмособытие на линии 17. Тоннель «Восток» обрушен. Грунтовые воды поступают.',
    'ДИСПЕТЧЕР: Основное питание потеряно. Пассажирам... оставаться... на местах.',
  ],
  power: 'ДИСПЕТЧЕР: Для запуска щита нужны энергоячейки. Ищите свечение. Не все ячейки... исправны.',
  powerOn: 'ДИСПЕТЧЕР: Питание восстановлено. Служебный шлюз требует код. Я помню цвета. Вы — нет.',
  access: 'ДИСПЕТЧЕР: Код доступа принят. В техкомнате — подрывной заряд. Для подрыва нужны: заряд у завала, рычаги по схеме и код взвода с мозаики «Литейной».',
  chargePlaced: 'ДИСПЕТЧЕР: Заряд установлен. Распределительная коробка в тоннеле должна совпасть со схемой.',
  levers: 'ДИСПЕТЧЕР: Цепь замкнута. Детонатор требует двух операторов. Одновременно.',
  evac: 'ДИСПЕТЧЕР: Детонация запущена. Всем за гермодверь. Тем, кто останется, — мои соболезнования.',
  blast: 'ДИСПЕТЧЕР: Тоннель запечатан. Лифт активирован. Я... не хотел, чтобы вы уходили.',
  won: 'ДИСПЕТЧЕР: Лифт ушёл наверх. Станция «Неон-17» снова пуста. Возвращайтесь.',
  lost: 'ДИСПЕТЧЕР: Уровень воды критический. Связь с пассажирами... потеряна.',
  wrongCode: ['ДИСПЕТЧЕР: Неверно. Хи-хи.', 'ДИСПЕТЧЕР: Код отклонён. Вода не ждёт.', 'ДИСПЕТЧЕР: ОШИБКА. ОШИБКА. ОШ—'],
  fake: 'ДИСПЕТЧЕР: Ячейка перегружена. Я же предупреждал.',
  creepy: [
    'ДИСПЕТЧЕР: В тоннеле зафиксирован ещё один пассажир. Он не из вашей группы.',
    'ДИСПЕТЧЕР: Поезд 1977 года прибывает на станцию. Отойдите от края платформы.',
    'ДИСПЕТЧЕР: Я слышу, как вы дышите.',
    'ДИСПЕТЧЕР: Не оборачивайтесь.',
    'ДИСПЕТЧЕР: Кто-то из вас уже был здесь. Давно.',
    'Д̷И̶С̸П̵Е̷Т̴Ч̶Е̴Р̷:̵ ̶В̸О̷Д̶А̵ ̸П̴О̵М̸Н̶И̷Т̴ ̸В̶А̸С̷',
  ],
  eggs: {
    pixel: 'ДИСПЕТЧЕР: Пиксель! Робокот найден. Он ждал вас с 2077-го.',
    train: 'ДИСПЕТЧЕР: Вагон 1977. Машинист так и не вышел.',
    vending: 'ДИСПЕТЧЕР: Автомат выдал «НЕОН-КОЛА». Срок годности истёк 40 лет назад.',
  } as Record<string, string>,
}

let roomSeq = 0

export class Room {
  id: string
  name: string
  password?: string
  difficulty: Difficulty
  members = new Map<string, Member>()
  watchers = new Set<Client>()
  state: GameState | null = null
  items = new Map<string, ItemState>()
  sockets: Socket[] = []
  dirtyItems = new Set<string>()
  timer: NodeJS.Timeout | null = null
  phaseTimer = 0
  nextEventIn = 60
  vendingCount = 0
  caesarPlain = ''
  closed = false
  solo = false
  onChange: () => void

  constructor(name: string, difficulty: Difficulty, onChange: () => void, password?: string) {
    this.id = makeCode()
    this.name = name.slice(0, 32) || `Комната ${++roomSeq}`
    this.difficulty = difficulty
    this.password = password || undefined
    this.onChange = onChange
  }

  get phase(): Phase {
    return this.state?.phase ?? 'lobby'
  }

  summary(): RoomSummary {
    return {
      id: this.id, name: this.name, players: this.members.size, phase: this.phase,
      difficulty: this.difficulty, locked: !!this.password,
    }
  }

  // ---------------- membership ----------------
  canJoin(password?: string): string | null {
    if (this.solo) return 'Это одиночная тренировка'
    if (this.members.size >= MAX_PLAYERS) return 'Комната заполнена (максимум 12)'
    if (this.phase !== 'lobby') return 'Игра уже идёт'
    if (this.password && this.password !== password) return 'Неверный пароль комнаты'
    return null
  }

  add(client: Client) {
    const used = new Set([...this.members.values()].map((m) => m.info.color))
    const color = COLORS.find((c) => !used.has(c)) ?? pick(COLORS)
    const info: PlayerInfo = {
      id: client.id, name: client.name, color, ready: false, host: this.members.size === 0, alive: true, escaped: false,
    }
    this.members.set(client.id, { client, info, tf: { p: [...SPAWN], yaw: 0, pitch: 0, crouch: false, flash: true } })
    client.room = this
    this.sendRoom()
  }

  remove(clientId: string, reason?: string) {
    const m = this.members.get(clientId)
    if (!m) return
    this.members.delete(clientId)
    m.client.room = null
    if (reason) send(m.client, { t: 'left', reason })
    for (const it of this.items.values()) {
      if (it.holder === clientId || it.owner === clientId) {
        it.holder = null
        it.owner = null
        this.broadcast({ t: 'item', item: it })
      }
    }
    if (m.info.host) {
      const next = this.members.values().next().value
      if (next) next.info.host = true
    }
    if (this.state) this.releaseHolds(clientId)
    this.sendRoom()
    if (this.state && ACTIVE.includes(this.state.phase)) this.checkAllDead()
  }

  players(): PlayerInfo[] {
    return [...this.members.values()].map((m) => m.info)
  }

  sendRoom() {
    this.broadcast({ t: 'room', id: this.id, name: this.name, players: this.players(), difficulty: this.difficulty, phase: this.phase })
    this.onChange()
  }

  broadcast(msg: ServerMsg) {
    const data = JSON.stringify(msg)
    for (const m of this.members.values()) if (m.client.ws.readyState === 1) m.client.ws.send(data)
    for (const w of this.watchers) if (w.ws.readyState === 1) w.ws.send(data)
  }

  say(text: string, from: 'ai' | 'admin' = 'ai') {
    this.broadcast({ t: 'say', from, text })
  }

  // ---------------- game lifecycle ----------------
  start(force = false): string | null {
    if (this.phase !== 'lobby') return 'Игра уже идёт'
    if (!force) {
      if (this.members.size < MIN_TO_START) return `Нужно минимум ${MIN_TO_START} игрока`
      const notReady = this.players().filter((p) => !p.ready && !p.host)
      if (notReady.length) return 'Не все игроки готовы'
    }
    const cfg = DIFFICULTIES[this.difficulty]
    this.sockets = powerSockets(cfg.cells)
    const digits = Array.from({ length: 4 }, () => Math.floor(Math.random() * 10))
    const order = shuffle([0, 1, 2, 3])
    const leverTarget = Array.from({ length: LEVER_COUNT }, () => Math.random() > 0.5)
    if (leverTarget.every((v) => !v)) leverTarget[1] = true

    this.state = {
      phase: 'intro', difficulty: this.difficulty, timeLeft: cfg.minutes * 60, totalTime: cfg.minutes * 60,
      paused: false, water: PIT_Y - 0.4, power: false, doorOpen: false,
      levers: Array(LEVER_COUNT).fill(false), leversOk: false, chargePlaced: false,
      detonator: { a: false, b: false, progress: 0 }, evacLeft: cfg.evacSeconds, blastDoorClosed: false,
      elevatorOpen: false, sockets: this.sockets.map((s) => s.id), codeDigits: digits, codeOrder: order,
      leverTarget, eggs: this.state?.eggs ?? true, eggsFound: [], solo: this.solo,
      transferLamps: lightsOutStart(), transferOpen: false,
      pumpOrder: shuffle([0, 1, 2, 3]), pumpProgress: 0, pumpDoorOpen: false, hoses: 0, pumpOn: false,
      armCode: String(1000 + Math.floor(Math.random() * 9000)), mosaicDone: false, armCodeOk: false,
      caesar: '', poem: Math.floor(Math.random() * POEMS.length),
      morse: String(100 + Math.floor(Math.random() * 900)), reveals: [],
    }
    this.caesarPlain = pick(CAESAR_WORDS)
    this.state.caesar = caesar(this.caesarPlain, CAESAR_SHIFT)
    this.items.clear()
    const spots = shuffle([...CELL_SPOTS])
    const total = cfg.cells + cfg.fakeCells
    for (let i = 0; i < total; i++) {
      this.addItem(`cell${i}`, 'cell', spots[i % spots.length], i >= cfg.cells)
    }
    this.addItem('charge', 'charge', CHARGE_SPAWN)
    // mosaic tiles: shuffled over the spots so every run differs
    const tileSpots = shuffle([...TILE_SPOTS])
    for (let i = 0; i < 9; i++) this.addItem(`tile${i}`, 'tile', tileSpots[i])
    HOSE_SPOTS.forEach((p, i) => this.addItem(`hose${i}`, 'hose', p))
    for (const p of PROPS) this.addItem(p.id, p.kind, p.pos)

    let i = 0
    for (const m of this.members.values()) {
      m.info.alive = true
      m.info.escaped = false
      const a = (i++ / Math.max(1, this.members.size)) * Math.PI * 2
      m.tf.p = [SPAWN[0] + Math.cos(a) * 1.6, SPAWN[1], SPAWN[2] + Math.sin(a) * 1.2]
    }
    this.phaseTimer = 7
    this.nextEventIn = rnd(...cfg.eventEverySec)
    this.vendingCount = 0
    this.sendGame()
    this.sendRoom()
    this.broadcast({ t: 'event', type: 'quake' })
    setTimeout(() => this.say(AI.intro[0]), 1200)
    setTimeout(() => this.say(AI.intro[1]), 4800)
    if (!this.timer) this.timer = setInterval(() => this.tick(TICK_MS / 1000), TICK_MS)
    return null
  }

  reset() {
    this.state = null
    this.items.clear()
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    for (const m of this.members.values()) {
      m.info.ready = false
      m.info.alive = true
      m.info.escaped = false
    }
    this.sendRoom()
  }

  close() {
    this.closed = true
    if (this.timer) clearInterval(this.timer)
    for (const id of [...this.members.keys()]) this.remove(id, 'Комнату закрыл администратор')
  }

  addItem(id: string, kind: ItemKind, p: Vec3, fake = false) {
    const it: ItemState = { id, kind, p: [...p], q: [0, 0, 0, 1], holder: null, owner: null, socket: null }
    if (fake) it.fake = true
    this.items.set(id, it)
    return it
  }

  publicItems(): ItemState[] {
    // fake cells are sent too: the client only betrays them with a rare red twitch
    return [...this.items.values()]
  }

  sendGame(to?: Client) {
    if (!this.state) return
    const msg: ServerMsg = { t: 'game', state: this.state, items: this.publicItems() }
    if (to) send(to, msg)
    else this.broadcast(msg)
  }

  setPhase(phase: Phase) {
    if (!this.state) return
    this.state.phase = phase
    const cfg = { ...DIFFICULTIES[this.difficulty], hints: DIFFICULTIES[this.difficulty].hints || this.solo }
    if (phase === 'power') {
      this.say(AI.power)
      if (this.solo) setTimeout(() => this.say('ДИСПЕТЧЕР: Тренировка. Ромбы над предметами покажут, куда идти. Щит питания — у задней стены зала.'), 4000)
    }
    if (phase === 'access') {
      this.say(AI.powerOn)
      if (cfg.hints) {
        const s = this.state
        const code = s.codeOrder.map((ci) => s.codeDigits[ci]).join('')
        setTimeout(() => this.say(`ДИСПЕТЧЕР: Подсказка для слабых. Код — ${code.split('').join(' ')}.`), 6000)
      }
    }
    if (phase === 'charge') {
      this.say(AI.access)
      if (cfg.hints) setTimeout(() => this.say('ДИСПЕТЧЕР: Заряд — к завалу в конце восточного тоннеля. Рычаги — на стене тоннеля, схема — в техкомнате. Код взвода спрятан в мозаике ветки Б, вход через переход в восточной стене зала.'), 5000)
    }
    if (phase === 'arm') this.say(this.alivePlayers() === 1 ? 'ДИСПЕТЧЕР: Вы один. Детонатор примет одного оператора. Держите любой пульт.' : AI.levers)
    if (phase === 'evac') {
      this.state.evacLeft = cfg.evacSeconds
      this.say(AI.evac)
    }
    if (phase === 'escape') {
      this.state.elevatorOpen = true
      this.say(AI.blast)
    }
    if (phase === 'won') this.say(AI.won)
    if (phase === 'lost') this.say(this.state.outcome ?? AI.lost)
    this.sendGame()
    this.sendRoom()
  }

  // ---------------- simulation ----------------
  tick(dt: number) {
    const s = this.state
    if (!s) return
    if (!s.paused) {
      if (s.phase === 'intro') {
        this.phaseTimer -= dt
        if (this.phaseTimer <= 0) this.setPhase('power')
      }
      if (ACTIVE.includes(s.phase)) {
        s.timeLeft = Math.max(0, s.timeLeft - dt)
        const progress = 1 - s.timeLeft / s.totalTime
        // water creeps slowly, then accelerates in the last third
        const curve = progress < 0.66 ? progress * 0.75 : 0.495 + (progress - 0.66) * 1.485
        s.water = PIT_Y - 0.4 + curve * (WATER_END - (PIT_Y - 0.4))
        if (s.timeLeft <= 0) {
          s.outcome = AI.lost
          this.setPhase('lost')
        }
        this.nextEventIn -= dt
        if (this.nextEventIn <= 0) {
          const cfg = DIFFICULTIES[this.difficulty]
          this.nextEventIn = rnd(...cfg.eventEverySec)
          this.randomEvent()
        }
      }
      if (s.phase === 'arm') {
        const armedBy = (s.detonator.a ? 1 : 0) + (s.detonator.b ? 1 : 0)
        if (armedBy >= Math.min(2, this.alivePlayers())) {
          s.detonator.progress = Math.min(1, s.detonator.progress + dt / 2.5)
          if (s.detonator.progress >= 1) this.setPhase('evac')
          else if (Math.round(s.detonator.progress * 20) !== Math.round((s.detonator.progress - dt / 2.5) * 20)) this.sendGame()
        } else if (s.detonator.progress > 0) {
          s.detonator.progress = 0
          this.sendGame()
        }
      }
      if (s.phase === 'evac') {
        s.evacLeft = Math.max(0, s.evacLeft - dt)
        if (s.evacLeft <= 0) this.detonate()
      }
      if (s.phase === 'escape') {
        s.water = Math.max(PIT_Y - 0.5, s.water - dt * 0.02)
        let alive = 0
        let inside = 0
        for (const m of this.members.values()) {
          if (!m.info.alive) continue
          alive++
          if (inElevator(m.tf.p)) inside++
        }
        if (alive > 0 && inside === alive) {
          for (const m of this.members.values()) if (m.info.alive) m.info.escaped = true
          this.setPhase('won')
        }
      }
    }

    const players: Record<string, PlayerTf> = {}
    for (const [id, m] of this.members) players[id] = m.tf
    const items = [...this.dirtyItems].map((id) => this.items.get(id)).filter(Boolean).map((it) => ({ id: it!.id, p: it!.p, q: it!.q }))
    this.dirtyItems.clear()
    this.broadcast({ t: 'tick', time: s.timeLeft, water: s.water, players, items })
  }

  detonate() {
    const s = this.state!
    s.blastDoorClosed = true
    s.water = Math.min(s.water, PIT_Y + 0.2)
    this.broadcast({ t: 'event', type: 'quake', at: CHARGE_SOCKET.pos })
    for (const m of this.members.values()) {
      if (m.info.alive && inEastTunnel(m.tf.p)) {
        m.info.alive = false
        this.broadcast({ t: 'say', from: 'ai', text: `ДИСПЕТЧЕР: Пассажир ${m.info.name} остался в тоннеле.` })
      }
    }
    this.sendRoom()
    if (this.checkAllDead()) return
    this.setPhase('escape')
  }

  alivePlayers() {
    return this.players().filter((p) => p.alive).length
  }

  checkAllDead() {
    if (!this.state) return false
    const alive = this.players().filter((p) => p.alive).length
    if (alive === 0 && this.members.size > 0) {
      this.state.outcome = 'ДИСПЕТЧЕР: Никто не выжил. Станция снова тихая.'
      this.setPhase('lost')
      return true
    }
    return false
  }

  randomEvent(type?: EventType, announce = true) {
    const s = this.state
    if (!s) return
    const alive = [...this.members.values()].filter((m) => m.info.alive)
    const t = type ?? pick<EventType>(['blackout', 'ghostTrain', 'quake', 'whisper', 'shadow', 'glitch', 'shadow', 'whisper'])
    const target = pick(alive)?.info.id
    this.broadcast({ t: 'event', type: t, target })
    if (announce && Math.random() < 0.55) setTimeout(() => this.say(pick(AI.creepy)), 1500)
  }

  releaseHolds(clientId: string) {
    const s = this.state!
    const m = this.members.get(clientId)
    void m
    // detonator holds are tracked per console; if the client leaves both may be stale
    if (s.phase === 'arm') {
      s.detonator.a = false
      s.detonator.b = false
      s.detonator.progress = 0
    }
  }

  // ---------------- messages from players ----------------
  handle(client: Client, msg: ClientMsg) {
    const m = this.members.get(client.id)
    if (!m) return
    const s = this.state

    switch (msg.t) {
      case 'ready':
        m.info.ready = msg.ready
        this.sendRoom()
        return
      case 'difficulty':
        if (m.info.host && this.phase === 'lobby') {
          this.difficulty = msg.difficulty
          this.sendRoom()
        }
        return
      case 'start': {
        if (!m.info.host) return
        if (this.phase === 'won' || this.phase === 'lost') {
          this.reset()
          if (this.solo) this.start(true)
          return
        }
        const err = this.start()
        if (err) send(client, { t: 'error', text: err })
        return
      }
      case 'chat': {
        const text = msg.text.trim().slice(0, 200)
        if (text) this.broadcast({ t: 'chat', from: client.id, name: m.info.name, color: m.info.color, text })
        return
      }
    }

    if (!s) return
    switch (msg.t) {
      case 'move':
        m.tf = { p: msg.p, yaw: msg.yaw, pitch: msg.pitch, crouch: msg.crouch, flash: msg.flash }
        return
      case 'grab': {
        if (!m.info.alive) return
        const it = this.items.get(msg.id)
        if (!it || it.holder) return
        if (it.socket) {
          if (!it.socket.startsWith('mos') || s.mosaicDone) return
          it.socket = null
          s.mosaicDone = false
        }
        if (dist(it.p, m.tf.p) > 4.5) return
        for (const other of this.items.values()) if (other.holder === client.id) return
        it.holder = client.id
        it.owner = client.id
        this.broadcast({ t: 'item', item: it })
        if (it.kind === 'pixel') this.findEgg('pixel')
        return
      }
      case 'itemTf': {
        const it = this.items.get(msg.id)
        if (!it || (it.holder !== client.id && it.owner !== client.id)) return
        it.p = msg.p
        it.q = msg.q
        this.dirtyItems.add(it.id)
        return
      }
      case 'release': {
        const it = this.items.get(msg.id)
        if (!it || it.holder !== client.id) return
        it.holder = null
        it.p = msg.p
        it.q = msg.q
        const socket = this.findSocket(it)
        if (socket) {
          this.snap(it, socket, m)
          return
        }
        it.owner = client.id
        this.broadcast({ t: 'item', item: it })
        return
      }
      case 'rest': {
        const it = this.items.get(msg.id)
        if (!it || it.owner !== client.id || it.holder) return
        it.p = msg.p
        it.q = msg.q
        it.owner = null
        // a thrown item can also land in a socket
        const socket = this.findSocket(it)
        if (socket) this.snap(it, socket, m)
        else this.broadcast({ t: 'item', item: it })
        return
      }
      case 'keypad': {
        if (msg.target === 'arm') {
          if (s.phase !== 'charge' || s.armCodeOk) return
          if (msg.code === s.armCode) {
            s.armCodeOk = true
            this.say('ДИСПЕТЧЕР: Код взвода принят. Детонатор ждёт заряд и цепь.')
            this.checkCharge()
            this.sendGame()
          } else {
            this.broadcast({ t: 'event', type: 'glitch', target: client.id })
            this.say('ДИСПЕТЧЕР: Код взвода неверен. Мозаика не врёт — врут глаза.')
          }
          return
        }
        if (s.phase !== 'access' || !s.power) return
        const code = s.codeOrder.map((ci) => s.codeDigits[ci]).join('')
        if (msg.code === code) {
          s.doorOpen = true
          this.setPhase('charge')
        } else {
          this.broadcast({ t: 'event', type: 'glitch', target: client.id })
          this.say(pick(AI.wrongCode))
          if (this.difficulty === 'hard' || this.difficulty === 'nightmare') {
            s.timeLeft = Math.max(1, s.timeLeft - 15)
            this.say('ДИСПЕТЧЕР: Штраф: минус 15 секунд.')
          }
        }
        return
      }
      case 'lever': {
        if (!s.doorOpen || msg.index < 0 || msg.index >= LEVER_COUNT) return
        if (s.phase !== 'charge') return
        s.levers[msg.index] = !s.levers[msg.index]
        s.leversOk = s.levers.every((v, i) => v === s.leverTarget[i])
        this.checkCharge()
        this.sendGame()
        return
      }
      case 'hold': {
        if (s.phase !== 'arm' || !m.info.alive) return
        s.detonator[msg.console] = msg.down
        this.sendGame()
        return
      }
      case 'tlever': {
        if (!s.power || s.transferOpen || msg.index < 0 || msg.index >= TLEVER_COUNT) return
        for (const j of [msg.index - 1, msg.index, msg.index + 1]) if (j >= 0 && j < TLEVER_COUNT) s.transferLamps[j] = !s.transferLamps[j]
        if (s.transferLamps.every(Boolean)) {
          s.transferOpen = true
          this.say('ДИСПЕТЧЕР: Переход на ветку Б открыт. «Литейная» не принимала пассажиров сорок лет.')
        }
        this.sendGame()
        return
      }
      case 'valve': {
        if (!s.power || s.pumpDoorOpen || msg.index < 0 || msg.index > 3) return
        if (s.pumpOrder[s.pumpProgress] === msg.index) {
          s.pumpProgress++
          if (s.pumpProgress >= 4) {
            s.pumpDoorOpen = true
            this.say('ДИСПЕТЧЕР: Насосная открыта. Шланги — в насос. Каждый шланг — немного времени.')
          }
        } else {
          s.pumpProgress = 0
          this.broadcast({ t: 'event', type: 'glitch', target: client.id })
        }
        this.sendGame()
        return
      }
      case 'kiosk': {
        this.kiosk(msg.text)
        return
      }
      case 'vending': {
        if (this.vendingCount >= 6 || dist(m.tf.p, VENDING_POS) > 4) return
        const id = `cola${this.vendingCount++}`
        const it = this.addItem(id, 'can', [VENDING_POS[0], 0.35, VENDING_POS[2] + 0.55])
        this.broadcast({ t: 'item', item: it })
        if (this.vendingCount === 1) this.findEgg('vending')
        return
      }
      case 'egg':
        if (msg.id === 'train') this.findEgg('train')
        return
    }
  }

  addTime(sec: number) {
    const s = this.state!
    s.timeLeft += sec
    if (s.timeLeft > s.totalTime) s.totalTime = s.timeLeft
  }

  // Hard eggs: each solved cipher gives time and reveals the next secret.
  kiosk(raw: string) {
    const s = this.state
    if (!s) return
    const text = raw.toUpperCase().replace(/Ё/g, 'Е').replace(/[^А-ЯA-Z0-9]/g, '')
    const answers: Record<string, string> = {
      caesar: this.caesarPlain,
      poem: POEMS[s.poem].answer,
      morse: s.morse,
    }
    const hit = Object.entries(answers).find(([, a]) => a === text)
    if (!hit) {
      this.say('ДИСПЕТЧЕР: Инфокиоск не понимает. Попробуйте думать.')
      return
    }
    const [id] = hit
    if (s.eggsFound.includes(id)) {
      this.say('ДИСПЕТЧЕР: Это вы уже разгадали.')
      return
    }
    s.eggsFound.push(id)
    this.addTime(60)
    const names: Record<string, string> = { caesar: 'Шифр «Литейной» разгадан', poem: 'Стихи машиниста прочитаны', morse: 'Морзянка расшифрована' }
    this.say(`ДИСПЕТЧЕР: ${names[id]}. +60 секунд.`)
    setTimeout(() => this.reveal(), 2500)
    this.sendGame()
  }

  reveal() {
    const s = this.state
    if (!s) return
    let text = 'ДИСПЕТЧЕР: Секретов больше нет. Держите ещё 30 секунд.'
    if (!s.doorOpen && !s.reveals.includes('code')) {
      s.reveals.push('code')
      text = `ДИСПЕТЧЕР: Секрет: код служебного шлюза — ${s.codeOrder.map((ci) => s.codeDigits[ci]).join(' ')}.`
    } else if (!s.leversOk && !s.reveals.includes('levers')) {
      s.reveals.push('levers')
      text = `ДИСПЕТЧЕР: Секрет: рычаги в тоннеле, слева направо — ${s.leverTarget.map((v) => (v ? 'вверх' : 'вниз')).join(', ')}.`
    } else if (!s.armCodeOk && !s.reveals.includes('arm')) {
      s.reveals.push('arm')
      text = `ДИСПЕТЧЕР: Секрет: код взвода детонатора — ${s.armCode.split('').join(' ')}.`
    } else this.addTime(30)
    this.say(text)
    this.sendGame()
  }

  findEgg(id: string) {
    const s = this.state
    if (!s || !s.eggs || s.eggsFound.includes(id)) return
    s.eggsFound.push(id)
    if (AI.eggs[id]) this.say(AI.eggs[id])
    if (id === 'pixel') {
      s.timeLeft += 30
      this.say('ДИСПЕТЧЕР: Пиксель мурлычет. +30 секунд.')
    }
    this.sendGame()
  }

  findSocket(it: ItemState): Socket | null {
    const s = this.state!
    const candidates: Socket[] =
      it.kind === 'cell' ? this.sockets
      : it.kind === 'charge' ? [CHARGE_SOCKET]
      : it.kind === 'tile' ? MOSAIC_SOCKETS
      : it.kind === 'hose' ? HOSE_SOCKETS
      : []
    if (it.kind === 'cell' && s.phase !== 'power') return null
    if (it.kind === 'charge' && s.phase !== 'charge') return null
    const taken = new Set([...this.items.values()].map((o) => o.socket).filter(Boolean))
    const reach = it.kind === 'tile' ? 0.5 : 0.85
    let best: Socket | null = null
    let bestD = reach
    for (const sk of candidates) {
      if (sk.accepts !== it.kind || taken.has(sk.id)) continue
      const d = dist(it.p, sk.pos)
      if (d < bestD) {
        best = sk
        bestD = d
      }
    }
    return best
  }

  snap(it: ItemState, socket: Socket, by: Member) {
    const s = this.state!
    it.p = [...socket.pos]
    it.q = socket.q ?? [0, 0, 0, 1]
    it.socket = socket.id
    it.owner = null
    it.holder = null
    if (it.kind === 'cell' && it.fake) {
      // overloaded cell: shock, blackout, cell burns out
      this.broadcast({ t: 'item', item: it })
      this.broadcast({ t: 'shock', playerId: by.info.id })
      this.broadcast({ t: 'event', type: 'blackout' })
      this.say(AI.fake)
      setTimeout(() => {
        this.items.delete(it.id)
        this.sendGame()
      }, 1600)
      return
    }
    this.broadcast({ t: 'item', item: it })
    if (it.kind === 'cell') {
      const filled = this.sockets.filter((sk) => [...this.items.values()].some((o) => o.socket === sk.id && !o.fake)).length
      if (filled >= this.sockets.length) {
        s.power = true
        this.setPhase('access')
      } else {
        this.say(`ДИСПЕТЧЕР: Ячейка принята. ${filled} из ${this.sockets.length}.`)
        this.sendGame()
      }
    }
    if (it.kind === 'tile') {
      const done = MOSAIC_SOCKETS.every((sk, i) => this.items.get(`tile${i}`)?.socket === sk.id)
      if (done && !s.mosaicDone) {
        s.mosaicDone = true
        this.say('ДИСПЕТЧЕР: Мозаика «Литейной» собрана. Запомните число — оно взводит детонатор.')
      }
      this.sendGame()
    }
    if (it.kind === 'hose') {
      s.hoses = HOSE_SOCKETS.filter((sk) => [...this.items.values()].some((o) => o.socket === sk.id)).length
      this.addTime(PUMP_TIME_PER_HOSE)
      if (s.hoses >= HOSE_SOCKETS.length && !s.pumpOn) {
        s.pumpOn = true
        this.addTime(PUMP_TIME_BONUS)
        this.say(`ДИСПЕТЧЕР: Насос запущен. Вода отступает. +${PUMP_TIME_PER_HOSE + PUMP_TIME_BONUS} с.`)
      } else this.say(`ДИСПЕТЧЕР: Шланг подключён (${s.hoses}/3). Откачка +${PUMP_TIME_PER_HOSE} с.`)
      this.sendGame()
    }
    if (it.kind === 'charge') {
      s.chargePlaced = true
      this.say(AI.chargePlaced)
      this.checkCharge()
      this.sendGame()
    }
  }

  checkCharge() {
    const s = this.state!
    if (s.phase === 'charge' && s.chargePlaced && s.leversOk && s.armCodeOk) this.setPhase('arm')
  }

  // ---------------- admin ----------------
  adminCmd(cmd: AdminCmd) {
    const s = this.state
    switch (cmd.c) {
      case 'addTime':
        if (s) {
          s.timeLeft = Math.max(1, s.timeLeft + cmd.sec)
          s.totalTime = Math.max(s.totalTime, s.timeLeft)
          this.say(`ДИСПЕТЧЕР: Расчётное время до затопления изменено: ${cmd.sec > 0 ? '+' : ''}${cmd.sec} с.`, 'admin')
          this.sendGame()
        }
        return
      case 'pause':
        if (s) {
          s.paused = cmd.paused
          this.sendGame()
        }
        return
      case 'event':
        this.randomEvent(cmd.type, false)
        return
      case 'say':
        this.say(cmd.text.slice(0, 240), 'admin')
        return
      case 'kick':
        this.remove(cmd.playerId, 'Вас исключил администратор')
        return
      case 'forceStart':
        if (this.phase === 'lobby') this.start(true)
        return
      case 'end':
        if (s && s.phase !== 'won' && s.phase !== 'lost') {
          s.outcome = cmd.result === 'lost' ? 'ДИСПЕТЧЕР: Игра остановлена оператором.' : undefined
          this.setPhase(cmd.result)
        }
        return
      case 'reset':
        this.reset()
        return
      case 'difficulty':
        if (this.phase === 'lobby') {
          this.difficulty = cmd.difficulty
          this.sendRoom()
        }
        return
      case 'eggs':
        if (s) {
          s.eggs = cmd.on
          this.sendGame()
        }
        return
      case 'skipPhase':
        if (!s) return
        if (s.phase === 'power') {
          s.power = true
          this.setPhase('access')
        } else if (s.phase === 'access') {
          s.doorOpen = true
          this.setPhase('charge')
        } else if (s.phase === 'charge') {
          s.chargePlaced = true
          s.levers = [...s.leverTarget]
          s.leversOk = true
          s.armCodeOk = true
          const ch = this.items.get('charge')
          if (ch) {
            ch.p = [...CHARGE_SOCKET.pos]
            ch.socket = CHARGE_SOCKET.id
            ch.holder = null
            ch.owner = null
          }
          this.setPhase('arm')
        } else if (s.phase === 'arm') this.setPhase('evac')
        else if (s.phase === 'evac') s.evacLeft = 0.01
        return
      case 'close':
        this.close()
        return
    }
  }
}

export function send(c: Client, msg: ServerMsg) {
  if (c.ws.readyState === 1) c.ws.send(JSON.stringify(msg))
}

// "Lights out": start solved, then press a few random levers — always solvable.
function lightsOutStart() {
  const lamps = Array(TLEVER_COUNT).fill(true)
  do {
    for (let k = 0; k < 3; k++) {
      const i = Math.floor(Math.random() * TLEVER_COUNT)
      for (const j of [i - 1, i, i + 1]) if (j >= 0 && j < TLEVER_COUNT) lamps[j] = !lamps[j]
    }
  } while (lamps.every(Boolean))
  return lamps
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function makeCode() {
  return Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('')
}
