<template>
  <div class="login-container">
    <!-- 如果管理员登录成功，显示管理员端全屏界面 -->
    <AdminDashboard 
      v-if="isLoggedIn && currentRole === 'admin'" 
      @logout="handleLogout" 
    />

    <!-- 普通用户登录成功后的右上角账户按钮（点击呼出账户明细面板） -->
    <div v-if="isLoggedIn && currentRole === 'user'" class="user-top-bar-trigger">
      <div class="user-avatar-trigger" @click="showUserProfile = true">
        <span class="avatar-icon">👤</span>
        <span class="uname">{{ form.username || '普通用户' }}</span>
        <span class="role-tag">标准用户</span>
      </div>
    </div>

    <!-- 用户端账户明细弹窗 -->
    <UserProfileModal 
      v-if="showUserProfile"
      :userInfo="{ username: form.username || '普通用户', userType: '标准生态决策用户' }"
      @close="showUserProfile = false"
      @logout="handleLogout"
    />

    <!-- 登录表单弹窗框（未登录且不处于注册状态时显示） -->
    <div v-if="!isLoggedIn && !isRegisterMode" class="login-box">
      <div class="close-icon" @click="$emit('close')" title="关闭">✕</div>
      <div class="login-header">
        <h2>系统登录</h2>
        <p>宁夏生态产品价值核算智慧决策平台</p>
      </div>

      <form @submit.prevent="handleLogin" class="login-form">
        <div class="input-group">
          <label>登录身份</label>
          <div class="role-selector">
            <button 
              type="button" 
              :class="['role-btn', form.role === 'user' ? 'active' : '']" 
              @click="form.role = 'user'"
            >
              普通用户系统
            </button>
            <button 
              type="button" 
              :class="['role-btn', form.role === 'admin' ? 'active' : '']" 
              @click="form.role = 'admin'"
            >
              管理者系统
            </button>
          </div>
        </div>

        <div class="input-group">
          <label>账号 / 用户名</label>
          <input 
            type="text" 
            v-model="form.username" 
            placeholder="请输入数据库中的账号" 
            required 
          />
        </div>

        <div class="input-group">
          <label>密码</label>
          <input 
            type="password" 
            v-model="form.password" 
            placeholder="请输入密码" 
            required 
          />
        </div>

        <div v-if="errorMessage" class="error-msg">
          ⚠️ {{ errorMessage }}
        </div>

        <div class="btn-group">
          <button type="submit" class="submit-btn" :disabled="loading">
            {{ loading ? '正在连接数据库验证...' : '安全登录' }}
          </button>
          <button type="button" class="switch-to-register-btn" @click="isRegisterMode = true">
            没有账号？点击注册新用户
          </button>
        </div>
      </form>
    </div>

    <!-- 独立注册组件 -->
    <Register 
      v-if="!isLoggedIn && isRegisterMode"
      @close="$emit('close')"
      @switch-to-login="isRegisterMode = false"
      @register-success="handleRegisterSuccess"
    />
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import AdminDashboard from '../AdminDashboard.vue'
import UserProfileModal from '../UserProfileModal.vue'
import Register from './Register.vue'

const emit = defineEmits(['login-success', 'close'])

const form = reactive({
  role: 'user', 
  username: '',
  password: ''
})

const loading = ref(false)
const errorMessage = ref('')

// 联动控制状态
const isLoggedIn = ref(false)
const currentRole = ref('')
const showUserProfile = ref(false)
const isRegisterMode = ref(false) // 控制是否显示注册组件

// 严格基于后端数据库的登录校验方法
const handleLogin = async () => {
  errorMessage.value = ''
  loading.value = true

  try {
    const response = await fetch('http://localhost:3000/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        role: form.role,
        username: form.username,
        password: form.password
      })
    })

    const result = await response.json()

    // 严格检查后端返回状态：必须数据库匹配成功
    if (response.ok && (result.code === 200 || result.success)) {
      localStorage.setItem('token', result.token || 'auth_token_ok')
      isLoggedIn.value = true
      currentRole.value = form.role
      emit('login-success', form.role)
    } else {
      // 数据库无此账号、密码错误或身份不匹配时，弹出后端带回的错误提示
      errorMessage.value = result.message || '登录失败：数据库中未找到该账号或密码错误！'
    }

  } catch (error) {
    console.error('连接后端数据库失败：', error)
    errorMessage.value = '无法连接到后端数据库服务器，请检查后端服务是否启动！'
  } finally {
    loading.value = false
  }
}

