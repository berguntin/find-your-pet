<template>
  <div class="min-h-screen bg-base-200 p-4">
    <div class="max-w-md mx-auto">
      <h1 class="text-4xl font-bold text-center mb-8">Registrar Mascota</h1>
      <div  v-if="!alert" class="card bg-base-100 shadow-xl">
        <form @submit.prevent="submitForm" class="card-body">
          <div class="form-control">
            <label class="label" for="status">
              <span class="label-text">Situación</span>
            </label>
            <select v-model="form.status" id="status" required class="select select-bordered w-full">
              <option value="lost">He perdido</option>
              <option value="found">He encontrado</option>
            </select>
          </div>

          <div class="form-control">
            <label class="label" for="type">
              <span class="label-text">Tipo</span>
            </label>
            <select v-model="form.type" id="type" class="select select-bordered w-full">
              <option value="Perro">Perro</option>
              <option value="Gato">Gato</option>
              <option value="Otro">Otro</option>
            </select>
          </div>

          <div class="form-control">
            <label class="label" for="image">
              <span class="label-text">Imágenes</span>
            </label>
            <input type="file" required id="image" @change="handleImageUpload" multiple accept="image/*" class="file-input file-input-bordered w-full" />
        
          </div>
          <div class="form-control">
            <label class="label" for="name">
              <span class="label-text">Nombre (Si se conoce)</span>
            </label>
            <input v-model="form.name" type="text" id="name" class="input input-bordered" />
          </div>
          <div class="form-control">
            <label class="label" for="description">
              <span class="label-text">Descripción</span>
            </label>
            <textarea v-model="form.description" id="description" required rows="3" class="textarea textarea-bordered"></textarea>
          </div>
          <div class="form-control">
            <label class="label" for="location">
              <span class="label-text">Ubicación (Nombre de población)</span>
            </label>
            <input v-model="form.location" type="text" id="location" required class="input input-bordered" />
          </div>

          <div v-if="form.status === 'found'" class="form-control">
            <span class="label-text">¿Está vivo?</span>
            <div class="flex flex-row gap-2">
              <label class="label justify-start gap-2">
              <span class="label-text">Si</span>
              <input v-model="form.alive" name="alive" type="radio" id="alive-yes" value="true" class="radio radio-primary" />
            </label>
              <label class="label justify-start gap-2">
                <span class="label-text">No</span>
                <input v-model="form.alive" name="alive" type="radio" id="alive-no" value="false" class="radio radio-primary" />
              </label>
            </div>
          
          </div>

          <div class="form-control">
            <label class="label" for="contact">
              <span class="label-text">Contacto (teléfono, email, instagram, etc..)</span>
            </label>
            <input v-model="form.contact" type="text" id="contact" required class="input input-bordered" />
          </div>

          <div class="form-control">
            <label class="label" for="date">
              <span class="label-text">Fecha</span>
            </label>
            <input v-model="form.date" type="date" id="date" required class="input input-bordered" />
          </div>

          <div class="form-control mt-6">
            <button type="submit" class="btn btn-primary text-gray-50" :disabled="isSubmitting">
             {{ isSubmitting ? 'Registrando...' : 'Registrar Mascota'}}
            </button>
          </div>
        </form>
        
      </div>
      <AlertComponent v-else :alertType="alert.type" :message="alert.message"/>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { XIcon } from 'lucide-vue-next'
import { savePet } from '../../api/index'
import AlertComponent from '../alertComponent.vue';

const isSubmitting = ref(false)

const form = ref({
  type: 'Perro',
  images: [],
  description: '',
  name: '',
  breed: '',
  status: 'lost',
  location: '',
  alive: true,
  contact: '',
  date: ''
})

const alert = ref(null)

const handleImageUpload = (event) => {
  const files = Array.from(event.target.files);
  form.value.images.push(...files)
};

const removeImage = (index) => {
  form.value.images.splice(index, 1)
}

const submitForm = async () => {
  isSubmitting.value = true

  let formData = new FormData();
  
  Object.entries(form.value).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach(file => {
        formData.append(key, file);
      });
    } else {
      formData.append(key, value);
    }
  });

  const response = await savePet(formData);
  
  if (!response || !response.ok) {
   alert.value = {
      type: 'error',
      message: 'Ha ocurrido un error, por favor, inténtelo de nuevo'
   }
  }else {

    alert.value = {
      type: 'success',
      message: 'Se ha registrado correctamente la mascota'
    }
  }
  isSubmitting.value = false
};
</script>