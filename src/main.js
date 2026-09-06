import './assets/main.css'
import 'mapbox-gl/dist/mapbox-gl.css'

import { createApp } from 'vue'
import App from './App.vue'
import mapboxgl from 'mapbox-gl'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

createApp(App).mount('#app')
