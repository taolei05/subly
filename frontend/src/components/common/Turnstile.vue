<template>
  <div ref="containerRef" class="turnstile-container"></div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
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

const themeStore = useThemeStore();

declare global {
  interface Window {
    turnstile?: TurnstileInstance;
    onTurnstileLoad?: () => void;
  }
}

const props = withDefaults(
  defineProps<{
    siteKey: string;
    appearance?: 'always' | 'execute' | 'interaction-only';
  }>(),
  {
    appearance: 'interaction-only',
  },
);

// 根据 naive-ui 主题自动设置 Turnstile 主题
const turnstileTheme = computed(() => (themeStore.isDark ? 'dark' : 'light'));

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'verify', token: string): void;
  (e: 'expire'): void;
  (e: 'error'): void;
}>();

const containerRef = ref<HTMLElement | null>(null);
const widgetId = ref<string | null>(null);
const scriptLoaded = ref(false);

function renderWidget() {
  if (!window.turnstile || !containerRef.value || widgetId.value) return;

  widgetId.value = window.turnstile.render(containerRef.value, {
    sitekey: props.siteKey,
    theme: turnstileTheme.value,
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
}

function loadScript() {
  // 如果脚本已加载且 turnstile 可用，直接渲染
  if (window.turnstile) {
    renderWidget();
    return;
  }

  // 如果脚本标签已存在，等待加载完成
  if (document.getElementById('turnstile-script')) {
    const checkInterval = setInterval(() => {
      if (window.turnstile) {
        clearInterval(checkInterval);
        renderWidget();
      }
    }, 100);
    return;
  }

  window.onTurnstileLoad = () => {
    scriptLoaded.value = true;
    renderWidget();
  };

  const script = document.createElement('script');
  script.id = 'turnstile-script';
  script.src =
    'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad';
  script.async = true;
  script.defer = true;
  document.head.appendChild(script);
}

function reset() {
  if (window.turnstile && widgetId.value) {
    window.turnstile.reset(widgetId.value);
    emit('update:modelValue', '');
  }
}

onMounted(() => {
  loadScript();
});

onUnmounted(() => {
  if (window.turnstile && widgetId.value) {
    window.turnstile.remove(widgetId.value);
  }
});

watch(
  () => props.siteKey,
  () => {
    if (window.turnstile && widgetId.value) {
      window.turnstile.remove(widgetId.value);
      widgetId.value = null;
      renderWidget();
    }
  },
);

// 监听主题变化，重新渲染组件
watch(
  () => themeStore.isDark,
  () => {
    if (window.turnstile && widgetId.value) {
      window.turnstile.remove(widgetId.value);
      widgetId.value = null;
      renderWidget();
    }
  },
);

defineExpose({ reset });
</script>

<style scoped>
.turnstile-container {
  width: 100%;
}

.turnstile-container :deep(iframe) {
  width: 100% !important;
}
</style>
