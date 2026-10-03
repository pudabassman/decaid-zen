import test from 'node:test'
import assert from 'node:assert/strict'
import { createPaletteStore, PALETTE_STORAGE_KEY, colorWithAlpha, contrastRatio } from '../src/lib/paletteState.ts'
import { readFileSync } from 'node:fs'
import { PALETTE_TOKENS } from '../src/lib/paletteTokens.ts'
const css = readFileSync(new URL('../src/styles/palette-tokens.css', import.meta.url), 'utf8')
const FACTORY_PALETTE = Object.fromEntries([...css.matchAll(/--([\w-]+):\s*(#[\da-f]{6}(?:[\da-f]{2})?);/gi)].map(([, key, value]) => [key, value]))

function memoryStorage(initial) {
  let value = initial
  return { getItem: () => value ?? null, setItem: (key, next) => { assert.equal(key, PALETTE_STORAGE_KEY); value = next } }
}

test('protected Default retains the original appearance across edits and future launches', () => {
  const storage = memoryStorage()
  const store = createPaletteStore(FACTORY_PALETTE, storage)
  store.setColor('ground', '#123456')
  assert.match(store.save(' DEFAULT '), /protected/)
  store.flush()
  const reloaded = createPaletteStore({ ...FACTORY_PALETTE, ground: '#ffffff' }, storage)
  assert.equal(reloaded.getSnapshot().colors.ground, '#123456')
  reloaded.choose('default')
  assert.deepEqual(reloaded.getSnapshot().colors, FACTORY_PALETTE)
})

test('saved palettes are independent snapshots and can be restored after reload', () => {
  const storage = memoryStorage()
  const store = createPaletteStore(FACTORY_PALETTE, storage)
  store.setColor('ground', '#123456')
  assert.equal(store.save('Night'), null)
  const id = store.getSnapshot().selected
  store.setColor('ground', '#abcdef')
  store.flush()
  const reloaded = createPaletteStore(FACTORY_PALETTE, storage)
  reloaded.choose(id)
  assert.equal(reloaded.getSnapshot().colors.ground, '#123456')
  assert.match(reloaded.save(' night '), /already exists/)
  assert.match(reloaded.save(''), /name/)
  assert.match(reloaded.save('x'.repeat(61)), /name/)
})

test('one color gesture undoes as a whole, and selecting Default is undoable', () => {
  const store = createPaletteStore(FACTORY_PALETTE)
  store.beginEdit()
  store.setColor('ink', '#111111')
  store.setColor('ink', '#222222')
  store.setColor('ink', '#333333')
  store.undo()
  assert.deepEqual(store.getSnapshot().colors, FACTORY_PALETTE)
  assert.equal(store.getSnapshot().canUndo, false)
  store.setColor('ground', '#111111')
  store.choose('default')
  store.undo()
  assert.equal(store.getSnapshot().colors.ground, '#111111')
  store.flush()
})

test('invalid and unknown colors are ignored; malformed storage has a usable Default', () => {
  const store = createPaletteStore(FACTORY_PALETTE, memoryStorage('{'))
  assert.match(store.getSnapshot().error, /could not be read/)
  store.setColor('ground', 'red')
  store.setColor('made-up', '#123456')
  assert.deepEqual(store.getSnapshot().colors, FACTORY_PALETTE)
  const loaded = createPaletteStore(FACTORY_PALETTE, memoryStorage(JSON.stringify({ colors: { ink: '#ABCDEF', ground: 'bad' }, saved: [{ id: 'default', name: 'Hijack' }, { id: 'x', name: 'Default' }] })))
  assert.equal(loaded.getSnapshot().colors.ink, '#abcdef')
  assert.equal(loaded.getSnapshot().colors.ground, FACTORY_PALETTE.ground)
  assert.deepEqual(loaded.getSnapshot().saved, [])
})

test('storage failures keep live changes and protected Default available with feedback', () => {
  const store = createPaletteStore(FACTORY_PALETTE, { getItem: () => null, setItem: () => { throw new Error('Quota') } })
  store.setColor('ground', '#123456')
  store.flush()
  assert.equal(store.getSnapshot().colors.ground, '#123456')
  assert.match(store.getSnapshot().error, /Could not save/)
  store.choose('default')
  assert.deepEqual(store.getSnapshot().colors, FACTORY_PALETTE)
})

test('alpha and contrast calculations account for transparency', () => {
  assert.equal(colorWithAlpha('#abcdef80', .5), '#abcdef40')
  assert.equal(colorWithAlpha('#abcdef', 1), '#abcdefff')
  assert.equal(contrastRatio('#000000', '#ffffff'), 21)
  assert.equal(contrastRatio('#00000000', '#ffffff'), 1)
  assert.ok(contrastRatio('#00000080', '#ffffff') > 3.9)
})

test('every palette control has one CSS default', () => {
  assert.deepEqual(Object.keys(FACTORY_PALETTE).sort(), PALETTE_TOKENS.map(token => token.key).sort())
})
