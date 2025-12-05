<template>
  <n-modal 
    :show="show" 
    preset="card"
    :title="subscription ? '编辑订阅' : '添加订阅'"
    :style="{ width: '600px', maxWidth: '90vw' }"
    :mask-closable="false"
    @update:show="$emit('update:show', $event)"
  >
    <n-form ref="formRef" :model="formData" :rules="rules" label-placement="left" label-width="100px">
      <n-form-item path="name" label="服务名称">
        <n-input v-model:value="formData.name" placeholder="请输入服务名称" />
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
            />
          </n-form-item>
        </n-gi>
      </n-grid>
      
      <n-form-item path="remind_days" label="提前提醒">
        <n-input-number 
          v-model:value="formData.remind_days" 
          :min="0"
          :max="365"
          placeholder="提前几天提醒"
          style="width: 100%;"
        >
          <template #suffix>天</template>
        </n-input-number>
      </n-form-item>
      
      <n-grid cols="1 s:2" responsive="screen" :x-gap="24" :y-gap="0">
        <n-gi>
          <n-form-item path="auto_renew" label="自动续订">
            <n-switch v-model:value="formData.auto_renew" />
          </n-form-item>
        </n-gi>
        <n-gi>
          <n-form-item path="one_time" label="一次性买断">
            <n-switch v-model:value="formData.one_time" />
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
import { ref, reactive, watch, computed } from 'vue';
import type { FormInst, FormRules } from 'naive-ui';
import type { Subscription, SubscriptionFormData, SubscriptionType, Currency } from '../../types';

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
  auto_renew: false,
  one_time: false,
  notes: ''
});

const formData = reactive<SubscriptionFormData>(defaultFormData());

const typeDetailLabel = computed(() => {
  switch (formData.type) {
    case 'domain': return '域名';
    case 'server': return '服务器规格';
    case 'membership': return '会员详情';
    case 'software': return '软件版本/授权';
    default: return '详情备注';
  }
});

const typeDetailPlaceholder = computed(() => {
  switch (formData.type) {
    case 'domain': return '例如: example.com';
    case 'server': return '例如: 2核4G';
    case 'membership': return '例如: 高级会员、年费';
    case 'software': return '例如: v2.0、Pro版';
    default: return '请输入相关详情信息';
  }
});

const typeOptions = [
  { label: '域名', value: 'domain' },
  { label: '服务器', value: 'server' },
  { label: '会员', value: 'membership' },
  { label: '软件', value: 'software' },
  { label: '其他', value: 'other' }
];

const currencyOptions = [
  { label: '人民币 (CNY)', value: 'CNY' },
  { label: '港币 (HKD)', value: 'HKD' },
  { label: '美元 (USD)', value: 'USD' },
  { label: '欧元 (EUR)', value: 'EUR' },
  { label: '英镑 (GBP)', value: 'GBP' }
];

const rules: FormRules = {
  name: [
    { required: true, message: '请输入服务名称', trigger: 'blur' }
  ],
  type: [
    { required: true, message: '请选择订阅类型', trigger: 'change' }
  ],
  price: [
    { required: true, type: 'number', message: '请输入价格', trigger: 'blur' }
  ],
  start_date: [
    { required: true, type: 'number', message: '请选择开始日期', trigger: 'change' }
  ],
  end_date: [
    { required: true, type: 'number', message: '请选择到期日期', trigger: 'change' }
  ]
};

watch(() => props.show, (newVal) => {
  if (newVal) {
    if (props.subscription) {
      // 编辑模式 - 填充数据
      Object.assign(formData, {
        name: props.subscription.name,
        type: props.subscription.type,
        type_detail: props.subscription.type_detail || '',
        price: props.subscription.price,
        currency: props.subscription.currency,
        start_date: new Date(props.subscription.start_date).getTime(),
        end_date: new Date(props.subscription.end_date).getTime(),
        remind_days: props.subscription.remind_days,
        auto_renew: props.subscription.auto_renew,
        one_time: props.subscription.one_time,
        notes: props.subscription.notes || ''
      });
    } else {
      // 添加模式 - 重置表单
      Object.assign(formData, defaultFormData());
    }
  }
});

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
