<template>
  <div class="admin-container">
    <!-- 顶部导航栏 -->
    <header class="admin-header">
      <div class="header-title">
        <span>⚙️ 宁夏生态产品价值核算平台 - 管理员端</span>
      </div>
      
      <!-- 右侧独立功能区：账户明细、退出登录、进入大屏 -->
      <div class="header-right-actions">
        <!-- 账户明细按钮 -->
        <button class="nav-action-btn profile-btn" @click="showProfileModal = true">
          👤 账户明细
        </button>

        <!-- 退出登录按钮 -->
        <button class="nav-action-btn logout-btn" @click="handleLogout">
          🚪 退出登录
        </button>

        <!-- 进入大屏按钮 -->
        <button class="nav-action-btn big-screen-btn" @click="handleOpenBigScreen">
          🖥️ 进入大屏
        </button>
      </div>
    </header>

    <!-- 主体内容区 -->
    <div class="admin-content">
      <!-- 侧边标签导航 -->
      <aside class="admin-sidebar">
        <div 
          class="sidebar-item" 
          :class="{ active: currentTab === 'home' }" 
          @click="currentTab = 'home'"
        >
          📊 首页总览与到访统计
        </div>
        <div 
          class="sidebar-item" 
          :class="{ active: currentTab === 'users' }" 
          @click="currentTab = 'users'"
        >
          👥 用户管理 (users 表)
        </div>
        <div 
          class="sidebar-item" 
          :class="{ active: currentTab === 'data' }" 
          @click="currentTab = 'data'"
        >
          📂 生态数据管理 (只读)
        </div>
        <div 
          class="sidebar-item" 
          :class="{ active: currentTab === 'layer' }" 
          @click="currentTab = 'layer'"
        >
          🗺️ 图层管理 (只读)
        </div>
      </aside>

      <!-- 右侧动态面板 -->
      <main class="admin-main-panel">
        <!-- 1. 首页总览与可视化统计 (只读) -->
        <section v-if="currentTab === 'home'" class="panel-section">
          <h2>平台运行态势与到访统计</h2>
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-num highlight-num">{{ visitStats.totalVisits }}</div>
              <div class="stat-label">平台累计到访人数 (PV)</div>
            </div>
            <div class="stat-card">
              <div class="stat-num">{{ visitStats.onlineUsers }}</div>
              <div class="stat-label">当前实时在线用户</div>
            </div>
            <div class="stat-card">
              <div class="stat-num">{{ ecologicalDataList.length }}</div>
              <div class="stat-label">生态数据表记录数</div>
            </div>
            <div class="stat-card">
              <div class="stat-num status-safe-text">正常运行</div>
              <div class="stat-label">数据库连接状态</div>
            </div>
          </div>

          <!-- 模拟可视化图表区块 -->
          <div class="chart-container-box">
            <h3>📈 近期平台访问趋势与查询统计 (模拟可视化)</h3>
            <div class="fake-chart-bars">
              <div class="bar-item" v-for="(item, index) in visitStats.weeklyTrend" :key="index">
                <div class="bar-fill" :style="{ height: item.count + '%' }">
                  <span class="bar-tooltip">{{ item.count }}人</span>
                </div>
                <div class="bar-label">{{ item.day }}</div>
              </div>
            </div>
          </div>
        </section>

        <!-- 2. 用户管理 (users 表 - 支持直接删除操作) -->
        <section v-if="currentTab === 'users'" class="panel-section">
          <h2>系统用户数据库表 (users)</h2>
          <p class="section-desc">提示：`phone` 即为用户的登录账号。管理员可对注册用户执行删除操作。</p>
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>用户名</th>
                <th>登录账号 (phone)</th>
                <th>密码</th>
                <th>邀请码</th>
                <th>唯一识别码 (unique_id)</th>
                <th>注册时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="user in userList" :key="user.id">
                <td>{{ user.id }}</td>
                <td><strong>{{ user.username }}</strong></td>
                <td><span class="account-phone-text">📞 {{ user.phone }}</span></td>
                <td><span class="mask-password">******</span></td>
                <td>{{ user.invite_code || '无' }}</td>
                <td><code>{{ user.unique_id }}</code></td>
                <td>{{ user.created_at }}</td>
                <td>
                  <button 
                    class="action-btn delete" 
                    @click="handleDeleteUser(user.id)"
                  >
                    删除用户
                  </button>
                </td>
              </tr>
              <tr v-if="userList.length === 0">
                <td colspan="8" class="empty-text">数据库中暂无普通用户数据。</td>
              </tr>
            </tbody>
          </table>
        </section>

        <!-- 3. 生态数据管理 (严格禁止增删改 - 只读) -->
        <section v-if="currentTab === 'data'" class="panel-section">
          <div class="section-header">
            <h2>生态数据概览 (受保护，完全禁止修改与删除)</h2>
          </div>
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>数据名称</th>
                <th>类型</th>
                <th>更新时间</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in ecologicalDataList" :key="item.id">
                <td>{{ item.id }}</td>
                <td>{{ item.name }}</td>
                <td>{{ item.type }}</td>
                <td>{{ item.updateTime }}</td>
                <td><span class="status-safe">已归档保护 (只读)</span></td>
              </tr>
            </tbody>
          </table>
        </section>

        <!-- 4. 图层管理 (严格禁止修改 - 只读) -->
        <section v-if="currentTab === 'layer'" class="panel-section">
          <h2>专题图层显示控制 (只读预览)</h2>
          <div class="layer-list">
            <div v-for="layer in layerList" :key="layer.id" class="layer-item">
              <span class="layer-name">🌐 {{ layer.name }}</span>
              <span class="layer-status-text">系统预设图层</span>
            </div>
          </div>
        </section>
      </main>
    </div>

    <!-- 账户明细独立弹窗 -->
    <div v-if="showProfileModal" class="modal-mask" @click="showProfileModal = false">
      <div class="modal-card" @click.stop>
        <h3>管理员账户明细</h3>
        <div class="profile-info">
          <p><strong>用户名：</strong> {{ adminInfo.username }}</p>
          <p><strong>用户类型/角色：</strong> {{ adminInfo.roleName }}</p>
          <p><strong>当前状态：</strong> <span class="status-online">已登录</span></p>
          <p><strong>权限级别：</strong> 系统最高权限（含用户管理）</p>
        </div>
        <div class="modal-footer">
          <button class="primary-btn" @click="showProfileModal = false">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'

