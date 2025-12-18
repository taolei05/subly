<template>
  <n-modal
    v-model:show="visible"
    preset="card"
    title="附件列表"
    :style="{ width: '600px', maxWidth: '90vw' }"
  >
    <div v-if="loading" style="text-align: center; padding: 40px;">
      <n-spin size="medium" />
    </div>
    
    <n-empty v-else-if="attachments.length === 0" description="暂无附件" />
    
    <n-list v-else bordered>
      <n-list-item v-for="attachment in attachments" :key="attachment.id">
        <template #prefix>
          <n-icon size="24" :color="getFileIconColor(attachment.mime_type)">
            <component :is="getFileIcon(attachment.mime_type)" />
          </n-icon>
        </template>
        <n-thing :title="attachment.original_name">
          <template #description>
            <n-space size="small">
              <n-text depth="3">{{ formatFileSize(attachment.size) }}</n-text>
              <n-text depth="3">{{ formatDate(attachment.created_at) }}</n-text>
            </n-space>
          </template>
        </n-thing>
        <template #suffix>
          <n-space>
            <n-button size="small" quaternary @click="handlePreview(attachment)">
              预览
            </n-button>
            <n-button size="small" quaternary @click="handleDownload(attachment)">
              下载
            </n-button>
          </n-space>
        </template>
      </n-list-item>
    </n-list>

    <!-- 文件预览弹窗 -->
    <n-modal
      v-model:show="previewVisible"
      preset="card"
      :title="previewAttachment?.original_name || '预览'"
      :style="{ width: '90vw', maxWidth: '1000px' }"
    >
      <div class="preview-container">
        <div v-if="previewLoading" style="text-align: center; padding: 40px;">
          <n-spin size="medium" />
        </div>
        
        <!-- PDF 预览 -->
        <div v-else-if="previewType === 'pdf'" class="pdf-preview">
          <VuePdfEmbed :source="previewUrl" />
        </div>
        
        <!-- Word 预览 -->
        <div v-else-if="previewType === 'docx'" ref="docxContainer" class="docx-preview" />
        
        <!-- 图片预览 -->
        <n-image
          v-else-if="previewType === 'image'"
          :src="previewUrl"
          :alt="previewAttachment?.original_name"
          object-fit="contain"
          style="max-width: 100%; max-height: 70vh;"
        />
      </div>
    </n-modal>
  </n-modal>
</template>

<script setup lang="ts">
import { renderAsync } from 'docx-preview';
import { useMessage } from 'naive-ui';
import { h, nextTick, ref, watch } from 'vue';
import VuePdfEmbed from 'vue-pdf-embed';
import { attachmentApi } from '../../api/attachment';
import type { Attachment } from '../../types';

const props = defineProps<{
  show: boolean;
  subscriptionId: number | null;
}>();

const emit = defineEmits<{
  'update:show': [value: boolean];
}>();

const message = useMessage();
const visible = ref(false);
const loading = ref(false);
const attachments = ref<Attachment[]>([]);

// 预览相关
const previewVisible = ref(false);
const previewLoading = ref(false);
const previewAttachment = ref<Attachment | null>(null);
const previewUrl = ref('');
const previewType = ref<'pdf' | 'docx' | 'image' | null>(null);
const docxContainer = ref<HTMLElement | null>(null);

// 同步 visible
watch(
  () => props.show,
  (val) => {
    visible.value = val;
    if (val && props.subscriptionId) {
      loadAttachments();
    }
  },
);

watch(visible, (val) => {
  emit('update:show', val);
});

// 监听预览弹窗关闭，释放 blob URL
watch(previewVisible, (val) => {
  if (!val && previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value);
    previewUrl.value = '';
  }
});

