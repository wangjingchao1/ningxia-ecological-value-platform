<!-- components/MeasureToolbar.vue -->
<template>
  <div v-if="isOpen" class="arcgis-vertical-toolbar">
    <div class="toolbar-title">空间量测</div>

    <!-- 默认展示的原工具栏（无线段，用“生态模型”按钮替代原线段位置触发切换） -->
    <template v-if="!showModels">
      <div class="shape-item-v" @click="showModels = true" title="生态模型">
        <span class="shape-icon model-trigger">⚙</span>
        <span class="item-label">生态模型</span>
      </div>

      <div class="shape-item-v" @click="execDraw('polygon')" title="绘制多边形">
        <span class="shape-icon poly"></span>
        <span class="item-label">多边形</span>
      </div>

      <div class="shape-item-v" @click="execDraw('rect')" title="绘制矩形">
        <span class="shape-icon rect"></span>
        <span class="item-label">矩形</span>
      </div>

      <div class="shape-item-v" @click="execDraw('circle')" title="绘制圆形">
        <span class="shape-icon circle"></span>
        <span class="item-label">圆形</span>
      </div>

      <div class="v-divider"></div>

      <div class="shape-item-v danger" @click="clearAllDraw" title="清除所有">
        <span class="clear-icon">✕</span>
        <span class="item-label danger">清除</span>
      </div>
    </template>

    <!-- 点击后隐藏原先按钮，切换显示的五个新按钮 -->
    <template v-else>
      <div class="shape-item-v" title="年产水量模型">
        <span class="shape-icon model-icon">💧</span>
        <span class="item-label">产水量</span>
      </div>

      <div class="shape-item-v" title="土壤保持模型">
        <span class="shape-icon model-icon">🌱</span>
        <span class="item-label">土壤保持</span>
      </div>

      <div class="shape-item-v" title="碳储量模型">
        <span class="shape-icon model-icon">🌳</span>
        <span class="item-label">碳储量</span>
      </div>

      <div class="shape-item-v" title="生境质量模型">
        <span class="shape-icon model-icon">🧬</span>
        <span class="item-label">生境质量</span>
      </div>

      <div class="v-divider"></div>

      <div class="shape-item-v danger" @click="showModels = false" title="返回">
        <span class="clear-icon">↩</span>
        <span class="item-label danger">返回</span>
      </div>
    </template>
  </div>

  <div v-if="measureResult" class="measure-toast">
    {{ measureResult }}
  </div>
</template>

<!-- 脚本部分完全不变 -->
<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as turf from '@turf/turf'

const props = defineProps({
  map: { type: Object, required: true },
  draw: { type: Object, required: true },
  isOpen: { type: Boolean, default: false }
})

const emit = defineEmits(['close'])

const measureResult = ref('')
const showModels = ref(false) // 控制切换模型按钮组的状态
let drawPoints = []
let tempFeatureId = null

const updateMeasureOutput = (e) => {
  const feature = e.features?.[0]
  if (!feature) return

  const type = feature.geometry.type

  if (type === 'LineString') {
    const len = turf.length(feature, { units: 'kilometers' })
    measureResult.value = `总长度: ${len.toFixed(3)} km`
  }

  if (type === 'Polygon') {
    const area = turf.area(feature)
    measureResult.value = `总面积: ${(area / 1e6).toFixed(3)} km²`
  }
}

const execDraw = (shape) => {
  clearAllDraw()

  if (shape === 'line') {
    props.draw.changeMode('draw_line_string')
    measureResult.value = '绘制线段，双击结束'
  }

  if (shape === 'polygon') {
    props.draw.changeMode('draw_polygon')
    measureResult.value = '绘制多边形，双击结束'
  }

  if (shape === 'rect') {
    measureResult.value = '请选择起点 '
    props.map.on('click', handleRectClick)
  }

  if (shape === 'circle') {
    measureResult.value = '请选择圆心'
    props.map.on('click', handleCircleClick)
  }
}

const handleRectClick = (e) => {
  const point = [e.lngLat.lng, e.lngLat.lat]

  if (drawPoints.length === 0) {
    drawPoints.push(point)
    props.map.on('mousemove', handleRectMove)
    return
  }

  const p1 = drawPoints[0]
  const p2 = point

  const polygon = turf.polygon([[
    [p1[0], p1[1]],
    [p2[0], p1[1]],
    [p2[0], p2[1]],
    [p1[0], p2[1]],
    [p1[0], p1[1]]
  ]])

  props.draw.add(polygon)

  const area = turf.area(polygon)
  measureResult.value = `总面积: ${(area / 1e6).toFixed(3)} km²`

  finishCustomDraw(handleRectClick, handleRectMove)
}

