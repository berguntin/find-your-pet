# Plan: moderación automática y búsqueda por imagen

> **Revisión 19/10/2026.** Plan actualizado para la arquitectura hexagonal en Nuxt ([plan de refactorización](./plan-refactorizacion-hexagonal.md)). Cambios respecto a la versión anterior:
> - Los arreglos del antiguo `createPet` ya no aplican: el backend Express ya no existe.
> - La Decisions API está verificada en los tipos del SDK oficial de Node (`openai@7.39.0`). Acepta URLs públicas de imagen, así que no hace falta base64 ni `sharp`.
> - La base de datos empieza vacía, así que la evaluación de embeddings no puede usar datos propios (ver 3.2).
> - La indexación de embeddings va en segundo plano, a través de un outbox.

> **Estado (19/10/2026):** los requisitos previos (sección 1) y la moderación (sección 2) están en `main`. La búsqueda por imagen (sección 3) está implementada en `feat/image-search`, salvo dos puntos que dependen de datos y claves reales: la evaluación del modelo y la calibración del porcentaje (3.2, ver `npm run eval:embeddings`) y el recorte del animal (3.1), que se decidirá con esa evaluación. Hasta entonces la calibración usa valores provisionales (0,6 y 0,95).

> **Añadido el 19/10/2026: búsqueda semántica por texto.** Buscar "perro negro" debe devolver los perros negros aunque el aviso no use esas palabras. Se aprovecha que Gemini Embedding 2 es multimodal: al publicar, se indexan también el texto del aviso (`pet_text_embeddings`). La consulta se compara con los textos y con las fotos, cada comparación con su propia calibración, y la mejor ordena la mascota. Los aciertos por palabra (nombres, teléfonos, pueblos) siguen apareciendo primero. Sin Gemini, o por encima de su rate limit, la búsqueda es por palabras como antes. **Limitación:** es una búsqueda por similitud con un umbral, no un filtro exacto: puede colarse algún perro gris oscuro o faltar alguno con fotos poco claras. Si se necesita un filtro exacto por color, habría que extraer atributos estructurados (especie, colores, tamaño) con un modelo de visión al publicar y filtrar por ellos.

Dos funcionalidades:

1. **Moderación automática** con la OpenAI Decisions API: comprueba que el texto y las imágenes de cada aviso corresponden a una mascota perdida o encontrada.
2. **Búsqueda por imagen**: el usuario sube una foto y ve las mascotas más parecidas, con un porcentaje de coincidencia en cada card.

---

## 1. Requisitos previos

| Requisito | Por qué | Detalle |
|---|---|---|
| **Actualizar `openai` de 4.72 a 7.x** | `client.decisions` solo existe en versiones recientes (verificado en 7.39.0) | Requiere Node ≥ 22 (ya usamos 24) y acepta `zod ^3.25 \|\| ^4`. Es un salto de versión mayor: hay que revisar `OpenAIPetDescriber` (usa `chat.completions`) con sus tests. |
| **Rate limiting** | `describe`, la búsqueda por imagen y la moderación tienen coste por llamada | Puerto `RateLimiter` con adaptador de Upstash Redis (`@upstash/ratelimit`), aplicado en los handlers con coste. En serverless, la memoria de cada instancia no sirve como contador. |
| **Outbox mínimo** (fase 4 del plan de refactorización) | La indexación de embeddings no debe bloquear ni romper el alta | Tabla `outbox`, `EventBus`, proceso inmediato con `event.waitUntil` y reintentos desde un workflow programado de GitHub Actions (ver 5: Vercel Hobby solo permite un cron diario). |

---

## 2. Moderación automática

### 2.1 Dominio (`server/modules/pets/domain/`)

- Nuevo value object `Moderation`: `status: 'approved' | 'pending_review' | 'rejected'`, `scores` y `reviewedAt`.
- **`ModerationPolicy`** (función pura y testeable): convierte las probabilidades en un estado.
  - `is_pet_report ≥ 0.8` y `inappropriate < 0.2` → `approved`.
  - `is_pet_report < 0.3` o `inappropriate ≥ 0.7` → `rejected`.
  - El resto, cualquier `refusal` y cualquier fallo → `pending_review`.
  - Los umbrales son configurables y se ajustarán con datos reales.
