export const rnd = (a: number, b: number) => a + Math.random() * (b - a)

export const pick = <T,>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)]

/** Shuffles in place and returns the same array. */
export const shuffle = <T,>(arr: T[]) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}
