<template>
  <div class="carbon-data-panel" :class="{ open: isOpen }" v-if="isOpen">
    <div class="panel-header">
      <h2 class="title">🍃 山东省交通碳排放监测</h2>
      <button class="close-btn" @click="$emit('close')">×</button>
    </div>

    <div class="filter-box">
      <div class="year-selector">
        <button 
          v-for="year in [2015, 2018, 2021, 2023]" 
          :key="year" 
          :class="{ active: currentYear === year }"
          @click="updateYear(year)"
        >
          {{ year }}
        </button>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat-card main">
        <div class="label">全省年度排放总量</div>
        <div class="value">{{ (summary.total / 10000).toFixed(2) }} <small>万吨</small></div>
      </div>
      <div class="stat-card">
        <div class="label">私家车</div>
        <div class="value sub">{{ (summary.private / 10000).toFixed(1) }}w</div>
      </div>
      <div class="stat-card">
        <div class="label">载货车</div>
        <div class="value sub">{{ (summary.truck / 10000).toFixed(1) }}w</div>
      </div>
    </div>

    <div class="city-list">
      <h3>城市详情排行 (t)</h3>
      <div class="scroll-area">
        <div class="city-item" v-for="city in cityData" :key="city.name">
          <span class="name">{{ city.name }}</span>
          <div class="bar-bg">
            <div class="bar-fill" :style="{ width: (city.total / maxVal * 100) + '%' }"></div>
          </div>
          <span class="num">{{ Math.round(city.total) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue'
import Papa from 'papaparse'

const props = defineProps({
  isOpen: Boolean,
  map: Object
})

const currentYear = ref(2023)
const cityData = ref([])
const maxVal = ref(1)
const summary = reactive({ total: 0, private: 0, truck: 0, bus: 0, moto: 0 })

const updateYear = (year) => {
  currentYear.value = year
  fetchData()
}

const fetchData = async () => {
  const res = await fetch(`/数据总表.xlsx - ${currentYear.value}.csv`)
  const csv = await res.text()
  
  Papa.parse(csv, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      const data = results.data
      cityData.value = data.map(d => ({
        name: d.name,
        total: parseFloat(d.二氧化碳排放总量 || 0),
        x: parseFloat(d.x),
        y: parseFloat(d.y)
      })).sort((a, b) => b.total - a.total)

      maxVal.value = Math.max(...cityData.value.map(c => c.total))
      
      summary.total = data.reduce((s, i) => s + parseFloat(i.二氧化碳排放总量 || 0), 0)
      summary.private = data.reduce((s, i) => s + parseFloat(i.私家车二氧化碳排放量 || 0), 0)
      summary.truck = data.reduce((s, i) => s + parseFloat(i.载货车二氧化碳排放量 || 0), 0)

      updateMapLayers(data)
    }
  })
}

const updateMapLayers = (data) => {
  if (!props.map) return
  
  const geojson = {
    type: 'FeatureCollection',
    features: data.map(item => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [parseFloat(item.x), parseFloat(item.y)] },
      properties: { val: parseFloat(item.二氧化碳排放总量), name: item.name }
    }))
  }

  if (props.map.getSource('points-src')) {
    props.map.getSource('points-src').setData(geojson)
  } else {
    props.map.addSource('points-src', { type: 'geojson', data: geojson })
    props.map.addLayer({
      id: 'points-layer',
      type: 'circle',
      source: 'points-src',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['get', 'val'], 1000000, 5, 8000000, 30],
        'circle-color': '#00ffff',
        'circle-opacity': 0.6,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff'
      }
    })
  }
}

watch(() => props.map, (m) => {
  if (m) {
    m.on('load', () => {
      m.addSource('sd-line-src', { type: 'geojson', data: '/sd.geojson' })
      m.addLayer({
        id: 'sd-line-layer',
        type: 'line',
        source: 'sd-line-src',
        paint: { 'line-color': '#00ffff', 'line-width': 1, 'line-opacity': 0.4 }
      })
      fetchData()
    })
  }
}, { immediate: true })

onMounted(() => { if (props.map?.isStyleLoaded()) fetchData() })
</script>

<style scoped>
.carbon-data-panel {
  position: absolute; top: 120px; right: 20px; width: 400px;
  background: rgba(0, 15, 30, 0.85);
  border: 1px solid #00ffff;
  border-radius: 15px;
  backdrop-filter: blur(10px);
  padding: 20px; color: #fff; z-index: 1000;
}

.panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
.title { font-size: 18px; color: #00ffff; }
.close-btn { background: none; border: none; color: #fff; font-size: 24px; cursor: pointer; }

.year-selector { display: flex; gap: 5px; margin-bottom: 20px; }
.year-selector button {
  flex: 1; padding: 5px; background: rgba(0, 255, 255, 0.1);
  border: 1px solid #00ffff; color: #00ffff; cursor: pointer; border-radius: 4px;
}
.year-selector button.active { background: #00ffff; color: #000; }

.stat-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 20px; }
.stat-card { background: rgba(255, 255, 255, 0.05); padding: 15px; border-radius: 10px; border-left: 4px solid #00ffff; }
.stat-card.main { grid-column: span 2; }
.label { font-size: 12px; color: #aaa; margin-bottom: 5px; }
.value { font-size: 28px; font-weight: bold; color: #00ffff; }
.value.sub { font-size: 20px; }

.city-list h3 { font-size: 14px; margin-bottom: 10px; color: #00ffff; }
.scroll-area { max-height: 300px; overflow-y: auto; padding-right: 5px; }
.city-item { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.name { width: 50px; font-size: 12px; }
.bar-bg { flex: 1; height: 8px; background: rgba(255, 255, 255, 0.1); border-radius: 4px; overflow: hidden; }
.bar-fill { height: 100%; background: linear-gradient(to right, #00ffff, #0088ff); transition: 0.5s; }
.num { font-size: 12px; color: #00ffff; width: 60px; text-align: right; }
</style>