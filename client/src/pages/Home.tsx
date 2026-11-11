import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DIFFICULTIES, MAX_PLAYERS, MIN_PLAYERS, type Difficulty } from '../../../shared/level'
import { send, useNet } from '../net'
import { TunnelBg } from '../ui/TunnelBg'
import { DifficultyPicker } from '../ui/DifficultyPicker'

const PHASE_LABEL: Record<string, string> = { lobby: 'Набор', won: 'Финал', lost: 'Финал' }

export function Home() {
  const { name, setName, rooms, connected, leftReason, error } = useNet()
  const [nick, setNick] = useState(name)
  const [roomName, setRoomName] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [joinPass, setJoinPass] = useState('')
  // purely visual: which request is on its way (the server answers by moving us to the room, or with an error)
  const [busy, setBusy] = useState<null | 'create' | 'solo' | 'join'>(null)
  const [nickTouched, setNickTouched] = useState(false)
  const nickOk = nick.trim().length >= 2

  useEffect(() => {
    if (!busy) return
    const t = setTimeout(() => setBusy(null), 4000)
    return () => clearTimeout(t)
  }, [busy])
  useEffect(() => {
    if (error || !connected) setBusy(null)
  }, [error, connected])

  const ensureName = () => {
    if (nick.trim() !== name) setName(nick.trim())
  }
  const blocked = !connected
    ? 'Нет связи с сервером. Переподключаемся…'
    : !nickOk
      ? 'Сначала введите позывной: без него в комнату не пустят.'
      : ''

  return (
    <>
      <TunnelBg />
      <a className="skip-link" href="#main">К созданию комнаты</a>
      <div className="page">
        <div className="wrap">
          <header className="topbar">
            <Link to="/" className="logo" translate="no">НЕОН<b>-17</b></Link>
            <span className={`tag tag-dot ${connected ? 'tag-ok' : 'tag-pink'}`} role="status">{connected ? 'Сервер на связи' : 'Нет связи с сервером'}</span>
          </header>

          <section className="home-hero">
            <div className="eyebrow">Кооперативный эскейп-рум · {MIN_PLAYERS}–{MAX_PLAYERS} игроков · от первого лица</div>
            <h1 className="display h1 glitch-text" translate="no">НЕОН-17</h1>
            <p className="home-lead">
              Землетрясение обрушило восточный тоннель, и в метро идёт вода. Верните станции питание,
              взломайте служебный шлюз, взорвите завал и успейте в лифт до того, как платформа уйдёт под воду.
              За вами следит сбойный ИИ-диспетчер. И в тоннеле вы не одни.
            </p>
          </section>

          {leftReason && <p className="notice" role="status">{leftReason}</p>}

          <main id="main">
            <section className="panel callsign" aria-label="Позывной">
              <div className="field">
                <label htmlFor="nick">Ваш позывной</label>
                <input id="nick" form="create-form" name="nickname" className="input" value={nick} maxLength={18} autoComplete="nickname" spellCheck={false} required minLength={2}
                  aria-describedby="nick-hint" aria-invalid={nickTouched && !nickOk ? true : undefined}
                  onChange={(e) => setNick(e.target.value)}
                  onBlur={() => {
                    setNickTouched(true)
                    ensureName()
                  }}
                  placeholder="Например, Кира…" />
              </div>
              <p id="nick-hint" className={`field-help ${nickTouched && !nickOk ? 'warn' : ''}`}>
                {nickOk ? 'Под этим именем вас увидит команда в рации.' : 'Позывной — минимум 2 символа.'}
              </p>
            </section>

            <div className="grid-2">
              <section className="panel" aria-labelledby="create-h">
                <h2 id="create-h" className="h2">Создать комнату</h2>
                <form
                  id="create-form"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (!nickOk) return
                    ensureName()
                    setBusy('create')
                    send({ t: 'create', name: roomName.trim() || `Смена ${nick.trim()}`, difficulty, password: password || undefined })
                  }}
                >
                  <div className="field">
                    <label htmlFor="room">Название комнаты</label>
                    <input id="room" name="room" className="input" value={roomName} maxLength={32} autoComplete="off" onChange={(e) => setRoomName(e.target.value)} placeholder={`Смена ${nick || '…'}`} />
                  </div>
                  <div className="field">
                    <span className="field-label" id="diff-l">Сложность</span>
                    <DifficultyPicker value={difficulty} onChange={setDifficulty} labelledBy="diff-l" />
                  </div>
                  <div className="field">
                    <label htmlFor="pass">Пароль комнаты (необязательно)</label>
                    <input id="pass" name="room-password" className="input" value={password} maxLength={24} onChange={(e) => setPassword(e.target.value)} autoComplete="off" spellCheck={false} />
                  </div>
                  <div className="home-actions">
                    <button className="btn btn-primary" disabled={!nickOk || !connected} aria-busy={busy === 'create' || undefined}>Создать комнату</button>
                    <button
                      type="button"
                      className="btn"
                      disabled={!nickOk || !connected}
                      aria-busy={busy === 'solo' || undefined}
                      onClick={() => {
                        ensureName()
                        setBusy('solo')
                        send({ t: 'create', name: 'solo', difficulty, solo: true })
                      }}
                    >
                      Тренировка в одиночку
                    </button>
                  </div>
                  {blocked
                    ? <p className="field-help warn" role="status">{blocked}</p>
                    : <p className="field-help">Тренировка: сразу в игру, с подсказками и метками целей. Детонатор работает с одного пульта.</p>}
                </form>
              </section>

              <section className="panel" aria-labelledby="rooms-h">
                <div className="panel-head">
                  <h2 id="rooms-h" className="h2">Открытые комнаты</h2>
                  {rooms.length > 0 && <span className="tag">{rooms.length}</span>}
                </div>
                {rooms.length === 0 && <p className="empty">Пока пусто. Создайте свою и позовите друзей кодом комнаты.</p>}
                <ul className="list rooms">
                  {rooms.map((r) => {
                    const full = r.players >= MAX_PLAYERS
                    return (
                      <li key={r.id}>
                        <div className="room-item">
                          <div className="room-title">
                            <span className="truncate">{r.name}</span>
                            {r.locked && <span className="tag">Пароль</span>}
                          </div>
                          <div className="room-meta">
                            <b translate="no">{r.id}</b>
                            <span>{DIFFICULTIES[r.difficulty].label}</span>
                            <span className={full ? 'full' : ''}>{r.players}/{MAX_PLAYERS}{full ? ' · мест нет' : ''}</span>
                            <span>{PHASE_LABEL[r.phase] ?? 'Идёт игра'}</span>
                          </div>
                        </div>
                        <button className="btn btn-sm" disabled={!nickOk || r.phase !== 'lobby' || r.players >= MAX_PLAYERS}
                          aria-label={`Войти в комнату ${r.name}`}
                          onClick={() => {
                            ensureName()
                            if (r.locked) {
                              setCode(r.id)
                              document.getElementById('jpass')?.focus()
                              return
                            }
                            send({ t: 'join', roomId: r.id })
                          }}>
                          Войти
                        </button>
                      </li>
                    )
                  })}
                </ul>
                <form className="join-code" onSubmit={(e) => {
                  e.preventDefault()
                  if (!nickOk || code.length < 4) return
                  ensureName()
                  setBusy('join')
                  send({ t: 'join', roomId: code, password: joinPass || undefined })
                }}>
                  <div className="field">
                    <label htmlFor="code">Код комнаты</label>
                    <input id="code" name="room-code" className="input code-input" value={code} maxLength={4} autoComplete="off"
                      onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="K7Q2…" spellCheck={false} autoCapitalize="characters" aria-describedby="code-hint" />
                  </div>
                  <div className="field">
                    <label htmlFor="jpass">Пароль</label>
                    <input id="jpass" name="join-password" className="input" value={joinPass} onChange={(e) => setJoinPass(e.target.value)} autoComplete="off" spellCheck={false} />
                  </div>
                  <button className="btn" disabled={!nickOk || code.length < 4} aria-busy={busy === 'join' || undefined}>Войти по коду</button>
                  <p id="code-hint" className="field-help">Четыре символа: их видит хост в лобби. Пароль нужен только закрытым комнатам.</p>
                </form>
              </section>
            </div>
          </main>

          <footer className="home-foot">
            <span>Лучше всего в Chrome на компьютере · мышь и клавиатура</span>
            <Link to="/admin">Админ-панель</Link>
          </footer>
        </div>
      </div>
    </>
  )
}
