<template>
  <div class="auth-container">
    <n-card class="auth-card" :bordered="false">
      <template #header>
        <div class="auth-header">
          <h2>注册 Subly</h2>
          <p>创建您的订阅管理账号</p>
        </div>
      </template>
      
      <n-form ref="formRef" :model="formData" :rules="rules" @submit.prevent="handleRegister">
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
        
        
        
        <n-button 
          type="primary" 
          block 
          :loading="loading"
          attr-type="submit"
        >
          注册
        </n-button>
      </n-form>
      
      <div class="auth-footer">
        <span>已有账号？</span>
        <router-link to="/login">立即登录</router-link>
      </div>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { type FormInst, type FormRules, useMessage } from 'naive-ui';
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const message = useMessage();
const authStore = useAuthStore();

const formRef = ref<FormInst | null>(null);
const loading = ref(false);

const formData = reactive({
  username: '',
  password: '',
  confirmPassword: '',
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

    const result = await authStore.register({
      username: formData.username,
      password: formData.password,
    });

    if (result.success) {
      message.success('注册成功，请登录');
      router.push('/login');
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
