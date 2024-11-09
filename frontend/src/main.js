import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import './assets/css/tailwind.css'
import router from './router/routes.js'

const app = createApp(App)

app.use(router)

app.mount('#app')
