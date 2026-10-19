import pino from 'pino';

import { env } from './env';

export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      'body.password',
      // Segredo de webhook: em claro só na resposta de criação/rotação, e
      // cifrado no banco — nenhum dos dois pode ir para log.
      'secret',
      '*.secret',
      'secretCiphertext',
      '*.secretCiphertext',
    ],
    censor: '[redacted]',
  },
});
