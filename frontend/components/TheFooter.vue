<script setup lang="ts"></script>
<template>
    <footer class="footer bg-base-200 text-base-content p-10">
        <div>
            <h3 class="footer-title">{{ $t('community_project') }}</h3>
            <p>{{ $t('project_created_by_comunity') }}</p>
            <p>{{ $t('do_you_want_to_colabore') }}</p>
            <div class="flex gap-4 mt-4">
                <a
                    href="https://github.com/berguntin/find-your-pet"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Ver el repositorio del proyecto en GitHub"
                    class="text-base-content hover:text-primary transition-colors"
                >
                    <Icon name="uil:github" size="1.5em" />
                </a>
                <a
                    href="https://discord.gg/gkDyTrZt"
                    target="_blank"
                    aria-label="Únete a nuestro servidor de Discord"
                    class="text-base-content hover:text-primary transition-colors"
                >
                    <Icon name="uil:discord" size="1.5em" />
                </a>
            </div>
        </div>

        <div>
            <h3 class="footer-title">{{ $t('usefull_links') }}</h3>
            <ul class="space-y-2">
                <li>
                    <a href="/politica-de-privacidad" class="link link-hover"> {{ $t('privacy_policy') }}</a>
                </li>
                <li>
                    <a href="/registrar" class="link link-hover"> {{ $t('add_a_pet') }}</a>
                </li>
                <li>
                    <a href="mailto:help.mascotas.perdidas@gmail.com" class="link link-hover"> {{ $t('contact') }}</a>
                </li>
            </ul>
        </div>
    </footer>
    <footer class="footer footer-center p-4 bg-base-300 text-base-content">
        <div>
            <p>&copy; {{ new Date().getFullYear() }} mascotasdana.es. {{ $t('footer') }}</p>
        </div>
    </footer>
</template>
