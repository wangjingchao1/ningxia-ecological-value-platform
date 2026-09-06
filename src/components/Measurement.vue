<template>
  <!-- 右侧多功能面板：彻底贴紧右上角，无边距空隙 -->
  <div v-if="isOpen" class="arcgis-vertical-toolbar" :class="{ 'expanded-panel': currentView === 'citySelect' }">
    
    <!-- ================= 视图 1：空间量测面板 ================= -->
    <template v-if="currentView === 'measure'">
      <div class="toolbar-title">空间量测</div>

      <div class="shape-item-v" @click="currentView = 'citySelect'" title="区域多选">
        <span class="shape-icon city-icon">🏙️</span>
        <span class="item-label">区域多选</span>
      </div>

      <div class="v-divider"></div>

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

    <!-- ================= 视图 2：大面板多选区域选择 ================= -->
    <template v-else-if="currentView === 'citySelect'">
      <div class="toolbar-title-large">选择统计区域</div>

      <!-- 快捷全选/清空栏 + 面积信息展示 -->
      <div class="select-actions-row">
        <span class="measure-info-text">{{ measureResult || '已选区域数: 0 ｜ 总面积: 0.000 km²' }}</span>
        <div class="action-links-group">
          <span class="action-link" @click="selectAllRegions">全选</span>
          <span class="action-divider">|</span>
          <span class="action-link" @click="clearAllSelections">清空</span>
        </div>
      </div>

      <!-- 大列表区域 -->
      <div class="large-list-container">
        <div v-if="loadError" class="loading-tip" style="color: #ff6b6b;">{{ loadError }}</div>
        <div v-else-if="cityGroups.length === 0" class="loading-tip">正在加载区域数据...</div>
        <div v-for="group in cityGroups" :key="group.cityName" class="city-group">
          <!-- 市级勾选项 -->
          <label class="group-header-label">
            <input 
              type="checkbox" 
              :checked="group.checked" 
              @change="toggleCityGroup(group)"
            />
            <span class="group-city-name">🏙️ {{ group.cityName }}</span>
          </label>

          <!-- 县级勾选项列表 -->
          <div class="counties-grid">
            <label v-for="county in group.counties" :key="county.name" class="county-item-label">
              <input 
                type="checkbox" 
                v-model="county.checked" 
                @change="handleCountyChange(group)"
              />
              <span class="county-name" :title="county.name">{{ county.name }}</span>
            </label>
          </div>
        </div>
      </div>

      <!-- 底部操作按钮 -->
      <div class="panel-bottom-btns">
        <div class="shape-item-v action-btn-sm" @click="applyMultiSelection" title="确认应用">
          <span class="item-label" style="color: #60a5fa;">确认选择</span>
        </div>
        <div class="shape-item-v action-btn-sm" @click="currentView = 'measure'" title="返回量测">
          <span class="item-label" style="color: #e2e8f0;">返回</span>
        </div>
      </div>

      <!-- 鹰眼图区域：通过样式推到最底部 -->
      <div class="minimap-bottom-section">
        <div class="minimap-header-row">
          <span class="minimap-section-title">
            {{ displayList.length > 0 && displayList[currentIndex] ? displayList[currentIndex].name : (selectedCountiesList.length > 0 ? '已选区域逐个展示' : '全域县城预览') }}
          </span>
          <span class="minimap-counter" v-if="displayList.length > 0">
            {{ currentIndex + 1 }} / {{ displayList.length }}
          </span>

        </div>

        <div class="minimap-container-wrapper">
          <div ref="miniMapContainer" class="mini-map-box"></div>
        </div>

        <!-- 左右播放控制按键 -->
        <div class="minimap-controls-row">
          <button class="minimap-btn" @click="prevCounty" :disabled="displayList.length === 0">◀ 上一个</button>
          <button class="minimap-btn" @click="nextCounty" :disabled="displayList.length === 0">下一个 ▶</button>
        </div>
      </div>
    </template>

  </div>

  <!-- 原先的顶部悬浮提示保留（如果在其他非选择面板时需要，或者作为兜底） -->
  <div v-if="measureResult && currentView === 'measure'" class="measure-toast">
    {{ measureResult }}
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick, computed } from 'vue'
import mapboxgl from 'mapbox-gl'
import * as turf from '@turf/turf'

