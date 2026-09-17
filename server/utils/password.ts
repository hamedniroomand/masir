// Bun.password holds the hashing. It picks argon2id with m=64MiB, t=2, p=1,
// which is above the OWASP floor, so no parameters are given here: an options
// object could only make the hash weaker.
//
// The names differ from hashPassword and verifyPassword on purpose. Those two
// are auto-imported from nuxt-auth-utils and use scrypt. Same names here would
// give the bundler two providers for one identifier and the choice would be
// silent.

export function hashSecret(plain: string): Promise<string> {
  return Bun.password.hash(plain);
}

// The order is (plain, hash), the same as Bun.password.verify. Both are strings,
// so a swap compiles and always fails.
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

// Check against a hash that nobody holds. A missing account then costs the same
// as a real one, so the time a response takes does not say whether an email is
// registered. The result is always false.
export function matchAbsentSecret(plain: string): Promise<boolean> {
  decoy ??= Bun.password.hash(crypto.randomUUID());
  return decoy.then(hash => verifySecret(plain, hash));
}
