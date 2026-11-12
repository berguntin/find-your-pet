# Checks for Vue, Nuxt and TypeScript

First check the installed versions (`vue`, `nuxt`, `typescript`, `pinia`, etc.) in `node_modules` or the lockfile; many of these rules depend on the version.

## Reactivity (Vue 3)

- Destructuring a `reactive()` object or `props` loses reactivity, unless `toRefs`/`toRef` or Vue 3.5+ reactive props destructure is used.
- `ref` used without `.value` in `<script>`, or with `.value` in the template.
- `watch` on a property of a reactive object without a getter function (`watch(obj.prop, ...)` watches nothing).
- `watch` that needs `deep` or `immediate` and lacks it, or has it unnecessarily on large structures.
- `computed` with side effects (requests, state mutations).
- Direct mutation of props, or of store state outside its actions if the project follows that convention.
- `v-for` without a stable `:key`, or with the index as key in lists that get reordered or filtered.
- `v-if` and `v-for` on the same element.

## Lifecycle and cleanup

- `addEventListener`, `setInterval`, observers or subscriptions without cleanup in `onBeforeUnmount`/`onUnmounted`.
- Access to the DOM or to `window`/`document` outside `onMounted` in code that runs on the server.

## Nuxt and SSR

- Use of `window`, `localStorage` or browser APIs during SSR without `import.meta.client`, `<ClientOnly>` or `onMounted`.
- Shared state created with a module-level `ref()`: it leaks between requests on the server. Use `useState` or a store instead.
- `$fetch` in a component's setup where `useFetch`/`useAsyncData` should be used (duplicate request on server and client, no hydration).
- Repeated or non-unique `useAsyncData` keys across components.
- Unhandled `useFetch` errors (`error` ignored) or `pending` without a loading state.
- Hydration mismatches: dates, random values or client-dependent data rendered on the server.
- Environment variables: secrets in `runtimeConfig.public`, or private values read from the client.
- Server routes (`server/api`) that do not validate the body or check the session.
- Route middleware that only protects on the client.

## TypeScript

- Explicit or implicit `any`, `as` forcing incompatible types, non-null `!` on values that can be null.
- Duplicated types instead of importing the shared or generated ones.
- API responses typed with an interface but without runtime validation at the boundary (external data, `JSON.parse`, forms).
- `Promise` without `await` or handling (floating promises), especially in `forEach` with async callbacks.
- Discriminated unions without exhaustive checking (`switch` without a `never` case).
- `defineProps`/`defineEmits` without types, or with types that do not match how parents actually use them.

## Client performance

- Large lists without virtualization or pagination.
- Heavy components imported synchronously where `defineAsyncComponent` or a `Lazy` component would fit.
- Watchers or computed properties that recompute large structures on every small change.
