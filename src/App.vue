<template>
  <div class="map-wrapper">
    <transition name="slide-up">
      <LandingPage
        v-if="showLanding"
        @enter="handleEnterLanding"
      />
    </transition>

    <div class="top-bar">
      <h1>宁夏生态产品价值核算智慧决策平台</h1>
      <div class="system-title top-time">{{ currentTime }}</div>
      <p class="subtitle"></p>
    </div>

    <!-- 加载中遮罩提示 -->
    <div v-if="isLoading" class="loading-mask">
      <div class="loading-box">
        <div class="spinner"></div>
        <span>{{ loadingText }}</span>
      </div>
    </div>

    <!-- 右侧纯空间量测面板 (绑定 ref 用于获取当前空间几何范围) -->
    <MeasureToolbar
      ref="measureToolbarRef"
      v-if="map && draw"
      :map="map"
      :draw="draw"
      :isOpen="activePanel === 'measure'"
      @close="activePanel = null"
    />

    <!-- 左侧竖向菜单：未点工作流时显示常规菜单，点工作流后在原位置替换显示生态模型菜单 -->
    <div class="left-sidebar-menu">
      <!-- 状态 A：常规菜单 -->
      <div class="menu-items-container" v-show="!isCollapsed && !showWorkflowModels">
        <div class="menu-item" @click="togglePanel('basemap')" :class="{ active: activePanel === 'basemap' }">
          <div class="menu-btn">🗺</div>
          <span class="menu-text">底图</span>
        </div>

        <div class="menu-item" @click="togglePanel('data')" :class="{ active: activePanel === 'data' }">
          <div class="menu-btn">📊</div>
          <span class="menu-text">基础数据可视化</span>
        </div>

        <div class="menu-item" @click="resetView">
          <div class="menu-btn">●</div>
          <span class="menu-text">复位</span>
        </div>

        <div class="menu-item" @click="toggle3D" :class="{ active: is3D }">
          <div class="menu-btn">🔹</div>
          <span class="menu-text">成果展示</span>
        </div>

        <!-- 点击“工作流”：既打开右侧量测框，又把左侧菜单原地替换为生态模型按钮 -->
        <div class="menu-item" @click="handleWorkflowClick" :class="{ active: activePanel === 'measure' }">
          <div class="menu-btn">▲</div>
          <span class="menu-text">工作流</span>
        </div>

        <div class="menu-item" @click="togglePanel('navigation')" :class="{ active: activePanel === 'navigation' }">
          <div class="menu-btn">📡</div>
          <span class="menu-text">决策问询</span>
        </div>

        <div class="menu-item" @click="togglePanel('grain')" :class="{ active: activePanel === 'grain' }">
          <div class="menu-btn">♾️</div>
          <span class="menu-text">全区统计</span>
        </div>
      </div>

      <!-- 状态 B：点击“工作流”后在原位置替换显示的生态模型 4 个按钮 + 返回键 -->
      <div class="menu-items-container" v-show="!isCollapsed && showWorkflowModels">
        <div class="menu-item" title="年产水量模型" @click="handleModelCalculate('WaterYield', '年产水量')">
          <div class="menu-btn model-icon">💧</div>
          <span class="menu-text">年产水量</span>
        </div>

        <div class="menu-item" title="土壤保持模型" @click="handleModelCalculate('SoilConservation', '土壤保持')">
          <div class="menu-btn model-icon">🌱</div>
          <span class="menu-text">土壤保持</span>
        </div>

        <div class="menu-item" title="碳储量模型" @click="handleModelCalculate('CarbonStorage', '碳储量')">
          <div class="menu-btn model-icon">🌳</div>
          <span class="menu-text">碳储量</span>
        </div>

        <div class="menu-item" title="生境质量模型" @click="handleModelCalculate('HabitatQuality', '生境质量')">
          <div class="menu-btn model-icon">🧬</div>
          <span class="menu-text">生境质量</span>
        </div>

        <!-- 返回键：点击后切回左侧常规菜单，并关闭右侧量测框 -->
        <div class="menu-item collapse-btn-wrap" @click="handleWorkflowReturn" title="返回常规菜单">
          <div class="menu-btn collapse-icon">↩</div>
          <span class="menu-text danger-text">返回</span>
        </div>
      </div>

      <!-- 最底下的收起/展开键 -->
      <div class="menu-item collapse-btn-wrap" @click="toggleCollapse" :title="isCollapsed ? '点击展开菜单' : '点击收起菜单'">
        <div class="menu-btn collapse-icon">{{ isCollapsed ? '▼' : '▲' }}</div>
        <span class="menu-text">{{ isCollapsed ? '展开' : '收起' }}</span>
      </div>
    </div>

    <!-- 状态栏在中下部分 -->
    <div class="bottom-status">
      <span>LNG: {{ mapStatus.lng }}</span>
      <span>LAT: {{ mapStatus.lat }}</span>
      <span>ZOOM: {{ mapStatus.zoom }}</span>
    </div>

    <!-- 关联 Dashboard 逻辑组件 -->
    <Dashboard
      ref="dashboardRef"
      :activePanel="activePanel"
      :is3D="is3D"
      @update:map="handleMapUpdate"
      @update:draw="draw = $event"
      @update:mapStatus="Object.assign(mapStatus, $event)"
      @update:currentTime="currentTime = $event"
      @update:is3D="is3D = $event"
      @update:activePanel="activePanel = $event"
    />

    <BasemapPanel
      v-if="map"
      :map="map"
      :isOpen="activePanel === 'basemap'"
      @close="activePanel = null"
      @basemap-changed="handleBasemapChange"
    />

    <DataMapLayer
      v-if="map"
      :map="map"
      :isOpen="activePanel === 'data'"
      @close="activePanel = null"
    />

    <NavigationPanel
      v-if="map && activePanel === 'navigation'"
      :map="map"
      :isOpen="true"
      @close="activePanel = null"
    />

    <GrainYield
      v-if="map && activePanel === 'grain'"
      :map="map"
      :isOpen="true"
      @close="activePanel = null"
    />

    <!-- 地图真实挂载容器 -->
    <div ref="mapContainer" id="map"></div>
  </div>