const props = defineProps({
  map: { type: Object, required: true },
  draw: { type: Object, required: true },
  isOpen: { type: Boolean, default: false }
})

const emit = defineEmits(['close'])

const currentView = ref('measure') 
const measureResult = ref('')
const cityGroups = ref([]) 
const loadError = ref('')
const miniMapContainer = ref(null)

let geojsonFeatureCollection = null
let drawPoints = []
let tempFeatureId = null
let flashTimer = null 
let miniMap = null
let autoPlayTimer = null

const currentIndex = ref(0)

// 已勾选的县城列表
const selectedCountiesList = computed(() => {
  const list = []
  cityGroups.value.forEach(group => {
    group.counties.forEach(c => {
      if (c.checked) {
        list.push({ cityName: group.cityName, ...c })
      }
    })
  })
  return list
})

// 鹰眼图展示列表：如果没有选中任何项，则展示所有县城用于轮播预览；如果选中了，则只轮播选中的项
const displayList = computed(() => {
  if (selectedCountiesList.value.length > 0) {
    return selectedCountiesList.value
  }
  const allCounties = []
  cityGroups.value.forEach(group => {
    group.counties.forEach(c => {
      allCounties.push({ cityName: group.cityName, ...c })
    })
  })
  return allCounties
})

// 监听选中状态变化，一旦有勾选变动，立刻把索引归零并重置定时器、瞬间跳过去
watch(selectedCountiesList, () => {
  currentIndex.value = 0
  updateMiniMapData(true)
}, { deep: true })

// 初始化鹰眼图
const initMiniMap = () => {
  if (!miniMapContainer.value) return
  if (miniMap) {
    miniMap.remove()
    miniMap = null
  }

  miniMap = new mapboxgl.Map({
    container: miniMapContainer.value,
    style: props.map.getStyle(),
    center: [106.278, 37.476],
    zoom: 5,
    interactive: false,
    attributionControl: false
  })

  miniMap.on('load', () => {
    miniMap.resize()
    updateMiniMapData(true)
    startAutoPlay()
  })
}

// 启动 5 秒自动轮播
const startAutoPlay = () => {
  stopAutoPlay()
  if (displayList.value.length <= 1) return

  autoPlayTimer = setInterval(() => {
    const list = displayList.value
    if (list.length > 1) {
      currentIndex.value = (currentIndex.value + 1) % list.length
      updateMiniMapData(false)
    }
  }, 5000)
}

const stopAutoPlay = () => {
  if (autoPlayTimer) {
    clearInterval(autoPlayTimer)
    autoPlayTimer = null
  }
}

// 更新鹰眼图数据
const updateMiniMapData = (resetTimer = true) => {
  if (!miniMap) return
  if (resetTimer) {
    startAutoPlay()
  }

  const baseSourceId = 'mini-base-source'
  const baseLayerId = 'mini-base-layer'
  const sourceId = 'mini-selected-source'
  const layerId = 'mini-selected-layer'

  miniMap.resize()

  if (geojsonFeatureCollection) {
    if (!miniMap.getSource(baseSourceId)) {
      miniMap.addSource(baseSourceId, { type: 'geojson', data: geojsonFeatureCollection })
      miniMap.addLayer({
        id: baseLayerId,
        type: 'fill',
        source: baseSourceId,
        paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.1, 'fill-outline-color': '#60a5fa' }
      })
    } else {
      miniMap.getSource(baseSourceId).setData(geojsonFeatureCollection)
    }
  }

  const list = displayList.value
  if (list.length > 0) {
    if (currentIndex.value >= list.length) {
      currentIndex.value = 0
    }
    const currentItem = list[currentIndex.value]
    const fc = turf.featureCollection([currentItem.feature])

    if (!miniMap.getSource(sourceId)) {
      miniMap.addSource(sourceId, { type: 'geojson', data: fc })
      miniMap.addLayer({
        id: layerId,
        type: 'fill',
        source: sourceId,
        paint: { 
          'fill-color': selectedCountiesList.value.length > 0 ? '#ef4444' : '#3b82f6', 
          'fill-opacity': 0.7, 
          'fill-outline-color': '#ffffff' 
        }
      })
    } else {
      miniMap.getSource(sourceId).setData(fc)
      miniMap.setPaintProperty(layerId, 'fill-color', selectedCountiesList.value.length > 0 ? '#ef4444' : '#3b82f6')
    }

    const bbox = turf.bbox(currentItem.feature)
    miniMap.fitBounds(bbox, { padding: 5, maxZoom: 10.5, duration: 600 })
  } else {
    if (miniMap.getSource(sourceId)) {
      miniMap.getSource(sourceId).setData(turf.featureCollection([]))
    }
    if (geojsonFeatureCollection) {
      const bbox = turf.bbox(geojsonFeatureCollection)
      miniMap.fitBounds(bbox, { padding: 5, duration: 600 })
    }
  }
}

