import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Game } from './game/Game'
import { send, useNet } from './net'
import { Admin } from './pages/Admin'
import { Home } from './pages/Home'
import { Lobby } from './pages/Lobby'

// Keeps the URL in sync with where the server says we are.
function useFlow() {
  const room = useNet((s) => s.room)
  const loc = useLocation()
  const nav = useNavigate()
  useEffect(() => {
    if (loc.pathname.startsWith('/admin')) return
    if (!room) {
      if (loc.pathname !== '/') nav('/', { replace: true })
      return
    }
    const want = room.phase === 'lobby' ? '/room' : '/play'
    if (loc.pathname !== want) nav(want, { replace: true })
  }, [room, loc.pathname, nav])
}

function Watch() {
  const { id } = useParams()
  const admin = useNet((s) => s.admin)
  const game = useNet((s) => s.game)
  useEffect(() => {
    if (admin && id) send({ t: 'adminWatch', roomId: id })
  }, [admin, id])
  if (!admin) return <Navigate to="/admin" replace />
  if (!game) return <div className="page muted">Ожидание данных комнаты…</div>
  return <Game spectator />
}

function Error() {
  const error = useNet((s) => s.error)
  if (!error) return null
  return <div className="error-bar" role="alert">{error}</div>
}

export function App() {
  useFlow()
  const game = useNet((s) => s.game)
  return (
    <>
      <Error />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/room" element={<Lobby />} />
        <Route path="/play" element={game ? <Game /> : <div className="page muted">Спуск на станцию…</div>} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/admin/watch/:id" element={<Watch />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
