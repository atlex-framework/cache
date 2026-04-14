import { describe, expect, test } from 'vitest'

import { MemoryStore } from '../src/drivers/MemoryStore.js'
import { TagSet } from '../src/TagSet.js'

describe('TagSet', () => {
  test('getNamespace creates stable versions and reset bumps', async () => {
    const store = new MemoryStore({ sweepInterval: 60_000 })
    const tags = new TagSet(store, ['users', 'posts'])
    const ns1 = await tags.getNamespace()
    const ns2 = await tags.getNamespace()
    expect(ns1).toBe(ns2)
    await tags.resetTag('users')
    const ns3 = await tags.getNamespace()
    expect(ns3).not.toBe(ns1)
    store.stopSweep()
  })
})
