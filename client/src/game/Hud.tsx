import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { DIFFICULTIES, PIT_Y } from '../../../shared/level'
import type { GameState } from '../../../shared/protocol'
import { live, send, useNet } from '../net'
import { sfx } from './audio'
import { useUi } from './ui'
import './hud.css'

export function Hud({ spectator }: { spectator: boolean }) {
  const game = useNet((s) => s.game)
  const me = useNet((s) => s.room?.players.find((p) => p.id === s.myId))
  const ui = useUi()
  if (!game) return <div className="loading" role="status">Подключение к станции…</div>
  const over = game.phase === 'won' || game.phase === 'lost'
  return (
    <div className="hud">
      <Overlays />
      {/* everything top-centre stacks in one column, so the timer, pause, countdown and notes never overlap */}
      <div className="hud-top">
        <TopTimer game={game} />
        {game.paused && <div className="hud-paused" role="status">Пауза · оператор остановил время</div>}
        {game.phase === 'evac' && <Evac game={game} />}
        {game.phase === 'arm' && <ArmBar game={game} />}
        {me && !me.alive && !over && (
          <div className="hud-note" role="status">
            Вы остались в тоннеле. Режим наблюдателя: <kbd>WASD</kbd> лететь · <kbd>Space</kbd> вверх · <kbd>C</kbd> вниз
          </div>
        )}
      </div>
      <Objectives game={game} />
      <Feed />
      {!spectator && <ChatBox />}
      {!spectator && !over && me?.alive !== false && <Crosshair />}
      {!spectator && <Battery />}
      {!spectator && !over && ui.locked && !ui.chat && (
        <div className="hud-legend" aria-hidden>
          <span><kbd>Enter</kbd> чат</span>
          <span><kbd>Tab</kbd> команда</span>
        </div>
      )}
      {ui.scores && <Scoreboard />}
      {ui.keypad && <KeypadModal target={ui.keypad} />}
      {ui.kiosk && <KioskModal game={game} />}
      {over && <EndScreen game={game} spectator={spectator} />}
      {!over && !ui.locked && !ui.keypad && !ui.kiosk && !ui.chat && <ClickToPlay spectator={spectator} />}
      {spectator && (
        <div className="hud-spectator">
          <span className="tag tag-acid">Наблюдатель</span>
          <Link className="btn btn-sm" to="/admin">← В админку</Link>
        </div>
      )}
    </div>
  )
}

