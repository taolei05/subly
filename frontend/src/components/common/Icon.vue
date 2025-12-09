<template>
  <n-icon :size="size" :color="color">
    <component :is="iconComponent" />
  </n-icon>
</template>

<script setup lang="ts">
import {
  AddOutline,
  CalendarOutline,
  CashOutline,
  CheckmarkOutline,
  CreateOutline,
  GridOutline,
  InformationCircleOutline,
  LayersOutline,
  ListOutline,
  LogOutOutline,
  MoonOutline,
  SearchOutline,
  SettingsOutline,
  SunnyOutline,
  TimeOutline,
  TrashOutline,
  WarningOutline,
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
  add: AddOutline,
  calendar: CalendarOutline,
  check: CheckmarkOutline,
  clock: TimeOutline,
  delete: TrashOutline,
  edit: CreateOutline,
  grid: GridOutline,
  info: InformationCircleOutline,
  list: ListOutline,
  logout: LogOutOutline,
  money: CashOutline,
  moon: MoonOutline,
  search: SearchOutline,
  settings: SettingsOutline,
  subscription: LayersOutline,
  sun: SunnyOutline,
  warning: WarningOutline,
};

const iconComponent = computed(() => iconMap[props.name] || null);
</script>
