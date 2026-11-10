// Small rules shared by several services. Pure functions: no room, no network.
import { PIT_Y } from '../../../shared/level.ts'
import type { GameState, Phase } from '../../../shared/protocol.ts'

/** Phases in which the clock runs and the water rises. */
export const ACTIVE_PHASES: Phase[] = ['power', 'access', 'charge', 'arm', 'evac']

export const WATER_START = PIT_Y - 0.4
/** The platform drowns when the water reaches this height. */
const WATER_END = 0.45

/** Water height for the share of time used up: creeps slowly, then accelerates in the last third. */
export function waterLevel(progress: number) {
  const curve = progress < 0.66 ? progress * 0.75 : 0.495 + (progress - 0.66) * 1.485
  return WATER_START + curve * (WATER_END - WATER_START)
}

/** Bonus time. The total grows with it so the progress bar and the water never jump backwards past zero. */
export function addTime(state: GameState, sec: number) {
  state.timeLeft += sec
  if (state.timeLeft > state.totalTime) state.totalTime = state.timeLeft
}

/** The service door code: the digits on the neon signs, read in the colour order of the route map. */
export function doorCodeDigits(state: GameState) {
  return state.codeOrder.map((ci) => state.codeDigits[ci])
}
