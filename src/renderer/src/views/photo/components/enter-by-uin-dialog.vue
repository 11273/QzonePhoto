<template>
  <el-dialog
    :model-value="visible"
    width="min(520px, calc(100vw - 32px))"
    :show-close="false"
    :close-on-click-modal="false"
    :close-on-press-escape="true"
    :append-to-body="true"
    class="enter-by-uin-dialog dark-theme ds-dialog"
    @update:model-value="handleVisibleChange"
    @closed="reset"
  >
    <template #header>
      <div class="dialog-header">
        <div class="header-title">
          <el-icon class="header-icon"><Search /></el-icon>
          <span>查找好友空间</span>
        </div>
        <el-button
          text
          class="close-btn"
          aria-label="关闭查找好友空间"
          title="关闭"
          @click="handleClose"
        >
          <el-icon><Close /></el-icon>
        </el-button>
      </div>
    </template>

    <!-- 搜索栏 -->
    <div class="search-bar">
      <el-input
        ref="inputRef"
        v-model="inputUin"
        placeholder="输入 QQ 号 (5-11 位数字)"
        aria-label="QQ 号"
        size="large"
        maxlength="11"
        clearable
        :prefix-icon="User"
        :disabled="loading"
        @input="onInputChange"
        @keydown.enter.prevent="handleQuery"
      />
      <el-button
        type="primary"
        size="large"
        class="query-btn"
        :loading="loading"
        :disabled="!isValidUin"
        @click="handleQuery"
      >
        查询
      </el-button>
    </div>

    <!-- 错误提示 -->
    <transition name="fade">
      <div v-if="errorMsg" class="error-tip" role="alert" aria-live="assertive">
        <el-icon><WarningFilled /></el-icon>
        <span>{{ errorMsg }}</span>
      </div>
    </transition>
    <transition name="fade">
      <div v-if="noticeMsg" class="info-tip" role="status" aria-live="polite">
        <el-icon><InfoFilled /></el-icon>
        <span>{{ noticeMsg }}</span>
      </div>
    </transition>

    <!-- 加载骨架屏 -->
    <div v-if="loading" class="result-skeleton" role="status" aria-label="正在查询好友资料">
      <el-skeleton animated>
        <template #template>
          <div class="skeleton-hero">
            <el-skeleton-item
              variant="image"
              style="width: 72px; height: 72px; border-radius: 12px"
            />
            <div style="flex: 1; margin-left: 16px">
              <el-skeleton-item variant="h3" style="width: 50%" />
              <el-skeleton-item variant="text" style="width: 30%; margin-top: 8px" />
            </div>
          </div>
          <div class="skeleton-stats">
            <el-skeleton-item
              v-for="i in 4"
              :key="i"
              variant="rect"
              style="height: 56px; border-radius: 8px"
            />
          </div>
          <div class="skeleton-info">
            <el-skeleton-item variant="text" style="width: 100%" />
            <el-skeleton-item variant="text" style="width: 80%; margin-top: 8px" />
            <el-skeleton-item variant="text" style="width: 60%; margin-top: 8px" />
          </div>
        </template>
      </el-skeleton>
    </div>

    <!-- 资料卡 -->
    <transition name="card-slide">
      <div v-if="!loading && cardInfo" class="profile-card">
        <!-- Hero 区域 -->
        <div class="hero">
          <div class="hero-bg"></div>
          <div class="hero-content">
            <el-avatar shape="circle" :size="76" :src="avatarUrl" class="hero-avatar">
              {{ (cardInfo.nickname || '?')[0] }}
            </el-avatar>
            <div class="hero-info">
              <div class="hero-nickname">
                <span class="nick-text">{{ cardInfo.nickname || 'QQ 用户' }}</span>
                <span v-if="cardInfo.gender === 1" class="badge gender-male">
                  <Mars :size="11" />
                  男
                </span>
                <span v-else-if="cardInfo.gender === 2" class="badge gender-female">
                  <Venus :size="11" />
                  女
                </span>
                <span v-if="cardInfo.vipLevel > 0" class="badge vip" title="黄钻等级">
                  <Gem :size="11" />
                  {{ cardInfo.vipLevel }}
                </span>
              </div>
              <div
                class="hero-uin"
                role="button"
                tabindex="0"
                aria-label="复制 QQ 号"
                @click="copyUin"
                @keydown.enter.prevent="copyUin"
                @keydown.space.prevent="copyUin"
              >
                <span>QQ：{{ inputUin }}</span>
                <el-icon class="copy-ico" title="复制"><DocumentCopy /></el-icon>
              </div>
              <div v-if="cardInfo.signature" class="hero-signature" :title="cardInfo.signature">
                "{{ cardInfo.signature }}"
              </div>
            </div>
          </div>
        </div>

        <!-- 数据栏 -->
        <div v-if="hasStats" class="stats-grid">
          <div v-if="cardInfo.intimacyScore" class="stat-item">
            <div class="stat-num intimacy">{{ formatNum(cardInfo.intimacyScore) }}</div>
            <div class="stat-label">亲密度</div>
          </div>
          <div v-if="cardInfo.commfrd" class="stat-item">
            <div class="stat-num">{{ formatNum(cardInfo.commfrd) }}</div>
            <div class="stat-label">共同好友</div>
          </div>
          <div v-if="albumCount != null && albumCount !== 0" class="stat-item">
            <div class="stat-num">{{ formatNum(albumCount) }}</div>
            <div class="stat-label">相册数</div>
          </div>
          <div v-if="diskUsedMB != null && diskUsedMB !== 0" class="stat-item">
            <div class="stat-num">{{ diskUsedText }}</div>
            <div class="stat-label">空间容量</div>
          </div>
        </div>

        <!-- 详细资料 -->
        <div v-if="hasDetails" class="detail-list">
          <div v-if="cardInfo.realname" class="detail-row">
            <span class="detail-key">真实姓名</span>
            <span class="detail-val">{{ cardInfo.realname }}</span>
          </div>
          <div v-if="birthdayText" class="detail-row">
            <span class="detail-key">生日</span>
            <span class="detail-val">
              {{ birthdayText }}
              <span v-if="ageText" class="muted">（{{ ageText }}）</span>
            </span>
          </div>
          <div v-if="cardInfo.astroText || cardInfo.zodiacText" class="detail-row">
            <span class="detail-key">星座 / 生肖</span>
            <span class="detail-val">
              {{ [cardInfo.astroText, cardInfo.zodiacText].filter(Boolean).join(' · ') }}
            </span>
          </div>
          <div v-if="cardInfo.location" class="detail-row">
            <span class="detail-key">所在地</span>
            <span class="detail-val">{{ cardInfo.location }}</span>
          </div>
          <div v-if="cardInfo.hometown" class="detail-row">
            <span class="detail-key">家乡</span>
            <span class="detail-val">{{ cardInfo.hometown }}</span>
          </div>
          <div v-if="cardInfo.relationStatus" class="detail-row">
            <span class="detail-key">关系状态</span>
            <span class="detail-val">{{ cardInfo.relationStatus }}</span>
          </div>
          <div v-if="cardInfo.career" class="detail-row">
            <span class="detail-key">职业</span>
            <span class="detail-val">{{ cardInfo.career }}</span>
          </div>
        </div>

        <!-- 关系标签 -->
        <div class="badges-row">
          <span v-if="cardInfo.isFriend" class="rel-badge friend">QQ 好友</span>
          <span v-else class="rel-badge stranger">陌生人</span>
          <span v-if="cardInfo.isSpecial" class="rel-badge special">特别关心</span>
          <span v-if="!hasDetails && !cardInfo.signature" class="rel-badge private"
            >资料未公开</span
          >
        </div>
      </div>
    </transition>

    <!-- 空状态 -->
    <div v-if="!loading && !cardInfo && !errorMsg" class="empty-state" role="status">
      <el-icon class="empty-icon"><Search /></el-icon>
      <div class="empty-text">输入任意 QQ 号查询资料并进入其空间</div>
      <div class="empty-sub">支持查询陌生人/好友的公开资料，包括昵称、签名、相册数等</div>
    </div>

    <template #footer>
      <div class="footer-row">
        <el-button v-if="cardInfo" text class="footer-link" @click="openWebSpace">
          <el-icon><Monitor /></el-icon>
          网页打开
        </el-button>
        <div class="footer-spacer"></div>
        <el-button size="default" @click="handleClose">取消</el-button>
        <el-button
          type="primary"
          size="default"
          class="enter-btn"
          :disabled="!canEnter"
          @click="handleEnter"
        >
          <el-icon><Right /></el-icon>
          进入相册
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, nextTick, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  WarningFilled,
  InfoFilled,
  Search,
  User,
  Close,
  DocumentCopy,
  Monitor,
  Right
} from '@element-plus/icons-vue'
import { Gem, Mars, Venus } from '@lucide/vue'
import { useUserStore } from '@renderer/store/user.store'
import { copyToClipboard } from '@renderer/utils'
import { formatBytes } from '@renderer/utils/formatters'
import { resolveSelfQzoneUin } from '@renderer/utils/qzone-identity'

