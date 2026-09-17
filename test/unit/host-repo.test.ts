import { describe, expect, it, vi } from 'vitest';

const stub = vi.hoisted(() => ({ upserts: 0, nextId: 0 }));

vi.mock('#server/utils/db', () => ({
  getDb: async () => ({
    insert: () => ({
      values: () => ({
        onConflictDoUpdate: () => ({
          returning: async () => {
            stub.upserts++;
            stub.nextId++;
            return [{ id: stub.nextId }];
          },
        }),
      }),
    }),
  }),
}));

const { HOST_CACHE_MAX, hostId } = await import('#server/utils/host-repo');

describe('hostId', () => {
  // One test, because the cache is module state and no reset leaves the
  // production module with a test-only export.
  it('reads the database once for each host until the cache is full', async () => {
    const first = await hostId('example.com');
    expect(stub.upserts).toBe(1);

    expect(await hostId('example.com')).toBe(first);
    expect(stub.upserts).toBe(1);

    for (let i = 1; i < HOST_CACHE_MAX; i++)
      await hostId(`host-${i}.example`);
    expect(stub.upserts).toBe(HOST_CACHE_MAX);

    // The cache is full. This host clears it and takes the only slot.
    await hostId('overflow.example');
    expect(stub.upserts).toBe(HOST_CACHE_MAX + 1);

    await hostId('example.com');
    expect(stub.upserts).toBe(HOST_CACHE_MAX + 2);
  });
});
