import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import RegisterView from '@/views/RegisterView.vue'

const routes = [
  { 
    path: '/', 
    name: 'Home',
    component: HomeView  
  },
  {
    path: '/registrar',
    name: 'RegisterForm',
    component: RegisterView
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router