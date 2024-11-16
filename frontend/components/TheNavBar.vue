<script setup lang="ts"></script>

<template>
    <nav>
        <div class="flex-none hidden lg:block">
            <TheMenu />
        </div>
        <div class="drawer lg:hidden">
            <input id="my-drawer" type="checkbox" class="drawer-toggle" />
            <div class="drawer-content">
                <!-- Page content here -->
                <label for="my-drawer" class="btn btn-ghost drawer-button"
                    ><Icon name="material-symbols:menu" size="1.5rem"
                /></label>
            </div>
            <div class="drawer-side z-10">
                <label for="my-drawer" aria-label="close sidebar" class="drawer-overlay"></label>

                <TheMenu />
            </div>
        </div>
    </nav>
</template>