// 上一个按钮
const prevCounty = () => {
  const list = displayList.value
  const len = list.length
  if (len === 0) return
  currentIndex.value = (currentIndex.value - 1 + len) % len
  updateMiniMapData(true)
}

// 下一个按钮
const nextCounty = () => {
  const list = displayList.value
  const len = list.length
  if (len === 0) return
  currentIndex.value = (currentIndex.value + 1) % len
  updateMiniMapData(true)
}

// 监听视图切换
watch(currentView, (newVal) => {
  if (newVal === 'citySelect') {
    currentIndex.value = 0
    nextTick(() => {
      initMiniMap()
    })
  } else {
    stopAutoPlay()
    if (miniMap) {
      miniMap.remove()
      miniMap = null
    }
  }
})

// 加载指定的 GeoJSON 数据
const loadGeoJsonData = async (fileName = 'nxx.geojson') => {
  loadError.value = ''
  try {
    let response = await fetch(`./${fileName}`)
    if (!response.ok) {
      response = await fetch(`/${fileName}`)
    }
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const data = await response.json()
    geojsonFeatureCollection = data

    const baseSourceId = 'base-boundary-source'
    const baseLayerId = 'base-boundary-layer'
    if (props.map) {
      if (!props.map.getSource(baseSourceId)) {
        props.map.addSource(baseSourceId, {
          type: 'geojson',
          data: data
        })
        props.map.addLayer({
          id: baseLayerId,
          type: 'fill',
          source: baseSourceId,
          paint: {
            'fill-color': '#3b82f6',
            'fill-opacity': 0.15,
            'fill-outline-color': '#60a5fa'
          }
        })
      } else {
        props.map.getSource(baseSourceId).setData(data)
      }
    }

    if (geojsonFeatureCollection && geojsonFeatureCollection.features && geojsonFeatureCollection.features.length > 0) {
      const mapGroups = {}

      geojsonFeatureCollection.features.forEach((f, index) => {
        const props = f.properties || {}
        let cityName = props['name_12'] || props['CITY'] || props['city'] || '其他市'
        let countyName = props['name'] || props['NAME'] || f.id || `区域_${index}`

        if (!mapGroups[cityName]) {
          mapGroups[cityName] = {
            cityName,
            checked: false,
            counties: []
          }
        }
        
        if (!mapGroups[cityName].counties.some(c => c.name === countyName)) {
          mapGroups[cityName].counties.push({
            name: countyName,
            checked: false,
            feature: f
          })
        }
      })

      cityGroups.value = Object.values(mapGroups)
      if (cityGroups.value.length === 0) {
        loadError.value = 'GeoJSON 中未解析到有效区域数据'
      }
    } else {
      loadError.value = 'GeoJSON 文件内容为空或格式错误'
    }
  } catch (err) {
    console.error('加载边界数据失败:', err)
    loadError.value = `加载 ${fileName} 失败，请检查文件路径(public目录下)`
  }
}

const updateSelectionOnMap = () => {
  if (!geojsonFeatureCollection || !props.map) return

  const selectedFeatures = []
  cityGroups.value.forEach(group => {
    group.counties.forEach(c => {
      if (c.checked) {
        selectedFeatures.push(c.feature)
      }
    })
  })

  const sourceId = 'city-flash-source'
  const layerId = 'city-flash-layer'

  if (selectedFeatures.length === 0) {
    measureResult.value = ''
    if (flashTimer) {
      clearInterval(flashTimer)
      flashTimer = null
    }
    if (props.map.getLayer(layerId)) props.map.removeLayer(layerId)
    if (props.map.getSource(sourceId)) props.map.removeSource(sourceId)
    return
  }

  const featureCollection = turf.featureCollection(selectedFeatures)
  const totalArea = selectedFeatures.reduce((sum, f) => sum + turf.area(f), 0)
  measureResult.value = `已选区域数: ${selectedFeatures.length} ｜ 总面积: ${(totalArea / 1e6).toFixed(3)} km²`

  if (!props.map.getSource(sourceId)) {
    props.map.addSource(sourceId, {
      type: 'geojson',
      data: featureCollection
    })
    props.map.addLayer({
      id: layerId,
      type: 'fill',
      source: sourceId,
      paint: {
        'fill-color': '#ef4444',
        'fill-opacity': 0.5
      }
    })
  } else {
    props.map.getSource(sourceId).setData(featureCollection)
  }

  if (flashTimer) clearInterval(flashTimer)
  let visible = true
  flashTimer = setInterval(() => {
    visible = !visible
    if (props.map && props.map.getLayer(layerId)) {
      props.map.setPaintProperty(layerId, 'fill-opacity', visible ? 0.6 : 0.15)
    }
  }, 400)
}

