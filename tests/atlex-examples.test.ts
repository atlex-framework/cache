import { describe, expect, it } from 'vitest'

import { MemoryStore } from '../src/drivers/MemoryStore.js'
import { Repository } from '../src/Repository.js'

describe('@atlex/cache examples', () => {
  it('MemoryStore get miss', async () => {
    const s = new MemoryStore()
    expect(await s.get('k')).toBeNull()
  })

  it('MemoryStore put and get', async () => {
    const s = new MemoryStore()
    await s.put('k', 'v', 60)
    expect(await s.get('k')).toBe('v')
  })

  it('Repository get with prefix', async () => {
    const s = new MemoryStore()
    const r = new Repository(s, { prefix: 'p:' })
    await r.put('k', 'v', 60)
    expect(await r.get<string>('k')).toBe('v')
  })

  it('MemoryStore forget', async () => {
    const s = new MemoryStore()
    await s.put('a', '1', 60)
    await s.forget('a')
    expect(await s.get('a')).toBeNull()
  })

  it('MemoryStore flush', async () => {
    const s = new MemoryStore()
    await s.put('a', '1', 60)
    await s.flush()
    expect(await s.get('a')).toBeNull()
  })
})
