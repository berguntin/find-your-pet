import { createRouter, createWebHistory } from 'vue-router'


const routes = [
  { 
    path: '/', 
    name: 'Home',
    component: () => import ('@/views/Homeview.vue')   
  },
  {
    path: '/registrar',
    name: 'RegisterForm',
    component: () => import('../views/RegisterView.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router