const toggleCityGroup = (group) => {
  group.checked = !group.checked
  group.counties.forEach(c => {
    c.checked = group.checked
  })
  updateSelectionOnMap()
}

const handleCountyChange = (group) => {
  const allChecked = group.counties.every(c => c.checked)
  group.checked = allChecked
  updateSelectionOnMap()
}

const selectAllRegions = () => {
  cityGroups.value.forEach(group => {
    group.checked = true
    group.counties.forEach(c => c.checked = true)
  })
  updateSelectionOnMap()
}

const clearAllSelections = () => {
  cityGroups.value.forEach(group => {
    group.checked = false
    group.counties.forEach(c => c.checked = false)
  })
  clearAllDraw()
}

// 终极安全版 applyMultiSelection
const applyMultiSelection = () => {
  if (!geojsonFeatureCollection) return

  const selectedFeatures = []
  cityGroups.value.forEach(group => {
    group.counties.forEach(c => {
      if (c.checked) {
        selectedFeatures.push(c.feature)
      }
    })
  })

  if (selectedFeatures.length === 0) {
    measureResult.value = '未选择任何区域'
    return
  }

  let targetFeature = selectedFeatures[0]
  if (selectedFeatures.length > 1) {
    try {
      const unioned = turf.union(turf.featureCollection(selectedFeatures))
      if (unioned) targetFeature = unioned
    } catch (e) {
      console.warn('多选合并异常，已使用首个区域:', e)
    }
  }

  props.draw.deleteAll()
  props.draw.add(targetFeature)
  currentView.value = 'measure'
}

// 终极安全版 getCurrentSelectedGeometry（彻底根除 union 报错）
const getCurrentSelectedGeometry = () => {
  const selectedFeatures = []
  cityGroups.value.forEach(group => {
    group.counties.forEach(c => {
      if (c.checked) {
        selectedFeatures.push(c.feature)
      }
    })
  })

  // 1. 如果没有勾选列表区域，尝试获取当前 Mapbox Draw 绘制的图形
  if (selectedFeatures.length === 0) {
    const allDraws = props.draw.getAll()
    return allDraws.features?.[0] || null
  }

  // 2. 如果只勾选了 1 个，直接返回该几何体
  if (selectedFeatures.length === 1) {
    return selectedFeatures[0]
  }

  // 3. 勾选了多个区域时，进行绝对安全的合并处理
  try {
    const unioned = turf.union(turf.featureCollection(selectedFeatures))
    if (unioned) return unioned
  } catch (e) {
    console.warn('多几何体合并失败，已自动降级为使用首个选中区域的几何体:', e)
  }

  // 兜底返回第一个，确保模型计算不会被阻断
  return selectedFeatures[0]
}

const updateMeasureOutput = (e) => {
  const feature = e.features?.[0]
  if (!feature) return
  const type = feature.geometry.type
  if (type === 'Polygon' || type === 'MultiPolygon') {
    const area = turf.area(feature)
    measureResult.value = `总面积: ${(area / 1e6).toFixed(3)} km²`
  }
}

const execDraw = (shape) => {
  clearAllDraw()
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
  const cleanPolygon = turf.polygon([[
    [p1[0], p1[1]],
    [p2[0], p1[1]],
    [p2[0], p2[2] || p2[1]],
    [p2[0], p2[1]],
    [p1[0], p2[1]],
    [p1[0], p1[1]]
  ]])
  props.draw.add(cleanPolygon)
  const area = turf.area(cleanPolygon)
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
  measureResult.value = `半径: ${radius.toFixed(3)} km ｜面积: ${(area / 1e6).toFixed(3)} km²`
  finishCustomDraw(handleCircleClick, handleCircleMove)
}