const props = defineProps({
  visible: { type: Boolean, default: false }
})
const emit = defineEmits(['update:visible', 'enter-friend'])

const userStore = useUserStore()

const inputRef = ref()
const inputUin = ref('')
const loading = ref(false)
const errorMsg = ref('')
const noticeMsg = ref('')
const cardInfo = ref(null)
const albumCount = ref(null)
const diskUsedMB = ref(null)

const ASTRO_MAP = [
  '',
  '水瓶座',
  '双鱼座',
  '白羊座',
  '金牛座',
  '双子座',
  '巨蟹座',
  '狮子座',
  '处女座',
  '天秤座',
  '天蝎座',
  '射手座',
  '摩羯座'
]

const ZODIAC_MAP = ['', '鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪']

// QQ 空间名片接口的关系状态映射
const RELATION_MAP = {
  1: '单身',
  2: '热恋中',
  3: '已婚',
  4: '同居',
  5: '订婚',
  6: '分居',
  7: '离婚',
  8: '保密'
}

// QQ 号 5-11 位（历史最长 11 位，新号段含 11 位），首位非 0
const isValidUin = computed(() => /^[1-9]\d{4,10}$/.test(inputUin.value.trim()))
const canEnter = computed(() => isValidUin.value && cardInfo.value)

const avatarUrl = computed(() => {
  const u = inputUin.value.trim()
  return u ? `https://qlogo4.store.qq.com/qzone/${u}/${u}/100` : ''
})

