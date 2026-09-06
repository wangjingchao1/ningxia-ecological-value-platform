<template>
  <div style="display: none;"></div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, inject, nextTick } from 'vue'
import mapboxgl from 'mapbox-gl'
import MapboxDraw from '@mapbox/mapbox-gl-draw'

const props = defineProps({
  activePanel: String,
  is3D: Boolean
})

const emit = defineEmits([
  'update:map',
  'update:draw',
  'update:mapStatus',
  'update:currentTime',
  'update:is3D',
  'update:activePanel'
])

const mapContainer = inject('mapContainer')
const map = ref(null)
const draw = ref(null)

// 从 localStorage 读取持久化底图类型，如果没有则用默认值
const savedBasemap = localStorage.getItem('dashboard_basemap')
const currentBasemapType = ref(savedBasemap || 'satellite-streets-v12')

// 永久禁用自动旋转
const autoRotateDisabled = ref(true) 

let clockTimer = null
let targetRoadLayers = []
const originalRoadStyles = reactive({})

// 默认宁夏全景，如果 localStorage 有保存的视角，则优先使用
const getInitialView = () => {
  const savedView = localStorage.getItem('dashboard_view')
  if (savedView) {
    try {
      return JSON.parse(savedView)
    } catch (e) {
      console.error('Failed to parse saved view:', e)
    }
  }
  return { center: [106.27, 37.50], zoom: 6.2, pitch: 0, bearing: 0 }
}

const applyGlobeEffect = (instance) => {
  if (!instance) return
  try {
    instance.setProjection('globe')
    instance.setFog({
      color: 'rgb(15, 23, 42)',
      'high-color': 'rgb(36, 92, 223)',
      'space-color': 'rgb(11, 11, 25)',
      'star-intensity': 0.8
    })
  } catch (e) {
    console.error('Globe effect error:', e)
  }
}

const cacheRoadLayers = () => {
  if (!map.value) return
  const style = map.value.getStyle()
  if (!style || !style.layers) return
  targetRoadLayers = style.layers
    .filter(layer => layer.id.includes('road') && layer.type === 'line')
    .map(layer => {
      originalRoadStyles[layer.id] = {
        color: layer.paint?.['line-color'],
        width: layer.paint?.['line-width']
      }
      return layer.id
    })
}

const add3dBuildingLayer = () => {
  const instance = map.value
  if (!instance) return
  if (instance.getLayer('3d-buildings')) {
    instance.removeLayer('3d-buildings')
  }
  try {
    instance.addLayer({
      id: '3d-buildings',
      source: 'composite',
      'source-layer': 'building',
      filter: ['==', 'extrude', 'true'],
      type: 'fill-extrusion',
      minzoom: 15,
      paint: {
        'fill-extrusion-color': '#2a52be',
        'fill-extrusion-opacity': 0.8,
        'fill-extrusion-height': ['get', 'height'],
        'fill-extrusion-base': ['get', 'min_height']
      }
    })
  } catch (e) {
    console.warn('3D buildings layer add skipped:', e)
  }
}

// 加载 nx.geojson 边界
const addNingxiaBoundaryLayer = () => {
  const instance = map.value
  if (!instance) return

  const executeAddBoundary = () => {
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
        paint: {
          'fill-color': '#00bfff',
          'fill-opacity': 0.08
        }
      })

      instance.addLayer({
        id: 'nx-boundary-line',
        type: 'line',
        source: 'nx-boundary-source',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#00ffff',
          'line-width': 3,
          'line-opacity': 0.95
        }
      })
    } catch (e) {
      console.error('Failed to load nx.geojson boundary:', e)
    }
  }

  if (!instance.isStyleLoaded()) {
    instance.once('idle', executeAddBoundary)
  } else {
    executeAddBoundary()
  }
}

const restoreOriginalRoadStyles = () => {
  if (!map.value || !targetRoadLayers.length) return
  targetRoadLayers.forEach(id => {
    const style = originalRoadStyles[id]
    if (style && map.value.getLayer(id)) {
      if (style.color) map.value.setPaintProperty(id, 'line-color', style.color)
      if (style.width) map.value.setPaintProperty(id, 'line-width', style.width)
    }
  })
}

