import test from 'node:test'
import assert from 'node:assert/strict'
import { createCoffeeMenuCache } from '../src/lib/coffeeMenuCache.ts'

const snapshot = (...names) => ({ coffees: names.map(name => ({ name, title: name, url: `/${name}` })), fetchedAt: 100 })

test('reopening reuses the ordered snapshot without another catalog/history load', async () => {
  let calls = 0
  const cache = createCoffeeMenuCache(async () => { calls++; return snapshot('Zebra', 'Alpha') })
  const first = await cache.load('Peony')
  assert.equal(cache.peek(' PEONY '), first)
  assert.equal(await cache.load('peony'), first)
  assert.deepEqual(first.coffees.map(coffee => coffee.name), ['Zebra', 'Alpha'])
  assert.equal(calls, 1)
})

test('each roaster has its own snapshot, retained when switching back', async () => {
  const calls = []
  const cache = createCoffeeMenuCache(async roaster => { calls.push(roaster); return snapshot(roaster) })
  const first = await cache.load('Peony')
  await cache.load('Other')
  assert.equal(await cache.load('Peony'), first)
  assert.deepEqual(calls, ['Peony', 'Other'])
})

test('closing and reopening during loading shares the same pending request', async () => {
  let finish
  let calls = 0
  const cache = createCoffeeMenuCache(() => { calls++; return new Promise(resolve => { finish = resolve }) })
  const first = cache.load('Peony')
  const reopened = cache.load('Peony')
  assert.equal(reopened, first)
  await Promise.resolve()
  finish(snapshot('Saved'))
  assert.equal(await first, await reopened)
  assert.equal(cache.peek('Peony'), await first)
  assert.equal(calls, 1)
})

test('explicit refresh replaces the snapshot, while reopen during refresh keeps the ready list', async () => {
  let finish
  const flags = []
  const cache = createCoffeeMenuCache(async (_, refresh) => {
    flags.push(refresh)
    return refresh ? new Promise(resolve => { finish = resolve }) : snapshot('Original')
  })
  const original = await cache.load('Peony')
  const refresh = cache.load('Peony', true)
  assert.equal(cache.load('Peony', true), refresh)
  assert.equal(await cache.load('Peony'), original)
  finish(snapshot('New', 'Original'))
  const updated = await refresh
  assert.equal(await cache.load('Peony'), updated)
  assert.deepEqual(flags, [false, true])
})

test('failed refresh preserves the last usable list and allows a later retry', async () => {
  let fail = false
  const cache = createCoffeeMenuCache(async () => {
    if (fail) throw new Error('Offline')
    return snapshot('Original')
  })
  const original = await cache.load('Peony')
  fail = true
  await assert.rejects(cache.load('Peony', true), /Offline/)
  assert.equal(cache.peek('Peony'), original)
  assert.equal(await cache.load('Peony'), original)
  fail = false
  assert.notEqual(await cache.load('Peony', true), original)
})

test('an empty successful list is cached, while a failed first load can be retried', async () => {
  let calls = 0
  const cache = createCoffeeMenuCache(async () => {
    if (++calls === 1) throw new Error('Offline')
    return snapshot()
  })
  await assert.rejects(cache.load('Peony'), /Offline/)
  assert.equal(cache.peek('Peony'), undefined)
  const empty = await cache.load('Peony')
  assert.equal(await cache.load('Peony'), empty)
  assert.equal(calls, 2)
})
