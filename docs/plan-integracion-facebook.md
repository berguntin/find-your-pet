# Plan: integración con Facebook

> **Estado (20/10/2026):** propuesta, sin implementar.

Los grupos de Facebook de mascotas perdidas son una de las mayores fuentes de avisos. Este plan cubre dos integraciones:

1. **Importar posts de Facebook** (sección 2): cualquiera puede traer a nuestra web un post que ha visto en un grupo. El post se compara con las mascotas publicadas y queda indexado para que otros lo encuentren.
2. **Publicar en una Página de Facebook propia** (sección 3): cada mascota que se publica en la web se publica también en nuestra Página. Desde ahí, los administradores y los usuarios la comparten en los grupos.

La primera trae avisos de Facebook a la web. La segunda lleva avisos de la web a Facebook.

---

## 1. Restricciones de partida

| Restricción | Consecuencia |
|---|---|
| **Meta eliminó la Groups API** en abril de 2024 (Graph API v19). | No se puede leer el contenido de un grupo por API, ni siquiera como administrador. Tampoco se puede publicar en grupos por API. |
| **Scraping:** los grupos exigen iniciar sesión, y automatizar esa sesión va contra los términos de Meta. | No se hace scraping. Nuestro servidor tampoco puede leer un post a partir de su URL: Facebook devuelve la pantalla de inicio de sesión. Por eso **la foto y el texto los aporta el usuario**; la URL sirve solo de referencia. |
| **RGPD:** los posts contienen datos de terceros (nombre del autor, teléfonos, caras). | Solo se guardan los datos del animal. Nunca se guardan el contacto, el nombre del autor ni capturas con la interfaz de Facebook (ver 2.4). |
| **No hay login todavía.** | No podemos avisar al dueño de una mascota cuando aparece una coincidencia. De momento, la coincidencia se muestra a quien importa el post y en las fichas (ver 2.5). Las notificaciones llegarán con el login. |

---

## 2. Importar posts de Facebook

### 2.1 Flujo de usuario

1. El usuario ve un post en un grupo y lo trae a la web de una de estas formas:
   - **Móvil:** guarda la foto del animal y la comparte con "Find your pet" desde la galería. Esto usa *Web Share Target* (2.6), que requiere que la web esté instalada como PWA.
   - **Cualquier dispositivo:** abre `/importar` y sube la foto.
   - En los dos casos puede **pegar el enlace al post** y su texto. El enlace es obligatorio, porque es la forma de contactar.
2. Si la foto es una captura de pantalla, el usuario **recorta el animal**. Para fotos que vienen de compartir, el paso de recorte es obligatorio. Recortar mejora mucho los embeddings y elimina los nombres y la interfaz de Facebook.
3. Mientras tanto, en paralelo:
   - `DescribePetFromImage` rellena especie y descripción (solo rasgos físicos, como ya hace).
   - Un extractor de texto, que reutiliza `OpenAIPetDescriber` con otro prompt, saca del texto pegado el tipo de aviso, la zona y la fecha. **Ignora el contacto.**
   - `SearchPetsByImage` busca mascotas parecidas, igual que en el alta.
4. El usuario revisa los datos y confirma.
5. Ve las coincidencias, con prioridad para las del tipo contrario: si importa un perro encontrado, primero los perdidos. Cada coincidencia lleva un enlace para que el usuario avise en el post de Facebook o al autor de nuestro aviso.

Si el enlace ya se había importado, no se crea nada nuevo: se muestra el aviso existente.

### 2.2 Dominio

El aviso importado **es un `Pet`**, no una entidad aparte. Así hereda moderación, indexación, búsqueda por texto e imagen, la ficha y el aviso de mascotas parecidas, sin duplicar nada.

- Nuevo value object **`PetOrigin`**:
  - `{ kind: 'direct' }`: avisos creados en la web, el caso actual.
  - `{ kind: 'facebook', url }`: avisos importados.
- **`FacebookPostUrl`** (value object): valida y normaliza la URL.
  - Hosts admitidos: `facebook.com`, `www.`, `m.`, `web.` y `fb.com`.
  - Quita los parámetros de seguimiento (`mibextid`, `rdid`, `__cft__`, etc.).
  - Normaliza el formato a `https://www.facebook.com/...`.
  - La URL normalizada sirve de clave para detectar duplicados.
- **`contact` pasa a ser opcional**, pero solo para los importados: `Pet.import()` lo deja en `null` y `Pet.report()` lo sigue exigiendo. En la ficha, el contacto de un importado es "Ver el post original en Facebook".
- **Caducidad:** un importado abierto caduca a los **60 días** (configurable). Sin contacto directo, un aviso antiguo es más ruido que ayuda. Uno directo no caduca.
- `MarkPetAsReunited` funciona igual en los dos casos.

