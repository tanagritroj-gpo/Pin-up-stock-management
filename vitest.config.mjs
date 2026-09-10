import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // แต่ละไฟล์เทสต์สร้าง JSDOM ของตัวเองผ่าน test/helpers.mjs
    environment: 'node',
    include: ['test/**/*.test.mjs'],
    testTimeout: 15000,
    hookTimeout: 15000
  }
});
