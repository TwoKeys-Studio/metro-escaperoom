// End-to-end playthrough over the real WebSocket protocol.
// Plays a full solo game, drives the admin panel and checks lobby rules, then prints a transcript of
// checkpoints. Run against a live server:  node server/test/playthrough.ts   (PORT, ADMIN_PASSWORD env)
import {
  CAESAR_SHIFT, CHARGE_SOCKET, DIFFICULTIES, F2_PROPS, GAS_DIAL_STEPS, GAS_SOCKETS, GAS_SPOTS, HOSE_SOCKETS, MOSAIC_SOCKETS,
  POEMS, PROPS, RAT_SPOTS, TLEVER_COUNT, VENDING_POS, caesar, powerSockets, type Vec3,
} from '../../shared/level.ts'
import type { AdminCmd, ClientMsg, GameState, ItemState, Phase, ServerMsg } from '../../shared/protocol.ts'

const PORT = Number(process.env.PORT ?? 2567)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'neon17'
const URL = `ws://localhost:${PORT}/ws`

const transcript: string[] = []
const ok = (label: string) => {
  transcript.push(label)
  console.log('  ✓', label)
}

class Bot {
  ws: WebSocket
  name: string
  id = ''
  state: GameState | null = null
  phase: Phase = 'lobby'
  roomId = ''
  items = new Map<string, ItemState>()
  log: ServerMsg[] = []
  private waiters = new Set<() => void>()

  constructor(name: string) {
    this.name = name
    this.ws = new WebSocket(URL)
    this.ws.onmessage = (e) => this.onMessage(JSON.parse(String(e.data)) as ServerMsg)
  }

  private onMessage(m: ServerMsg) {
    this.log.push(m)
    if (m.t === 'welcome') this.id = m.id
    if (m.t === 'room') {
      this.roomId = m.id
      this.phase = m.phase
    }
    if (m.t === 'game') {
      this.state = m.state
      this.items = new Map(m.items.map((it) => [it.id, it]))
    }
    if (m.t === 'item') this.items.set(m.item.id, m.item)
    for (const w of [...this.waiters]) w()
  }

  send(m: ClientMsg) {
    this.ws.send(JSON.stringify(m))
  }

  /** Resolves once `cond` holds; re-checked on every incoming message. */
  until(label: string, cond: () => unknown, ms = 6000): Promise<void> {
    return new Promise((resolve, reject) => {
      const check = () => {
        if (!cond()) return
        clearTimeout(timer)
        this.waiters.delete(check)
        resolve()
      }
      const timer = setTimeout(() => {
        this.waiters.delete(check)
        reject(new Error(`[${this.name}] timeout: ${label}`))
      }, ms)
      this.waiters.add(check)
      check()
    })
  }

  mark() {
    return this.log.length
  }

  /** Waits for a message matching `pred` that arrived after `from`. */
  async got(label: string, from: number, pred: (m: ServerMsg) => unknown, ms = 6000) {
    await this.until(label, () => this.log.slice(from).some(pred), ms)
  }

  said(from: number, part: string, who: 'ai' | 'admin' = 'ai') {
    return this.got(`say "${part}"`, from, (m) => m.t === 'say' && m.from === who && m.text.includes(part))
  }

  async open() {
    await this.until('welcome', () => this.id)
    this.send({ t: 'hello', name: this.name })
  }

  move(p: Vec3) {
    this.send({ t: 'move', p, yaw: 0, pitch: 0, crouch: false, flash: true })
  }

  async carry(id: string, to: Vec3) {
    const it = this.items.get(id)
    if (!it) throw new Error(`no item ${id}`)
    this.move(it.p)
    this.send({ t: 'grab', id })
    await this.until(`grab ${id}`, () => this.items.get(id)?.holder === this.id)
    this.send({ t: 'itemTf', id, p: to, q: [0, 0, 0, 1] })
    this.send({ t: 'release', id, p: to, q: [0, 0, 0, 1], v: [0, 0, 0] })
    await this.until(`release ${id}`, () => this.items.get(id)?.holder === null)
  }

