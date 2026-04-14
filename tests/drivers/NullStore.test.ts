import { describe, expect, test } from 'vitest'

import { NullStore } from '../../src/drivers/NullStore.js'

describe('NullStore', () => {
  test('reads return null and writes succeed', async () => {
    const s = new NullStore('p')
    expect(await s.get('k')).toBeNull()
    expect(await s.put('k', 1, 10)).toBe(true)
    expect(await s.has('k')).toBe(false)
    expect(await s.increment('n')).toBe(0)
    expect(await s.flush()).toBe(true)
  })
})
