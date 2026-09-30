<template>
  <div class="space-sidebar w-72 flex flex-col h-full">
    <!-- 好友模式：好友信息栏 -->
    <transition name="context-switch" mode="out-in">
      <div v-if="viewMode === 'friend' && currentFriend" key="friend" class="user-section">
        <div class="user-card friend-card" data-material-light="subtle">
          <div class="card-header">
            <el-tooltip
              v-if="
                friendCardInfo?.realname ||
                friendCardInfo?.astroText ||
                friendCardInfo?.location ||
                friendLastActiveText ||
                friendDeviceName
              "
              placement="bottom"
              :show-after="200"
              popper-class="friend-info-popper"
            >
              <template #content>
                <div class="online-tooltip">
                  <div v-if="friendCardInfo?.realname" class="online-tooltip-row">
                    {{ friendCardInfo.realname }}
                  </div>
                  <div
                    v-if="friendCardInfo?.astroText || friendCardInfo?.location"
                    class="online-tooltip-sub"
                  >
                    {{
                      [friendCardInfo.astroText, friendCardInfo.location]
                        .filter(Boolean)
                        .join(' · ')
                    }}
                  </div>
                  <div v-if="friendLastActiveText" class="online-tooltip-sub">
                    {{ friendLastActiveText }}
                  </div>
                  <div v-if="friendDeviceName" class="online-tooltip-sub">
                    {{ friendDeviceName }}
                  </div>
                </div>
              </template>
              <el-avatar
                shape="square"
                :size="32"
                :src="currentFriend.img?.replace('/50', '/100')"
                class="user-avatar friend-avatar"
                tabindex="0"
                aria-label="查看好友公开资料"
              >
                {{ stripEmoji(currentFriend.name)?.[0] || '?' }}
              </el-avatar>
            </el-tooltip>
            <el-avatar
              v-else
              shape="square"
              :size="32"
              :src="currentFriend.img?.replace('/50', '/100')"
              class="user-avatar friend-avatar"
            >
              {{ stripEmoji(currentFriend.name)?.[0] || '?' }}
            </el-avatar>
            <div class="user-info">
              <div class="nickname"><QzoneDisplayName :name="currentFriend.name" /></div>
              <div class="uin-row">
                <span
                  class="uin uin-copyable"
                  title="点击复制 QQ 号"
                  role="button"
                  tabindex="0"
                  @click="copyToClipboard(currentFriend.uin, 'QQ 号')"
                  @keydown.enter.prevent="copyToClipboard(currentFriend.uin, 'QQ 号')"
                  @keydown.space.prevent="copyToClipboard(currentFriend.uin, 'QQ 号')"
                >
                  {{ showUin ? currentFriend.uin : maskUin(currentFriend.uin) }}
                </span>
                <el-icon
                  class="uin-toggle"
                  :title="showUin ? '隐藏' : '显示'"
                  role="button"
                  tabindex="0"
                  :aria-label="showUin ? '隐藏 QQ 号' : '显示 QQ 号'"
                  @click.stop="toggleUinDisplay"
                  @keydown.enter.stop.prevent="toggleUinDisplay"
                  @keydown.space.stop.prevent="toggleUinDisplay"
                >
                  <component :is="showUin ? Hide : View" />
                </el-icon>
              </div>
            </div>
            <div class="header-actions">
              <el-button
                text
                :icon="Monitor"
                class="action-btn open-web-btn"
                title="在网页打开好友空间"
                @click="openFriendQzoneWeb"
              >
              </el-button>
            </div>
          </div>
          <div class="card-stats">
            <div class="stat-grid">
              <div class="stat-item">
                <span class="label">亲密度</span>
                <span class="value intimacy">
                  <svg class="stat-heart" viewBox="0 0 16 16" fill="currentColor">
                    <path
                      d="M8 14s-5.5-3.5-5.5-7.5C2.5 4 4 2.5 5.5 2.5c1 0 1.9.5 2.5 1.3.6-.8 1.5-1.3 2.5-1.3C12 2.5 13.5 4 13.5 6.5 13.5 10.5 8 14 8 14z"
                    />
                  </svg>
                  {{ friendCardInfo?.intimacyScore ?? currentFriend.score }}
                </span>
              </div>
              <div class="stat-item">
                <span class="label">相册数</span>
                <span class="value">{{ friendAlbumCount }}</span>
              </div>
              <div class="stat-item capacity-stat">
                <span class="label capacity-label">
                  已用容量
                  <el-tooltip
                    placement="bottom-start"
                    :show-after="200"
                    :hide-after="100"
                    popper-class="capacity-help-popper"
                  >
                    <template #content>
                      <div class="capacity-tooltip-content">
                        <strong>QQ 空间官方统计</strong>
                        <span>{{ officialCapacityTooltip }}</span>
                      </div>
                    </template>
                    <button type="button" class="capacity-help" aria-label="查看已用容量说明">
                      <el-icon><QuestionFilled /></el-icon>
                    </button>
                  </el-tooltip>
                </span>
                <span class="value storage">{{ friendDiskUsed }}</span>
              </div>
              <div class="stat-item">
                <span class="label">照片总数</span>
                <span class="value">{{ friendPhotoTotal }}</span>
              </div>
            </div>
          </div>

          <!-- 好友操作区域 - 仅下载管理 -->
          <div class="card-actions managers-layout">
            <div class="manager-item" style="flex: 1">
              <el-button
                text
                class="action-btn download-btn manager-btn"
                :class="{
                  'has-active-tasks': hasActiveTasks,
                  'is-fetching-albums': isPreparingDownloads
                }"
                :aria-busy="hasActiveTasks || isPreparingDownloads"
                title="下载管理器"
                @click="showDownloadProgress"
              >
                <div class="manager-btn-content">
                  <div class="icon-wrapper">
                    <el-icon v-if="isPreparingDownloads" class="fetching-icon"><Loading /></el-icon>
                    <el-icon v-else><Download /></el-icon>
                    <div v-if="hasActiveTasks" class="active-indicator">
                      <div class="pulse-ring"></div>
                      <div class="pulse-dot"></div>
                    </div>
                  </div>
                  <div class="text-wrapper">
                    <div class="main-text">下载管理</div>
                    <div v-if="downloadStatusText" class="status-text" aria-live="polite">
                      {{ downloadStatusText }}
                    </div>
                  </div>
                </div>
              </el-button>
            </div>
          </div>
        </div>
      </div>

      <!-- 自己空间：用户信息卡片 -->
      <div v-else key="self" class="user-section">
        <div class="user-card" data-material-light="subtle">
          <div class="card-header">
            <el-avatar shape="square" :size="32" :src="userAvatarUrl" class="user-avatar">
              {{ stripEmoji(userStore.userInfo?.nick)?.[0] || 'Q' }}
            </el-avatar>
            <div class="user-info">
              <div class="nickname">
                <QzoneDisplayName :name="userStore.userInfo?.nick || 'QZone用户'" />
              </div>
              <div class="uin-row">
                <span
                  class="uin uin-copyable"
                  title="点击复制 QQ 号"
                  role="button"
                  tabindex="0"
                  @click="copyToClipboard(profileUin, 'QQ 号')"
                  @keydown.enter.prevent="copyToClipboard(profileUin, 'QQ 号')"
                  @keydown.space.prevent="copyToClipboard(profileUin, 'QQ 号')"
                >
                  {{ displayUin }}
                </span>
                <el-icon
                  class="uin-toggle"
                  :title="showUin ? '隐藏' : '显示'"
                  role="button"
                  tabindex="0"
                  :aria-label="showUin ? '隐藏 QQ 号' : '显示 QQ 号'"
                  @click.stop="toggleUinDisplay"
                  @keydown.enter.stop.prevent="toggleUinDisplay"
                  @keydown.space.stop.prevent="toggleUinDisplay"
                >
                  <component :is="showUin ? Hide : View" />
                </el-icon>
              </div>
            </div>
            <!-- 登出按钮移到头像右边 -->
            <div class="header-actions">
              <el-button
                text
                :icon="Monitor"
                class="action-btn open-web-btn"
                title="打开官网"
                @click="openQzoneWeb"
              >
              </el-button>
              <el-popconfirm
                title="确定要登出当前账号吗？"
                confirm-button-text="确定登出"
                cancel-button-text="取消"
                width="200"
                placement="top"
                @confirm="confirmLogout"
              >
                <template #reference>
                  <el-button
                    text
                    :icon="SwitchButton"
                    class="action-btn logout-btn header-logout"
                    title="登出"
                  >
                  </el-button>
                </template>
              </el-popconfirm>
            </div>
          </div>

          <div class="card-stats">
            <div class="stat-grid">
              <div class="stat-item">
                <span class="label">黄钻等级</span>
                <span class="value level">{{ userStore.userInfo?.level || 0 }}</span>
              </div>
              <div class="stat-item">
                <span class="label">成长值</span>
                <span class="value growth">{{ userStore.userInfo?.score || 0 }}</span>
              </div>
              <div class="stat-item">
                <span class="label">成长速度</span>
                <span class="value speed">{{ formatSpeed(userStore.userInfo?.speed || 0) }}</span>
              </div>
              <div class="stat-item capacity-stat">
                <span class="label capacity-label">
                  已用容量
                  <el-tooltip
                    placement="bottom-start"
                    :show-after="200"
                    :hide-after="100"
                    popper-class="capacity-help-popper"
                  >
                    <template #content>
                      <div class="capacity-tooltip-content">
                        <strong>QQ 空间官方统计</strong>
                        <span>{{ officialCapacityTooltip }}</span>
                      </div>
                    </template>
                    <button type="button" class="capacity-help" aria-label="查看已用容量说明">
                      <el-icon><QuestionFilled /></el-icon>
                    </button>
                  </el-tooltip>
                </span>
                <span class="value storage">{{ formatStorage() }}</span>
              </div>
            </div>
          </div>

          <!-- 用户操作区域 - 管理器按钮并排布局 -->
          <div class="card-actions managers-layout">
            <div class="manager-item">
              <el-button
                text
                class="action-btn download-btn manager-btn"
                :class="{
                  'has-active-tasks': hasActiveTasks,
                  'is-fetching-albums': isPreparingDownloads
                }"
                :aria-busy="hasActiveTasks || isPreparingDownloads"
                title="下载管理器"
                @click="showDownloadProgress"
              >
                <div class="manager-btn-content">
                  <div class="icon-wrapper">
                    <el-icon v-if="isPreparingDownloads" class="fetching-icon"><Loading /></el-icon>
                    <el-icon v-else><Download /></el-icon>
                    <!-- 活跃任务指示器 -->
                    <div v-if="hasActiveTasks" class="active-indicator">
                      <div class="pulse-ring"></div>
                      <div class="pulse-dot"></div>
                    </div>
                  </div>
                  <div class="text-wrapper">
                    <div class="main-text">下载管理</div>
                    <div v-if="downloadStatusText" class="status-text" aria-live="polite">
                      {{ downloadStatusText }}
                    </div>
                  </div>
                </div>
              </el-button>
            </div>

            <div class="manager-item">
              <el-button
                text
                class="action-btn upload-btn manager-btn"
                :class="{ 'has-active-tasks': hasActiveUploadTasks }"
                title="上传管理器"
                @click="showUploadProgress"
              >
                <div class="manager-btn-content">
                  <div class="icon-wrapper">
                    <el-icon><Upload /></el-icon>
                    <!-- 活跃任务指示器 -->
                    <div v-if="hasActiveUploadTasks" class="active-indicator upload-indicator">
                      <div class="pulse-ring"></div>
                      <div class="pulse-dot"></div>
                    </div>
                  </div>
                  <div class="text-wrapper">
                    <div class="main-text">上传管理</div>
                    <div v-if="activeUploadTaskCount > 0" class="status-text">
                      {{ uploadStatusText }}
                    </div>
                  </div>
                </div>
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- 一级导航菜单 - TAB 样式 -->
    <div class="main-navigation-tabs" role="tablist" aria-label="内容分类">
      <button
        v-for="(tab, tabIndex) in tabs"
        :key="tab.key"
        type="button"
        role="tab"
        class="nav-tab"
        :class="{ active: currentModule === tab.key }"
        :aria-selected="currentModule === tab.key"
        :tabindex="currentModule === tab.key ? 0 : -1"
        @click="handleModuleSelect(tab.key)"
        @keydown="handleModuleKeydown($event, tabIndex)"
      >
        <el-icon class="tab-icon"><component :is="tab.icon" /></el-icon>
        <span class="tab-text">{{ tab.label }}</span>
      </button>
    </div>

    <!-- 下载全部相册功能区 -->
    <div
      v-if="currentModule === 'album' && albumLoadState.status === ALBUM_LOAD_STATUS.READY"
      class="download-all-section"
    >
      <div class="download-all-card">
        <button
          type="button"
          class="download-all-button"
          :aria-busy="isDownloadingAll || isCancelling"
          :aria-label="downloadButtonText"
          @click="toggleDownloadAll"
        >
          <div class="button-content">
            <div class="button-icon">
              <el-icon v-if="!isDownloadingAll && !isCancelling">
                <FolderAdd />
              </el-icon>
              <el-icon v-else-if="isCancelling" class="cancel-icon">
                <Close />
              </el-icon>
              <div v-else class="loading-wrapper">
                <div class="loading-ring"></div>
                <el-icon class="download-icon">
                  <Download />
                </el-icon>
              </div>
            </div>
            <div class="button-text">
              <div class="main-text">{{ downloadButtonText }}</div>
              <div v-if="downloadProgress.visible" class="sub-text">
                {{ downloadProgress.text }}
              </div>
            </div>
          </div>

          <!-- 进度条 -->
          <div v-if="downloadProgress.visible" class="progress-overlay">
            <div class="progress-fill" :style="{ width: downloadProgress.percentage + '%' }"></div>
          </div>
        </button>
      </div>
    </div>

    <!-- 二级内容区 - 根据模块动态切换 -->
    <div class="flex-1 overflow-hidden menu-container">
      <el-scrollbar class="h-full" :tabindex="-1">
        <!-- 相册模块 -->
        <el-menu
          v-if="currentModule === 'album' && albumLoadState.status === ALBUM_LOAD_STATUS.READY"
          :default-openeds="Array.from(openedKeys)"
          :default-active="selectedAlbumKey"
          mode="vertical"
          class="album-menu"
          @select="handleMenuSelect"
        >
          <el-sub-menu
            v-for="category in menuList"
            :key="category.classId"
            :index="String(category.classId)"
          >
            <template #title>
              <span class="category-title">
                <span class="category-name">{{ category.className }}</span>
                <span class="category-count">{{ category.albums.length }}</span>
              </span>
            </template>
            <el-menu-item
              v-for="album in category.albums"
              :key="album.id"
              :index="`${category.classId}-${album.id}`"
              class="album-item"
              :class="{
                'is-downloading': isAlbumDownloading(album.id),
                'is-fetching': isAlbumFetching(album.id)
              }"
              @click="selectAlbumItem(category.classId, album)"
            >
              <div class="album-content">
                <!-- 下载状态指示器 -->
                <div
                  v-if="isAlbumDownloading(album.id) || isAlbumFetching(album.id)"
                  class="download-indicator"
                >
                  <el-icon class="is-loading"><Loading /></el-icon>
                </div>
                <div class="album-info">
                  <span v-if="getViewtypeText(album.viewtype)" class="viewtype-badge">
                    {{ getViewtypeText(album.viewtype) }}
                  </span>
                  <span class="album-text" :title="album.name">{{ album.name }}</span>
                </div>
                <el-icon
                  v-if="album.priv === 3"
                  class="album-lock-icon priv-self"
                  title="仅自己可见"
                >
                  <Lock />
                </el-icon>
                <el-icon
                  v-else-if="album.priv === 2"
                  class="album-lock-icon priv-password"
                  title="密码访问"
                >
                  <Key />
                </el-icon>
                <el-popover
                  v-else-if="album.priv === 5"
                  trigger="click"
                  placement="right"
                  :width="200"
                  :show-arrow="false"
                  popper-class="qa-popper"
                  @before-enter="fetchAlbumQA(album)"
                >
                  <template #reference>
                    <el-icon
                      class="album-lock-icon priv-question clickable"
                      title="查看问答"
                      @click.stop.prevent
                      @mousedown.stop.prevent
                    >
                      <QuestionFilled />
                    </el-icon>
                  </template>
                  <div class="qa-popover">
                    <div class="qa-item">
                      <span class="qa-label">问题</span>
                      <span class="qa-text">{{ album.question || '...' }}</span>
                    </div>
                    <div class="qa-item">
                      <span class="qa-label">答案</span>
                      <span v-if="albumQAMap[album.id]?.answer != null" class="qa-text qa-answer">{{
                        albumQAMap[album.id].answer
                      }}</span>
                      <span v-else-if="albumQAMap[album.id]?.loading" class="qa-text qa-muted"
                        >...</span
                      >
                      <span v-else class="qa-text qa-muted">{{
                        isFriendMode ? '仅主人可见' : '-'
                      }}</span>
                    </div>
                  </div>
                </el-popover>
                <el-icon
                  v-else-if="album.priv === 4"
                  class="album-lock-icon priv-friend"
                  title="QQ好友可见"
                >
                  <User />
                </el-icon>
                <el-icon
                  v-else-if="album.priv === 6"
                  class="album-lock-icon priv-partial"
                  title="部分好友可见"
                >
                  <View />
                </el-icon>
                <el-icon
                  v-else-if="album.priv === 8"
                  class="album-lock-icon priv-partial-hide"
                  title="部分好友不可见"
                >
                  <Hide />
                </el-icon>
                <span class="album-num">
                  <span v-if="getAlbumStatusText(album.id)" class="download-progress">
                    {{ getAlbumStatusText(album.id) }}
                  </span>
                  <span v-else>{{ album.total }}</span>
                </span>
              </div>
            </el-menu-item>
          </el-sub-menu>
        </el-menu>

        <section
          v-else-if="currentModule === 'album'"
          class="album-load-state"
          :class="{
            'is-error': [ALBUM_LOAD_STATUS.ERROR, ALBUM_LOAD_STATUS.FORBIDDEN].includes(
              albumLoadState.status
            )
          }"
          :role="
            [ALBUM_LOAD_STATUS.ERROR, ALBUM_LOAD_STATUS.FORBIDDEN].includes(albumLoadState.status)
              ? 'alert'
              : 'status'
          "
          :aria-live="
            [ALBUM_LOAD_STATUS.ERROR, ALBUM_LOAD_STATUS.FORBIDDEN].includes(albumLoadState.status)
              ? 'assertive'
              : 'polite'
          "
        >
          <LoadingState
            v-if="albumLoadState.status === ALBUM_LOAD_STATUS.LOADING"
            :text="albumLoadState.title || '正在加载相册…'"
            size="small"
            spinner-type="icon"
          />
          <template v-else-if="albumLoadState.status !== ALBUM_LOAD_STATUS.READY">
            <el-icon class="album-load-icon">
              <Picture v-if="albumLoadState.status === ALBUM_LOAD_STATUS.EMPTY" />
              <WarningFilled v-else />
            </el-icon>
            <h3>{{ albumLoadState.title }}</h3>
            <p>{{ albumLoadState.description }}</p>
            <el-button
              v-if="albumLoadState.retryable"
              type="primary"
              plain
              :icon="RefreshRight"
              class="album-retry-button"
              @click="retryPhotoData"
            >
              重新加载
            </el-button>
          </template>
        </section>

        <!-- 照片模块：来源 + 类型 + 年份 -->
        <div v-else-if="currentModule === 'photo'" class="photo-side">
          <!-- 来源切换（保留原 menu 风格但更紧凑） -->
          <div class="filter-block">
            <div class="filter-title">来源</div>
            <div class="chip-row">
              <button
                type="button"
                class="chip"
                :class="{ active: selectedPhotoType === 'my-photos' }"
                :aria-pressed="selectedPhotoType === 'my-photos'"
                @click="handlePhotoTypeSelect('my-photos')"
              >
                <el-icon><User /></el-icon>
                我的照片
              </button>
              <button
                v-if="!isFriendMode"
                type="button"
                class="chip"
                :class="{ active: selectedPhotoType === 'friend-photos' }"
                :aria-pressed="selectedPhotoType === 'friend-photos'"
                @click="handlePhotoTypeSelect('friend-photos')"
              >
                <el-icon><UserFilled /></el-icon>
                好友照片
              </button>
            </div>
          </div>

          <!-- 媒体类型 -->
          <div v-if="selectedPhotoType === 'my-photos'" class="filter-block">
            <div class="filter-title">媒体</div>
            <div class="chip-row">
              <button
                v-for="opt in PHOTO_MEDIA_OPTIONS"
                :key="opt.key"
                type="button"
                class="chip"
                :class="{ active: photoFilters.media === opt.key }"
                :aria-pressed="photoFilters.media === opt.key"
                @click="photoFilters.media = opt.key"
              >
                {{ opt.label }}
              </button>
            </div>
          </div>

          <!-- 年份筛选 -->
          <div
            v-if="
              selectedPhotoType === 'my-photos' && photoStats.years && photoStats.years.length > 0
            "
            class="filter-block"
          >
            <div class="filter-title">年份</div>
            <div class="chip-row chip-row-wrap">
              <button
                type="button"
                class="chip"
                :class="{ active: photoFilters.year === 'all' }"
                :aria-pressed="photoFilters.year === 'all'"
                @click="photoFilters.year = 'all'"
              >
                全部
              </button>
              <button
                v-for="y in photoStats.years"
                :key="y"
                type="button"
                class="chip"
                :class="{ active: photoFilters.year === y }"
                :aria-pressed="photoFilters.year === y"
                @click="photoFilters.year = y"
              >
                {{ y }}
              </button>
            </div>
          </div>

          <!-- 聚合 stats（已加载） -->
          <div
            v-if="selectedPhotoType === 'my-photos' && photoStats.feedsCount > 0"
            class="agg-stats"
          >
            <div class="agg-row">
              <ClipboardList :size="12" class="agg-icon" />
              <span class="agg-key">动态</span>
              <span class="agg-val">{{ photoStats.feedsCount }}</span>
            </div>
            <div class="agg-row">
              <MessageCircle :size="12" class="agg-icon" />
              <span class="agg-key">评论</span>
              <span class="agg-val">{{ photoStats.commentSum }}</span>
            </div>
            <div class="agg-row">
              <Heart :size="12" class="agg-icon" />
              <span class="agg-key">点赞</span>
              <span class="agg-val">{{ photoStats.likeSum }}</span>
            </div>
          </div>
        </div>

        <!-- 视频模块：统计 + 筛选 -->
        <div v-else-if="currentModule === 'video'" class="video-side">
          <!-- 三栏小数字 -->
          <div class="video-stat-row">
            <div class="video-stat">
              <div class="num">{{ videoStats.total || 0 }}</div>
              <div class="lab">总数</div>
            </div>
            <div class="video-stat">
              <div class="num loaded">{{ videoStats.loaded || 0 }}</div>
              <div class="lab">已加载</div>
            </div>
            <div class="video-stat">
              <div class="num duration">{{ formatTotalDuration(videoStats.totalDuration) }}</div>
              <div class="lab">总时长</div>
            </div>
          </div>

          <!-- 磁盘空间条（仅自己） -->
          <div v-if="!isFriendMode && videoStats.diskTotal > 0" class="disk-bar-wrap">
            <div class="disk-bar-head">
              <span class="disk-lab">视频空间</span>
              <span class="disk-val">
                <strong>{{ videoStats.diskUsed || 0 }}</strong> / {{ videoStats.diskTotal }} MB
              </span>
            </div>
            <div class="disk-bar">
              <div
                class="disk-bar-fill"
                :style="{
                  width: `${Math.min(100, ((videoStats.diskUsed || 0) / videoStats.diskTotal) * 100)}%`
                }"
              ></div>
            </div>
            <div v-if="videoStats.dayTotal > 0" class="disk-quota">
              今日上传 {{ videoStats.dayCount || 0 }} / {{ videoStats.dayTotal }}
            </div>
          </div>

          <!-- 时长筛选 -->
          <div class="filter-block">
            <div class="filter-title">时长</div>
            <div class="chip-row duration-chip-row">
              <button
                v-for="opt in DURATION_OPTIONS"
                :key="opt.key"
                type="button"
                class="chip"
                :class="{ active: videoFilters.duration === opt.key }"
                :aria-pressed="videoFilters.duration === opt.key"
                @click="videoFilters.duration = opt.key"
              >
                {{ opt.label }}
              </button>
            </div>
          </div>

          <!-- 年份筛选（动态） -->
          <div v-if="videoStats.years && videoStats.years.length > 0" class="filter-block">
            <div class="filter-title">年份</div>
            <div class="chip-row chip-row-wrap">
              <button
                type="button"
                class="chip"
                :class="{ active: videoFilters.year === 'all' }"
                :aria-pressed="videoFilters.year === 'all'"
                @click="videoFilters.year = 'all'"
              >
                全部
              </button>
              <button
                v-for="y in videoStats.years"
                :key="y"
                type="button"
                class="chip"
                :class="{ active: videoFilters.year === y }"
                :aria-pressed="videoFilters.year === y"
                @click="videoFilters.year = y"
              >
                {{ y }}
              </button>
            </div>
          </div>

          <!-- 排序 -->
          <div class="filter-block">
            <div class="filter-title">排序</div>
            <div class="chip-row">
              <button
                v-for="opt in SORT_OPTIONS"
                :key="opt.key"
                type="button"
                class="chip"
                :class="{ active: videoFilters.sort === opt.key }"
                :aria-pressed="videoFilters.sort === opt.key"
                @click="videoFilters.sort = opt.key"
              >
                {{ opt.label }}
              </button>
            </div>
          </div>
        </div>

        <div v-else-if="currentModule === 'feeds'" class="feeds-side feeds-side-min">
          <section class="fd-panel fd-cover">
            <div class="fd-cover-top">
              <div class="fd-cover-copy">
                <span class="fd-kicker">{{ feedsStats.activeSourceLabel || '动态' }}</span>
                <strong>{{ feedsStats.loaded || 0 }} 条{{ feedsItemUnit }}</strong>
                <span>{{ feedsPulseText }}</span>
              </div>
              <div class="fd-orbit" title="当前页媒体数">
                <strong>{{ formatFeedsBigNum(feedsStats.mediaCount || 0) }}</strong>
                <span>媒体</span>
              </div>
            </div>
            <div class="fd-cover-pills">
              <span>{{ feedsMediaText }}</span>
              <span>{{ feedsEngagementTotal }} 互动</span>
              <span>{{ formatFeedsBigNum(feedsStats.viewCount || 0) }} 浏览</span>
            </div>
          </section>

          <section v-if="feedsTypeRows.length" class="fd-panel fd-mix">
            <div class="fd-panel-head">
              <span>动态类型分布</span>
              <em>{{ feedsMediaRate }} 含媒体</em>
            </div>
            <div class="fd-mix-track">
              <span
                v-for="(row, i) in feedsTypeRows.slice(0, 5)"
                :key="row.label"
                :style="{ width: row.percent + '%', background: modColor(i) }"
                :title="`${row.label} ${row.count}`"
              ></span>
            </div>
            <div class="fd-mix-tags">
              <span v-for="(row, i) in feedsTypeRows.slice(0, 4)" :key="row.label">
                <i :style="{ background: modColor(i) }"></i>{{ row.label }} {{ row.count }}
              </span>
            </div>
          </section>

          <button
            type="button"
            class="fd-disclosure"
            :aria-expanded="feedsStatsExpanded"
            aria-controls="feeds-secondary-stats"
            @click="feedsStatsExpanded = !feedsStatsExpanded"
          >
            <span>{{ feedsStatsExpanded ? '收起详细统计' : '查看更多统计' }}</span>
            <el-icon :class="{ 'is-expanded': feedsStatsExpanded }"><ArrowDown /></el-icon>
          </button>

          <div v-show="feedsStatsExpanded" id="feeds-secondary-stats" class="fd-detail-stack">
            <section class="fd-panel fd-soft-grid">
              <div>
                <span>平均点赞</span>
                <strong>{{ feedsAvgLike }}</strong>
              </div>
              <div>
                <span>平均评论</span>
                <strong>{{ feedsAvgComment }}</strong>
              </div>
              <div>
                <span>有浏览</span>
                <strong>{{ feedsViewedRate }}</strong>
              </div>
              <div>
                <span>作者</span>
                <strong>{{ feedsUniqueAuthorCount }}</strong>
              </div>
            </section>

            <section v-if="feedsActionRows.length" class="fd-panel">
              <div class="fd-panel-head">
                <span>与我相关</span>
                <em>{{ feedsActionRows.length }} 类动作</em>
              </div>
              <div class="fd-action-cloud">
                <span v-for="row in feedsActionRows.slice(0, 6)" :key="row.label">
                  {{ row.label }} <strong>{{ row.count }}</strong>
                </span>
              </div>
            </section>

            <section v-if="feedsStats.topAuthors && feedsStats.topAuthors.length" class="fd-panel">
              <div class="fd-panel-head">
                <span>常出现的人</span>
                <button
                  v-if="feedsStats.topAuthors.length > 5"
                  type="button"
                  class="fd-panel-toggle"
                  :aria-expanded="feedsPeopleExpanded"
                  aria-controls="fd-people-list"
                  :aria-label="
                    feedsPeopleExpanded
                      ? '收起常出现的人列表'
                      : `查看全部 ${feedsUniqueAuthorCount} 人`
                  "
                  @click="feedsPeopleExpanded = !feedsPeopleExpanded"
                >
                  {{ feedsPeopleExpanded ? '收起' : `查看全部 ${feedsUniqueAuthorCount} 人` }}
                  <el-icon :class="{ 'is-expanded': feedsPeopleExpanded }"><ArrowDown /></el-icon>
                </button>
                <em v-else>{{ feedsUniqueAuthorCount }} 人</em>
              </div>
              <div
                id="fd-people-list"
                class="fd-people-stack"
                :class="{ 'is-expanded': feedsPeopleExpanded }"
              >
                <button
                  v-for="author in visibleFeedsAuthors"
                  :key="author.uin || author.name"
                  type="button"
                  class="fd-person"
                  :title="`${author.name} · ${author.count} 条${feedsItemUnit}`"
                  @click="openQzoneProfile(author.uin, author.name, author.avatar)"
                >
                  <img :src="author.avatar" :alt="author.name" referrerpolicy="no-referrer" />
                  <QzoneDisplayName :name="author.name" />
                  <strong>{{ author.count }}</strong>
                </button>
              </div>
            </section>

            <section
              v-if="feedsStats.sourceBadgeRows && feedsStats.sourceBadgeRows.length"
              class="fd-panel"
            >
              <div class="fd-panel-head">
                <span>未读提醒</span>
              </div>
              <div class="fd-action-cloud">
                <span v-for="row in feedsStats.sourceBadgeRows" :key="row.key">
                  {{ row.label }} <strong>{{ row.count > 99 ? '99+' : row.count }}</strong>
                </span>
              </div>
            </section>

            <section
              v-if="
                feedsDynamicMod || feedsStats.trend?.length || feedsStats.recentVisitors?.length
              "
              class="fd-panel fd-space-card"
            >
              <div class="fd-panel-head">
                <span>空间热度</span>
                <em v-if="feedsDynamicMod"
                  >动态 {{ formatFeedsBigNum(feedsDynamicMod.total || 0) }}</em
                >
              </div>
              <div v-if="feedsDynamicMod" class="fd-space-line">
                <strong>{{ formatFeedsBigNum(feedsDynamicMod.total || 0) }}</strong>
                <span>动态浏览</span>
                <em v-if="feedsDynamicMod.today > 0">今日 +{{ feedsDynamicMod.today }}</em>
              </div>
              <svg
                v-if="feedsTrendMax > 0"
                class="mn-spark mn-spark-area"
                viewBox="0 0 220 44"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="mn-spark-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="var(--theme-info)" stop-opacity="0.32" />
                    <stop offset="100%" stop-color="var(--theme-info)" stop-opacity="0" />
                  </linearGradient>
                </defs>
                <polygon
                  :points="trendAreaPolygon(feedsStats.trend, 220, 44)"
                  fill="url(#mn-spark-fill)"
                />
                <polyline
                  :points="trendPolyline(feedsStats.trend, 220, 44)"
                  fill="none"
                  stroke="var(--theme-info)"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <circle
                  :cx="220 - 4"
                  :cy="trendLastY(feedsStats.trend, 44)"
                  r="3"
                  fill="var(--theme-info)"
                />
              </svg>
            </section>

            <section
              v-if="
                feedsStats.visitorLoading ||
                feedsStats.visitorLoaded ||
                feedsStats.visitorError ||
                feedsStats.recentVisitors?.length
              "
              class="fd-panel fd-visitors"
            >
              <div class="fd-panel-head">
                <span>最近来过</span>
                <em v-if="feedsStats.recentVisitors?.length">{{
                  feedsStats.recentVisitors.length
                }}</em>
              </div>
              <p v-if="feedsStats.visitorLoading" class="fd-visitor-state" role="status">
                正在读取访客记录…
              </p>
              <div v-if="feedsStats.recentVisitors?.length" class="mn-avatars">
                <button
                  v-for="v in feedsStats.recentVisitors.slice(0, 12)"
                  :key="v.uin"
                  type="button"
                  class="mn-avatar"
                  :class="{ 'is-friend': v.isFriend }"
                  :title="`${v.name || v.uin}${v.time ? ' · ' + formatRelativeTime(v.time) : ''}`"
                  @click="openQzoneProfile(v.uin, v.name, v.img)"
                >
                  <img :src="v.img" :alt="v.name" referrerpolicy="no-referrer" />
                  <span v-if="v.haveNewFeeds" class="mn-avatar-dot"></span>
                </button>
              </div>
              <div v-if="feedsStats.visitorError" class="fd-visitor-state is-error" role="alert">
                <span>{{ feedsStats.visitorError }}</span>
                <button type="button" @click="feedsStats.retryVisitors?.()">重试</button>
              </div>
              <p
                v-else-if="feedsStats.visitorLoaded && !feedsStats.recentVisitors?.length"
                class="fd-visitor-state"
              >
                当前没有可见的最近访客
              </p>
              <p v-if="feedsStats.visitorLoaded" class="fd-visitor-note">
                仅展示当前账号有权限看到的记录
              </p>
            </section>
          </div>
        </div>
      </el-scrollbar>
    </div>

    <!-- 好友抽屉 -->
    <FriendDrawer
      :active-friend="currentFriend"
      @enter-friend="(f) => emit('enter-friend', f)"
      @exit-friend="emit('exit-friend')"
    />

    <!-- 下载管理器弹窗 -->
    <DownloadManager v-model="downloadProgressVisible" />

    <!-- 上传管理器弹窗 -->
    <UploadManager v-model="uploadProgressVisible" />
  </div>
