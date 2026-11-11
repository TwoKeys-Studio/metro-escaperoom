import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { BRANCH, CAESAR_SHIFT, CHARGE_SOCKET, DIFFICULTIES, ELEVATOR, HALL, MAINT, PIT, POEMS, PUMP, TRANSFER, VALVE_SYMBOLS, caesar, type Difficulty } from '../../../shared/level'
import type { AdminCmd, EventType } from '../../../shared/protocol'
import { live, send, useNet } from '../net'
import { DifficultyPicker } from '../ui/DifficultyPicker'

const PHASES: Record<string, string> = {
  lobby: 'Лобби', intro: 'Вступление', power: 'Питание', access: 'Шлюз', charge: 'Заряд', arm: 'Детонатор',
  evac: 'Эвакуация', escape: 'Лифт', won: 'Победа', lost: 'Поражение',
}
const EVENTS: { type: EventType; label: string }[] = [
  { type: 'blackout', label: 'Блэкаут' },
  { type: 'ghostTrain', label: 'Поезд-призрак' },
  { type: 'quake', label: 'Толчок' },
  { type: 'shadow', label: 'Пассажир' },
  { type: 'whisper', label: 'Шёпот' },
  { type: 'glitch', label: 'Глитч' },
  { type: 'scream', label: 'Крик' },
  { type: 'ghostWoman', label: 'Женщина в белом' },
  { type: 'peeker', label: 'Голова из-за угла' },
  { type: 'laugh', label: 'Смех' },
]
const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`

export function Admin() {
  const admin = useNet((s) => s.admin)
  const connected = useNet((s) => s.connected)
  const [pass, setPass] = useState('')
  if (!admin) {
    return (
      <div className="page admin-login-page">
        <main className="wrap admin-login">
          <header className="topbar">
            <Link to="/" className="logo" translate="no">НЕОН<b>-17</b></Link>
            <span className={`tag tag-dot ${connected ? 'tag-ok' : 'tag-pink'}`} role="status">{connected ? 'Сервер на связи' : 'Нет связи'}</span>
          </header>
          <form className="panel" onSubmit={(e) => { e.preventDefault(); send({ t: 'adminAuth', password: pass }) }}>
            <div className="eyebrow">Служебный вход</div>
            <h1 className="h2">Пульт оператора</h1>
            <p className="field-help">Отсюда ведущий следит за комнатами, двигает таймер и пугает игроков.</p>
            <div className="field">
              <label htmlFor="ap">Пароль администратора</label>
              <input id="ap" name="password" type="password" className="input" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="current-password" spellCheck={false} />
            </div>
            <button className="btn btn-primary btn-block">Войти</button>
          </form>
        </main>
      </div>
    )
  }
  return <Dashboard />
}

function Dashboard() {
  const rooms = useNet((s) => s.adminRooms)
  const [sel, setSel] = useState<string | null>(null)
  const selected = rooms.find((r) => r.id === sel) ?? rooms[0] ?? null
  const id = selected?.id ?? null

  useEffect(() => {
    send({ t: 'adminWatch', roomId: id })
  }, [id])
  useEffect(() => () => {
    // leaving the dashboard (not to the 3D view) stops watching
    if (!location.pathname.startsWith('/admin/watch')) {
      send({ t: 'adminWatch', roomId: null })
      useNet.setState({ room: null, game: null, items: {} })
    }
  }, [])

  const totalPlayers = rooms.reduce((n, r) => n + r.list.length, 0)
  const live_ = rooms.filter((r) => r.phase !== 'lobby').length

  return (
    <div className="page admin">
      <div className="wrap admin-wrap">
        <header className="topbar">
          <Link to="/" className="logo" translate="no">НЕОН<b>-17</b> <span className="faint">/ оператор</span></Link>
          <dl className="admin-stats">
            <div><dt>комнат</dt><dd>{rooms.length}</dd></div>
            <div><dt>в игре</dt><dd>{live_}</dd></div>
            <div><dt>игроков</dt><dd>{totalPlayers}</dd></div>
          </dl>
        </header>
        <div className="admin-grid">
          <nav className="panel admin-rooms" aria-label="Комнаты">
            <h2 className="h2">Комнаты</h2>
            {rooms.length === 0 && <p className="empty">Нет активных комнат. Они появятся, как только игроки создадут лобби.</p>}
            <ul className="list">
              {rooms.map((r) => (
                <li key={r.id}>
                  <button className={`admin-room ${r.id === id ? 'on' : ''}`} onClick={() => setSel(r.id)} aria-current={r.id === id}>
                    <span className="truncate">{r.name}</span>
                    <span className="meta">{r.id} · {r.list.length} игр. · {PHASES[r.phase]}{r.state && r.phase !== 'lobby' ? <> · <b>{fmt(r.state.timeLeft)}</b></> : ''}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          {selected ? <RoomControl key={selected.id} roomId={selected.id} /> : (
            <main className="panel">
              <h1 className="h2">Эфир пуст</h1>
              <p className="muted">Когда появится комната, здесь будут карта станции, таймер и пульт страшилок.</p>
            </main>
          )}
        </div>
      </div>
    </div>
  )
}

function RoomControl({ roomId }: { roomId: string }) {
  const r = useNet((s) => s.adminRooms.find((x) => x.id === roomId))
  const [say, setSay] = useState('')
  if (!r) return null
  const s = r.state
  const cmd = (c: AdminCmd) => send({ t: 'admin', roomId, cmd: c })
  const inGame = r.phase !== 'lobby'
  const over = r.phase === 'won' || r.phase === 'lost'

  return (
    <main className="admin-main">
      <section className="panel">
        <div className="admin-room-head">
          <div>
            <div className="eyebrow">{r.id} · {DIFFICULTIES[r.difficulty].label}</div>
            <h1 className="h2">{r.name}</h1>
          </div>
          <dl className="admin-kpis">
            <div><dt>Фаза</dt><dd>{PHASES[r.phase]}</dd></div>
            <div><dt>Таймер</dt><dd className={s && s.timeLeft < 60 ? 'pink' : 'acid'}>{s ? fmt(s.timeLeft) : '—'}{s?.paused ? ' ❚❚' : ''}</dd></div>
            <div><dt>Вода</dt><dd>{s ? `${s.water.toFixed(2)} м` : '—'}</dd></div>
            <div><dt>Пасхалки</dt><dd>{s ? `${s.eggsFound.length}/3` : '—'}</dd></div>
          </dl>
        </div>
      </section>

      <div className="admin-cols">
        <div className="stack">
          <section className="panel" aria-labelledby="map-h">
            <div className="panel-head">
              <h2 id="map-h" className="h2">Карта</h2>
              {inGame && !over && <Link className="btn btn-sm btn-primary" to={`/admin/watch/${roomId}`}>Наблюдать в 3D</Link>}
            </div>
            <MiniMap />
            <ul className="admin-legend" aria-label="Обозначения на карте">
              <li><i style={{ ['--c' as string]: 'var(--cyan)' }} />ячейка</li>
              <li><i style={{ ['--c' as string]: 'var(--pink)' }} />битая ячейка</li>
              <li><i style={{ ['--c' as string]: 'var(--acid)' }} />заряд</li>
              <li><i className="ring" style={{ ['--c' as string]: 'var(--acid)' }} />место заряда</li>
              <li><i style={{ ['--c' as string]: 'var(--ink)' }} />плитка</li>
              <li><i style={{ ['--c' as string]: 'var(--amber)' }} />шланг, Пиксель</li>
            </ul>
          </section>

          {s && (
            <section className="panel" aria-labelledby="st-h">
              <h2 id="st-h" className="h2">Станция</h2>
              <ul className="admin-flags" aria-label="Что уже сделано">
                <li className={s.power ? 'ok' : ''}>Питание</li>
                <li className={s.doorOpen ? 'ok' : ''}>Шлюз</li>
                <li className={s.chargePlaced ? 'ok' : ''}>Заряд</li>
                <li className={s.leversOk ? 'ok' : ''}>Рычаги</li>
                <li className={s.transferOpen ? 'ok' : ''}>Переход</li>
                <li className={s.mosaicDone ? 'ok' : ''}>Мозаика</li>
                <li className={s.armCodeOk ? 'ok' : ''}>Взвод</li>
                <li className={s.pumpDoorOpen ? 'ok' : ''}>Вентили</li>
                <li className={s.pumpOn ? 'ok' : ''}>Шланги {s.hoses}/3</li>
                <li className={s.storageOpen ? 'ok' : ''}>Рубильники</li>
                <li className={s.gasOk ? 'ok' : ''}>Газ {s.gasLoaded}/3</li>
              </ul>
              <dl className="admin-answers">
                <div><dt>Код шлюза</dt><dd>{s.codeOrder.map((ci) => s.codeDigits[ci]).join('')}</dd></div>
                <div><dt>Код взвода</dt><dd>{s.armCode}</dd></div>
                <div><dt>Рычаги: сейчас / нужно</dt><dd><span>{s.levers.map((v) => (v ? '▲' : '▼')).join('')} / </span>{s.leverTarget.map((v) => (v ? '▲' : '▼')).join('')}</dd></div>
                <div><dt>Вентили</dt><dd>{s.pumpOrder.map((i) => VALVE_SYMBOLS[i]).join(' ')}</dd></div>
                <div><dt>Рубильники: сейчас / нужно</dt><dd><span>{s.breakers.map((v) => (v ? '▲' : '▼')).join('')} / </span>{s.breakerTarget.map((v) => (v ? '▲' : '▼')).join('')}</dd></div>
                <div><dt>Редукторы: сейчас / нужно</dt><dd><span>{s.gasDials.join(' ')} / </span>{s.gasTarget.join(' ')}</dd></div>
                <div><dt>Тайна: Цезарь</dt><dd>{caesar(s.caesar, -CAESAR_SHIFT)}</dd></div>
                <div><dt>Тайна: стих</dt><dd>{POEMS[s.poem].answer}</dd></div>
                <div><dt>Тайна: морзе</dt><dd>{s.morse}</dd></div>
                <div><dt>Тайн найдено</dt><dd>{s.eggsFound.length}<span> из 6</span></dd></div>
              </dl>
            </section>
          )}

          <section className="panel" aria-labelledby="pl-h">
            <h2 id="pl-h" className="h2">Игроки · {r.list.length}</h2>
            {r.list.length === 0 && <p className="empty">В комнате никого нет.</p>}
            <ul className="list">
              {r.list.map((p) => (
                <li key={p.id}>
                  <span className="admin-player" style={{ ['--c' as string]: p.color }}>
                    <i aria-hidden />
                    <span className="truncate">{p.name}</span>
                    {p.host && <span className="tag tag-acid">Хост</span>}
                  </span>
                  <span className="row">
                    <span className={`tag ${p.escaped ? 'tag-ok' : !p.alive ? 'tag-pink' : p.ready || p.host ? 'tag-ok' : ''}`}>
                      {p.escaped ? 'Спасён' : !p.alive ? 'Погиб' : inGame ? 'В игре' : p.ready || p.host ? 'Готов' : 'Ждёт'}
                    </span>
                    <ConfirmButton onConfirm={() => cmd({ c: 'kick', playerId: p.id })} label={`Исключить ${p.name}`}>Исключить</ConfirmButton>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="stack">
          <section className="panel" aria-labelledby="time-h">
            <h2 id="time-h" className="h2">Время</h2>
            <div className="btn-row">
              <button className="btn btn-sm" disabled={!s} onClick={() => cmd({ c: 'addTime', sec: -300 })}>−5 мин</button>
              <button className="btn btn-sm" disabled={!s} onClick={() => cmd({ c: 'addTime', sec: -60 })}>−1 мин</button>
              <button className="btn btn-sm" disabled={!s} onClick={() => cmd({ c: 'addTime', sec: 60 })}>+1 мин</button>
              <button className="btn btn-sm" disabled={!s} onClick={() => cmd({ c: 'addTime', sec: 300 })}>+5 мин</button>
              <button className="btn btn-sm" disabled={!s || over} onClick={() => cmd({ c: 'pause', paused: !s?.paused })}>{s?.paused ? 'Продолжить' : 'Пауза'}</button>
            </div>
          </section>

          <section className="panel" aria-labelledby="ev-h">
            <h2 id="ev-h" className="h2">Страшилки</h2>
            <div className="btn-row">
              {EVENTS.map((e) => (
                <button key={e.type} className="btn btn-sm" disabled={!inGame || over} onClick={() => cmd({ c: 'event', type: e.type })}>{e.label}</button>
              ))}
            </div>
            <form className="admin-say" onSubmit={(e) => { e.preventDefault(); if (say.trim()) cmd({ c: 'say', text: say }); setSay('') }}>
              <label htmlFor="say" className="field-label">Сообщение от оператора всем игрокам</label>
              <div className="row">
                <input id="say" name="say" autoComplete="off" className="input" value={say} maxLength={240} onChange={(e) => setSay(e.target.value)} placeholder="Вода уже у ваших ног…" />
                <button className="btn">Отправить</button>
              </div>
            </form>
          </section>

          <section className="panel" aria-labelledby="flow-h">
            <h2 id="flow-h" className="h2">Ход игры</h2>
            {r.phase === 'lobby' && (
              <div className="field">
                <span className="field-label" id="adiff">Сложность</span>
                <DifficultyPicker value={r.difficulty} labelledBy="adiff" onChange={(d: Difficulty) => cmd({ c: 'difficulty', difficulty: d })} />
              </div>
            )}
            <div className="btn-row">
              {r.phase === 'lobby' && <button className="btn btn-sm btn-primary" onClick={() => cmd({ c: 'forceStart' })}>Запустить без ожидания</button>}
              {inGame && !over && <button className="btn btn-sm" onClick={() => cmd({ c: 'skipPhase' })}>Пропустить этап</button>}
              {inGame && !over && <button className="btn btn-sm" onClick={() => cmd({ c: 'end', result: 'won' })}>Засчитать победу</button>}
              {inGame && !over && <ConfirmButton onConfirm={() => cmd({ c: 'end', result: 'lost' })}>Затопить</ConfirmButton>}
              {inGame && <button className="btn btn-sm" onClick={() => cmd({ c: 'reset' })}>Вернуть в лобби</button>}
              {s && (
                <button className="btn btn-sm" onClick={() => cmd({ c: 'eggs', on: !s.eggs })} aria-pressed={s.eggs}>
                  Пасхалки: {s.eggs ? 'вкл' : 'выкл'}
                </button>
              )}
              <ConfirmButton onConfirm={() => cmd({ c: 'close' })}>Закрыть комнату</ConfirmButton>
            </div>
          </section>

        </div>
      </div>
    </main>
  )
}

// Destructive actions ask twice: first click arms, second click (within 3 s) confirms.
function ConfirmButton({ onConfirm, children, label }: { onConfirm: () => void; children: string; label?: string }) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 3000)
    return () => clearTimeout(t)
  }, [armed])
  return (
    <button
      className={`btn btn-sm btn-danger ${armed ? 'armed' : ''}`}
      aria-label={armed ? `Подтвердите: ${label ?? children}` : label}
      onClick={() => {
        if (armed) {
          setArmed(false)
          onConfirm()
        } else setArmed(true)
      }}
    >
      {armed ? 'Точно? Нажмите ещё раз' : children}
    </button>
  )
}

// Live top-down map: players, cells and the charge.
function MiniMap() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let raf = 0
    const draw = () => {
      raf = requestAnimationFrame(draw)
      const c = ref.current
      if (!c) return
      const g = c.getContext('2d')!
      const W = c.clientWidth
      const H = Math.round(W * 0.3)
      if (c.width !== W * 2) {
        c.width = W * 2
        c.height = H * 2
      }
      g.setTransform(2, 0, 0, 2, 0, 0)
      g.fillStyle = '#05070a'
      g.fillRect(0, 0, W, H)
      const minX = -52, maxX = 68, minZ = -18, maxZ = 12
      const sx = (x: number) => ((x - minX) / (maxX - minX)) * W
      const sz = (z: number) => ((z - minZ) / (maxZ - minZ)) * H
      const rect = (x0: number, z0: number, x1: number, z1: number, stroke: string, fill: string) => {
        g.fillStyle = fill
        g.strokeStyle = stroke
        g.fillRect(sx(x0), sz(z0), sx(x1) - sx(x0), sz(z1) - sz(z0))
        g.strokeRect(sx(x0), sz(z0), sx(x1) - sx(x0), sz(z1) - sz(z0))
      }
      const st = useNet.getState()
      rect(PIT.minX, PIT.minZ, PIT.maxX, PIT.maxZ, '#2b3546', '#0b1a1d')
      rect(HALL.minX, HALL.minZ, HALL.maxX, HALL.maxZ, '#2b3546', '#0c0f15')
      rect(MAINT.minX, MAINT.minZ, MAINT.maxX, MAINT.maxZ, '#2b3546', '#0c0f15')
      rect(PUMP.minX, PUMP.minZ, PUMP.maxX, PUMP.maxZ, st.game?.pumpDoorOpen ? '#22f0ff' : '#2b3546', '#0c0f15')
      rect(TRANSFER.minX, TRANSFER.minZ, TRANSFER.maxX, TRANSFER.maxZ, st.game?.transferOpen ? '#ff9a1f' : '#2b3546', '#0c0f15')
      rect(BRANCH.minX, BRANCH.minZ, BRANCH.maxX, BRANCH.maxZ, '#2b3546', '#0c0f15')
      rect(ELEVATOR.minX, ELEVATOR.minZ, ELEVATOR.maxX, ELEVATOR.maxZ, st.game?.elevatorOpen ? '#3dff8a' : '#2b3546', '#0c0f15')
      g.fillStyle = '#ff2e8855'
      g.fillRect(sx(60), sz(5), sx(66) - sx(60), sz(11) - sz(5))
      g.strokeStyle = '#e6ff3a'
      g.beginPath()
      g.arc(sx(CHARGE_SOCKET.pos[0]), sz(CHARGE_SOCKET.pos[2]), 5, 0, Math.PI * 2)
      g.stroke()
      // items
      for (const it of Object.values(st.items)) {
        if (!['cell', 'charge', 'pixel', 'tile', 'hose'].includes(it.kind)) continue
        const p = live.items.get(it.id)?.p ?? it.p
        g.fillStyle = it.kind === 'charge' ? '#e6ff3a' : it.kind === 'pixel' ? '#ff9a1f' : it.kind === 'tile' ? '#f2f2f2' : it.kind === 'hose' ? '#ff7a1a' : it.fake ? '#ff2e88' : '#22f0ff'
        g.fillRect(sx(p[0]) - 3, sz(p[2]) - 3, 6, 6)
      }
      // players
      g.font = '11px "JetBrains Mono", monospace'
      let n = 0
      for (const p of st.room?.players ?? []) {
        const tf = live.players.get(p.id)
        if (!tf) continue
        const x = sx(tf.p[0])
        const y = sz(tf.p[2])
        g.fillStyle = p.alive ? p.color : '#4c5767'
        g.beginPath()
        g.arc(x, y, 5, 0, Math.PI * 2)
        g.fill()
        g.strokeStyle = p.color
        g.beginPath()
        g.moveTo(x, y)
        g.lineTo(x - Math.sin(tf.yaw) * 12, y - Math.cos(tf.yaw) * 12)
        g.stroke()
        // name on a dark plate; neighbours alternate above/below so two players side by side stay readable
        const tw = g.measureText(p.name).width
        const lx = Math.min(x + 9, W - tw - 6)
        const ly = n++ % 2 ? y + 18 : y - 8
        g.fillStyle = '#06070acc'
        g.fillRect(lx - 3, ly - 10, tw + 6, 14)
        g.fillStyle = '#e6f1f4'
        g.fillText(p.name, lx, ly)
      }
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [])
  return <canvas ref={ref} className="admin-map" aria-label="Карта станции с позициями игроков" role="img" />
}
