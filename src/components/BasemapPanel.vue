<template>
  <div class="basemap-container">
    <div v-if="isOpen" class="popup-panel basemap-panel">
      <div class="panel-header">
        <span class="panel-title">图层</span>
        <span class="close-btn" @click="emit('close')">✕</span>
      </div>

      <div class="basemap-grid">
        <div
          v-for="style in basemaps"
          :key="style.id"
          class="grid-item"
          :class="{ active: currentBasemap === style.id }"
          @click="selectBasemap(style.id)"
        >
          <div class="preview-wrapper">
            <img :src="getPreviewUrl(style.id)" class="preview-img" />
          </div>
          <span class="item-label">{{ style.name }}</span>
        </div>
      </div>

      <div class="appearance-section">
        <div class="section-title">外观设置</div>
        <div class="theme-buttons">
          <button
            class="theme-btn"
            :class="{ active: !isManualNight }"
            @click="setTheme('light')"
          >
            经典模式
          </button>
          <button
            class="theme-btn"
            :class="{ active: isManualNight }"
            @click="setTheme('dark')"
          >
            深色模式
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import mapboxgl from 'mapbox-gl'

const props = defineProps({
  map: { type: Object, required: true },
  isOpen: { type: Boolean, default: false }
})
const emit = defineEmits(['close', 'basemap-changed'])

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

// 默认初始底图设为卫星地图
const currentBasemap = ref('satellite-v9')
const isManualNight = ref(false)

const basemaps = [
  { id: 'streets-v12', name: '标准地图' },
  { id: 'satellite-v9', name: '卫星地图' },
  { id: 'traffic-day-v2', name: '公共交通' }
]

const getPreviewUrl = (id) =>
  `https://api.mapbox.com/styles/v1/mapbox/${id}/static/113.31,23.09,14/160x120?access_token=${TOKEN}`

const getFinalStyleId = (id) => {
  const isNight = isManualNight.value
  if (id === 'streets-v12') return isNight ? 'dark-v11' : 'streets-v12'
  if (id === 'satellite-v9') return isNight ? 'satellite-streets-v12' : 'satellite-v9'
  if (id === 'traffic-day-v2') return isNight ? 'traffic-night-v2' : 'traffic-day-v2'
  return id
}

const add3DBuildings = (map) => {
  if (!map || !map.getStyle()) return
  if (map.getLayer('3d-buildings')) map.removeLayer('3d-buildings')
  
  if (currentBasemap.value === 'satellite-v9' || currentBasemap.value === 'traffic-day-v2') return

  const layers = map.getStyle().layers
  const labelLayerId = layers.find(
    (l) => l.type === 'symbol' && l.layout?.['text-field']
  )?.id

  map.addLayer(
    {
      id: '3d-buildings',
      source: 'composite',
      'source-layer': 'building',
      filter: ['==', 'extrude', 'true'],
      type: 'fill-extrusion',
      minzoom: 13,
      paint: {
        'fill-extrusion-color': '#bbb',
        'fill-extrusion-opacity': 0.9,
        'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 13, 0, 13.1, ['get', 'height']],
        'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 13, 0, 13.1, ['get', 'min_height']]
      }
    },
    labelLayerId
  )
}

const applyGlobeProjection = (map) => {
  if (!map) return
  map.setProjection({ name: 'globe' })
}

const applyStyle = () => {
  if (!props.map) return

  const styleId = getFinalStyleId(currentBasemap.value)
  const styleUrl = `mapbox://styles/mapbox/${styleId}`

  props.map.once('style.load', () => {
    add3DBuildings(props.map)
    applyGlobeProjection(props.map)
    props.map.fire('style.switched', { basemapType: currentBasemap.value })
    emit('basemap-changed', currentBasemap.value)
  })

  props.map.setStyle(styleUrl)
}

const selectBasemap = (id) => {
  currentBasemap.value = id
  applyStyle()
}

const setTheme = (mode) => {
  isManualNight.value = mode === 'dark'
  applyStyle()
}

onMounted(() => {
  if (!props.map) return
  mapboxgl.accessToken = TOKEN
  
  if (props.map.isStyleLoaded()) {
    applyStyle()
  } else {
    props.map.once('load', () => {
      applyStyle()
    })
  }
})

watch(() => props.isOpen, (val) => {
  if (val && props.map) {
    applyGlobeProjection(props.map)
  }
})
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

.basemap-container {
  pointer-events: none;
  position: absolute;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  padding: 0; /* 贴边，无外边距 */
  z-index: 2000;
}

.popup-panel {
  pointer-events: auto;
  width: 380px;
  background: #0b1326; /* 完全不透明纯色背景，彻底遮挡底图 */
  border: none;
  border-radius: 12px 0 0 0; /* 右下角贴边，圆角设在左上 */
  box-shadow: -4px -4px 20px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  font-family: 'Inter', sans-serif;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: transparent;
  color: #60a5fa;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.panel-title {
  font-size: 18px;
  font-weight: 700;
}

.close-btn {
  font-size: 20px;
  font-weight: 300;
  cursor: pointer;
  color: #94a3b8;
  transition: color 0.3s;
}

.close-btn:hover {
  color: #ffffff;
}

.basemap-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  padding: 20px;
}

.grid-item {
  cursor: pointer;
  text-align: center;
  transition: all 0.2s ease;
  border-radius: 10px;
  padding: 6px;
  border: none;
}

.grid-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.grid-item.active {
  background: rgba(59, 130, 246, 0.15);
}

.preview-wrapper {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 6px;
}

.preview-img {
  width: 100%;
  height: 80px;
  object-fit: cover;
  display: block;
  border: none;
  transition: all 0.3s;
}

.grid-item.active .preview-img {
  border: none;
}

.item-label {
  font-size: 13px;
  font-weight: 600;
  color: #e2e8f0;
}

.appearance-section {
  padding: 16px 20px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.section-title {
  font-size: 14px;
  font-weight: 700;
  color: #60a5fa;
  margin-bottom: 12px;
  text-align: center;
}

.theme-buttons {
  display: flex;
  background: rgba(0, 0, 0, 0.3);
  padding: 4px;
  border-radius: 10px;
  border: none;
}

.theme-btn {
  flex: 1;
  padding: 8px 0;
  background: transparent;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s ease;
}

.theme-btn.active {
  background: #3b82f6;
  color: #ffffff;
}

.theme-btn:not(.active):hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.05);
}
</style>