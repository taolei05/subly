<template>
  <n-layout class="page-container">
    <n-layout-header bordered class="header">
      <div class="header-content">
        <div class="header-left">
          <img src="/favicon.svg" alt="Subly" class="logo-icon" />
          <h1 class="logo">Subly</h1>
        </div>
        <div class="header-right">
          <n-select
            v-model:value="subscriptionStore.selectedCurrency"
            :options="currencyOptions"
            size="small"
            style="width: 100px;"
          />
          <n-tooltip trigger="hover">
            <template #trigger>
              <n-button quaternary circle @click="themeStore.toggleTheme">
                <template #icon>
                  <n-icon size="20">
                    <SunIcon v-if="themeStore.isDark" />
                    <MoonIcon v-else />
                  </n-icon>
                </template>
              </n-button>
            </template>
            {{ themeStore.isDark ? '切换到亮色模式' : '切换到暗色模式' }}
          </n-tooltip>
          <n-tooltip trigger="hover">
            <template #trigger>
              <n-button quaternary circle @click="goToSettings">
                <template #icon>
                  <n-icon size="20">
                    <SettingsIcon />
                  </n-icon>
                </template>
              </n-button>
            </template>
            设置
          </n-tooltip>
          <n-tooltip trigger="hover">
            <template #trigger>
              <n-button quaternary circle @click="handleLogout">
                <template #icon>
                  <n-icon size="20">
                    <LogoutIcon />
                  </n-icon>
                </template>
              </n-button>
            </template>
            退出登录
          </n-tooltip>
        </div>
      </div>
    </n-layout-header>
    
    <n-layout-content class="content-wrapper">
      <!-- 统计卡片 -->
      <StatsCards 
        :stats="subscriptionStore.stats"
        :currency="subscriptionStore.selectedCurrency"
      />
      
      <!-- 工具栏 -->
      <div class="toolbar">
        <div class="toolbar-left">
          <n-input 
            v-model:value="searchQuery" 
            placeholder="搜索订阅..."
            clearable
            style="width: 200px;"
          >
            <template #prefix>
              <n-icon><SearchIcon /></n-icon>
            </template>
          </n-input>
          
          <n-select
            v-model:value="filterType"
            :options="typeOptions"
            placeholder="筛选类型"
            clearable
            style="width: 140px;"
          />
          
          <n-select
            v-model:value="sortBy"
            :options="sortOptions"
            placeholder="排序方式"
            style="width: 140px;"
          />
        </div>
        
        <div class="toolbar-right">
          <n-dropdown :options="importExportOptions" @select="handleImportExport">
            <n-button secondary>
              导入/导出
            </n-button>
          </n-dropdown>
          
          <n-button-group>
            <n-button 
              :type="viewMode === 'list' ? 'primary' : 'default'"
              @click="viewMode = 'list'"
            >
              <template #icon>
                <n-icon><ListIcon /></n-icon>
              </template>
            </n-button>
            <n-button 
              :type="viewMode === 'grid' ? 'primary' : 'default'"
              @click="viewMode = 'grid'"
            >
              <template #icon>
                <n-icon><GridIcon /></n-icon>
              </template>
            </n-button>
            <n-button 
              :type="viewMode === 'calendar' ? 'primary' : 'default'"
              @click="viewMode = 'calendar'"
            >
              <template #icon>
                <n-icon><CalendarIcon /></n-icon>
              </template>
            </n-button>
          </n-button-group>
          
          <n-button type="primary" @click="showAddModal = true">
            <template #icon>
              <n-icon><AddIcon /></n-icon>
            </template>
            添加订阅
          </n-button>
        </div>
      </div>
      
      <!-- 批量操作工具栏 -->
      <div v-if="selectedIds.length > 0" class="batch-toolbar">
        <span>已选择 {{ selectedIds.length }} 项</span>
        <n-button size="small" @click="selectedIds = []">取消选择</n-button>
        <n-button size="small" type="warning" @click="showBatchRemindModal = true">修改提醒天数</n-button>
        <n-button size="small" type="error" @click="handleBatchDelete">批量删除</n-button>
      </div>
      
      <!-- 订阅列表/卡片 -->
      <div v-if="subscriptionStore.loading" class="loading-container">
        <n-spin size="large" />
      </div>
      
      <template v-else>
        <SubscriptionList 
          v-if="viewMode === 'list'"
          v-model:selectedIds="selectedIds"
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
      
      <n-empty v-if="!subscriptionStore.loading && filteredSubscriptions.length === 0 && (viewMode === 'grid' || viewMode === 'list')" description="暂无订阅数据" />
    </n-layout-content>
    
    <!-- 添加/编辑订阅模态框 -->
    <SubscriptionForm
      v-model:show="showAddModal"
      :subscription="editingSubscription"
      @submit="handleFormSubmit"
      @close="handleFormClose"
    />
    
    <!-- 批量修改提醒天数模态框 -->
    <n-modal v-model:show="showBatchRemindModal" preset="dialog" title="批量修改提醒天数">
      <n-input-number v-model:value="batchRemindDays" :min="1" :max="365" style="width: 100%;" />
      <template #action>
        <n-button @click="showBatchRemindModal = false">取消</n-button>
        <n-button type="primary" @click="handleBatchUpdateRemindDays">确定</n-button>
      </template>
    </n-modal>
  </n-layout>
