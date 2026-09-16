<template>
  <div class="view-controls-group">
    <button class="tool-btn" @click="handleReset" title="切换山东视角">
      <span class="btn-icon">🏠</span>
      <span class="btn-label">复位</span>
    </button>

    <div class="divider"></div>

    <button class="tool-btn" @click="handleToggle3D" :class="{ active: is3D }">
      <span class="btn-icon">{{ is3D ? '🧊' : '📄' }}</span>
      <span class="btn-label">{{ is3D ? '3D' : '2D' }}</span>
    </button>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  map: { type: Object, required: true }
});

const is3D = ref(true);

// 预设视角配置
const VIEWS = {
  // 聚焦山东淄博：中心点设在淄博 [118.05, 36.81]
  // Zoom 6.5 左右在大多数屏幕下能看到整个山东全貌
  SHANDONG_ZIBO: { 
    center: [118.05, 36.81], 
    zoom: 6.5, 
    pitch: 45, 
    bearing: 0 
  },
  // 初始全球/全国视角
  GLOBE: { 
    center: [110, 30], 
    zoom: 1.5, 
    pitch: 0, 
    bearing: 0 
  }
};

// 复位逻辑：在山东视角和全球视角间切换
const handleReset = () => {
  if (!props.map) return;

  // 判断逻辑：如果当前缩放层级小于 4，说明在全球视角，跳转到山东
  if (props.map.getZoom() < 4) {
    props.map.flyTo({ 
      ...VIEWS.SHANDONG_ZIBO, 
      duration: 2500, // 跨度较大，增加飞行时间更平滑
      essential: true 
    });
    is3D.value = true;
  } else {
    // 否则回到初始视角
    props.map.flyTo({ 
      ...VIEWS.GLOBE, 
      duration: 2000,
      essential: true 
    });
    is3D.value = false;
  }
};

// 2D/3D 切换逻辑
const handleToggle3D = () => {
  if (!props.map) return;
  is3D.value = !is3D.value;
  props.map.easeTo({ 
    pitch: is3D.value ? 45 : 0,
    duration: 800 
  });
};
</script>

<style scoped>
.view-controls-group {
  display: flex;
  align-items: center;
}

.tool-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 55px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;
}

.tool-btn:hover {
  background: rgba(0, 0, 0, 0.05);
}

.tool-btn.active {
  color: #1890ff;
  background: rgba(24, 144, 255, 0.1);
}

.btn-icon { font-size: 18px; }
.btn-label { font-size: 10px; margin-top: 2px; }

.divider {
  width: 1px;
  height: 20px;
  background: #ccc;
  margin: 0 10px;
}
</style>