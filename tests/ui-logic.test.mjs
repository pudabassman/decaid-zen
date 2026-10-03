import test from 'node:test'
import assert from 'node:assert/strict'
import { parseNumber, profileStepIndex, weightCeiling } from '../src/lib/validation.ts'
import { stackLabels } from '../src/lib/labelStack.ts'

test('numeric edits reject partial, empty, infinite and out-of-range input', () => {
  for (const raw of ['', ' ', '12abc', 'Infinity', '1e5', '-1', '101']) assert.equal(parseNumber(raw, 0, 100), null, raw)
  for (const [raw, number] of [['0', 0], [' 18.5 ', 18.5], ['.5', .5], ['100', 100]]) assert.equal(parseNumber(raw, 0, 100), number)
})
test('gateway zero-based frame aligns first and subsequent steps', () => {
  assert.deepEqual([-1, 0, 1, 2, 99, NaN].map(frame => profileStepIndex(frame, 3)), [0, 0, 1, 2, 2, 0])
  assert.equal(profileStepIndex(0, 0), 0)
})
test('weight axis keeps a large target and overshoot in view', () => {
  assert.equal(weightCeiling(36, 0), 50)
  for (const [target, measured] of [[60, 70], [0, 110], [100, 98]]) {
    const max = weightCeiling(target, measured)
    assert.ok(max > target && max > measured)
    assert.equal(max % 10, 0)
  }
})
test('colliding graph labels stay bounded with their metric identity', () => {
  const stacked = stackLabels([{ key: 'weight', y: 90 }, { key: 'flow', y: 90 }, { key: 'pressure', y: 2 }], 38, 18, 130)
  assert.deepEqual(stacked.map(label => label.key), ['pressure', 'weight', 'flow'])
  assert.ok(stacked.every(label => label.y >= 18 && label.y <= 130))
  assert.ok(stacked.slice(1).every((label, i) => label.y - stacked[i].y >= 38))
  const cramped = stackLabels([{ y: 0 }, { y: 0 }, { y: 0 }, { y: 0 }], 38, 18, 78)
  assert.deepEqual(cramped.map(label => label.y), [18, 38, 58, 78])
})
