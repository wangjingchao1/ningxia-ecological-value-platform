<template>
  <div class="navigation-panel">
    <div class="nav-content-body">
      <div class="nav-header">
        <span class="header-title">路径规划</span>
        <button class="clear-nav-btn" @click="clearNavigation" v-if="startPoint || endPoint">
          清除
        </button>
      </div>
      
      <div class="nav-inputs">
        <div class="nav-input-item" 
             :class="{ active: pickingMode === 'start' }" 
             @click="pickingMode = 'start'">
          <span class="nav-dot start">A</span>
          <div class="nav-text">{{ startPoint ? '起点已设置' : '点击地图设置起点' }}</div>
        </div>
        <div class="nav-input-item" 
             :class="{ active: pickingMode === 'end' }" 
             @click="pickingMode = 'end'">
          <span class="nav-dot end">B</span>
          <div class="nav-text">{{ endPoint ? '终点已设置' : '点击地图设置终点' }}</div>
        </div>
      </div>

      <div class="algo-mode-tabs">
        <div v-for="mode in vehicleModes" :key="mode.value" class="mode-tab" 
             :class="{ active: currentVehicle === mode.value }" 
             @click="switchVehicleMode(mode.value)">
          {{ mode.label }}
        </div>
      </div>

      <div class="coord-nav-section">
        <div class="section-header"><span>坐标跳转</span></div>
        <div class="coord-inputs">
          <input v-model="jumpCoords.lng" type="number" placeholder="经度" step="0.000001">
          <input v-model="jumpCoords.lat" type="number" placeholder="纬度" step="0.000001">
          <button class="jump-btn" @click="jumpToLocation">定位</button>
        </div>
      </div>

      <div class="nav-result" v-if="routeInfo.distance">
        <span>距离: <b>{{ routeInfo.distance }}</b></span>
        <span>预计时间: <b>{{ routeInfo.duration }}</b></span>
      </div>

      <div class="carbon-panel" v-if="routeInfo.rawDistance">
        <div class="carbon-header">
          <span class="icon">🍃</span>
          <span>碳排放估算 (山东标准)</span>
        </div>
        <div class="carbon-content">
          <div class="carbon-value">
            {{ calculateCarbon }} <small>kg CO₂</small>
          </div>
          <div class="carbon-tip">
            基于当前<b>{{ currentVehicleLabel }}</b>排放标准计算
          </div>
        </div>
      </div>

      <div class="route-steps-container" v-if="routeInfo.steps && routeInfo.steps.length > 0">
        <div class="steps-scroll-area">
          <div v-for="(step, index) in routeInfo.steps" :key="index" class="step-item">
            <div class="step-icon">
              {{ index === 0 ? '起点：' : (index === routeInfo.steps.length - 1 ? '终点：' : '→') }}
            </div>
            <div class="step-content">
              <div class="step-instruction">{{ step.maneuver.instruction }}</div>
              <div class="step-distance" v-if="step.distance > 0">
                {{ (step.distance).toFixed(0) }} 米
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>


<script setup>
import { ref, reactive, onMounted, onUnmounted, computed } from 'vue';
import mapboxgl from 'mapbox-gl';

const props = defineProps({
  map: { type: Object, required: true }
});

const startPoint = ref(null);
const endPoint = ref(null);
const pickingMode = ref(null);
const currentVehicle = ref('private'); 
const jumpCoords = reactive({ lng: '', lat: '' });
const routeInfo = reactive({ distance: '', duration: '', steps: [], rawDistance: 0 });

// 车辆类型定义及山东省碳排放系数 (kgCO2/km)
const vehicleModes = [
  { label: '公交车', value: 'bus', factor: 0.0145 },      
  { label: '货车', value: 'truck', factor: 0.041 },     
  { label: '摩托车', value: 'motorcycle', factor: 0.062 },
  { label: '私家车', value: 'private', factor: 0.039 },
  { label: '载客车', value: 'taxi', factor: 0.039 }
];

const currentVehicleLabel = computed(() => {
  return vehicleModes.find(m => m.value === currentVehicle.value)?.label || '';
});

