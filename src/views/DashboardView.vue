<template>
  <n-layout class="page-container">
    <n-layout-header bordered class="header">
      <div class="header-content">
        <div class="header-left">
          <img src="/favicon.svg" alt="Subly" class="logo-icon" />
          <h1 class="logo">Subly</h1>
        </div>
        <div class="header-right">
          <n-button quaternary circle @click="themeStore.toggleTheme">
            <template #icon>
              <n-icon size="20">
                <SunIcon v-if="themeStore.isDark" />
                <MoonIcon v-else />
              </n-icon>
            </template>
          </n-button>
          <n-button quaternary circle @click="goToSettings">
            <template #icon>
              <n-icon size="20">
                <SettingsIcon />
              </n-icon>
            </template>
          </n-button>
          <n-button quaternary circle @click="handleLogout">
            <template #icon>
              <n-icon size="20">
                <LogoutIcon />
              </n-icon>
            </template>
          </n-button>
        </div>
      </div>
    </n-layout-header>
    
    <n-layout-content class="content-wrapper">
      <!-- 统计卡片 -->
      <StatsCards 
        :stats="subscriptionStore.stats"
        :currency="subscriptionStore.selectedCurrency"
        @update:currency="subscriptionStore.selectedCurrency = $event"
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
          </n-button-group>
          
          <n-button type="primary" @click="showAddModal = true">
            <template #icon>
              <n-icon><AddIcon /></n-icon>
            </template>
            添加订阅
          </n-button>
        </div>
      </div>
      
      <!-- 订阅列表/卡片 -->
      <div v-if="subscriptionStore.loading" class="loading-container">
        <n-spin size="large" />
      </div>
      
      <template v-else>
        <SubscriptionList 
          v-if="viewMode === 'list'"
          :subscriptions="filteredSubscriptions"
          @edit="handleEdit"
          @delete="handleDelete"
          @toggle-status="handleToggleStatus"
        />
        
        <SubscriptionGrid 
          v-else
          :subscriptions="filteredSubscriptions"
          @edit="handleEdit"
          @delete="handleDelete"
          @toggle-status="handleToggleStatus"
        />
      </template>
      
      <n-empty v-if="!subscriptionStore.loading && filteredSubscriptions.length === 0 && viewMode === 'grid'" description="暂无订阅数据" />
    </n-layout-content>
    
    <!-- 添加/编辑订阅模态框 -->
    <SubscriptionForm
      v-model:show="showAddModal"
      :subscription="editingSubscription"
      @submit="handleFormSubmit"
      @close="handleFormClose"
    />
  </n-layout>
</template>

<script setup lang="ts">
import { useMessage } from 'naive-ui';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import AddIcon from '../assets/icons/AddIcon.vue';
import GridIcon from '../assets/icons/GridIcon.vue';
import ListIcon from '../assets/icons/ListIcon.vue';
import LogoutIcon from '../assets/icons/LogoutIcon.vue';
import MoonIcon from '../assets/icons/MoonIcon.vue';
import SearchIcon from '../assets/icons/SearchIcon.vue';
import SettingsIcon from '../assets/icons/SettingsIcon.vue';
import SunIcon from '../assets/icons/SunIcon.vue';
import StatsCards from '../components/subscription/StatsCards.vue';
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
const themeStore = useThemeStore();
const authStore = useAuthStore();
const subscriptionStore = useSubscriptionStore();

const searchQuery = ref('');
const filterType = ref<SubscriptionType | null>(null);
const sortBy = ref('end_date');
const viewMode = ref<'list' | 'grid'>('list');
const showAddModal = ref(false);
const editingSubscription = ref<Subscription | null>(null);

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
</script>

<style scoped>
.page-container {
  min-height: 100vh;
  background-color: var(--bg-color);
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