const formatNum = (n) => {
  if (n == null) return '--'
  const num = Number(n)
  if (Number.isNaN(num)) return '--'
  if (num >= 10000) return (num / 10000).toFixed(1) + 'w'
  return String(num)
}

const diskUsedText = computed(() => {
  if (diskUsedMB.value == null) return '--'
  return formatBytes(diskUsedMB.value * 1024 * 1024)
})

const birthdayText = computed(() => {
  const c = cardInfo.value
  if (!c) return ''
  const { birthyear, birthmonth, birthday } = c
  if (birthyear && birthmonth && birthday) {
    return `${birthyear}年${birthmonth}月${birthday}日`
  }
  if (birthmonth && birthday) {
    return `${birthmonth}月${birthday}日`
  }
  return ''
})

const ageText = computed(() => {
  const y = cardInfo.value?.birthyear
  if (!y || y < 1900) return ''
  const age = new Date().getFullYear() - Number(y)
  if (age < 0 || age > 120) return ''
  return `${age} 岁`
})

const hasStats = computed(() => {
  const c = cardInfo.value
  if (!c) return false
  return Boolean(
    c.intimacyScore ||
    c.commfrd ||
    (albumCount.value != null && albumCount.value !== 0) ||
    (diskUsedMB.value != null && diskUsedMB.value !== 0)
  )
})

const hasDetails = computed(() => {
  const c = cardInfo.value
  if (!c) return false
  return Boolean(
    c.realname ||
    birthdayText.value ||
    c.astroText ||
    c.zodiacText ||
    c.location ||
    c.hometown ||
    c.relationStatus ||
    c.career
  )
})

