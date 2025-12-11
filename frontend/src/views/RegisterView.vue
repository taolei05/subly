<template>
  <div class="auth-container">
    <div class="theme-toggle">
      <n-button quaternary circle @click="themeStore.toggleTheme">
        <template #icon>
          <n-icon :size="20">
            <svg v-if="themeStore.isDark" xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24">
              <path fill="currentColor" d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5s5-2.24 5-5s-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58a.996.996 0 0 0-1.41 0a.996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37a.996.996 0 0 0-1.41 0a.996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0a.996.996 0 0 0 0-1.41l-1.06-1.06zm1.06-10.96a.996.996 0 0 0 0-1.41a.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36a.996.996 0 0 0 0-1.41a.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/>
            </svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24">
              <path fill="currentColor" d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26a5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/>
            </svg>
          </n-icon>
        </template>
      </n-button>
    </div>
    <n-card class="auth-card" :bordered="false">
      <template #header>
        <div class="auth-header">
          <h2>注册 Subly</h2>
          <p>创建您的订阅管理账号</p>
        </div>
      </template>

      <n-spin :show="checkingConfig">
        <n-result
          v-if="!checkingConfig && !registrationEnabled"
          status="warning"
          title="注册功能已关闭"
          description="管理员已关闭用户注册功能"
        >
          <template #footer>
            <router-link to="/login">
              <n-button type="primary">返回登录</n-button>
            </router-link>
          </template>
        </n-result>
      
        <n-form v-else ref="formRef" :model="formData" :rules="rules" @submit.prevent="handleRegister">
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
            :input-props="{ autocomplete: 'new-password' }"
          />
        </n-form-item>
        
        <n-form-item path="confirmPassword" label="确认密码">
          <n-input 
            v-model:value="formData.confirmPassword" 
            type="password" 
            placeholder="请再次输入密码"
            show-password-on="click"
            :input-props="{ autocomplete: 'new-password' }"
          />
        </n-form-item>
        
        <n-form-item v-if="authStore.turnstileEnabled && authStore.turnstileSiteKey" label="人机验证">
          <Turnstile
            :site-key="authStore.turnstileSiteKey"
            v-model="turnstileToken"
          />
        </n-form-item>
        
        <n-button 
          type="primary" 
          block 
          :loading="loading"
          attr-type="submit"
        >
          注册
        </n-button>
        </n-form>
      
        <div v-if="registrationEnabled" class="auth-footer">
          <span>已有账号？</span>
          <router-link to="/login">立即登录</router-link>
        </div>
      </n-spin>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { type FormInst, type FormRules, useMessage } from 'naive-ui';
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import Turnstile from '../components/common/Turnstile.vue';
import { useAuthStore } from '../stores/auth';
import { useThemeStore } from '../stores/theme';

const themeStore = useThemeStore();

const router = useRouter();
const message = useMessage();
const authStore = useAuthStore();

const formRef = ref<FormInst | null>(null);
const loading = ref(false);
const checkingConfig = ref(true);
const registrationEnabled = ref(true);
const turnstileToken = ref('');

const formData = reactive({
  username: '',
  password: '',
  confirmPassword: '',
});

onMounted(async () => {
  await authStore.fetchSystemConfig();
  registrationEnabled.value = authStore.registrationEnabled;
  checkingConfig.value = false;
});

const rules: FormRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, message: '用户名至少3个字符', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少6个字符', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请确认密码', trigger: 'blur' },
    {
      validator: (_rule, value) => {
        return value === formData.password;
      },
      message: '两次输入的密码不一致',
      trigger: 'blur',
    },
  ],
};

async function handleRegister() {
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

    const result = await authStore.register({
      username: formData.username,
      password: formData.password,
      turnstile_token: turnstileToken.value || undefined,
    });

    if (result.success) {
      const loginRes = await authStore.login({
        username: formData.username,
        password: formData.password,
      });
      if (loginRes.success) {
        message.success('注册成功，已自动登录');
        router.push('/');
      } else {
        message.warning('注册成功，但自动登录失败，请手动登录');
        router.push('/login');
      }
    } else {
      message.error(result.message || '注册失败');
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
  position: relative;
}

.theme-toggle {
  position: absolute;
  top: 16px;
  right: 16px;
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
