import { describe, expect, it } from 'vitest';
import { hashSecret, matchAbsentSecret, verifySecret } from '#server/utils/password';

const PLAIN = 'correct horse battery staple';

describe('password hashing', () => {
  // Without this the suite still passes if the code falls back to another
  // algorithm, because every other assertion only checks that a match works.
  it('writes an argon2id hash at the cost bun picks', async () => {
    expect(await hashSecret(PLAIN)).toMatch(/^\$argon2id\$v=19\$m=65536,t=2,p=1\$/);
  });

  it('salts each hash, so two hashes of one password differ', async () => {
    expect(await hashSecret(PLAIN)).not.toBe(await hashSecret(PLAIN));
  });

  it('matches the password it hashed', async () => {
    expect(await verifySecret(PLAIN, await hashSecret(PLAIN))).toBe(true);
  });

  it('refuses a wrong password', async () => {
    expect(await verifySecret('wrong', await hashSecret(PLAIN))).toBe(false);
  });

  // Both arguments are strings, so the wrong order compiles.
  it('refuses the arguments in the wrong order', async () => {
    const hash = await hashSecret(PLAIN);
    expect(await verifySecret(hash, PLAIN)).toBe(false);
  });

  it('refuses a hash from another algorithm instead of throwing', async () => {
    expect(await verifySecret(PLAIN, '$scrypt$n=16384,r=8,p=1$c2FsdA$aGFzaA')).toBe(false);
    expect(await verifySecret(PLAIN, '')).toBe(false);
    expect(await verifySecret(PLAIN, 'not a hash')).toBe(false);
  });
});

describe('absent account check', () => {
  it('always answers false', async () => {
    expect(await matchAbsentSecret(PLAIN)).toBe(false);
  });

  // A sign-in for an unknown address must not answer faster than one for a
  // known address, or the response time says which addresses are registered.
  it('costs about as much as a real check', async () => {
    const hash = await hashSecret(PLAIN);

    const realStart = performance.now();
    await verifySecret('wrong', hash);
    const real = performance.now() - realStart;

    const absentStart = performance.now();
    await matchAbsentSecret('wrong');
    const absent = performance.now() - absentStart;

    expect(absent).toBeGreaterThan(real / 4);
  });
});