- `Pet.report()` recibe el resultado de la moderación. `Pet` expone `isPublic` (aprobada).

### 2.2 Aplicación

- Puerto nuevo **`ContentModerator`**: `review(submission) → ModerationScores | null`, donde `null` significa que no se pudo evaluar.
- **`ReportPet`**:
  1. Valida el dominio.
  2. Modera.
  3. Aplica `ModerationPolicy`.
  4. Si el resultado es `rejected`, lanza un `ValidationError` con `code: 'content_rejected'` y **no guarda nada**.
  5. En otro caso, guarda.
- **Imágenes huérfanas**: con la subida directa, las imágenes ya están en Cloudinary antes del alta. Si se rechaza, hay que borrarlas con un método nuevo `ImageStorage.delete(urls)`. Además, una tarea periódica limpia las imágenes de la carpeta que no estén referenciadas pasadas 24 h (cubre formularios abandonados).
- `ListPets`, `GetPet` y la búsqueda por imagen solo devuelven mascotas `approved`. Al resto solo accede el admin.

### 2.3 Infraestructura

- **`OpenAIDecisionsModerator`** (`infrastructure/`). Una sola llamada a `client.decisions.create` con:
  - `model`: configurable, `gpt-6-luna` por defecto (hoy es el único modelo soportado).
  - `input`: un mensaje con los campos de texto y las imágenes como **URLs de Cloudinary con una transformación reducida** (por ejemplo, insertando `c_limit,w_768`) para gastar menos tokens. Cloudinary sirve las imágenes públicamente, así que no hace falta descargarlas ni codificarlas.
  - `questions` (las respuestas llegan en el mismo orden):
    - `predicate is_pet_report`: ¿es un aviso de una mascota perdida o encontrada?
    - `predicate images_show_animal`: ¿las imágenes muestran un animal o un cartel de mascota?
    - `predicate inappropriate`: ¿contiene spam, contenido ofensivo, contenido sexual o violencia gratuita?
  - `safety_identifier`: un hash anónimo de la IP o, cuando exista el login, del usuario.
  - Hay que tratar las respuestas `type: 'refusal'`: cuentan como `pending_review`.
  - Un timeout corto (≈10 s) y un reintento.
- Migración: columnas `moderation_status`, `moderation_scores jsonb` y `moderated_at` en `pets`, con un índice parcial sobre `moderation_status = 'approved'`. Hay que actualizar el índice del listado.
- Configuración: `NUXT_OPENAI_MODERATION_MODEL` y los umbrales. Sin clave de OpenAI se usa `DisabledContentModerator`, que aprueba todo y deja aviso en el log, para que el desarrollo local funcione.

### 2.4 Revisión manual (admin)

Hasta que haya panel, endpoints protegidos con el token de admin:

- `GET /api/v1/admin/pets?moderation=pending_review`
- `PATCH /api/v1/admin/pets/:id/moderation` con `{ "status": "approved" | "rejected" }`

### 2.5 Frontend

- [`pages/registrar/index.vue`](../frontend/pages/registrar/index.vue): mensajes distintos para `content_rejected` ("no parece un aviso de mascota") y para un aviso pendiente de revisión ("lo revisaremos antes de publicarlo").
- `contracts/pets.ts`: añadir `moderation` a la respuesta del alta (solo `status`, no las puntuaciones) y el nuevo código de error.

### 2.6 Tests

- `ModerationPolicy`: tabla de casos con umbrales, refusals y fallos.
- `ReportPet`: rechazado (no guarda y borra imágenes), pendiente (guarda y queda oculto), fallo del moderador (queda pendiente).
- `OpenAIDecisionsModerator` con un cliente falso, como `OpenAIPetDescriber`: forma de la petición, mapeo de respuestas y refusals.
- HTTP: 422 `content_rejected`, ocultación de pendientes y endpoints de admin.