// 计算二氧化碳排放量
const calculateCarbon = computed(() => {
  const mode = vehicleModes.find(m => m.value === currentVehicle.value);
  if (!mode || !routeInfo.rawDistance) return '0.000';
  const distanceKm = routeInfo.rawDistance / 1000;
  return (distanceKm * mode.factor).toFixed(3);
});

const jumpToLocation = () => {
  if (jumpCoords.lng && jumpCoords.lat) {
    props.map.flyTo({
      center: [parseFloat(jumpCoords.lng), parseFloat(jumpCoords.lat)],
      zoom: 16,
      speed: 1.2,
      essential: true
    });
  }
};

const fetchRoute = async () => {
  if (!startPoint.value || !endPoint.value) return;
  
  const query = await fetch(
    `https://api.mapbox.com/directions/v5/mapbox/driving/${startPoint.value[0]},${startPoint.value[1]};${endPoint.value[0]},${endPoint.value[1]}?steps=true&language=zh&geometries=geojson&access_token=${mapboxgl.accessToken}`
  );
  const json = await query.json();
  if (!json.routes?.length) return;

  const data = json.routes[0];
  const geojson = { type: 'Feature', geometry: data.geometry };

  if (props.map.getSource('route')) {
    props.map.getSource('route').setData(geojson);
  } else {
    props.map.addLayer({
      id: 'route',
      type: 'line',
      source: { type: 'geojson', data: geojson },
      paint: { 
        'line-color': '#ff0000', // 核心修改：改为红色
        'line-width': 5, 
        'line-opacity': 0.8 
      }
    });
  }

  routeInfo.rawDistance = data.distance;
  routeInfo.distance = (data.distance / 1000).toFixed(2) + ' km';
  routeInfo.duration = Math.floor(data.duration / 60) + ' min';
  routeInfo.steps = data.legs[0].steps;
};

const updateMarker = (type, coords) => {
  const id = `nav-${type}`;
  const geojson = { type: 'Feature', geometry: { type: 'Point', coordinates: coords } };
  
  if (props.map.getLayer(id)) props.map.removeLayer(id);
  if (props.map.getSource(id)) props.map.removeSource(id);
  
  props.map.addLayer({
    id,
    type: 'circle',
    source: { type: 'geojson', data: geojson },
    paint: {
      'circle-radius': 8,
      'circle-color': type === 'start' ? '#52c41a' : '#ff4d4f',
      'circle-stroke-width': 2,
      'circle-stroke-color': '#fff'
    }
  });
};

const clearNavigation = () => {
  startPoint.value = null;
  endPoint.value = null;
  routeInfo.distance = '';
  routeInfo.rawDistance = 0;
  routeInfo.steps = [];
  ['route', 'nav-start', 'nav-end'].forEach(id => {
    if (props.map.getLayer(id)) props.map.removeLayer(id);
    if (props.map.getSource(id)) props.map.removeSource(id);
  });
};

const switchVehicleMode = (val) => {
  currentVehicle.value = val;
  if (startPoint.value && endPoint.value) fetchRoute();
};

const handleMapClick = (e) => {
  if (!pickingMode.value) return;
  const coords = [e.lngLat.lng, e.lngLat.lat];
  
  if (pickingMode.value === 'start') {
    startPoint.value = coords;
    updateMarker('start', coords);
    pickingMode.value = 'end';
  } else {
    endPoint.value = coords;
    updateMarker('end', coords);
    pickingMode.value = null;
  }
  
  if (startPoint.value && endPoint.value) fetchRoute();
};

onMounted(() => {
  props.map.on('click', handleMapClick);
});

onUnmounted(() => {
  props.map.off('click', handleMapClick);
  clearNavigation();
});
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

.navigation-panel {
  position: absolute;
  top: 80px;
  left: 20px;
  width: 600px;
  max-height: 82vh;
  background: linear-gradient(135deg, rgba(10, 20, 40, 0.95), rgba(15, 35, 65, 0.92));
  border: 1px solid rgba(59, 130, 246, 0.5);
  border-radius: 20px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(20px);
  z-index: 1000;
  font-family: 'Inter', sans-serif;
  overflow: hidden;
}

.nav-content-body {
  padding: 24px;
  color: #e2e8f0;
  display: flex;
  flex-direction: column;
  gap: 20px;
  height: 100%;
  overflow-y: auto;
}