const emit = defineEmits(['logout', 'open-big-screen'])

// 状态控制
const currentTab = ref('home')
const showProfileModal = ref(false)

// 管理员身份信息
const adminInfo = reactive({
  username: 'admin_boss',
  roleName: '系统超级管理员 (Admin)'
})

// 到访人数与图表模拟数据
const visitStats = reactive({
  totalVisits: 12845,
  onlineUsers: 14,
  weeklyTrend: [
    { day: '周一', count: 45 },
    { day: '周二', count: 68 },
    { day: '周三', count: 52 },
    { day: '周四', count: 85 },
    { day: '周五', count: 96 },
    { day: '周六', count: 70 },
    { day: '周日', count: 88 }
  ]
})

// 用户表数据（自带初始模拟数据，点击“删除用户”可直接在前端表格中将其移除）
const userList = ref([
  { id: 1, username: '张三', phone: '13812345678', invite_code: 'NX8881', unique_id: 'UID-95271', created_at: '2026-05-01 10:20' },
  { id: 2, username: '李四', phone: '13987654321', invite_code: 'NX8882', unique_id: 'UID-95272', created_at: '2026-05-03 14:15' },
  { id: 3, username: '王五', phone: '13755556666', invite_code: '', unique_id: 'UID-95273', created_at: '2026-05-10 09:00' }
])