const handleRectMove = (e) => {
  if (drawPoints.length !== 1) return

  const p1 = drawPoints[0]
  const p2 = [e.lngLat.lng, e.lngLat.lat]

  const temp = turf.polygon([[
    [p1[0], p1[1]],
    [p2[0], p1[1]],
    [p2[0], p2[1]],
    [p1[0], p2[1]],
    [p1[0], p1[1]]
  ]])

  if (tempFeatureId) props.draw.delete(tempFeatureId)
  tempFeatureId = props.draw.add(temp)[0]

  const area = turf.area(temp)
  measureResult.value = `面积: ${(area / 1e6).toFixed(3)} km² (实时)`
}

const handleCircleClick = (e) => {
  const point = [e.lngLat.lng, e.lngLat.lat]

  if (drawPoints.length === 0) {
    drawPoints.push(point)
    props.map.on('mousemove', handleCircleMove)
    return
  }

  const radius = turf.distance(drawPoints[0], point, { units: 'kilometers' })
  const circle = turf.circle(drawPoints[0], radius, { units: 'kilometers' })

  props.draw.add(circle)

  const area = turf.area(circle)
  measureResult.value =
    `半径: ${radius.toFixed(3)} km ｜面积: ${(area / 1e6).toFixed(3)} km²`

  finishCustomDraw(handleCircleClick, handleCircleMove)
}

const handleCircleMove = (e) => {
  if (drawPoints.length !== 1) return

  const center = drawPoints[0]
  const radius = turf.distance(center, [e.lngLat.lng, e.lngLat.lat], {
    units: 'kilometers'
  })

  const temp = turf.circle(center, radius, { units: 'kilometers' })

  if (tempFeatureId) props.draw.delete(tempFeatureId)
  tempFeatureId = props.draw.add(temp)[0]

  const area = turf.area(temp)
  measureResult.value =
    `半径: ${radius.toFixed(3)} km ｜面积: ${(area / 1e6).toFixed(3)} km² `
}

const finishCustomDraw = (clickFn, moveFn) => {
  props.map.off('click', clickFn)
  props.map.off('mousemove', moveFn)
  drawPoints = []
  tempFeatureId = null
}

const clearAllDraw = () => {
  props.draw.deleteAll()
  measureResult.value = ''
  drawPoints = []
  tempFeatureId = null

  props.map.off('click', handleRectClick)
  props.map.off('mousemove', handleRectMove)
  props.map.off('click', handleCircleClick)
  props.map.off('mousemove', handleCircleMove)
}

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    props.map.on('draw.create', updateMeasureOutput)
  } else {
    props.map.off('draw.create', updateMeasureOutput)
    clearAllDraw()
    showModels.value = false
  }
})

onUnmounted(() => {
  clearAllDraw()
  props.map.off('draw.create', updateMeasureOutput)
})
</script>

<style scoped>
/* 全新蓝色科技风量测工具栏 */
.arcgis-vertical-toolbar {
  position: absolute;
  right: 24px;
  top: 120px;
  width: 92px;                                            /* 更大更宽松 */
  background: linear-gradient(135deg, rgba(10, 20, 40, 0.95), rgba(15, 35, 65, 0.9));
  border: 1px solid rgba(59, 130, 246, 0.5);
  border-radius: 16px;
  padding: 16px 8px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(20px);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  z-index: 500;
  font-family: 'Inter', sans-serif;
}

.toolbar-title {
  color: #60a5fa;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.8px;
  margin-bottom: 8px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(59, 130, 246, 0.4);
  width: 80%;
  text-align: center;
}

.shape-item-v {
  width: 72px;
  height: 64px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: 12px;
  transition: all 0.3s ease;
  position: relative;
}

.shape-item-v:hover {
  background: rgba(59, 130, 246, 0.25);
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(59, 130, 246, 0.3);
}

.shape-item-v:active {
  transform: translateY(0);
}

.item-label {
  font-size: 13px;
  color: #e2e8f0;
  font-weight: 500;
}

.item-label.danger {
  color: #ff6b6b;
}

.shape-icon {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #60a5fa;
  border-radius: 6px;
  background: rgba(59, 130, 246, 0.15);
}

.shape-icon.model-trigger,
.shape-icon.model-icon {
  border: none;
  background: transparent;
  font-size: 20px;
}

.shape-icon.rect {
  width: 26px;
  height: 20px;
  border-radius: 4px;
}

.shape-icon.poly {
  clip-path: polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%);
}

.shape-icon.circle {
  border-radius: 50%;
}

.clear-icon {
  font-size: 28px;
  color: #ff6b6b;
}

.v-divider {
  width: 60px;
  height: 1px;
  background: rgba(59, 130, 246, 0.4);
  margin: 8px 0;
}

/* 量测结果提示条 - 更现代 */
.measure-toast {
  position: absolute;
  top: 90px;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(90deg, rgba(24, 144, 255, 0.95), rgba(59, 130, 246, 0.9));
  color: #ffffff;
  padding: 12px 32px;
  border-radius: 30px;
  font-size: 15px;
  font-weight: 600;
  box-shadow: 0 8px 24px rgba(24, 144, 255, 0.4);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(100, 165, 250, 0.5);
  z-index: 2000;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0); }
}
</style>