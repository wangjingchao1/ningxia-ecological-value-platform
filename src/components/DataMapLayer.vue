<template>
  <!-- 右侧统一控制窗口：包含年份选择、图层选择、计算器与图例 -->
  <div v-if="isOpen" class="right-selector-panel">
    <div class="panel-header">
      <div class="panel-title">图层与数据控制</div>
      <button class="close-btn" @click="$emit('close')">×</button>
    </div>

    <!-- 年份选择 -->
    <div class="control-group">
      <span class="control-label">年份选择：</span>
      <select v-model="selectedYear" @change="loadYearData" class="control-select">
        <option
          v-for="y in ['2015', '2018', '2021', '2023']"
          :key="y"
          :value="y"
        >
          {{ y }}年
        </option>
      </select>
    </div>

    <!-- 图层列表 -->
    <div class="control-group">
      <span class="control-label">栅格图层数据源：</span>
      <div class="layer-list">
        <div 
          v-for="tif in tifFiles" 
          :key="tif.value"
          class="layer-item"
          :class="{ active: selectedTif === tif.value }"
          @click="selectedTif = tif.value; renderRasterTif()"
        >
          <span class="layer-dot"></span>
          {{ tif.label }}
        </div>
      </div>
    </div>

    <!-- 指标计算器 -->
    <div class="control-group">
      <span class="control-label">指标计算器：</span>
      <input
        v-model="formulaText"
        @input="renderBaseMap"
        class="formula-panel-input"
      />
    </div>

    <!-- 图例 -->
    <div class="control-group legend-section">
      <div class="legend-title">
        {{ selectedTifLabel }}
      </div>
      <div class="gradient-bar"></div>
      <div class="legend-labels">
        <span>低 (有效数据)</span>
        <span>高</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onUnmounted, computed } from 'vue'
import * as XLSX from 'xlsx'
import mapboxgl from 'mapbox-gl'
import parseGeoraster from 'georaster'

const props = defineProps({
  map: Object,
  isOpen: Boolean
})

const emit = defineEmits(['close'])

const selectedYear = ref('2023')
const selectedField = ref('')
const dynamicFields = ref([])
const csvDataArray = ref([])
const formulaText = ref('')

// Tif 列表数据源：全部规范为以 public 为根目录的相对路径
const selectedTif = ref('/输入数据/不透水面.tif')
const tifFiles = [
  { label: '不透水面', value: '/输入数据/不透水面.tif' },
  { label: '耕地', value: '/输入数据/耕地.tif' },
  { label: '降水', value: '/输入数据/降水.tif' },
  { label: '林地', value: '/输入数据/林地.tif' },
  { label: '生物量', value: '/输入数据/生物量.tif' },
  { label: '水分', value: '/输入数据/水分.tif' },
  { label: '土地利用', value: '/输入数据/土地利用.tif' },
  { label: '土壤', value: '/输入数据/土壤.tif' },
  { label: '有机碳储量', value: '/输入数据/有机碳储量.tif' },
  { label: '蒸发', value: '/输入数据/蒸发.tif' }
]

const selectedTifLabel = computed(() => {
  const found = tifFiles.find(item => item.value === selectedTif.value)
  return found ? found.label : '栅格数据'
})

const GEO_SOURCE_ID = 'nx-geo-source'
const GEO_LAYER_ID = 'nx-geo-layer'
const RASTER_SOURCE_ID = 'raster-tif-source'
const RASTER_LAYER_ID = 'raster-tif-layer'

let geojsonData = null

// ===============================
// 监听开关：关闭时自动调用 clearLayers 清除所有图层
// ===============================
watch(
  () => props.isOpen,
  async (val) => {
    if (val) {
      await init()
    } else {
      clearLayers()
    }
  }
)

// ===============================
// 初始化
// ===============================
const init = async () => {
  const map = props.map
  if (!map) return

  try {
    clearLayers()

    if (!geojsonData) {
      const res = await fetch('/nx.geojson')
      const text = await res.text()
      if (text.startsWith('<!DOCTYPE')) {
        console.error('未找到 /nx.geojson 文件，请确保其已正确放置在 public 目录下')
        return
      }
      geojsonData = JSON.parse(text)
    }

    await loadYearDataWithoutRender()

    await renderRasterTif()
    renderBaseMap()
  } catch (e) {
    console.error('初始化加载文件出错：', e)
  }
}

