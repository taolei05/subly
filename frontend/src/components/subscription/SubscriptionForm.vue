<template>
  <n-modal 
    :show="show" 
    preset="card"
    :title="subscription ? '编辑订阅' : '添加订阅'"
    :style="{ width: '600px', maxWidth: '90vw' }"
    :mask-closable="false"
    @update:show="$emit('update:show', $event)"
  >
    <n-form ref="formRef" :model="formData" :rules="rules" label-placement="top">
      <n-form-item path="name" label="服务名称">
        <n-input v-model:value="formData.name" placeholder="请输入服务名称" />
      </n-form-item>

      <n-form-item path="url" label="服务链接">
        <n-input 
          v-model:value="formData.url" 
          placeholder="可选，订阅服务的管理页面链接"
          clearable
        >
          <template #prefix>
            <n-icon :size="16" style="color: #999;">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M18.364 15.536L16.95 14.12l1.414-1.414a5 5 0 1 0-7.071-7.071L9.879 7.05 8.464 5.636 9.88 4.222a7 7 0 0 1 9.9 9.9l-1.415 1.414zm-2.828 2.828l-1.415 1.414a7 7 0 0 1-9.9-9.9l1.415-1.414L7.05 9.88l-1.414 1.414a5 5 0 1 0 7.071 7.071l1.414-1.414 1.415 1.414zm-.708-10.607l1.415 1.415-7.071 7.07-1.415-1.414 7.071-7.07z"/></svg>
            </n-icon>
          </template>
        </n-input>
      </n-form-item>
      
      <n-form-item path="type" label="订阅类型">
        <n-select v-model:value="formData.type" :options="typeOptions" placeholder="请选择订阅类型" />
      </n-form-item>
      
      <n-form-item path="type_detail" :label="typeDetailLabel">
        <n-input v-model:value="formData.type_detail" :placeholder="typeDetailPlaceholder" />
      </n-form-item>
      
      <n-grid cols="1 s:2" responsive="screen" :x-gap="24" :y-gap="0">
        <n-gi>
          <n-form-item path="price" label="价格">
            <n-input-number 
              v-model:value="formData.price" 
              :precision="2" 
              :min="0"
              placeholder="请输入价格"
              style="width: 100%;"
            />
          </n-form-item>
        </n-gi>
        <n-gi>
          <n-form-item path="currency" label="货币">
            <n-select v-model:value="formData.currency" :options="currencyOptions" />
          </n-form-item>
        </n-gi>
      </n-grid>
      
      <n-grid cols="1 s:2" responsive="screen" :x-gap="24" :y-gap="0">
        <n-gi>
          <n-form-item path="start_date" label="开始日期">
            <n-date-picker 
              v-model:value="formData.start_date" 
              type="date"
              style="width: 100%;"
            />
          </n-form-item>
        </n-gi>
        <n-gi>
          <n-form-item path="end_date" label="到期日期">
            <n-date-picker 
              v-model:value="formData.end_date" 
              type="date"
              style="width: 100%;"
              :disabled="formData.one_time"
              :placeholder="formData.one_time ? '永久' : '请选择到期日期'"
            />
          </n-form-item>
        </n-gi>
      </n-grid>
      
      <n-form-item path="remind_days" label="提前提醒">
        <n-input-number 
          v-model:value="formData.remind_days" 
          :min="0"
          :max="365"
          :placeholder="formData.one_time ? '永久无需提醒' : '提前几天提醒'"
          :disabled="formData.one_time"
          style="width: 100%;"
        >
          <template #suffix>天</template>
        </n-input-number>
      </n-form-item>
      
      <n-grid cols="1 s:2" responsive="screen" :x-gap="24" :y-gap="0">
        <n-gi>
          <n-form-item path="renew_type" label="续订类型">
            <n-select 
              v-model:value="formData.renew_type" 
              :options="renewTypeOptions" 
              :disabled="formData.one_time"
              placeholder="请选择续订类型"
            />
          </n-form-item>
        </n-gi>
        <n-gi>
          <n-form-item path="one_time" label="一次性买断">
            <n-switch 
              v-model:value="formData.one_time" 
              :disabled="formData.renew_type !== 'none'"
              @update:value="handleOneTimeChange"
            />
          </n-form-item>
        </n-gi>
      </n-grid>
      
      <n-form-item path="notes" label="备注">
        <n-input 
          v-model:value="formData.notes" 
          type="textarea" 
          placeholder="可选备注信息"
          :rows="3"
        />
      </n-form-item>
    </n-form>
    
    <template #footer>
      <n-space justify="end">
        <n-button @click="handleCancel">取消</n-button>
        <n-button type="primary" :loading="submitting" @click="handleSubmit">
          {{ subscription ? '保存' : '添加' }}
        </n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import type { FormInst, FormRules } from 'naive-ui';