### 2.3 Aplicación

- **`ImportPetFromFacebook`** (caso de uso):
  1. Valida y normaliza la URL.
  2. Si la URL ya existe, devuelve el aviso existente sin crear nada.
  3. Construye el `Pet` con `Pet.import()`.
  4. Modera. Usa el mismo `ContentModerator` con una pregunta más (ver 2.4).
  5. Guarda y publica `pet.published` si queda aprobado. La indexación ya cuelga de ese evento.
- **`PetRepository.findByOrigin(url)`** para detectar duplicados.
- **`ExpireImportedPets`**: lo lanza el workflow nocturno.
  - Borra los importados abiertos que han pasado su caducidad, junto con sus imágenes y vectores.
  - Borrar, y no solo ocultar, es lo que pide el RGPD: no guardamos lo que ya no sirve.
- **Detección de duplicados entre importados y directos:** si la foto importada se parece un ≥ 95 % a un aviso ya publicado, se avisa al usuario de que "ya está publicado" antes de confirmar. Reutiliza `SearchPetsByImage`.
- Rate limit propio, `RATE_LIMITS.import`, más estricto que el del alta.

### 2.4 Privacidad y moderación

- **Datos que no se guardan:**
  - el texto completo del post (solo los campos extraídos y la descripción física);
  - el contacto;
  - el autor;
  - capturas sin recortar.
- **Moderación:** nuevo predicado `contains_personal_data` en `OpenAIDecisionsModerator`. Pregunta si la imagen o el texto muestran caras, nombres de personas, teléfonos o la interfaz de una red social. Si sale positivo, el aviso va a `pending_review`.
- **Solicitud de retirada:** las fichas de los importados llevan un enlace "Soy el autor del post y quiero retirarlo" que lleva al formulario de contacto o abre un aviso al admin. Hasta que exista panel, el admin borra el aviso con el `DELETE` que ya existe.
- **Política de privacidad** ([`content/politica-de-privacidad.md`](../frontend/content/politica-de-privacidad.md)): añadir un apartado sobre avisos importados de redes sociales que explique su origen, qué datos se guardan, la caducidad y cómo pedir la retirada. **Conviene revisarlo con alguien de legal antes de lanzar.**

### 2.5 Infraestructura y API

- **Migración:**
  - `pets.origin text not null default 'direct' check (origin in ('direct', 'facebook'))`;
  - `pets.origin_url text`;
  - `pets.expires_at timestamptz`;
  - `contact` pasa a nullable, con `check ((origin = 'direct') = (contact is not null))`;
  - índice único sobre `origin_url` donde no sea nulo.
- **Endpoint:** `POST /api/v1/pets/import` con `{ facebookUrl, text?, images, ... }`. Las imágenes se suben a Cloudinary con la subida firmada que ya existe.
- **`GET /api/v1/pets`:** sin cambios de contrato, salvo un campo nuevo `origin` en el DTO. Un filtro opcional `origin` permitirá separarlos si hace falta.
- **Ficha y card:** una etiqueta "Visto en Facebook" y, en lugar de `ContactActions`, un botón al post original.
- **Workflow nocturno** (`scheduled-jobs.yml`): un job nuevo `expire-imports` que llama a `POST /api/internal/pets/expire`.

### 2.6 Frontend y PWA

- **PWA mínima:** un `manifest.webmanifest` con los iconos que ya hay en `public/` y un service worker mínimo. Mejor con `@vite-pwa/nuxt` que a mano.
- **`share_target` en el manifest:** `POST /importar` con `multipart/form-data`, que acepta `title`, `text`, `url` y `files` (imágenes).
  - El POST lo atiende el service worker.
  - El service worker guarda los ficheros en caché y redirige a `/importar`, que los recoge.
  - **Limitación:** iOS Safari no soporta Web Share Target. En iPhone se usa la página `/importar` subiendo la foto a mano.
- **Página `/importar`:** se basa en el paso 2 de `registrar` y añade el campo de enlace, el recorte obligatorio (por ejemplo, con `cropperjs`) y las coincidencias al confirmar.

---

## 3. Publicar en una Página de Facebook propia

### 3.1 Preparación (manual, una vez)

1. Crear la Página de Facebook del proyecto.
2. Crear una app en Meta for Developers, de tipo *Business*.
3. Pedir los permisos `pages_manage_posts` y `pages_read_engagement`.
   - Para publicar solo en una Página nuestra, con una app en la que tenemos rol, **en principio no hace falta App Review**. Hay que verificarlo al crear la app.