// ===============================
// 渲染栅格 Tif
// ===============================
let renderLock = false
const renderRasterTif = async () => {
  const map = props.map
  if (!map) return

  // 如果面板处于关闭状态，直接拦截渲染，防止污染地图
  if (!props.isOpen) return

  if (renderLock) return
  renderLock = true

  try {
    if (map.getLayer(RASTER_LAYER_ID)) {
      map.removeLayer(RASTER_LAYER_ID)
    }
    if (map.getSource(RASTER_SOURCE_ID)) {
      map.removeSource(RASTER_SOURCE_ID)
    }

    const response = await fetch(selectedTif.value)
    const textSample = await response.clone().text()
    if (textSample.startsWith('<!DOCTYPE') || textSample.includes('<html')) {
      console.error(`未找到栅格文件: ${selectedTif.value}，请确保该文件已放入 public 目录中`)
      renderLock = false
      return
    }

    const arrayBuffer = await response.arrayBuffer()
    
    let georaster
    try {
      georaster = await parseGeoraster(arrayBuffer)
    } catch (parseErr) {
      console.error(`当前 Tif 文件格式不支持解析 (${selectedTif.value}):`, parseErr)
      renderLock = false
      return
    }

    const canvas = document.createElement('canvas')
    const width = georaster.width
    const height = georaster.height
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    const imgData = ctx.createImageData(width, height)

    const values = georaster.values[0]

    let min = Infinity
    let max = -Infinity
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const val = values[y][x]
        if (val !== undefined && !isNaN(val) && (georaster.noDataValue === null || val !== georaster.noDataValue)) {
          if (val < min) min = val
          if (val > max) max = val
        }
      }
    }
    if (min === Infinity || max === -Infinity) {
      min = 0
      max = 1
    }
    if (min === max) {
      max = min + 1
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const val = values[y][x]
        const idx = (y * width + x) * 4

        if (val === undefined || isNaN(val) || (georaster.noDataValue !== null && val === georaster.noDataValue)) {
          imgData.data[idx + 3] = 0
          continue
        }

        const ratio = Math.max(0, Math.min(1, (val - min) / (max - min)))
        
        let r = 0, g = 0, b = 0
        if (ratio < 0.25) {
          r = 0; g = 234; b = 255
        } else if (ratio < 0.5) {
          r = 0; g = 255; b = 149
        } else if (ratio < 0.75) {
          r = 255; g = 240; b = 0
        } else {
          r = 255; g = 91; b = 0
        }

        imgData.data[idx] = r
        imgData.data[idx + 1] = g
        imgData.data[idx + 2] = b
        imgData.data[idx + 3] = 200
      }
    }

    ctx.putImageData(imgData, 0, 0)
    const dataURL = canvas.toDataURL()

    let xmin = georaster.xmin
    let xmax = georaster.xmax
    let ymin = georaster.ymin
    let ymax = georaster.ymax

    if (Math.abs(xmin) > 180 || Math.abs(xmax) > 180 || Math.abs(ymin) > 90 || Math.abs(ymax) > 90) {
      xmin = Infinity
      xmax = -Infinity
      ymin = Infinity
      ymax = -Infinity
      if (geojsonData && geojsonData.features) {
        const getBounds = (coords) => {
          coords.forEach(item => {
            if (typeof item[0] === 'number') {
              const [lng, lat] = item
              if (lng < xmin) xmin = lng
              if (lng > xmax) xmax = lng
              if (lat < ymin) ymin = lat
              if (lat > ymax) ymax = lat
            } else {
              getBounds(item)
            }
          })
        }
        geojsonData.features.forEach(f => getBounds(f.geometry.coordinates))
      }
      if (xmin === Infinity || xmax === -Infinity) {
        xmin = 104.27
        xmax = 106.88
        ymin = 35.24
        ymax = 39.39
      }
    }

    const coordinates = [
      [xmin, ymax],
      [xmax, ymax],
      [xmax, ymin],
      [xmin, ymin]
    ]

    // 再次拦截：异步加载期间如果面板被关闭了，不执行最终上图操作
    if (!props.isOpen) return

    if (map.getSource(RASTER_SOURCE_ID)) {
      if (map.getLayer(RASTER_LAYER_ID)) map.removeLayer(RASTER_LAYER_ID)
      map.removeSource(RASTER_SOURCE_ID)
    }

    map.addSource(RASTER_SOURCE_ID, {
      type: 'image',
      url: dataURL,
      coordinates: coordinates
    })

    map.addLayer({
      id: RASTER_LAYER_ID,
      type: 'raster',
      source: RASTER_SOURCE_ID,
      paint: {
        'raster-opacity': 0.85,
        'raster-fade-duration': 0
      }
    })

  } catch (e) {
    console.error('Tif 渲染失败', e)
  } finally {
    renderLock = false
  }
}

