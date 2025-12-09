<template>
  <n-layout class="page-container">
    <AppHeader
      :currency="subscriptionStore.selectedCurrency"
      :is-dark="themeStore.isDark"
      @update:currency="subscriptionStore.setSelectedCurrency"
      @toggle-theme="themeStore.toggleTheme"
      @settings="goToSettings"
      @logout="handleLogout"
    />

    <n-layout-content class="content-wrapper">
      <!-- 统计卡片 -->
      <StatsCards
        :stats="subscriptionStore.stats"
        :currency="subscriptionStore.selectedCurrency"
      />

      <!-- 到期倒计时 -->
      <ExpiringSection
        v-if="expiringIn7Days.length > 0"
        :subscriptions="expiringIn7Days"
      />

      <!-- 工具栏 -->
      <AppToolbar
        v-model:search-query="searchQuery"
        v-model:filter-type="filterType"
        v-model:sort-by="sortBy"
        v-model:view-mode="viewMode"
        @import-export="handleImportExport"
        @add="showAddModal = true"
      />

      <!-- 批量操作工具栏 -->
      <BatchToolbar
        v-if="selectedIds.length > 0"
        :selected-count="selectedIds.length"
        @cancel="selectedIds = []"
        @update-remind="showBatchRemindModal = true"
        @delete="handleBatchDelete"
      />

      <!-- 订阅列表/卡片 -->
      <div v-if="subscriptionStore.loading" class="loading-container">
        <n-spin size="large" />
      </div>

      <template v-else>
        <SubscriptionList
          v-if="viewMode === 'list'"
          v-model:selected-ids="selectedIds"
          :selectable="true"
          :subscriptions="filteredSubscriptions"
          @edit="handleEdit"
          @delete="handleDelete"
          @toggle-status="handleToggleStatus"
        />

        <SubscriptionGrid
          v-else-if="viewMode === 'grid'"
          :subscriptions="filteredSubscriptions"
          @edit="handleEdit"
          @delete="handleDelete"
          @toggle-status="handleToggleStatus"
        />

        <SubscriptionCalendar
          v-else-if="viewMode === 'calendar'"
          :subscriptions="filteredSubscriptions"
          @edit="handleEdit"
        />
      </template>
    </n-layout-content>

    <!-- 添加/编辑订阅模态框 -->
    <SubscriptionForm
      v-model:show="showAddModal"
      :subscription="editingSubscription"
      @submit="handleFormSubmit"
      @close="handleFormClose"
    />

    <!-- 批量修改提醒天数模态框 -->
    <n-modal
      v-model:show="showBatchRemindModal"
      preset="dialog"
      title="批量修改提醒天数"
    >
      <n-input-number
        v-model:value="batchRemindDays"
        :min="1"
        :max="365"
        style="width: 100%"
      />
      <template #action>
        <n-button @click="showBatchRemindModal = false">取消</n-button>
        <n-button type="primary" @click="handleBatchUpdateRemindDays">
          确定
        </n-button>
      </template>
    </n-modal>
  </n-layout>
</template>

<script setup lang="ts">
import { useDialog, useMessage } from 'naive-ui';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { subscriptionApi } from '../api/subscription';
import AppHeader from '../components/layout/AppHeader.vue';
import AppToolbar from '../components/layout/AppToolbar.vue';
import BatchToolbar from '../components/subscription/BatchToolbar.vue';
import ExpiringSection from '../components/subscription/ExpiringSection.vue';
import StatsCards from '../components/subscription/StatsCards.vue';
import SubscriptionCalendar from '../components/subscription/SubscriptionCalendar.vue';
import SubscriptionForm from '../components/subscription/SubscriptionForm.vue';
import SubscriptionGrid from '../components/subscription/SubscriptionGrid.vue';
import SubscriptionList from '../components/subscription/SubscriptionList.vue';
import { useAuthStore } from '../stores/auth';
import { useSubscriptionStore } from '../stores/subscription';
import { useThemeStore } from '../stores/theme';
import type {
  Subscription,
  SubscriptionFormData,
  SubscriptionType,
} from '../types';
import { daysFromToday, parseCSV } from '../utils';

const router = useRouter();
const message = useMessage();
const dialog = useDialog();
const themeStore = useThemeStore();
const authStore = useAuthStore();
const subscriptionStore = useSubscriptionStore();

const searchQuery = ref('');
const filterType = ref<SubscriptionType | null>(null);
const sortBy = ref('end_date');
const viewMode = ref<'list' | 'grid' | 'calendar'>('list');
const showAddModal = ref(false);
const editingSubscription = ref<Subscription | null>(null);
const selectedIds = ref<number[]>([]);
const showBatchRemindModal = ref(false);
const batchRemindDays = ref(7);

