<template>
  <div class="toolbar">
    <div class="toolbar-left">
      <n-input
        :value="searchQuery"
        placeholder="搜索订阅..."
        clearable
        style="width: 200px"
        @update:value="$emit('update:searchQuery', $event)"
      >
        <template #prefix>
          <Icon name="search" :size="16" />
        </template>
      </n-input>

      <n-select
        :value="filterType"
        :options="typeOptions"
        placeholder="筛选类型"
        clearable
        style="width: 140px"
        @update:value="$emit('update:filterType', $event)"
      />

      <n-select
        :value="sortBy"
        :options="sortOptions"
        placeholder="排序方式"
        style="width: 140px"
        @update:value="$emit('update:sortBy', $event)"
      />
    </div>

    <div class="toolbar-right">
      <n-button-group>
        <n-button
          :type="viewMode === 'list' ? 'primary' : 'default'"
          @click="$emit('update:viewMode', 'list')"
        >
          <template #icon>
            <Icon name="list" :size="16" />
          </template>
        </n-button>
        <n-button
          :type="viewMode === 'grid' ? 'primary' : 'default'"
          @click="$emit('update:viewMode', 'grid')"
        >
          <template #icon>
            <Icon name="grid" :size="16" />
          </template>
        </n-button>
        <n-button
          :type="viewMode === 'calendar' ? 'primary' : 'default'"
          @click="$emit('update:viewMode', 'calendar')"
        >
          <template #icon>
            <Icon name="calendar" :size="16" />
          </template>
        </n-button>
      </n-button-group>

      <n-button type="primary" :disabled="readonly" @click="$emit('add')">
        <template #icon>
          <Icon name="add" :size="16" />
        </template>
        添加订阅
      </n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { SORT_OPTIONS, TYPE_FILTER_OPTIONS } from '../../constants';
import type { SubscriptionType } from '../../types';
import Icon from '../common/Icon.vue';

defineProps<{
  searchQuery: string;
  filterType: SubscriptionType | null;
  sortBy: string;
  viewMode: 'list' | 'grid' | 'calendar';
  readonly?: boolean;
}>();

defineEmits<{
  'update:searchQuery': [value: string];
  'update:filterType': [value: SubscriptionType | null];
  'update:sortBy': [value: string];
  'update:viewMode': [value: 'list' | 'grid' | 'calendar'];
  add: [];
}>();

const typeOptions = TYPE_FILTER_OPTIONS;
const sortOptions = SORT_OPTIONS;
</script>

<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 24px 0;
  flex-wrap: wrap;
  gap: 16px;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

@media (max-width: 768px) {
  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .toolbar-left,
  .toolbar-right {
    width: 100%;
    justify-content: space-between;
  }

  .toolbar-left {
    flex-wrap: nowrap;
  }

  .toolbar-left .n-input {
    flex: 1;
    min-width: 0;
  }
}
</style>
