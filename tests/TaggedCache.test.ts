import { describe, expect, test } from 'vitest'

import { MemoryStore } from '../src/drivers/MemoryStore.js'
import { TaggedCache } from '../src/TaggedCache.js'
import { TagSet } from '../src/TagSet.js'

describe('TaggedCache', () => {
  test('put/get with tags works and flush invalidates', async () => {
    const store = new MemoryStore({ sweepInterval: 60_000 })
    const tagSet = new TagSet(store, ['users'])
    const cache = new TaggedCache(store, tagSet)
    await cache.put('k', 'v', 60)
    expect(await cache.get('k')).toBe('v')
    await cache.flush()
    expect(await cache.get('k')).toBeNull()
    store.stopSweep()
  })
})