  close() {
    this.ws.close()
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

class Admin extends Bot {
  async login() {
    await this.until('welcome', () => this.id)
    let from = this.mark()
    this.send({ t: 'adminAuth', password: 'wrong-password' })
    await this.got('admin auth rejected', from, (m) => m.t === 'error' && m.text.includes('Неверный пароль администратора'))
    ok('admin: wrong password rejected')
    from = this.mark()
    this.send({ t: 'adminAuth', password: ADMIN_PASSWORD })
    await this.got('adminOk', from, (m) => m.t === 'adminOk')
    await this.got('adminRooms', from, (m) => m.t === 'adminRooms')
    ok('admin: logged in, receives room list')
  }

  cmd(roomId: string, cmd: AdminCmd) {
    this.send({ t: 'admin', roomId, cmd })
  }
}

async function soloPlaythrough(admin: Admin) {
  console.log('\nSolo playthrough')
  const bot = new Bot('Бот')
  await bot.open()
  bot.send({ t: 'create', name: '', difficulty: 'normal', solo: true })
  await bot.until('game starts', () => bot.state?.phase === 'intro')
  if (!bot.state!.solo) throw new Error('solo flag not set')
  await bot.got('intro quake', 0, (m) => m.t === 'event' && m.type === 'quake')
  await bot.got('tick stream', 0, (m) => m.t === 'tick' && m.players[bot.id])
  ok('solo room starts immediately in intro with quake and ticks')
  const s = () => bot.state!
  const cfg = DIFFICULTIES.normal
  if (s().totalTime !== cfg.minutes * 60) throw new Error('wrong total time')
  const expected = cfg.cells + cfg.fakeCells + 1 + 9 + 3 + PROPS.length + F2_PROPS.length + GAS_SPOTS.length + RAT_SPOTS.length
  if (bot.items.size !== expected) throw new Error(`unexpected item count ${bot.items.size}, expected ${expected}`)
  ok('items spawned: cells, charge, 9 tiles, 3 hoses, gas cylinders, rats, props on both floors')

  let from = bot.mark()
  await bot.until('phase power', () => s().phase === 'power', 10000)
  await bot.said(from, 'Для запуска щита нужны энергоячейки')
  ok('intro → power after 7 s')

  // chat
  from = bot.mark()
  bot.send({ t: 'chat', text: '  привет  ' })
  await bot.got('chat echo', from, (m) => m.t === 'chat' && m.text === 'привет' && m.from === bot.id)
  ok('chat is trimmed and echoed')

  // broken input must be dropped without a reply and without hurting the connection
  from = bot.mark()
  bot.ws.send('not json')
  bot.ws.send(JSON.stringify({ t: 'no-such-message' }))
  bot.ws.send(JSON.stringify({ t: 'chat' })) // no text: the handler throws
  bot.ws.send(JSON.stringify({ t: 'grab', id: 'no-such-item' }))
  bot.send({ t: 'chat', text: 'жив' })
  await bot.got('chat after garbage', from, (m) => m.t === 'chat' && m.text === 'жив')
  const stray = bot.log.slice(from).find((m) => !['chat', 'tick', 'say', 'game', 'room', 'event'].includes(m.t))
  if (stray) throw new Error(`unexpected reply to garbage: ${JSON.stringify(stray)}`)
  ok('malformed messages are ignored, nothing is sent back')

  // ---- power: the fake cell first, then the real ones
  const sockets = powerSockets(cfg.cells)
  const cells = [...bot.items.values()].filter((it) => it.kind === 'cell')
  const fake = cells.find((c) => c.fake)!
  from = bot.mark()
  await bot.carry(fake.id, sockets[0].pos)
  await bot.got('shock', from, (m) => m.t === 'shock' && m.playerId === bot.id)
  await bot.got('blackout', from, (m) => m.t === 'event' && m.type === 'blackout')
  await bot.said(from, 'Ячейка перегружена')
  await bot.until('fake cell burns out', () => !bot.items.has(fake.id))
  ok('fake cell: shock, blackout, burns out after 1.6 s')

  const real = cells.filter((c) => !c.fake)
  from = bot.mark()
  await bot.carry(real[0].id, sockets[0].pos)
  await bot.said(from, 'Ячейка принята. 1 из 3')
  if (bot.items.get(real[0].id)!.socket !== 'slot0') throw new Error('cell did not snap')
  await bot.carry(real[1].id, sockets[1].pos)
  from = bot.mark()
  await bot.carry(real[2].id, sockets[2].pos)
  await bot.until('phase access', () => s().phase === 'access' && s().power)
  await bot.said(from, 'Питание восстановлено')
  ok('3 cells → power on → access')

  // ---- access: wrong code, then the right one
  from = bot.mark()
  const code = s().codeOrder.map((ci) => s().codeDigits[ci]).join('')
  bot.send({ t: 'keypad', code: code === '0000' ? '1111' : '0000' })
  await bot.got('glitch on wrong code', from, (m) => m.t === 'event' && m.type === 'glitch' && m.target === bot.id)
  if (s().phase !== 'access') throw new Error('wrong code advanced the phase')
  ok('wrong door code → glitch, no progress')
  await bot.got('solo door code hint', 0, (m) => m.t === 'say' && m.text.includes('Подсказка для слабых. Код'), 9000)
  ok('solo run gets the door code hint')
  from = bot.mark()
  bot.send({ t: 'keypad', code })
  await bot.until('phase charge', () => s().phase === 'charge' && s().doorOpen)
  await bot.said(from, 'Код доступа принят')
  ok('door code → charge')

  // ---- transfer door: lights out
  const lamps = [...s().transferLamps]
  let solution: number[] = []
  for (let mask = 0; mask < 1 << TLEVER_COUNT; mask++) {
    const l = [...lamps]
    const presses: number[] = []
    for (let i = 0; i < TLEVER_COUNT; i++) {
      if (!(mask & (1 << i))) continue
      presses.push(i)
      for (const j of [i - 1, i, i + 1]) if (j >= 0 && j < TLEVER_COUNT) l[j] = !l[j]
    }
    if (l.every(Boolean)) {
      solution = presses
      break
    }
  }
  from = bot.mark()
  for (const i of solution) bot.send({ t: 'tlever', index: i })
  await bot.until('transfer open', () => s().transferOpen)
  await bot.said(from, 'Переход на ветку Б открыт')
  ok('lights-out levers → transfer door open')

  // ---- pump: wrong valve resets, right order opens, hoses add time
  const order = [...s().pumpOrder]
  bot.send({ t: 'valve', index: order[0] })
  await bot.until('valve progress', () => s().pumpProgress === 1)
  from = bot.mark()
  bot.send({ t: 'valve', index: order[0] })
  await bot.until('valve reset', () => s().pumpProgress === 0)
  await bot.got('valve glitch', from, (m) => m.t === 'event' && m.type === 'glitch')
  from = bot.mark()
  for (const i of order) bot.send({ t: 'valve', index: i })
  await bot.until('pump door', () => s().pumpDoorOpen)
  await bot.said(from, 'Насосная открыта')
  ok('valves: wrong one resets, riddle order opens the pump room')

  const before = s().timeLeft
  from = bot.mark()
  for (let i = 0; i < 3; i++) await bot.carry(`hose${i}`, HOSE_SOCKETS[i].pos)
  await bot.until('pump on', () => s().pumpOn && s().hoses === 3)
  await bot.said(from, 'Шланг подключён (1/3)')
  await bot.said(from, 'Насос запущен')
  const gained = s().timeLeft - before
  if (gained < 190 || gained > 196) throw new Error(`pump gave ${gained} s, expected ~195`)
  ok('3 hoses → pump on, +195 s')

  // ---- hard eggs at the kiosk
  from = bot.mark()
  bot.send({ t: 'kiosk', text: 'чепуха' })
  await bot.said(from, 'Инфокиоск не понимает')
  const answers = [caesar(s().caesar, -CAESAR_SHIFT), POEMS[s().poem].answer, s().morse]
  const expectReveal = ['рычаги в тоннеле', 'код взвода детонатора', 'Секретов больше нет']
  for (let i = 0; i < 3; i++) {
    from = bot.mark()
    bot.send({ t: 'kiosk', text: i === 0 ? answers[i].toLowerCase() : answers[i] })
    await bot.said(from, '+60 секунд')
    await bot.said(from, expectReveal[i])
  }
  if (s().reveals.join() !== 'levers,arm') throw new Error(`reveals: ${s().reveals}`)
  if (!['caesar', 'poem', 'morse'].every((e) => s().eggsFound.includes(e))) throw new Error('hard eggs not recorded')
  from = bot.mark()
  bot.send({ t: 'kiosk', text: answers[2] })
  await bot.said(from, 'Это вы уже разгадали')
  ok('kiosk: caesar, poem, morse → +60 s each, reveals levers then arm code, repeats refused')

  // ---- simple eggs
  from = bot.mark()
  bot.move([VENDING_POS[0], 1, VENDING_POS[2] + 1])
  bot.send({ t: 'vending' })
  await bot.until('cola', () => bot.items.has('cola0'))
  await bot.said(from, 'Автомат выдал')
  from = bot.mark()
  const pixelHome = bot.items.get('pixel')!.p
  const t0 = s().timeLeft
  await bot.carry('pixel', pixelHome)
  await bot.said(from, 'Пиксель мурлычет')
  if (s().timeLeft - t0 < 28) throw new Error('pixel gave no time')
  from = bot.mark()
  bot.send({ t: 'egg', id: 'train' })
  await bot.said(from, 'Вагон 1977')
  ok('easter eggs: vending, pixel (+30 s), train')

  // ---- mosaic → arm code → levers → charge
  from = bot.mark()
  for (let i = 0; i < 9; i++) await bot.carry(`tile${i}`, MOSAIC_SOCKETS[i].pos)
  await bot.until('mosaic done', () => s().mosaicDone)
  await bot.said(from, 'Мозаика «Литейной» собрана')
  ok('9 tiles in order → mosaic done')

  from = bot.mark()
  bot.send({ t: 'keypad', code: s().armCode === '1000' ? '1001' : '1000', target: 'arm' })
  await bot.said(from, 'Код взвода неверен')
  bot.send({ t: 'keypad', code: s().armCode, target: 'arm' })
  await bot.until('arm code ok', () => s().armCodeOk)
  ok('arm code: wrong refused, right accepted')

  for (let i = 0; i < s().leverTarget.length; i++) if (s().levers[i] !== s().leverTarget[i]) bot.send({ t: 'lever', index: i })
  await bot.until('levers ok', () => s().leversOk)
  if (s().phase !== 'charge') throw new Error('phase moved before the charge was placed')
  ok('junction levers match the schematic')

  // ---- second floor: rats, breakers → storage room, gas cylinders + regulators
  const rat = bot.items.get('rat0')!
  const ratStart = [...rat.p]
  await bot.got('a rat runs', 0, (m) => m.t === 'tick' && m.items.some((it) => it.id.startsWith('rat')), 12000)
  await bot.carry('rat0', [ratStart[0] + 1, ratStart[1] + 1, ratStart[2]])
  ok('rats scurry on their own and can be picked up')

  if (s().storageOpen) throw new Error('storage room open before the breakers were set')
  const firstWrong = s().breakerTarget.findIndex((v) => !v)
  bot.send({ t: 'breaker', index: firstWrong })
  await bot.until('wrong breaker up', () => s().breakers[firstWrong])
  if (s().storageOpen) throw new Error('storage opened on a wrong pattern')
  bot.send({ t: 'breaker', index: firstWrong })
  from = bot.mark()
  for (let i = 0; i < s().breakerTarget.length; i++) if (s().breakerTarget[i]) bot.send({ t: 'breaker', index: i })
  await bot.until('storage open', () => s().storageOpen)
  await bot.said(from, 'Камера хранения разблокирована')
  ok('breakers: wrong pattern does nothing, the hidden pattern unlocks the storage room')

  from = bot.mark()
  for (let i = 0; i < GAS_SOCKETS.length; i++) await bot.carry(`gas${i}`, GAS_SOCKETS[i].pos)
  await bot.until('cylinders loaded', () => s().gasLoaded === GAS_SOCKETS.length)
  await bot.said(from, 'Все баллоны в рампе')
  if (s().gasOk) throw new Error('gas ok before the regulators were set')
  for (let i = 0; i < s().gasTarget.length; i++) for (let k = 0; k < s().gasTarget[i]; k++) bot.send({ t: 'dial', index: i })
  await bot.until('gas ok', () => s().gasOk)
  await bot.said(from, 'Давление в норме')
  // a solved rig ignores further clicks
  bot.send({ t: 'dial', index: 0 })
  bot.send({ t: 'chat', text: 'газ' })
  await bot.got('chat after dial', from, (m) => m.t === 'chat' && m.text === 'газ')
  if (s().gasDials[0] !== s().gasTarget[0] || s().gasDials[0] >= GAS_DIAL_STEPS) throw new Error('regulator moved after the rig was solved')
  if (s().phase !== 'charge') throw new Error('phase moved before the charge was placed')
  ok('gas rig: 3 cylinders + regulators at the hidden pressures → gas ok')

  from = bot.mark()
  await bot.carry('charge', CHARGE_SOCKET.pos)
  await bot.until('phase arm', () => s().phase === 'arm' && s().chargePlaced)
  await bot.said(from, 'Заряд установлен')
  await bot.said(from, 'Вы один')
  ok('charge placed with levers, arm code and gas ready → arm')

  // ---- admin tools on a live room
  const room = bot.roomId
  admin.send({ t: 'adminWatch', roomId: room })
  await admin.until('admin watches', () => admin.state?.phase === 'arm' && admin.roomId === room)
  ok('admin: watching a room receives room + game state')
  from = bot.mark()
  admin.cmd(room, { c: 'say', text: 'проверка связи' })
  await bot.said(from, 'проверка связи', 'admin')
  const t1 = s().timeLeft
  admin.cmd(room, { c: 'addTime', sec: 60 })
  await bot.said(from, '+60 с', 'admin')
  await bot.until('admin addTime applied', () => s().timeLeft - t1 >= 58)
  admin.cmd(room, { c: 'pause', paused: true })
  await bot.until('paused', () => s().paused)
  admin.cmd(room, { c: 'pause', paused: false })
  await bot.until('resumed', () => !s().paused)
  admin.cmd(room, { c: 'eggs', on: false })
  await bot.until('eggs off', () => !s().eggs)
  admin.cmd(room, { c: 'eggs', on: true })
  await bot.until('eggs on', () => s().eggs)
  admin.cmd(room, { c: 'event', type: 'scream' })
  await bot.got('scream', from, (m) => m.t === 'event' && m.type === 'scream')
  for (const type of ['ghostWoman', 'peeker', 'laugh'] as const) {
    admin.cmd(room, { c: 'event', type })
    await bot.got(type, from, (m) => m.t === 'event' && m.type === type && m.target === bot.id)
  }
  ok('admin: say, addTime, pause, eggs toggle, event')

  // ---- detonator → evac → escape → won
  from = bot.mark()
  bot.send({ t: 'hold', console: 'a', down: true })
  await bot.until('detonator charging', () => s().detonator.progress > 0 && s().detonator.progress < 1)
  await bot.until('phase evac', () => s().phase === 'evac', 5000)
  await bot.said(from, 'Детонация запущена')
  ok('holding one console for 2.5 s → evac')

  bot.move([0, 1, -2])
  from = bot.mark()
  admin.cmd(room, { c: 'skipPhase' })
  await bot.until('phase escape', () => s().phase === 'escape' && s().elevatorOpen && s().blastDoorClosed)
  await bot.said(from, 'Тоннель запечатан')
  ok('evac ends → blast door closed, elevator open')

  from = bot.mark()
  bot.move([8, 1, -9])
  await bot.until('phase won', () => s().phase === 'won')
  await bot.said(from, 'Лифт ушёл наверх')
  await bot.got('escaped flag', from, (m) => m.t === 'room' && m.players[0].escaped)
  ok('everyone alive in the elevator → won')

  // ---- restart from the end screen, then die in the tunnel
  bot.send({ t: 'start' })
  await bot.until('restart', () => s().phase === 'intro')
  ok('solo: start on the end screen restarts the run')
  await bot.until('power again', () => s().phase === 'power', 10000)
  const phases: Phase[] = ['access', 'charge', 'arm', 'evac']
  for (const p of phases) {
    admin.cmd(room, { c: 'skipPhase' })
    await bot.until(`skip to ${p}`, () => s().phase === p)
  }
  if (bot.items.get('charge')!.socket !== CHARGE_SOCKET.id) throw new Error('skipPhase did not place the charge')
  ok('admin: skipPhase walks power → access → charge → arm → evac')
  bot.move([50, 0, 8])
  await sleep(150)
  from = bot.mark()
  admin.cmd(room, { c: 'skipPhase' })
  await bot.until('lost', () => s().phase === 'lost')
  await bot.said(from, 'остался в тоннеле')
  await bot.said(from, 'Никто не выжил')
  ok('staying in the east tunnel at detonation → dead → lost')

  admin.cmd(room, { c: 'reset' })
  await bot.until('back to lobby', () => bot.phase === 'lobby')
  ok('admin: reset returns the room to the lobby')
  admin.cmd(room, { c: 'forceStart' })
  await bot.until('force start', () => bot.phase === 'intro')
  admin.cmd(room, { c: 'end', result: 'lost' })
  await bot.until('ended', () => s().phase === 'lost' && s().outcome?.includes('остановлена оператором'))
  ok('admin: forceStart and end')
  from = bot.mark()
  admin.cmd(room, { c: 'kick', playerId: bot.id })
  await bot.got('kicked', from, (m) => m.t === 'left' && m.reason === 'Вас исключил администратор')
  ok('admin: kick')
  bot.close()
}

async function lobbyRules(admin: Admin) {
  console.log('\nLobby rules')
  const host = new Bot('Хост')
  const guest = new Bot('Гость')
  await host.open()
  await guest.open()
  host.send({ t: 'create', name: 'Проверка', difficulty: 'hard', password: 'abc' })
  await host.until('room created', () => host.roomId)
  const room = host.roomId
  if (!/^[A-Z2-9]{4}$/.test(room)) throw new Error(`bad room code ${room}`)
  await guest.until('room listed', () => guest.log.some((m) => m.t === 'rooms' && m.rooms.some((r) => r.id === room && r.locked && r.difficulty === 'hard')))
  ok('create: 4-char code, room appears in the public list as locked')

  let from = guest.mark()
  guest.send({ t: 'join', roomId: 'ZZZZ' })
  await guest.got('not found', from, (m) => m.t === 'error' && m.text === 'Комната не найдена')
  guest.send({ t: 'join', roomId: room, password: 'nope' })
  await guest.got('bad password', from, (m) => m.t === 'error' && m.text === 'Неверный пароль комнаты')
  guest.send({ t: 'join', roomId: room.toLowerCase(), password: 'abc' })
  await guest.until('joined', () => guest.roomId === room)
  await host.got('host sees guest', 0, (m) => m.t === 'room' && m.players.length === 2 && m.players[0].host && !m.players[1].host)
  ok('join: unknown room and wrong password refused, lowercase code accepted')

  from = host.mark()
  guest.send({ t: 'difficulty', difficulty: 'easy' })
  guest.send({ t: 'ready', ready: true })
  await host.got('guest ready', from, (m) => m.t === 'room' && m.players[1].ready && m.difficulty === 'hard')
  host.send({ t: 'difficulty', difficulty: 'nightmare' })
  await host.got('difficulty changed', from, (m) => m.t === 'room' && m.difficulty === 'nightmare')
  ok('lobby: ready flag, only the host changes difficulty')

  // works for any MIN_PLAYERS: too few players or, failing that, a guest who is not ready
  from = host.mark()
  guest.send({ t: 'ready', ready: false })
  await host.got('guest not ready', from, (m) => m.t === 'room' && !m.players[1].ready)
  host.send({ t: 'start' })
  await host.got('start refused', from, (m) => m.t === 'error' && (m.text.startsWith('Нужно минимум') || m.text === 'Не все игроки готовы'))
  ok('start refused while players are missing or not ready')

  from = guest.mark()
  host.send({ t: 'leave' })
  await host.got('left', 0, (m) => m.t === 'left' && m.reason === 'Вы вышли из комнаты')
  await guest.got('host passes on', from, (m) => m.t === 'room' && m.players.length === 1 && m.players[0].host)
  ok('leave: host role passes to the next player')

  from = guest.mark()
  admin.cmd(room, { c: 'close' })
  await guest.got('closed', from, (m) => m.t === 'left' && m.reason === 'Комнату закрыл администратор')
  await guest.got('room gone from list', from, (m) => m.t === 'rooms' && !m.rooms.some((r) => r.id === room))
  ok('admin: close removes the room and its players')
  host.close()
  guest.close()
}

const res = await fetch(`http://localhost:${PORT}/health`)
if ((await res.text()) !== 'ok') throw new Error('/health is not ok')
ok('GET /health → ok')

const admin = new Admin('Оператор')
try {
  await admin.login()
  await soloPlaythrough(admin)
  await lobbyRules(admin)
  console.log(`\nPASS — ${transcript.length} checkpoints`)
  process.exit(0)
} catch (e) {
  console.error('\nFAIL after', transcript.length, 'checkpoints:', (e as Error).message)
  process.exit(1)
}