// ===============================
// 加载Excel数据
// ===============================
const loadYearDataWithoutRender = async () => {
  try {
    const response = await fetch('/数据总表.xlsx')
    const textSample = await response.clone().text()
    if (textSample.startsWith('<!DOCTYPE') || textSample.includes('<html')) {
      console.error('未找到 /数据总表.xlsx 文件，请确保该文件已放入 public 目录中')
      return
    }

    const arrayBuffer = await response.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })

    const sheetName = selectedYear.value
    const worksheet = workbook.Sheets[sheetName]

    if (!worksheet) {
      console.error(`未找到 sheet: ${sheetName}`)
      return
    }

    const jsonData = XLSX.utils.sheet_to_json(worksheet)
    csvDataArray.value = jsonData

    const allFields = Object.keys(jsonData[0])
    dynamicFields.value = allFields.filter(field => {
      return !['name', 'city', 'x', 'y'].includes(field)
    })

    if (!selectedField.value || !dynamicFields.value.includes(selectedField.value)) {
      selectedField.value = dynamicFields.value[0]
    }
  } catch (e) {
    console.error('Excel读取失败', e)
  }
}

const loadYearData = async () => {
  await loadYearDataWithoutRender()
  renderBaseMap()
}

// ===============================
// 渲染数据与交互
// ===============================
const renderBaseMap = () => {
  const map = props.map
  if (!map || !geojsonData) return

  // 如果面板处于关闭状态，直接拦截渲染
  if (!props.isOpen) return

  if (map.getLayer(GEO_LAYER_ID)) {
    map.removeLayer(GEO_LAYER_ID)
  }
  if (map.getLayer('nx-border-line')) {
    map.removeLayer('nx-border-line')
  }
  if (map.getSource(GEO_SOURCE_ID)) {
    map.removeSource(GEO_SOURCE_ID)
  }

  const valueMap = new Map()
  csvDataArray.value.forEach(item => {
    const cityName = item.name || item.city || item.地区 || item.城市
    let val = 0

    if (!formulaText.value.trim() && selectedField.value) {
      val = parseFloat(item[selectedField.value]) || 0
    } else if (formulaText.value.trim()) {
      try {
        const scope = {}
        Object.keys(item).forEach(key => {
          const v = parseFloat(item[key])
          scope[key] = isNaN(v) ? 0 : v
        })
        scope.pow = Math.pow
        scope.sqrt = Math.sqrt
        scope.log = Math.log
        scope.abs = Math.abs

        val = Function(
          ...Object.keys(scope),
          `return ${formulaText.value}`
        )(...Object.values(scope))
        if (isNaN(val)) val = 0
      } catch (e) {
        val = 0
      }
    }
    if (cityName) {
      valueMap.set(cityName.trim(), val)
    }
  })

  const features = geojsonData.features.map(feature => {
    const cityName = feature.properties.name || feature.properties.NAME
    const value = valueMap.get(cityName?.trim()) || 0
    return {
      type: 'Feature',
      geometry: feature.geometry,
      properties: {
        ...feature.properties,
        name: cityName,
        value: value
      }
    }
  })

  map.addSource(GEO_SOURCE_ID, {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features
    }
  })
}

