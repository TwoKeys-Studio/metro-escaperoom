import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { WebSocketServer } from 'ws'
import type { ClientMsg } from '../../shared/protocol.ts'
import { DIFFICULTIES } from '../../shared/level.ts'
import { Room, send, type Client } from './room.ts'

const PORT = Number(process.env.PORT ?? 2567)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'neon17'
const DIST = fileURLToPath(new URL('../../client/dist', import.meta.url))

const rooms = new Map<string, Room>()
const clients = new Set<Client>()

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.wasm': 'application/wasm',
  '.json': 'application/json', '.ico': 'image/x-icon',
}

// Serves the built client in production (`npm run build` in /client).
const http = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://x')
  if (url.pathname === '/health') {
    res.end('ok')
    return
  }
  let file = normalize(join(DIST, decodeURIComponent(url.pathname)))
  if (!file.startsWith(DIST)) {
    res.writeHead(403).end()
    return
  }
  try {
    if (!(await stat(file)).isFile()) throw new Error('dir')
  } catch {
    file = join(DIST, 'index.html') // SPA fallback
  }
  try {
    const body = await readFile(file)
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404).end('Сначала соберите клиент: cd client && npm run build')
  }
})

const wss = new WebSocketServer({ server: http, path: '/ws' })

function roomList() {
  return [...rooms.values()].filter((r) => !r.closed && !r.solo).map((r) => r.summary())
}

let listQueued = false
function pushRoomList() {
  if (listQueued) return
  listQueued = true
  setTimeout(() => {
    listQueued = false
    const msg = { t: 'rooms' as const, rooms: roomList() }
    for (const c of clients) if (!c.room && !c.admin) send(c, msg)
    // drop empty rooms
    for (const [id, r] of rooms) {
      if (r.members.size === 0 && r.watchers.size === 0) {
        r.close()
        rooms.delete(id)
      }
    }
    pushAdmin()
  }, 50)
}

function pushAdmin() {
  const data = {
    t: 'adminRooms' as const,
    rooms: [...rooms.values()].map((r) => ({ ...r.summary(), list: r.players(), state: r.state })),
  }
  for (const c of clients) if (c.admin) send(c, data)
}
setInterval(pushAdmin, 1000)

wss.on('connection', (ws) => {
  const client: Client = { id: randomUUID().slice(0, 8), ws, name: 'Пассажир', room: null, admin: false, watching: null }
  clients.add(client)
  send(client, { t: 'welcome', id: client.id })
  send(client, { t: 'rooms', rooms: roomList() })

  ws.on('message', (raw) => {
    let msg: ClientMsg
    try {
      msg = JSON.parse(String(raw))
    } catch {
      return
    }
    try {
      handle(client, msg)
    } catch (e) {
      console.error('message failed', msg.t, e)
    }
  })

  ws.on('close', () => {
    clients.delete(client)
    client.room?.remove(client.id)
    client.watching?.watchers.delete(client)
    pushRoomList()
  })
})

function handle(client: Client, msg: ClientMsg) {
  switch (msg.t) {
    case 'hello':
      client.name = msg.name.trim().slice(0, 18) || 'Пассажир'
      return
    case 'create': {
      if (client.room) client.room.remove(client.id)
      const diff = DIFFICULTIES[msg.difficulty] ? msg.difficulty : 'normal'
      const room = new Room(msg.solo ? `Тренировка · ${client.name}` : msg.name, diff, pushRoomList, msg.password)
      room.solo = !!msg.solo
      rooms.set(room.id, room)
      room.add(client)
      if (room.solo) room.start(true)
      pushRoomList()
      return
    }
    case 'join': {
      const room = rooms.get(msg.roomId.toUpperCase())
      if (!room) return send(client, { t: 'error', text: 'Комната не найдена' })
      const err = room.canJoin(msg.password)
      if (err) return send(client, { t: 'error', text: err })
      if (client.room) client.room.remove(client.id)
      room.add(client)
      pushRoomList()
      return
    }
    case 'leave':
      client.room?.remove(client.id, 'Вы вышли из комнаты')
      pushRoomList()
      return
    case 'adminAuth':
      if (msg.password === ADMIN_PASSWORD) {
        client.admin = true
        send(client, { t: 'adminOk' })
        pushAdmin()
      } else send(client, { t: 'error', text: 'Неверный пароль администратора' })
      return
    case 'adminWatch': {
      if (!client.admin) return
      client.watching?.watchers.delete(client)
      client.watching = null
      if (msg.roomId) {
        const room = rooms.get(msg.roomId)
        if (!room) return
        room.watchers.add(client)
        client.watching = room
        send(client, { t: 'room', id: room.id, name: room.name, players: room.players(), difficulty: room.difficulty, phase: room.phase })
        room.sendGame(client)
      }
      return
    }
    case 'admin': {
      if (!client.admin) return
      const room = rooms.get(msg.roomId)
      if (!room) return
      room.adminCmd(msg.cmd)
      if (msg.cmd.c === 'close') rooms.delete(room.id)
      pushRoomList()
      return
    }
    default:
      client.room?.handle(client, msg)
  }
}

http.listen(PORT, () => {
  console.log(`НЕОН-17 server on http://localhost:${PORT}  (ws: /ws, admin password: ${ADMIN_PASSWORD === 'neon17' ? 'neon17 — смените ADMIN_PASSWORD' : 'из ADMIN_PASSWORD'})`)
})
