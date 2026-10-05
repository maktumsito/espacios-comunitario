import { defineConfig } from 'vitest/config';
export default defineConfig({test:{include:['scripts/*.bench.ts'],environment:'jsdom',maxWorkers:1,testTimeout:300000,hookTimeout:30000}});
