# Cache

> Multi-driver caching system with support for Redis, file-based, in-memory stores, and distributed locking. Automatically cache expensive computations and manage cache expiration.

[![npm version](https://img.shields.io/npm/v/@atlex/cache?style=flat-square&color=7c3aed)](https://www.npmjs.com/package/@atlex/cache)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=flat-square)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/npm/l/@atlex/cache?style=flat-square)](./LICENSE)

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-Support-yellow?style=flat-square&logo=buy-me-a-coffee)](https://buymeacoffee.com/khamazaspyan)

## Installation

Install the package via npm, yarn, or pnpm:

```bash
npm install @atlex/cache
```

```bash
yarn add @atlex/cache
```

```bash
pnpm add @atlex/cache
```

## Quick Start

### Configuration

First, configure your cache drivers in your application's config file:

```typescript
// config/cache.ts
export const cacheConfig = {
  default: 'memory',
  prefix: 'app_cache',
  stores: {
    memory: {
      // In-memory cache store
    },
    file: {
      directory: './storage/cache',
    },
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
    },
    null: {
      // Disables caching
    },
  },
}
```

### Basic Usage

Get, set, and retrieve cached values:

```typescript
import { Cache } from '@atlex/cache'

// Set a value
await Cache.set('user:1', userData, 3600) // expires in 1 hour

// Get a value
const user = await Cache.get('user:1')

// Get with default value
const user = await Cache.get('user:1', null)

// Check if key exists
const exists = await Cache.has('user:1')

// Forget a key
await Cache.forget('user:1')

// Flush all cache
await Cache.flush()
```

### Remember Pattern

Automatically cache expensive computations:

```typescript
const user = await Cache.remember('user:1', 3600, async () => {
  // This callback only runs if the key doesn't exist
  return await User.find(1)
})

// Remember forever (no expiration)
const allUsers = await Cache.rememberForever('users:all', async () => {
  return await User.all()
})
```

### Search Pattern

Cache a value and retrieve it, creating if it doesn't exist:

```typescript
const user = await Cache.sear('user:1', async () => {
  return await User.find(1)
})
```

## Features

- **Multiple Drivers**: Memory, File, Redis, and Null stores
- **Fluent API**: Simple and intuitive interface for cache operations
- **Auto-expiration**: Set TTL for automatic key expiration
- **Tagging**: Organize and flush cache by tags
- **Rate Limiting**: Built-in rate limiter for API protection
- **Distributed Locking**: Prevent cache stampedes with locks
- **Remember Pattern**: Automatically cache expensive computations
- **Prefix Support**: Namespace all cache keys automatically
- **TypeScript**: Full type safety throughout the API

## Core Concepts

### CacheManager

The `CacheManager` is the main entry point for cache operations. It manages driver registration and provides the API for cache access.

```typescript
import { CacheManager } from '@atlex/cache'

// Get the default store
const store = CacheManager.store()

// Switch to a specific driver
const redisStore = CacheManager.store('redis')

// Get a specific driver without creating repository
const driver = CacheManager.driver('file')

// Extend with custom drivers
CacheManager.extend('custom', new CustomCacheDriver())
```

### Repository

The `Repository` class provides the main caching API. It handles getting, setting, remembering, and managing cache data.

```typescript
const cache = CacheManager.store()

// Set a value with TTL in seconds
await cache.set('config:app', appConfig, 3600)

// Get a value
const config = await cache.get('config:app')

// Put is an alias for set
await cache.put('config:app', appConfig, 3600)

// Add only if key doesn't exist
const added = await cache.add('config:app', appConfig, 3600)

// Remember: get or compute and cache
const data = await cache.remember('expensive:operation', 3600, async () => {
  return await expensiveOperation()
})

// Remember forever
const data = await cache.rememberForever('static:data', async () => {
  return await fetchStaticData()
})

// Sear: like remember but returns cached value after caching
const item = await cache.sear('item:1', async () => {
  return await Item.find(1)
})

// Remove a key
await cache.forget('config:app')

// Flush all keys in store
await cache.flush()

// Increment numeric value
await cache.set('counter', 0)
await cache.increment('counter', 5) // Now 5

// Decrement numeric value
await cache.decrement('counter', 2) // Now 3

// Pull: get and delete
const value = await cache.pull('temp:data')
```

### Tagged Cache

Organize cache by tags for grouped operations:

```typescript
const cache = CacheManager.store()

// Set with tags
await cache.tags(['user', 'user:1']).set('user:1:profile', userData, 3600)

// Get tagged value
const user = await cache.tags(['user', 'user:1']).get('user:1:profile')

// Flush all keys with specific tag
await cache.tags(['user']).flush()

// Multiple tags for filtering
await cache.tags(['user', 'active']).set('user:1', userData, 3600)

// Flush by multiple tags
await cache.tags(['user', 'active']).flush()
```

### Distributed Locking

Prevent cache stampedes with distributed locks:

```typescript
const cache = CacheManager.store()

// Get a lock
const lock = cache.lock('expensive:operation')

// Acquire the lock
const acquired = await lock.acquire()

if (acquired) {
  try {
    // Do expensive operation
    await expensiveOperation()
  } finally {
    // Release the lock
    await lock.release()
  }
}

// Force release a lock (use cautiously)
await lock.forceRelease()

// Block until lock is available
await lock.block(10, async () => {
  // This code runs once the lock is acquired
  // Lock is automatically released after this function completes
  await expensiveOperation()
})

// Block with timeout
const completed = await lock.block(
  5,
  async () => {
    await heavyProcessing()
  },
  { timeout: 10 },
) // Wait max 10 seconds for lock
```

### Rate Limiter

Limit request rates to prevent abuse:

```typescript
const cache = CacheManager.store()
const limiter = cache.rateLimiter('login-attempts', {
  maxAttempts: 5,
  decayMinutes: 15,
})

// Record a hit
await limiter.hit()

// Get remaining attempts
const remaining = await limiter.remaining()

// Check if too many attempts
if (remaining === 0) {
  throw new Error('Too many login attempts')
}

// Reset the limiter
await limiter.reset()

// Get total hits
const hits = await limiter.hits()

// Retry after delay
const backoffSeconds = await limiter.retry()
```

## Available Drivers

### Memory Store

In-memory cache storage (data lost on restart):

```typescript
{
  memory: {
    // No configuration needed
  }
}
```

Best for development and testing. Not suitable for production with multiple processes.

### File Store

File-based cache storage:

```typescript
{
  file: {
    directory: './storage/cache',
  }
}
```

Suitable for single-server deployments. Slower than memory but persists across restarts.

### Redis Store

Distributed Redis cache:

```typescript
{
  redis: {
    host: 'localhost',
    port: 6379,
    password: 'secret',
    db: 0,
  }
}
```

Best for distributed systems and high-performance caching. Supports tagging and locking across processes.

### Null Store

Disables caching (useful for testing):

```typescript
{
  null: {
    // No configuration
  }
}
```

All cache operations execute immediately without storing values.

## API Reference

### CacheManager

```typescript
// Get the default store
static store(name?: string): Repository

// Get a specific driver
static driver(name: string): CacheDriver

// Register a custom driver
static extend(name: string, driver: CacheDriver): void
```

### Repository

```typescript
// Get a value from cache
async get(key: string, defaultValue?: any): Promise<any>

// Set a value in cache with TTL (seconds)
async set(key: string, value: any, seconds?: number): Promise<void>

// Put is an alias for set
async put(key: string, value: any, seconds?: number): Promise<void>

// Add only if key doesn't exist
async add(key: string, value: any, seconds?: number): Promise<boolean>

// Get or cache result of callback
async remember(key: string, seconds: number, callback: () => Promise<any>): Promise<any>

// Get or cache result forever
async rememberForever(key: string, callback: () => Promise<any>): Promise<any>

// Get and cache, return cached value immediately
async sear(key: string, callback: () => Promise<any>): Promise<any>

// Get and delete
async pull(key: string, defaultValue?: any): Promise<any>

// Delete a key
async forget(key: string): Promise<boolean>

// Delete all keys
async flush(): Promise<void>

// Increment numeric value
async increment(key: string, value: number = 1): Promise<number>

// Decrement numeric value
async decrement(key: string, value: number = 1): Promise<number>

// Get tagged cache instance
tags(...tags: string[]): TaggedCache

// Get a lock
lock(name: string, seconds?: number, owner?: string): Lock

// Get a rate limiter
rateLimiter(name: string, options: RateLimiterOptions): RateLimiter
```

### TaggedCache

Extends Repository with tag-scoped operations:

```typescript
// All Repository methods available, but scoped to tags

// Get tagged value
async get(key: string): Promise<any>

// Set with tags
async set(key: string, value: any, seconds?: number): Promise<void>

// Flush all keys with these tags
async flush(): Promise<void>
```

### Lock

```typescript
// Acquire the lock
async acquire(): Promise<boolean>

// Release the lock
async release(): Promise<void>

// Force release (dangerous)
async forceRelease(): Promise<void>

// Block until available and execute callback
async block(seconds: number, callback: () => Promise<any>, options?: BlockOptions): Promise<any>
```

### RateLimiter

```typescript
// Record a hit
async hit(): Promise<number>

// Get number of hits
async hits(): Promise<number>

// Get remaining attempts
async remaining(): Promise<number>

// Reset the limiter
async reset(): Promise<void>

// Get retry backoff
async retry(): Promise<number>

// Check if limited
async tooManyAttempts(): Promise<boolean>

// Clear the limiter
async clear(): Promise<void>
```

## Examples

### Caching Database Queries

```typescript
export class UserRepository {
  async find(id: number): Promise<User> {
    return await Cache.remember(`user:${id}`, 3600, async () => {
      return await database.table('users').where('id', id).first()
    })
  }

  async update(id: number, data: any): Promise<void> {
    // Invalidate cache when updated
    await Cache.forget(`user:${id}`)
    await database.table('users').where('id', id).update(data)
  }
}
```

### Tag-Based Cache Invalidation

```typescript
export class PostRepository {
  async getByAuthor(authorId: number): Promise<Post[]> {
    return await Cache.tags(['post', `author:${authorId}`]).remember(
      `author:${authorId}:posts`,
      3600,
      async () => {
        return await Post.where('author_id', authorId).get()
      },
    )
  }

  async publishPost(post: Post): Promise<void> {
    // Save post...

    // Invalidate all posts by this author
    await Cache.tags([`author:${post.authorId}`]).flush()
  }
}
```

### API Rate Limiting

```typescript
export async function handleLogin(request: Request): Promise<Response> {
  const email = request.body.email
  const limiter = Cache.store().rateLimiter(`login:${email}`, {
    maxAttempts: 5,
    decayMinutes: 15,
  })

  if (await limiter.tooManyAttempts()) {
    const retrySeconds = await limiter.retry()
    return response.status(429).json({
      error: `Too many attempts. Try again in ${retrySeconds} seconds.`,
    })
  }

  await limiter.hit()

  try {
    const user = await User.findByEmail(email)
    if (!user || !(await user.verifyPassword(request.body.password))) {
      return response.status(401).json({ error: 'Invalid credentials' })
    }

    await limiter.reset()
    return response.json({ token: user.generateToken() })
  } catch (error) {
    return response.status(500).json({ error: 'Login failed' })
  }
}
```

### Preventing Cache Stampedes

```typescript
export async function expensiveQuery(): Promise<any> {
  const cacheKey = 'expensive:computation'
  const lock = Cache.store().lock(cacheKey, 30)

  // Check cache first
  const cached = await Cache.get(cacheKey)
  if (cached) return cached

  // Block until lock available
  try {
    await lock.block(10, async () => {
      // Double-check cache
      const rechecked = await Cache.get(cacheKey)
      if (rechecked) return rechecked

      // Do expensive operation
      const result = await performExpensiveQuery()
      await Cache.set(cacheKey, result, 3600)
    })
  } catch (error) {
    // Lock timeout - return error or use fallback
    console.error('Cache lock timeout')
  }

  return await Cache.get(cacheKey)
}
```

## Testing

### Using the Null Driver

Disable caching in tests:

```typescript
// config/cache.test.ts
export const cacheConfig = {
  default: 'null',
  stores: {
    null: {},
  },
}
```

### Mocking Cache

```typescript
import { Cache } from '@atlex/cache'
import { vi } from 'vitest'

test('caches user lookup', async () => {
  const getSpy = vi.spyOn(Cache, 'remember')

  await userRepository.find(1)

  expect(getSpy).toHaveBeenCalledWith('user:1', expect.any(Number), expect.any(Function))
})
```

## Configuration Reference

```typescript
interface CacheConfig {
  // Default cache store
  default: string

  // Key prefix for all cached values
  prefix: string

  // Store configurations
  stores: {
    memory?: {}
    file?: { directory: string }
    redis?: { host: string; port: number; password?: string }
    null?: {}
  }
}
```

## Best Practices

1. **Use Appropriate TTLs**: Set reasonable expiration times based on data freshness requirements.

2. **Implement Cache Invalidation**: Invalidate cache when underlying data changes.

3. **Prevent Stampedes**: Use locks to prevent multiple processes from computing the same expensive operation.

4. **Monitor Cache Hit Rates**: Track cache performance in production.

5. **Use Tags for Related Data**: Group related cache entries with tags for bulk operations.

6. **Handle Cache Misses**: Always provide fallback values or async computation.

7. **Test with Null Driver**: Use the null driver in tests to ensure code works without cache.

8. **Separate Cache Layers**: Use different stores for different data types (sessions in Redis, config in memory).

9. **Set Prefix**: Use cache prefix to avoid collisions in shared environments.

10. **Rate Limit Strategically**: Use rate limiters on expensive operations and user-facing APIs.

## Documentation

For more information and advanced usage, visit the [Atlex documentation](https://atlex.dev/guide/cache).

## License

## MIT © [Karen Hamazaspyan](https://github.com/khamazaspyan)

Part of [Atlex](https://atlex.dev) — A modern framework for Node.js.