</template>

<script setup lang="ts">
import { useDialog, useMessage } from 'naive-ui';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { subscriptionApi } from '../api/subscription';
import AddIcon from '../assets/icons/AddIcon.vue';
import CalendarIcon from '../assets/icons/CalendarIcon.vue';
import GridIcon from '../assets/icons/GridIcon.vue';
import ListIcon from '../assets/icons/ListIcon.vue';
import LogoutIcon from '../assets/icons/LogoutIcon.vue';
import MoonIcon from '../assets/icons/MoonIcon.vue';
import SearchIcon from '../assets/icons/SearchIcon.vue';
import SettingsIcon from '../assets/icons/SettingsIcon.vue';
import SunIcon from '../assets/icons/SunIcon.vue';
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

const importExportOptions = [
  { label: '导出 JSON', key: 'export-json' },
  { label: '导出 CSV', key: 'export-csv' },
  { label: '导入数据', key: 'import' },
];

const typeOptions = [
  { label: '域名', value: 'domain' },
  { label: '服务器', value: 'server' },
  { label: '会员', value: 'membership' },
  { label: '软件', value: 'software' },
  { label: '其他', value: 'other' },
];

const sortOptions = [
  { label: '到期时间', value: 'end_date' },
  { label: '价格', value: 'price' },
  { label: '名称', value: 'name' },
];

const currencyOptions = [
  { label: '¥ CNY', value: 'CNY' },
  { label: 'HK$ HKD', value: 'HKD' },
  { label: '$ USD', value: 'USD' },
  { label: '€ EUR', value: 'EUR' },
  { label: '£ GBP', value: 'GBP' },
];

const filteredSubscriptions = computed(() => {
  let result = [...subscriptionStore.subscriptions];

  // 搜索过滤
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(
      (sub) =>
        sub.name.toLowerCase().includes(query) ||
        sub.notes?.toLowerCase().includes(query),
    );
  }

  // 类型过滤
  if (filterType.value) {
    result = result.filter((sub) => sub.type === filterType.value);
  }

  // 排序
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
  let result;
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

// 导入导出处理
async function handleImportExport(key: string) {
  if (key === 'export-json' || key === 'export-csv') {
    const format = key === 'export-json' ? 'json' : 'csv';
    const token = localStorage.getItem('token');
    const url = `${subscriptionApi.exportData(format)}&token=${token}`;
    window.open(url, '_blank');
  } else if (key === 'import') {
    // 创建隐藏的文件输入
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.csv';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        let data: Record<string, unknown>[];

        if (file.name.endsWith('.json')) {
          data = JSON.parse(text);
        } else {
          // 解析 CSV
          const lines = text.split('\n').filter((l) => l.trim());
          const headers = lines[0].split(',');
          data = lines.slice(1).map((line) => {
            const values = line.split(',');
            const obj: Record<string, unknown> = {};
            headers.forEach((h, i) => {
              let val: unknown = values[i]?.replace(/^"|"$/g, '');
              if (h === 'one_time') val = val === 'true' || val === '1';
              if (h === 'price' || h === 'remind_days') val = Number(val) || 0;
              obj[h.trim()] = val;
            });
            return obj;
          });
        }

        const result = await subscriptionApi.importData(data);
        if (result.success) {
          message.success(result.message || '导入成功');
          await subscriptionStore.fetchSubscriptions();
        } else {
          message.error(result.message || '导入失败');
        }
      } catch (err) {
        message.error('文件解析失败，请检查格式');
      }
    };
    input.click();
  }
}

// 批量删除
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
      } catch (err) {
        message.error('删除失败');
      }
    },
  });
}

// 批量修改提醒天数
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
  } catch (err) {
    message.error('修改失败');
  }
}
</script>

<style scoped>
.page-container {
  min-height: 100vh;
  background-color: var(--bg-color);
}

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

.header {
  height: 60px;
  padding: 0 24px;
  display: flex;
  align-items: center;
}

.header-content {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.logo-icon {
  width: 32px;
  height: 32px;
}

.logo {
  font-size: 24px;
  font-weight: 700;
  margin: 0;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.content-wrapper {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}

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

.loading-container {
  display: flex;
  justify-content: center;
  padding: 60px 0;
}

.countdown-section {
  margin-top: 20px;
  padding: 16px;
  background: var(--n-color);
  border-radius: 8px;
  border: 1px solid var(--n-border-color);
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 12px 0;
  color: var(--n-text-color);
}

.countdown-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.countdown-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: var(--n-color-modal);
  border-radius: 6px;
}

.countdown-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.countdown-name {
  font-weight: 500;
  font-size: 14px;
}

.countdown-date {
  font-size: 12px;
  color: var(--n-text-color-3);
}

@media (max-width: 768px) {
  .header {
    padding: 0 16px;
  }
  
  .content-wrapper {
    padding: 16px;
  }
  
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