const handleCircleMove = (e) => {
  if (drawPoints.length !== 1) return
  const center = drawPoints[0]
  const radius = turf.distance(center, [e.lngLat.lng, e.lngLat.lat], { units: 'kilometers' })
  const temp = turf.circle(center, radius, { units: 'kilometers' })
  if (tempFeatureId) props.draw.delete(tempFeatureId)
  tempFeatureId = props.draw.add(temp)[0]
  const area = turf.area(temp)
  measureResult.value = `半径: ${radius.toFixed(3)} km ｜面积: ${(area / 1e6).toFixed(3)} km² `
}

const finishCustomDraw = (clickFn, moveFn) => {
  props.map.off('click', clickFn)
  props.map.off('mousemove', moveFn)
  drawPoints = []
  tempFeatureId = null
}

const clearAllDraw = (clearCheckboxes = true) => {
  props.draw.deleteAll()
  measureResult.value = ''
  if (clearCheckboxes) {
    cityGroups.value.forEach(g => {
      g.checked = false
      g.counties.forEach(c => c.checked = false)
    })
  }
  drawPoints = []
  tempFeatureId = ''

  if (flashTimer) {
    clearInterval(flashTimer)
    flashTimer = null
  }

  if (props.map) {
    if (props.map.getLayer('city-flash-layer')) props.map.removeLayer('city-flash-layer')
    if (props.map.getSource('city-flash-source')) props.map.removeSource('city-flash-source')
  }

  props.map.off('click', handleRectClick)
  props.map.off('mousemove', handleRectMove)
  props.map.off('click', handleCircleClick)
  props.map.off('mousemove', handleCircleMove)

  currentIndex.value = 0
  updateMiniMapData(true)
}

onMounted(() => {
  if (props.isOpen) {
    loadGeoJsonData('nxx.geojson')
  }
})

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    currentView.value = 'measure'
    loadGeoJsonData('nxx.geojson')
    props.map.on('draw.create', updateMeasureOutput)
  } else {
    stopAutoPlay()
    props.map.off('draw.create', updateMeasureOutput)
    clearAllDraw()
    loadGeoJsonData('nx.geojson')
  }
})

onUnmounted(() => {
  stopAutoPlay()
  clearAllDraw()
  props.map.off('draw.create', updateMeasureOutput)
  loadGeoJsonData('nx.geojson')
  if (miniMap) {
    miniMap.remove()
    miniMap = null
  }
})

// 暴露方法给父组件 App.vue 调用
defineExpose({
  getCurrentSelectedGeometry
})
</script>

<style scoped>
/* 彻底贴紧右上角，上下左右边缘不留任何空隙，如同图表控件一样 */
.arcgis-vertical-toolbar {
  position: absolute;
  right: 0;
  top: 0;
  width: 120px;
  height: 100%;
  box-sizing: border-box;
  background: linear-gradient(135deg, rgba(10, 20, 40, 0.95), rgba(15, 35, 65, 0.9));
  border-left: 1px solid rgba(59, 130, 246, 0.5);
  border-bottom: 1px solid rgba(59, 130, 246, 0.5);
  border-radius: 0;
  padding: 8px 6px;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(20px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center; /* 第一个视图（空间量测）整体垂直居中 */
  gap: 6px;
  z-index: 500;
  font-family: 'Inter', sans-serif;
  transition: width 0.3s ease, padding 0.3s ease;
}

.arcgis-vertical-toolbar.expanded-panel {
  width: 320px;
  padding: 4px 6px; /* 整体上下内边距再缩紧一点，往上提 */
  align-items: stretch;
  justify-content: flex-start; /* 展开视图（区域选择）从顶部开始，通过弹性高度紧凑布局 */
  gap: 2px; /* 间距进一步缩减，实现整体往上靠 */
}

.toolbar-title {
  color: #60a5fa;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.8px;
  margin-bottom: 4px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(59, 130, 246, 0.4);
  width: 90%;
  text-align: center;
}

.toolbar-title-large {
  color: #60a5fa;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.8px;
  text-align: center;
  padding-bottom: 2px;
  border-bottom: 1px solid rgba(59, 130, 246, 0.4);
  margin-top: 0px;
}

.select-actions-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: #60a5fa;
  padding: 0 4px;
  margin-top: 2px;
  margin-bottom: 2px;
}

