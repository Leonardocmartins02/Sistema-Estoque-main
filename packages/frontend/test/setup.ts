import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

import '@testing-library/jest-dom/vitest';

// `test.globals` fica desligado (importamos describe/it/expect explicitamente),
// então o auto-cleanup do Testing Library — que depende de um `afterEach`
// global — precisa ser registrado manualmente aqui.
afterEach(() => {
  cleanup();
});
