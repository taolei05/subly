import type { GlobalTheme } from 'naive-ui';
import { darkTheme } from 'naive-ui';
import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

export const useThemeStore = defineStore('theme', () => {
  const isDark = ref(localStorage.getItem('theme') === 'dark');
  const theme = ref<GlobalTheme | null>(isDark.value ? darkTheme : null);

  function toggleTheme(): void {
    isDark.value = !isDark.value;
    theme.value = isDark.value ? darkTheme : null;
    localStorage.setItem('theme', isDark.value ? 'dark' : 'light');
    updateBodyClass();
  }

  function updateBodyClass(): void {
    if (isDark.value) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }

  // 初始化时更新 body class
  updateBodyClass();

  watch(isDark, () => {
    updateBodyClass();
  });

  return {
    isDark,
    theme,
    toggleTheme,
  };
});
