import { defineComponent, h, ref } from 'vue'
import { ElCheckbox, ElDatePicker, ElMessageBox } from 'element-plus'
import { downloadTaskIds, formatDownloadBatchDateRange } from '@shared/download-batch'

function createBatchId() {
  if (globalThis.crypto?.randomUUID) return `batch_${globalThis.crypto.randomUUID()}`
  return `batch_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

let activeBatchOptionsPromise = null
const rememberedBatchOptions = new Map()

export function openDownloadBatchOptions(options = {}) {
  if (activeBatchOptionsPromise) return activeBatchOptionsPromise
  activeBatchOptionsPromise = showDownloadBatchOptions(options).finally(() => {
    activeBatchOptionsPromise = null
  })
  return activeBatchOptionsPromise
}

async function showDownloadBatchOptions({ label, sourceType = 'media' }) {
  const remembered = rememberedBatchOptions.get(sourceType)
  const dateRange = ref(Array.isArray(remembered?.dateRange) ? [...remembered.dateRange] : [])
  const autoStart = ref(remembered?.autoStart ?? true)
  const dateFieldLabel = sourceType === 'feeds' ? '发布日期' : '上传日期'

  const OptionsContent = defineComponent({
    name: 'DownloadBatchOptionsContent',
    setup() {
      return () =>
        h('div', { class: 'download-batch-options' }, [
          h('section', { class: 'download-batch-section', 'aria-labelledby': 'batch-date-label' }, [
            h('div', { class: 'download-batch-heading' }, [
              h('label', { id: 'batch-date-label', class: 'download-batch-label' }, '下载范围'),
              h('span', { class: 'download-batch-optional' }, '可选')
            ]),
            h(
              'p',
              { class: 'download-batch-description' },
              `按${dateFieldLabel}筛选，留空将下载全部内容。`
            ),
            h(ElDatePicker, {
              modelValue: dateRange.value,
              'onUpdate:modelValue': (value) => {
                dateRange.value = Array.isArray(value) ? value : []
              },
              type: 'daterange',
              valueFormat: 'YYYY-MM-DD',
              format: 'YYYY年MM月DD日',
              rangeSeparator: '至',
              startPlaceholder: '开始日期',
              endPlaceholder: '结束日期',
              clearable: true,
              teleported: true,
              ariaLabel: `${dateFieldLabel}范围`,
              style: { width: '100%' }
            })
          ]),
          h(
            ElCheckbox,
            {
              modelValue: autoStart.value,
              'onUpdate:modelValue': (value) => {
                autoStart.value = Boolean(value)
              },
              class: 'download-batch-autostart'
            },
            {
              default: () =>
                h('span', { class: 'download-batch-autostart-copy' }, [
                  h('span', { class: 'download-batch-autostart-title' }, '创建后立即下载'),
                  h(
                    'span',
                    { class: 'download-batch-autostart-hint' },
                    autoStart.value
                      ? '任务创建后会自动开始，可在下载管理中暂停。'
                      : '任务会以暂停状态加入下载管理。'
                  )
                ])
            }
          )
        ])
    }
  })

  try {
    await ElMessageBox({
      title: '批量下载设置',
      message: h(OptionsContent),
      showCancelButton: true,
      confirmButtonText: '创建下载任务',
      cancelButtonText: '取消',
      autofocus: false,
      closeOnClickModal: false,
      distinguishCancelAndClose: true,
      customClass: 'download-batch-message-box'
    })
  } catch (action) {
    if (action === 'cancel' || action === 'close') return null
    throw action
  }

  rememberedBatchOptions.set(sourceType, {
    dateRange: [...dateRange.value],
    autoStart: autoStart.value
  })

  return {
    id: createBatchId(),
    label: String(label || '批量下载').slice(0, 80),
    sourceType,
    autoStart: autoStart.value,
    dateRange:
      dateRange.value.length === 2 ? { start: dateRange.value[0], end: dateRange.value[1] } : null
  }
}

export async function finishDownloadBatch(batch, cancelled = false) {
  if (!batch?.id) return null
  return window.QzoneAPI.download.finishBatch({ batchId: batch.id, cancelled })
}

export function batchTaskIds(result) {
  return downloadTaskIds(result)
}

export function batchSummaryText(summary, fallbackTaskCount = 0) {
  const matched = Number(summary?.matched ?? fallbackTaskCount) || 0
  const skipped = Number(summary?.skipped) || 0
  const missing = Number(summary?.missing_time) || 0
  const dateLabel = summary?.date_label || formatDownloadBatchDateRange(summary || {})
  const queueText = summary?.auto_start === false ? '，已加入队列，等待手动开始' : ''
  const parts = [`${dateLabel}，匹配 ${matched} 项`]
  if (skipped) parts.push(`跳过 ${skipped} 项`)
  if (missing) parts.push(`其中 ${missing} 项缺少时间`)
  return `${parts.join('，')}${queueText}`
}
