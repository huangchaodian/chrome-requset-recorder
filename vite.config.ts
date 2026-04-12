import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { build } from 'vite';

/**
 * Vite 插件：构建完成后
 * 1. 单独构建 background.js 为 IIFE 格式
 * 2. 复制 manifest.json 并修正路径
 */
function chromeExtensionBuild(): Plugin {
  return {
    name: 'chrome-extension-build',
    async writeBundle() {
      // ① 单独构建 background 为 IIFE（无 import/export）
      await build({
        configFile: false,
        build: {
          outDir: resolve(__dirname, 'dist'),
          emptyOutDir: false,
          lib: {
            entry: resolve(__dirname, 'src/background/index.ts'),
            formats: ['iife'],
            name: 'background',
            fileName: () => 'background.js',
          },
          rollupOptions: {
            output: {
              // IIFE 不需要 entryFileNames
            },
          },
          minify: 'esbuild',
        },
        resolve: {
          alias: {
            '@': resolve(__dirname, 'src'),
            '@shared': resolve(__dirname, 'src/shared'),
          },
        },
      });

      // ② 复制 manifest.json 并修正路径
      const manifest = JSON.parse(
        readFileSync(resolve(__dirname, 'manifest.json'), 'utf-8')
      );

      manifest.background.service_worker = 'background.js';
      manifest.action.default_popup = 'src/popup/index.html';
      manifest.devtools_page = 'src/devtools/devtools.html';
      manifest.options_page = 'src/options/index.html';
      manifest.action.default_icon = {
        '16': 'icons/icon16.svg',
        '32': 'icons/icon32.svg',
        '48': 'icons/icon48.svg',
        '128': 'icons/icon128.svg',
      };
      manifest.icons = {
        '16': 'icons/icon16.svg',
        '32': 'icons/icon32.svg',
        '48': 'icons/icon48.svg',
        '128': 'icons/icon128.svg',
      };

      writeFileSync(
        resolve(__dirname, 'dist/manifest.json'),
        JSON.stringify(manifest, null, 2)
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), chromeExtensionBuild()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      // ★ 仅构建 HTML 入口，background 由插件单独构建
      input: {
        popup: resolve(__dirname, 'src/popup/index.html'),
        devtools: resolve(__dirname, 'src/devtools/devtools.html'),
        devtoolsPanel: resolve(__dirname, 'src/devtools/index.html'),
        options: resolve(__dirname, 'src/options/index.html'),
      },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
});