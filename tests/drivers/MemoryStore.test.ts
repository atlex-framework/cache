import { describe, expect, test, vi } from 'vitest'

import { MemoryStore } from '../../src/drivers/MemoryStore.js'

describe('MemoryStore', () => {
  test('put/get round-trip', async () => {
    const s = new MemoryStore({ prefix: 'x', sweepInterval: 60_000 })
    await s.put('k', { a: 1 }, 60)
    expect(await s.get('k')).toEqual({ a: 1 })
    s.stopSweep()
  })

  test('TTL expires', async () => {
    vi.useFakeTimers()
    const s = new MemoryStore({ sweepInterval: 60_000 })
    await s.put('k', 1, 1)
    vi.advanceTimersByTime(1100)
    expect(await s.get('k')).toBeNull()
    s.stopSweep()
    vi.useRealTimers()
  })

  test('add respects existing/non-expired', async () => {
    const s = new MemoryStore()
    await s.put('k', 1, 60)
    expect(await s.add('k', 2, 60)).toBe(false)
    s.stopSweep()
  })

  test('increment/decrement init to 0', async () => {
    const s = new MemoryStore()
    expect(await s.increment('n')).toBe(1)
    expect(await s.decrement('n')).toBe(0)
    s.stopSweep()
  })
})
