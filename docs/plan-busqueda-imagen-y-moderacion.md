# Plan: búsqueda por imagen y moderación automática

Dos funcionalidades nuevas para Find Your Pet:

1. **Búsqueda de mascotas por imagen**: el usuario sube una foto y se muestran las mascotas más parecidas, con un porcentaje de coincidencia en cada card.
2. **Moderación automática de contenido** con la OpenAI Decisions API: se comprueba que el texto y las imágenes de cada aviso corresponden a una mascota perdida o encontrada.

Ambas dependen del flujo de alta (`createPet`), que tiene bugs que conviene arreglar primero.

> **Nota:** este plan se implementa en la fase 5 del [plan de refactorización](./plan-refactorizacion-hexagonal.md). Las rutas `backend/src/...` pasan a `server/modules/pets/...` (por ejemplo, `services/embeddings.js` será el adaptador del puerto `ImageEmbedder`), multer se sustituye por la subida directa a Cloudinary y los cambios de esquema van como migraciones en `server/db/migrations/`.

---

## 0. Arreglos previos

Archivo: [`backend/src/controllers/pets.js`](../backend/src/controllers/pets.js)

- `createPet` tiene `to_jsonb(images)` dentro de la lista de columnas del `INSERT`. Eso es SQL inválido.
- `createPet` devuelve `id` sin haberlo definido. Hay que añadir `RETURNING id` al `INSERT`.
- Las imágenes se guardan como un string JSON dentro de una columna JSONB, codificadas dos veces (se ve en `backend/db/init.d/pets.csv`). `getAllPets` lo compensa con `JSON.parse` y `getPetById` no. Hay que normalizarlo con una migración que convierta los valores a un array JSONB real y quitar el `JSON.parse`.
- `GET /pets` usa `SELECT *`. Cuando existan las columnas de moderación habrá que listar las columnas a mano (los embeddings irán en otra tabla).

---

## 1. Búsqueda por imagen

### 1.1 Elección del modelo

Un embedding genérico de imagen (CLIP o similar) parecido a otro indica "misma raza y color", no "mismo animal". Para reconocer al individuo:

1. **Recortar el animal** antes de calcular el embedding. Si no, el fondo, que en estas fotos cambia mucho, pesa demasiado en el resultado. Se puede hacer con un detector ligero o pidiendo la caja delimitadora al modelo de visión que ya se usa en `frontend/server/api/chat-gpt.ts`.
2. **Calcular el embedding del recorte.** Candidatos:

   | Opción | Ventajas | Inconvenientes |
   |---|---|---|
   | **Gemini Embedding 2** (API, multimodal) | Barato (~0,25 $/1M tokens según una fuente no confirmada), funciona en Vercel sin GPU, sin mantenimiento | Modelo genérico; confirmar el precio por imagen |
   | **DINOv2** (autoalojado o Replicate / Hugging Face) | Suele ser mejor que CLIP para comparar ejemplares concretos | El backend está en Vercel (`vercel.json`) y ahí no puede ejecutar el modelo. Necesita un servicio aparte |

   **Recomendación:** empezar con Gemini Embedding 2 y decidir tras la evaluación (1.2). El proveedor irá detrás de una interfaz `embedImage(buffer) → number[]` para poder cambiarlo sin tocar el resto.

### 1.2 Evaluación con datos propios

Las mascotas que tienen varias fotos en la BD ya forman pares de "mismo animal". Un script (`backend/scripts/eval-embeddings.js`):

- Usa una foto de cada mascota como consulta y el resto como índice.
- Mide recall@1 y recall@5 de cada modelo candidato.
- Saca la distribución de similitudes de pares iguales y distintos para calibrar el porcentaje de coincidencia (1.5).

### 1.3 Base de datos (pgvector)

Supabase admite pgvector. En local, `compose.yaml` debe usar la imagen `pgvector/pgvector` en lugar de `postgres`. La migración se aplica en `backend/db/init.d/init.sql` y en `backend/src/database/schema.sql`.

```sql
create extension if not exists vector;

create table pet_image_embeddings (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid references pets(id) on delete cascade,
  image_url text not null,
  model text not null,              -- para poder re-embeber al cambiar de modelo
  embedding vector(<dim>) not null
);

create index on pet_image_embeddings using hnsw (embedding vector_cosine_ops);
```

### 1.4 Backend

- **`backend/src/services/embeddings.js`**: recorte y embedding a partir del buffer que entrega multer.
- **`createPet`**: después de subir a Cloudinary, calcula un embedding por imagen y lo inserta en `pet_image_embeddings`. Si el embedding falla, el alta **no** debe fallar. Se registra para reintento.
- **`POST /api/pets/search-by-image`** (multer, una imagen):
  1. Calcula el embedding de la consulta.
  2. Busca los K vecinos más cercanos con el índice HNSW.
  3. Agrupa por mascota quedándose con su mejor imagen (`max(1 - distancia)`).
  4. Devuelve `{ ...pet, match }`, ordenado por `match` de mayor a menor, filtrando las mascotas no aprobadas (ver 2).
- **`backend/scripts/backfill-embeddings.js`**: genera los embeddings de las mascotas existentes a partir de las URLs de Cloudinary.

### 1.5 Porcentaje de coincidencia

