import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DIFFICULTIES, MAX_PLAYERS, MIN_PLAYERS, type Difficulty } from '../../../shared/level'
import { send, useNet } from '../net'
import { TunnelBg } from '../ui/TunnelBg'
import { DifficultyPicker } from '../ui/DifficultyPicker'

const PHASE_LABEL: Record<string, string> = { lobby: 'Набор', won: 'Финал', lost: 'Финал' }

export function Home() {
  const { name, setName, rooms, connected, leftReason } = useNet()
  const [nick, setNick] = useState(name)
  const [roomName, setRoomName] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [joinPass, setJoinPass] = useState('')
  const nickOk = nick.trim().length >= 2

  const ensureName = () => {
    if (nick.trim() !== name) setName(nick.trim())
  }

  return (
    <>
      <TunnelBg />
      <a className="skip-link" href="#main">К созданию комнаты</a>
      <div className="page">
        <div className="wrap">
          <header className="topbar">
            <Link to="/" className="logo" translate="no">НЕОН<b>-17</b></Link>
            <span className={`tag ${connected ? 'tag-ok' : 'tag-pink'}`}>{connected ? 'Сервер на связи' : 'Нет связи с сервером'}</span>
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

          {leftReason && <p className="pink" role="status">{leftReason}</p>}

          <main id="main" className="grid-2">
            <section className="panel" aria-labelledby="create-h">
              <h2 id="create-h" className="h2">Создать комнату</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!nickOk) return
                  ensureName()
                  send({ t: 'create', name: roomName.trim() || `Смена ${nick.trim()}`, difficulty, password: password || undefined })
                }}
              >
                <div className="field">
                  <label htmlFor="nick">Ваш позывной</label>
                  <input id="nick" className="input" value={nick} maxLength={18} autoComplete="nickname" spellCheck={false} required minLength={2}
                    onChange={(e) => setNick(e.target.value)} onBlur={ensureName} placeholder="Например, Кира…" />
                </div>
                <div className="field">
                  <label htmlFor="room">Название комнаты</label>
                  <input id="room" className="input" value={roomName} maxLength={32} onChange={(e) => setRoomName(e.target.value)} placeholder={`Смена ${nick || '…'}`} />
                </div>
                <div className="field">
                  <span className="field-label" id="diff-l">Сложность</span>
                  <DifficultyPicker value={difficulty} onChange={setDifficulty} labelledBy="diff-l" />
                </div>
                <div className="field">
                  <label htmlFor="pass">Пароль комнаты (необязательно)</label>
                  <input id="pass" className="input" value={password} maxLength={24} onChange={(e) => setPassword(e.target.value)} autoComplete="off" />
                </div>
                <button className="btn btn-primary btn-block" disabled={!nickOk || !connected}>Создать комнату</button>
                <button
                  type="button"
                  className="btn btn-block home-solo"
                  disabled={!nickOk || !connected}
                  onClick={() => {
                    ensureName()
                    send({ t: 'create', name: 'solo', difficulty, solo: true })
                  }}
                >
                  Тренировка в одиночку
                </button>
                <p className="faint field-help">Тренировка: сразу в игру, с подсказками и метками целей. Детонатор работает с одного пульта.</p>
                {!nickOk && <p className="faint field-help">Позывной — минимум 2 символа.</p>}
              </form>
            </section>

            <section className="panel" aria-labelledby="rooms-h">
              <h2 id="rooms-h" className="h2">Открытые комнаты</h2>
              {rooms.length === 0 && <p className="muted">Пока пусто. Создайте свою и позовите друзей кодом комнаты.</p>}
              <ul className="list">
                {rooms.map((r) => (
                  <li key={r.id}>
                    <div>
                      <div>{r.name} {r.locked && <span className="tag">Пароль</span>}</div>
                      <div className="faint" style={{ fontSize: 13 }}>
                        {r.id} · {DIFFICULTIES[r.difficulty].label} · {r.players}/{MAX_PLAYERS} · {PHASE_LABEL[r.phase] ?? 'Идёт игра'}
                      </div>
                    </div>
                    <button className="btn btn-sm" disabled={!nickOk || r.phase !== 'lobby' || r.players >= MAX_PLAYERS}
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
                ))}
              </ul>
              <form className="join-code" onSubmit={(e) => {
                e.preventDefault()
                if (!nickOk || code.length < 4) return
                ensureName()
                send({ t: 'join', roomId: code, password: joinPass || undefined })
              }}>
                <div className="field">
                  <label htmlFor="code">Код комнаты</label>
                  <input id="code" className="input code-input" value={code} maxLength={4} autoComplete="off"
                    onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="K7Q2…" spellCheck={false} autoCapitalize="characters" />
                </div>
                <div className="field">
                  <label htmlFor="jpass">Пароль</label>
                  <input id="jpass" className="input" value={joinPass} onChange={(e) => setJoinPass(e.target.value)} autoComplete="off" />
                </div>
                <button className="btn" disabled={!nickOk || code.length < 4}>Войти по коду</button>
              </form>
            </section>
          </main>

          <footer className="home-foot faint">
            <span>Лучше всего в Chrome на компьютере · мышь и клавиатура</span>
            <Link to="/admin">Админ-панель</Link>
          </footer>
        </div>
      </div>
    </>
  )
}
