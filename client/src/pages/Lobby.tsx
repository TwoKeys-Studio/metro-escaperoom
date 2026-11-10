import { useEffect, useRef, useState } from 'react'
import { DIFFICULTIES, MAX_PLAYERS, MIN_PLAYERS } from '../../../shared/level'
import { send, useNet } from '../net'
import { DifficultyPicker } from '../ui/DifficultyPicker'
import { TunnelBg } from '../ui/TunnelBg'

export function Lobby() {
  const room = useNet((s) => s.room)
  const myId = useNet((s) => s.myId)
  const feed = useNet((s) => s.feed)
  const [text, setText] = useState('')
  const [copied, setCopied] = useState(false)
  const log = useRef<HTMLDivElement>(null)

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight })
  }, [feed.length])

  if (!room) return null
  const me = room.players.find((p) => p.id === myId)
  const host = !!me?.host
  const count = room.players.length
  const notReady = room.players.filter((p) => !p.ready && !p.host).length
  const reason = count < MIN_PLAYERS ? `Нужно ещё ${MIN_PLAYERS - count} — минимум ${MIN_PLAYERS} игрока` : notReady ? `Ждём готовности: ${notReady}` : ''
  const slots = Array.from({ length: MAX_PLAYERS }, (_, i) => room.players[i] ?? null)
  const chat = feed.filter((f) => f.from === 'chat' || f.from === 'admin')

  return (
    <>
      <TunnelBg />
      <div className="page">
        <div className="wrap">
          <header className="topbar">
            <span className="logo">НЕОН<b>-17</b></span>
            <button className="btn btn-sm btn-danger" onClick={() => send({ t: 'leave' })}>Покинуть комнату</button>
          </header>

          <section className="lobby-head">
            <div>
              <div className="eyebrow">Лобби · ожидание пассажиров</div>
              <h1 className="display lobby-title">{room.name}</h1>
            </div>
            <button
              className="lobby-code"
              aria-label={`Код комнаты ${room.id}, скопировать`}
              onClick={() => {
                navigator.clipboard?.writeText(room.id).then(() => {
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1500)
                }).catch(() => {})
              }}
            >
              <span className="faint">Код комнаты</span>
              <strong>{room.id}</strong>
              <span className="faint">{copied ? 'Скопировано' : 'Нажмите, чтобы скопировать'}</span>
            </button>
          </section>

          <div className="grid-2">
            <div>
              <section className="panel" aria-labelledby="crew-h">
                <h2 id="crew-h" className="h2">Команда · {count}/{MAX_PLAYERS}</h2>
                <ul className="slots">
                  {slots.map((p, i) => (
                    <li key={p?.id ?? `empty${i}`} className={`slot ${p ? 'filled' : ''} ${p?.id === myId ? 'me' : ''}`} style={p ? { ['--c' as string]: p.color } : undefined}>
                      {p ? (
                        <>
                          <span className="slot-visor" aria-hidden />
                          <span className="slot-name">{p.name}{p.id === myId ? ' (вы)' : ''}</span>
                          <span className={`tag ${p.host ? 'tag-acid' : p.ready ? 'tag-ok' : ''}`}>{p.host ? 'Хост' : p.ready ? 'Готов' : 'Ждём'}</span>
                        </>
                      ) : (
                        <span className="faint">Свободно</span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="panel" aria-labelledby="brief-h">
                <h2 id="brief-h" className="h2">Брифинг</h2>
                <ol className="brief">
                  <li><b className="acid">Питание.</b> Найдите энергоячейки и вставьте в щит. Некоторые ячейки перегружены: присмотритесь, прежде чем вставлять.</li>
                  <li><b className="acid">Шлюз.</b> Код из четырёх цифр спрятан в неоновых вывесках. Порядок цветов на схеме линии у щита.</li>
                  <li><b className="acid">Заряд.</b> Отнесите тяжёлый заряд к завалу в восточном тоннеле и выставьте рычаги по схеме из техкомнаты.</li>
                  <li><b className="acid">Детонатор.</b> Два игрока одновременно держат пульты A и B. Потом у всех секунды, чтобы уйти за гермодверь.</li>
                  <li><b className="acid">Лифт.</b> Все живые в лифте, и вы спасены.</li>
                </ol>
                <p className="faint">Управление: WASD, мышь, E взять/использовать, ПКМ бросить, F фонарь, Enter чат, Tab команда.</p>
              </section>
            </div>

            <div>
              <section className="panel" aria-labelledby="diff-h">
                <h2 id="diff-h" className="h2">Сложность · {DIFFICULTIES[room.difficulty].label}</h2>
                <DifficultyPicker value={room.difficulty} disabled={!host} labelledBy="diff-h" onChange={(d) => send({ t: 'difficulty', difficulty: d })} />
                {!host && <p className="faint field-help">Сложность выбирает хост.</p>}
              </section>

              <section className="panel">
                {host ? (
                  <>
                    <button className="btn btn-primary btn-block" disabled={!!reason} onClick={() => send({ t: 'start' })}>
                      Спуститься в метро
                    </button>
                    <p className="faint field-help" role="status">{reason || 'Все на месте. Можно начинать.'}</p>
                  </>
                ) : (
                  <button className={`btn btn-block ${me?.ready ? '' : 'btn-primary'}`} onClick={() => send({ t: 'ready', ready: !me?.ready })}>
                    {me?.ready ? 'Я не готов' : 'Я готов'}
                  </button>
                )}
              </section>

              <section className="panel" aria-labelledby="chat-h">
                <h2 id="chat-h" className="h2">Рация</h2>
                <div className="lobby-chat" ref={log} aria-live="polite">
                  {chat.length === 0 && <p className="faint">Тишина в эфире.</p>}
                  {chat.map((f) => (
                    <div key={f.id}>
                      {f.from === 'admin' ? <b className="acid">ОПЕРАТОР:</b> : <b style={{ color: f.color }}>{f.name}:</b>} {f.text}
                    </div>
                  ))}
                </div>
                <form className="lobby-chat-form" onSubmit={(e) => {
                  e.preventDefault()
                  if (text.trim()) send({ t: 'chat', text })
                  setText('')
                }}>
                  <label htmlFor="lchat" className="sr-only">Сообщение</label>
                  <input id="lchat" className="input" value={text} maxLength={200} onChange={(e) => setText(e.target.value)} placeholder="Сообщение команде…" autoComplete="off" />
                  <button className="btn">Отправить</button>
                </form>
              </section>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