</template>

<script setup>
import { ref, reactive, provide, onMounted, nextTick } from 'vue'

import LandingPage from './components/LandingPage.vue'
import BasemapPanel from './components/BasemapPanel.vue'
import MeasureToolbar from './components/Measurement.vue'
import NavigationPanel from './components/NavigationPanel.vue'
import GrainYield from './components/粮食.vue'
import DataMapLayer from './components/DataMapLayer.vue'
import Dashboard from './Dashboard.vue'

import 'mapbox-gl/dist/mapbox-gl.css'
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css'

const showLanding = ref(true)
const mapContainer = ref(null)
const map = ref(null)
const draw = ref(null)
const activePanel = ref(null)
const is3D = ref(true)
const isCollapsed = ref(false)
const showWorkflowModels = ref(false) 

// 加载状态相关
const isLoading = ref(false)
const loadingText = ref('')

// 绑定右侧 Measurement 组件的 ref
const measureToolbarRef = ref(null)

const mapStatus = reactive({
  lng: '0.00',
  lat: '0.00',
  zoom: '0.0'
})
const currentTime = ref('')
const dashboardRef = ref(null)

// 通过 provide 将地图真实容器传给 Dashboard
provide('mapContainer', mapContainer)

// 加载并确保点位图层置于最上层
const addNxdLayer = async () => {
  if (!map.value) return
  const instance = map.value

  const executeAddLayer = async () => {
    try {
      const response = await fetch('/nxd.geojson')
      const data = await response.json()

      if (instance.getSource('nxd-source')) {
        if (instance.getLayer('nxd-labels')) instance.removeLayer('nxd-labels')
        if (instance.getLayer('nxd-points')) instance.removeLayer('nxd-points')
        instance.removeSource('nxd-source')
      }

      instance.addSource('nxd-source', {
        type: 'geojson',
        data: data
      })

      instance.addLayer({
        id: 'nxd-points',
        type: 'circle',
        source: 'nxd-source',
        paint: {
          'circle-radius': 7,          
          'circle-color': '#ffcc00',   
          'circle-stroke-width': 2,    
          'circle-stroke-color': '#ffffff' 
        }
      })

      instance.addLayer({
        id: 'nxd-labels',
        type: 'symbol',
        source: 'nxd-source',
        layout: {
          'text-field': ['get', 'name_1'],
          'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
          'text-size': 13,
          'text-offset': [0, 1.6],
          'text-anchor': 'top',
          'text-allow-overlap': true
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': '#000000',
          'text-halo-width': 2
        }
      })

      if (instance.getLayer('nxd-points')) instance.moveLayer('nxd-points')
      if (instance.getLayer('nxd-labels')) instance.moveLayer('nxd-labels')

      instance.on('mouseenter', 'nxd-points', () => { instance.getCanvas().style.cursor = 'pointer' })
      instance.on('mouseleave', 'nxd-points', () => { instance.getCanvas().style.cursor = '' })

      instance.triggerRepaint()
    } catch (e) {
      console.error('Failed to load points:', e)
    }
  }

  if (!instance.isStyleLoaded()) {
    instance.once('idle', executeAddLayer)
  } else {
    await executeAddLayer()
  }
}

