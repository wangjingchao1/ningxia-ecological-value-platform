<template>
  <div class="overview-panel" :class="{ open: isOpen }">
    <div class="panel-header">
      <h2>航班航线</h2>
      <button class="close-btn" @click="closePanel">×</button>
    </div>

    <div class="panel-content">
      <div id="flight-map" class="flight-map"></div>
      
      <div class="flight-list">
        <h3>当前航班列表（{{ currentPage }} / {{ totalPages || 0 }} 页）</h3>
        <div v-if="flights.length === 0" class="loading">正在解析数据，请稍候...</div>
        <div v-else v-for="(flight, index) in displayedFlights" :key="index" class="flight-item">
          <span class="flight-time">{{ flight.Time }}</span> | 
          <span class="flight-no">{{ flight['Flight No.'] || '未知' }}</span> | 
          <span class="flight-origin">{{ flight.Origin }}</span> | 
          <span class="flight-status">{{ flight.Status }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onUnmounted, onMounted, computed } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.geodesic'
import * as XLSX from 'xlsx'

const props = defineProps({ isOpen: { type: Boolean, default: false } })
const emit = defineEmits(['close'])

const flights = ref([]) 
const map = ref(null)
const currentPage = ref(1)
const pageSize = 10 
let intervalId = null

// 广州白云机场坐标
const can = [23.3924, 113.2991]

const displayedFlights = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return flights.value.slice(start, start + pageSize)
})
const totalPages = computed(() => Math.ceil(flights.value.length / pageSize))

const closePanel = () => emit('close')

const initFlightMap = () => {
  if (map.value) return
  const mapContainer = document.getElementById('flight-map')
  if (!mapContainer) return

  map.value = L.map('flight-map', {
    center: can,
    zoom: 3,
    zoomControl: false,
    attributionControl: false
  })

  L.tileLayer(`https://api.mapbox.com/styles/v1/mapbox/navigation-preview-night-v4/tiles/{z}/{x}/{y}?access_token=${import.meta.env.VITE_MAPBOX_TOKEN}`, {
    tileSize: 512,
    zoomOffset: -1,
  }).addTo(map.value)
}

const clearLayers = () => {
  if (!map.value) return
  map.value.eachLayer(layer => {
    if (layer instanceof L.Geodesic || layer instanceof L.CircleMarker || (layer instanceof L.Marker && !layer._isCenter)) {
      map.value.removeLayer(layer)
    }
  })
  
  const centerMarker = L.circleMarker(can, {
    radius: 7,
    fillColor: '#ff4d4f',
    color: '#fff',
    weight: 2,
    fillOpacity: 1
  }).addTo(map.value)
  centerMarker._isCenter = true
}

const loadFlights = async () => {
  try {
    const response = await fetch('/inner_join_result.xlsx')
    if (!response.ok) throw new Error('文件加载失败，请检查 public 文件夹下是否存在 inner_join_result.xlsx')
    
    const arrayBuffer = await response.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]
    const json = XLSX.utils.sheet_to_json(worksheet)

    flights.value = json.filter(item => {
      const lat = parseFloat(item.latitude_deg)
      const lng = parseFloat(item.longitude_deg)
      return !isNaN(lat) && !isNaN(lng)
    })
    
    if (flights.value.length > 0) {
      drawRoutes()
      startAutoPlay()
    }
  } catch (err) {
    console.error('Data Error:', err)
  }
}

const drawRoutes = () => {
  if (!map.value) return
  clearLayers()

  // 创建一个用于存放当前页所有坐标点的数组，用于计算边界
  const currentPoints = [can] 

  displayedFlights.value.forEach(flight => {
    const dest = [Number(flight.latitude_deg), Number(flight.longitude_deg)]
    currentPoints.push(dest) // 将目的地坐标加入数组

    const geodesic = new L.Geodesic([can, dest], {
      color: '#00eaff',
      weight: 1.5,
      opacity: 0.6,
      steps: 50,
      dashArray: '8, 6',
    }).addTo(map.value)

    let offset = 0
    const animate = () => {
      if (!map.value) return
      offset += 0.5
      geodesic.setStyle({ dashOffset: -offset })
      requestAnimationFrame(animate)
    }
    animate()

    L.circleMarker(dest, {
      radius: 4,
      fillColor: '#00eaff',
      color: '#fff',
      weight: 1,
      fillOpacity: 0.8
    }).addTo(map.value)
  })

  // 核心逻辑：自动调整视野展示所有点
  if (currentPoints.length > 1) {
    const bounds = L.latLngBounds(currentPoints)
    map.value.fitBounds(bounds, {
      padding: [50, 50], // 留出 50px 的边距，防止点贴边
      maxZoom: 5,        // 限制最大缩放层级，防止只有一两个点时缩放过深
      animate: true      // 开启平滑过渡
    })
  }
}

const startAutoPlay = () => {
  if (intervalId) clearInterval(intervalId)
  intervalId = setInterval(() => {
    if (totalPages.value > 0) {
      currentPage.value = currentPage.value >= totalPages.value ? 1 : currentPage.value + 1
      drawRoutes()
    }
  }, 8000)
}

onMounted(() => {
  if (props.isOpen) {
    initFlightMap()
    loadFlights()
  }
})

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    setTimeout(() => {
      initFlightMap()
      loadFlights()
    }, 300)
  } else {
    if (intervalId) clearInterval(intervalId)
  }
})

onUnmounted(() => {
  if (intervalId) clearInterval(intervalId)
  if (map.value) map.value.remove()
})
</script>

<style scoped>
.overview-panel {
  position: absolute;
  top: 0;
  right: 0;
  width: 450px;
  height: 100%;
  background: rgba(10, 25, 47, 0.95);
  backdrop-filter: blur(10px);
  border-left: 2px solid #00eaff;
  z-index: 1000;
  transform: translateX(100%);
  transition: transform 0.4s ease;
  color: #fff;
}
.overview-panel.open { transform: translateX(0); }
.panel-header {
  padding: 20px;
  display: flex;
  justify-content: space-between;
  border-bottom: 1px solid rgba(0, 234, 255, 0.2);
}
.close-btn { background: none; border: none; color: #00eaff; font-size: 24px; cursor: pointer; }
.flight-map { height: 400px; width: 100%; background: #000; }
.flight-list { padding: 15px; height: calc(100% - 480px); overflow-y: auto; }
.flight-item {
  background: rgba(255, 255, 255, 0.05);
  margin-bottom: 8px;
  padding: 10px;
  font-size: 13px;
  border-radius: 4px;
}
.flight-no { color: #ffeb3b; font-weight: bold; }
.flight-status { color: #00ffcc; float: right; }
.loading { text-align: center; padding: 20px; color: #00eaff; }
</style>