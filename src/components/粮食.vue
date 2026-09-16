<template>
  <div class="view-controls-group">
    <button class="tool-btn" @click="handleReset" title="切换宁夏视角">
      <span class="btn-icon">🏠</span>
      <span class="btn-label">复位</span>
    </button>

    <div class="divider"></div>

    <button class="tool-btn" @click="handleToggle3D" :class="{ active: is3D }">
      <span class="btn-icon">{{ is3D ? '🧊' : '📄' }}</span>
      <span class="btn-label">{{ is3D ? '3D' : '2D' }}</span>
    </button>
  </div>

  <div class="data-container" v-show="isOpen">
    <!-- 右侧竖向铺满的 4 个图表列表（不透明纯色底色、无边框、无滚动条） -->
    <div class="charts-column">
      <div class="chart-item">
        <div class="card-header">
          <h3>各市机动车保有量（{{ selectedYear }}）</h3>
        </div>
        <div class="card-body">
          <div
            class="chart-container"
            ref="treemapRef"
          ></div>
        </div>
      </div>

      <div class="chart-item">
        <div class="card-header">
          <h3>各市二氧化碳排放总量</h3>
        </div>
        <div class="card-body">
          <div
            class="chart-container"
            ref="barRef"
          ></div>
        </div>
      </div>

      <div class="chart-item">
        <div class="card-header">
          <h3>各市拥堵指数（{{ selectedYear }}）</h3>
        </div>
        <div class="card-body">
          <div
            class="chart-container"
            ref="lineRef"
          ></div>
        </div>
      </div>

      <div class="chart-item">
        <div class="card-header">
          <h3>交通结构排放占比</h3>
        </div>
        <div class="card-body">
          <div
            class="chart-container"
            ref="pieRef"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>

import {
  ref,
  onMounted,
  watch,
  nextTick,
  onUnmounted
} from 'vue'

import {
  Treemap,
  Bar,
  Pie,
  Line
} from '@antv/g2plot'

import * as XLSX from 'xlsx'

/* =========================================
   props
========================================= */

const props = defineProps({

  map: {
    type: Object,
    required: true
  },

  isOpen: {
    type: Boolean,
    default: false
  }
})

/* =========================================
   refs
========================================= */

const selectedYear = ref('')
const yearList = ref([])

const allData = ref({})

const treemapRef = ref(null)
const barRef = ref(null)
const pieRef = ref(null)
const lineRef = ref(null)

let treemapPlot = null
let barPlot = null
let piePlot = null
let linePlot = null

const is3D = ref(true);

/* =========================================
   地图视角
========================================= */

// 预设视角配置（已将 zoom 改为 5）
const VIEWS = {
  NINGXIA: { 
    center: [106.27, 38.47], 
    zoom: 6.5, 
    pitch: 45, 
    bearing: 0 
  },
  GLOBE: { 
    center: [110, 30], 
    zoom: 1.5, 
    pitch: 0, 
    bearing: 0 
  }
};

const SHANDONG_VIEW = {
  center: [106.8, 37.47],
  zoom: 6.8, // 统一修改为 6.5
  pitch: 40,
  bearing: 0
}

// 复位逻辑：在宁夏视角和全球视角间切换
const handleReset = () => {
  if (!props.map) return;

  if (props.map.getZoom() < 4) {
    props.map.flyTo({ 
      ...VIEWS.NINGXIA, 
      duration: 2500, 
      essential: true 
    });
    is3D.value = true;
  } else {
    props.map.flyTo({ 
      ...VIEWS.GLOBE, 
      duration: 2000,
      essential: true 
    });
    is3D.value = false;
  }
};

// 2D/3D 切换逻辑
const handleToggle3D = () => {
  if (!props.map) return;
  is3D.value = !is3D.value;
  props.map.easeTo({ 
    pitch: is3D.value ? 45 : 0,
    duration: 800 
  });
};

/* =========================================
   加载Excel
========================================= */

const loadExcel = async () => {

  try {

    const response =
      await fetch('/数据总表.xlsx')

    const arrayBuffer =
      await response.arrayBuffer()

    const workbook =
      XLSX.read(arrayBuffer, {
        type: 'array'
      })

    yearList.value =
      workbook.SheetNames

    selectedYear.value =
      workbook.SheetNames[
        workbook.SheetNames.length - 1
      ]

    workbook.SheetNames.forEach(sheet => {

      const worksheet =
        workbook.Sheets[sheet]

      const json =
        XLSX.utils.sheet_to_json(
          worksheet
        )

      allData.value[sheet] = json
    })

    nextTick(() => {

      initAllCharts()

      if (props.map.loaded()) {

        loadMap()

      } else {

        props.map.on('load', () => {

          loadMap()
        })
      }
    })

  } catch (err) {

    console.error(
      'Excel读取失败:',
      err
    )
  }
}

/* =========================================
   当前年份数据
========================================= */

