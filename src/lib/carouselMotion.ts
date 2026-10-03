export const CAROUSEL_STEP = 146
export const wrapIndex = (value: number, count: number) => ((value % count) + count) % count
const smoothstep = (value: number) => {
  const t = Math.max(0, Math.min(1, value))
  return t * t * (3 - 2 * t)
}

/** Continuous styling: no layout or appearance switch at the nearest-seat boundary. */
export function cardAppearance(distance: number, visible: number) {
  const away = Math.abs(distance)
  const emphasis = Math.exp(-1.6 * away * away)
  const edge = Math.max(1, (visible - 1) / 2)
  const fade = 1 - smoothstep((away - edge) / .8)
  return {
    scale: .74 + .26 * emphasis,
    opacity: (.35 + .65 * emphasis) * fade,
    detailOpacity: .2 + .8 * emphasis,
  }
}

/** A bounded flick advances at most two additional profiles before settling. */
export function restingPan(pan: number, velocity = 0) {
  const travel = Math.max(-2 * CAROUSEL_STEP, Math.min(2 * CAROUSEL_STEP, velocity * 150))
  return Math.round((pan + travel) / CAROUSEL_STEP) * CAROUSEL_STEP
}

export function carouselSeats(center: number, count: number, visible: number) {
  if (count <= 1) return [{ index: 0, recordIndex: 0, distance: 0, accessible: true }]
  const edge = Math.max(1, (visible - 1) / 2) + 1
  const seats = []
  for (let index = Math.floor(center - edge); index <= Math.ceil(center + edge); index++) {
    const distance = index - center
    seats.push({ index, recordIndex: wrapIndex(index, count), distance,
      // A short cyclic list can repeat at the edges; expose each record only once.
      accessible: distance >= -count / 2 && distance < count / 2 && Math.abs(distance) < edge - .25 })
  }
  return seats
}
