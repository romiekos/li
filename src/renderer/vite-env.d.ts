/// <reference types="vite/client" />

import type { LiBridge } from '../shared/types';

declare global {
  interface Window {
    li: LiBridge;
  }
}