const getCurrentData = () => {

  return (
    allData.value[selectedYear.value]
    || []
  )
}

/* =========================================
   Treemap
========================================= */

const initTreemap = () => {

  const currentData =
    getCurrentData()

  if (
    !treemapRef.value ||
    currentData.length === 0
  ) return

  const data = {

    name: '宁夏回族自治区',

    children: currentData.map(item => ({

      name:
        String(item.name || '')
          .replace('市', '')
          .replace('地区', ''),

      value:
        Number(
          item['五种车辆总量']
        ) || 0
    }))
  }

  if (treemapPlot) {

    treemapPlot.changeData(data)
    return
  }

  treemapPlot =
    new Treemap(
      treemapRef.value,
      {

        autoFit: true,

        data,

        colorField: 'name',

        valueField: 'value',

        hierarchyField: 'name',

        legend: false,

        label: {
          style: {
            fill: '#fff',
            fontSize: 10
          }
        },

        tooltip: {

          formatter: datum => ({

            name: datum.name,

            value:
              datum.value.toLocaleString()
          })
        }
      }
    )

  treemapPlot.render()
}

/* =========================================
   Bar
========================================= */

const initBar = () => {

  const currentData =
    getCurrentData()

  if (
    !barRef.value ||
    currentData.length === 0
  ) return

  const data = currentData
    .map(item => ({

      city:
        String(item.name || '')
          .replace('市', '')
          .replace('地区', ''),

      value:
        Number(
          item['二氧化碳排放总量']
        ) || 0
    }))

    .sort((a, b) => b.value - a.value)

  if (barPlot) {

    barPlot.changeData(data)
    return
  }

  barPlot = new Bar(barRef.value, {

    autoFit: true,

    data,

    xField: 'value',

    yField: 'city',

    seriesField: 'city',

    legend: false,

    label: {
      position: 'right',
      style: {
        fontSize: 9
      }
    },

    xAxis: {

      label: {

        style: {
          fill: '#94a3b8',
          fontSize: 9
        }
      }
    },

    yAxis: {

      label: {

        style: {
          fill: '#94a3b8',
          fontSize: 9
        }
      }
    }
  })

  barPlot.render()
}

/* =========================================
   Pie
========================================= */

const initPie = () => {

  const currentData =
    getCurrentData()

  if (
    !pieRef.value ||
    currentData.length === 0
  ) return

  const sumField = field => {

    return currentData.reduce(
      (sum, item) => {

        return sum + (
          Number(item[field]) || 0
        )

      }, 0
    )
  }

  const data = [

    {
      type: '摩托车',
      value: sumField(
        '摩托车二氧化碳排放量'
      )
    },

    {
      type: '公交车',
      value: sumField(
        '公交车二氧化碳排放量'
      )
    },

    {
      type: '载客车',
      value: sumField(
        '载客车二氧化碳排放量'
      )
    },

    {
      type: '载货车',
      value: sumField(
        '载货车二氧化碳排放量'
      )
    },

    {
      type: '私家车',
      value: sumField(
        '私家车二氧化碳排放量'
      )
    }
  ]

  if (piePlot) {

    piePlot.changeData(data)
    return
  }

  piePlot = new Pie(pieRef.value, {

    autoFit: true,

    data,

    angleField: 'value',

    colorField: 'type',

    radius: 0.8,

    innerRadius: 0.55,

    label: {
      type: 'outer',
      style: {
        fontSize: 9
      }
    },

    statistic: {

      title: {
        content: '交通排放'
        , style: {
          fontSize: 11,
          fontWeight: 'bold',
          color: '#333'
        }
      },

      content: {
        style: { fontSize: 9 }
      },


    }
  })

  piePlot.render()
}

/* =========================================
   折线图
========================================= */

const initLine = () => {

  const currentData =
    getCurrentData()

  if (
    !lineRef.value ||
    currentData.length === 0
  ) return

  const lineData =
    currentData.map(item => ({

      city:
        String(item.name || '')
          .replace('市', '')
          .replace('地区', ''),

      value:
        Number(
          item['拥堵指数']
        ) || 0
    }))

  if (linePlot) {

    linePlot.changeData(lineData)
    return
  }

  linePlot = new Line(lineRef.value, {

    autoFit: true,

    data: lineData,

    xField: 'city',

    yField: 'value',

    smooth: true,

    point: {
      size: 3
    },

    color: '#5B8FF9',

    lineStyle: {
      lineWidth: 2
    },

    xAxis: {

      label: {

        autoRotate: true,

        style: {
          fill: '#94a3b8',
          fontSize: 9
        }
      }
    },

    yAxis: {

      label: {

        style: {
          fill: '#94a3b8',
          fontSize: 9
        }
      },

      grid: {

        line: {

          style: {
            stroke:
              'rgba(255,255,255,0.08)'
          }
        }
      }
    }
  })

  linePlot.render()
}

