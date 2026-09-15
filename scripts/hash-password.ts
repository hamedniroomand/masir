import { Hash } from '@adonisjs/hash';
import { Scrypt } from '@adonisjs/hash/drivers/scrypt';

const hasher = new Hash(new Scrypt({}));

export function hashPassword(plain: string) {
  return hasher.make(plain);
}