---

## 3. Búsqueda por imagen

### 3.1 Modelo de embeddings

Un embedding genérico de imagen parecido a otro indica "misma raza y color", no "mismo animal". Dos medidas:

1. **Recortar el animal** antes de calcular el embedding. El fondo varía mucho entre fotos.
   - Opción sin código propio: un recorte inteligente de Cloudinary en la URL (gravity por objeto, por ejemplo `g_auto` o detección de `dog`/`cat`). **Hay que verificar** qué transformaciones incluye nuestro plan de Cloudinary.
   - Si no, un puerto `AnimalDetector`.
2. **Proveedor**, detrás del puerto `ImageEmbedder`:

   | Opción | Ventajas | Inconvenientes |
   |---|---|---|
   | **Gemini Embedding 2** (`gemini-embedding-2-preview`, API) | Multimodal, dimensión configurable (128–3072), funciona en Vercel sin GPU | En preview. Precio sin confirmar en fuente oficial: las fuentes de terceros dan 0,20–0,25 $/1M tokens y ≈0,225 $/1M para imágenes en batch |
   | **DINOv2** (Replicate / Hugging Face Inference) | Suele ser mejor para distinguir ejemplares concretos | Servicio externo aparte, latencia de arranque en frío |

   **Recomendación:** empezar con Gemini Embedding 2 a 768 dimensiones y decidir tras la evaluación.

### 3.2 Evaluación

La base de datos empieza vacía, así que no hay pares "misma mascota" propios. Opciones:

- **Un dataset público de identificación de animales individuales**, por ejemplo PetFace (ECCV 2024). Hay que **verificar su licencia** antes de usarlo.
- Fotos propias: varias fotos por animal de mascotas de conocidos (unas 30–50 mascotas bastan para una primera calibración).

Un script `scripts/eval-embeddings.ts`, que no se despliega, mide recall@1 y recall@5 por proveedor, con y sin recorte, y saca las distribuciones de similitud de pares iguales y distintos para calibrar el porcentaje (3.6).

### 3.3 Dominio y aplicación

- Puertos nuevos:
  - **`ImageEmbedder`**: `embed(image: ImageSource) → number[]`, donde `ImageSource = { url } | { bytes, mimeType }`.
  - **`PetImageIndex`**: `upsert(petId, imageUrl, model, vector)`, `remove(petId)` y `findSimilar(vector, { limit, filters }) → { petId, similarity }[]`.
- **`IndexPetImages`**: un handler del evento `PetReported` (y del aprobado manual) que calcula los embeddings de cada imagen. Es idempotente por `(pet_id, image_url, model)`.
- **`SearchPetsByImage`**: calcula el embedding de la consulta, busca los vecinos, agrupa por mascota quedándose con la mejor similitud y filtra las aprobadas y abiertas. Devuelve `{ pet, match }`.
- **`MatchScore`** (dominio, pura): convierte la similitud en porcentaje con la calibración (tramos lineales entre "claramente distinto" y "claramente el mismo"). Por debajo del mínimo, no se devuelve.
- `DeletePet` también borra los vectores. Con `on delete cascade` basta en Postgres, pero el puerto lo explicita.

### 3.4 Infraestructura

- Migración: `create extension vector`, tabla `pet_image_embeddings` (`pet_id` con `on delete cascade`, `image_url`, `model`, `embedding vector(768)`, `unique (pet_id, image_url, model)`) e índice HNSW con `vector_cosine_ops`. Hay que comprobar que la extensión está activada en Supabase. En local, `compose.yaml` ya usa `pgvector/pgvector:pg17`; en CI, el servicio `postgres:17` debe cambiarse por esa imagen.
- `PostgresPetImageIndex` y `GeminiImageEmbedder`. Para URLs, el adaptador descarga la imagen recortada desde Cloudinary.
- Endpoint **`POST /api/v1/pets/search-by-image`** con `{ image: dataUrl }`, reutilizando la validación de `describePetSchema`. **La foto de búsqueda no se guarda**: solo se calcula su embedding y se descarta. Tiene rate limiting.
- Reindexado: un script que recalcula los embeddings al cambiar de modelo (por eso se guarda la columna `model`).