.nav-header,
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 18px;
  font-weight: 700;
  color: #60a5fa;
  letter-spacing: 0.6px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(59, 130, 246, 0.4);
}

.header-title {
  font-size: 19px;
}

.clear-nav-btn {
  background: rgba(255, 77, 79, 0.25);
  color: #ff6b6b;
  border: 1px solid rgba(255, 77, 79, 0.4);
  padding: 6px 14px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.clear-nav-btn:hover {
  background: rgba(255, 77, 79, 0.4);
  transform: translateY(-1px);
}

.nav-inputs {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.nav-input-item {
  display: flex;
  align-items: center;
  padding: 16px;
  background: rgba(59, 130, 246, 0.15);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.nav-input-item:hover {
  background: rgba(59, 130, 246, 0.25);
  transform: translateX(4px);
}

.nav-input-item.active {
  background: rgba(59, 130, 246, 0.35);
  border-color: #60a5fa;
  box-shadow: 0 0 16px rgba(59, 130, 246, 0.3);
}

.nav-dot {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  color: #fff;
  font-size: 16px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16px;
  flex-shrink: 0;
}

.nav-dot.start { background: #52c41a; }
.nav-dot.end { background: #ff4d4f; }

.nav-text {
  font-size: 15px;
  font-weight: 500;
}

.algo-mode-tabs {
  display: flex;
  background: rgba(15, 23, 42, 0.6);
  border-radius: 14px;
  padding: 4px;
  gap: 4px;
}

.mode-tab {
  flex: 1;
  text-align: center;
  padding: 10px 0;
  font-size: 13px;
  font-weight: 500;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  color: #94a3b8;
}

.mode-tab:hover {
  background: rgba(59, 130, 246, 0.2);
  color: #fff;
}

.mode-tab.active {
  background: #3b82f6;
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.coord-nav-section {
  padding-top: 8px;
}

.coord-inputs {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-top: 12px;
}

.coord-inputs input {
  flex: 1;
  padding: 12px 16px;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(59, 130, 246, 0.4);
  border-radius: 12px;
  color: #e2e8f0;
  font-size: 14px;
  outline: none;
  transition: all 0.3s;
}

.coord-inputs input:focus {
  border-color: #60a5fa;
  box-shadow: 0 0 12px rgba(96, 165, 250, 0.3);
}

.jump-btn {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white;
  border: none;
  padding: 12px 20px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.jump-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(59, 130, 246, 0.4);
}

.nav-result {
  display: flex;
  justify-content: space-between;
  padding: 14px 16px;
  background: rgba(59, 130, 246, 0.2);
  border-radius: 14px;
  font-size: 15px;
  font-weight: 500;
}

.nav-result b {
  color: #60a5fa;
  font-weight: 700;
}

.carbon-panel {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.15));
  border: 1px solid rgba(16, 185, 129, 0.4);
  border-radius: 16px;
  padding: 16px;
  margin-top: 4px;
}

.carbon-header {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #10b981;
  font-weight: 700;
  font-size: 14px;
  margin-bottom: 10px;
}

.carbon-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.carbon-value {
  font-size: 24px;
  font-weight: 800;
  color: #fff;
  text-shadow: 0 0 10px rgba(16, 185, 129, 0.5);
}

.carbon-value small {
  font-size: 14px;
  font-weight: 400;
  color: #10b981;
  margin-left: 4px;
}

.carbon-tip {
  font-size: 12px;
  color: #94a3b8;
}

.carbon-tip b {
  color: #10b981;
}

.route-steps-container {
  margin-top: 8px;
  max-height: 280px;
  overflow-y: auto;
  padding-right: 4px;
}

.steps-scroll-area::-webkit-scrollbar {
  width: 6px;
}

.steps-scroll-area::-webkit-scrollbar-thumb {
  background: rgba(59, 130, 246, 0.4);
  border-radius: 3px;
}

.step-item {
  display: flex;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid rgba(59, 130, 246, 0.2);
}

.step-icon {
  font-size: 18px;
  flex-shrink: 0;
  margin-top: 2px;
}

.step-content {
  flex: 1;
}

.step-instruction {
  font-size: 14px;
  line-height: 1.5;
  color: #e2e8f0;
}

.step-distance {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 4px;
}
</style>