4. Generar un **token de Página de larga duración**: user token → long-lived user token → page token, que no caduca mientras no cambien la contraseña ni los permisos.
5. Guardarlo como secreto: `NUXT_FACEBOOK_PAGE_ID` y `NUXT_FACEBOOK_PAGE_TOKEN`.

### 3.2 Aplicación

- Puerto nuevo **`SocialPublisher`** en `shared/application/ports.ts`, o en un módulo `social` si crece:
  - `publish(post: SocialPost) → { externalId }`;
  - `update(externalId, message)`;
  - `remove(externalId)`.
- **`PublishPetToSocial`**: se suscribe a `pet.published` en el outbox.
  - **No publica los avisos importados de Facebook**, para no devolverles su propio post.
  - **Es idempotente:** antes de publicar, consulta `pet_social_posts`. El outbox puede reentregar el evento, por ejemplo cuando falla el handler de indexación, que va en el mismo evento.
- **`UpdateSocialPostOnReunion`**: se suscribe a `pet.reunited` y edita el texto con "✅ ¡REUNIDO!" al principio. Así, los grupos donde se compartió dejan de difundirlo.
- **Borrado:** hoy `DeletePet` no emite eventos. Añadir `pet.removed` y un handler que borre el post. Esto también cubre los avisos rechazados por un admin después de publicados.

### 3.3 Contenido del post

- **Post de foto**, no de enlace, porque Facebook da menos alcance a los posts con enlace externo:
  - `POST /{page-id}/photos` con la URL de Cloudinary, a 1080 px, y `caption`.
  - Si hay varias fotos, se suben con `published=false` y se publican juntas con `POST /{page-id}/feed` y `attached_media`.
- **Texto:** se construye con una función pura y testeable.
  - Tipo, especie y nombre (por ejemplo, "🔴 PERDIDO · Perro · Toby").
  - Zona y fecha.
  - La descripción, truncada.
  - El enlace a la ficha.
  - "Compártelo en los grupos de tu zona".
  - **El contacto no se incluye:** se ve en la ficha, para evitar spam y no exponer el teléfono en otra plataforma.
- Hashtags de la zona: opcional, para valorar más adelante.

### 3.4 Infraestructura

- **`FacebookPageSocialPublisher`:**
  - `fetch` a `https://graph.facebook.com/{version}/...`, con la versión fijada en configuración;
  - timeout de unos 10 s.
  - Errores:
    - el código `190` (token inválido) se reporta con `reportError` y se lanza, para que el outbox reintente y el problema se vea;
    - el rate limit (`4`, `32`, `613`) se lanza para reintentar más tarde.
- **`DisabledSocialPublisher`:** se usa cuando no hay token. Registra en el log y no hace nada, igual que `DisabledContentModerator`.
- **Migración:** tabla `pet_social_posts`:
  - columnas `pet_id` (FK con `on delete` sin cascada, para poder borrar el post después), `network`, `external_id` y `published_at`;
  - clave primaria `(pet_id, network)`.

### 3.5 Difusión en grupos

La API no puede publicar en grupos, así que esta parte es humana:

- Contactar con los administradores de los grupos principales de cada zona para que sigan la Página y compartan sus posts, o fijen un post con el enlace a la búsqueda por foto.
- En la pantalla de confirmación del alta y en la ficha, el botón "Compartir en Facebook" (`SocialShare`) puede apuntar al post de la Página en lugar de a la ficha. Así las comparticiones se suman a un mismo post.

---

## 4. Fases

| Fase | Contenido | Depende de |
|---|---|---|
| 1 | Publicación en la Página (sección 3). Es independiente y da visibilidad desde el primer día. | Crear la Página, la app y el token |
| 2 | Importación por `/importar`: dominio, migración, endpoint, recorte, coincidencias y caducidad (2.1–2.5). | Revisión de la política de privacidad |
| 3 | PWA y Web Share Target (2.6). | Fase 2 |
| 4 | Notificar al dueño cuando un importado coincide con su aviso. | Login |

## 5. Preguntas abiertas

- ¿Hace falta App Review para `pages_manage_posts` en nuestra propia Página? Se comprueba al crear la app (3.1).
- ¿Caducidad de 60 días para los importados? Hay que ajustarla al ver cuánto duran los avisos reales.
- ¿Moderación manual de todos los importados al principio? Con poco volumen, mandarlos todos a `pending_review` durante las primeras semanas daría datos para calibrar `contains_personal_data`.
