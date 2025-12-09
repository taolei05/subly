<template>
  <n-icon :size="size" :color="color">
    <component :is="iconComponent" />
  </n-icon>
</template>

<script setup lang="ts">
import {
  Add,
  Calendar,
  Cash,
  Checkmark,
  Create,
  Grid,
  InformationCircle,
  Layers,
  List,
  LogOut,
  Moon,
  Search,
  Settings,
  Sunny,
  Time,
  Trash,
  Warning,
} from '@vicons/ionicons5';
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    name: string;
    size?: number | string;
    color?: string;
  }>(),
  {
    size: 20,
  },
);

const iconMap: Record<string, unknown> = {
  add: Add,
  calendar: Calendar,
  check: Checkmark,
  clock: Time,
  delete: Trash,
  edit: Create,
  grid: Grid,
  info: InformationCircle,
  list: List,
  logout: LogOut,
  money: Cash,
  moon: Moon,
  search: Search,
  settings: Settings,
  subscription: Layers,
  sun: Sunny,
  warning: Warning,
};

const iconComponent = computed(() => iconMap[props.name] || null);
</script>
