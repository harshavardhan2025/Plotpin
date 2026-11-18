/**
 * PlotPin Centralized Redis & In-Memory Cache Service
 * 
 * Provides high-performance distributed caching with automatic, zero-crash
 * fallback to an in-memory TTL cache when Redis is unavailable or unconfigured.
 */

const Redis = require('ioredis');

class InMemoryAdapter {
  constructor(maxEntries = 5000) {
    this.store = new Map();
    this.maxEntries = maxEntries;

    // Periodic sweep every 60 seconds
    this.sweepInterval = setInterval(() => {
      this.sweep();
    }, 60 * 1000);
    if (this.sweepInterval.unref) {
      this.sweepInterval.unref();
    }
  }

  sweep() {
    const now = Date.now();
    for (const [key, item] of this.store.entries()) {
      if (item.expiresAt && item.expiresAt <= now) {
        this.store.delete(key);
      }
    }
  }

  async get(key) {
    const item = this.store.get(key);
    if (!item) return null;
    if (item.expiresAt && item.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  async set(key, value, ttlSeconds = 300) {
    // Evict oldest if limit reached
    if (this.store.size >= this.maxEntries) {
      const keysToDelete = Array.from(this.store.keys()).slice(0, Math.floor(this.maxEntries * 0.1));
      for (const k of keysToDelete) this.store.delete(k);
    }

    const expiresAt = ttlSeconds > 0 ? Date.now() + (ttlSeconds * 1000) : null;
    this.store.set(key, { value, expiresAt });
    return true;
  }

  async del(key) {
    return this.store.delete(key);
  }

  async delPattern(pattern) {
    // Convert Redis wildcard pattern (e.g. 'properties:*') to RegExp
    const regexPattern = new RegExp('^' + pattern.replace(/[-[\]{}()+?.,\\^$|#\s]/g, '\\$&').replace(/\*/g, '.*') + '$');
    let deletedCount = 0;
    for (const key of this.store.keys()) {
      if (regexPattern.test(key)) {
        this.store.delete(key);
        deletedCount++;
      }
    }
    return deletedCount;
  }

  async flush() {
    this.store.clear();
    return true;
  }

  size() {
    return this.store.size;
  }
}

class CacheService {
  constructor() {
    this.memoryAdapter = new InMemoryAdapter();
    this.redis = null;
    this.isRedisReady = false;
    this.hasLoggedConnectionFailure = false;
    this.init();
  }

  init() {
    const isExplicitlyDisabled = process.env.REDIS_ENABLED === 'false';
    const redisUrl = process.env.REDIS_URL;
    const redisHost = process.env.REDIS_HOST;

    if (isExplicitlyDisabled) {
      console.log('ℹ️ [CacheService] Redis explicitly disabled via REDIS_ENABLED=false. Using In-Memory cache.');
      return;
    }

    // Only attempt Redis if REDIS_URL or REDIS_HOST is configured
    if (!redisUrl && !redisHost) {
      console.log('ℹ️ [CacheService] No REDIS_URL configured. Operating in high-performance In-Memory cache mode.');
      return;
    }

    try {
      const clientConfig = {
        maxRetriesPerRequest: 1,
        enableReadyCheck: true,
        connectTimeout: 5000,
        lazyConnect: true,
        retryStrategy: (times) => {
          if (times > 5) {
            if (!this.hasLoggedConnectionFailure) {
              console.warn('⚠️ [CacheService] Redis unreachable after 5 attempts. Falling back seamlessly to In-Memory cache.');
              this.hasLoggedConnectionFailure = true;
            }
            return null; // Stop reconnecting after 5 tries
          }
          return Math.min(times * 1000, 3000);
        }
      };

      if (redisUrl) {
        // Automatically enable TLS for rediss://, upstash.io, or cloud providers requiring SSL
        const isSecure = redisUrl.startsWith('rediss://') || redisUrl.includes('upstash.io') || redisUrl.includes('.cache.amazonaws.com');
        if (isSecure) {
          clientConfig.tls = { rejectUnauthorized: false };
        }
        // Normalize redis:// to rediss:// for providers that enforce TLS
        const finalUrl = (isSecure && redisUrl.startsWith('redis://'))
          ? redisUrl.replace(/^redis:\/\//, 'rediss://')
          : redisUrl;
        this.redis = new Redis(finalUrl, clientConfig);
      } else {
        this.redis = new Redis({
          host: redisHost || '127.0.0.1',
          port: Number(process.env.REDIS_PORT) || 6379,
          password: process.env.REDIS_PASSWORD || undefined,
          ...clientConfig
        });
      }

      this.redis.on('connect', () => {
        console.log('🔌 [CacheService] Redis connecting...');
      });

      this.redis.on('ready', () => {
        this.isRedisReady = true;
        this.hasLoggedConnectionFailure = false;
        console.log('🚀 [CacheService] Redis client connected and ready.');
      });

      this.redis.on('error', (err) => {
        this.isRedisReady = false;
        if (!this.hasLoggedConnectionFailure) {
          console.warn(`⚠️ [CacheService] Redis error: ${err.message}. Seamlessly falling back to In-Memory cache.`);
          this.hasLoggedConnectionFailure = true;
        }
      });

      this.redis.on('close', () => {
        this.isRedisReady = false;
      });

      // Connect asynchronously without blocking main thread
      this.redis.connect().catch(() => {
        // Handled by error listener
      });
    } catch (err) {
      console.warn(`⚠️ [CacheService] Failed to initialize Redis client (${err.message}). Using In-Memory cache.`);
      this.redis = null;
      this.isRedisReady = false;
    }
  }

  /**
   * Authoritative getter for active driver
   */
  get activeDriver() {
    return this.isRedisReady && this.redis ? 'redis' : 'memory';
  }

  /**
   * Retrieve cached item
   */
  async get(key) {
    if (!key) return null;

    if (this.isRedisReady && this.redis) {
      try {
        const raw = await this.redis.get(key);
        if (!raw) return null;
        try {
          return JSON.parse(raw);
        } catch {
          return raw;
        }
      } catch (err) {
        // Fall back to memory on unexpected error
        return this.memoryAdapter.get(key);
      }
    }

    return this.memoryAdapter.get(key);
  }

  /**
   * Set cache item with TTL
   */
  async set(key, value, ttlSeconds = 300) {
    if (!key) return false;

    // Always mirror in memory adapter for instantaneous local access
    await this.memoryAdapter.set(key, value, ttlSeconds);

    if (this.isRedisReady && this.redis) {
      try {
        const payload = typeof value === 'string' ? value : JSON.stringify(value);
        if (ttlSeconds > 0) {
          await this.redis.set(key, payload, 'EX', ttlSeconds);
        } else {
          await this.redis.set(key, payload);
        }
        return true;
      } catch (err) {
        return false;
      }
    }

    return true;
  }

  /**
   * Delete specific key
   */
  async del(key) {
    if (!key) return false;

    await this.memoryAdapter.del(key);

    if (this.isRedisReady && this.redis) {
      try {
        await this.redis.del(key);
        return true;
      } catch (err) {
        return false;
      }
    }

    return true;
  }

  /**
   * Invalidate multiple keys by pattern using SCAN (non-blocking)
   * e.g., 'properties:*' or 'location:*'
   */
  async delPattern(pattern) {
    if (!pattern) return 0;

    let totalDeleted = await this.memoryAdapter.delPattern(pattern);

    if (this.isRedisReady && this.redis) {
      try {
        let cursor = '0';
        do {
          const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
          cursor = nextCursor;
          if (keys && keys.length > 0) {
            await this.redis.del(...keys);
            totalDeleted += keys.length;
          }
        } while (cursor !== '0');
      } catch (err) {
        // Non-fatal
      }
    }

    return totalDeleted;
  }

  /**
   * Flush entire cache
   */
  async flush() {
    await this.memoryAdapter.flush();
    if (this.isRedisReady && this.redis) {
      try {
        await this.redis.flushdb();
      } catch {}
    }
    return true;
  }

  /**
   * Atomically fetch from cache or execute fallback compute and store
   */
  async getOrSet(key, computeFn, ttlSeconds = 300) {
    const cached = await this.get(key);
    if (cached !== null && cached !== undefined) {
      return { data: cached, cached: true };
    }

    const freshData = await computeFn();
    if (freshData !== null && freshData !== undefined) {
      await this.set(key, freshData, ttlSeconds);
    }
    return { data: freshData, cached: false };
  }

  /**
   * Diagnostic / Health check representation
   */
  getStatus() {
    return {
      driver: this.activeDriver,
      redisConnected: this.isRedisReady,
      memoryEntriesCount: this.memoryAdapter.size(),
      redisConfigured: Boolean(process.env.REDIS_URL || process.env.REDIS_HOST)
    };
  }
}

const cacheService = new CacheService();

/**
 * Express Route Caching Middleware
 * Automatically caches successful 200 responses for designated TTL
 */
function cacheRoute(ttlSeconds = 60, prefix = 'route') {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip caching if authenticated user context requires private data
    if (res.locals.noCache || req.headers['authorization']) {
      return next();
    }

    const cacheKey = `${prefix}:${req.originalUrl}`;

    try {
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        return res.json(cached);
      }

      res.setHeader('X-Cache', 'MISS');

      // Intercept res.json to capture response
      const originalJson = res.json.bind(res);
      res.json = (body) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          cacheService.set(cacheKey, body, ttlSeconds).catch(() => {});
        }
        return originalJson(body);
      };

      next();
    } catch (err) {
      next();
    }
  };
}

module.exports = {
  cacheService,
  cacheRoute,
  InMemoryAdapter
};
