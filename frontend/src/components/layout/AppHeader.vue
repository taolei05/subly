<template>
  <n-layout-header bordered class="header">
    <div class="header-content">
      <div class="header-left">
        <img src="/favicon.svg" alt="Subly" class="logo-icon" />
        <h1 class="logo">Subly</h1>
      </div>
      <div class="header-right">
        <n-select
          :value="currency"
          :options="currencyOptions"
          size="small"
          style="width: 100px"
          @update:value="$emit('update:currency', $event)"
        />
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button quaternary circle @click="$emit('toggle-theme')">
              <template #icon>
                <Icon :name="isDark ? 'sun' : 'moon'" :size="20" />
              </template>
            </n-button>
          </template>
          {{ isDark ? '切换到亮色模式' : '切换到暗色模式' }}
        </n-tooltip>
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button quaternary circle @click="$emit('settings')">
              <template #icon>
                <Icon name="settings" :size="20" />
              </template>
            </n-button>
          </template>
          设置
        </n-tooltip>
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button quaternary circle @click="$emit('logout')">
              <template #icon>
                <Icon name="logout" :size="20" />
              </template>
            </n-button>
          </template>
          退出登录
        </n-tooltip>
      </div>
    </div>
  </n-layout-header>
</template>

<script setup lang="ts">
import { CURRENCY_OPTIONS } from '../../constants';
import type { Currency } from '../../types';
import Icon from '../common/Icon.vue';

defineProps<{
  currency: Currency;
  isDark: boolean;
}>();

defineEmits<{
  'update:currency': [value: Currency];
  'toggle-theme': [];
  settings: [];
  logout: [];
}>();

const currencyOptions = CURRENCY_OPTIONS;
</script>

<style scoped>
.header {
  height: 60px;
  padding: 0 24px;
  display: flex;
  align-items: center;
}

.header-content {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.logo-icon {
  width: 32px;
  height: 32px;
}

.logo {
  font-size: 24px;
  font-weight: 700;
  margin: 0;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

@media (max-width: 768px) {
  .header {
    padding: 0 16px;
  }
}
</style>