// 文件图标
const PdfIcon = {
  render: () =>
    h(
      'svg',
      {
        xmlns: 'http://www.w3.org/2000/svg',
        viewBox: '0 0 24 24',
        fill: 'currentColor',
      },
      [
        h('path', {
          d: 'M12 16H8V8h4a4 4 0 1 1 0 8zm-2-6v4h2a2 2 0 1 0 0-4h-2zm5-6H5v16h14V8h-4V4zM3 2.992C3 2.444 3.447 2 3.999 2H16l5 5v13.993A1 1 0 0 1 20.007 22H3.993A1 1 0 0 1 3 21.008V2.992z',
        }),
      ],
    ),
};

const WordIcon = {
  render: () =>
    h(
      'svg',
      {
        xmlns: 'http://www.w3.org/2000/svg',
        viewBox: '0 0 24 24',
        fill: 'currentColor',
      },
      [
        h('path', {
          d: 'M16 8v8H8V8h8zm2-2H6v12h12V6zM4 4h16v16H4V4zm5 5v6h2l1-3 1 3h2V9h-1.5v3l-1-3h-1l-1 3V9H9z',
        }),
      ],
    ),
};

const ImageIcon = {
  render: () =>
    h(
      'svg',
      {
        xmlns: 'http://www.w3.org/2000/svg',
        viewBox: '0 0 24 24',
        fill: 'currentColor',
      },
      [
        h('path', {
          d: 'M4.828 21l-.02.02-.021-.02H2.992A.993.993 0 0 1 2 20.007V3.993A1 1 0 0 1 2.992 3h18.016c.548 0 .992.445.992.993v16.014a1 1 0 0 1-.992.993H4.828zM20 15V5H4v14L14 9l6 6zm0 2.828l-6-6L6.828 19H20v-1.172zM8 11a2 2 0 1 1 0-4 2 2 0 0 1 0 4z',
        }),
      ],
    ),
};

function getFileIcon(mimeType: string) {
  if (mimeType === 'application/pdf') return PdfIcon;
  if (mimeType.includes('word')) return WordIcon;
  return ImageIcon;
}

function getFileIconColor(mimeType: string) {
  if (mimeType === 'application/pdf') return '#e53935';
  if (mimeType.includes('word')) return '#2196f3';
  return '#4caf50';
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('zh-CN');
}

async function loadAttachments() {
  if (!props.subscriptionId) return;

  loading.value = true;
  try {
    const res = await attachmentApi.getBySubscription(props.subscriptionId);
    if (res.success && res.data) {
      attachments.value = res.data;
    }
  } catch (error) {
    console.error('Failed to load attachments:', error);
  } finally {
    loading.value = false;
  }
}

async function handlePreview(attachment: Attachment) {
  previewAttachment.value = attachment;
  previewLoading.value = true;
  previewVisible.value = true;

  if (attachment.mime_type === 'application/pdf') {
    previewType.value = 'pdf';
  } else if (attachment.mime_type.includes('word')) {
    previewType.value = 'docx';
  } else {
    previewType.value = 'image';
  }

  try {
    const blob = await attachmentApi.getBlob(attachment.id);
    previewUrl.value = URL.createObjectURL(blob);

    if (previewType.value === 'docx') {
      await nextTick();
      if (docxContainer.value) {
        docxContainer.value.innerHTML = '';
        await renderAsync(blob, docxContainer.value);
      }
    }
  } catch (error) {
    message.error('预览失败，请重试');
    console.error('Preview error:', error);
  } finally {
    previewLoading.value = false;
  }
}

function handleDownload(attachment: Attachment) {
  const url = attachmentApi.getUrl(attachment.id, true);
  window.open(url, '_blank');
}
</script>

<style scoped>
.preview-container {
  max-height: 70vh;
  overflow: auto;
}

.pdf-preview {
  background: #f5f5f5;
  padding: 16px;
}

.docx-preview {
  background: white;
  padding: 16px;
  min-height: 200px;
}

.docx-preview :deep(.docx-wrapper) {
  background: white;
}
</style>