watch(
  () => props.visible,
  (v) => {
    if (v) nextTick(() => inputRef.value?.focus?.())
  }
)

const onInputChange = (val) => {
  const digits = (val || '').replace(/\D/g, '')
  if (digits !== val) inputUin.value = digits
  errorMsg.value = ''
  noticeMsg.value = ''
  cardInfo.value = null
  albumCount.value = null
  diskUsedMB.value = null
}

const copyUin = () => copyToClipboard(inputUin.value, 'QQ 号')

const handleQuery = async () => {
  const uin = inputUin.value.trim()
  if (!isValidUin.value) {
    errorMsg.value = '请输入合法的 QQ 号 (5-11 位数字)'
    return
  }
  if (String(uin) === resolveSelfQzoneUin(userStore)) {
    errorMsg.value = '不能进入自己的空间'
    return
  }

  loading.value = true
  errorMsg.value = ''
  noticeMsg.value = ''
  cardInfo.value = null
  albumCount.value = null
  diskUsedMB.value = null

  // 并行拉取：名片 + 相册列表（拿相册数 / 容量 + 用户存在性）
  const [cardRes, albumRes] = await Promise.allSettled([
    window.QzoneAPI.getPersonalCard({ targetUin: uin }, { skipAuthCheck: true }),
    window.QzoneAPI.getPhotoList(
      { hostUin: uin, pageStart: 0, pageNum: 1 },
      { skipAuthCheck: true }
    )
  ])

  // === 解析相册接口 ===
  // QZone 接口约定：code === 0 为成功；非 0 一般是用户不存在 / 未开通空间 / 拒绝访问
  let albumOk = false
  if (albumRes.status === 'fulfilled') {
    const r = albumRes.value
    const code = r?.code ?? r?.ret
    const data = r?.data
    if ((code === 0 || code == null) && data && typeof data === 'object') {
      albumOk = true
      albumCount.value = data.albumsInUser ?? null
      diskUsedMB.value = data.user?.diskused ?? null
    }
  }

  // === 解析名片接口 ===
  // 名片接口对不存在的 uin 也常返回 { uin: 输入值 } 的空壳 —— 必须验证至少有一项实质字段
  let parsedCard = null
  if (cardRes.status === 'fulfilled') {
    const r = cardRes.value
    if (r && typeof r === 'object') {
      const card = {
        nickname: r.nickname || r.nick || r.name || '',
        realname: r.realname || '',
        intimacyScore: Number(r.intimacyScore ?? r.intimacy_score ?? 0) || 0,
        gender: Number(r.gender) || 0,
        astro: Number(r.astro) || 0,
        astroText: ASTRO_MAP[r.astro] || '',
        year: Number(r.year) || 0,
        zodiacText: ZODIAC_MAP[r.year] || '',
        birthyear: Number(r.birthyear) || 0,
        birthmonth: Number(r.birthmonth) || 0,
        birthday: Number(r.birthday) || 0,
        location: r.from || '',
        hometown: [r.hcountry_name, r.hprovince_name, r.hcity_name].filter(Boolean).join(' ') || '',
        signature: r.desc || r.mood || r.signature || '',
        vipLevel: Number(r.vip || r.vipLevel || r.qzone_vip) || 0,
        commfrd: Number(r.commfrd) || 0,
        isFriend: r.isFriend === 1 || r.is_friend === 1 || r.isfriend === 1 || r.commfrd > 0,
        isSpecial: r.isSpecialCare === 1 || r.is_special === 1,
        relationStatus: RELATION_MAP[r.marriage] || RELATION_MAP[r.marital] || '',
        career: r.career || r.profession || ''
      }
      // "至少一项实质字段非空" 才认为是真实存在的用户
      const hasRealData =
        card.nickname ||
        card.realname ||
        card.signature ||
        card.location ||
        card.hometown ||
        card.birthyear ||
        card.astro ||
        card.gender ||
        card.intimacyScore ||
        card.commfrd ||
        card.vipLevel
      if (hasRealData) parsedCard = card
    }
  }

  // === 综合判定：用户是否存在 ===
  if (!parsedCard && !albumOk) {
    errorMsg.value = '该 QQ 号不存在，或空间已注销 / 未开通'
    loading.value = false
    return
  }

  if (parsedCard) {
    cardInfo.value = parsedCard
  } else {
    // 仅相册接口可用：构造最小卡片
    cardInfo.value = {
      nickname: '',
      gender: 0,
      vipLevel: 0,
      intimacyScore: 0,
      commfrd: 0,
      isFriend: false
    }
    noticeMsg.value = '对方没有公开资料，仍可继续查看允许访问的相册。'
  }

  loading.value = false
}

