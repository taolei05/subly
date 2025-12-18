<template>
  <div class="attachment-upload">
    <n-upload
      :custom-request="handleUpload"
      :max="10"
      :accept="acceptTypes"
      :disabled="readonly || uploading"
      multiple
      @before-upload="handleBeforeUpload"
    >
      <n-upload-dragger>
        <div style="margin-bottom: 12px;">
          <n-icon size="48" :depth="3">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 12.586l4.243 4.242-1.415 1.415L13 16.415V22h-2v-5.587l-1.828 1.83-1.415-1.415L12 12.586zM12 2a7.001 7.001 0 0 1 6.954 6.194 5.5 5.5 0 0 1-.953 10.784v-2.014a3.5 3.5 0 1 0-1.112-6.91 5 5 0 1 0-9.777 0 3.5 3.5 0 0 0-1.292 6.88l.18.03v2.014a5.5 5.5 0 0 1-.954-10.784A7 7 0 0 1 12 2z"/>
            </svg>
          </n-icon>
        </div>
        <n-text style="font-size: 16px;">点击或拖拽文件到此区域上传</n-text>
        <n-p depth="3" style="margin: 8px 0 0 0;">
          支持 PDF、Word、PNG、JPG，单个文件最大 10MB
        </n-p>
      </n-upload-dragger>
    </n-upload>

    <!-- 待上传文件列表（新建订阅时） -->
    <div v-if="pendingFiles.length > 0" class="attachment-list">
      <n-list bordered>
        <n-list-item v-for="(file, index) in pendingFiles" :key="index">
          <template #prefix>
            <n-icon size="24" :color="getFileIconColor(file.type)">
              <component :is="getFileIcon(file.type)" />
            </n-icon>
          </template>
          <n-thing :title="file.name">
            <template #description>
              <n-space size="small">
                <n-text depth="3">{{ formatFileSize(file.size) }}</n-text>
                <n-tag size="small" type="warning">待上传</n-tag>
              </n-space>
            </template>
          </n-thing>
          <template #suffix>
            <n-button 
              size="small" 
              quaternary 
              type="error" 
              :disabled="readonly"
              @click="removePendingFile(index)"
            >
              移除
            </n-button>
          </template>
        </n-list-item>
      </n-list>
    </div>

    <!-- 已上传附件列表 -->
    <div v-if="attachments.length > 0" class="attachment-list">
      <n-list bordered>
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
              <n-button 
                size="small" 
                quaternary 
                type="error" 
                :disabled="readonly"
                @click="handleDelete(attachment)"
              >
                删除
              </n-button>
            </n-space>
          </template>
        </n-list-item>
      </n-list>
    </div>

    <!-- 预览弹窗 -->
    <n-modal
      v-model:show="previewVisible"
      preset="card"
      :title="previewAttachment?.original_name || '预览'"
      :style="{ width: '90vw', maxWidth: '1000px' }"
    >
      <div class="preview-container">
        <!-- PDF 预览 -->
        <div v-if="previewType === 'pdf'" class="pdf-preview">
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
  </div>
</template>

<script setup lang="ts">
import { renderAsync } from 'docx-preview';
import type { UploadCustomRequestOptions, UploadFileInfo } from 'naive-ui';
import { useMessage } from 'naive-ui';
import { h, nextTick, ref, watch } from 'vue';
import VuePdfEmbed from 'vue-pdf-embed';
import { attachmentApi } from '../../api/attachment';
import type { Attachment } from '../../types';

const props = defineProps<{
  subscriptionId: number | null;
  readonly?: boolean;
}>();

const emit = defineEmits<{
  change: [attachments: Attachment[]];
  'pending-files-change': [files: File[]];
}>();

const message = useMessage();
const uploading = ref(false);
const attachments = ref<Attachment[]>([]);
const pendingFiles = ref<File[]>([]); // 待上传文件（新建订阅时暂存）

// 预览相关
const previewVisible = ref(false);
const previewAttachment = ref<Attachment | null>(null);
const previewUrl = ref('');
const previewType = ref<'pdf' | 'docx' | 'image' | null>(null);
const docxContainer = ref<HTMLElement | null>(null);

const acceptTypes = '.pdf,.docx,.png,.jpg,.jpeg';

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

