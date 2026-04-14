import type { TaggedCache } from '../TaggedCache.js'

import type { CacheStore } from './CacheStore.js'

export interface TaggableStore extends CacheStore {
  /**
   * Begin a tag-scoped operation.
   *
   * @param names - Tag names.
   */
  tags(names: string[]): TaggedCache
}
