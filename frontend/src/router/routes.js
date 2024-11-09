import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import RegisterView from '@/views/RegisterView.vue'
import PetView from '../views/PetView.vue'

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
  },
  {
    path: '/mascota/:id',
    name: 'Pet',
    meta: {
      title: 'Vista de una mascota'
    },
    component: PetView
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router