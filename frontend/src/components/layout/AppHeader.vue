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
        <n-popover trigger="click" placement="bottom">
          <template #trigger>
            <n-tooltip trigger="hover">
              <template #trigger>
                <n-button quaternary circle>
                  <template #icon>
                    <div
                      class="color-indicator"
                      :style="{ backgroundColor: themeStore.primaryColor }"
                    />
                  </template>
                </n-button>
              </template>
              主题色
            </n-tooltip>
          </template>
          <div style="padding: 8px;">
            <div style="margin-bottom: 8px; font-size: 14px; font-weight: 500;">主题色</div>
            <n-color-picker
              :value="themeStore.primaryColor"
              :show-alpha="false"
              :modes="['hex']"
              :swatches="colorSwatches"
              @update:value="themeStore.setPrimaryColor"
            />
            <n-button
              size="small"
              quaternary
              style="margin-top: 8px; width: 100%;"
              @click="themeStore.resetPrimaryColor"
            >
              恢复默认
            </n-button>
          </div>
        </n-popover>
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
import { useThemeStore } from '../../stores/theme';
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

const themeStore = useThemeStore();
const currencyOptions = CURRENCY_OPTIONS;

const colorSwatches = [
  '#18a058', // 默认绿色
  '#2080f0', // 蓝色
  '#f0a020', // 橙色
  '#d03050', // 红色
  '#8a2be2', // 紫色
  '#00ced1', // 青色
  '#ff6b6b', // 珊瑚红
  '#4ecdc4', // 薄荷绿
];
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
  flex-shrink: 0;
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

.color-indicator {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid rgba(128, 128, 128, 0.3);
}

@media (max-width: 768px) {
  .header {
    padding: 0 12px;
    height: 56px;
  }

  .logo-icon {
    width: 28px;
    height: 28px;
  }

  .logo {
    font-size: 20px;
  }

  .header-right {
    gap: 2px;
  }

  .header-right :deep(.n-select) {
    width: 80px !important;
  }

  .header-right :deep(.n-button) {
    padding: 0 6px;
  }
}

@media (max-width: 480px) {
  .header {
    padding: 0 8px;
  }

  .logo {
    display: none;
  }

  .header-right {
    gap: 0;
  }

  .header-right :deep(.n-select) {
    width: 70px !important;
  }
}
</style>