</template>

<script setup>
import {
  onBeforeMount,
  ref,
  reactive,
  computed,
  nextTick,
  onBeforeUnmount,
  inject,
  watch
} from 'vue'

import { useUserStore } from '@renderer/store/user.store'
import { useDownloadStore } from '@renderer/store/download.store'
import {
  Download,
  Upload,
  SwitchButton,
  FolderAdd,
  Close,
  Loading,
  Monitor,
  Folder,
  Picture,
  RefreshRight,
  User,
  UserFilled,
  VideoPlay,
  WarningFilled,
  Lock,
  Hide,
  Key,
  View,
  ArrowDown,
  QuestionFilled,
  ChatLineRound
} from '@element-plus/icons-vue'
import { ClipboardList, MessageCircle, Heart } from '@lucide/vue'
import { ElMessage } from 'element-plus'
import DownloadManager from '@renderer/components/DownloadManager/index.vue'
import FriendDrawer from './friend-drawer.vue'
import UploadManager from '@renderer/components/UploadManager/index.vue'
import LoadingState from '@renderer/components/LoadingState/index.vue'
import QzoneDisplayName from '@renderer/components/QzoneDisplayName/index.vue'
import { generateUniqueAlbumName, copyToClipboard } from '@renderer/utils'
import { QZONE_CONFIG } from '@shared/const'
import {
  ALBUM_LOAD_STATUS,
  classifyAlbumLoadFailure,
  createAlbumLoadState,
  resolveAlbumResponseState
} from '@shared/album-load-state'
import { formatBytes } from '@renderer/utils/formatters'
import { resolveQzoneHostUin, resolveSelfQzoneUin } from '@renderer/utils/qzone-identity'
import { retryPageRequest } from '@renderer/utils/paginationGuard'
import {
  batchSummaryText,
  batchTaskIds,
  finishDownloadBatch,
  openDownloadBatchOptions
} from '@renderer/utils/downloadBatch'

