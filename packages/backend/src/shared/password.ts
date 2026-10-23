import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

/** Hash descartável (custo igual ao real) usado para equalizar o tempo de login. */
export const DUMMY_PASSWORD_HASH = bcrypt.hashSync('senha-descartavel-nao-usada', SALT_ROUNDS);

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