function useTick(ms = 200) {
  const [, set] = useState(0)
  useEffect(() => {
    const t = setInterval(() => set((n) => n + 1), ms)
    return () => clearInterval(t)
  }, [ms])
}

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`

function TopTimer({ game }: { game: GameState }) {
  useTick(250)
  const t = live.time
  const water = Math.max(0, Math.min(1, (live.water - (PIT_Y - 0.4)) / (0.45 - (PIT_Y - 0.4))))
  const danger = t < 60
  return (
    <div className="hud-timer" role="timer" aria-label="До затопления">
      <div className="hud-timer-label">До затопления · {DIFFICULTIES[game.difficulty].label}</div>
      <div className={`hud-timer-value ${danger ? 'danger' : ''}`}>{game.blastDoorClosed ? '——:——' : fmt(t)}</div>
      <div className="hud-water-line"><span>Вода</span><span>{Math.round(water * 100)}%</span></div>
      <div className="hud-water" role="img" aria-label={`Уровень воды ${Math.round(water * 100)}%`}>
        <div style={{ width: `${water * 100}%` }} />
      </div>
    </div>
  )
}

function Objectives({ game }: { game: GameState }) {
  const cells = useNet((s) => Object.values(s.items).filter((i) => i.kind === 'cell' && i.socket && !i.fake).length)
  const order = ['power', 'access', 'charge', 'arm', 'evac', 'escape', 'won']
  const idx = order.indexOf(game.phase)
  const ok = (b: boolean) => (b ? ' ✓' : '')
  const steps = [
    { id: 'power', text: `Восстановить питание: энергоячейки в щит (${cells}/${game.sockets.length})` },
    { id: 'access', text: 'Открыть служебный шлюз: найти 4-значный код' },
    { id: 'charge', text: `Заряд к завалу${ok(game.chargePlaced)} · рычаги по схеме${ok(game.leversOk)} · код взвода с мозаики${ok(game.armCodeOk)} · газ со 2-го этажа${ok(game.gasOk)}` },
    { id: 'arm', text: game.solo ? 'Детонатор: держите [E] на пульте A или B' : 'Детонатор: два игрока держат пульты A и B одновременно' },
    { id: 'evac', text: 'Все за гермодверь! Покиньте восточный тоннель' },
    { id: 'escape', text: 'Все в лифт наверх' },
  ]
  return (
    <div className="hud-obj panel">
      <div className="eyebrow">Задачи{idx >= 0 && idx < steps.length ? ` · этап ${idx + 1}/${steps.length}` : ''}</div>
      <ol>
        {steps.map((s, i) => {
          const state = idx > i ? 'done' : idx === i ? 'now' : 'next'
          if (state === 'next' && i > Math.max(idx, 0) + 1) return null
          return (
            <li key={s.id} className={state}>
              <span aria-hidden>{state === 'done' ? '■' : state === 'now' ? '▶' : '□'}</span>
              <span>{s.text}</span>
            </li>
          )
        })}
      </ol>
      {game.power && (
        <div className="hud-side">
          <div className={game.transferOpen ? 'done' : ''}>Переход на ветку Б{ok(game.transferOpen)}</div>
          <div className={game.mosaicDone ? 'done' : ''}>Мозаика{ok(game.mosaicDone)}</div>
          <div className={game.pumpOn ? 'done' : ''}>Насос: шланги {game.hoses}/3{game.pumpDoorOpen ? '' : ' · дверь заперта'}</div>
          {game.doorOpen && (
            <>
              <div className={game.storageOpen ? 'done' : ''}>2-й этаж: камера хранения{game.storageOpen ? ok(true) : ' заперта'}</div>
              <div className={game.gasOk ? 'done' : ''}>Газ: баллоны {game.gasLoaded}/3{game.gasOk ? ok(true) : ' · давление не выставлено'}</div>
            </>
          )}
        </div>
      )}
      {game.eggsFound.length > 0 && <div className="hud-eggs">Тайны: {game.eggsFound.length}/6</div>}
    </div>
  )
}

function Feed() {
  const feed = useNet((s) => s.feed)
  useTick(1000)
  const now = performance.now()
  const ai = feed.filter((f) => f.from !== 'chat' && now - f.at < 12000).slice(-3)
  const chat = feed.filter((f) => f.from === 'chat' && now - f.at < 20000).slice(-6)
  return (
    <>
      <div className="hud-feed" role="log" aria-live="polite">
        {ai.map((f) => (
          <div key={f.id} className={`hud-say ${f.from === 'admin' ? 'admin' : ''}`}>
            {f.text}
          </div>
        ))}
      </div>
      <div className="hud-chat-log" role="log" aria-live="polite">
        {chat.map((f) => (
          <div key={f.id}>
            <b style={{ color: f.color }}>{f.name}:</b> {f.text}
          </div>
        ))}
      </div>
    </>
  )
}

function ChatBox() {
  const open = useUi((s) => s.chat)
  const [text, setText] = useState('')
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (open) setTimeout(() => input.current?.focus(), 0)
  }, [open])
  if (!open) return null
  const close = () => {
    setText('')
    useUi.setState({ chat: false })
  }
  return (
    <form
      className="hud-chat-input"
      onSubmit={(e) => {
        e.preventDefault()
        if (text.trim()) send({ t: 'chat', text })
        close()
      }}
    >
      <label htmlFor="chat">Сообщение команде</label>
      <input id="chat" name="message" ref={input} className="input" value={text} maxLength={200} autoComplete="off"
        onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && close()} />
      <div className="hud-chat-keys" aria-hidden><span><kbd>Enter</kbd> отправить</span><span><kbd>Esc</kbd> закрыть</span></div>
    </form>
  )
}

function Crosshair() {
  const focus = useUi((s) => s.focus)
  const holding = useUi((s) => s.holding)
  return (
    <>
      <div className={`hud-cross ${focus ? 'on' : ''}`} />
      {focus && !holding && (
        <div className="hud-hint">
          {focus.kind !== 'read' && <kbd>E</kbd>} {focus.label}
        </div>
      )}
      {holding && (
        <div className="hud-hint">
          <kbd>ЛКМ</kbd>/<kbd>E</kbd> положить · <kbd>ПКМ</kbd> бросить · <kbd>R</kbd> вращать
        </div>
      )}
    </>
  )
}

function Battery() {
  useTick(500)
  const drain = useNet((s) => DIFFICULTIES[s.game?.difficulty ?? 'normal'].flashlightDrain)
  const flash = useUi((s) => s.flash)
  if (!drain) return null
  const b = Math.round(live.battery)
  return (
    <div className={`hud-battery ${b < 20 ? 'low' : ''} ${flash ? 'on' : ''}`}>
      <span><kbd>F</kbd> Фонарь {flash ? 'вкл' : 'выкл'}</span>
      <span className="hud-battery-bar" aria-hidden><i style={{ width: `${Math.max(0, Math.min(100, b))}%` }} /></span>
      <b>{b}%</b>
    </div>
  )
}

function Evac({ game }: { game: GameState }) {
  useTick(100)
  return (
    <div className="hud-evac" role="timer" aria-label="До детонации">
      <div>Детонация через</div>
      <strong>{game.evacLeft.toFixed(0)}</strong>
      <div>Покиньте восточный тоннель</div>
    </div>
  )
}

function ArmBar({ game }: { game: GameState }) {
  return (
    <div className="hud-arm" role="img" aria-label={`Детонатор: пульт A ${game.detonator.a ? 'держат' : 'свободен'}, пульт B ${game.detonator.b ? 'держат' : 'свободен'}, ${Math.round(game.detonator.progress * 100)}%`}>
      <span className={game.detonator.a ? 'ok' : ''}>A</span>
      <div className="hud-arm-bar"><div style={{ width: `${game.detonator.progress * 100}%` }} /></div>
      <span className={game.detonator.b ? 'ok' : ''}>B</span>
    </div>
  )
}

function Overlays() {
  useTick(80)
  const underwater = useUi((s) => s.underwater)
  const now = performance.now()
  return (
    <>
      {underwater && <div className="fx-underwater" />}
      {now < live.shockUntil && <div className="fx-shock" />}
      {now < live.blackoutUntil && <div className="fx-blackout" />}
      {now < live.flashUntil && <div className="fx-flash" />}
    </>
  )
}

function Scoreboard() {
  const room = useNet((s) => s.room)
  if (!room) return null
  return (
    <div className="hud-scores panel">
      <div className="eyebrow">Команда · {room.players.length} · код {room.id}</div>
      <div className="h2">{room.name}</div>
      <ul className="list">
        {room.players.map((p) => (
          <li key={p.id}>
            <span className="hud-player" style={{ ['--c' as string]: p.color }}>
              <i aria-hidden />
              <span className="truncate">{p.name}</span>
              {p.host && <span className="tag tag-acid">Хост</span>}
            </span>
            <span className={`tag ${p.escaped ? 'tag-ok' : p.alive ? '' : 'tag-pink'}`}>{p.escaped ? 'Спасён' : p.alive ? 'В игре' : 'Погиб'}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function KeypadModal({ target }: { target: 'door' | 'arm' }) {
  const [code, setCode] = useState('')
  const close = () => useUi.setState({ keypad: null })
  const press = (d: string) => {
    sfx.beep(true)
    setCode((c) => (c + d).slice(0, 4))
  }
  const submit = () => {
    if (code.length !== 4) return
    send({ t: 'keypad', code, target })
    setCode('')
    close()
  }
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key)
      if (e.key === 'Backspace') setCode((c) => c.slice(0, -1))
      if (e.key === 'Enter') submit()
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  })
  return (
    <div className="hud-modal" role="dialog" aria-modal="true" aria-label={target === 'arm' ? 'Пульт подрыва' : 'Кодовый замок служебного шлюза'}>
      <div className="keypad panel">
        <div className="eyebrow">{target === 'arm' ? 'Пульт подрыва · код взвода' : 'Служебный шлюз'}</div>
        <div className="keypad-screen" aria-live="polite" aria-label={`Введено: ${code || 'пусто'}`}>
          {code.padEnd(4, '·').split('').map((c, i) => <span key={i} className={i < code.length ? 'on' : ''}>{c}</span>)}
        </div>
        <div className="keypad-grid">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button key={d} className="btn" onClick={() => press(d)}>{d}</button>
          ))}
          <button className="btn btn-danger" onClick={() => setCode('')} aria-label="Стереть">C</button>
          <button className="btn" onClick={() => press('0')}>0</button>
          <button className="btn btn-primary" onClick={submit} disabled={code.length !== 4} aria-label="Ввести код">OK</button>
        </div>
        <button className="btn btn-sm btn-block" onClick={close}>Отойти <kbd>Esc</kbd></button>
        <p className="keypad-help">Цифры с клавиатуры · <kbd>Enter</kbd> ввод · <kbd>⌫</kbd> стереть</p>
      </div>
    </div>
  )
}

function KioskModal({ game }: { game: GameState }) {
  const [text, setText] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const close = () => useUi.setState({ kiosk: false })
  useEffect(() => {
    setTimeout(() => input.current?.focus(), 0)
    const k = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])
  const solved = (id: string) => game.eggsFound.includes(id)
  return (
    <div className="hud-modal" role="dialog" aria-modal="true" aria-label="Инфокиоск">
      <form className="panel kiosk" onSubmit={(e) => {
        e.preventDefault()
        if (!text.trim()) return
        send({ t: 'kiosk', text })
        sfx.beep(true)
        setText('')
        close()
      }}>
        <div className="eyebrow">Инфокиоск · линия 17</div>
        <p className="kiosk-lead">Станция хранит три тайны. Разгаданное слово или число откроет время и секреты.</p>
        <ul className="kiosk-list">
          <li className={solved('caesar') ? 'ok' : ''}>Надпись на «Литейной», что сдвинута на номер линии</li>
          <li className={solved('poem') ? 'ok' : ''}>Стихи машиниста в вагоне 1977 года</li>
          <li className={solved('morse') ? 'ok' : ''}>Лампа в техкомнате, что не умеет молчать</li>
        </ul>
        <label htmlFor="kiosk-in" className="field-label">Ответ</label>
        <input id="kiosk-in" name="answer" ref={input} className="input" value={text} maxLength={24} autoComplete="off" spellCheck={false}
          onChange={(e) => setText(e.target.value)} placeholder="Слово или число…" />
        <div className="row kiosk-actions">
          <button className="btn btn-primary" disabled={!text.trim()}>Проверить</button>
          <button type="button" className="btn" onClick={close}>Отойти <kbd>Esc</kbd></button>
        </div>
      </form>
    </div>
  )
}

function ClickToPlay({ spectator }: { spectator: boolean }) {
  return (
    <div className="hud-click">
      <div className="panel">
        <div className="eyebrow">{spectator ? 'Режим наблюдателя' : 'Управление захватит курсор · Esc вернёт'}</div>
        <div className="display hud-click-title" translate="no">НЕОН-17</div>
        <p className="hud-click-cta">Кликните по экрану, чтобы {spectator ? 'наблюдать' : 'играть'}</p>
        <div className="hud-keys">
          <span><kbd>WASD</kbd> идти</span>
          <span><kbd>Shift</kbd> бег</span>
          <span><kbd>Space</kbd> прыжок{spectator ? ' / вверх' : ''}</span>
          <span><kbd>C</kbd> присесть{spectator ? ' / вниз' : ''}</span>
          {!spectator && <>
            <span><kbd>E</kbd>/<kbd>ЛКМ</kbd> взять, использовать</span>
            <span><kbd>ПКМ</kbd> бросить</span>
            <span><kbd>F</kbd> фонарь</span>
            <span><kbd>Enter</kbd> чат</span>
            <span><kbd>Tab</kbd> команда</span>
          </>}
        </div>
      </div>
    </div>
  )
}

function EndScreen({ game, spectator }: { game: GameState; spectator: boolean }) {
  const me = useNet((s) => s.room?.players.find((p) => p.id === s.myId))
  const won = game.phase === 'won'
  useEffect(() => {
    document.exitPointerLock()
  }, [])
  return (
    <div className="hud-modal" role="dialog" aria-modal="true" aria-label={won ? 'Вы выбрались' : 'Станция затоплена'}>
      <div className={`panel end ${won ? 'won' : 'lost'}`}>
        <div className="hazard" />
        <div className="eyebrow">{won ? 'Эвакуация завершена' : 'Связь со станцией потеряна'}</div>
        <div className={`display end-title ${won ? 'cyan' : 'pink'} glitch-text`}>{won ? 'Вы выбрались' : 'Станция затоплена'}</div>
        <p className="end-lead">{won ? 'Тоннель запечатан, лифт ушёл наверх. ДИСПЕТЧЕР остался внизу один.' : game.outcome?.replace('ДИСПЕТЧЕР: ', '')}</p>
        <ul className="list">
          <li><span>Сложность</span><b>{DIFFICULTIES[game.difficulty].label}</b></li>
          <li><span>Осталось времени</span><b>{fmt(game.timeLeft)}</b></li>
          <li><span>Тайн раскрыто</span><b>{game.eggsFound.length} из 6</b></li>
        </ul>
        {!spectator && (
          me?.host
            ? <button className="btn btn-primary btn-block" onClick={() => send({ t: 'start' })}>{game.solo ? 'Пройти ещё раз' : 'Вернуть команду в лобби'}</button>
            : <p className="end-wait" role="status">Хост вернёт всех в лобби.</p>
        )}
        {!spectator && <button className="btn btn-block" onClick={() => send({ t: 'leave' })}>{game.solo ? 'В главное меню' : 'Выйти из комнаты'}</button>}
      </div>
    </div>
  )
}
