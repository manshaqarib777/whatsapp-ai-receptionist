import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Tests must be independent and order-agnostic (.claude/TESTING_RULES.md).
afterEach(() => {
  cleanup();
});