const officialCapacityTooltip = '仅代表空间使用量，不是本地已下载文件的大小。'
const feedsStatsExpanded = ref(false)

const handleMenuSelect = (index) => {
  // 菜单选择处理由 selectAlbumItem 函数处理
  console.log('Menu selected:', index)
}

// 处理模块切换
const handleModuleSelect = (module) => {
  if (currentModule.value === module) return
  currentModule.value = module
  // 切换到照片模块时，重置为"我的照片"
  if (module === 'photo') {
    selectedPhotoType.value = 'my-photos'
  }
  emit('module-changed', module, module === 'photo' ? selectedPhotoType.value : undefined)

  // 当切换回相册模块时，如果有选中的相册，重新触发选择事件以确保刷新
  if (module === 'album' && clickItem.value) {
    // 延迟一下，确保 Main 组件已经挂载
    setTimeout(() => {
      selectAlbum(clickItem.value)
    }, 200)
  }
}

const handleModuleKeydown = (event, currentIndex) => {
  let nextIndex = currentIndex
  if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length
  else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length
  else if (event.key === 'Home') nextIndex = 0
  else if (event.key === 'End') nextIndex = tabs.length - 1
  else return

  event.preventDefault()
  handleModuleSelect(tabs[nextIndex].key)
  nextTick(() => {
    event.currentTarget
      ?.closest('[role="tablist"]')
      ?.querySelectorAll('[role="tab"]')
      ?.[nextIndex]?.focus()
  })
}

// 处理照片类型选择
const handlePhotoTypeSelect = (type) => {
  selectedPhotoType.value = type
  emit('module-changed', 'photo', type)
}

// 处理好友名称中的表情代码
const stripEmoji = (name) => (name || '').replace(/\[em\]e\d+\[\/em\]/g, '')

const effectiveHostUin = computed(() =>
  resolveQzoneHostUin(
    props.viewMode === 'friend' && props.currentFriend ? props.currentFriend.uin : null,
    userStore
  )
)
const isFriendMode = computed(() => props.viewMode === 'friend')
const friendMeta = computed(() => (isFriendMode.value ? { skipAuthCheck: true } : {}))

// 好友个人名片隐藏数据
const friendCardInfo = ref(null)
const friendLastActiveTime = ref(null)
const friendDeviceName = ref(null)

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

const friendLastActiveText = computed(() => {
  if (!friendLastActiveTime.value) return ''
  const diff = Date.now() - friendLastActiveTime.value * 1000
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '刚刚活跃'
  if (minutes < 60) return `${minutes}分钟前活跃`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前活跃`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}天前活跃`
  return ''
})

const fetchFriendCard = async (uin) => {
  try {
    const res = await window.QzoneAPI.getPersonalCard({ targetUin: uin }, { skipAuthCheck: true })
    if (res?.uin) {
      friendCardInfo.value = {
        realname: res.realname || '',
        intimacyScore: res.intimacyScore || 0,
        gender: res.gender || 0,
        astro: res.astro || 0,
        astroText: ASTRO_MAP[res.astro] || '',
        location: res.from || '',
        logolabel: res.logolabel || '',
        commfrd: res.commfrd || 0
      }
    }
  } catch {
    /* ignore */
  }
}

const fetchFriendLastActive = async () => {
  try {
    const res = await window.QzoneAPI.getVisitorStatus({ skipAuthCheck: true })
    if (res?.code === 0 && res?.data?.module_3?.data?.items && props.currentFriend) {
      const match = res.data.module_3.data.items.find(
        (i) => String(i.uin) === String(props.currentFriend.uin)
      )
      if (match) friendLastActiveTime.value = match.time || null
    }
  } catch {
    /* ignore */
  }
}

const fetchFriendDevice = async (uin) => {
  try {
    const res = await window.QzoneAPI.getShuoshuo(
      { targetUin: uin, pos: 0, num: 1 },
      { skipAuthCheck: true }
    )
    if (res?.msglist?.[0]?.source_name) {
      friendDeviceName.value = res.msglist[0].source_name
    }
  } catch {
    /* ignore */
  }
}

// 好友空间统计信息（从相册 API 响应中提取）
const friendAlbumCount = computed(() => apiData.value?.albumsInUser ?? '--')
const friendDiskUsed = computed(() => {
  if (!isFriendMode.value || !apiData.value?.user?.diskused) return '--'
  const bytes = apiData.value.user.diskused * 1024 * 1024
  return formatBytes(bytes)
})
const friendPhotoTotal = computed(() => {
  if (!isFriendMode.value || !menuList.value) return '--'
  return menuList.value.reduce(
    (sum, cat) => sum + cat.albums.reduce((s, a) => s + (a.total || 0), 0),
    0
  )
})

const selectAlbumItem = (categoryId, album) => {
  // 立即更新选中状态，避免延迟
  selectedAlbumKey.value = `${categoryId}-${album.id}`
  // 同步调用选择函数
  selectAlbum(album)
}

const props = defineProps({
  viewMode: { type: String, default: 'self' },
  currentFriend: { type: Object, default: null },
  activeModule: { type: String, default: 'album' },
  photoType: { type: String, default: 'my-photos' }
})

const emit = defineEmits([
  'album-selected',
  'album-state-changed',
  'module-changed',
  'enter-friend',
  'exit-friend'
])

const userStore = useUserStore()
const selfQzoneUin = computed(() => resolveSelfQzoneUin(userStore))
// 资料卡展示（头像、昵称、可复制 QQ 号）以资料接口为准；它与请求相册时使用的
// 登录 Cookie 账号不是同一职责，不能共用 API hostUin。
const profileUin = computed(() => String(userStore.userInfo?.uin || selfQzoneUin.value || ''))
const userAvatarUrl = computed(() =>
  window.QzoneAPI?.demoMode
    ? 'http://127.0.0.1:4173/assets/demo/logo.png'
    : `https://qlogo4.store.qq.com/qzone/${profileUin.value}/${profileUin.value}/100`
)
const downloadStore = useDownloadStore()
const refreshAlbumCallback = inject('refreshAlbumCallback', null)
const loading = ref(false)
const albumLoadState = ref(createAlbumLoadState())
let albumLoadRequestId = 0

const updateAlbumLoadState = (state) => {
  albumLoadState.value = state
  emit('album-state-changed', state)
}

const retryPhotoData = () => {
  if (!loading.value) fetchPhotoData()
}

// 相册问答缓存
const albumQAMap = reactive({})

const fetchAlbumQA = async (album) => {
  if (isFriendMode.value) return
  const cached = albumQAMap[album.id]
  if (cached && (cached.loading || cached.answer != null)) return
  albumQAMap[album.id] = { loading: true }
  try {
    const res = await window.QzoneAPI.getAlbumQA({
      hostUin: effectiveHostUin.value,
      albumId: album.id
    })
    if (res?.code === 0 && res?.data) {
      albumQAMap[album.id] = { answer: res.data.answer, question: res.data.question }
    } else {
      albumQAMap[album.id] = { answer: null }
    }
  } catch {
    albumQAMap[album.id] = { answer: null }
  }
}

// 切换好友/用户时清空问答缓存 + 加载好友名片
watch(effectiveHostUin, () => {
  Object.keys(albumQAMap).forEach((key) => {
    delete albumQAMap[key]
  })
})

watch(
  () => props.currentFriend,
  (friend) => {
    friendCardInfo.value = null
    friendLastActiveTime.value = null
    friendDeviceName.value = null
    if (friend?.uin) {
      fetchFriendCard(friend.uin)
      fetchFriendLastActive()
      fetchFriendDevice(friend.uin)
    }
  },
  { immediate: true }
)

// 当前模块状态
const currentModule = ref('album') // album, photo, video, feeds
const selectedPhotoType = ref('my-photos')

watch(
  () => props.activeModule,
  (module) => {
    if (module && currentModule.value !== module) {
      currentModule.value = module
    }
  },
  { immediate: true }
)

watch(
  () => props.photoType,
  (type) => {
    if (type && selectedPhotoType.value !== type) {
      selectedPhotoType.value = type
    }
  },
  { immediate: true }
)

// 视频统计信息（被 video-module.vue 通过 leftRef.updateVideoStats 推送）
const videoStats = ref({
  total: 0,
  loaded: 0,
  totalDuration: 0,
  diskUsed: 0,
  diskTotal: 0,
  dayCount: 0,
  dayTotal: 0,
  years: []
})

// 视频筛选 / 排序（暴露给 video-module 通过 leftRef.videoFilters 读取）
const videoFilters = reactive({
  duration: 'all', // all | short(<30s) | medium(30s-3min) | long(>3min)
  year: 'all',
  sort: 'newest' // newest | oldest | duration
})

const DURATION_OPTIONS = [
  { key: 'all', label: '全部' },
  { key: 'short', label: '30秒内' },
  { key: 'medium', label: '30秒–3分钟' },
  { key: 'long', label: '3分钟以上' }
]

const SORT_OPTIONS = [
  { key: 'newest', label: '最新' },
  { key: 'oldest', label: '最早' },
  { key: 'duration', label: '时长' }
]

// 把秒数格式化成"X 小时 / X 分钟 / X 秒"，sidebar 用紧凑形态
const formatTotalDuration = (seconds) => {
  if (!seconds || seconds <= 0) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h >= 1) return `${h}时${m > 0 ? m + '分' : ''}`
  if (m >= 1) return `${m}分钟`
  return `${Math.floor(seconds)}秒`
}

// 照片统计 + 筛选（被 photo-module.vue 通过 leftRef 推送/读取）
const photoStats = ref({
  feedsCount: 0,
  commentSum: 0,
  likeSum: 0,
  years: []
})

const photoFilters = reactive({
  media: 'all', // all | photo | video | text
  year: 'all'
})

const PHOTO_MEDIA_OPTIONS = [
  { key: 'all', label: '全部' },
  { key: 'photo', label: '照片' },
  { key: 'video', label: '视频' },
  { key: 'text', label: '文字' }
]

// TAB 配置
const tabs = [
  { key: 'album', label: '相册', icon: Folder },
  { key: 'photo', label: '照片', icon: Picture },
  { key: 'video', label: '视频', icon: VideoPlay },
  { key: 'feeds', label: '动态', icon: ChatLineRound }
]

// QQ号脱敏显示
const showUin = ref(false) // 默认脱敏

// 脱敏QQ号
const maskUin = (uin) => {
  if (!uin) return ''
  const uinStr = String(uin)
  if (uinStr.length <= 6) {
    // 如果QQ号长度小于等于6位，只显示前2位和后2位
    return uinStr.length <= 4
      ? '*'.repeat(uinStr.length)
      : `${uinStr.slice(0, 2)}${'*'.repeat(uinStr.length - 4)}${uinStr.slice(-2)}`
  } else {
    // 显示前3位和后3位，中间用*代替
    return `${uinStr.slice(0, 3)}${'*'.repeat(uinStr.length - 6)}${uinStr.slice(-3)}`
  }
}

// 计算显示的QQ号
const displayUin = computed(() => {
  const uin = profileUin.value
  if (!uin) return ''
  return showUin.value ? uin : maskUin(uin)
})

// 切换QQ号显示状态
const toggleUinDisplay = () => {
  showUin.value = !showUin.value
}

// 相册刷新防抖
let refreshDebounceTimer = null
const pendingRefreshAlbums = new Set() // 待刷新的相册ID集合

// 下载全部相册状态管理
const isDownloadingAll = ref(false)
const isCancelling = ref(false)
const downloadCancelled = ref(false)
const downloadProgress = ref({
  visible: false,
  percentage: 0,
  text: '',
  current: 0,
  total: 0
})

// 下载按钮文案
const downloadButtonText = computed(() => {
  if (isCancelling.value) {
    return '正在取消...'
  } else if (isDownloadingAll.value) {
    return '取消下载'
  } else {
    return '一键下载全部相册'
  }
})

// 下载进度弹窗
const downloadProgressVisible = ref(false)
let downloadManagerReturnFocus = null

// 计算相册是否正在下载
const isAlbumDownloading = computed(() => {
  return (albumId) => downloadStore.isAlbumDownloading(albumId)
})

// 计算相册是否正在获取照片
const isAlbumFetching = computed(() => {
  return (albumId) => downloadStore.isAlbumFetching(albumId)
})

// 获取相册状态显示文本
const getAlbumStatusText = computed(() => {
  return (albumId) => {
    const state = downloadStore.getAlbumDownloadState(albumId)

    // 获取阶段也显示百分比
    if (state.status === 'fetching' && state.totalPhotos > 0) {
      return `${state.progress || 0}%`
    }

    // 下载阶段显示下载进度百分比
    if (state.status === 'downloading' && state.isDownloading && state.totalCount > 0) {
      return `${state.progress || 0}%`
    }

    // 默认显示相册总数
    return null
  }
})

// 下载状态管理
const activeTaskCount = ref(0)
const detailedStatus = ref({
  downloading: 0,
  waiting: 0,
  paused: 0,
  total: 0,
  primaryStatus: 'idle'
})

// 上传状态管理
const activeUploadTaskCount = ref(0)
const uploadDetailedStatus = ref({
  uploading: 0,
  waiting: 0,
  paused: 0,
  total: 0,
  primaryStatus: 'idle'
})
const uploadProgressVisible = ref(false)

// 计算是否有活跃任务
const hasActiveTasks = computed(() => {
  return activeTaskCount.value > 0
})

// 相册内容尚在获取且还未生成下载任务时，复用下载管理按钮原有的状态行。
const isPreparingDownloads = computed(() => {
  return downloadStore.fetchingAlbums.size > 0 && !hasActiveTasks.value
})

// 计算状态显示文本
const statusText = computed(() => {
  const status = detailedStatus.value
  if (status.total === 0) {
    return ''
  }

  // 简化状态判断逻辑，避免频繁跳动
  const activeTasksCount = status.downloading + status.waiting // 正在进行的任务（下载中+等待中）
  const pausedTasksCount = status.paused // 暂停的任务

  if (activeTasksCount > 0) {
    // 只要有下载中或等待中的任务，就显示"进行中"
    return `${activeTasksCount} 个任务进行中`
  } else if (pausedTasksCount > 0) {
    // 只有当所有任务都是暂停状态时，才显示"暂停"
    return `暂停 ${pausedTasksCount} 个任务`
  } else {
    return ''
  }
})

const downloadStatusText = computed(() => {
  if (isPreparingDownloads.value) {
    const albumCount = downloadStore.fetchingAlbums.size
    return albumCount > 1 ? `正在获取 ${albumCount} 个相册…` : '正在获取相册…'
  }

  return statusText.value
})

// 上传相关计算属性
const hasActiveUploadTasks = computed(() => {
  return activeUploadTaskCount.value > 0
})

const uploadStatusText = computed(() => {
  const status = uploadDetailedStatus.value
  if (status.total === 0) {
    return ''
  }

  const activeTasksCount = status.uploading + status.waiting
  const pausedTasksCount = status.paused

  if (activeTasksCount > 0) {
    return `${activeTasksCount} 个任务进行中`
  } else if (pausedTasksCount > 0) {
    return `暂停 ${pausedTasksCount} 个任务`
  } else {
    return ''
  }
})

// 显示下载进度
const showDownloadProgress = (event) => {
  if (event?.currentTarget instanceof HTMLElement) {
    downloadManagerReturnFocus = event.currentTarget
  }
  downloadProgressVisible.value = true
}

watch(downloadProgressVisible, (isVisible, wasVisible) => {
  if (!isVisible && wasVisible) {
    const returnTarget = downloadManagerReturnFocus
    downloadManagerReturnFocus = null
    if (returnTarget?.isConnected) {
      nextTick(() => returnTarget.focus({ preventScroll: true }))
    }
  }
})

// 显示上传管理器
const showUploadProgress = () => {
  uploadProgressVisible.value = true
}

// 获取相册类型文本
const getViewtypeText = (viewtype) => {
  if (!viewtype || viewtype === 0) return ''
  return QZONE_CONFIG.viewtypeMap[viewtype] || ''
}

// 切换下载全部相册状态
const toggleDownloadAll = async () => {
  if (isDownloadingAll.value) {
    // 如果正在下载，则取消
    await cancelDownloadAll()
  } else {
    // 如果未在下载，则开始下载
    await startDownloadAll()
  }
}

