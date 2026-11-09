<script setup lang="ts">
    const { loggedIn, user, clear } = useUserSession()
    const { t } = useI18n()
    const route = useRoute()

    const deleting = ref(false)
    const deleteError = ref(false)
    const deletePets = ref(false)
    const confirmDialog = ref<HTMLDialogElement | null>(null)
    // The header renders the menu twice (desktop and mobile), so ids must be unique.
    const titleId = useId()

    const logout = async () => {
        await clear()
        await navigateTo('/')
    }

    const deleteAccount = async () => {
        deleting.value = true
        deleteError.value = false
        try {
            await useAccountApi().deleteAccount({ deletePets: deletePets.value })
            await clear()
            confirmDialog.value?.close()
            await navigateTo('/')
        } catch {
            deleteError.value = true
        } finally {
            deleting.value = false
        }
    }
</script>

<template>
    <div v-if="loggedIn && user" class="dropdown dropdown-end">
        <div
            tabindex="0"
            role="button"
            class="btn btn-ghost btn-sm btn-circle avatar"
            :aria-label="t('auth_account_menu', { name: user.name })"
        >
            <img
                v-if="user.picture"
                :src="user.picture"
                :alt="t('auth_avatar_alt', { name: user.name })"
                class="w-8 rounded-full"
                referrerpolicy="no-referrer"
            />
            <Icon v-else name="mdi:account-circle" size="1.75rem" />
        </div>
        <ul tabindex="0" class="menu dropdown-content z-40 mt-2 w-56 rounded-box bg-base-100 p-2 shadow">
            <li class="menu-title">{{ t('auth_signed_in_as', { name: user.name }) }}</li>
            <li v-if="user.admin">
                <NuxtLink to="/admin"
                    ><Icon name="mdi:shield-account" size="1.1rem" /> {{ t('auth_admin_panel') }}</NuxtLink
                >
            </li>
            <li>
                <button type="button" @click="logout">
                    <Icon name="mdi:logout" size="1.1rem" /> {{ t('auth_logout') }}
                </button>
            </li>
            <li>
                <button type="button" class="text-error" @click="confirmDialog?.showModal()">
                    <Icon name="mdi:account-remove" size="1.1rem" /> {{ t('auth_delete_account') }}
                </button>
            </li>
        </ul>

        <dialog ref="confirmDialog" class="modal" :aria-labelledby="titleId">
            <div class="modal-box">
                <h2 :id="titleId" class="text-lg font-bold">{{ t('auth_delete_account_title') }}</h2>
                <p class="mt-2 text-sm">{{ t('auth_delete_account_body') }}</p>
                <label class="label mt-3 cursor-pointer justify-start gap-3">
                    <input v-model="deletePets" type="checkbox" class="checkbox checkbox-error checkbox-sm" />
                    <span class="label-text">{{ t('auth_delete_account_pets') }}</span>
                </label>
                <p v-if="deleteError" class="mt-3 text-sm text-error" role="alert">
                    {{ t('auth_delete_account_error') }}
                </p>
                <div class="modal-action">
                    <button type="button" class="btn btn-ghost" :disabled="deleting" @click="confirmDialog?.close()">
                        {{ t('auth_cancel') }}
                    </button>
                    <button type="button" class="btn btn-error" :disabled="deleting" @click="deleteAccount">
                        <span v-if="deleting" class="loading loading-spinner loading-sm" />
                        {{ t('auth_delete_account_confirm') }}
                    </button>
                </div>
            </div>
        </dialog>
    </div>
    <LoginButton v-else class="btn-sm btn-ghost" :return-to="route.fullPath" label="auth_login" compact />
</template>
