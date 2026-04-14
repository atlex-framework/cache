import { describe, expect, test } from 'vitest'

import { MemoryStore } from '../src/drivers/MemoryStore.js'
import { Repository } from '../src/Repository.js'

describe('Repository', () => {
  test('set/get round-trip', async () => {
    const store = new MemoryStore({ sweepInterval: 60_000 })
    const repo = new Repository(store)
    await repo.set('k', 1, 60)
    expect(await repo.get('k')).toBe(1)
    store.stopSweep()
  })

  test('get with function fallback returns fallback and does not cache', async () => {
    const store = new MemoryStore({ sweepInterval: 60_000 })
    const repo = new Repository(store)
    const v1 = await repo.get('missing', () => 123)
    const v2 = await repo.get('missing')
    expect(v1).toBe(123)
    expect(v2).toBeNull()
    store.stopSweep()
  })

  test('remember caches callback result', async () => {
    const store = new MemoryStore({ sweepInterval: 60_000 })
    const repo = new Repository(store)
    let calls = 0
    const v1 = await repo.remember('k', 60, async () => {
      calls += 1
      return 5
    })
    const v2 = await repo.remember('k', 60, async () => 6)
    expect(v1).toBe(5)
    expect(v2).toBe(5)
    expect(calls).toBe(1)
    store.stopSweep()
  })
})