const handleEnter = () => {
  const uin = inputUin.value.trim()
  if (!canEnter.value) return
  const friend = {
    uin,
    name: cardInfo.value?.nickname || `QQ ${uin}`,
    img: `https://qlogo4.store.qq.com/qzone/${uin}/${uin}/50`,
    score: cardInfo.value?.intimacyScore || 0
  }
  emit('enter-friend', friend)
  emit('update:visible', false)
  ElMessage.success(`正在进入 ${friend.name} 的空间`)
}

const openWebSpace = async () => {
  const uin = inputUin.value.trim()
  if (!uin) return
  try {
    await window.api.invoke('window:openQzoneWeb', {
      uin: userStore.Uin,
      p_skey: userStore.PSkey,
      targetUin: uin
    })
  } catch (e) {
    console.error('[EnterByUin] 打开网页空间失败:', e)
    ElMessage.error('打开网页空间失败')
  }
}

const handleClose = () => emit('update:visible', false)
const handleVisibleChange = (v) => emit('update:visible', v)

const reset = () => {
  inputUin.value = ''
  loading.value = false
  errorMsg.value = ''
  noticeMsg.value = ''
  cardInfo.value = null
  albumCount.value = null
  diskUsedMB.value = null
}
</script>

<style scoped>
/* ===== Header ===== */
.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: var(--theme-text-primary);
}

.header-icon {
  font-size: 16px;
  color: var(--theme-brand-accent);
}

.close-btn {
  color: var(--theme-text-muted);
  padding: 4px;
}

.close-btn:hover {
  color: var(--theme-text-primary);
  background: var(--theme-surface-hover);
}

/* ===== 搜索栏 ===== */
.search-bar {
  display: flex;
  gap: 10px;
  align-items: center;
}

.search-bar :deep(.el-input) {
  flex: 1;
}

.search-bar :deep(.el-input__wrapper) {
  background: var(--theme-surface-soft);
  border-radius: var(--theme-radius-md);
  box-shadow: inset 0 0 0 1px var(--theme-border);
}

.search-bar :deep(.el-input__wrapper.is-focus) {
  box-shadow:
    inset 0 0 0 1px var(--theme-brand-accent),
    0 0 0 3px var(--theme-focus-ring);
}

.search-bar :deep(.el-input__inner) {
  color: var(--theme-text-primary);
  font-size: 14px;
}

.query-btn {
  background: var(--theme-brand);
  border: none;
  border-radius: var(--theme-radius-md);
  padding: 0 22px;
  font-weight: 600;
  box-shadow: var(--theme-shadow-brand);
  transition:
    color var(--ds-dur-fast) var(--ds-ease-soft),
    background-color var(--ds-dur-fast) var(--ds-ease-soft),
    border-color var(--ds-dur-fast) var(--ds-ease-soft),
    box-shadow var(--ds-dur-fast) var(--ds-ease-soft);
}

.query-btn:hover:not(:disabled) {
  background: var(--theme-brand-hover);
  box-shadow: var(--theme-shadow-brand);
}

.query-btn:disabled {
  opacity: 0.4;
  background: var(--theme-surface-disabled);
  box-shadow: none;
}

/* ===== 错误提示 ===== */
.error-tip {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
  padding: 10px 14px;
  border-radius: 8px;
  background: var(--theme-danger-soft);
  border: 1px solid var(--theme-danger-border);
  color: var(--theme-danger-text);
  font-size: 13px;
}