// ===============================
// 清除图层
// ===============================
const clearLayers = () => {
  const map = props.map
  if (!map) return

  if (map.getLayer(RASTER_LAYER_ID)) {
    map.removeLayer(RASTER_LAYER_ID)
  }
  if (map.getSource(RASTER_SOURCE_ID)) {
    map.removeSource(RASTER_SOURCE_ID)
  }

  const layers = [GEO_LAYER_ID, 'nx-border-line']
  layers.forEach(id => {
    if (map.getLayer(id)) map.removeLayer(id)
  })

  const sources = [GEO_SOURCE_ID]
  sources.forEach(id => {
    if (map.getSource(id)) map.removeSource(id)
  })
}

onUnmounted(() => {
  clearLayers()
})
</script>

<style scoped>
/* ========================= */
/* 右侧统一控制窗口样式 */
/* ========================= */
.right-selector-panel {
  position: absolute;
  right: 28px;
  top: 50%;
  transform: translateY(-50%);
  width: 280px;
  max-height: 85vh;
  overflow-y: auto;
  padding: 20px;
  z-index: 1000;
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(6,20,45,0.95), rgba(3,10,30,0.95));
  border: 1px solid rgba(0,255,255,0.28);
  backdrop-filter: blur(12px);
  box-shadow: 0 0 25px rgba(0,255,255,0.12);
  box-sizing: border-box;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}

.panel-title {
  color: #7ffeff;
  font-size: 16px;
  font-weight: bold;
  text-shadow: 0 0 10px rgba(0,255,255,0.6);
}

.close-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  background: rgba(255,80,80,0.15);
  color: #ff6666;
  font-size: 18px;
  cursor: pointer;
  transition: 0.3s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: rgba(255,80,80,0.3);
  transform: rotate(90deg);
}

.control-group {
  margin-bottom: 16px;
}

.control-label {
  display: block;
  color: #bfefff;
  font-size: 13px;
  margin-bottom: 6px;
}

.control-select {
  width: 100%;
  background: rgba(0,0,0,0.35);
  border: 1px solid rgba(0,255,255,0.45);
  color: #ffffff;
  border-radius: 8px;
  padding: 8px 12px;
  outline: none;
  transition: 0.3s;
  box-sizing: border-box;
}

.control-select:hover {
  border-color: #00ffff;
  box-shadow: 0 0 10px rgba(0,255,255,0.35);
}

.layer-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 200px;
  overflow-y: auto;
}

.layer-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(0,0,0,0.3);
  color: #dffcff;
  font-size: 13px;
  cursor: pointer;
  transition: 0.3s;
  border: 1px solid transparent;
}

.layer-item:hover {
  border-color: rgba(0,255,255,0.4);
  background: rgba(0,255,255,0.1);
}

.layer-item.active {
  background: rgba(0,255,255,0.2);
  border-color: #00ffff;
  color: #ffffff;
  font-weight: bold;
  box-shadow: 0 0 10px rgba(0,255,255,0.25);
}

.layer-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #00eaff;
  box-shadow: 0 0 6px #00eaff;
}

.formula-panel-input {
  width: 100%;
  background: rgba(0,0,0,0.35);
  border: 1px solid rgba(0,255,255,0.45);
  color: #ffffff;
  border-radius: 10px;
  padding: 8px 12px;
  outline: none;
  transition: 0.3s;
  font-size: 13px;
  box-sizing: border-box;
}

.formula-panel-input:hover,
.formula-panel-input:focus {
  border-color: #00ffff;
  box-shadow: 0 0 10px rgba(0,255,255,0.35);
}

/* 图例模块样式 */
.legend-section {
  padding-top: 10px;
  border-top: 1px solid rgba(0,255,255,0.15);
}

.legend-title {
  text-align: center;
  color: #7ffeff;
  font-size: 13px;
  font-weight: bold;
  margin-bottom: 8px;
}

.gradient-bar {
  width: 100%;
  height: 12px;
  border-radius: 8px;
  background: linear-gradient(90deg, #00eaff, #00ff95, #fff000, #ff5b00);
  box-shadow: 0 0 10px rgba(0,255,255,0.3);
}

.legend-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  color: #d8f9ff;
  font-size: 11px;
}
</style>