<script setup>
import { onMounted, onUnmounted, watch } from 'vue'
import * as XLSX from 'xlsx'

const props = defineProps({
  map: { type: Object, required: true },
  isOpen: { type: Boolean, default: false }
})

let planeAnimId = null
let airlineFeatures = []

// --- 性能优化：预分配数据结构，避免每一帧生成新对象 ---
let cachedPlaneCollection = null

const addGlobalAirlines = async () => {
  const { map } = props
  try {
    if (map.getSource('airline-routes')) {
      updateVisibility()
      return
    }

    const response = await fetch('/inner_join_result.xlsx')
    const arrayBuffer = await response.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rawData = XLSX.utils.sheet_to_json(sheet)

    const CAN = [113.2991, 23.3924]
    const nameSet = new Set()
    const features = []
    const destPoints = []

    rawData.forEach(item => {
      if (item.name && !nameSet.has(item.name) && item.latitude_deg && item.longitude_deg) {
        nameSet.add(item.name)
        const dest = [parseFloat(item.longitude_deg), parseFloat(item.latitude_deg)]
        features.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: [CAN, dest] },
          properties: { name: item.name }
        })
        destPoints.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: dest },
          properties: { name: item.name }
        })
      }
    })
    
    airlineFeatures = features

    // --- 性能优化：初始化预分配的飞机点集合（对象池） ---
    cachedPlaneCollection = {
      type: 'FeatureCollection',
      features: airlineFeatures.map(() => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [0, 0] } 
      }))
    }

    map.addSource('airline-routes', { type: 'geojson', data: { type: 'FeatureCollection', features: features } })
    map.addSource('airline-destinations', { type: 'geojson', data: { type: 'FeatureCollection', features: destPoints } })
    map.addSource('airline-origin', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'Point', coordinates: CAN } } })
    map.addSource('plane-points', { type: 'geojson', data: cachedPlaneCollection })

    map.addLayer({
      id: 'airline-lines',
      type: 'line',
      source: 'airline-routes',
      paint: { 'line-color': '#00eaff', 'line-width': 1.5, 'line-opacity': 0.5 }
    })

    map.addLayer({
      id: 'origin-glow',
      type: 'circle',
      source: 'airline-origin',
      paint: { 'circle-radius': 10, 'circle-color': '#00eaff', 'circle-opacity': 0.3, 'circle-blur': 1 }
    })
    
    map.addLayer({
      id: 'origin-inner',
      type: 'circle',
      source: 'airline-origin',
      paint: { 'circle-radius': 5, 'circle-color': '#fff', 'circle-stroke-width': 2, 'circle-stroke-color': '#00eaff' }
    })

    map.addLayer({
      id: 'airline-dots',
      type: 'circle',
      source: 'airline-destinations',
      paint: { 
        'circle-radius': 5, 
        'circle-color': '#ff3300', 
        'circle-stroke-width': 2, 
        'circle-stroke-color': '#ffffff',
        'circle-opacity': 0.9 
      }
    })

    map.addLayer({
      id: 'plane-layer',
      type: 'circle',
      source: 'plane-points',
      paint: {
        'circle-radius': 4,
        'circle-color': '#fbff00',
        'circle-blur': 0.2,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff'
      }
    })

    startPlaneAnimation()
    updateVisibility()
  } catch (err) {
    console.error('航线加载失败:', err)
  }
}

const startPlaneAnimation = () => {
  if (planeAnimId) cancelAnimationFrame(planeAnimId)
  let step = 0
  const totalSteps = 800

  const animate = () => {
    if (!props.map || !props.map.getSource('plane-points')) return
    
    if (props.isOpen) {
      // 保持 60Hz 的平滑度
      const progress = (step % totalSteps) / totalSteps
      
      // --- 核心优化：直接循环修改地址内的坐标值，不生成新对象 ---
      for (let i = 0; i < airlineFeatures.length; i++) {
        const routeCoords = airlineFeatures[i].geometry.coordinates
        const start = routeCoords[0]
        const end = routeCoords[1]
        
        // 直接更新内存中的经纬度数值
        const targetCoords = cachedPlaneCollection.features[i].geometry.coordinates
        targetCoords[0] = start[0] + (end[0] - start[0]) * progress
        targetCoords[1] = start[1] + (end[1] - start[1]) * progress
      }

      // 通知数据源更新（此时 cachedPlaneCollection 的引用没变，但内容已变）
      props.map.getSource('plane-points').setData(cachedPlaneCollection)
      step++
    }
    planeAnimId = requestAnimationFrame(animate)
  }
  animate()
}

const updateVisibility = () => {
  const vis = props.isOpen ? 'visible' : 'none'
  const layers = ['airline-lines', 'airline-dots', 'origin-inner', 'origin-glow', 'plane-layer']
  layers.forEach(id => {
    if (props.map.getLayer(id)) props.map.setLayoutProperty(id, 'visibility', vis)
  })
}

watch(() => props.isOpen, updateVisibility)

onMounted(() => {
  if (props.map.isStyleLoaded()) {
    addGlobalAirlines()
  } else {
    props.map.once('style.load', addGlobalAirlines)
  }
})

onUnmounted(() => {
  if (planeAnimId) cancelAnimationFrame(planeAnimId)
  const layers = ['airline-lines', 'airline-dots', 'origin-inner', 'origin-glow', 'plane-layer']
  layers.forEach(id => {
    if (props.map.getLayer(id)) props.map.setLayoutProperty(id, 'visibility', 'none')
  })
})
</script>

<template>
  <div style="display: none;"></div>
</template>