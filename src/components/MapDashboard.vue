<template>
  <div ref="mapContainerRef" class="map-container"></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, provide, nextTick } from 'vue'
import mapboxgl from 'mapbox-gl'
import MapboxDraw from '@mapbox/mapbox-gl-draw'

const emit = defineEmits(['update:map', 'update:draw', 'update:mapStatus'])

const mapContainerRef = ref(null)
const map = ref(null)
const draw = ref(null)

// 向子组件或外部通过 provide 提供容器引用
provide('mapContainer', mapContainerRef)

const VIEWS = {
  NINGXIA: { center: [106.27, 37.50], zoom: 6.5, pitch: 0, bearing: 0 }
}

// 1. 加载边界（使用 nx.geojson）
const addNingxiaBoundaryLayer = () => {
  if (!map.value) return
  const instance = map.value

  if (instance.getSource('nx-boundary-source')) {
    if (instance.getLayer('nx-boundary-line')) instance.removeLayer('nx-boundary-line')
    if (instance.getLayer('nx-boundary-fill')) instance.removeLayer('nx-boundary-fill')
    instance.removeSource('nx-boundary-source')
  }

  try {
    instance.addSource('nx-boundary-source', {
      type: 'geojson',
      data: '/nx.geojson'
    })
    instance.addLayer({
      id: 'nx-boundary-fill',
      type: 'fill',
      source: 'nx-boundary-source',
      paint: { 'fill-color': '#00bfff', 'fill-opacity': 0.08 }
    })
    instance.addLayer({
      id: 'nx-boundary-line',
      type: 'line',
      source: 'nx-boundary-source',
      paint: { 'line-color': '#00ffff', 'line-width': 3, 'line-opacity': 0.95 }
    })
  } catch (e) {
    console.error('Failed to load boundary:', e)
  }
}

// 2. 加载点位及基于 name_1 字段的常驻外部标签注释（使用 fetch 确保读取 nxd.geojson 成功）
const addNxdLayer = async () => {
  if (!map.value) return
  const instance = map.value

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

    // 圆点图层
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

    // 外部常驻文本标签图层（读取 name_1 字段，用 text-offset 往外推，不压盖点位）
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

    instance.on('mouseenter', 'nxd-points', () => { instance.getCanvas().style.cursor = 'pointer' })
    instance.on('mouseleave', 'nxd-points', () => { instance.getCanvas().style.cursor = '' })
  } catch (e) {
    console.error('Failed to load points:', e)
  }
}

// 切换底图供外部统筹调用
const handleBasemapChange = (basemapType) => {
  if (!map.value) return
  map.value.setStyle(`mapbox://styles/mapbox/${basemapType}`)
  // 等待样式重新加载后再注入图层
  map.value.once('style.load', () => {
    addNingxiaBoundaryLayer()
    addNxdLayer()
  })
}

const initMap = () => {
  if (!mapContainerRef.value) return
  const token = import.meta.env.VITE_MAPBOX_TOKEN
  if (token) mapboxgl.accessToken = token

  try {
    const instance = new mapboxgl.Map({
      container: mapContainerRef.value,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      ...VIEWS.NINGXIA,
      antialias: true,
      projection: 'globe'
    })

    instance.addControl(new mapboxgl.NavigationControl(), 'top-right')
    const drawInstance = new MapboxDraw({ displayControlsDefault: false, userProperties: true })
    instance.addControl(drawInstance)

    map.value = instance
    draw.value = drawInstance
    emit('update:map', instance)
    emit('update:draw', drawInstance)

    instance.on('move', () => {
      emit('update:mapStatus', {
        lng: instance.getCenter().lng.toFixed(4),
        lat: instance.getCenter().lat.toFixed(4),
        zoom: instance.getZoom().toFixed(1)
      })
    })

    instance.on('load', () => {
      addNingxiaBoundaryLayer()
      addNxdLayer()
    })

    // 监听全局样式重载，防止样式重建后图层丢失
    instance.on('style.load', () => {
      addNingxiaBoundaryLayer()
      addNxdLayer()
    })
  } catch (e) {
    console.error('Map init failed:', e)
  }
}

onMounted(() => {
  nextTick(() => { initMap() })
})

onUnmounted(() => {
  if (map.value) {
    map.value.remove()
    map.value = null
  }
})

defineExpose({ handleBasemapChange })
</script>

<style scoped>
.map-container {
  width: 100%;
  height: 100%;
}
</style>