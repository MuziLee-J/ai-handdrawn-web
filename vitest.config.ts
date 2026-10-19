import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
    restoreMocks: true,
    // Windows + 多核环境下默认线程池会启动过多 worker，导致测试启动挂起。
    // 使用单 fork 可稳定运行，也便于定位原生模块问题。
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    fileParallelism: false,
  },
});