const handleMapUpdate = (instance) => {
  map.value = instance
  if (instance) {
    instance.dragRotate.disable()
    instance.touchZoomRotate.disableRotation()

    instance.on('load', () => {
      setTimeout(() => {
        addNxdLayer()
        instance.triggerRepaint()
      }, 200)
    })

    instance.on('style.load', () => {
      instance.dragRotate.disable()
      instance.touchZoomRotate.disableRotation()
      setTimeout(() => {
        addNxdLayer()
        instance.triggerRepaint()
      }, 200)
    })
  }
}

const handleEnterLanding = () => {
  showLanding.value = false
  nextTick(() => {
    if (map.value) {
      map.value.resize()
      setTimeout(() => {
        map.value.triggerRepaint()
        addNxdLayer()
      }, 300)
    }
  })
}

onMounted(() => {
  nextTick(() => {
    const checkMapLoaded = setInterval(() => {
      if (map.value) {
        map.value.resize()
        clearInterval(checkMapLoaded)
      }
    }, 300)
  })
})

const togglePanel = (p) => {
  activePanel.value = activePanel.value === p ? null : p
  if (p !== 'measure') {
    showWorkflowModels.value = false
  }
}

const handleWorkflowClick = () => {
  togglePanel('measure')
  showWorkflowModels.value = true 
}

const handleWorkflowReturn = () => {
  showWorkflowModels.value = false 
  activePanel.value = null 
}

// 保留模型计算的监听与几何检查入口（后续您可直接把外部子组件挂载进来或对接逻辑）
const handleModelCalculate = async (modelType, modelName) => {
  if (!measureToolbarRef.value || typeof measureToolbarRef.value.getCurrentSelectedGeometry !== 'function') {
    alert('右侧量测面板尚未完全加载或展开，请先打开工作流与量测面板！')
    return
  }
  
  const currentGeometry = measureToolbarRef.value.getCurrentSelectedGeometry()
  if (!currentGeometry) {
    alert('请先在右侧进行“区域多选”或使用量测工具绘制计算范围！')
    return
  }

  if (isLoading.value) return

  console.log(`触发模型计算监听 [${modelType}] (${modelName})，几何范围就绪。`, currentGeometry)
}

const toggle3D = () => {
  if (dashboardRef.value) {
    dashboardRef.value.toggle3D()
  }
}

const resetView = () => {
  if (dashboardRef.value) {
    dashboardRef.value.resetView()
  }
}