La similitud coseno no es una probabilidad. Se convierte a porcentaje con los umbrales sacados de la evaluación (1.2), por ejemplo una función lineal por tramos entre "claramente distinto" y "claramente el mismo". Los resultados por debajo de un mínimo no se muestran.

### 1.6 Frontend

- **[`AppSearch.vue`](../frontend/components/AppSearch.vue)**: botón de cámara/subir imagen. El redimensionado con canvas de [`chatGptUtils.ts`](../frontend/utils/chatGptUtils.ts) se saca a una función propia y se reutiliza.
- **[`pages/index.vue`](../frontend/pages/index.vue)**: estado "búsqueda por imagen" que sustituye la lista filtrada por los resultados ordenados por `match`, con un botón para volver a la lista normal.
- **[`CardPet.vue`](../frontend/components/CardPet.vue)**: prop opcional `match` que muestra un badge con el porcentaje y un color según el nivel (alto, medio, bajo). Hay que cuidar el z-index y la posición respecto a los badges actuales (estado y "reunido con su familia").
- **Tipos e i18n**: `match?: number` en `types/Pet.ts` y textos nuevos en `i18n.config.ts`.

---

## 2. Moderación automática (OpenAI Decisions API)

> **Comprobar antes de empezar.** Toda la información sobre la Decisions API viene de un tutorial de terceros (DataCamp, 13/10/2026). No he encontrado documentación oficial. Según ese tutorial: está en beta pública, solo admite el modelo `gpt-6-luna`, cobra 0,10 $/1M tokens de entrada y no cobra los de salida, acepta imágenes como `input_image` y los tipos de pregunta son `predicate`, `choice` y `score`. El tutorial solo trae ejemplos en Python. Hay que comprobar que el SDK `openai` de Node incluye `client.decisions` y en qué versión.

### 2.1 Backend

Archivo nuevo: `backend/src/services/moderation.js`. Se ejecuta en `createPet` **antes** de subir a Cloudinary, para que lo rechazado no llegue a guardarse.

- **Entrada**: los campos de texto (tipo, descripción, nombre, ubicación, contacto) y las imágenes redimensionadas en base64. Para redimensionar se añade la dependencia `sharp`.
- **Preguntas**:
  - `predicate is_pet_report`: ¿es un aviso de una mascota perdida o encontrada?
  - `predicate images_show_animal`: ¿las imágenes muestran un animal? Si hace falta, se pregunta imagen por imagen.
  - `predicate inappropriate`: spam, contenido ofensivo o datos de terceros. Se puede complementar con `omni-moderation-latest`, el endpoint de moderación específico de OpenAI.
- **Decisión por umbrales** (ajustables por variable de entorno):
  - Confianza alta → `approved`.
  - Zona intermedia → `pending_review`.
  - Confianza baja → `rejected`, con un 422 y un mensaje para el usuario.
- **Fallos**: si la API falla o se pasa del timeout, `pending_review` en lugar de rechazar.
- **Columnas nuevas en `pets`**:
  ```sql
  alter table pets
    add column moderation_status text not null default 'approved'
      check (moderation_status in ('approved', 'pending_review', 'rejected')),
    add column moderation_scores jsonb,
    add column moderated_at timestamp with time zone;
  ```
  Las mascotas existentes quedan como `approved` por el valor por defecto. `getAllPets`, `getPetById` y `search-by-image` solo devuelven las `approved`.
- **Configuración**: nueva variable `OPENAI_API_KEY` en `backend/.env.example`. Hoy la clave solo está en el frontend (`NUXT_OPENAI_KEY`).

### 2.2 Frontend

- **[`pages/registrar/index.vue`](../frontend/pages/registrar/index.vue)**: mensajes distintos para "rechazado" (con el motivo) y "pendiente de revisión".

---

## 3. Orden de implementación

1. Arreglos del punto 0 y migración de imágenes.
2. Moderación (punto 2). Es independiente y protege la BD antes de rellenarla con embeddings.
3. pgvector, servicio de embeddings, embeddings en el alta y backfill (1.3, 1.4).
4. Script de evaluación, elección de modelo y calibración del porcentaje (1.2, 1.5).
5. Endpoint de búsqueda y UI (1.4, 1.6).

## 4. Decisiones pendientes

- **Proveedor de embeddings**: Gemini Embedding 2 por API o DINOv2 en un servicio aparte. Recomendación: empezar con Gemini y decidir tras la evaluación.
- **Avisos `pending_review`**: si se publican igualmente o quedan ocultos hasta revisión manual. Hoy no hay panel de administración.

## Fuentes

- [DataCamp – OpenAI Decisions API tutorial](https://www.datacamp.com/tutorial/open-ai-decisions-api-tutorial)
- [PromptLayer – OpenAI Moderation API](https://www.promptlayer.com/glossary/openai-moderation-api)
- [Gemini Embedding 2 (NYU Shanghai RITS)](https://rits.shanghai.nyu.edu/ai/google-launches-gemini-embedding-2-its-first-multimodal-embedding-model/)
- [Roboflow – DINOv2 vs CLIP](https://playground.roboflow.com/models/compare/dinov2-vs-openai-clip)
- [arXiv 2411.18807](https://arxiv.org/pdf/2411.18807)
