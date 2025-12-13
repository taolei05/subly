<template>
  <n-config-provider :theme="themeStore.theme" :theme-overrides="themeStore.themeOverrides" :locale="zhCN" :date-locale="dateZhCN">
    <n-message-provider>
      <n-notification-provider>
        <n-dialog-provider>
          <n-loading-bar-provider>
            <router-view />
          </n-loading-bar-provider>
        </n-dialog-provider>
      </n-notification-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { dateZhCN, zhCN } from 'naive-ui';
import { useThemeStore } from './stores/theme';

const themeStore = useThemeStore();
// themeStore 用于模板中的 themeStore.theme
</script>

<style>
/* 全局样式已在 index.css 中定义 */
</style>
