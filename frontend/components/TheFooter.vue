<script setup lang="ts"></script>
<template>
    <footer class="footer bg-base-200 text-base-content p-10">
        <div>
            <h3 class="footer-title">Proyecto Comunitario</h3>
            <p>Proyecto realizado por la comunidad</p>
            <p>¿Quieres colaborar?</p>
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
            <h3 class="footer-title">Enlaces Útiles</h3>
            <ul class="space-y-2">
                <li>
                    <a href="/politica-de-privacidad" class="link link-hover">Política de privacidad</a>
                </li>
                <li>
                    <a href="/registrar" class="link link-hover">Añadir una mascota</a>
                </li>
                <li>
                    <a href="mailto:help.mascotas.perdidas@gmail.com" class="link link-hover">Contacto</a>
                </li>
            </ul>
        </div>
    </footer>
    <footer class="footer footer-center p-4 bg-base-300 text-base-content">
        <div>
            <p>&copy; {{ new Date().getFullYear() }} mascotasdana.es. Todos los derechos reservados.</p>
        </div>
    </footer>
</template>