// 计算7天内到期的订阅
const expiringIn7Days = computed(() => {
  return subscriptionStore.subscriptions
    .filter((sub) => sub.status === 'active' && !sub.one_time)
    .map((sub) => ({
      ...sub,
      daysLeft: daysFromToday(sub.end_date),
    }))
    .filter((sub) => sub.daysLeft <= 7)
    .sort((a, b) => a.daysLeft - b.daysLeft);
});

const filteredSubscriptions = computed(() => {
  let result = [...subscriptionStore.subscriptions];

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(
      (sub) =>
        sub.name.toLowerCase().includes(query) ||
        sub.notes?.toLowerCase().includes(query),
    );
  }

  if (filterType.value) {
    result = result.filter((sub) => sub.type === filterType.value);
  }

  result.sort((a, b) => {
    switch (sortBy.value) {
      case 'end_date':
        return new Date(a.end_date).getTime() - new Date(b.end_date).getTime();
      case 'price':
        return b.price - a.price;
      case 'name':
        return a.name.localeCompare(b.name);
      default:
        return 0;
    }
  });

  return result;
});

onMounted(async () => {
  await subscriptionStore.fetchSubscriptions();
  await subscriptionStore.fetchExchangeRates();
});

function goToSettings() {
  router.push('/settings');
}

async function handleLogout() {
  await authStore.logout();
  message.success('已退出登录');
  router.push('/login');
}

function handleEdit(subscription: Subscription) {
  editingSubscription.value = subscription;
  showAddModal.value = true;
}

async function handleDelete(subscription: Subscription) {
  const result = await subscriptionStore.deleteSubscription(subscription.id);
  if (result.success) {
    message.success('删除成功');
  } else {
    message.error(result.message || '删除失败');
  }
}

async function handleToggleStatus(subscription: Subscription) {
  const result = await subscriptionStore.toggleStatus(subscription.id);
  if (result.success) {
    message.success('状态已更新');
  } else {
    message.error(result.message || '更新失败');
  }
}

async function handleFormSubmit(data: SubscriptionFormData) {
  let result: { success: boolean; message?: string };
  if (editingSubscription.value) {
    result = await subscriptionStore.updateSubscription(
      editingSubscription.value.id,
      data,
    );
    if (result.success) {
      message.success('更新成功');
    }
  } else {
    result = await subscriptionStore.createSubscription(data);
    if (result.success) {
      message.success('添加成功');
    }
  }

  if (!result.success) {
    message.error(result.message || '操作失败');
  } else {
    handleFormClose();
  }
}

function handleFormClose() {
  showAddModal.value = false;
  editingSubscription.value = null;
}

async function handleImportExport(key: string) {
  if (key === 'export-json' || key === 'export-csv') {
    const format = key === 'export-json' ? 'json' : 'csv';
    const token = localStorage.getItem('token');
    const url = `${subscriptionApi.exportData(format)}&token=${token}`;
    window.open(url, '_blank');
  } else if (key === 'import') {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.csv';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = file.name.endsWith('.json')
          ? JSON.parse(text)
          : parseCSV(text);

        const result = await subscriptionApi.importData(data);
        if (result.success) {
          message.success(result.message || '导入成功');
          await subscriptionStore.fetchSubscriptions();
        } else {
          message.error(result.message || '导入失败');
        }
      } catch {
        message.error('文件解析失败，请检查格式');
      }
    };
    input.click();
  }
}

function handleBatchDelete() {
  dialog.warning({
    title: '确认删除',
    content: `确定要删除选中的 ${selectedIds.value.length} 个订阅吗？此操作不可恢复。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        const result = await subscriptionApi.batchDelete(selectedIds.value);
        if (result.success) {
          message.success(result.message || '删除成功');
          selectedIds.value = [];
          await subscriptionStore.fetchSubscriptions();
        } else {
          message.error(result.message || '删除失败');
        }
      } catch {
        message.error('删除失败');
      }
    },
  });
}

async function handleBatchUpdateRemindDays() {
  try {
    const result = await subscriptionApi.batchUpdateRemindDays(
      selectedIds.value,
      batchRemindDays.value,
    );
    if (result.success) {
      message.success(result.message || '修改成功');
      selectedIds.value = [];
      showBatchRemindModal.value = false;
      await subscriptionStore.fetchSubscriptions();
    } else {
      message.error(result.message || '修改失败');
    }
  } catch {
    message.error('修改失败');
  }
}
</script>

<style scoped>
.page-container {
  min-height: 100vh;
  background-color: var(--bg-color);
}

.content-wrapper {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}

.loading-container {
  display: flex;
  justify-content: center;
  padding: 60px 0;
}

@media (max-width: 768px) {
  .content-wrapper {
    padding: 16px;
  }
}
</style>
