<template>
  <div ref="containerRef" class="turnstile-container"></div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';

interface TurnstileInstance {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      theme?: 'light' | 'dark' | 'auto';
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
    onTurnstileLoad?: () => void;
  }
}

const props = withDefaults(
  defineProps<{
    siteKey: string;
    theme?: 'light' | 'dark' | 'auto';
  }>(),
  {
    theme: 'auto',
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
const scriptLoaded = ref(false);

function renderWidget() {
  if (!window.turnstile || !containerRef.value || widgetId.value) return;

  widgetId.value = window.turnstile.render(containerRef.value, {
    sitekey: props.siteKey,
    theme: props.theme,
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
  if (document.getElementById('turnstile-script')) {
    if (window.turnstile) {
      renderWidget();
    }
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

defineExpose({ reset });
</script>

<style scoped>
.turnstile-container {
  min-height: 65px;
}
</style>
