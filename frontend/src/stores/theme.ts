import type { GlobalTheme, GlobalThemeOverrides } from 'naive-ui';
import { darkTheme } from 'naive-ui';
import { defineStore } from 'pinia';
import { getColors } from 'theme-colors';
import { computed, ref, watch } from 'vue';

const DEFAULT_PRIMARY_COLOR = '#18a058';

export const useThemeStore = defineStore('theme', () => {
  const isDark = ref(localStorage.getItem('theme') === 'dark');
  const primaryColor = ref(
    localStorage.getItem('primaryColor') || DEFAULT_PRIMARY_COLOR,
  );

  const theme = computed<GlobalTheme | null>(() =>
    isDark.value ? darkTheme : null,
  );

  const themeOverrides = computed<GlobalThemeOverrides>(() => {
    const colors = getColors(primaryColor.value);
    return {
      common: {
        primaryColor: colors[500],
        primaryColorHover: colors[400],
        primaryColorPressed: colors[600],
        primaryColorSuppl: colors[400],
      },
    };
  });

  function toggleTheme(): void {
    isDark.value = !isDark.value;
    localStorage.setItem('theme', isDark.value ? 'dark' : 'light');
    updateBodyClass();
  }

  function setPrimaryColor(color: string): void {
    primaryColor.value = color;
    localStorage.setItem('primaryColor', color);
  }

  function resetPrimaryColor(): void {
    primaryColor.value = DEFAULT_PRIMARY_COLOR;
    localStorage.removeItem('primaryColor');
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
    themeOverrides,
    primaryColor,
    toggleTheme,
    setPrimaryColor,
    resetPrimaryColor,
  };
});