.info-tip {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
  padding: 10px 14px;
  border: 1px solid var(--theme-info-border);
  border-radius: var(--theme-radius-md);
  color: var(--theme-info-text);
  background: var(--theme-info-soft);
  font-size: 13px;
}

/* ===== 骨架屏 ===== */
.result-skeleton {
  margin-top: 18px;
}

.skeleton-hero {
  display: flex;
  align-items: center;
  padding: 16px;
  background: var(--theme-surface-soft);
  border-radius: 12px;
}

.skeleton-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-top: 12px;
}

.skeleton-info {
  margin-top: 16px;
  padding: 14px;
  background: var(--theme-surface-soft);
  border-radius: 12px;
}

/* ===== 资料卡 ===== */
.profile-card {
  margin-top: 18px;
}

/* Hero 区 */
.hero {
  position: relative;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid var(--theme-border-subtle);
}

.hero-bg {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, var(--theme-brand-soft), var(--theme-surface-soft));
  opacity: 0.7;
}

.hero-bg::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(
    circle at 0% 0%,
    color-mix(in srgb, var(--theme-brand-accent) 18%, transparent) 0%,
    transparent 42%
  );
}

.hero-content {
  position: relative;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px 18px;
}

.hero-avatar {
  flex-shrink: 0;
  border: 2px solid var(--theme-border);
  box-shadow: var(--theme-shadow-sm);
}

.hero-info {
  flex: 1;
  min-width: 0;
}

