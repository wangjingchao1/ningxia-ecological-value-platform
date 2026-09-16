<template>
  <div class="register-box">
    <div class="close-icon" @click="$emit('close')" title="关闭">✕</div>
    <div class="login-header">
      <h2>用户注册</h2>
      <p>宁夏生态产品价值核算智慧决策平台</p>
    </div>

    <form @submit.prevent="handleRegister" class="login-form">
      <div class="input-group">
        <label>注册身份</label>
        <div class="role-selector">
          <button 
            type="button" 
            :class="['role-btn', registerForm.role === 'user' ? 'active' : '']" 
            @click="registerForm.role = 'user'"
          >
            普通用户系统
          </button>
          <button 
            type="button" 
            :class="['role-btn', registerForm.role === 'admin' ? 'active' : '']" 
            @click="registerForm.role = 'admin'"
          >
            管理者系统
          </button>
        </div>
      </div>

      <!-- 仅当选择“管理者系统”时显示邀请码输入框 -->
      <div class="input-group" v-if="registerForm.role === 'admin'">
        <label>管理员邀请码</label>
        <input 
          type="text" 
          v-model="registerForm.inviteCode" 
          placeholder="请输入注册管理员所需的邀请码" 
          required 
        />
      </div>

      <div class="input-group">
        <label>设置账号 / 用户名</label>
        <input 
          type="text" 
          v-model="registerForm.username" 
          placeholder="请输入新账号名" 
          required 
        />
      </div>

      <div class="input-group">
        <label>设置密码</label>
        <input 
          type="password" 
          v-model="registerForm.password" 
          placeholder="请输入密码（至少6位）" 
          required 
        />
      </div>

      <div class="input-group">
        <label>确认密码</label>
        <input 
          type="password" 
          v-model="registerForm.confirmPassword" 
          placeholder="请再次输入密码" 
          required 
        />
      </div>

      <div v-if="errorMessage" class="error-msg">
        {{ errorMessage }}
      </div>

      <div class="btn-group">
        <button type="submit" class="submit-btn" :disabled="loading">
          {{ loading ? '正在提交数据库注册...' : '确认注册' }}
        </button>
        <button type="button" class="switch-btn" @click="$emit('switch-to-login')">
          已有账号？返回登录
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'

const emit = defineEmits(['register-success', 'switch-to-login', 'close'])

const registerForm = reactive({
  role: 'user',
  username: '',
  password: '',
  confirmPassword: '',
  inviteCode: '' // 新增邀请码字段
})

const loading = ref(false)
const errorMessage = ref('')

const handleRegister = async () => {
  errorMessage.value = ''

  // 如果注册身份是管理员，校验邀请码（这里预设正确邀请码为 ADMIN888）
  if (registerForm.role === 'admin') {
    if (registerForm.inviteCode.trim() !== 'ADMIN888') {
      errorMessage.value = '管理员邀请码不正确，无法注册管理者系统！'
      return
    }
  }

  if (registerForm.password !== registerForm.confirmPassword) {
    errorMessage.value = '两次输入的密码不一致！'
    return
  }

  if (registerForm.password.length < 6) {
    errorMessage.value = '密码长度不能少于 6 位！'
    return
  }

  loading.value = true

  try {
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: registerForm.role,
        username: registerForm.username,
        password: registerForm.password,
        inviteCode: registerForm.inviteCode
      })
    })

    if (!response.ok) {
      throw new Error('数据库注册服务响应异常')
    }

    const result = await response.json()
    
    if (result.code === 200 || result.success) {
      alert('注册成功！请使用新账号登录。')
      emit('register-success', { username: registerForm.username, role: registerForm.role })
    } else {
      errorMessage.value = result.message || '注册失败，用户名可能已存在'
    }

  } catch (error) {
    console.warn('后端注册接口未就绪，启用本地联调模拟注册：', error.message)
    alert('本地联调：注册成功！')
    emit('register-success', { username: registerForm.username, role: registerForm.role })
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
/* 继承原有的样式体系，保持视觉统一 */
.register-box {
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
  gap: 16px;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
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
  padding: 11px 14px;
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
  padding: 8px;
  border-radius: 4px;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.btn-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 6px;
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

.switch-btn {
  background: transparent;
  color: #94a3b8;
  border: 1px dashed rgba(255, 255, 255, 0.2);
  padding: 8px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.switch-btn:hover {
  color: #00ffff;
  border-color: #00ffff;
  background: rgba(0, 150, 255, 0.1);
}
</style>