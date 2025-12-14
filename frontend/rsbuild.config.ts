import { defineConfig } from '@rsbuild/core';
import { pluginVue } from '@rsbuild/plugin-vue';
import { RsdoctorRspackPlugin } from '@rsdoctor/rspack-plugin';

// Docs: https://rsbuild.rs/config/
export default defineConfig({
  plugins: [pluginVue()],
  tools: {
    rspack: {
      plugins: [
        // 仅在 RSDOCTOR 环境变量为 true 时启用
        process.env.RSDOCTOR === 'true' &&
          new RsdoctorRspackPlugin({
            // 插件选项
          }),
      ].filter(Boolean),
    },
  },
  html: {
    template: './public/index.html',
  },
  source: {
    define: {
      __VUE_OPTIONS_API__: true,
      __VUE_PROD_DEVTOOLS__: false,
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
    },
  },
  output: {
    distPath: {
      root: 'dist',
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
});