.hero-nickname {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.nick-text {
  font-size: 18px;
  font-weight: 600;
  color: var(--theme-text-primary);
  line-height: 1.3;
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.4;
}

.badge.gender-male {
  background: var(--theme-info-soft);
  color: var(--theme-info-text);
  border: 1px solid var(--theme-info-border);
}

.badge.gender-female {
  background: var(--theme-danger-soft);
  color: var(--theme-danger-text);
  border: 1px solid var(--theme-danger-border);
}

.badge.vip {
  background: linear-gradient(135deg, var(--theme-warning-soft), var(--theme-surface-soft));
  color: var(--theme-warning-text);
  border: 1px solid var(--theme-warning-border);
  font-weight: 600;
}

.hero-uin {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  font-size: 12px;
  color: var(--theme-text-muted);
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: -6px;
  transition:
    color var(--ds-dur-fast) var(--ds-ease-soft),
    background-color var(--ds-dur-fast) var(--ds-ease-soft);
}

.hero-uin:hover {
  background: var(--theme-surface-hover);
  color: var(--theme-text-secondary);
}

.hero-uin:focus-visible {
  outline: 2px solid var(--theme-focus);
  outline-offset: 2px;
}

.copy-ico {
  font-size: 11px;
  opacity: 0.6;
}

.hero-signature {
  margin-top: 10px;
  padding: 6px 10px;
  font-size: 12px;
  color: var(--theme-text-secondary);
  font-style: italic;
  line-height: 1.5;
  background: var(--theme-surface-soft);
  border-left: 2px solid var(--theme-brand-border);
  border-radius: 0 6px 6px 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 数据栏 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-top: 12px;
}

.stat-item {
  padding: 12px 8px;
  background: var(--theme-surface-soft);
  border: 1px solid var(--theme-border-subtle);
  border-radius: 10px;
  text-align: center;
  transition:
    background-color var(--ds-dur-fast) var(--ds-ease-soft),
    border-color var(--ds-dur-fast) var(--ds-ease-soft);
}

.stat-item:hover {
  background: var(--theme-surface-hover);
  border-color: var(--theme-border);
}

.stat-num {
  font-size: 18px;
  font-weight: 700;
  color: var(--theme-text-primary);
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}

.stat-num.intimacy {
  color: var(--theme-brand-accent);
}

.stat-label {
  margin-top: 4px;
  font-size: 11px;
  color: var(--theme-text-muted);
}

/* 详细资料 */
.detail-list {
  margin-top: 12px;
  padding: 14px 16px;
  background: var(--theme-surface-soft);
  border: 1px solid var(--theme-border-subtle);
  border-radius: 10px;
}

.detail-row {
  display: flex;
  align-items: baseline;
  padding: 6px 0;
  font-size: 13px;
  border-bottom: 1px dashed var(--theme-border-subtle);
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-key {
  flex-shrink: 0;
  width: 80px;
  color: var(--theme-text-muted);
}

.detail-val {
  flex: 1;
  color: var(--theme-text-secondary);
}

.detail-val .muted {
  color: var(--theme-text-muted);
  font-size: 12px;
  margin-left: 4px;
}

/* 关系标签 */
.badges-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
}

.rel-badge {
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
}

.rel-badge.friend {
  background: var(--theme-success-soft);
  color: var(--theme-success-text);
  border: 1px solid var(--theme-success-border);
}

.rel-badge.stranger {
  background: var(--theme-surface-soft);
  color: var(--theme-text-muted);
  border: 1px solid var(--theme-border-subtle);
}

.rel-badge.special {
  background: var(--theme-danger-soft);
  color: var(--theme-danger-text);
  border: 1px solid var(--theme-danger-border);
}

.rel-badge.private {
  background: var(--theme-warning-soft);
  color: var(--theme-warning-text);
  border: 1px solid var(--theme-warning-border);
}

/* 空状态 */
.empty-state {
  margin-top: 16px;
  padding: 24px 16px;
  text-align: center;
  background: var(--theme-surface-soft);
  border: 1px dashed var(--theme-border);
  border-radius: 12px;
}

.empty-icon {
  font-size: 36px;
  color: var(--theme-text-subtle);
  margin-bottom: 10px;
}

.empty-text {
  font-size: 14px;
  color: var(--theme-text-secondary);
  margin-bottom: 6px;
}

.empty-sub {
  font-size: 12px;
  color: var(--theme-text-muted);
  line-height: 1.5;
}

/* Footer */
.footer-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.footer-spacer {
  flex: 1;
}

.footer-link {
  color: var(--theme-text-muted);
  font-size: 12px;
}

.footer-link:hover {
  color: var(--theme-info-text);
}

.enter-btn {
  background: var(--theme-brand);
  border: none;
  font-weight: 600;
  box-shadow: var(--theme-shadow-brand);
}

.enter-btn:hover:not(:disabled) {
  background: var(--theme-brand-hover);
  box-shadow: var(--theme-shadow-brand);
}

.enter-btn:disabled {
  opacity: 0.4;
  background: var(--theme-surface-disabled);
  box-shadow: none;
}

/* Animations */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.card-slide-enter-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.card-slide-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}
.card-slide-enter-from,
.card-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

@media (prefers-reduced-motion: reduce) {
  .fade-enter-active,
  .fade-leave-active,
  .card-slide-enter-active,
  .card-slide-leave-active,
  .query-btn,
  .hero-uin,
  .stat-item {
    transition: none;
  }
}
</style>

<style>
.enter-by-uin-dialog .el-dialog {
  background: var(--theme-surface-overlay) !important;
  border: 1px solid var(--theme-border);
  border-radius: var(--theme-radius-xl) !important;
  box-shadow: var(--theme-shadow-lg);
  overflow: hidden;
}

.enter-by-uin-dialog .el-dialog__header {
  padding: 16px 20px !important;
  margin: 0 !important;
  border-bottom: 1px solid var(--theme-border-subtle);
}

.enter-by-uin-dialog .el-dialog__body {
  padding: 18px 20px !important;
  max-height: 70vh;
  overflow-y: auto;
}

.enter-by-uin-dialog .el-dialog__body::-webkit-scrollbar {
  width: 4px;
}

.enter-by-uin-dialog .el-dialog__body::-webkit-scrollbar-thumb {
  background: var(--theme-border-strong);
  border-radius: 2px;
}

.enter-by-uin-dialog .el-dialog__footer {
  padding: 14px 20px !important;
  border-top: 1px solid var(--theme-border-subtle);
  background: var(--theme-surface-soft);
}
</style>
