<template>
  <div class="batch-toolbar">
    <span>已选择 {{ selectedCount }} 项</span>
    <n-button size="small" @click="$emit('cancel')">取消选择</n-button>
    <n-button size="small" type="warning" @click="$emit('update-remind')">
      修改提醒天数
    </n-button>
    <n-button size="small" type="error" @click="$emit('delete')">
      批量删除
    </n-button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  selectedCount: number;
}>();

defineEmits<{
  cancel: [];
  'update-remind': [];
  delete: [];
}>();
</script>

<style scoped>
.batch-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--n-color);
  border-radius: 8px;
  margin-bottom: 16px;
  border: 1px solid var(--n-border-color);
}
</style>