import { computed, reactive, ref, watch } from 'vue';
import {
  CURRENCY_OPTIONS_FULL,
  RENEW_TYPE_OPTIONS,
  TYPE_OPTIONS,
} from '../../constants';
import type {
  Currency,
  Subscription,
  SubscriptionFormData,
  SubscriptionType,
} from '../../types';

const props = defineProps<{
  show: boolean;
  subscription: Subscription | null;
}>();

const emit = defineEmits<{
  'update:show': [show: boolean];
  submit: [data: SubscriptionFormData];
  close: [];
}>();

const formRef = ref<FormInst | null>(null);
const submitting = ref(false);

const defaultFormData = (): SubscriptionFormData => ({
  name: '',
  type: 'membership' as SubscriptionType,
  type_detail: '',
  price: 0,
  currency: 'CNY' as Currency,
  start_date: Date.now(),
  end_date: Date.now() + 365 * 24 * 60 * 60 * 1000,
  remind_days: 7,
  renew_type: 'none' as 'none' | 'auto' | 'manual',
  one_time: false,
  url: '',
  notes: '',
});

const typeOptions = TYPE_OPTIONS;
const currencyOptions = CURRENCY_OPTIONS_FULL;
const renewTypeOptions = RENEW_TYPE_OPTIONS;

const formData = reactive<SubscriptionFormData>(defaultFormData());

const typeDetailLabel = computed(() => {
  switch (formData.type) {
    case 'domain':
      return '域名';
    case 'server':
      return '服务器规格';
    case 'membership':
      return '会员详情';
    case 'software':
      return '软件版本/授权';
    default:
      return '详情备注';
  }
});

const typeDetailPlaceholder = computed(() => {
  switch (formData.type) {
    case 'domain':
      return '例如: example.com';
    case 'server':
      return '例如: 2核4G';
    case 'membership':
      return '例如: 高级会员、年费';
    case 'software':
      return '例如: v2.0、Pro版';
    default:
      return '请输入相关详情信息';
  }
});

const rules = computed<FormRules>(() => ({
  name: [{ required: true, message: '请输入服务名称', trigger: 'blur' }],
  type: [{ required: true, message: '请选择订阅类型', trigger: 'change' }],
  price: [
    { required: true, type: 'number', message: '请输入价格', trigger: 'blur' },
  ],
  start_date: [
    {
      required: true,
      type: 'number',
      message: '请选择开始日期',
      trigger: 'change',
    },
  ],
  end_date: [
    {
      required: !formData.one_time,
      type: 'number',
      message: '请选择到期日期',
      trigger: 'change',
    },
  ],
}));

// 监听 renew_type 变化
watch(
  () => formData.renew_type,
  (newVal) => {
    // 如果选择了续订类型，禁用一次性买断
    if (newVal !== 'none') {
      formData.one_time = false;
    }
  },
);

// 处理一次性买断变化
function handleOneTimeChange(value: boolean) {
  if (value) {
    formData.renew_type = 'none';
    formData.end_date = null as unknown as number; // 清空到期日期
    formData.remind_days = 0; // 清空提醒天数
  } else {
    // 恢复默认到期日期（一年后）和提醒天数
    formData.end_date = Date.now() + 365 * 24 * 60 * 60 * 1000;
    formData.remind_days = 7;
  }
}

watch(
  () => props.show,
  (newVal) => {
    if (newVal) {
      if (props.subscription) {
        // 编辑模式 - 填充数据
        const renewType = props.subscription.renew_type || 'none';
        const isOneTime = props.subscription.one_time;
        Object.assign(formData, {
          name: props.subscription.name,
          type: props.subscription.type,
          type_detail: props.subscription.type_detail || '',
          price: props.subscription.price,
          currency: props.subscription.currency,
          start_date: new Date(props.subscription.start_date).getTime(),
          // 一次性买断时，end_date 设为 null（不显示日期）
          end_date: isOneTime
            ? null
            : new Date(props.subscription.end_date).getTime(),
          remind_days: props.subscription.remind_days,
          renew_type: renewType,
          one_time: isOneTime,
          url: props.subscription.url || '',
          notes: props.subscription.notes || '',
        });
      } else {
        // 添加模式 - 重置表单
        Object.assign(formData, defaultFormData());
      }
    }
  },
);

function handleCancel() {
  emit('update:show', false);
  emit('close');
}

async function handleSubmit() {
  try {
    await formRef.value?.validate();
    submitting.value = true;
    emit('submit', { ...formData });
  } catch (error) {
    // 表单验证失败
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
</style>
