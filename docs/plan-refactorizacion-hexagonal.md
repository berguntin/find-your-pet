# Plan: refactorización a arquitectura hexagonal en Nuxt

Objetivo: unificar frontend y backend en una sola aplicación **Nuxt** (servidor Nitro) con un **monolito modular** y **arquitectura hexagonal** en cada módulo. La migración es gradual: los endpoints actuales siguen funcionando mientras se reescriben por dentro.

Funcionalidades futuras que condicionan la arquitectura:

1. Login con Google.
2. Notificaciones por email sobre actualizaciones de tu mascota.
3. Publicidad con Google AdSense.
4. Marcar mascotas como encontradas: si varios usuarios lo marcan, se da por encontrada; si lo marca quien la publicó, se marca directamente.
5. Panel del usuario con sus mascotas publicadas.

Relacionado: [plan de búsqueda por imagen y moderación](./plan-busqueda-imagen-y-moderacion.md). Se implementa sobre esta base (fase 5).

---

## 1. Decisión: todo en Nuxt

El backend Express (`backend/`) se sustituye por el servidor de Nuxt (`server/`).

**Por qué:**

- El backend es pequeño (5 endpoints). Pasarlo a TypeScript y hexagonal ya implicaba reescribirlo.
- Un solo despliegue en Vercel. Desaparecen el proxy `frontend/server/api/[...].ts`, la configuración de CORS (`backend/src/config/cors.js`) y el subdominio `api.`.
- Login con Google en el mismo origen con `nuxt-auth-utils`: OAuth y sesión en cookie sellada, sin pasar JWT entre dominios.
- Tipos compartidos entre cliente y servidor. Se acaba la duplicación de `types/`.
- Ya hay lógica de servidor en Nuxt (`server/api/chat-gpt.ts`). Todo queda en un mismo sitio.
- Tareas programadas de Nitro o Vercel Cron para el outbox de notificaciones.

**Lo que hay que vigilar:**

- **Que Nuxt no se cuele en el dominio.** Los auto-imports de Nitro (`useRuntimeConfig`, `defineEventHandler`, `readBody`...) solo se usan en `infrastructure/` y en los handlers de `server/api/`. `domain/` y `application/` son TypeScript puro, testeable con Vitest sin Nuxt y extraíble a otro servicio si algún día hiciera falta. Una regla de ESLint (`no-restricted-imports` o `eslint-plugin-boundaries`) lo hace cumplir.
- **Límite de 4,5 MB por petición en las funciones de Vercel.** Ya existe hoy, y 10 imágenes de 5 MB no caben. El navegador sube **directamente a Cloudinary** con una firma generada en el servidor (`POST /api/v1/uploads/signature`), y el servidor recibe solo las URLs. Para moderación y embeddings, el servidor descarga la imagen desde Cloudinary con una transformación reducida. Esto sustituye a multer.
- **Frontend y API escalan juntos.** No es un problema para el tráfico actual. Si en el futuro hubiera una app móvil, `server/api/v1` sigue siendo una API pública válida.

**Cuándo no sería la opción correcta:** con equipos separados de front y back, con procesos largos permanentes (colas pesadas, ML autoalojado) o con varios clientes grandes consumiendo la API. Si se elige DINOv2 para la búsqueda por imagen, iría como un servicio aparte detrás del puerto `ImageEmbedder`, y la decisión no cambia.

---

## 2. Problemas actuales

- **`PUT /pets/:id` y `DELETE /pets/:id` no tienen autenticación**: cualquiera puede modificar o borrar un aviso. Hay que cerrarlos en la fase 1.
- La lógica está mezclada en los controladores: SQL, Cloudinary y HTTP en la misma función, sin validar la entrada.
- Bugs en `createPet`: `to_jsonb(images)` en la lista de columnas del `INSERT` (SQL inválido), `id` sin definir en la respuesta, e imágenes guardadas como string JSON dentro de una columna JSONB.
- `GET /pets` devuelve toda la tabla y se filtra en el cliente (`pages/index.vue`). No escala.
- `savePet` está definido dentro de `pages/registrar/index.vue`. Las páginas llaman a `useFetch` con URLs sueltas.
- El esquema está duplicado en `backend/db/init.d/init.sql` y `backend/src/database/schema.sql`, y no hay herramienta de migraciones.
- Dependencias sin usar en el backend (`mysql2`, `pg`, `uuid`, `@supabase/supabase-js`) y un `backend/index.js` huérfano.
- `backend/Dockerfile` copia `.env` dentro de la imagen.
- Sin tests, sin lint en el backend y sin CI.

---

## 3. Arquitectura objetivo

### 3.1 Estructura

Al terminar la migración, `frontend/` pasa a ser la raíz de la aplicación (o se renombra a `app/`).

