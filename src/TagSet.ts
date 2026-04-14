import crypto from 'node:crypto'

import type { CacheStore } from './contracts/CacheStore.js'

function randomId(): string {
  return crypto.randomUUID()
}

function versionKey(name: string): string {
  return `tag:${name}:version`
}

/**
 * Manages tag version keys for invalidation via namespace rotation.
 */
export class TagSet {
  private readonly names: string[]

  public constructor(
    private readonly store: CacheStore,
    names: string[],
  ) {
    this.names = [...names].sort()
  }

  public getNames(): string[] {
    return [...this.names]
  }

  public async tagId(name: string): Promise<string> {
    const key = versionKey(name)
    const existing = await this.store.get<string>(key)
    if (existing !== null) return existing
    const id = randomId()
    await this.store.put(key, id, 0)
    return id
  }

  public async getNamespace(): Promise<string> {
    const ids = await Promise.all(this.names.map(async (n) => await this.tagId(n)))
    return ids.join('|')
  }

  public async resetTag(name: string): Promise<void> {
    await this.store.put(versionKey(name), randomId(), 0)
  }

  public async reset(): Promise<void> {
    await Promise.all(
      this.names.map(async (n) => {
        await this.resetTag(n)
      }),
    )
  }
}