.measure-info-text {
  font-size: 11px;
  color: #60a5fa;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 210px;
}

.action-links-group {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-shrink: 0;
}

.action-link {
  cursor: pointer;
}
.action-link:hover {
  text-decoration: underline;
}
.action-divider {
  color: rgba(59, 130, 246, 0.4);
}

.large-list-container {
  flex: 2; 
  min-height: 240px; 
  max-height: none; 
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-right: 4px;
  margin-top: 2px;
}

.loading-tip {
  color: #94a3b8;
  font-size: 12px;
  text-align: center;
  padding: 10px 0;
}

.city-group {
  background: rgba(59, 130, 246, 0.08);
  border: 1px solid rgba(59, 130, 246, 0.25);
  border-radius: 6px;
  padding: 5px 6px;
}

.group-header-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #60a5fa;
  cursor: pointer;
  margin-bottom: 3px;
}

.counties-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 3px;
  padding-left: 18px;
}

.county-item-label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: #e2e8f0;
  cursor: pointer;
}

.county-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.panel-bottom-btns {
  display: flex;
  gap: 8px;
  margin-top: 2px;
  flex-shrink: 0;
}

/* 核心：缩减上下空隙，将鹰眼图拉高 */
.minimap-bottom-section {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding-bottom: 0px;
  flex-shrink: 0;
}

.minimap-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1px;
  margin-bottom: 1px;
}

.minimap-section-title {
  color: #60a5fa;
  font-size: 11px;
  font-weight: 600;
}

.minimap-counter {
  color: #94a3b8;
  font-size: 10px;
}

.minimap-container-wrapper {
  width: 100%;
  height: 250px; /* 鹰眼图高度进一步增大至 250px */
  border: 1px solid rgba(59, 130, 246, 0.4);
  border-radius: 6px;
  overflow: hidden;
  background: rgba(10, 20, 40, 0.6);
}

.mini-map-box {
  width: 100%;
  height: 100%;
}

.minimap-controls-row {
  display: flex;
  gap: 6px;
  margin-top: 2px;
}

.minimap-btn {
  flex: 1;
  background: rgba(59, 130, 246, 0.15);
  border: 1px solid rgba(59, 130, 246, 0.35);
  color: #60a5fa;
  font-size: 11px;
  padding: 3px 0;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.minimap-btn:hover:not(:disabled) {
  background: rgba(59, 130, 246, 0.3);
}

.minimap-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.shape-item-v {
  width: 104px;
  height: 46px;
  cursor: pointer;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  padding-left: 10px;
  gap: 8px;
  border-radius: 8px;
  transition: all 0.3s ease;
}

.shape-item-v:hover {
  background: rgba(59, 130, 246, 0.25);
  transform: translateY(-1px);
}

.action-btn-sm {
  flex: 1;
  height: 30px; /* 按钮稍微紧凑一点 */
  justify-content: center;
  padding-left: 0;
  background: rgba(59, 130, 246, 0.15);
  border: 1px solid rgba(59, 130, 246, 0.35);
  border-radius: 6px;
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
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
}

.shape-icon.rect {
  width: 20px;
  height: 15px;
  border: 2px solid #60a5fa;
  border-radius: 3px;
  background: rgba(59, 130, 246, 0.15);
}

.shape-icon.poly {
  width: 20px;
  height: 20px;
  border: 2px solid #60a5fa;
  border-radius: 6px;
  background: rgba(59, 130, 246, 0.15);
  clip-path: polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%);
}

.shape-icon.circle {
  width: 20px;
  height: 20px;
  border: 2px solid #60a5fa;
  border-radius: 50%;
  background: rgba(59, 130, 246, 0.15);
}

.clear-icon {
  font-size: 20px;
  color: #ff6b6b;
  margin-left: 2px;
}

.v-divider {
  width: 80px;
  height: 1px;
  background: rgba(59, 130, 246, 0.4);
  margin: 2px 0;
}

.measure-toast {
  position: absolute;
  top: 16px;
  right: 340px;
  background: transparent;
  color: #60a5fa;
  padding: 8px 16px;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8);
  z-index: 2000;
  pointer-events: none;
}
</style>