// 开始下载全部相册
const startDownloadAll = async () => {
  let albumsToDownload = [] // 移到函数开始位置
  let downloadBatch = null
  let batchFinished = false

  try {
    if (!menuList.value || menuList.value.length === 0) {
      ElMessage.warning('没有找到相册数据，请刷新页面重试')
      return
    }

    // 统计总相册数和需要下载的相册数
    const allAlbums = []
    menuList.value.forEach((category) => {
      if (category.albums) {
        category.albums.forEach((album) => {
          allAlbums.push({ ...album, categoryId: category.classId })
        })
      }
    })

    // 过滤掉正在下载的相册
    albumsToDownload = allAlbums.filter(
      (album) =>
        !downloadStore.isAlbumDownloading(album.id) && !downloadStore.isAlbumFetching(album.id)
    )

    const skipCount = allAlbums.length - albumsToDownload.length

    if (albumsToDownload.length === 0) {
      ElMessage.warning(`所有相册都在下载中，无需重复下载`)
      return
    }

    downloadBatch = await openDownloadBatchOptions({
      label: isFriendMode.value ? '好友的全部相册' : '全部相册',
      sourceType: 'albums'
    })
    if (!downloadBatch) return

    // 重置状态
    downloadCancelled.value = false
    isDownloadingAll.value = true
    downloadProgress.value = {
      visible: true,
      percentage: 0,
      text: `准备下载 ${albumsToDownload.length} 个相册${skipCount > 0 ? `（跳过 ${skipCount} 个正在下载的相册）` : ''}...`,
      current: 0,
      total: albumsToDownload.length
    }

    let successCount = 0
    let processedAlbumCount = 0

    ElMessage.info(
      `开始批量下载 ${albumsToDownload.length} 个相册${skipCount > 0 ? `，跳过 ${skipCount} 个正在下载的相册` : ''}`
    )

    // 遍历需要下载的相册
    for (const album of albumsToDownload) {
      if (downloadCancelled.value) break

      try {
        // 检查全局取消标志 - 如果当前相册被单独取消，跳过该相册
        if (downloadStore.isGloballyCancelled(album.id)) {
          console.log(`[warn] 相册 ${album.name} 被用户取消，跳过处理`)
          break
        }

        // 更新进度
        downloadProgress.value.current = processedAlbumCount + 1
        downloadProgress.value.percentage = Math.round(
          (downloadProgress.value.current / albumsToDownload.length) * 100
        )
        downloadProgress.value.text = `正在处理: ${album.name} (${downloadProgress.value.current}/${albumsToDownload.length})`

        // 标记为正在获取照片，设置预计总数
        downloadStore.startAlbumFetch(album.id, album.total || 0)

        // 流式获取照片并添加到下载队列
        let addedPhotosCount = 0
        const batchSize = 100
        let pageStart = 0

        while (!downloadCancelled.value) {
          try {
            // 检查全局取消标志 - 如果当前相册被单独取消，跳过该相册
            if (downloadStore.isGloballyCancelled(album.id)) {
              console.log(`[warn] 相册 ${album.name} 被用户取消，跳过处理`)
              break
            }

            const albumDetail = await retryPageRequest(
              () =>
                window.QzoneAPI.getPhotoByTopicId({
                  hostUin: effectiveHostUin.value,
                  topicId: album.id,
                  pageStart: pageStart,
                  pageNum: batchSize
                }),
              { attempts: 3, delayMs: 400 }
            )

            // 权限不足或接口错误，跳过该相册
            if (albumDetail?.code !== undefined && albumDetail.code !== 0) {
              console.warn(`[warn] 相册 ${album.name} 无法访问 (code: ${albumDetail.code})`)
              break
            }

            const photoData = albumDetail?.data || {}
            const photoList = Array.isArray(photoData.photoList) ? photoData.photoList : []
            const nextPageStartValue = Number(photoData.nextPageStart)
            const nextPageStart =
              Number.isFinite(nextPageStartValue) && nextPageStartValue >= pageStart
                ? nextPageStartValue
                : pageStart + batchSize
            const totalPhotos = Number(album.total)
            const responseHasMore =
              typeof photoData.hasMore === 'boolean'
                ? photoData.hasMore
                : totalPhotos > 0
                  ? nextPageStart < totalPhotos
                  : photoList.length === batchSize
            const hasMore = responseHasMore

            if (nextPageStart <= pageStart && hasMore) {
              console.warn(`[warn] 相册 ${album.name} 下载游标未推进，停止处理`, {
                pageStart,
                nextPageStart
              })
              break
            }

            // 再次检查取消状态
            if (downloadCancelled.value || downloadStore.isGloballyCancelled(album.id)) {
              break
            }

            if (photoList.length > 0) {
              // 立即添加这批照片到下载队列
              const albumData = {
                album: {
                  id: album.id,
                  name: generateUniqueAlbumName(album),
                  total: album.total,
                  desc: album.desc
                },
                photos: photoList,
                uin: resolveSelfQzoneUin(userStore) || 'unknown',
                albumId: album.id,
                batch: downloadBatch,
                ...(isFriendMode.value ? { friendUin: effectiveHostUin.value } : {})
              }

              const addResult = await window.QzoneAPI.download.addAlbum(albumData)
              addedPhotosCount += batchTaskIds(addResult).length
            }

            // 更新获取进度
            const processedCount =
              Number.isFinite(totalPhotos) && totalPhotos > 0
                ? Math.min(totalPhotos, nextPageStart)
                : nextPageStart
            downloadStore.updateFetchProgress(album.id, processedCount)

            if (!hasMore) {
              break
            }

            pageStart = nextPageStart
            await new Promise((resolve) => setTimeout(resolve, 100))
          } catch (error) {
            console.error('获取相册照片批次失败:', error)
            break
          }
        }

        // 获取完成，清理获取标记
        downloadStore.setAlbumFetching(album.id, false)

        if (downloadCancelled.value) break

        // 检查是否被单独取消
        if (downloadStore.isGloballyCancelled(album.id)) {
          console.log(`[warn] 相册 ${album.name} 被用户单独取消`)
          downloadStore.clearGlobalCancelFlag(album.id)
          // 不计入失败，继续处理下一个相册
          processedAlbumCount++
          continue
        }

        if (addedPhotosCount > 0) {
          // 重置状态，让任务系统接管
          downloadStore.resetAlbumState(album.id)
          successCount++
          console.log(`[ok] 成功添加相册: ${album.name} (${addedPhotosCount}个任务)`)
        } else {
          // 可能为空、无权限，或所选日期没有匹配内容；最终由批次汇总统一说明。
          console.warn(`[warn] 相册 ${album.name} 没有创建下载任务，跳过`)
          downloadStore.resetAlbumState(album.id)
        }

        // 清理该相册的全局取消标志
        downloadStore.clearGlobalCancelFlag(album.id)
        processedAlbumCount++

        // 添加延迟，避免请求过于频繁
        await new Promise((resolve) => setTimeout(resolve, 200))
      } catch (error) {
        if (downloadCancelled.value) break
        console.error(`[error] 下载相册 ${album.name} 失败:`, error)
        downloadStore.resetAlbumState(album.id)
        downloadStore.errorAlbumDownload(album.id, error.message)
        // 清理该相册的全局取消标志
        downloadStore.clearGlobalCancelFlag(album.id)
        processedAlbumCount++
      }
    }

    const batchSummary = await finishDownloadBatch(downloadBatch, downloadCancelled.value)
    batchFinished = true

    // 完成处理
    if (downloadCancelled.value) {
      // 清理所有正在获取的相册状态
      downloadStore.cancelAllFetching()
      ElMessage.warning(`下载已取消；${batchSummaryText(batchSummary)}`)
    } else {
      if (successCount > 0) {
        ElMessage.success(batchSummaryText(batchSummary))
        // 显示下载管理器
        downloadProgressVisible.value = true
      } else if (batchSummary?.scanned > 0 && batchSummary?.matched === 0) {
        ElMessage.warning(`所选日期没有匹配内容，共检查 ${batchSummary.scanned} 项`)
      } else {
        ElMessage.error('没有成功添加任何相册，请检查网络连接')
      }
    }
  } catch (error) {
    console.error('批量下载失败:', error)
    ElMessage.error('批量下载失败，请重试')
    // 清理所有正在获取的相册状态
    downloadStore.cancelAllFetching()
  } finally {
    if (downloadBatch && !batchFinished) {
      await finishDownloadBatch(downloadBatch, true).catch(() => null)
    }
    // 重置状态
    isDownloadingAll.value = false
    isCancelling.value = false
    downloadCancelled.value = false

    // 清理所有全局取消标志
    albumsToDownload.forEach((album) => {
      downloadStore.clearGlobalCancelFlag(album.id)
    })

    setTimeout(() => {
      downloadProgress.value.visible = false
    }, 2000)
  }
}

// 取消下载全部相册
const cancelDownloadAll = async () => {
  isCancelling.value = true
  downloadCancelled.value = true
  downloadProgress.value.text = '正在取消下载...'

  ElMessage.info('正在取消批量下载...')

  // 清理所有正在获取的相册状态
  downloadStore.cancelAllFetching()

  // 等待当前操作完成
  setTimeout(() => {
    isCancelling.value = false
    isDownloadingAll.value = false
    downloadProgress.value.visible = false
    downloadCancelled.value = false
  }, 1000)
}

const formatSpeed = (speed) => {
  if (speed > 0) {
    return `+${speed}/天`
  } else if (speed < 0) {
    return `${speed}/天`
  }
  return '0/天'
}

/**
 * 格式化存储空间显示
 * @returns {string} 格式化的存储空间字符串
 */
const formatStorage = () => {
  if (!apiData.value?.user?.diskused) {
    return '--'
  }

  // diskused 单位是 MB，需要转换为字节
  const bytes = apiData.value.user.diskused * 1024 * 1024
  return formatBytes(bytes)
}

const total = ref(0)
const pageSize = ref(15)
const clickItem = ref({})
const apiData = ref()
const selectedAlbumKey = ref('')
const openedKeys = ref(new Set())
// 当前相册ID，用于上传任务过滤
const currentAlbumId = ref(null)

const menuList = computed(() => {
  if (!apiData.value || !apiData.value.classList) {
    return []
  }

  const classMap = {}
  apiData.value.classList.forEach((cls) => {
    classMap[cls.id] = cls.name
  })

  // 支持两种格式：albumListModeClass（分类格式）和 albumListModeSort（平铺格式）
  if (apiData.value.albumListModeClass && Array.isArray(apiData.value.albumListModeClass)) {
    // 格式1：分类格式
    return apiData.value.albumListModeClass.map((category) => ({
      classId: category.classId,
      className: classMap[category.classId] || category.className || '其他',
      albums: category.albumList || []
    }))
  } else if (apiData.value.albumListModeSort && Array.isArray(apiData.value.albumListModeSort)) {
    // 格式2：平铺格式，需要转换为分类格式
    const categoryMap = new Map()

    apiData.value.albumListModeSort.forEach((album) => {
      const classId = album.classid
      if (!categoryMap.has(classId)) {
        categoryMap.set(classId, {
          classId: classId,
          className: classMap[classId] || '其他',
          albums: []
        })
      }
      categoryMap.get(classId).albums.push(album)
    })

    return Array.from(categoryMap.values())
  }

  return []
})

const selectAlbum = (album) => {
  clickItem.value = album
  // 更新当前相册ID（用于 UploadDialog 的相册隔离）
  const newAlbumId = album?.id || null
  currentAlbumId.value = newAlbumId
  emit('album-selected', album)
}

// 通过 albumId 选择相册（用于从动态跳转）
const selectAlbumById = (albumId) => {
  if (!albumId || !menuList.value) return false

  // 遍历所有分类和相册，查找匹配的相册
  for (const category of menuList.value) {
    if (category.albums && Array.isArray(category.albums)) {
      const album = category.albums.find((a) => a.id === albumId)
      if (album) {
        // 确保该分类是展开的
        openedKeys.value.add(String(category.classId))
        // 选择相册
        selectAlbumItem(category.classId, album)
        return true
      }
    }
  }

  return false
}

// 通过 albumId 查找相册对象（不选择，仅返回）
const findAlbumById = async (albumId) => {
  if (!albumId || !menuList.value) return null

  // 遍历所有分类和相册，查找匹配的相册
  for (const category of menuList.value) {
    if (category.albums && Array.isArray(category.albums)) {
      const album = category.albums.find((a) => a.id === albumId)
      if (album) {
        return album
      }
    }
  }

  return null
}

const fetchPhotoData = async () => {
  const requestId = ++albumLoadRequestId
  loading.value = true
  updateAlbumLoadState(
    createAlbumLoadState(ALBUM_LOAD_STATUS.LOADING, { friendMode: isFriendMode.value })
  )
  let allAlbumsData = []

  try {
    // 获取初始数据
    const initialRes = await retryPageRequest(
      () =>
        window.QzoneAPI.getPhotoList(
          {
            hostUin: effectiveHostUin.value,
            pageStart: 0,
            pageNum: pageSize.value
          },
          friendMeta.value
        ),
      { attempts: 3, delayMs: 400 }
    )
    if (requestId !== albumLoadRequestId) return

    const responseState = resolveAlbumResponseState(initialRes, {
      friendMode: isFriendMode.value
    })
    if (responseState.status !== ALBUM_LOAD_STATUS.READY) {
      updateAlbumLoadState(responseState)
      console.error('[Left] 获取相册数据失败：响应不可用', {
        status: responseState.status,
        code: initialRes?.code
      })
      return
    }

    console.debug('[Left] 相册初始数据已获取', {
      albumsInUser: initialRes.data.albumsInUser || 0
    })

    // 初始化数据
    apiData.value = initialRes.data
    total.value = initialRes.data.albumsInUser || 0

    // 支持两种格式：albumListModeClass（分类格式）和 albumListModeSort（平铺格式）
    if (initialRes.data.albumListModeClass && Array.isArray(initialRes.data.albumListModeClass)) {
      // 格式1：分类格式
      allAlbumsData = JSON.parse(JSON.stringify(initialRes.data.albumListModeClass))

      // 从 classList 映射分类名称
      if (initialRes.data.classList && Array.isArray(initialRes.data.classList)) {
        const classNameMap = {}
        initialRes.data.classList.forEach((cls) => {
          classNameMap[cls.id] = cls.name
        })
        allAlbumsData.forEach((category) => {
          if (!category.className && classNameMap[category.classId]) {
            category.className = classNameMap[category.classId]
          }
        })
      }

      console.log(`[Left] 初始加载完成（分类格式）: ${allAlbumsData.length} 个分类`)

      // 按分类逐个加载剩余数据
      for (let i = 0; i < allAlbumsData.length; i++) {
        const category = allAlbumsData[i]
        const totalInClass = category.totalInClass || 0
        const categoryName = category.className || category.name || `分类${category.classId}`

        // 如果该分类还有更多数据，逐页加载
        if ((category.albumList?.length || 0) < totalInClass) {
          console.log(
            `[Left] 加载分类 ${categoryName}: ${category.albumList?.length || 0}/${totalInClass}`
          )
        }

        while ((category.albumList?.length || 0) < totalInClass) {
          const currentLoaded = category.albumList?.length || 0
          const nextPageStart = category.nextPageStart || currentLoaded

          try {
            const categoryRes = await retryPageRequest(
              () =>
                window.QzoneAPI.getPhotoList(
                  {
                    hostUin: effectiveHostUin.value,
                    pageStart: nextPageStart,
                    pageNum: pageSize.value,
                    mode: 4,
                    classId: category.classId
                  },
                  friendMeta.value
                ),
              { attempts: 3, delayMs: 400 }
            )

            if (!categoryRes || !categoryRes.data) {
              console.warn(`[Left] 分类 ${categoryName} 加载失败`)
              break
            }

            // 提取相册列表
            const newAlbums = categoryRes.data.albumList || []
            if (newAlbums.length === 0) break

            // 去重并合并
            const existingIds = new Set(category.albumList.map((album) => album.id))
            const uniqueNewAlbums = newAlbums.filter((album) => !existingIds.has(album.id))

            if (uniqueNewAlbums.length > 0) {
              category.albumList.push(...uniqueNewAlbums)
            }

            // 更新分页信息
            const responseNextStart = Number(categoryRes.data.nextPageStart)
            category.nextPageStart =
              Number.isFinite(responseNextStart) && responseNextStart > nextPageStart
                ? responseNextStart
                : nextPageStart + newAlbums.length
            if (categoryRes.data.totalInClass !== undefined) {
              category.totalInClass = categoryRes.data.totalInClass
            }

            // 可见结果全部重复时仍按服务端游标继续；只有到达总数、空页或游标停滞才结束。
            if (
              category.albumList.length >= category.totalInClass ||
              newAlbums.length === 0 ||
              category.nextPageStart <= nextPageStart
            ) {
              break
            }

            await new Promise((resolve) => setTimeout(resolve, 100))
          } catch (error) {
            console.error(`[Left] 加载分类 ${categoryName} 失败:`, error)
            break
          }
        }
      }
    } else if (
      initialRes.data.albumListModeSort &&
      Array.isArray(initialRes.data.albumListModeSort)
    ) {
      // 格式2：平铺格式，需要转换为分类格式并分页加载
      const classNameMap = {}
      if (initialRes.data.classList && Array.isArray(initialRes.data.classList)) {
        initialRes.data.classList.forEach((cls) => {
          classNameMap[cls.id] = cls.name
        })
      }

      // 将平铺的相册按分类分组
      const categoryMap = new Map()
      initialRes.data.albumListModeSort.forEach((album) => {
        const classId = album.classid
        if (!categoryMap.has(classId)) {
          categoryMap.set(classId, {
            classId: classId,
            className: classNameMap[classId] || '其他',
            albumList: [],
            totalInClass: 0,
            nextPageStart: 0
          })
        }
        categoryMap.get(classId).albumList.push(album)
      })

      allAlbumsData = Array.from(categoryMap.values())
      console.log(`[Left] 初始加载完成（平铺格式）: ${allAlbumsData.length} 个分类`)

      // 平铺格式需要继续分页加载
      let pageStart =
        initialRes.data.nextPageStartModeSort || initialRes.data.albumListModeSort.length
      const totalAlbums = initialRes.data.albumsInUser || 0

      while (pageStart < totalAlbums && pageStart > 0) {
        try {
          const previousPageStart = pageStart
          const nextRes = await retryPageRequest(
            () =>
              window.QzoneAPI.getPhotoList(
                {
                  hostUin: effectiveHostUin.value,
                  pageStart: previousPageStart,
                  pageNum: pageSize.value,
                  mode: 2 // normal模式
                },
                friendMeta.value
              ),
            { attempts: 3, delayMs: 400 }
          )

          if (!nextRes || !nextRes.data || !nextRes.data.albumListModeSort) {
            break
          }

          // 将新相册分配到对应分类
          nextRes.data.albumListModeSort.forEach((album) => {
            const classId = album.classid
            let category = categoryMap.get(classId)
            if (!category) {
              category = {
                classId: classId,
                className: classNameMap[classId] || '其他',
                albumList: [],
                totalInClass: 0,
                nextPageStart: 0
              }
              categoryMap.set(classId, category)
              allAlbumsData.push(category)
            }

            // 去重
            const existingIds = new Set(category.albumList.map((a) => a.id))
            if (!existingIds.has(album.id)) {
              category.albumList.push(album)
            }
          })

          // 更新分页；去重不会影响服务端游标推进。
          const pageAlbums = nextRes.data.albumListModeSort
          const responseNextStart = Number(nextRes.data.nextPageStartModeSort)
          pageStart =
            Number.isFinite(responseNextStart) && responseNextStart > previousPageStart
              ? responseNextStart
              : previousPageStart + pageAlbums.length
          if (pageAlbums.length === 0 || pageStart <= previousPageStart) {
            break
          }

          await new Promise((resolve) => setTimeout(resolve, 100))
        } catch (error) {
          console.error('[Left] 加载平铺格式数据失败:', error)
          break
        }
      }
    } else {
      console.error('[Left] 未找到有效的相册数据格式')
      updateAlbumLoadState(
        createAlbumLoadState(ALBUM_LOAD_STATUS.ERROR, { friendMode: isFriendMode.value })
      )
      return
    }

    // 更新最终数据
    apiData.value.albumListModeClass = allAlbumsData

    // 统计总相册数
    const totalAlbums = allAlbumsData.reduce((sum, cat) => sum + (cat.albumList?.length || 0), 0)
    console.log(`[Left] 所有相册加载完成，总计 ${totalAlbums} 个相册`)
    updateAlbumLoadState(
      createAlbumLoadState(totalAlbums > 0 ? ALBUM_LOAD_STATUS.READY : ALBUM_LOAD_STATUS.EMPTY, {
        friendMode: isFriendMode.value
      })
    )

    // 设置默认选中第一个相册
    nextTick(() => {
      if (apiData.value && apiData.value.albumListModeClass) {
        const firstCategory = apiData.value.albumListModeClass[0]
        if (firstCategory && firstCategory.albumList && firstCategory.albumList.length > 0) {
          const firstAlbum = firstCategory.albumList[0]
          if (firstAlbum) {
            selectedAlbumKey.value = `${firstCategory.classId}-${firstAlbum.id}`
            selectAlbum(firstAlbum)
          }
        }
      }
    })
  } catch (error) {
    console.error('[Left] 加载相册数据失败:', error)
    if (requestId === albumLoadRequestId) {
      updateAlbumLoadState(classifyAlbumLoadFailure(error, { friendMode: isFriendMode.value }))
    }
  } finally {
    if (requestId === albumLoadRequestId) {
      loading.value = false
    }
  }
}