```
server/
  modules/
    pets/
      domain/            Pet (agregado), PetType, ReportType, Resolution,
                         Contact, Location (value objects)
                         FoundReport, FoundResolutionPolicy
                         eventos: PetReported, PetMarkedAsFound, PetResolved, PetUpdated
      application/       casos de uso: ReportPet, ListPets, GetPet, UpdatePet,
                         DeletePet, MarkPetAsFound, ListMyPets, SearchPetsByImage
                         puertos: PetRepository, ImageStorage, ImageEmbedder,
                         ContentModerator, PetDescriber
      infrastructure/    PostgresPetRepository, CloudinaryImageStorage,
                         OpenAIPetDescriber, OpenAIContentModerator,
                         GeminiImageEmbedder, InMemoryPetRepository (tests)
    users/
      domain/            User, AuthIdentity
      application/       FindOrCreateUserFromGoogle, GetCurrentUser
                         puertos: UserRepository
      infrastructure/    PostgresUserRepository
    notifications/
      domain/            Subscription, NotificationPreference
      application/       handlers de eventos (OnPetResolved → NotifyOwner...)
                         puertos: EmailSender, SubscriptionRepository
      infrastructure/    ResendEmailSender (o SES), plantillas
  shared/
    domain/              DomainEvent, DomainError, Result, Id
    application/         EventBus, UnitOfWork, Clock
    infrastructure/      config (env validado con zod), db (postgres.js),
                         logger (pino), outbox, mapeo de errores a HTTP
  container.ts           composition root: conecta adaptadores con puertos
  api/
    v1/pets/             index.get.ts, index.post.ts, [id].get.ts, [id].patch.ts,
                         [id].delete.ts, [id]/found-reports.post.ts,
                         search-by-image.post.ts
    v1/me/pets.get.ts
    v1/uploads/signature.post.ts
    auth/google.get.ts   nuxt-auth-utils
  middleware/            sesión, rate limiting
  tasks/                 worker del outbox
  db/
    migrations/
    seeds/               pets.csv

features/                UI por funcionalidad
  pets/                  componentes, composables (usePetsApi), tipos de vista
  auth/
  dashboard/
  ads/                   AdSlot, integración con el CMP
pages/ · layouts/ · components/ (solo componentes genéricos)
shared/                  tipos y esquemas zod compartidos cliente/servidor (DTOs)
```

### 3.2 Reglas de dependencia

- `domain` no importa nada externo: ni Nuxt, ni h3, ni librerías de infraestructura.
- `application` importa solo `domain` y define los puertos (interfaces).
- `infrastructure` implementa los puertos. Es la única capa que conoce Postgres, Cloudinary, OpenAI, etc.
- Los handlers de `server/api/` son adaptadores HTTP: validan con zod, obtienen el usuario de la sesión, llaman a un caso de uso y mapean el resultado o error a HTTP. Sin lógica de negocio.
- Los módulos se comunican **por eventos de dominio o por casos de uso públicos**, nunca leyendo las tablas de otro módulo.
- Inyección de dependencias manual en `container.ts`. Sin frameworks de DI.

### 3.3 Modelo de estado de una mascota

Hoy `status` (`lost`/`found`) indica el *tipo de aviso* y `atHome` indica que el animal ya está en casa. "Marcar como encontrada" encaja con `atHome`, no con `status: 'found'`. Hay que separarlo antes de que el login y las notificaciones dependan de ello:

| Campo actual | Campo nuevo | Valores |
|---|---|---|
| `status` | `report_type` | `lost` · `found` |
| `athome` | `resolution` | `open` · `reunited` |
| — | `resolved_by` | `owner` · `community` · `null` |
| — | `resolved_at` | timestamp |
| `created_by` (`'web'`) | `owner_id` | uuid *nullable*: los avisos anónimos existentes siguen siendo válidos |

La migración convierte `athome = true` en `resolution = 'reunited'`. El contrato HTTP de `v0` (`/api/pets`) se mantiene con un mapeo temporal mientras el frontend migra.

---

## 4. Cómo encaja cada funcionalidad futura

| Funcionalidad | Qué prepara la arquitectura |
|---|---|
| **1. Login con Google** | `nuxt-auth-utils` con el proveedor Google. En el callback se llama a `FindOrCreateUserFromGoogle` (módulo `users`). Un middleware deja `currentUser` disponible en los handlers, que lo pasan a los casos de uso. Tablas `users` y `auth_identities` (proveedor + subject), y `pets.owner_id`. |
| **2. Emails sobre tu mascota** | Los casos de uso emiten eventos (`PetMarkedAsFound`, `PetResolved`...) que se guardan en una **tabla outbox** en la misma transacción. Un worker (`server/tasks/` con Vercel Cron) los procesa y los entrega a los handlers del módulo `notifications`, que usan el puerto `EmailSender`. Reintentos e idempotencia por id de evento. El mismo mecanismo sirve para reintentar los embeddings del plan de búsqueda por imagen. |
| **3. AdSense** | Solo frontend: componente `AdSlot` en `features/ads` y un **CMP certificado** (gestor de consentimiento), que Google exige en la UE. Actualizar `content/politica-de-privacidad.md`. No toca el servidor. |
| **4. Marcar como encontrada** | `POST /api/v1/pets/:id/found-reports` llama al caso de uso `MarkPetAsFound`. Regla de dominio en el agregado `Pet` con `FoundResolutionPolicy`: si lo marca el dueño, `resolution = reunited` y `resolved_by = owner`; si no, se añade un `FoundReport`, y al llegar a N usuarios distintos, `resolved_by = community`. Tabla `pet_found_reports (pet_id, user_id, created_at, unique(pet_id, user_id))`. El umbral N se configura. Requiere login para evitar abusos. Se testea con tests unitarios puros. |
| **5. Panel de usuario** | Caso de uso `ListMyPets(currentUser)` y `GET /api/v1/me/pets`. Página `/panel` protegida por middleware de ruta de Nuxt, en `features/dashboard`. Desde el panel, el dueño edita, marca como reunida o borra (`UpdatePet` y `DeletePet` comprueban la propiedad en el dominio). |

