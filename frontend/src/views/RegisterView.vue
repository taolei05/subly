<template>
  <div class="auth-container">
    <n-card class="auth-card" :bordered="false">
      <template #header>
        <div class="auth-header">
          <h2>{{ currentStep === 'register' ? '注册 Subly' : '设置两步验证' }}</h2>
          <p>{{ currentStep === 'register' ? '创建您的订阅管理账号' : '使用验证器应用保护您的账号' }}</p>
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

        <!-- 注册表单 -->
        <template v-else-if="currentStep === 'register'">
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

            <div class="totp-option">
              <n-checkbox v-model:checked="enableTOTP">
                启用两步验证 (2FA)
              </n-checkbox>
              <n-text depth="3" style="font-size: 12px; display: block; margin-top: 4px; margin-left: 24px;">
                使用验证器应用生成动态验证码，提高账号安全性
              </n-text>
            </div>
            
            <n-button 
              type="primary" 
              block 
              :loading="loading"
              attr-type="submit"
              style="margin-top: 16px;"
            >
              {{ enableTOTP ? '下一步' : '注册' }}
            </n-button>
          </n-form>
        
          <div class="auth-footer">
            <span>已有账号？</span>
            <router-link to="/login">立即登录</router-link>
          </div>
        </template>

        <!-- 2FA 设置步骤 -->
        <template v-else-if="currentStep === 'totp-setup'">
          <div style="text-align: center; margin-bottom: 16px;">
            <p style="margin-bottom: 12px; color: #666;">
              使用验证器应用扫描下方二维码：
            </p>
            <div
              ref="qrcodeRef"
              style="display: inline-block; padding: 16px; background: white; border-radius: 8px;"
            />
          </div>

          <n-collapse>
            <n-collapse-item title="无法扫描？手动输入密钥" name="manual">
              <n-input
                :value="totpSecret"
                readonly
                style="font-family: monospace;"
              >
                <template #suffix>
                  <n-button text @click="copySecret">
                    <n-icon size="16">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                      </svg>
                    </n-icon>
                  </n-button>
                </template>
              </n-input>
            </n-collapse-item>
          </n-collapse>

          <div style="margin-top: 16px;">
            <p style="margin-bottom: 8px; color: #666; font-size: 14px;">
              输入验证器显示的 6 位验证码：
            </p>
            <n-input
              v-model:value="totpCode"
              placeholder="000000"
              maxlength="6"
              style="font-size: 20px; letter-spacing: 6px; text-align: center;"
            />
          </div>

          <div class="totp-buttons">
            <n-button
              type="primary"
              block
              :loading="loading"
              :disabled="totpCode.length !== 6"
              @click="verifyAndEnableTOTP"
            >
              验证并完成
            </n-button>
            <n-button block quaternary @click="skipTOTP">跳过，稍后设置</n-button>
          </div>
        </template>
      </n-spin>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { type FormInst, type FormRules, useMessage } from 'naive-ui';
import QRCode from 'qrcode';
import { nextTick, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { enableTOTP as enableTOTPApi, setupTOTP } from '../api/totp';
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

// 步骤控制
const currentStep = ref<'register' | 'totp-setup'>('register');
const enableTOTP = ref(false);

// 2FA 相关
const totpSecret = ref('');
const totpUri = ref('');
const totpCode = ref('');
const qrcodeRef = ref<HTMLDivElement | null>(null);

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

    const result = await authStore.register({
      username: formData.username,
      password: formData.password,
    });

    if (result.success) {
      // 自动登录
      const loginRes = await authStore.login({
        username: formData.username,
        password: formData.password,
      });

      if (!loginRes.success) {
        message.warning('注册成功，但自动登录失败，请手动登录');
        router.push('/login');
        return;
      }

      // 如果选择启用 2FA，进入设置步骤
      if (enableTOTP.value) {
        await initTOTPSetup();
      } else {
        message.success('注册成功');
        router.push('/');
      }
    } else {
      message.error(result.message || '注册失败');
    }
  } catch {
    // 表单验证失败
  } finally {
    loading.value = false;
  }
}

async function initTOTPSetup() {
  loading.value = true;
  try {
    const result = await setupTOTP();
    if (result.success && result.data) {
      totpSecret.value = result.data.secret;
      totpUri.value = result.data.uri;
      currentStep.value = 'totp-setup';

      // 生成二维码
      await nextTick();
      if (qrcodeRef.value) {
        const canvas = document.createElement('canvas');
        qrcodeRef.value.innerHTML = '';
        qrcodeRef.value.appendChild(canvas);
        await QRCode.toCanvas(canvas, totpUri.value, {
          width: 180,
          margin: 0,
        });
      }
    } else {
      message.error(result.message || '获取 2FA 设置信息失败');
      router.push('/');
    }
  } finally {
    loading.value = false;
  }
}

async function verifyAndEnableTOTP() {
  if (totpCode.value.length !== 6) return;

  loading.value = true;
  try {
    const result = await enableTOTPApi(totpCode.value);
    if (result.success) {
      message.success('注册成功，两步验证已启用');
      await authStore.fetchUser();
      router.push('/');
    } else {
      message.error(result.message || '验证码错误');
    }
  } finally {
    loading.value = false;
  }
}

function skipTOTP() {
  message.success('注册成功');
  router.push('/');
}

function copySecret() {
  if (totpSecret.value) {
    navigator.clipboard.writeText(totpSecret.value);
    message.success('密钥已复制');
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
  overflow: hidden;
}

.auth-card :deep(.n-card__content) {
  overflow: hidden;
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
  color: v-bind('themeStore.primaryColor');
  text-decoration: none;
  margin-left: 4px;
}

.auth-footer a:hover {
  text-decoration: underline;
}

.totp-option {
  padding: 12px;
  background: rgba(24, 160, 88, 0.08);
  border-radius: 8px;
  margin-top: 8px;
}

.totp-buttons {
  margin-top: 16px;
  display: flex !important;
  flex-direction: column !important;
  gap: 8px;
  width: 100%;
}

.totp-buttons .n-button {
  width: 100% !important;
  max-width: 100% !important;
}
</style>
