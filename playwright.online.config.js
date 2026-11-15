import { defineConfig } from '@playwright/test';
import base from './playwright.config.js';
export default defineConfig({ ...base, testIgnore: [], webServer: { ...base.webServer,
  env: { PORT: '3123', MODE: 'online', PUBLIC_ORIGIN: 'http://127.0.0.1:3123', DATABASE_PATH: ':memory:' } } });
