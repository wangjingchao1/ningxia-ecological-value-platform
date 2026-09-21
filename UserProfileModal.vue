<template>
  <div class="user-profile-overlay" @click.self="$emit('close')">
    <div class="user-profile-modal">
      <div class="modal-header">
        <span>👤 账户明细信息 (实时数据)</span>
        <button class="close-x" @click="$emit('close')">×</button>
      </div>

      <div class="modal-body">
        <div class="avatar-circle">
          <span>{{ avatarLetter }}</span>
        </div>
        
        <div class="info-list">
          <div class="info-row">
            <span class="label">用户名：</span>
            <span class="value highlight">{{ currentUserInfo.username || '加载中...' }}</span>
          </div>
          <div class="info-row">
            <span class="label">登录账号 (phone)：</span>
            <span class="value">{{ currentUserInfo.phone || '加载中...' }}</span>
          </div>
          <div class="info-row">
            <span class="label">用户类型：</span>
            <span class="value">{{ currentUserInfo.userType || '标准普通用户' }}</span>
          </div>
          <div class="info-row">
            <span class="label">唯一识别码：</span>
            <span class="value code-text"><code>{{ currentUserInfo.unique_id || '-' }}</code></span>
          </div>
          <div class="info-row">
            <span class="label">当前登录状态：</span>
            <span class="value status-badge">
              <span class="dot"></span> 正常在线
            </span>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="logout-btn-inline" @click="$emit('logout')">退出登录</button>
        <button class="confirm-btn" @click="$emit('close')">确定</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const emit = defineEmits(['close', 'logout'])

// 响应式存储从后端数据库拉取的用户明细数据
const currentUserInfo = ref({
  username: '',
  phone: '',
  userType: '标准普通用户 / 决策专员',
  unique_id: ''
})

// 动态计算头像首字母
const avatarLetter = computed(() => {
  if (currentUserInfo.value.username && currentUserInfo.value.username.length > 0) {
    return currentUserInfo.value.username.charAt(0).toUpperCase()
  }
  return 'U'
})

// 组件加载时，从后端获取当前用户的真实账户信息
const fetchUserProfile = async () => {
  try {
    // 假设您后端的当前登录用户信息接口为 /api/user/profile 或根据实际 token/session 获取
    const response = await fetch('http://localhost:3000/api/user/profile')
    if (response.ok) {
      const data = await response.json()
      currentUserInfo.value = {
        username: data.username || '未知用户',
        phone: data.phone || data.account || '未绑定',
        userType: data.userType || '标准普通用户 / 决策专员',
        unique_id: data.unique_id || 'N/A'
      }
    } else {
      console.warn('未能从后端获取到用户明细，使用兜底展示')
      currentUserInfo.value.username = '当前访客 (未登录)'
      currentUserInfo.value.phone = '---'
    }
  } catch (error) {
    console.error('请求账户明细出错:', error)
    currentUserInfo.value.username = '离线/本地模式用户'
    currentUserInfo.value.phone = '13800000000'
  }
}

onMounted(() => {
  fetchUserProfile()
})
</script>

<style scoped>
.user-profile-overlay {
  position: fixed;
  top: 0; left: 0;
  width: 100vw; height: 100vh;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
  backdrop-filter: blur(3px);
}

.user-profile-modal {
  background: rgba(15, 25, 45, 0.95);
  border: 1px solid rgba(0, 200, 255, 0.5);
  width: 340px;
  border-radius: 10px;
  box-shadow: 0 0 25px rgba(0, 150, 255, 0.4);
  overflow: hidden;
  font-family: 'Microsoft YaHei', sans-serif;
  animation: modalPop 0.25s ease-out;
}

@keyframes modalPop {
  from { transform: scale(0.9); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.modal-header {
  background: rgba(20, 35, 60, 0.9);
  padding: 12px 18px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #00ffff;
  font-size: 14px;
  font-weight: bold;
  border-bottom: 1px solid rgba(0, 200, 255, 0.2);
}

.close-x {
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 18px;
  cursor: pointer;
}
.close-x:hover {
  color: #fff;
}

.modal-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
}

.avatar-circle {
  width: 60px; height: 60px;
  border-radius: 50%;
  background: linear-gradient(135deg, #00bfff, #0055ff);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 24px;
  font-weight: bold;
  box-shadow: 0 0 15px rgba(0, 180, 255, 0.6);
  border: 2px solid rgba(255, 255, 255, 0.3);
}

.info-list {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: rgba(10, 18, 32, 0.6);
  padding: 12px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
}

.label {
  color: #94a3b8;
}

.value {
  color: #cbd5e1;
}

.value.highlight {
  color: #00ffff;
  font-weight: bold;
}

.code-text code {
  font-size: 11px;
  color: #38bdf8;
  background: rgba(0, 150, 255, 0.1);
  padding: 2px 4px;
  border-radius: 3px;
}

.status-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #4ade80;
}

.dot {
  width: 8px; height: 8px;
  background-color: #4ade80;
  border-radius: 50%;
  box-shadow: 0 0 6px #4ade80;
}

.modal-footer {
  padding: 12px 20px;
  background: rgba(10, 18, 32, 0.8);
  display: flex;
  justify-content: space-between;
  border-top: 1px solid rgba(0, 200, 255, 0.15);
}

.logout-btn-inline {
  background: rgba(239, 68, 68, 0.2);
  border: 1px solid rgba(239, 68, 68, 0.5);
  color: #f87171;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}
.logout-btn-inline:hover {
  background: rgba(239, 68, 68, 0.4);
  color: #fff;
}

.confirm-btn {
  background: #00bfff;
  border: none;
  color: white;
  padding: 6px 16px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}
.confirm-btn:hover {
  opacity: 0.9;
}
</style>