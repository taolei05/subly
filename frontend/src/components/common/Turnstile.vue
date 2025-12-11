<template>
  <div ref="containerRef" class="turnstile-container"></div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useThemeStore } from '../../stores/theme';

interface TurnstileInstance {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      theme?: 'light' | 'dark' | 'auto';
      size?: 'normal' | 'flexible' | 'compact';
      appearance?: 'always' | 'execute' | 'interaction-only';
      callback?: (token: string) => void;
      'expired-callback'?: () => void;
      'error-callback'?: () => void;
    },
  ) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileInstance;
  }
}

const themeStore = useThemeStore();

const props = withDefaults(
  defineProps<{
    siteKey: string;
    appearance?: 'always' | 'execute' | 'interaction-only';
  }>(),
  {
    appearance: 'always',
  },
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'verify', token: string): void;
  (e: 'expire'): void;
  (e: 'error'): void;
}>();

const containerRef = ref<HTMLElement | null>(null);
const widgetId = ref<string | null>(null);

function renderWidget() {
  if (!window.turnstile || !containerRef.value || widgetId.value) {
    return;
  }

  try {
    const theme = themeStore.isDark ? 'dark' : 'light';
    widgetId.value = window.turnstile.render(containerRef.value, {
      sitekey: props.siteKey,
      theme,
      size: 'flexible',
      appearance: props.appearance,
      callback: (token: string) => {
        emit('update:modelValue', token);
        emit('verify', token);
      },
      'expired-callback': () => {
        emit('update:modelValue', '');
        emit('expire');
      },
      'error-callback': () => {
        emit('update:modelValue', '');
        emit('error');
      },
    });
  } catch (e) {
    console.error('Turnstile render error:', e);
  }
}

function removeWidget() {
  if (window.turnstile && widgetId.value) {
    try {
      window.turnstile.remove(widgetId.value);
    } catch (e) {
      // ignore
    }
    widgetId.value = null;
  }
}

function reset() {
  if (window.turnstile && widgetId.value) {
    window.turnstile.reset(widgetId.value);
    emit('update:modelValue', '');
  }
}

function initTurnstile() {
  if (window.turnstile) {
    nextTick(() => renderWidget());
    return;
  }

  // 检查脚本是否已存在
  const existingScript = document.getElementById('cf-turnstile-script');
  if (existingScript) {
    // 等待脚本加载完成
    const checkReady = setInterval(() => {
      if (window.turnstile) {
        clearInterval(checkReady);
        nextTick(() => renderWidget());
      }
    }, 50);
    setTimeout(() => clearInterval(checkReady), 10000);
    return;
  }

  // 加载脚本
  const script = document.createElement('script');
  script.id = 'cf-turnstile-script';
  script.src =
    'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  script.async = true;
  script.onload = () => {
    nextTick(() => renderWidget());
  };
  document.head.appendChild(script);
}

onMounted(() => {
  initTurnstile();
});

onUnmounted(() => {
  removeWidget();
});

// 监听主题变化
watch(
  () => themeStore.isDark,
  () => {
    removeWidget();
    nextTick(() => renderWidget());
  },
);

defineExpose({ reset });
</script>

<style scoped>
.turnstile-container {
  width: 100%;
  min-height: 65px;
}
</style>
