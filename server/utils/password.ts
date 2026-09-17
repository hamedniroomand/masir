// The names differ from hashPassword and verifyPassword on purpose. Those are
// auto-imported from nuxt-auth-utils and use scrypt. The same names here would
// give the bundler two providers for one identifier, and the choice would be
// silent.

// Bun picks argon2id at m=64MiB, t=2, p=1, which is above the OWASP floor. An
// options object here could only weaken it.
export function hashSecret(plain: string): Promise<string> {
  return Bun.password.hash(plain);
}

// Both arguments are strings, so the wrong order compiles and always fails.
export async function verifySecret(plain: string, hash: string): Promise<boolean> {
  try {
    return await Bun.password.verify(plain, hash);
  }
  catch {
    // verify throws on a hash it cannot read, such as one an older release
    // wrote with another algorithm. That is a failed check, not a server error.
    return false;
  }
}

let decoy: Promise<string> | null = null;

// A sign-in for an unknown address must cost what a real one costs, or the
// response time says which addresses are registered. Always false.
export function matchAbsentSecret(plain: string): Promise<boolean> {
  decoy ??= Bun.password.hash(crypto.randomUUID());
  return decoy.then(hash => verifySecret(plain, hash));
}