// 初始化下载任务状态
const initDownloadTasks = async () => {
  try {
    await downloadStore.loadTasks()
    // 加载下载统计
    await loadDownloadStats()
  } catch (error) {
    console.error('初始化下载任务状态失败:', error)
  }
}

// 加载下载统计
const loadDownloadStats = async () => {
  try {
    const stats = await window.QzoneAPI.download.getStats()
    activeTaskCount.value = stats.downloading + stats.waiting + stats.paused
    detailedStatus.value = {
      downloading: stats.downloading,
      waiting: stats.waiting,
      paused: stats.paused,
      total: stats.downloading + stats.waiting + stats.paused,
      primaryStatus:
        stats.downloading + stats.waiting > 0 ? 'active' : stats.paused > 0 ? 'paused' : 'idle'
    }
  } catch (error) {
    console.error('加载下载统计失败:', error)
  }
}

// 下载监听器清理函数
const downloadListenerCleanups = []

// 设置下载状态监听器
const setupDownloadListeners = () => {
  cleanupDownloadListeners()
  // 监听活跃任务数量更新（主要监听器）
  const cleanup1 = window.QzoneAPI.download.onActiveCountUpdate((count) => {
    activeTaskCount.value = count
  })

  // 监听详细状态更新（新增，用于状态文本显示）
  const cleanup2 = window.QzoneAPI.download.onDetailedStatusUpdate((status) => {
    detailedStatus.value = status
    // 同步更新活跃任务数量
    activeTaskCount.value = status.total
  })

  // 监听统计信息更新（备用）
  const cleanup3 = window.QzoneAPI.download.onStatsUpdate((stats) => {
    activeTaskCount.value = stats.downloading + stats.waiting + stats.paused
    detailedStatus.value = {
      downloading: stats.downloading,
      waiting: stats.waiting,
      paused: stats.paused,
      total: stats.downloading + stats.waiting + stats.paused,
      primaryStatus:
        stats.downloading + stats.waiting > 0 ? 'active' : stats.paused > 0 ? 'paused' : 'idle'
    }
  })

  downloadListenerCleanups.push(cleanup1, cleanup2, cleanup3)
}

// 清理下载监听器
const cleanupDownloadListeners = () => {
  try {
    downloadListenerCleanups.forEach((cleanup) => {
      cleanup()
    })
    downloadListenerCleanups.length = 0
  } catch (error) {
    console.error('清理下载监听器失败:', error)
  }
}

// 初始化上传任务状态
const initUploadTasks = async () => {
  try {
    // 加载上传统计
    await loadUploadStats()
  } catch (error) {
    console.error('初始化上传任务状态失败:', error)
  }
}

// 加载上传统计（全局统计，不按相册过滤）
const loadUploadStats = async () => {
  try {
    console.log('[Left] 正在加载全局上传统计...')
    const stats = await window.QzoneAPI.upload.getStats()
    console.log('[Left] 获取到上传统计:', stats)

    const activeCount = stats.uploading + stats.waiting + stats.paused
    activeUploadTaskCount.value = activeCount

    const detailedStatus = {
      uploading: stats.uploading,
      waiting: stats.waiting,
      paused: stats.paused,
      total: activeCount,
      primaryStatus:
        stats.uploading + stats.waiting > 0 ? 'active' : stats.paused > 0 ? 'paused' : 'idle'
    }
    uploadDetailedStatus.value = detailedStatus

    console.log(
      '[Left] 设置后的状态 - activeCount:',
      activeCount,
      'detailedStatus:',
      detailedStatus
    )
    console.log('[Left] hasActiveUploadTasks:', hasActiveUploadTasks.value)
    console.log('[Left] uploadStatusText:', uploadStatusText.value)
  } catch (error) {
    console.error('[Left] 加载上传统计失败:', error)
  }
}

// 上传监听器清理函数
const uploadListenerCleanups = []

// 防抖刷新相册
const debouncedRefreshAlbum = () => {
  // 清除之前的定时器
  if (refreshDebounceTimer) {
    clearTimeout(refreshDebounceTimer)
  }

  // 设置新的定时器：2秒后执行刷新
  refreshDebounceTimer = setTimeout(() => {
    if (pendingRefreshAlbums.size > 0 && refreshAlbumCallback) {
      // 检查是否需要刷新当前相册
      const currentAlbumId = String(clickItem.value?.id || '').trim()
      if (currentAlbumId && pendingRefreshAlbums.has(currentAlbumId)) {
        console.log(`[Left] 刷新相册: ${clickItem.value.name}`)
        refreshAlbumCallback()
      }
      // 清空待刷新列表
      pendingRefreshAlbums.clear()
    }
    refreshDebounceTimer = null
  }, 2000) // 2秒防抖
}

// 设置上传状态监听器
const setupUploadListeners = () => {
  cleanupUploadListeners()
  // 监听活跃任务数量更新（主要监听器）
  const cleanup1 = window.QzoneAPI.upload.onActiveCountUpdate((count) => {
    activeUploadTaskCount.value = count
  })

  // 监听详细状态更新（主要用于状态文本显示）
  const cleanup2 = window.QzoneAPI.upload.onDetailedStatusUpdate((status) => {
    uploadDetailedStatus.value = status
    // 同步更新活跃任务数量
    activeUploadTaskCount.value = status.total
  })

  // 监听统计信息更新（备用）
  const cleanup3 = window.QzoneAPI.upload.onStatsUpdate((stats) => {
    activeUploadTaskCount.value = stats.uploading + stats.waiting + stats.paused
    uploadDetailedStatus.value = {
      uploading: stats.uploading,
      waiting: stats.waiting,
      paused: stats.paused,
      total: stats.uploading + stats.waiting + stats.paused,
      primaryStatus:
        stats.uploading + stats.waiting > 0 ? 'active' : stats.paused > 0 ? 'paused' : 'idle'
    }
  })

  // 监听任务变化（用于检测任务完成）
  const cleanup4 = window.QzoneAPI.upload.onTaskChanges((changedTasks) => {
    if (!Array.isArray(changedTasks)) return

    // 检查是否有任务完成
    const completedTasks = changedTasks.filter((task) => task.status === 'completed')
    if (completedTasks.length > 0) {
      // 收集需要刷新的相册ID
      completedTasks.forEach((task) => {
        const albumId = String(task.albumId || '').trim()
        if (albumId) {
          pendingRefreshAlbums.add(albumId)
        }
      })

      // 触发防抖刷新
      debouncedRefreshAlbum()
    }
  })

  uploadListenerCleanups.push(cleanup1, cleanup2, cleanup3, cleanup4)
}

// 清理上传监听器
const cleanupUploadListeners = () => {
  try {
    uploadListenerCleanups.forEach((cleanup) => {
      cleanup()
    })
    uploadListenerCleanups.length = 0

    // 清理防抖定时器
    if (refreshDebounceTimer) {
      clearTimeout(refreshDebounceTimer)
      refreshDebounceTimer = null
    }
    pendingRefreshAlbums.clear()
  } catch (error) {
    console.error('清理上传监听器失败:', error)
  }
}

// 打开 QQ 空间官网
const openQzoneWeb = async () => {
  try {
    await window.api.invoke('window:openQzoneWeb', {
      uin: userStore.Uin,
      p_skey: userStore.PSkey
    })
  } catch (error) {
    console.error('打开官网失败:', error)
    ElMessage.error('打开官网失败')
  }
}

const openQzoneProfile = (targetUin, name = '', img = '') => {
  const normalizedUin = String(targetUin || '').replace(/^o/, '')
  if (!normalizedUin) return
  emit('enter-friend', {
    uin: normalizedUin,
    name: name || `QQ ${normalizedUin}`,
    img: img || `https://qlogo4.store.qq.com/qzone/${normalizedUin}/${normalizedUin}/100`
  })
}

// 打开好友 QQ 空间
const openFriendQzoneWeb = async () => {
  if (!props.currentFriend?.uin) return
  try {
    await window.api.invoke('window:openQzoneWeb', {
      uin: userStore.Uin,
      p_skey: userStore.PSkey,
      targetUin: props.currentFriend.uin
    })
  } catch (error) {
    console.error('打开好友空间失败:', error)
    ElMessage.error('打开好友空间失败')
  }
}

// 确认登出
const confirmLogout = async () => {
  // 登出并清除用户信息
  try {
    await userStore.logout()
    ElMessage.success('已成功登出')
  } catch (error) {
    console.error('登出失败:', error)
    ElMessage.error('登出失败')
  }
}

onBeforeMount(() => {
  fetchPhotoData()
  initDownloadTasks()
  setupDownloadListeners()
  initUploadTasks()
  setupUploadListeners()
})

// 当进入/退出好友模式时，重新加载相册列表
watch(
  () => [props.viewMode, props.currentFriend?.uin],
  ([newMode, newUin], [oldMode, oldUin]) => {
    // 切换模式或切换好友时重新加载
    if (newMode !== oldMode || newUin !== oldUin) {
      apiData.value = null
      clickItem.value = null
      selectedAlbumKey.value = ''
      currentModule.value = props.activeModule || currentModule.value
      selectedPhotoType.value = props.photoType || selectedPhotoType.value
      // 立即清空右侧相册内容，避免残留上一个好友的数据
      emit('album-selected', null)
      updateAlbumLoadState(
        createAlbumLoadState(ALBUM_LOAD_STATUS.LOADING, { friendMode: isFriendMode.value })
      )
      nextTick(() => fetchPhotoData())
    }
  }
)

onBeforeUnmount(() => {
  cleanupDownloadListeners()
  cleanupUploadListeners()
})

// 更新视频统计信息（合并字段，未传则保留旧值）
const updateVideoStats = (stats) => {
  if (!stats) return
  videoStats.value = { ...videoStats.value, ...stats }
}

// 更新照片统计信息
const updatePhotoStats = (stats) => {
  if (!stats) return
  photoStats.value = { ...photoStats.value, ...stats }
}

// ============ 「动态」模块：sidebar 数据 ============
// feeds-module 推两类数据：
//   1) 当前 sub-tab 的批次聚合（loaded / mediaCount / likeCount / cmtCount / activeSourceLabel）
//   2) 访客 / 浏览统计（totalViews / todayViews / visitorCount / blockedCount / mods / trend / recentVisitors）
const feedsStats = reactive({
  loaded: 0,
  activeSourceKey: '',
  activeSourceLabel: '',
  mediaCount: 0,
  imageCount: 0,
  videoCount: 0,
  cmtCount: 0,
  likeCount: 0,
  fwdCount: 0,
  viewCount: 0,
  mediaFeedCount: 0,
  commentedFeedCount: 0,
  likedFeedCount: 0,
  viewedFeedCount: 0,
  downloadableFeedCount: 0,
  typeCounts: {},
  actionCounts: {},
  topAuthors: [],
  oldestTime: 0,
  latestTime: 0,
  sourceBadgeRows: [],

  totalViews: 0,
  todayViews: 0,
  visitorCount: 0,
  blockedCount: 0,
  mods: [],
  trend: [],
  recentVisitors: [],
  visitorLoaded: false,
  visitorLoading: false,
  visitorError: '',
  retryVisitors: null
})
const feedsPeopleExpanded = ref(false)
const updateFeedsStats = (stats) => {
  if (!stats) return
  Object.assign(feedsStats, stats)
}

// 给 30 天 sparkline 归一化用
const feedsTrendMax = computed(() => Math.max(0, ...(feedsStats.trend || [])))

const feedsDynamicMod = computed(
  () => (feedsStats.mods || []).find((m) => Number(m.mod) === 8 || m.name === '动态') || null
)

const feedsEngagementTotal = computed(
  () => (feedsStats.likeCount || 0) + (feedsStats.cmtCount || 0) + (feedsStats.fwdCount || 0)
)

const feedsItemUnit = computed(() =>
  feedsStats.activeSourceKey === 'messageBoard' ? '留言' : '动态'
)

const feedsUniqueAuthorCount = computed(() =>
  feedsStats.topAuthors?.length
    ? Math.max(feedsStats.topAuthors.length, Number(feedsStats.uniqueAuthorCount || 0))
    : Number(feedsStats.uniqueAuthorCount || 0)
)
const visibleFeedsAuthors = computed(() =>
  feedsPeopleExpanded.value ? feedsStats.topAuthors : feedsStats.topAuthors.slice(0, 5)
)

watch(
  () => feedsStats.activeSourceKey,
  () => {
    feedsPeopleExpanded.value = false
    feedsStatsExpanded.value = false
  }
)

const toPercentText = (value, total) => {
  if (!total) return '0%'
  return `${Math.round((value / total) * 100)}%`
}

const feedsAvgLike = computed(() => {
  const loaded = feedsStats.loaded || 0
  return loaded
    ? ((feedsStats.likeCount || 0) / loaded).toFixed(
        (feedsStats.likeCount || 0) >= loaded * 10 ? 0 : 1
      )
    : '0'
})
const feedsAvgComment = computed(() => {
  const loaded = feedsStats.loaded || 0
  return loaded
    ? ((feedsStats.cmtCount || 0) / loaded).toFixed(
        (feedsStats.cmtCount || 0) >= loaded * 10 ? 0 : 1
      )
    : '0'
})
const feedsMediaRate = computed(() =>
  toPercentText(feedsStats.mediaFeedCount || 0, feedsStats.loaded || 0)
)
const feedsViewedRate = computed(() =>
  toPercentText(feedsStats.viewedFeedCount || 0, feedsStats.loaded || 0)
)
const feedsMediaText = computed(() => {
  const imageCount = Number(feedsStats.imageCount || 0)
  const videoCount = Number(feedsStats.videoCount || 0)
  if (!imageCount && !videoCount) return '暂无媒体'
  if (imageCount && videoCount) return `${imageCount} 图 · ${videoCount} 视频`
  return imageCount ? `${imageCount} 张照片` : `${videoCount} 个视频`
})
const feedsPulseText = computed(() => {
  if (!Number(feedsStats.loaded || 0)) return '当前分类暂无内容'
  const pieces = []
  if (feedsTimeRangeText.value) pieces.push(feedsTimeRangeText.value)
  if (feedsUniqueAuthorCount.value) pieces.push(`${feedsUniqueAuthorCount.value} 人`)
  if (feedsEngagementTotal.value) pieces.push(`${feedsEngagementTotal.value} 次互动`)
  return pieces.length ? pieces.join(' · ') : '当前页内容已加载'
})

