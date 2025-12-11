<template>
  <div class="auth-container">
    <n-card class="auth-card" :bordered="false">
      <template #header>
        <div class="auth-header">
          <h2>登录 Subly</h2>
          <p>订阅管理与提醒系统</p>
        </div>
      </template>
      
      <n-form ref="formRef" :model="formData" :rules="rules" @submit.prevent="handleLogin">
        <n-form-item path="username" label="用户名">
          <n-input 
            v-model:value="formData.username" 
            placeholder="请输入用户名"
            :input-props="{ autocomplete: 'username' }"
          />
        </n-form-item>
        
        <n-form-item path="password" label="密码">
          <n-input 
            v-model:value="formData.password" 
            type="password" 
            placeholder="请输入密码"
            show-password-on="click"
            :input-props="{ autocomplete: 'current-password' }"
          />
        </n-form-item>

        <n-form-item v-if="authStore.turnstileEnabled && authStore.turnstileSiteKey" label="人机验证">
          <Turnstile
            :site-key="authStore.turnstileSiteKey"
            v-model="turnstileToken"
            theme="auto"
          />
        </n-form-item>
        
        <n-button 
          type="primary" 
          block 
          :loading="loading"
          attr-type="submit"
        >
          登录
        </n-button>
      </n-form>
      
      <div class="auth-footer">
        <span>还没有账号？</span>
        <router-link to="/register">立即注册</router-link>
      </div>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { type FormInst, type FormRules, useMessage } from 'naive-ui';
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import Turnstile from '../components/common/Turnstile.vue';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const message = useMessage();
const authStore = useAuthStore();

const formRef = ref<FormInst | null>(null);
const loading = ref(false);
const turnstileToken = ref('');

const formData = reactive({
  username: '',
  password: '',
});

onMounted(async () => {
  await authStore.fetchSystemConfig();
});

const rules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
};

async function handleLogin() {
  try {
    await formRef.value?.validate();
    loading.value = true;

    // 如果启用了 Turnstile 但没有 token，提示用户
    if (
      authStore.turnstileEnabled &&
      authStore.turnstileSiteKey &&
      !turnstileToken.value
    ) {
      message.error('请完成人机验证');
      loading.value = false;
      return;
    }

    const result = await authStore.login({
      ...formData,
      turnstile_token: turnstileToken.value || undefined,
    });

    if (result.success) {
      message.success('登录成功');
      router.push('/');
    } else {
      message.error(result.message || '登录失败');
    }
  } catch (error) {
    // 表单验证失败
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.auth-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bg-color);
  padding: 16px;
}

.auth-card {
  width: 100%;
  max-width: 400px;
  border-radius: 12px;
}

.auth-header {
  text-align: center;
  margin-bottom: 8px;
}

.auth-header h2 {
  margin: 0 0 8px 0;
  font-size: 24px;
  font-weight: 600;
}

.auth-header p {
  margin: 0;
  color: #999;
  font-size: 14px;
}

.auth-footer {
  text-align: center;
  margin-top: 24px;
  font-size: 14px;
  color: #666;
}

.auth-footer a {
  color: #18a058;
  text-decoration: none;
  margin-left: 4px;
}

.auth-footer a:hover {
  text-decoration: underline;
}
</style>