// 加载附件列表
async function loadAttachments() {
  if (!props.subscriptionId) {
    attachments.value = [];
    return;
  }

  try {
    const res = await attachmentApi.getBySubscription(props.subscriptionId);
    if (res.success && res.data) {
      attachments.value = res.data;
      emit('change', attachments.value);
    }
  } catch (error) {
    console.error('Failed to load attachments:', error);
  }
}

// 监听 subscriptionId 变化
watch(() => props.subscriptionId, loadAttachments, { immediate: true });

// 上传前验证
function handleBeforeUpload({ file }: { file: UploadFileInfo }) {
  const maxSize = 10 * 1024 * 1024;
  if (file.file && file.file.size > maxSize) {
    message.error('文件大小不能超过 10MB');
    return false;
  }
  return true;
}

// 自定义上传
async function handleUpload({
  file,
  onFinish,
  onError,
}: UploadCustomRequestOptions) {
  if (!file.file) {
    onError();
    return;
  }

  // 如果没有 subscriptionId，暂存文件
  if (!props.subscriptionId) {
    pendingFiles.value.push(file.file);
    emit('pending-files-change', pendingFiles.value);
    onFinish();
    return;
  }

  uploading.value = true;
  try {
    const res = await attachmentApi.upload(props.subscriptionId, file.file);
    if (res.success && res.data) {
      attachments.value.unshift(res.data);
      emit('change', attachments.value);
      message.success('上传成功');
      onFinish();
    } else {
      message.error(res.message || '上传失败');
      onError();
    }
  } catch (error: unknown) {
    const err = error as Error;
    message.error(err.message || '上传失败');
    onError();
  } finally {
    uploading.value = false;
  }
}

// 移除待上传文件
function removePendingFile(index: number) {
  pendingFiles.value.splice(index, 1);
  emit('pending-files-change', pendingFiles.value);
}

// 清空待上传文件
function clearPendingFiles() {
  pendingFiles.value = [];
  emit('pending-files-change', []);
}

// 预览附件
async function handlePreview(attachment: Attachment) {
  previewAttachment.value = attachment;
  previewUrl.value = attachmentApi.getUrl(attachment.id);

  if (attachment.mime_type === 'application/pdf') {
    previewType.value = 'pdf';
  } else if (attachment.mime_type.includes('word')) {
    previewType.value = 'docx';
  } else {
    previewType.value = 'image';
  }

  previewVisible.value = true;

  // Word 文档需要特殊处理
  if (previewType.value === 'docx') {
    await nextTick();
    try {
      const response = await fetch(previewUrl.value);
      const blob = await response.blob();
      if (docxContainer.value) {
        docxContainer.value.innerHTML = '';
        await renderAsync(blob, docxContainer.value);
      }
    } catch (error) {
      message.error('Word 文档预览失败');
      console.error('Docx preview error:', error);
    }
  }
}

// 下载附件
function handleDownload(attachment: Attachment) {
  const url = attachmentApi.getUrl(attachment.id, true);
  window.open(url, '_blank');
}

// 删除附件
async function handleDelete(attachment: Attachment) {
  try {
    const res = await attachmentApi.delete(attachment.id);
    if (res.success) {
      attachments.value = attachments.value.filter(
        (a) => a.id !== attachment.id,
      );
      emit('change', attachments.value);
      message.success('删除成功');
    } else {
      message.error(res.message || '删除失败');
    }
  } catch (error: unknown) {
    const err = error as Error;
    message.error(err.message || '删除失败');
  }
}

// 上传待上传的文件（订阅创建后调用）
async function uploadPendingFiles(subscriptionId: number): Promise<boolean> {
  if (pendingFiles.value.length === 0) return true;

  let allSuccess = true;
  for (const file of pendingFiles.value) {
    try {
      const res = await attachmentApi.upload(subscriptionId, file);
      if (!res.success) {
        allSuccess = false;
      }
    } catch {
      allSuccess = false;
    }
  }

  pendingFiles.value = [];
  emit('pending-files-change', []);
  return allSuccess;
}

// 暴露方法供父组件调用
defineExpose({
  loadAttachments,
  uploadPendingFiles,
  clearPendingFiles,
});
</script>

<style scoped>
.attachment-upload {
  margin-top: 16px;
}

.attachment-list {
  margin-top: 16px;
}

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
