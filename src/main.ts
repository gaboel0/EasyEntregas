import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import './style.css'
import { initAppearance } from './composables/useAppearance'

initAppearance()
createApp(App).use(createPinia()).use(router).mount('#app')
