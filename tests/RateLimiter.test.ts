import { describe, expect, test } from 'vitest'

import { MemoryStore } from '../src/drivers/MemoryStore.js'
import { RateLimiter } from '../src/RateLimiter.js'

describe('RateLimiter', () => {
  test('tooManyAttempts becomes true when exceeded', async () => {
    const store = new MemoryStore({ sweepInterval: 60_000 })
    const rl = new RateLimiter(store)
    await rl.hit('login:user:1', 60)
    await rl.hit('login:user:1', 60)
    expect(await rl.tooManyAttempts('login:user:1', 2)).toBe(true)
    store.stopSweep()
  })

  test('attempt runs callback when within limit', async () => {
    const store = new MemoryStore({ sweepInterval: 60_000 })
    const rl = new RateLimiter(store)
    let ran = 0
    const ok = await rl.attempt(
      'k',
      1,
      async () => {
        ran += 1
      },
      60,
    )
    expect(ok).toBe(true)
    expect(ran).toBe(1)
    const ok2 = await rl.attempt(
      'k',
      1,
      async () => {
        ran += 1
      },
      60,
    )
    expect(ok2).toBe(false)
    store.stopSweep()
  })
})
