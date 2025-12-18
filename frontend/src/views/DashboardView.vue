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

      <!-- 统计图表 -->
      <SubscriptionCharts v-if="subscriptionStore.subscriptions.length > 0" />

      <!-- 到期倒计时 -->
      <ExpiringSection
        v-if="expiringIn7Days.length > 0"
        :subscriptions="expiringIn7Days"
      />

      <!-- 工具栏 -->
      <AppToolbar
        :search-query="searchQuery"
        :filter-type="filterType"
        :sort-by="sortBy"
        :view-mode="viewMode"
        :readonly="authStore.isDemo"
        @update:search-query="searchQuery = $event"
        @update:filter-type="updateFilterType"
        @update:sort-by="updateSortBy"
        @update:view-mode="updateViewMode"
        @add="showAddModal = true"
      />

      <!-- 批量操作工具栏 -->
      <BatchToolbar
        v-if="selectedIds.length > 0 && !authStore.isDemo"
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
          :selectable="!authStore.isDemo"
          :subscriptions="filteredSubscriptions"
          :readonly="authStore.isDemo"
          @edit="handleEdit"
          @delete="handleDelete"
          @toggle-status="handleToggleStatus"
        />

        <SubscriptionGrid
          v-else-if="viewMode === 'grid'"
          :subscriptions="filteredSubscriptions"
          :readonly="authStore.isDemo"
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
      :readonly="authStore.isDemo"
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
import SubscriptionCharts from '../components/subscription/SubscriptionCharts.vue';
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
import { daysFromToday } from '../utils';

const router = useRouter();
const message = useMessage();
const dialog = useDialog();
const themeStore = useThemeStore();
const authStore = useAuthStore();
const subscriptionStore = useSubscriptionStore();

const searchQuery = ref('');

// 从 localStorage 读取用户偏好设置
const savedFilterType = localStorage.getItem('filterType');
const savedSortBy = localStorage.getItem('sortBy');
const savedViewMode = localStorage.getItem('viewMode');

const filterType = ref<SubscriptionType | null>(
  savedFilterType &&
    ['domain', 'server', 'membership', 'software', 'other'].includes(
      savedFilterType,
    )
    ? (savedFilterType as SubscriptionType)
    : null,
);
const sortBy = ref(
  savedSortBy && ['end_date', 'price', 'name'].includes(savedSortBy)
    ? savedSortBy
    : 'end_date',
);
const viewMode = ref<'list' | 'grid' | 'calendar'>(
  savedViewMode && ['list', 'grid', 'calendar'].includes(savedViewMode)
    ? (savedViewMode as 'list' | 'grid' | 'calendar')
    : 'list',
);

// 监听变化并保存到 localStorage
function updateFilterType(value: SubscriptionType | null) {
  filterType.value = value;
  if (value) {
    localStorage.setItem('filterType', value);
  } else {
    localStorage.removeItem('filterType');
  }
}

function updateSortBy(value: string) {
  sortBy.value = value;
  localStorage.setItem('sortBy', value);
}

function updateViewMode(value: 'list' | 'grid' | 'calendar') {
  viewMode.value = value;
  localStorage.setItem('viewMode', value);
}

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

async function handleFormSubmit(
  data: SubscriptionFormData,
  pendingFiles: File[],
) {
  if (editingSubscription.value) {
    const result = await subscriptionStore.updateSubscription(
      editingSubscription.value.id,
      data,
    );
    if (result.success) {
      message.success('更新成功');
      handleFormClose();
    } else {
      message.error(result.message || '操作失败');
    }
  } else {
    const result = await subscriptionStore.createSubscription(data);
    if (result.success) {
      message.success('添加成功');
      // 如果有待上传的附件，上传它们
      const newSubscription = result.data as Subscription | undefined;
      if (pendingFiles.length > 0 && newSubscription?.id) {
        const { attachmentApi } = await import('../api/attachment');
        let uploadFailed = false;
        for (const file of pendingFiles) {
          try {
            await attachmentApi.upload(newSubscription.id, file);
          } catch {
            uploadFailed = true;
          }
        }
        if (uploadFailed) {
          message.warning('部分附件上传失败');
        }
      }
      handleFormClose();
    } else {
      message.error(result.message || '操作失败');
    }
  }
}

function handleFormClose() {
  showAddModal.value = false;
  editingSubscription.value = null;
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