/* =========================================
   初始化所有图
========================================= */

const initAllCharts = () => {

  nextTick(() => {

    initTreemap()

    initBar()

    initPie()

    initLine()
  })
}

/* =========================================
   地图层
========================================= */

const addLayers = geojson => {

  const currentData =
    getCurrentData()

  let maxCO2 = 0;

  geojson.features.forEach(feature => {

    let cityName =
      feature.properties.name ||
      feature.properties.NAME ||
      feature.properties.NAME_CHN ||
      ''

    cityName =
      cityName
        .replace('市', '')
        .replace('地区', '')
        .trim()

    const match =
      currentData.find(item => {
        const excelName =
          String(item.name || '')
            .replace('市', '')
            .replace('地区', '')
            .trim()
        return excelName === cityName
      })

    const co2 =
      match
        ? Number(match['二氧化碳排放总量']) || 0
        : 0

    feature.properties.co2 = co2
    if (co2 > maxCO2) maxCO2 = co2;
  })

  if (props.map.getLayer('co2-fill')) props.map.removeLayer('co2-fill');
  if (props.map.getSource('co2-source')) props.map.removeSource('co2-source');

  props.map.addSource(
    'co2-source',
    {
      type: 'geojson',
      data: geojson
    }
  )

  props.map.addLayer({
    id: 'co2-fill',
    type: 'fill-extrusion',
    source: 'co2-source',
    paint: {
      'fill-extrusion-color': [
        'interpolate',
        ['linear'],
        ['get', 'co2'],
        0, '#dbeafe',
        maxCO2 * 0.5, '#3b82f6',
        maxCO2, '#1e3a8a'
      ],
      'fill-extrusion-height': [
        'interpolate',
        ['linear'],
        ['get', 'co2'],
        0, 100,       
        maxCO2, 90000     
      ],
      'fill-extrusion-base': 0,
      'fill-extrusion-opacity': 0.9,
      'fill-extrusion-vertical-gradient': true
    }
  })
}

/* =========================================
   加载地图文件 (nxx.json)
========================================= */

const loadMap = async () => {

  try {

    const res = await fetch('/nxx.json')

    const geojson = await res.json()

    addLayers(geojson)

  } catch (err) {

    console.error(
      'GeoJSON加载失败:',
      err
    )
  }
}

/* =========================================
   清除图层
========================================= */

const clearLayers = () => {

  if (
    props.map.getLayer('co2-fill')
  ) {

    props.map.removeLayer(
      'co2-fill'
    )
  }

  if (
    props.map.getSource('co2-source')
  ) {

    props.map.removeSource(
      'co2-source'
    )
  }
}

/* =========================================
   年份切换
========================================= */

const handleYearChange = () => {

  initAllCharts()

  loadMap()
}

/* =========================================
   生命周期
========================================= */

onMounted(async () => {

  await loadExcel()

  window.addEventListener(
    'resize',
    initAllCharts
  )
})

onUnmounted(() => {

  treemapPlot?.destroy()
  barPlot?.destroy()
  piePlot?.destroy()
  linePlot?.destroy()

  clearLayers()
})

watch(

  () => props.isOpen,

  open => {

    if (open) {

      nextTick(() => {

        initAllCharts()

        if (props.map.loaded()) {

          loadMap()

        } else {

          props.map.on(
            'load',
            loadMap
          )
        }

        props.map?.flyTo({

          ...SHANDONG_VIEW,

          duration: 2000
        })
      })

    } else {

      clearLayers()
      is3D.value = false;
      if (props.map) {
        props.map.easeTo({ 
          pitch: 0,
          duration: 800 
        });
      }
    }
  },

  {
    immediate: true
  }
)

</script>

<style scoped>

.view-controls-group {
  display: flex;
  align-items: center;
}

.tool-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 55px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;
}

.tool-btn:hover {
  background: rgba(0, 0, 0, 0.05);
}

.tool-btn.active {
  color: #1890ff;
  background: rgba(24, 144, 255, 0.1);
}

.btn-icon { font-size: 18px; }
.btn-label { font-size: 10px; margin-top: 2px; }

.divider {
  width: 1px;
  height: 20px;
  background: #ccc;
  margin: 0 10px;
}

.data-container{
  position:absolute;
  inset:0;
  display:flex;
  justify-content:flex-end;
  align-items:stretch;
  padding:0;
  z-index:1000;
  pointer-events:none;
}

.charts-column {
  width: 380px;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #0b1326;
  pointer-events: auto;
  overflow: hidden;
}

.chart-item{
  flex: 1;
  background: #0b1326;
  border: none;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
}

.card-header h3{
  margin:0;
  color:#60a5fa;
  font-size:11px;
}

.card-body{
  flex: 1;
  margin-top: 4px;
  min-height: 0;
}

.chart-container{
  width:100%;
  height:100%;
}

</style>