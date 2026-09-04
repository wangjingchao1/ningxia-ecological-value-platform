<template>
  <div class="landing-scroll-container">
    <section class="snap-section section-hero active">
      <div class="background-video">
        <div class="video-overlay"></div>
      </div>
      <div class="landing-content fade-in-section">
        <div class="brand-header fly-in-top">
          <span class="hero-brand-label">SHANDONG CARBON MONITORING</span>
        </div>
        <div class="main-visual fly-in-bottom">
          <h1 class="hero-main-title">山东省二氧化碳监测平台</h1>
          <p class="hero-sub-slogan">精准感知碳踪迹 · 智慧驱动绿未来</p>
        </div>
        
        <div class="quick-nav fly-in-bottom delay-2">
          <button class="nav-btn" @click="scrollToPage(1)">全域3D</button>
          <button class="nav-btn" @click="scrollToPage(2)">排放统计</button>
          <button class="nav-btn" @click="scrollToPage(3)">交通能效</button>
          <button class="nav-btn" @click="scrollToPage(4)">城市概况</button>
          <button class="primary-btn" @click="$emit('enter')">进入系统</button>
        </div>

        <div class="scroll-hint" @click="scrollToPage(1)">
          <p>向下探索功能详情</p>
          <div class="arrow-down">↓</div>
        </div>
      </div>
    </section>

    <section v-for="(feature, index) in features" 
             :key="index" 
             :class="['snap-section', 'section-feature', index % 2 === 0 ? 'light' : 'dark']">
      <div class="feature-content fade-in-section" :class="{ 'reverse': index % 2 !== 0 }">
        <div class="text-side">
          <div class="num-tag">0{{ index + 1 }}</div>
          <h2 class="fly-in-left delay-1">{{ feature.title }}</h2>
          <p class="fly-in-left delay-2">{{ feature.desc }}</p>
          <button v-if="index === features.length - 1" class="final-btn" @click="$emit('enter')">开启监测</button>
        </div>
        <div class="image-side" :class="index % 2 === 0 ? 'fly-in-right' : 'fly-in-left'">
          <img :src="feature.img" :alt="feature.title" />
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';

defineEmits(['enter']);

const features = [
  {
    title: '全域 3D 立体化呈现',
    desc: '集成高精度地形与建筑白模数据，通过 渲染技术实现排放密度的空间立体映射，让碳排放分布一目了然。',
    img: '/2.png'
  },
  {
    title: '多维动态数据分析',
    desc: '基于 Excel 与 GeoJSON 的高效对齐算法，实时计算各市二氧化碳排放总量、人均能耗等核心指标，支撑政府科学决策数据。',
    img: '/3.png'
  },
  {
    title: '交通碳足迹精准追踪',
    desc: '深度解析机动车保有量、道路拥堵指数与交通结构占比，通过可视化工具展现交通领域的节能减排潜力。',
    img: '/4.png'
  },
  {
    title: '城市画像与精细管控',
    desc: '一键调取全省 16 地市的基础概况与生态红线，构建全方位的数字化底座，实现城市运行要素的深度感知。',
    img: '/5.png'
  }
];

const scrollToPage = (index) => {
  const container = document.querySelector('.landing-scroll-container');
  container.scrollTo({
    top: window.innerHeight * index,
    behavior: 'smooth'
  });
};

onMounted(() => {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) entry.target.classList.add('active');
      else entry.target.classList.remove('active');
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.fade-in-section').forEach(el => observer.observe(el));
});
</script>

<style scoped>
/* --- 基础布局 --- */
.landing-scroll-container {
  position: fixed;
  top: 0; left: 0;
  width: 100vw; height: 100vh;
  z-index: 9999;
  background: #000;
  overflow-y: auto;
  scroll-snap-type: y mandatory;
}
.landing-scroll-container::-webkit-scrollbar { display: none; }