// 生态数据列表（严格只读）
const ecologicalDataList = ref([
  { id: 1, name: '固原市水源涵养空间分布网格', type: 'Raster', updateTime: '2026-05-12' },
  { id: 2, name: '中卫市沙化土地治理监测数据', type: 'Vector', updateTime: '2026-06-01' },
  { id: 3, name: '贺兰山碳储量空间核算结果', type: 'GeoJSON', updateTime: '2026-06-20' }
])

// 模拟图层列表（严格只读）
const layerList = ref([
  { id: 'l1', name: '年产水量专题图层', visible: true },
  { id: 'l2', name: '土壤保持空间分布图', visible: false },
  { id: 'l3', name: '生境质量综合指数图层', visible: true }
])

// 退出登录
const handleLogout = () => {
  emit('logout')
}

// 进入大屏
const handleOpenBigScreen = () => {
  emit('open-big-screen')
}

// 删除用户方法（直接对本地的 userList 进行过滤删除，实现立竿见影的交互效果）
const handleDeleteUser = (id) => {
  if (confirm(`确定要从用户表中删除 ID 为 [${id}] 的用户吗？`)) {
    // 通过 id 过滤掉对应的数据项
    userList.value = userList.value.filter(user => user.id !== id)
    alert('用户删除成功！')
  }
}
</script>

<style scoped>
/* 样式保持原样 */
.admin-container {
  width: 100vw;
  height: 100vh;
  background: #070d1b;
  color: #e2e8f0;
  display: flex;
  flex-direction: column;
  font-family: 'Microsoft YaHei', sans-serif;
  user-select: none;
}

.admin-header {
  height: 60px;
  background: rgba(15, 23, 42, 0.95);
  border-bottom: 1px solid rgba(0, 200, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  position: relative;
  z-index: 100;
}

.header-title span {
  font-size: 18px;
  font-weight: bold;
  color: #00ffff;
  text-shadow: 0 0 10px rgba(0, 255, 255, 0.4);
}

.header-right-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.nav-action-btn {
  padding: 6px 14px;
  border-radius: 20px;
  cursor: pointer;
  font-size: 13px;
  font-weight: bold;
  transition: all 0.2s;
}

.profile-btn {
  background: rgba(0, 150, 255, 0.15);
  color: #38bdf8;
  border: 1px solid rgba(0, 200, 255, 0.4);
}
.profile-btn:hover {
  background: rgba(0, 150, 255, 0.3);
  box-shadow: 0 0 12px rgba(0, 150, 255, 0.4);
}

.logout-btn {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.4);
}
.logout-btn:hover {
  background: rgba(239, 68, 68, 0.3);
  box-shadow: 0 0 12px rgba(239, 68, 68, 0.4);
}

.big-screen-btn {
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
  border: 1px solid rgba(16, 185, 129, 0.5);
  box-shadow: 0 0 10px rgba(16, 185, 129, 0.3);
}
.big-screen-btn:hover {
  opacity: 0.9;
  box-shadow: 0 0 15px rgba(16, 185, 129, 0.6);
}

.admin-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.admin-sidebar {
  width: 240px;
  background: rgba(10, 18, 35, 0.9);
  border-right: 1px solid rgba(0, 200, 255, 0.15);
  display: flex;
  flex-direction: column;
  padding-top: 15px;
  gap: 5px;
}

.sidebar-item {
  padding: 14px 20px;
  font-size: 14px;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s;
  border-left: 3px solid transparent;
}
.sidebar-item:hover {
  background: rgba(0, 150, 255, 0.08);
  color: #fff;
}
.sidebar-item.active {
  background: rgba(0, 150, 255, 0.15);
  color: #00ffff;
  border-left-color: #00ffff;
  font-weight: bold;
}

.admin-main-panel {
  flex: 1;
  padding: 25px;
  overflow-y: auto;
  background: #091122;
}

.panel-section h2 {
  font-size: 20px;
  color: #fff;
  margin-bottom: 10px;
  text-shadow: 0 0 8px rgba(0, 200, 255, 0.3);
}

.section-desc {
  font-size: 13px;
  color: #94a3b8;
  margin-bottom: 15px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 25px;
}

