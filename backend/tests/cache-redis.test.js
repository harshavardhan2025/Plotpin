/**
 * Redis & Cache Architecture Test Suite
 * Tests cacheService functionality, in-memory fallback, TTL invalidation,
 * pattern matching, and route caching middleware.
 */

const assert = require('assert');
const { cacheService, cacheRoute, InMemoryAdapter } = require('../src/services/cacheService');

let passedTests = 0;
let failedTests = 0;

function it(description, fn) {
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      return result
        .then(() => {
          console.log(`  ✅ ${description}`);
          passedTests++;
        })
        .catch((err) => {
          console.error(`  ❌ ${description}`);
          console.error(`     Error: ${err.message}`);
          failedTests++;
        });
    }
    console.log(`  ✅ ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ ${description}`);
    console.error(`     Error: ${err.message}`);
    failedTests++;
  }
}

async function runTestSuite() {
  console.log('====================================================');
  console.log('⚡ PLOTPIN REDIS & CACHE SERVICE TEST SUITE');
  console.log('====================================================\n');

  console.log('Test Group 1: Basic Cache Operations');
  await it('should set and get a value with TTL', async () => {
    await cacheService.set('test:key1', { name: 'Penthouse', price: 50000000 }, 10);
    const result = await cacheService.get('test:key1');
    assert.strictEqual(result.name, 'Penthouse');
    assert.strictEqual(result.price, 50000000);
  });

  await it('should return null for non-existent keys', async () => {
    const result = await cacheService.get('test:does_not_exist_xyz');
    assert.strictEqual(result, null);
  });

  await it('should delete a single key', async () => {
    await cacheService.set('test:key2', 'temporary_value', 10);
    assert.strictEqual(await cacheService.get('test:key2'), 'temporary_value');
    await cacheService.del('test:key2');
    assert.strictEqual(await cacheService.get('test:key2'), null);
  });

  console.log('\nTest Group 2: Wildcard Pattern Invalidation');
  await it('should delete matching keys when invalidating pattern (e.g. properties:*)', async () => {
    await cacheService.set('properties:search:1', { items: [1, 2] }, 60);
    await cacheService.set('properties:search:2', { items: [3, 4] }, 60);
    await cacheService.set('properties:nearby:blr', { items: [5] }, 60);
    await cacheService.set('location:search:whitefield', { lat: 12.96 }, 60);

    const deleted = await cacheService.delPattern('properties:*');
    assert.ok(deleted >= 3, `Expected at least 3 deleted keys, got ${deleted}`);

    assert.strictEqual(await cacheService.get('properties:search:1'), null);
    assert.strictEqual(await cacheService.get('properties:search:2'), null);
    assert.strictEqual(await cacheService.get('properties:nearby:blr'), null);
    // Other prefixes must remain untouched
    const locationVal = await cacheService.get('location:search:whitefield');
    assert.ok(locationVal !== null, 'location:search:whitefield should not have been deleted');
    assert.strictEqual(locationVal.lat, 12.96);
  });

  console.log('\nTest Group 3: Atomic getOrSet Helper');
  await it('should compute and cache on cache miss, and return cached on hit', async () => {
    let computeCount = 0;
    const computeFn = async () => {
      computeCount++;
      return { kpi: 'total_revenue', value: 1250000 };
    };

    // First call (miss)
    const call1 = await cacheService.getOrSet('metrics:kpi1', computeFn, 60);
    assert.strictEqual(call1.cached, false);
    assert.strictEqual(call1.data.value, 1250000);
    assert.strictEqual(computeCount, 1);

    // Second call (hit)
    const call2 = await cacheService.getOrSet('metrics:kpi1', computeFn, 60);
    assert.strictEqual(call2.cached, true);
    assert.strictEqual(call2.data.value, 1250000);
    assert.strictEqual(computeCount, 1); // Computation function not called again
  });

  console.log('\nTest Group 4: In-Memory Adapter TTL Expiration');
  await it('should expire keys naturally when TTL elapses', async () => {
    const adapter = new InMemoryAdapter();
    // Set with 1 millisecond TTL by setting expiresAt manually
    adapter.store.set('expired:key', { value: 'stale', expiresAt: Date.now() - 100 });
    const result = await adapter.get('expired:key');
    assert.strictEqual(result, null);
  });

  console.log('\nTest Group 5: Cache Status & Health Diagnostics');
  await it('should provide status report without throwing', () => {
    const status = cacheService.getStatus();
    assert.ok(typeof status.driver === 'string');
    assert.ok(typeof status.redisConnected === 'boolean');
    assert.ok(typeof status.memoryEntriesCount === 'number');
    assert.ok(typeof status.redisConfigured === 'boolean');
  });

  console.log('\n====================================================');
  console.log(`📊 RESULTS: ${passedTests} PASSED | ${failedTests} FAILED`);
  console.log('====================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Test run failed fatal:', err);
  process.exit(1);
});