const handleBasemapChange = (type) => {
  if (dashboardRef.value) {
    dashboardRef.value.handleBasemapChange(type)
  }
}

const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value
}
</script>

<style scoped>
.loading-mask {
  position: absolute;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.4);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(4px);
}

.loading-box {
  background: rgba(10, 25, 50, 0.9);
  border: 1px solid rgba(0, 200, 255, 0.6);
  padding: 20px 30px;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: #00ffff;
  font-size: 14px;
  box-shadow: 0 0 20px rgba(0, 150, 255, 0.4);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(0, 255, 255, 0.2);
  border-top-color: #00ffff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.danger-text {
  color: #ff6b6b !important;
}
.slide-up-leave-active {
  transition: transform 0.8s cubic-bezier(0.65, 0, 0.35, 1);
}
.slide-up-leave-to {
  transform: translateY(-100%);
}
.map-wrapper {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  font-family: 'Microsoft YaHei', sans-serif;
  background: #0b132b;
}

#map {
  position: absolute;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 1;
}

.top-bar {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  text-align: center;
  color: white;
  background: linear-gradient(to bottom, rgba(15,23,42,0.9), transparent);
  padding: 20px 0;
  z-index: 1000;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.top-bar h1 {
  font-size: 42px;
  margin: 0;
  text-shadow: 0 0 20px #00bfff;
}
.subtitle {
  font-size: 20px;
  opacity: 0.9;
  margin: 8px 0 0;
  color: #a0d8ff;
}
.system-title.top-time {
  background: transparent;
  color: #006eff;
  font-weight: bold;
  font-size: 16px;
  letter-spacing: 1px;
  text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
  pointer-events: none;
  user-select: none;
  margin: 0;
  white-space: nowrap;
  z-index: 1200;
}

.left-sidebar-menu {
  position: absolute;
  top: 100px;
  left: 25px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 1000;
  pointer-events: auto;
}

.menu-items-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.menu-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  background: transparent;
  border: none;
  padding: 0;
  gap: 3px;
  transition: transform 0.2s ease;
}

.menu-item:hover {
  transform: translateY(-2px);
}

.menu-btn {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(10, 25, 50, 0.7);
  color: #00ffff;
  border: 1px solid rgba(0, 200, 255, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  backdrop-filter: blur(10px);
  box-shadow: inset 0 0 8px rgba(0, 255, 255, 0.3), 0 0 10px rgba(0, 150, 255, 0.2);
  transition: all 0.2s ease;
}

.menu-item:hover .menu-btn {
  background: rgba(0, 60, 120, 0.9);
  border-color: #00ffff;
  box-shadow: 0 0 16px rgba(0, 255, 255, 0.7), inset 0 0 8px rgba(0, 255, 255, 0.5);
}

.menu-item.active .menu-btn {
  background: rgba(0, 150, 255, 0.9);
  border-color: #ffffff;
  color: #ffffff;
  box-shadow: 0 0 20px rgba(0, 255, 255, 0.9), inset 0 0 10px rgba(255, 255, 255, 0.6);
}

.menu-text {
  font-size: 11px;
  color: #b3f0ff;
  font-weight: 500;
  white-space: nowrap;
  text-shadow: 0 0 4px rgba(0, 200, 255, 0.5);
}

.collapse-btn-wrap {
  margin-top: 4px;
}

.collapse-icon {
  background: rgba(20, 40, 80, 0.75) !important;
  border-color: rgba(0, 220, 255, 0.7) !important;
  color: #00ffff !important;
  box-shadow: inset 0 0 8px rgba(0, 255, 255, 0.3), 0 0 12px rgba(0, 180, 255, 0.3) !important;
}

.bottom-status {
  position: absolute;
  bottom: 15px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  color: #00ffff;
  font-size: 12px;
  background: rgba(10, 25, 50, 0.75);
  padding: 4px 12px;
  border-radius: 4px;
  border: 1px solid rgba(0, 200, 255, 0.3);
  display: flex;
  gap: 15px;
  pointer-events: none;
}
</style>