import test from 'node:test'
import assert from 'node:assert/strict'
import { CAROUSEL_STEP, cardAppearance, carouselSeats, restingPan } from '../src/lib/carouselMotion.ts'

test('cards resize and fade continuously across the old half-seat boundary', () => {
  const before = cardAppearance(.4999, 3), after = cardAppearance(.5001, 3)
  assert.ok(Math.abs(before.scale - after.scale) < .001)
  assert.ok(Math.abs(before.opacity - after.opacity) < .001)
  const center = cardAppearance(0, 3), neighbor = cardAppearance(1, 3)
  assert.equal(center.scale, 1)
  assert.equal(center.opacity, 1)
  assert.ok(neighbor.scale < center.scale && neighbor.opacity < center.opacity)
  assert.equal(cardAppearance(1.8, 3).opacity, 0)
})

test('wrapping keeps the moving record on a continuous virtual seat', () => {
  const before = carouselSeats(7.99, 8, 3).find(s => s.index === 8)
  const after = carouselSeats(8.01, 8, 3).find(s => s.index === 8)
  assert.equal(before.recordIndex, 0)
  assert.equal(after.recordIndex, 0)
  assert.ok(Math.abs(before.distance - after.distance) < .021)
  assert.ok(carouselSeats(-24.25, 8, 3).every(s => s.recordIndex >= 0 && s.recordIndex < 8))
})

test('short lists expose each profile once and one profile remains centered', () => {
  assert.deepEqual(carouselSeats(999, 1, 1), [{ index: 0, recordIndex: 0, distance: 0, accessible: true }])
  for (const count of [2, 3]) for (const center of [0, .5, 2.7]) {
    const accessible = carouselSeats(center, count, count).filter(s => s.accessible)
    assert.equal(new Set(accessible.map(s => s.recordIndex)).size, accessible.length)
  }
})

test('release snaps to a seat and flick travel is bounded', () => {
  assert.equal(restingPan(CAROUSEL_STEP * .3), 0)
  assert.equal(restingPan(CAROUSEL_STEP * .6), CAROUSEL_STEP)
  assert.equal(restingPan(0, 999), CAROUSEL_STEP * 2)
  assert.equal(restingPan(0, -999), -CAROUSEL_STEP * 2)
})
