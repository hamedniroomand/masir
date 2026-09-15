import { Hash } from '@adonisjs/hash';
import { Scrypt } from '@adonisjs/hash/drivers/scrypt';

const hasher = new Hash(new Scrypt({}));

export async function hashPassword(password: string) {
  return hasher.make(password);
}

export async function verifyPassword(hashedPassword: string, plainPassword: string) {
  return hasher.verify(hashedPassword, plainPassword);
}