### 3.5 Frontend

- **[`PetSearchBar.vue`](../frontend/features/search/components/PetSearchBar.vue)**: botón de cámara o subir imagen. Usa `resizeImage` y `blobToDataUrl` de `utils/images.ts`, que ya existen.
- **[`pages/index.vue`](../frontend/pages/index.vue)**: modo "búsqueda por imagen" que sustituye el listado por los resultados ordenados por coincidencia, con un botón para volver.
- **[`PetCard.vue`](../frontend/features/pets/components/PetCard.vue)**: prop opcional `match` con un badge de porcentaje y color por nivel. Hay que cuidar el z-index con los badges actuales.
- `usePetsApi.searchByImage()`, `PetMatchDto` en `contracts/` y textos nuevos en i18n.

### 3.6 Tests

- `MatchScore` y la agrupación por mascota (unitarios).
- `SearchPetsByImage` e `IndexPetImages` con un embedder falso que devuelve vectores fijos.
- `PostgresPetImageIndex` contra Postgres con pgvector (integración; la CI necesita esa imagen).
- HTTP: validación, que solo salgan mascotas aprobadas y abiertas, y la respuesta vacía.

---

## 4. Orden de implementación

1. Requisitos previos: SDK de OpenAI 7.x, rate limiting y outbox mínimo.
2. Moderación completa (2.1–2.6). Es independiente y protege la base de datos desde el primer aviso.
3. Evaluación de embeddings (3.2) con un dataset externo o fotos propias. Elección de proveedor y recorte.
4. Indexación: pgvector, `ImageEmbedder`, `PetImageIndex` e `IndexPetImages` vía outbox.
5. Búsqueda: caso de uso, endpoint y UI.

## 5. Decisiones

Tomadas el 19/10/2026:

- **Avisos `pending_review`**: quedan **ocultos** hasta que un admin los apruebe (2.4).
- **Avisos rechazados**: **no se guardan**. Se devuelve el error y se borran sus imágenes de Cloudinary (2.2).
- **Rate limiting**: **Upstash Redis**. Hace falta crear la base de datos y añadir `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` en Vercel.
- **Plan de Vercel: Hobby.** El cron de Vercel solo puede ejecutarse a diario, así que:
  - El outbox se procesa en el momento con `event.waitUntil` después de responder.
  - Para los reintentos, un **workflow programado de GitHub Actions** (gratis, cada 15 min) llama a un endpoint interno `POST /api/internal/outbox/process` protegido con un secreto. El cron diario de Vercel queda como respaldo.

Pendientes:

- **Proveedor de embeddings y dataset de evaluación** (3.1 y 3.2). Se decide en el paso 3, con datos.

## Fuentes

- SDK oficial `openai@7.39.0` (npm), `resources/decisions.d.ts`: forma de la petición y la respuesta, modelos soportados e imágenes por URL.
- [DataCamp – OpenAI Decisions API tutorial](https://www.datacamp.com/tutorial/open-ai-decisions-api-tutorial) y [Apidog – How to use the OpenAI Decisions API](https://apidog.com/blog/how-to-use-openai-decisions-api/): estado beta y precio (0,10 $/1M tokens de entrada, salida sin coste). No confirmado en fuente oficial.
- [OpenRouter – Gemini Embedding 2](https://openrouter.ai/google/gemini-embedding-2), [OpenRouter – batch](https://openrouter.ai/google/gemini-embedding-2:batch) y [NYU Shanghai RITS](https://rits.shanghai.nyu.edu/ai/google-launches-gemini-embedding-2-its-first-multimodal-embedding-model/): precios y dimensiones de terceros.
- [Roboflow – DINOv2 vs CLIP](https://playground.roboflow.com/models/compare/dinov2-vs-openai-clip) y [arXiv 2411.18807](https://arxiv.org/pdf/2411.18807).