.stat-card {
  background: rgba(15, 25, 45, 0.8);
  border: 1px solid rgba(0, 200, 255, 0.3);
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  box-shadow: inset 0 0 10px rgba(0, 200, 255, 0.1);
}

.stat-num {
  font-size: 28px;
  font-weight: bold;
  color: #00ffff;
  margin-bottom: 8px;
}

.highlight-num {
  color: #38bdf8;
}

.status-safe-text {
  color: #34d399 !important;
  font-size: 24px !important;
}

.stat-label {
  font-size: 13px;
  color: #94a3b8;
}

.chart-container-box {
  background: rgba(15, 25, 45, 0.8);
  border: 1px solid rgba(0, 200, 255, 0.3);
  border-radius: 8px;
  padding: 20px;
}
.chart-container-box h3 {
  font-size: 15px;
  color: #cbd5e1;
  margin-top: 0;
  margin-bottom: 20px;
}
.fake-chart-bars {
  display: flex;
  justify-content: space-around;
  align-items: flex-end;
  height: 180px;
  padding-top: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}
.bar-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  justify-content: flex-end;
  flex: 1;
}
.bar-fill {
  width: 35px;
  background: linear-gradient(to top, #0284c7, #38bdf8);
  border-radius: 4px 4px 0 0;
  position: relative;
  transition: height 0.4s;
}
.bar-fill:hover {
  background: linear-gradient(to top, #0369a1, #7dd3fc);
}
.bar-tooltip {
  position: absolute;
  top: -22px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 11px;
  color: #38bdf8;
  white-space: nowrap;
}
.bar-label {
  margin-top: 8px;
  font-size: 12px;
  color: #94a3b8;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  background: rgba(12, 22, 40, 0.8);
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid rgba(0, 200, 255, 0.2);
}

.data-table th, .data-table td {
  padding: 12px 15px;
  text-align: left;
  font-size: 13px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.data-table th {
  background: rgba(20, 35, 60, 0.9);
  color: #00ffff;
}

.account-phone-text {
  color: #38bdf8;
  font-family: monospace;
  font-weight: bold;
}

.mask-password {
  color: #94a3b8;
  letter-spacing: 2px;
}

.empty-text {
  text-align: center;
  color: #64748b;
  padding: 30px !important;
}

.status-safe {
  color: #34d399;
  font-size: 12px;
  background: rgba(52, 211, 153, 0.1);
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid rgba(52, 211, 153, 0.2);
}

.action-btn.delete {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.4);
  padding: 5px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}
.action-btn.delete:hover {
  background: rgba(239, 68, 68, 0.4);
  box-shadow: 0 0 8px rgba(239, 68, 68, 0.4);
}

.layer-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.layer-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(15, 25, 45, 0.8);
  border: 1px solid rgba(0, 200, 255, 0.2);
  padding: 14px 20px;
  border-radius: 6px;
}
.layer-status-text {
  font-size: 12px;
  color: #64748b;
}

/* 弹窗样式 */
.modal-mask {
  position: fixed;
  top: 0; left: 0; width: 100vw; height: 100vh;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}
.modal-card {
  background: #0f172a;
  border: 1px solid rgba(0, 200, 255, 0.5);
  padding: 25px;
  border-radius: 8px;
  width: 350px;
  box-shadow: 0 0 25px rgba(0, 150, 255, 0.4);
}
.modal-card h3 {
  margin-top: 0;
  color: #00ffff;
  font-size: 16px;
  margin-bottom: 15px;
}
.profile-info {
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 13px;
  color: #cbd5e1;
  margin-bottom: 20px;
}
.status-online {
  color: #4ade80;
  font-weight: bold;
}
.modal-footer {
  text-align: right;
}
.primary-btn {
  background: linear-gradient(135deg, #00bfff, #0066ff);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  box-shadow: 0 0 10px rgba(0, 150, 255, 0.4);
}
.primary-btn:hover {
  opacity: 0.9;
}
</style>