.snap-section {
  width: 100vw; height: 100vh;
  scroll-snap-align: start;
  position: relative;
  display: flex; 
  justify-content: center; 
  align-items: center;
  overflow: hidden;
}

.section-feature.light { background: #f5f5f7; color: #1d1d1f; }
.section-feature.dark { background: #0b0b0b; color: #fff; }

/* --- 动画系统 --- */
.fly-in-top { opacity: 0; transform: translateY(-40px); transition: all 1s; }
.fly-in-bottom { opacity: 0; transform: translateY(40px); transition: all 1s; }
.fly-in-left { opacity: 0; transform: translateX(-60px); transition: all 1s cubic-bezier(0.2, 1, 0.3, 1); }
.fly-in-right { opacity: 0; transform: translateX(60px) scale(0.95); transition: all 1s cubic-bezier(0.2, 1, 0.3, 1); }
.delay-1 { transition-delay: 0.2s; }
.delay-2 { transition-delay: 0.4s; }

.active .fly-in-top, 
.active .fly-in-bottom, 
.active .fly-in-left, 
.active .fly-in-right {
  opacity: 1; transform: translate(0) scale(1);
}

/* --- 首页标题区域独立样式 (核心修改) --- */
.hero-main-title { 
  font-size: 72px; 
  letter-spacing: 10px; 
  font-weight: 800; 
  color: rgba(255, 255, 255, 0.2); /* 白色，20% 透明度 */
  margin: 0;
}

.hero-brand-label {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.5);
  letter-spacing: 2px;
  text-transform: uppercase;
}

.hero-sub-slogan {
  font-size: 18px;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 15px;
  letter-spacing: 4px;
}

/* --- 首页导航与背景 --- */
.quick-nav { margin-top: 40px; display: flex; gap: 15px; flex-wrap: wrap; justify-content: center; }
.nav-btn {
  background: rgba(255,255,255,0.1); color: #fff; border: 1px solid rgba(255,255,255,0.3);
  padding: 10px 24px; border-radius: 20px; cursor: pointer; backdrop-filter: blur(5px); transition: all 0.3s;
}
.nav-btn:hover { background: rgba(255,255,255,0.9); color: #000; }
.primary-btn { 
  background: rgb(25, 79, 165); 
  color: #fff; 
  border: none; 
  padding: 12px 34px; 
  border-radius:26px; 
  cursor: pointer; 
  font-weight: bold; 
}


.section-hero .background-video { 
  position: absolute; 
  width: 100%; 
  height: 100%; 
  background: url('/1.png') center/cover no-repeat; 
}
.video-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.6); }

/* --- 功能展示区样式 --- */
.feature-content { display: flex; width: 85%; max-width: 1300px; gap: 80px; align-items: center; }
.feature-content.reverse { flex-direction: row-reverse; }
.text-side { flex: 1; position: relative; }
.text-side h2 { font-size: 48px; font-weight: 700; margin-bottom: 20px; }
.text-side p { font-size: 20px; line-height: 1.6; opacity: 0.8; }
.num-tag { font-size: 120px; font-weight: 900; position: absolute; top: -60px; left: -20px; opacity: 0.05; pointer-events: none; }

.image-side { flex: 1.5; border-radius: 20px; overflow: hidden; box-shadow: 0 30px 80px rgba(0,0,0,0.3); }
.image-side img { width: 100%; display: block; transition: transform 0.8s; }
.image-side:hover img { transform: scale(1.05); }

.final-btn { margin-top: 30px; background: #3b82f6; color: #fff; border: none; padding: 15px 50px; font-size: 18px; border-radius: 30px; cursor: pointer; }
.scroll-hint { position: absolute; bottom: 30px; cursor: pointer; text-align: center; color: #fff; width: 100%; }
.arrow-down { font-size: 24px; animation: bounce 2s infinite; }

@keyframes bounce { 
  0%, 100% { transform: translateY(0); } 
  50% { transform: translateY(10px); } 
}
</style>