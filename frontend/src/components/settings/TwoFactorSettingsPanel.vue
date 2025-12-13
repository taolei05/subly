<template>
  <n-collapse-item title="两步验证 (2FA)" name="2fa">
    <div style="padding: 16px 0;">
      <n-alert v-if="!totpEnabled" type="info" style="margin-bottom: 16px;">
        启用两步验证后，登录时需要输入验证器应用生成的动态验证码，可有效防止账号被盗。
      </n-alert>

      <n-alert v-else type="success" style="margin-bottom: 16px;">
        两步验证已启用，您的账号受到额外保护。
      </n-alert>

      <!-- 未启用状态 -->
      <template v-if="!totpEnabled">
        <template v-if="!setupData">
          <n-button
            type="primary"
            :loading="loading"
            :disabled="disabled"
            @click="handleSetup"
          >
            启用两步验证
          </n-button>
        </template>

        <!-- 设置流程 -->
        <template v-else>
          <n-steps :current="currentStep" size="small" style="margin-bottom: 24px;">
            <n-step title="扫描二维码" />
            <n-step title="验证并启用" />
          </n-steps>

          <template v-if="currentStep === 1">
            <div style="text-align: center; margin-bottom: 16px;">
              <p style="margin-bottom: 12px; color: #666;">
                使用验证器应用（如 Google Authenticator、Microsoft Authenticator 或 1Password）扫描下方二维码：
              </p>
              <div
                ref="qrcodeRef"
                style="display: inline-block; padding: 16px; background: white; border-radius: 8px;"
              />
            </div>

            <n-collapse>
              <n-collapse-item title="无法扫描？手动输入密钥" name="manual">
                <n-input
                  :value="setupData.secret"
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

            <div style="margin-top: 16px; display: flex; gap: 12px;">
              <n-button @click="cancelSetup">取消</n-button>
              <n-button type="primary" @click="currentStep = 2">
                下一步
              </n-button>
            </div>
          </template>

          <template v-if="currentStep === 2">
            <p style="margin-bottom: 12px; color: #666;">
              输入验证器应用显示的 6 位验证码：
            </p>
            <n-input
              v-model:value="verifyCode"
              placeholder="000000"
              maxlength="6"
              style="max-width: 200px; font-size: 24px; letter-spacing: 8px; text-align: center;"
              @keyup.enter="handleEnable"
            />

            <div style="margin-top: 16px; display: flex; gap: 12px;">
              <n-button @click="currentStep = 1">上一步</n-button>
              <n-button
                type="primary"
                :loading="loading"
                :disabled="verifyCode.length !== 6"
                @click="handleEnable"
              >
                验证并启用
              </n-button>
            </div>
          </template>
        </template>
      </template>

      <!-- 已启用状态 -->
      <template v-else>
        <n-button
          type="error"
          secondary
          :disabled="disabled"
          @click="showDisableModal = true"
        >
          禁用两步验证
        </n-button>
      </template>
    </div>

    <!-- 禁用确认弹窗 -->
    <n-modal
      v-model:show="showDisableModal"
      preset="card"
      title="禁用两步验证"
      :style="{ width: '400px' }"
    >
      <p style="margin-bottom: 16px; color: #666;">
        禁用两步验证会降低账号安全性。请输入当前验证码以确认：
      </p>
      <n-input
        v-model:value="disableCode"
        placeholder="000000"
        maxlength="6"
        style="font-size: 20px; letter-spacing: 6px; text-align: center;"
        @keyup.enter="handleDisable"
      />
      <template #footer>
        <div style="display: flex; justify-content: flex-end; gap: 12px;">
          <n-button @click="showDisableModal = false">取消</n-button>
          <n-button
            type="error"
            :loading="loading"
            :disabled="disableCode.length !== 6"
            @click="handleDisable"
          >
            确认禁用
          </n-button>
        </div>
      </template>
    </n-modal>
  </n-collapse-item>
</template>

<script setup lang="ts">
import { useMessage } from 'naive-ui';
import QRCode from 'qrcode';
import { computed, nextTick, ref, watch } from 'vue';
import {
  disableTOTP,
  enableTOTP,
  setupTOTP,
  type TOTPSetupResponse,
} from '../../api/totp';
import { useAuthStore } from '../../stores/auth';

const props = defineProps<{ disabled?: boolean }>();
const emit = defineEmits<{ updated: [] }>();

const message = useMessage();
const authStore = useAuthStore();

const loading = ref(false);
const setupData = ref<TOTPSetupResponse | null>(null);
const currentStep = ref(1);
const verifyCode = ref('');
const qrcodeRef = ref<HTMLDivElement | null>(null);

const showDisableModal = ref(false);
const disableCode = ref('');

const totpEnabled = computed(() => Boolean(authStore.user?.totp_enabled));

// 监听 setupData 变化，生成二维码
watch(
  () => setupData.value?.uri,
  async (uri) => {
    if (uri) {
      await nextTick();
      if (qrcodeRef.value) {
        await QRCode.toCanvas(
          qrcodeRef.value.appendChild(document.createElement('canvas')),
          uri,
          {
            width: 200,
            margin: 0,
          },
        );
      }
    }
  },
);

async function handleSetup() {
  loading.value = true;
  try {
    const result = await setupTOTP();
    if (result.success && result.data) {
      setupData.value = result.data;
      currentStep.value = 1;
    } else {
      message.error(result.message || '获取设置信息失败');
    }
  } finally {
    loading.value = false;
  }
}

function cancelSetup() {
  setupData.value = null;
  currentStep.value = 1;
  verifyCode.value = '';
}

async function handleEnable() {
  if (verifyCode.value.length !== 6) return;

  loading.value = true;
  try {
    const result = await enableTOTP(verifyCode.value);
    if (result.success) {
      message.success('两步验证已启用');
      setupData.value = null;
      currentStep.value = 1;
      verifyCode.value = '';
      await authStore.fetchUser();
      emit('updated');
    } else {
      message.error(result.message || '启用失败');
    }
  } finally {
    loading.value = false;
  }
}

async function handleDisable() {
  if (disableCode.value.length !== 6) return;

  loading.value = true;
  try {
    const result = await disableTOTP(disableCode.value);
    if (result.success) {
      message.success('两步验证已禁用');
      showDisableModal.value = false;
      disableCode.value = '';
      await authStore.fetchUser();
      emit('updated');
    } else {
      message.error(result.message || '禁用失败');
    }
  } finally {
    loading.value = false;
  }
}

function copySecret() {
  if (setupData.value?.secret) {
    navigator.clipboard.writeText(setupData.value.secret);
    message.success('密钥已复制');
  }
}
</script>
