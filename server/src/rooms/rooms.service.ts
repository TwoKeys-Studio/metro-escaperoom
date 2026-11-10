import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
import type { Difficulty } from '../../../shared/level.ts'
import { send } from '../connection/client.ts'
import { ClientsService } from '../connection/clients.service.ts'
import { Room } from './room.ts'

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const makeCode = () => Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('')

/** The list of rooms on this server, and keeping the menu and the admin panel up to date about it. */
@Injectable()
export class RoomsService implements OnModuleInit, OnModuleDestroy {
  private readonly rooms = new Map<string, Room>()
  private unnamed = 0
  private listQueued = false
  private adminTimer: NodeJS.Timeout | null = null

  constructor(private readonly clients: ClientsService) {}

  onModuleInit() {
    this.adminTimer = setInterval(() => this.pushAdmin(), 1000)
  }

  onModuleDestroy() {
    if (this.adminTimer) clearInterval(this.adminTimer)
    for (const room of this.rooms.values()) room.stopTimer()
  }

  create(name: string, difficulty: Difficulty, password?: string): Room {
    const room = new Room(makeCode(), name.slice(0, 32) || `Комната ${++this.unnamed}`, difficulty, password || undefined)
    this.rooms.set(room.id, room)
    return room
  }

  get(id: string) {
    return this.rooms.get(id)
  }

  delete(id: string) {
    this.rooms.delete(id)
  }

  /** Rooms shown in the menu: solo practice and closed rooms are hidden. */
  publicList() {
    return [...this.rooms.values()].filter((r) => !r.closed && !r.solo).map((r) => r.summary())
  }

  /**
   * Call after anything that changes what the menu shows. Several calls in a row collapse into one
   * push 50 ms later, which also drops rooms that nobody plays or watches any more.
   */
  requestListPush() {
    if (this.listQueued) return
    this.listQueued = true
    setTimeout(() => {
      this.listQueued = false
      const msg = { t: 'rooms' as const, rooms: this.publicList() }
      for (const c of this.clients.all()) if (!c.room && !c.admin) send(c, msg)
      for (const [id, room] of this.rooms) {
        if (room.members.size === 0 && room.watchers.size === 0) {
          room.closed = true
          room.stopTimer()
          this.rooms.delete(id)
        }
      }
      this.pushAdmin()
    }, 50)
  }

  /** Full state of every room for the admin panel. */
  pushAdmin() {
    const data = {
      t: 'adminRooms' as const,
      rooms: [...this.rooms.values()].map((r) => ({ ...r.summary(), list: r.players(), state: r.state })),
    }
    for (const c of this.clients.all()) if (c.admin) send(c, data)
  }
}