const handleBasemapChange = (basemapType) => {
  currentBasemapType.value = basemapType
  localStorage.setItem('dashboard_basemap', basemapType)
  
  if (map.value) {
    map.value.setStyle(`mapbox://styles/mapbox/${basemapType}`)
  }
  
  setTimeout(() => {
    addNingxiaBoundaryLayer()
  }, 400)

  if (basemapType.includes('streets')) {
    setTimeout(() => {
      cacheRoadLayers()
      add3dBuildingLayer()
    }, 400)
  } else {
    restoreOriginalRoadStyles()
    if (map.value?.getLayer('3d-buildings')) {
      map.value.removeLayer('3d-buildings')
    }
  }
}

const toggle3D = () => {
  const new3DState = !props.is3D
  emit('update:is3D', new3DState)
  localStorage.setItem('dashboard_is3d', JSON.stringify(new3DState))
  map.value?.easeTo({
    pitch: new3DState ? 60 : 0,
    bearing: new3DState ? -10 : 0,
    duration: 1000
  })
}

const resetView = () => {
  if (!map.value) return
  const defaultView = { center: [106.27, 37.50], zoom: 6.2, pitch: 0, bearing: 0 }
  map.value.flyTo({ ...defaultView, duration: 2500, essential: true })
  localStorage.removeItem('dashboard_view')
}

const initMap = () => {
  if (!mapContainer.value) {
    console.error('Map container element not found!')
    return
  }

  const token = import.meta.env.VITE_MAPBOX_TOKEN
  if (!token) {
    console.error('VITE_MAPBOX_TOKEN is missing in your .env file!')
  }
  mapboxgl.accessToken = token

  const initialView = getInitialView()

  const saved3D = localStorage.getItem('dashboard_is3d')
  if (saved3D !== null) {
    try {
      const is3DVal = JSON.parse(saved3D)
      if (is3DVal !== props.is3D) {
        emit('update:is3D', is3DVal)
        initialView.pitch = is3DVal ? 60 : 0
        initialView.bearing = is3DVal ? -10 : 0
      }
    } catch (e) {
      console.error(e)
    }
  }

  try {
    const instance = new mapboxgl.Map({
      container: mapContainer.value,
      style: `mapbox://styles/mapbox/${currentBasemapType.value}`,
      ...initialView,
      antialias: true,
      projection: 'globe'
    })

    instance.addControl(new mapboxgl.NavigationControl({ showCompass: true, showZoom: true, visualizePitch: true }), 'top-right')

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

    instance.on('moveend', () => {
      const center = instance.getCenter()
      const viewData = {
        center: [center.lng, center.lat],
        zoom: instance.getZoom(),
        pitch: instance.getPitch(),
        bearing: instance.getBearing()
      }
      localStorage.setItem('dashboard_view', JSON.stringify(viewData))

      emit('update:mapStatus', {
        lng: center.lng.toFixed(4),
        lat: center.lat.toFixed(4),
        zoom: instance.getZoom().toFixed(1)
      })
    })

    instance.on('load', () => {
      applyGlobeEffect(instance)
      cacheRoadLayers()
      if (currentBasemapType.value.includes('streets')) {
        add3dBuildingLayer()
      }
      addNingxiaBoundaryLayer()

      emit('update:mapStatus', {
        lng: instance.getCenter().lng.toFixed(4),
        lat: instance.getCenter().lat.toFixed(4),
        zoom: instance.getZoom().toFixed(1)
      })

      setTimeout(() => {
        instance.resize()
      }, 100)

      instance.on('style.load', () => {
        applyGlobeEffect(instance)
        cacheRoadLayers()
        addNingxiaBoundaryLayer()
      })
    })
  } catch (e) {
    console.error('Mapbox initialization failed:', e)
  }
}

const updateClock = () => {
  const now = new Date()
  const timeStr = now.toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  })
  emit('update:currentTime', timeStr)
}

onMounted(() => {
  nextTick(() => {
    initMap()
    updateClock()
    clockTimer = setInterval(updateClock, 1000)
  })
})

onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer)
  if (map.value) {
    map.value.remove()
    map.value = null
  }
})

defineExpose({
  toggle3D,
  resetView,
  handleBasemapChange
})
</script>