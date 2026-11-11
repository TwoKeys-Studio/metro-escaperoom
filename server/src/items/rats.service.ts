import { Injectable } from '@nestjs/common'
import { RAT_RANGE, type Vec3 } from '../../../shared/level.ts'
import { rnd } from '../common/random.ts'
import type { Room } from '../rooms/room.ts'

const SPEED = 2.6 // metres per second

/** What one rat is up to. Kept on the room, keyed by item id. */
export interface RatMind {
  home: Vec3
  from: Vec3
  to: Vec3
  /** 0..1 along the current dash; 1 = sitting still. */
  progress: number
  duration: number
  wait: number
  /** Someone was carrying it or it was still falling: it settles wherever it ends up. */
  handled: boolean
}

/**
 * Rats are ordinary items that move by themselves: every few seconds one dashes to a new spot near its
 * home. The server moves them, so every player sees the same rat in the same place. A rat that was
 * carried somewhere makes that place its new home.
 */
@Injectable()
export class RatsService {
  tick(room: Room, dt: number) {
    for (const it of room.items.values()) {
      if (it.kind !== 'rat') continue
      let rat = room.rats.get(it.id)
      if (!rat) room.rats.set(it.id, (rat = { home: [...it.p], from: [...it.p], to: [...it.p], progress: 1, duration: 0, wait: rnd(1, 6), handled: false }))
      if (it.holder || it.owner || it.socket) {
        rat.handled = true
        continue
      }
      if (rat.handled) {
        rat.handled = false
        rat.home = [...it.p]
        rat.progress = 1
        rat.wait = rnd(2, 5)
      }
      if (rat.progress < 1) {
        rat.progress = Math.min(1, rat.progress + dt / rat.duration)
        const k = rat.progress
        it.p = [rat.from[0] + (rat.to[0] - rat.from[0]) * k, rat.home[1], rat.from[2] + (rat.to[2] - rat.from[2]) * k]
        room.dirtyItems.add(it.id)
        continue
      }
      rat.wait -= dt
      if (rat.wait > 0) continue
      rat.wait = rnd(1.5, 6)
      const a = Math.random() * Math.PI * 2
      const d = rnd(0.5, RAT_RANGE)
      rat.from = [...it.p]
      rat.to = [rat.home[0] + Math.cos(a) * d, rat.home[1], rat.home[2] + Math.sin(a) * d]
      rat.duration = Math.max(0.15, Math.hypot(rat.to[0] - rat.from[0], rat.to[2] - rat.from[2]) / SPEED)
      rat.progress = 0
      // face the way it runs
      const yaw = Math.atan2(rat.to[0] - rat.from[0], rat.to[2] - rat.from[2])
      it.q = [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)]
    }
  }
}