const feedsTypeRows = computed(() => {
  const entries = Object.entries(feedsStats.typeCounts || {})
    .map(([label, count]) => ({ label, count: Number(count) || 0 }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count)
  const total = Math.max(
    1,
    entries.reduce((sum, row) => sum + row.count, 0)
  )
  return entries.map((row) => ({
    ...row,
    percent: Math.max(6, Math.round((row.count / total) * 100))
  }))
})

const feedsActionRows = computed(() =>
  Object.entries(feedsStats.actionCounts || {})
    .map(([label, count]) => ({ label, count: Number(count) || 0 }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count)
)

const feedsTimeRangeText = computed(() => {
  const latest = Number(feedsStats.latestTime || 0)
  const oldest = Number(feedsStats.oldestTime || 0)
  if (!latest && !oldest) return ''
  if (latest && oldest && latest !== oldest) {
    const days = Math.max(1, Math.ceil((latest - oldest) / 86400))
    return days <= 1 ? '今天范围' : `跨度 ${days} 天`
  }
  return formatRelativeTime(latest || oldest)
})

// 模块颜色（蓝紫青绿 主调，按 i 循环）—— 跟 60a5fa 主色保持同色系
const MOD_PALETTE = [
  'var(--theme-info)',
  'var(--theme-brand-text)',
  'var(--theme-success)',
  'var(--theme-warning)',
  'var(--theme-danger)',
  'color-mix(in srgb, var(--theme-info) 70%, var(--theme-success))',
  'var(--theme-text-muted)'
]
const modColor = (i) => MOD_PALETTE[i % MOD_PALETTE.length]

// 12345 → 1.2万；100000 → 10万
const formatFeedsBigNum = (n) => {
  if (!n && n !== 0) return ''
  if (n < 10000) return String(n)
  return (n / 10000).toFixed(n < 100000 ? 1 : 0) + '万'
}

// 把 trend 数组（N 天）转成 SVG polyline 的 points 字符串
const trendPolyline = (arr, w, h) => {
  if (!arr || !arr.length) return ''
  const max = Math.max(...arr, 1)
  const step = w / Math.max(arr.length - 1, 1)
  return arr
    .map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * (h - 4) - 2).toFixed(1)}`)
    .join(' ')
}

// 同样的归一化，但闭合到底部形成填充多边形
const trendAreaPolygon = (arr, w, h) => {
  if (!arr || !arr.length) return ''
  const line = trendPolyline(arr, w, h)
  return `0,${h} ${line} ${w},${h}`
}

const trendLastY = (arr, h) => {
  if (!arr || !arr.length) return h / 2
  const max = Math.max(...arr, 1)
  return h - (arr[arr.length - 1] / max) * (h - 4) - 2
}

// 把秒级时间戳转成 "刚刚 / 3分钟前 / 2小时前 / 昨天 / N 天前 / M月D日"
const formatRelativeTime = (sec) => {
  if (!sec) return ''
  const t = Number(sec)
  const now = Math.floor(Date.now() / 1000)
  const diff = now - t
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`
  if (diff < 86400 * 2) return '昨天'
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} 天前`
  const d = new Date(t * 1000)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

defineExpose({
  selectAlbumById,
  findAlbumById,
  retryPhotoData,
  updateVideoStats,
  updatePhotoStats,
  updateFeedsStats, // FeedsModule 调用回填统计
  videoFilters,
  photoFilters,
  menuList // 暴露分类后的相册列表给 UploadDialog 切换上传目标
})
</script>

<style scoped>
.space-sidebar {
  border-right: 1px solid var(--theme-border-subtle);
  background: color-mix(in srgb, var(--theme-canvas) 92%, transparent);
  transition:
    background-color var(--theme-duration) var(--theme-ease),
    border-color var(--theme-duration) var(--theme-ease);
}

/* 用户信息卡片 */
.user-section {
  padding: 6px 8px;
  padding-top: 0;
  border-bottom: 1px solid var(--theme-border-subtle);

  .user-card {
    border-radius: var(--theme-radius-md);
    border: 1px solid var(--theme-border-subtle);
    overflow: hidden;
    background: var(--theme-surface-soft);
    backdrop-filter: blur(10px);

    .card-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      background: transparent;

      .user-avatar {
        border: 2px solid var(--theme-brand-border);
        box-shadow: var(--theme-shadow-sm);
        transition: var(--ds-transition-all);

        &:hover {
          border-color: var(--theme-brand-accent);
          box-shadow: var(--theme-shadow-brand);
        }
      }

      .user-info {
        flex: 1;
        min-width: 0;

        .nickname {
          font-size: 12px;
          font-weight: 600;
          color: var(--theme-text-primary);
          line-height: 1.2;
          margin-bottom: 1px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;

          :deep(.friend-emoji),
          :deep(img) {
            width: 14px;
            height: 14px;
            margin: 0 1px;
            vertical-align: -0.16em;
          }
        }

        .uin-row {
          display: flex;
          align-items: center;
          gap: 4px;
          line-height: 1.1;
        }

        .uin {
          font-size: 12px;
          color: var(--theme-text-muted);
          font-variant-numeric: tabular-nums;
          user-select: none;
          transition: all 0.2s ease;
        }

        .uin-copyable {
          cursor: pointer;
          padding: 1px 4px;
          margin: -1px -4px;
          border-radius: 3px;

          &:hover {
            color: var(--theme-text-primary);
            background: var(--theme-surface-hover);
          }
          &:active {
            background: var(--theme-surface-active);
          }

          &:focus-visible {
            outline: 2px solid var(--theme-focus);
            outline-offset: 2px;
          }
        }

        .uin-toggle {
          font-size: 11px;
          color: var(--theme-text-subtle);
          cursor: pointer;
          padding: 2px;
          border-radius: 3px;
          transition: all 0.15s ease;

          &:hover {
            color: var(--theme-text-secondary);
            background: var(--theme-surface-hover);
          }

          &:focus-visible {
            outline: 2px solid var(--theme-focus);
            outline-offset: 2px;
          }
        }
      }

      .header-actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 4px;

        .open-web-btn {
          color: var(--theme-info);
          font-size: 16px;
          padding: 4px;
          min-width: unset;
          width: 28px;
          height: 28px;

          &:hover {
            color: var(--theme-info);
            background: var(--theme-info-soft);
          }
        }

        .header-logout {
          color: var(--theme-danger-text);
          font-size: 16px;
          padding: 4px;
          min-width: unset;
          width: 28px;
          height: 28px;
          margin-left: 0px !important;

          &:hover {
            color: var(--theme-danger);
            background: var(--theme-danger-soft);
          }
        }
      }
    }

    .card-stats {
      padding: 8px 10px;

      .stat-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px 10px;

        .stat-item {
          display: flex;
          flex-direction: column;
          align-items: flex-start;

          &.capacity-stat {
            .capacity-label {
              display: inline-flex;
              align-items: center;
              gap: 3px;
            }

            .capacity-help {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              width: 15px;
              height: 15px;
              padding: 0;
              border: 0;
              border-radius: 50%;
              color: var(--theme-text-subtle);
              background: transparent;
              cursor: help;
              transition:
                color 0.16s ease,
                background-color 0.16s ease;

              &:hover,
              &:focus-visible {
                color: var(--theme-text-secondary);
                background: var(--theme-surface-hover);
              }

              &:focus-visible {
                outline: 2px solid var(--theme-focus);
                outline-offset: 1px;
              }
            }
          }

          .label {
            font-size: 12px;
            color: var(--theme-text-subtle);
            line-height: 1;
            margin-bottom: 3px;
            font-weight: 500;
          }

          .value {
            font-size: 11px;
            font-weight: 600;
            color: var(--theme-text-primary);
            line-height: 1.1;

            &.level {
              color: var(--theme-text-primary);
            }

            &.growth {
              color: var(--theme-text-primary);
            }

            &.speed {
              color: var(--theme-text-primary);
            }

            &.storage {
              color: var(--theme-text-primary);
            }
          }
        }
      }
    }

    .card-actions {
      display: flex;
      align-items: center;
      border-top: 1px solid var(--theme-border-subtle);
      background: var(--theme-surface-soft);

      .action-item {
        flex: 1;
        display: flex;
        justify-content: center;
        align-items: center;

        .action-btn {
          font-size: 11px;
          color: var(--theme-text-secondary);
          border: none;
          background: none;
          padding: 6px 12px;
          transition: all 0.2s ease;
          width: 100%;
          justify-content: center;
          min-height: 32px;

          &:hover {
            color: var(--theme-text-primary);
            background: var(--theme-surface-hover);
          }

          &.logout-btn {
            color: var(--theme-danger-text);

            &:hover {
              color: var(--theme-danger);
              background: var(--theme-danger-soft);
            }
          }

          &.download-btn {
            position: relative;
            display: flex;
            align-items: center;
            gap: 6px;
            transition: all 0.3s ease;

            .download-btn-content {
              display: flex;
              align-items: center;
              gap: 6px;
              width: 100%;

              .icon-wrapper {
                position: relative;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 12px;
                height: 12px;

                .active-indicator {
                  position: absolute;
                  top: 50%;
                  left: 50%;
                  transform: translate(-50%, -50%);

                  .pulse-ring {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 16px;
                    height: 16px;
                    border: 1px solid var(--theme-info-border);
                    border-radius: 50%;
                    animation: pulse-ring 2s ease-out infinite;
                  }

                  .pulse-dot {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 4px;
                    height: 4px;
                    background: var(--theme-info);
                    border-radius: 50%;
                    animation: pulse-dot 2s ease-out infinite;
                  }
                }
              }

              .text-wrapper {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: flex-start;
                min-width: 0;

                .main-text {
                  font-size: 11px;
                  line-height: 1.2;
                  color: inherit;
                  font-weight: inherit;
                }

                .status-text {
                  font-size: 9px;
                  line-height: 1.1;
                  margin-top: 1px;
                  white-space: nowrap;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  max-width: 100%;
                  color: var(--theme-info-text);
                }
              }
            }

            &.has-active-tasks {
              .icon-wrapper {
                .el-icon {
                  color: var(--theme-info);
                }
              }

              .main-text {
                color: var(--theme-info);
              }
            }

            .downloading-icon {
              display: flex;
              align-items: center;
              justify-content: center;

              .loading-icon {
                color: var(--theme-info);
                animation: loading-spin 1s linear infinite;
              }
            }
          }

          :deep(.el-icon) {
            font-size: 12px;
            margin-right: 4px;
          }
        }
      }

      .action-divider {
        width: 1px;
        height: 24px;
        background: var(--theme-border);
        margin: 1px;
      }

      /* 管理器并排布局样式 */
      &.managers-layout {
        padding: 0;

        .manager-item {
          flex: 1;
          display: flex;
          justify-content: center;
          align-items: center;

          &:not(:last-child) {
            border-right: 1px solid color-mix(in srgb, var(--theme-text-inverse) 10%, transparent);
          }

          .manager-btn {
            font-size: 11px;
            color: var(--theme-text-secondary);
            border: none;
            background: none;
            padding: 6px 8px;
            transition: all 0.2s ease;
            width: 100%;
            justify-content: center;
            min-height: 36px;

            /* 该按钮紧贴带 overflow:hidden 的卡片边缘，外描边会被圆角裁掉。 */
            &:focus-visible {
              outline: none;
              box-shadow: inset 0 0 0 2px var(--theme-focus);
            }

            &:hover {
              color: var(--theme-text-inverse);
              background: color-mix(in srgb, var(--theme-text-inverse) 10%, transparent);
            }

            .manager-btn-content {
              display: flex;
              align-items: center;
              gap: 6px;
              width: 100%;

              .icon-wrapper {
                position: relative;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 12px;
                height: 12px;

                .active-indicator {
                  position: absolute;
                  top: 50%;
                  left: 50%;
                  transform: translate(-50%, -50%);

                  .pulse-ring {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 16px;
                    height: 16px;
                    border: 1px solid color-mix(in srgb, var(--theme-info) 40%, transparent);
                    border-radius: 50%;
                    animation: pulse-ring 2s ease-out infinite;
                  }

                  .pulse-dot {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 4px;
                    height: 4px;
                    background: var(--theme-info);
                    border-radius: 50%;
                    animation: pulse-dot 2s ease-out infinite;
                  }

                  &.upload-indicator {
                    .pulse-ring {
                      border-color: color-mix(in srgb, var(--theme-success) 40%, transparent);
                    }

                    .pulse-dot {
                      background: var(--theme-success);
                    }
                  }
                }
              }

              .text-wrapper {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: flex-start;
                min-width: 0;

                .main-text {
                  font-size: 11px;
                  line-height: 1.2;
                  color: inherit;
                  font-weight: inherit;
                }

                .status-text {
                  font-size: 9px;
                  line-height: 1.1;
                  margin-top: 1px;
                  white-space: nowrap;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  max-width: 100%;
                }
              }
            }

            &.has-active-tasks.download-btn {
              .icon-wrapper .el-icon {
                color: var(--theme-info);
              }

              .main-text {
                color: var(--theme-info);
              }

              .status-text {
                color: color-mix(in srgb, var(--theme-info) 80%, transparent);
              }
            }

            &.is-fetching-albums.download-btn {
              .fetching-icon {
                color: var(--theme-info);
                animation: loading-spin 1s linear infinite;
              }

              .main-text {
                color: var(--theme-info);
              }

              .status-text {
                color: color-mix(in srgb, var(--theme-info) 80%, transparent);
              }
            }

            &.has-active-tasks.upload-btn {
              .icon-wrapper .el-icon {
                color: var(--theme-success);
              }

              .main-text {
                color: var(--theme-success);
              }

              .status-text {
                color: color-mix(in srgb, var(--theme-success) 80%, transparent);
              }
            }

            :deep(.el-icon) {
              font-size: 12px;
            }
          }

          &:first-child .manager-btn {
            border-radius: 0 0 0 calc(var(--theme-radius-md) - 1px);
          }

          &:last-child .manager-btn {
            border-radius: 0 0 calc(var(--theme-radius-md) - 1px) 0;
          }

          &:only-child .manager-btn {
            border-radius: 0 0 calc(var(--theme-radius-md) - 1px) calc(var(--theme-radius-md) - 1px);
          }
        }
      }
    }
  }
}

/* Element Plus 菜单样式 */
.album-menu {
  background: transparent;
  border: none;
  padding: 4px 0 8px;

  :deep(.el-sub-menu) {
    .el-sub-menu__title {
      position: relative;
      background: transparent;
      color: var(--theme-text-secondary);
      font-size: 13px;
      font-weight: 600;
      padding: 0 34px 0 14px;
      height: 40px;
      line-height: 40px;
      border-left: 2px solid transparent;
      transition:
        color var(--theme-duration-fast) var(--theme-ease),
        background-color var(--theme-duration-fast) var(--theme-ease),
        border-color var(--theme-duration-fast) var(--theme-ease);
      border-radius: var(--theme-radius-sm);
      margin: 2px 8px;

      &:hover {
        background: var(--theme-surface-hover);
        border-left-color: var(--theme-border-strong);
        color: var(--theme-text-primary);
      }

      .el-sub-menu__icon-arrow {
        color: var(--theme-text-muted);
        font-size: 11px;
        margin-top: -5px;
        transition:
          color var(--theme-duration-fast) var(--theme-ease),
          transform var(--theme-duration) var(--theme-ease);
      }

      &:hover .el-sub-menu__icon-arrow {
        color: var(--theme-text-secondary);
      }
    }

    &.is-active > .el-sub-menu__title {
      background: transparent;
      border-left-color: var(--theme-brand-accent);
      color: var(--theme-text-primary);
    }

    &.is-opened > .el-sub-menu__title {
      background: var(--theme-surface-soft);
      color: var(--theme-text-primary);
    }

    &.is-opened .el-sub-menu__title .el-sub-menu__icon-arrow {
      transform: rotateZ(180deg);
    }
  }

  :deep(.el-menu-item) {
    background: transparent;
    color: var(--theme-text-secondary);
    padding: 0 12px;
    height: 36px;
    line-height: 36px;
    margin: 2px 8px 2px 18px;
    border-left: 2px solid transparent;
    border-radius: var(--theme-radius-sm);
    transition:
      color var(--theme-duration-fast) var(--theme-ease),
      background-color var(--theme-duration-fast) var(--theme-ease),
      border-color var(--theme-duration-fast) var(--theme-ease);

    &:hover {
      background: var(--theme-surface-hover);
      color: var(--theme-text-primary);
    }

    &.is-active {
      background: var(--theme-brand-soft) !important;
      color: var(--theme-text-primary) !important;
      border-left-color: var(--theme-brand-accent) !important;
      box-shadow: none;
    }

    &.is-downloading,
    &.is-fetching {
      background: color-mix(in srgb, var(--theme-info) 5%, transparent) !important;

      .album-num {
        .download-progress {
          color: var(--theme-info);
          font-weight: 600;
        }
      }
    }

    .album-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      position: relative;

      .download-indicator {
        position: absolute;
        left: -16px;
        top: 50%;
        transform: translateY(-50%);
        width: 12px;
        height: 12px;
        display: flex;
        align-items: center;
        justify-content: center;

        .el-icon {
          font-size: 12px;
          color: var(--theme-info);

          &.is-loading {
            animation: spin 1s linear infinite;
          }
        }
      }

      .album-info {
        display: flex;
        align-items: center;
        gap: 6px;
        flex: 1;
        margin-right: 8px;
        min-width: 0;

        .viewtype-badge {
          display: inline-flex;
          align-items: center;
          padding: 2px 6px;
          font-size: 10px;
          line-height: 1;
          border-radius: 3px;
          background: linear-gradient(
            135deg,
            color-mix(in srgb, var(--theme-info-strong) 15%, transparent),
            color-mix(in srgb, var(--theme-brand) 15%, transparent)
          );
          color: color-mix(in srgb, var(--theme-info-text) 90%, transparent);
          border: 1px solid color-mix(in srgb, var(--theme-info-strong) 20%, transparent);
          font-weight: 500;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .album-text {
          font-size: 12px;
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          min-width: 0;
        }
      }

      .album-lock-icon {
        font-size: 11px;
        color: var(--theme-text-disabled);
        flex-shrink: 0;
        margin-right: 2px;

        &.priv-self {
          color: color-mix(in srgb, var(--theme-danger) 40%, transparent);
        }

        &.priv-password,
        &.priv-question {
          color: color-mix(in srgb, var(--theme-warning) 50%, transparent);
        }

        &.priv-friend {
          color: color-mix(in srgb, var(--theme-info) 40%, transparent);
        }

        &.priv-partial {
          color: color-mix(in srgb, var(--theme-info) 30%, transparent);
        }

        &.priv-partial-hide {
          color: color-mix(in srgb, var(--theme-brand-accent) 35%, transparent);
        }

        &.clickable {
          cursor: pointer;

          &:hover {
            color: color-mix(in srgb, var(--theme-warning) 80%, transparent);
          }
        }
      }

      .album-num {
        font-size: 10px;
        color: var(--theme-text-muted);
        min-width: 30px;
        text-align: right;
      }
    }
  }

  .category-title {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-width: 0;

    .category-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .category-count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 20px;
      height: 18px;
      padding: 0 6px;
      border-radius: 9px;
      background: var(--theme-surface-soft);
      color: var(--theme-text-muted);
      font-size: 10px;
      font-weight: 600;
      line-height: 1;
      font-variant-numeric: tabular-nums;
    }
  }
}

/* 为滚动条预留空间 */
.menu-container {
  :deep(.el-scrollbar__wrap) {
    padding-right: 6px;
  }
}

.album-load-state {
  display: flex;
  min-height: 196px;
  padding: 28px 22px 24px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: var(--theme-text-secondary);

  .album-load-icon {
    width: 32px;
    height: 32px;
    margin-bottom: 12px;
    padding: 8px;
    border: 1px solid color-mix(in srgb, var(--theme-info) 20%, transparent);
    border-radius: 10px;
    background: color-mix(in srgb, var(--theme-info-strong) 10%, transparent);
    color: var(--theme-info-text);
    font-size: 16px;
  }

  h3 {
    margin: 0;
    color: var(--theme-text-primary);
    font-size: 14px;
    font-weight: 600;
    line-height: 1.45;
  }

  p {
    max-width: 194px;
    margin: 7px 0 0;
    color: var(--theme-text-muted);
    font-size: 12px;
    line-height: 1.6;
  }

  &.is-error {
    .album-load-icon {
      border-color: color-mix(in srgb, var(--theme-brand-accent) 20%, transparent);
      background: color-mix(in srgb, var(--theme-brand-accent) 10%, transparent);
      color: var(--theme-warning);
    }
  }

  .album-retry-button {
    min-height: 32px;
    margin-top: 16px;
    border-color: color-mix(in srgb, var(--theme-info) 42%, transparent);
    border-radius: 8px;
    background: color-mix(in srgb, var(--theme-info-strong) 10%, transparent);
    color: var(--theme-info-text);
    transition:
      background 0.2s ease,
      border-color 0.2s ease,
      color 0.2s ease;

    &:hover,
    &:focus-visible {
      border-color: color-mix(in srgb, var(--theme-info) 75%, transparent);
      background: color-mix(in srgb, var(--theme-info-strong) 20%, transparent);
      color: var(--theme-text-inverse);
    }

    &:focus-visible {
      outline: 2px solid color-mix(in srgb, var(--theme-info) 70%, transparent);
      outline-offset: 2px;
    }
  }
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .w-72 {
    width: 240px;
  }
}

@media (max-width: 768px) {
  .w-72 {
    width: 208px;
  }
}

/* Loading动画 */
@keyframes loading-spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

/* 新增动画效果 */
@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

/* 一级导航菜单 - TAB 样式 */
.main-navigation-tabs {
  display: flex;
  align-items: stretch;
  gap: 0;
  padding: 6px 8px;
  border-bottom: 1px solid var(--theme-border-subtle);
  background: var(--theme-surface-soft);
  min-height: 40px;
}

.nav-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 7px 4px;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  color: var(--theme-text-muted);
  font-size: 12px;
  font-weight: 500;
  position: relative;
  border: 0;
  background: transparent;
  font-family: inherit;
  border-radius: var(--theme-radius-sm);
  margin: 0 1px;

  .tab-icon {
    font-size: 13px;
    transition: all 0.25s ease;
    flex-shrink: 0;
  }

  .tab-text {
    white-space: nowrap;
    line-height: 1.2;
  }

  &:hover:not(.active) {
    color: var(--theme-text-primary);
    background: var(--theme-surface-hover);
    transform: translateY(-1px);
  }

  &.active {
    color: var(--theme-brand-text);
    background: var(--theme-brand-soft);
    font-weight: 600;
    box-shadow: inset 0 0 0 1px var(--theme-brand-border);

    .tab-icon {
      color: var(--theme-brand-accent);
      transform: scale(1.1);
    }

    &::after {
      content: '';
      position: absolute;
      bottom: -7px;
      left: 50%;
      transform: translateX(-50%);
      width: 24px;
      height: 3px;
      background: linear-gradient(90deg, transparent, var(--theme-brand-accent), transparent);
      border-radius: 3px;
    }
  }
}

/* 照片菜单样式 */
.photo-menu {
  background: transparent;
  border: none;
  padding: 8px 0;

  :deep(.el-menu-item) {
    background: transparent;
    color: var(--theme-text-secondary);
    padding: 10px 16px;
    height: auto;
    line-height: 1.4;
    margin: 4px 8px;
    border-radius: var(--theme-radius-sm);
    border-left: 2px solid transparent;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    font-weight: 500;

    &:hover {
      background: var(--theme-surface-hover);
      color: var(--theme-text-primary);
      transform: translateX(2px);
    }

    &.is-active {
      background: var(--theme-brand-soft) !important;
      color: var(--theme-brand-text) !important;
      border-left-color: var(--theme-brand-accent) !important;
      box-shadow: inset 0 0 0 1px var(--theme-brand-border);
      font-weight: 600;
    }

    .el-icon {
      margin-right: 10px;
      font-size: 16px;
      transition: all 0.2s ease;
    }

    &.is-active .el-icon {
      color: var(--theme-brand-accent);
    }

    span {
      font-size: 13px;
      letter-spacing: 0.3px;
    }
  }
}

/* 下载全部相册功能区样式 */
.download-all-section {
  padding: 5px 8px;
  border-bottom: 1px solid var(--theme-border-subtle);

  .download-all-card {
    border-radius: var(--theme-radius-md);
    overflow: hidden;
    border: 1px solid var(--theme-border-subtle);
    background: var(--theme-surface-soft);
    backdrop-filter: blur(10px);
    transition:
      background-color 0.2s ease,
      border-color 0.2s ease;

    &:hover {
      border-color: var(--theme-brand-accent);
      background: var(--theme-surface-hover);
      box-shadow: none;
    }

    .download-all-button {
      position: relative;
      cursor: pointer;
      overflow: hidden;
      width: 100%;
      min-height: 40px;
      padding: 0;
      border: 0;
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: left;
      display: flex;
      align-items: center;
      transition: background-color 0.2s ease;

      &:active {
        transform: scale(0.98);
      }

      .button-content {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 5px 10px;
        width: 100%;
        z-index: 2;
        position: relative;

        .button-icon {
          width: 26px;
          height: 26px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          background: var(--theme-brand-soft-hover);
          border: 1px solid var(--theme-brand-border);
          transition: all 0.3s ease;

          .el-icon {
            font-size: 16px;
            color: var(--theme-brand-accent);
            transition: all 0.3s ease;
          }

          .cancel-icon {
            color: var(--theme-danger);
            animation: pulse 1s ease-in-out infinite;
          }

          .loading-wrapper {
            position: relative;
            width: 20px;
            height: 20px;

            .loading-ring {
              position: absolute;
              top: 0;
              left: 0;
              width: 20px;
              height: 20px;
              border: 2px solid var(--theme-brand-soft-hover);
              border-top: 2px solid var(--theme-brand-accent);
              border-radius: 50%;
              animation: spin 1s linear infinite;
            }

            .download-icon {
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              font-size: 10px;
              color: var(--theme-brand-accent);
            }
          }
        }

        .button-text {
          flex: 1;
          min-width: 0;

          .main-text {
            font-size: 13px;
            font-weight: 600;
            color: var(--theme-brand-text);
            line-height: 1.2;
            margin-bottom: 2px;
            transition: all 0.3s ease;
          }

          .sub-text {
            font-size: 11px;
            color: var(--theme-text-muted);
            line-height: 1.1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
        }
      }

      .progress-overlay {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: var(--theme-surface-active);
        z-index: 1;

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--theme-brand) 0%, var(--theme-brand-accent) 100%);
          transition: width 0.3s ease;
          position: relative;
          overflow: hidden;

          &::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(
              90deg,
              transparent 0%,
              var(--theme-border-strong) 50%,
              transparent 100%
            );
            animation: shimmer 2s ease-in-out infinite;
          }
        }
      }

      &:hover {
        .button-icon {
          background: var(--theme-brand-soft-hover);
          transform: scale(1.05);

          .el-icon {
            color: var(--theme-brand-text);
          }
        }

        .button-text .main-text {
          color: var(--theme-text-inverse);
        }
      }
    }
  }
}

/* 下载管理按钮动画效果 */
@keyframes pulse-ring {
  0% {
    transform: translate(-50%, -50%) scale(0.8);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) scale(1.4);
    opacity: 0;
  }
}

@keyframes pulse-dot {
  0%,
  100% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }
  50% {
    transform: translate(-50%, -50%) scale(1.2);
    opacity: 0.8;
  }
}

/* 视频/照片/说说 sidebar 通用 */
.video-side,
.photo-side,
.feeds-side {
  padding: 12px 10px 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* ===== 动态侧栏：内容优先、低装饰、数字等宽 ===== */

.feeds-side-min {
  padding: 8px 6px 24px !important;
  gap: 8px !important;
  display: flex;
  flex-direction: column;
}

.fd-disclosure {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 32px;
  padding: 0 10px;
  border: 1px solid var(--theme-border-subtle);
  border-radius: 8px;
  color: var(--theme-text-muted);
  background: transparent;
  font: inherit;
  font-size: 11px;
  cursor: pointer;
  transition:
    color var(--theme-duration-fast) var(--theme-ease),
    background-color var(--theme-duration-fast) var(--theme-ease),
    border-color var(--theme-duration-fast) var(--theme-ease);

  &:hover {
    color: var(--theme-text-secondary);
    border-color: var(--theme-border);
    background: var(--theme-surface-soft);
  }

  &:focus-visible {
    outline: 2px solid var(--theme-focus);
    outline-offset: 2px;
  }

  .el-icon {
    transition: transform var(--theme-duration-fast) var(--theme-ease);

    &.is-expanded {
      transform: rotate(180deg);
    }
  }
}

.fd-detail-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.fd-panel {
  position: relative;
  overflow: hidden;
  padding: 10px;
  border: 1px solid var(--theme-border-subtle);
  border-radius: 8px;
  background: var(--theme-surface-soft);
}
.fd-cover {
  padding: 12px;
  border-color: var(--theme-brand-border);
  background: color-mix(in srgb, var(--theme-brand-soft) 45%, var(--theme-surface-soft));
}
.fd-cover-top {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 46px;
  align-items: center;
  gap: 10px;
}
.fd-cover-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 5px;

  strong {
    color: var(--theme-text-primary);
    font-size: 22px;
    font-weight: 680;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  span:last-child {
    overflow: hidden;
    color: var(--theme-text-muted);
    font-size: 11px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
.fd-kicker {
  width: fit-content;
  max-width: 100%;
  overflow: hidden;
  padding: 3px 7px;
  border: 1px solid var(--theme-brand-border);
  border-radius: 999px;
  color: var(--theme-brand-text);
  background: var(--theme-brand-soft);
  font-size: 11px;
  font-weight: 650;
  line-height: 1.1;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fd-orbit {
  display: grid;
  width: 46px;
  height: 46px;
  place-items: center;
  border: 1px solid var(--theme-border);
  border-radius: 10px;
  color: var(--theme-text-primary);
  background: var(--theme-surface-raised);
  font-variant-numeric: tabular-nums;

  strong {
    margin-top: 2px;
    color: var(--theme-text-primary);
    font-size: 15px;
    font-weight: 700;
    line-height: 1;
  }

  span {
    margin-top: -12px;
    color: var(--theme-text-muted);
    font-size: 9px;
    font-weight: 650;
    line-height: 1;
  }
}
.fd-cover-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;

  span {
    min-width: 0;
    padding: 4px 7px;
    border-radius: 999px;
    color: var(--theme-text-secondary);
    background: color-mix(in srgb, var(--theme-text-inverse) 5.5%, transparent);
    font-size: 11px;
    line-height: 1.2;
    font-variant-numeric: tabular-nums;
  }
}
.fd-vibe {
  display: grid;
  grid-template-columns: 1fr;
  gap: 7px;
  padding: 9px 10px;
}
.fd-vibe-row {
  display: grid;
  grid-template-columns: 8px minmax(0, 1fr) auto;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
  color: var(--theme-text-muted);
  font-size: 12px;

  strong {
    color: var(--theme-text-primary);
    font-size: 13px;
    font-weight: 680;
    font-variant-numeric: tabular-nums;
  }
}
.fd-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  align-self: center;
  background: var(--theme-info);
  box-shadow: 0 0 12px color-mix(in srgb, var(--theme-info) 45%, transparent);
}
.fd-dot.is-video {
  background: var(--theme-brand-text);
  box-shadow: 0 0 12px color-mix(in srgb, var(--theme-brand-text) 42%, transparent);
}
.fd-dot.is-view {
  background: var(--theme-warning);
  box-shadow: 0 0 12px color-mix(in srgb, var(--theme-warning) 36%, transparent);
}
.fd-panel-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 9px;

  span {
    color: var(--theme-text-secondary);
    font-size: 12px;
    font-weight: 650;
  }

  em {
    overflow: hidden;
    color: var(--theme-text-subtle);
    font-size: 10px;
    font-style: normal;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
.fd-panel-toggle {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin: -3px -4px -3px 0;
  padding: 3px 4px;
  border: 0;
  border-radius: 4px;
  color: color-mix(in srgb, var(--theme-info-text) 78%, transparent);
  background: transparent;
  font: inherit;
  font-size: 10px;
  line-height: 1.2;
  white-space: nowrap;
  cursor: pointer;
  transition:
    color 0.18s ease,
    background-color 0.18s ease;

  &:hover {
    color: color-mix(in srgb, var(--theme-info-text) 98%, transparent);
    background: color-mix(in srgb, var(--theme-info) 8%, transparent);
  }

  &:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-info) 72%, transparent);
    outline-offset: 2px;
  }

  .el-icon {
    font-size: 11px;
    transition: transform 0.18s ease;

    &.is-expanded {
      transform: rotate(180deg);
    }
  }
}
@media (prefers-reduced-motion: reduce) {
  .fd-panel-toggle,
  .fd-panel-toggle .el-icon {
    transition: none;
  }

  .manager-btn .fetching-icon {
    animation: none !important;
  }
}
.fd-mix-track {
  display: flex;
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-text-inverse) 5.5%, transparent);

  span {
    min-width: 4px;
  }
}
.fd-mix-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 8px;
  margin-top: 8px;

  span {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: var(--theme-text-muted);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }

  i {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }
}
.fd-soft-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 7px;

  div {
    display: flex;
    min-width: 0;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 7px;
    border-radius: 6px;
    background: color-mix(in srgb, var(--theme-text-inverse) 3.5%, transparent);
  }

  span {
    overflow: hidden;
    color: var(--theme-text-subtle);
    font-size: 11px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    color: var(--theme-text-secondary);
    font-size: 13px;
    font-weight: 680;
    font-variant-numeric: tabular-nums;
  }
}
.fd-action-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;

  span {
    display: inline-flex;
    align-items: baseline;
    gap: 4px;
    max-width: 100%;
    padding: 4px 7px;
    border: 1px solid color-mix(in srgb, var(--theme-text-inverse) 6%, transparent);
    border-radius: 999px;
    color: var(--theme-text-muted);
    background: color-mix(in srgb, var(--theme-text-inverse) 4%, transparent);
    font-size: 11px;
    line-height: 1.2;
  }

  strong {
    color: var(--theme-text-secondary);
    font-weight: 680;
    font-variant-numeric: tabular-nums;
  }
}
.fd-people-stack {
  display: flex;
  flex-direction: column;
  gap: 6px;

  &.is-expanded {
    max-height: 248px;
    padding-right: 4px;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-color: color-mix(in srgb, var(--theme-info) 35%, transparent) transparent;
    scrollbar-width: thin;
  }

  &.is-expanded::-webkit-scrollbar {
    width: 4px;
  }

  &.is-expanded::-webkit-scrollbar-thumb {
    border-radius: 999px;
    background: color-mix(in srgb, var(--theme-info) 35%, transparent);
  }
}
.fd-person {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  min-width: 0;
  color: inherit;
  text-decoration: none;
  padding: 0;
  border: 0;
  background: transparent;
  font: inherit;
  text-align: left;
  cursor: pointer;

  img {
    display: block;
    width: 24px;
    height: 24px;
    border: 1px solid color-mix(in srgb, var(--theme-text-inverse) 8%, transparent);
    border-radius: 50%;
    object-fit: cover;
    background: color-mix(in srgb, var(--theme-text-inverse) 6%, transparent);
  }

  span {
    overflow: hidden;
    color: var(--theme-text-secondary);
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;

    :deep(.friend-emoji),
    :deep(img) {
      width: 14px;
      height: 14px;
      margin: 0 1px;
      vertical-align: -0.18em;
    }
  }

  strong {
    padding: 2px 6px;
    border-radius: 999px;
    color: color-mix(in srgb, var(--theme-info-text) 95%, transparent);
    background: color-mix(in srgb, var(--theme-info) 8%, transparent);
    font-size: 11px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  &:hover span {
    color: color-mix(in srgb, var(--theme-info-text) 96%, transparent);
  }
}
.fd-space-card {
  padding-bottom: 8px;
}
.fd-space-line {
  display: flex;
  align-items: baseline;
  gap: 7px;
  margin-bottom: 6px;

  strong {
    color: var(--theme-text-primary);
    font-size: 16px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  span {
    color: var(--theme-text-subtle);
    font-size: 11px;
  }

  em {
    margin-left: auto;
    color: var(--theme-success);
    font-size: 11px;
    font-style: normal;
    font-weight: 650;
  }
}
.fd-visitors {
  padding-bottom: 12px;
}

.fd-visitor-state {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 0;
  color: var(--theme-text-muted);
  font-size: 11px;
  line-height: 1.45;

  &.is-error {
    color: color-mix(in srgb, var(--theme-danger-text) 90%, transparent);
  }

  button {
    min-height: 28px;
    padding: 0 9px;
    border: 1px solid color-mix(in srgb, var(--theme-info) 24%, transparent);
    border-radius: 7px;
    background: color-mix(in srgb, var(--theme-info) 9%, transparent);
    color: color-mix(in srgb, var(--theme-info-text) 92%, transparent);
    cursor: pointer;

    &:focus-visible {
      outline: 2px solid var(--theme-info);
      outline-offset: 2px;
    }
  }
}

.fd-visitor-note {
  margin: 8px 0 0;
  color: var(--theme-text-disabled);
  font-size: 10px;
  line-height: 1.4;
}

.mn-section {
  padding: 14px 12px;
  border-top: 1px solid color-mix(in srgb, var(--theme-text-inverse) 4%, transparent);

  &:first-child {
    border-top: none;
  }
}

.mn-h {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--theme-text-subtle);
  margin: 0 0 10px;
}

/* 区块标题行：左标题 + 右副标题（小数字） */
.mn-h-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin: 0 0 10px;
}
.mn-h-row .mn-h {
  margin: 0;
}
.mn-h-sub {
  font-size: 10px;
  font-weight: 500;
  color: var(--theme-text-subtle);
  font-variant-numeric: tabular-nums;
}

/* ---- KPI 区 ---- */
.mn-kpis {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px 10px;
}
.mn-kpis-3 {
  grid-template-columns: 1fr 1fr 1fr;
}
.mn-kpi {
  position: relative;
  padding-left: 10px;

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 6px;
    bottom: 4px;
    width: 3px;
    border-radius: 2px;
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--theme-info) 55%, transparent),
      color-mix(in srgb, var(--theme-info) 12%, transparent)
    );
  }

  /* 今日 KPI：左色条更亮（锚点：今天） */
  &.mn-kpi-today::before {
    background: linear-gradient(
      180deg,
      var(--theme-info),
      color-mix(in srgb, var(--theme-info) 30%, transparent)
    );
  }
}
.mn-kpi-lab {
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--theme-text-subtle);
  margin-bottom: 3px;
}
.mn-kpi-num {
  font-size: 22px;
  font-weight: 600;
  color: var(--theme-text-primary);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
  line-height: 1;
  display: inline-flex;
  align-items: baseline;
  gap: 3px;
}
/* 被挡上标（紧贴访客数后面，挂在右上） */
.mn-kpi-blk {
  font-size: 9px;
  font-weight: 600;
  color: var(--theme-warning-strong);
  background: color-mix(in srgb, var(--theme-warning-strong) 10%, transparent);
  border-radius: 3px;
  padding: 1px 4px;
  letter-spacing: 0;
  text-transform: none;
}

/* ---- 30 天 sparkline ---- */
.mn-spark {
  display: block;
  width: 100%;
  height: 44px;
  overflow: visible;
}
.mn-spark-area {
  height: 44px;
}
.mn-empty {
  font-size: 11px;
  color: var(--theme-text-disabled);
  padding: 6px 0;
}

/* ---- 模块浏览：堆叠条 + 列表 ---- */
.mn-stack-bar {
  display: flex;
  height: 6px;
  width: 100%;
  border-radius: 999px;
  overflow: hidden;
  background: color-mix(in srgb, var(--theme-text-inverse) 4%, transparent);
  margin-bottom: 10px;
}
.mn-stack-seg {
  height: 100%;
  min-width: 2px;
  transition: filter 0.18s;
  &:hover {
    filter: brightness(1.25);
  }
}
.mn-mod-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.mn-mod-row {
  display: grid;
  grid-template-columns: 8px 1fr auto auto auto;
  align-items: baseline;
  gap: 8px;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.mn-mod-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  align-self: center;
}
.mn-mod-name {
  color: var(--theme-text-secondary);
}
.mn-mod-pct {
  color: var(--theme-text-subtle);
  font-size: 11px;
  min-width: 28px;
  text-align: right;
}
.mn-mod-num {
  color: var(--theme-text-primary);
  font-weight: 600;
  min-width: 36px;
  text-align: right;
}
.mn-mod-today {
  color: var(--theme-success);
  font-size: 10px;
  font-weight: 600;
  padding: 1px 4px;
  background: color-mix(in srgb, var(--theme-success) 10%, transparent);
  border-radius: 3px;
}

/* ---- 本批次概览 ---- */
.fd-hero-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 12px;
  color: var(--theme-text-primary);
  font-size: 24px;
  font-weight: 650;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.fd-hero-sub {
  color: var(--theme-text-subtle);
  font-size: 11px;
  font-weight: 500;
}
.fd-metric-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.fd-metric {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  padding: 8px 0 8px 10px;
  border-left: 3px solid color-mix(in srgb, var(--theme-info) 50%, transparent);
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--theme-info) 7%, transparent),
    transparent
  );
}
.fd-metric-value {
  color: var(--theme-text-primary);
  font-size: 18px;
  font-weight: 650;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.fd-metric-label {
  color: var(--theme-text-subtle);
  font-size: 10px;
  letter-spacing: 0.04em;
}
.fd-bars {
  display: flex;
  flex-direction: column;
  gap: 9px;
}
.fd-bar-row {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.fd-bar-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.fd-bar-name {
  color: var(--theme-text-secondary);
}
.fd-bar-num {
  color: var(--theme-text-muted);
  font-weight: 600;
}
.fd-bar-track {
  position: relative;
  height: 4px;
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-text-inverse) 6%, transparent);
}
.fd-bar-fill {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: inherit;
}
.fd-compact-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 12px;
}
.fd-compact {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  padding-bottom: 6px;
  border-bottom: 1px dashed color-mix(in srgb, var(--theme-text-inverse) 6%, transparent);
}
.fd-compact-label {
  color: var(--theme-text-subtle);
  font-size: 11px;
}
.fd-compact-value {
  color: var(--theme-text-primary);
  font-size: 13px;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
}
.fd-chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.fd-chip {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  padding: 3px 7px;
  border-radius: 999px;
  color: color-mix(in srgb, var(--theme-info-text) 95%, transparent);
  background: color-mix(in srgb, var(--theme-info) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--theme-info) 14%, transparent);
  font-size: 11px;
  font-weight: 550;
  line-height: 1.35;
}
.fd-authors {
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.fd-author {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  min-width: 0;
  color: inherit;
  text-decoration: none;

  img {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    object-fit: cover;
    background: color-mix(in srgb, var(--theme-text-inverse) 6%, transparent);
  }
  &:hover .fd-author-name {
    color: var(--theme-info-text);
  }
}
.fd-author-name {
  min-width: 0;
  overflow: hidden;
  color: var(--theme-text-secondary);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fd-author-count {
  color: var(--theme-text-muted);
  font-size: 11px;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
}
.fd-context-line {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 8px;
  color: var(--theme-text-subtle);
  font-size: 11px;

  strong {
    color: var(--theme-text-primary);
    font-size: 14px;
    font-weight: 650;
    font-variant-numeric: tabular-nums;
  }
  em {
    color: var(--theme-success);
    font-style: normal;
    font-weight: 600;
  }
}
.mn-batch-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
}
.mn-batch-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 6px;
  background: color-mix(in srgb, var(--theme-text-inverse) 2.5%, transparent);
  border: 1px solid color-mix(in srgb, var(--theme-text-inverse) 4%, transparent);
  border-radius: 8px;
  text-align: center;
}
.mn-batch-num {
  font-size: 16px;
  font-weight: 600;
  color: var(--theme-text-primary);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
  line-height: 1;
}
.mn-batch-lab {
  font-size: 10px;
  color: var(--theme-text-subtle);
  letter-spacing: 0.04em;
}

/* ---- 最近访客 6×2 ---- */
.mn-avatars {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px 6px;
}
.mn-avatar {
  position: relative;
  display: block;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  transition: transform 0.18s ease;

  img {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    object-fit: cover;
    background: color-mix(in srgb, var(--theme-text-inverse) 6%, transparent);
    display: block;
    outline: 1.5px solid color-mix(in srgb, var(--theme-canvas) 45%, transparent);
  }
  &:hover {
    transform: scale(1.18);
    z-index: 10;
    img {
      outline-color: var(--theme-info);
    }
  }
  &.is-friend img {
    outline-color: color-mix(in srgb, var(--theme-success) 70%, transparent);
  }
}
.mn-avatar-dot {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--theme-danger);
  border: 2px solid var(--ds-bg-0, var(--theme-canvas));
}

/* 说说额外的小统计行（评论 / 图 / 视频） */
.feeds-extra-row {
  display: flex;
  justify-content: space-around;
  padding: 6px 4px;
  background: color-mix(in srgb, var(--theme-text-inverse) 2%, transparent);
  border-radius: 6px;
  border: 1px solid color-mix(in srgb, var(--theme-text-inverse) 4%, transparent);

  .feeds-extra {
    font-size: 11px;
    color: var(--theme-text-muted);

    em {
      font-style: normal;
      font-weight: 600;
      color: var(--theme-text-primary);
      margin-right: 2px;
    }
  }
}

/* 动态：活跃好友 / 旧版设备列表 通用样式 */
.device-list {
  display: flex;
  flex-direction: column;
  gap: 4px;

  .device-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    font-size: 11px;
    border-radius: 4px;
    background: color-mix(in srgb, var(--theme-text-inverse) 2%, transparent);
    transition: background 0.15s;

    &:hover {
      background: color-mix(in srgb, var(--theme-text-inverse) 5%, transparent);
    }

    .device-name {
      color: var(--theme-text-secondary);
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .device-count {
      color: var(--theme-info);
      font-weight: 600;
      flex-shrink: 0;
    }
  }

  /* 好友行加头像 */
  .friend-row {
    .friend-avatar {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      flex-shrink: 0;
      object-fit: cover;
      background: color-mix(in srgb, var(--theme-text-inverse) 8%, transparent);
    }
  }
}

/* 类型 chip 的次数小数字 */
.chip .chip-num {
  margin-left: 4px;
  color: var(--theme-text-subtle);
  font-size: 10px;
  font-style: normal;
}
.chip.active .chip-num {
  color: var(--theme-text-secondary);
}

/* 三栏小数字 */
.video-stat-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;

  .video-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 8px 4px;
    background: color-mix(in srgb, var(--theme-text-inverse) 3%, transparent);
    border: 1px solid color-mix(in srgb, var(--theme-text-inverse) 5%, transparent);
    border-radius: 8px;
    transition: background 0.15s ease;

    &:hover {
      background: color-mix(in srgb, var(--theme-text-inverse) 5%, transparent);
    }

    .num {
      font-size: 16px;
      font-weight: 700;
      color: var(--theme-text-primary);
      line-height: 1.15;
      font-variant-numeric: tabular-nums;

      &.loaded {
        color: var(--theme-text-primary);
      }

      &.duration {
        color: var(--theme-text-primary);
        font-size: 14px;
      }
    }

    .lab {
      margin-top: 3px;
      font-size: 10px;
      color: var(--theme-text-subtle);
    }
  }
}

/* 磁盘进度条 */
.disk-bar-wrap {
  background: color-mix(in srgb, var(--theme-text-inverse) 3%, transparent);
  border: 1px solid color-mix(in srgb, var(--theme-text-inverse) 5%, transparent);
  border-radius: 8px;
  padding: 8px 10px;

  .disk-bar-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 6px;

    .disk-lab {
      font-size: 11px;
      color: var(--theme-text-muted);
    }

    .disk-val {
      font-size: 11px;
      color: var(--theme-text-subtle);
      font-variant-numeric: tabular-nums;

      strong {
        color: var(--theme-text-primary);
        font-weight: 600;
      }
    }
  }

  .disk-bar {
    height: 4px;
    background: color-mix(in srgb, var(--theme-text-inverse) 6%, transparent);
    border-radius: 2px;
    overflow: hidden;

    .disk-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--theme-info) 0%, var(--theme-brand-accent) 100%);
      border-radius: 2px;
      transition: width 0.3s ease;
    }
  }

  .disk-quota {
    margin-top: 6px;
    font-size: 10px;
    color: var(--theme-text-disabled);
  }
}

/* 筛选块（chip 列表） */
.filter-block {
  .filter-title {
    font-size: 11px;
    color: var(--theme-text-subtle);
    font-weight: 500;
    margin-bottom: 6px;
    letter-spacing: 0.5px;
  }

  .chip-row {
    display: flex;
    gap: 4px;
    flex-wrap: wrap; /* sidebar 太窄时自动换行，避免压字 */

    &.chip-row-wrap {
      flex-wrap: wrap;
    }
  }

  .duration-chip-row {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));

    .chip {
      width: 100%;
    }
  }

  .chip {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 5px 8px;
    appearance: none;
    font-family: inherit;
    line-height: 1.35;
    font-size: 11px;
    font-weight: 500;
    color: var(--theme-text-muted);
    background: color-mix(in srgb, var(--theme-text-inverse) 3%, transparent);
    border: 1px solid color-mix(in srgb, var(--theme-text-inverse) 5%, transparent);
    border-radius: 6px;
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
    transition: all 0.15s ease;

    .el-icon {
      font-size: 12px;
    }

    &:hover {
      color: var(--theme-text-secondary);
      background: color-mix(in srgb, var(--theme-text-inverse) 6%, transparent);
    }

    &.active {
      color: var(--theme-info);
      background: color-mix(in srgb, var(--theme-info) 12%, transparent);
      border-color: color-mix(in srgb, var(--theme-info) 35%, transparent);
    }
  }

  &.chip-row-wrap .chip {
    flex: 0 0 auto;
    min-width: 42px;
  }
}

/* 聚合统计（照片侧） */
.agg-stats {
  background: color-mix(in srgb, var(--theme-text-inverse) 3%, transparent);
  border: 1px solid color-mix(in srgb, var(--theme-text-inverse) 5%, transparent);
  border-radius: 8px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;

  .agg-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    color: var(--theme-text-muted);

    .agg-icon {
      font-size: 12px;
      width: 14px;
      text-align: center;
    }

    .agg-key {
      flex: 1;
      color: var(--theme-text-subtle);
    }

    .agg-val {
      font-weight: 600;
      color: var(--theme-text-primary);
      font-variant-numeric: tabular-nums;
    }
  }
}

/* 好友模块样式 */
.friend-section {
  padding: 8px 6px;
}

.friend-sub-tabs {
  display: flex;
  gap: 4px;
  padding: 4px;
  margin-bottom: 8px;
  background: color-mix(in srgb, var(--theme-text-inverse) 4%, transparent);
  border-radius: 8px;
}

.sub-tab {
  flex: 1;
  padding: 6px 0;
  text-align: center;
  font-size: 12px;
  color: var(--theme-text-muted);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    color: var(--theme-text-secondary);
  }

  &.active {
    background: color-mix(in srgb, var(--theme-info) 15%, transparent);
    color: var(--theme-info);
    font-weight: 500;
  }
}

.friend-search {
  margin-bottom: 8px;

  :deep(.el-input__wrapper) {
    background: color-mix(in srgb, var(--theme-text-inverse) 4%, transparent);
    border: 1px solid color-mix(in srgb, var(--theme-text-inverse) 6%, transparent);
    box-shadow: none;

    &:hover,
    &:focus-within {
      border-color: color-mix(in srgb, var(--theme-info) 30%, transparent);
    }
  }

  :deep(.el-input__inner) {
    color: var(--theme-text-secondary);
    font-size: 12px;

    &::placeholder {
      color: var(--theme-text-disabled);
    }
  }

  :deep(.el-input__prefix .el-icon) {
    color: var(--theme-text-disabled);
  }
}

.friend-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px 0;
  color: var(--theme-text-subtle);
  font-size: 13px;
}

.friend-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.friend-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: color-mix(in srgb, var(--theme-text-inverse) 6%, transparent);
  }

  &.active {
    background: color-mix(in srgb, var(--theme-info) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--theme-info) 20%, transparent);
    margin: -1px;
  }
}

.friend-detail {
  flex: 1;
  min-width: 0;
}

.friend-name {
  font-size: 13px;
  color: var(--theme-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  :deep(.friend-emoji) {
    width: 16px;
    height: 16px;
    vertical-align: text-bottom;
    margin: 0 1px;
  }
}

.friend-score {
  font-size: 11px;
  color: var(--theme-text-disabled);
  margin-top: 2px;
}

.friend-empty {
  text-align: center;
  padding: 24px 0;
  color: var(--theme-text-disabled);
  font-size: 13px;
}

/* 上下文切换过渡动画 */
.context-switch-enter-active,
.context-switch-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}

.context-switch-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}

.context-switch-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

/* 好友卡片样式 */
.friend-card {
  .friend-avatar {
    border-color: color-mix(in srgb, var(--theme-danger) 30%, transparent) !important;
    box-shadow: 0 2px 8px color-mix(in srgb, var(--theme-danger) 20%, transparent) !important;

    &:hover {
      border-color: color-mix(in srgb, var(--theme-danger) 50%, transparent) !important;
      box-shadow: 0 4px 12px color-mix(in srgb, var(--theme-danger) 30%, transparent) !important;
    }
  }

  .nickname {
    :deep(.friend-emoji),
    :deep(img) {
      width: 14px;
      height: 14px;
      vertical-align: text-bottom;
    }
  }

  .value.intimacy {
    display: flex;
    align-items: center;
    gap: 3px;
    color: var(--theme-danger);
    text-shadow: 0 0 3px color-mix(in srgb, var(--theme-danger) 30%, transparent);
  }

  .stat-heart {
    width: 10px;
    height: 10px;
    color: var(--theme-danger);
    flex-shrink: 0;
  }
}

.qa-popover {
  .qa-item {
    display: flex;
    gap: 8px;
    padding: 3px 0;
    align-items: baseline;
    line-height: 1.4;
  }

  .qa-label {
    font-size: 11px;
    color: var(--theme-text-disabled);
    flex-shrink: 0;
  }

  .qa-text {
    font-size: 12px;
    color: var(--theme-text-secondary);
    word-break: break-all;
  }

  .qa-answer {
    color: var(--theme-warning-strong);
    font-weight: 500;
  }

  .qa-muted {
    color: var(--theme-text-disabled);
  }
}
</style>

<style lang="scss">
.capacity-help-popper.el-popper {
  max-width: 220px;
  padding: 8px 10px;

  .capacity-tooltip-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 12px;
    line-height: 1.45;
    white-space: normal;

    strong {
      color: var(--theme-text-primary);
      font-size: 12px;
      font-weight: 600;
    }

    span {
      color: var(--theme-text-secondary);
    }
  }
}

.friend-info-popper.el-popper {
  .online-tooltip {
    font-size: 12px;
    line-height: 1.6;

    .online-tooltip-row {
      color: color-mix(in srgb, var(--theme-canvas) 85%, transparent);
      font-weight: 500;
      &.is-online-text {
        color: var(--theme-success);
      }
    }

    .online-tooltip-sub {
      font-size: 11px;
      color: color-mix(in srgb, var(--theme-canvas) 40%, transparent);
    }
  }
}
</style>
