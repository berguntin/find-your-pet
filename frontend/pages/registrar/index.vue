<template>
  <div class="min-h-screen rounded-sm bg-base-50 p-4 mb-5">
    <div class="max-w-md mx-auto">
      <h1 class="text-4xl font-bold text-center mb-8">Registrar Mascota</h1>
      <div v-if="!alert" class="card bg-base-150 shadow-xl">
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
            <div v-if="chatGptStatus === 'LOADING'" class="flex justify-center items-center">
              <div class="loader"></div>
            </div>
            <textarea v-else v-model="form.description" id="description" required
              class="textarea textarea-bordered w-full"></textarea>
          </div>

          <div class="form-control">
            <label class="label" for="date">
              <span class="label-text">Fecha</span>
            </label>
            <input v-model="form.date" type="date" id="date" :max="maxDate" required class="input input-bordered" />
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
                  <input v-model="form.alive" name="alive" type="radio" id="alive-yes" :value="true" class="radio radio-primary" />
              </label>
              <label class="label justify-start gap-2">
                <span class="label-text">No</span>
                  <input v-model="form.alive" name="alive" type="radio" id="alive-no" :value="false" class="radio radio-primary" />
              </label>
            </div>
          </div>

          <div class="form-control">
            <label class="label" for="contact">
              <span class="label-text">Contacto (teléfono, email, instagram, etc..)</span>
            </label>
            <input v-model="form.contact" type="text" id="contact" required class="input input-bordered" />
          </div>

          <div class="form-control mt-6">
            <button type="submit" class="btn btn-primary text-gray-50" :disabled="isSubmitting">
                {{ isSubmitting ? 'Registrando...' : 'Registrar Mascota' }}
            </button>
          </div>
        </form>
      </div>
      <AlertComponent v-else :alertType="alert.type" :message="alert.message" />
    </div>
  </div>
</template>

<script setup lang="ts">

import type { CreatePetFormData } from "~/types/CreatePetFromData";
import type { UseFetchOptions } from "nuxt/app";
import AlertComponent from "~/components/AlertComponent.vue";
import { getChatGPTDescription } from '~/utils/chatGptUtils';

interface Alert {
    type: 'error' | 'success';
  message: string;
}

  const isSubmitting = ref(false)

const form = ref<CreatePetFormData>({
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

  const alert = ref<Alert | null>(null)

const maxDate = computed(() => new Date().toISOString().split('T')[0])
let chatGptStatus = ref("NOT_DONE");

const handleImageUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.files) {
    const files = Array.from(target.files);
    form.value.images.push(...files);

    await chatGpt(files[0])
  }
};

const chatGpt = async (file: File) => {
  // Chat GPT
  if (chatGptStatus.value == "NOT_DONE") {
    chatGptStatus.value = "LOADING";
    try {
      const description = await getChatGPTDescription(file, form.value.type ?? 'Otro');
      form.value.description = description;
      chatGptStatus.value = "FINISH";
    } catch (error) {
      chatGptStatus.value = "NOT_DONE";
      console.error('Error fetching description:', error);
    }
  }
};

const submitForm = async () => {
    isSubmitting.value = true

  let formData = new FormData();

  Object.entries(form.value).forEach(([key, value]) => {
    if (Array.isArray(value)) {
        value.forEach(file => {
        formData.append(key, file);
      });
    } else {
      formData.append(key, value.toString());
    }
  });

  try {
    const response = await savePet(formData);

    if (!response || !response.ok) {
      alert.value = {
          type: 'error',
          message: 'Ha ocurrido un error, por favor, inténtelo de nuevo'
        }
    } else {
      alert.value = {
          type: 'success',
          message: 'Se ha registrado correctamente la mascota'
        }
    }
  } catch (error) {
      
    alert.value = {
        type: 'error',
        message: 'Ha ocurrido un error, por favor, inténtelo de nuevo'
      }
  } finally {
      isSubmitting.value = false
  }
};




async function savePet(formData: FormData): Promise<ApiResponse> {
  const config: UseFetchOptions<ApiResponse> = {
    method: 'POST',
    body: formData,
  }

  try {
    const { data, error } = await useFetch<ApiResponse>('/api/pets', config)

    if (error.value) {
      console.error('Error saving pet:', error.value)
      return { ok: false, error: error.value.message }
    }

    if (!data.value) {
      return { ok: false, error: 'No data received from server' }
    }

    return { ok: true, data: data.value }
  } catch (e) {
    console.error('Unexpected error:', e)
    return { ok: false, error: 'An unexpected error occurred' }
  }
}
</script>

<style>
.loader {
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-left-color: #000;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