---

## 5. Transversal

- **TypeScript** con `strict` en todo el proyecto. ESLint (con reglas de límites entre capas) y Prettier.
- **Migraciones** con `node-pg-migrate` o `dbmate` en `server/db/migrations/`, como única fuente del esquema. El seed se carga desde `pets.csv`. Se eliminan `init.sql` y `schema.sql` duplicados.
- **Validación** con zod en la entrada de cada handler y en la configuración (`shared/infrastructure/config`). Los esquemas de DTOs viven en `shared/` y los reutiliza el formulario del cliente.
- **API versionada** (`/api/v1`) con errores en formato uniforme (`{ error: { code, message, details } }`) y documentación OpenAPI (Nitro tiene soporte experimental).
- **Paginación y filtros en el servidor**: `?reportType=&resolution=&location=&q=&cursor=&limit=`, con índices en las columnas filtradas.
- **Seguridad**: rate limiting en altas, marcados y búsqueda por imagen; cabeceras con `nuxt-security`; firma de subida a Cloudinary limitada en tamaño, formato y carpeta.
- **Tests**:
  - Unitarios (Vitest) de dominio y casos de uso, con adaptadores en memoria.
  - De integración de los repositorios Postgres con Testcontainers.
  - e2e de API con `@nuxt/test-utils`, y algunos e2e de UI con Playwright.
- **CI en GitHub Actions**: lint, tipos, tests y build en cada PR.
- **Observabilidad**: logs estructurados (pino) y Sentry.
- **Docker**: `compose.yaml` con Nuxt y Postgres (`pgvector/pgvector`). El `.env` se pasa por `env_file`, nunca se copia a la imagen.

---

## 6. Fases

### Fase 1: base técnica
- TypeScript estricto, ESLint con límites entre capas, Prettier, Vitest y CI.
- Herramienta de migraciones; migración inicial equivalente al esquema actual, más la normalización de `images` a un array JSONB real.
- Config validada con zod, logger y mapeo de errores.
- En el backend Express actual: cerrar `PUT` y `DELETE` (token de admin por variable de entorno), corregir los bugs de `createPet`, limpiar dependencias y el `Dockerfile`.

### Fase 2: módulo `pets` hexagonal en `server/`
- Dominio, casos de uso y adaptadores de los 5 endpoints actuales, con tests.
- Handlers en `server/api/pets/` con **el mismo contrato** que Express, para que el frontend no cambie. Se elimina el proxy `[...].ts` y se apaga el backend Express. Se borra `backend/`.
- Subida directa a Cloudinary con firma.
- `server/api/chat-gpt.ts` pasa a ser el puerto `PetDescriber` y un handler fino.

### Fase 3: frontend
- Capa de API tipada (`features/pets/usePetsApi`) con los DTOs de `shared/`.
- Rutas `/api/v1`, paginación y filtros en servidor.
- Organización por `features/`.
- Migración del modelo de estado (3.3) y retirada del contrato antiguo.

### Fase 4: infraestructura de eventos
- `EventBus`, tabla outbox, worker en `server/tasks/` con Vercel Cron, reintentos e idempotencia.

### Fase 5: moderación y búsqueda por imagen
- [Plan correspondiente](./plan-busqueda-imagen-y-moderacion.md), implementado como adaptadores de `ContentModerator` e `ImageEmbedder` en el módulo `pets`.

### Fase 6: funcionalidades futuras
Orden: **1 → 5 → 4 → 2 → 3**.
1. Login con Google: módulo `users` y `owner_id`.
2. Panel de usuario.
3. Marcar como encontrada.
4. Notificaciones por email: módulo `notifications` sobre el outbox.
5. AdSense y CMP.

El login desbloquea el panel, los marcados y las notificaciones. AdSense es independiente y puede adelantarse si interesa por negocio.

---

## 7. Decisiones pendientes

- **Umbral N** de marcados de la comunidad para dar una mascota por encontrada, y si los marcados caducan.
- **Proveedor de email**: Resend, SES o Postmark.
- **Auth**: `nuxt-auth-utils` (sesión propia, recomendado) o Supabase Auth (si se quiere delegar también la gestión de usuarios).
- **Avisos anónimos**: si se siguen permitiendo después del login o se exige cuenta para publicar. Con cuenta, la moderación y los marcados son más fiables.