// 注册成功后的回调处理：自动切回登录页并填入刚注册的账号信息
const handleRegisterSuccess = (data) => {
  isRegisterMode.value = false
  form.username = data.username
  form.role = data.role
  form.password = ''
  errorMessage.value = ''
}

// 退出登录处理：清除所有登录状态并回到登录初始面板
const handleLogout = () => {
  localStorage.removeItem('token')
  isLoggedIn.value = false
  currentRole.value = ''
  showUserProfile.value = false
  form.username = ''
  form.password = ''
  isRegisterMode.value = false
  errorMessage.value = ''
}
</script>

<style scoped>
.login-container {
  position: fixed;
  top: 0; left: 0;
  width: 100vw; height: 100vh;
  background: rgba(11, 19, 43, 0.85);
  backdrop-filter: blur(10px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 20000;
}

/* 用户端登录成功后右上角悬浮的账户触发点样式 */
.user-top-bar-trigger {
  position: fixed;
  top: 20px;
  right: 30px;
  z-index: 25000;
}

.user-avatar-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(15, 25, 45, 0.9);
  border: 1px solid rgba(0, 200, 255, 0.4);
  padding: 6px 14px;
  border-radius: 20px;
  cursor: pointer;
  box-shadow: 0 0 15px rgba(0, 150, 255, 0.3);
  transition: all 0.2s;
}
.user-avatar-trigger:hover {
  border-color: #00ffff;
  background: rgba(0, 150, 255, 0.2);
}

.avatar-icon {
  font-size: 14px;
}

.uname {
  color: #fff;
  font-size: 13px;
  font-weight: bold;
}

.role-tag {
  background: #0284c7;
  color: white;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
}

.login-box {
  position: relative;
  width: 420px;
  padding: 40px;
  background: rgba(15, 25, 50, 0.95);
  border: 1px solid rgba(0, 200, 255, 0.4);
  border-radius: 16px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(0, 150, 255, 0.3);
  color: #fff;
}

.close-icon {
  position: absolute;
  top: 15px; right: 20px;
  font-size: 18px;
  color: #94a3b8;
  cursor: pointer;
  transition: color 0.2s;
}
.close-icon:hover {
  color: #fff;
}

.login-header {
  text-align: center;
  margin-bottom: 25px;
}

.login-header h2 {
  font-size: 26px;
  margin: 0 0 8px;
  color: #00ffff;
  letter-spacing: 2px;
}

.login-header p {
  font-size: 13px;
  color: #94a3b8;
  margin: 0;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-group label {
  font-size: 13px;
  color: #cbd5e1;
}

.role-selector {
  display: flex;
  gap: 10px;
}

.role-btn {
  flex: 1;
  padding: 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  color: #94a3b8;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.3s;
}

.role-btn.active {
  background: rgba(0, 150, 255, 0.3);
  border-color: #00ffff;
  color: #fff;
  font-weight: bold;
  box-shadow: 0 0 10px rgba(0, 255, 255, 0.4);
}

.input-group input {
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: #fff;
  font-size: 14px;
  outline: none;
  transition: all 0.3s;
}

.input-group input:focus {
  border-color: #00ffff;
  box-shadow: 0 0 10px rgba(0, 255, 255, 0.3);
}

.error-msg {
  font-size: 12px;
  color: #ef4444;
  text-align: center;
  background: rgba(239, 68, 68, 0.1);
  padding: 10px;
  border-radius: 6px;
  border: 1px solid rgba(239, 68, 68, 0.3);
  line-height: 1.4;
}

.btn-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 10px;
}

.submit-btn {
  background: linear-gradient(135deg, #0072ff, #00c6ff);
  color: #fff;
  border: none;
  padding: 12px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 4px 15px rgba(0, 114, 255, 0.4);
}

.submit-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #005bb5, #00a8e8);
  box-shadow: 0 6px 20px rgba(0, 150, 255, 0.6);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.switch-to-register-btn {
  background: transparent;
  color: #94a3b8;
  border: 1px dashed rgba(255, 255, 255, 0.2);
  padding: 10px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.switch-to-register-btn:hover {
  color: #00ffff;
  border-color: #00ffff;
  background: rgba(0, 150, 255, 0.1);
}
</style>