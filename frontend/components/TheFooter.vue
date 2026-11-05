<template>
    <footer class="mt-16 bg-neutral text-neutral-content">
        <div class="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-3">
            <div class="space-y-3">
                <p class="flex items-center gap-2 text-lg font-extrabold">
                    <Icon name="mdi:paw" size="1.25rem" /> {{ $t('app_name') }}
                </p>
                <p class="text-sm opacity-80">{{ $t('footer_mission') }}</p>
            </div>

            <div>
                <h2 class="mb-3 text-sm font-bold uppercase tracking-wide opacity-80">{{ $t('useful_links') }}</h2>
                <ul class="space-y-2 text-sm">
                    <li>
                        <NuxtLink to="/registrar" class="link link-hover">{{ $t('publish_report') }}</NuxtLink>
                    </li>
                    <li>
                        <NuxtLink to="/politica-de-privacidad" class="link link-hover">{{
                            $t('privacy_policy')
                        }}</NuxtLink>
                    </li>
                    <li>
                        <a href="mailto:help.mascotas.perdidas@gmail.com" class="link link-hover">{{
                            $t('contact')
                        }}</a>
                    </li>
                </ul>
            </div>

            <div>
                <h2 class="mb-3 text-sm font-bold uppercase tracking-wide opacity-80">{{ $t('community_project') }}</h2>
                <p class="text-sm opacity-80">{{ $t('do_you_want_to_collaborate') }}</p>
                <div class="mt-4 flex gap-3">
                    <a
                        href="https://github.com/berguntin/find-your-pet"
                        target="_blank"
                        rel="noopener noreferrer"
                        :aria-label="$t('github_link')"
                        class="btn btn-circle btn-sm btn-ghost text-neutral-content"
                    >
                        <Icon name="uil:github" size="1.25rem" />
                    </a>
                    <a
                        href="https://discord.gg/caHyUjkdrc"
                        target="_blank"
                        rel="noopener noreferrer"
                        :aria-label="$t('discord_link')"
                        class="btn btn-circle btn-sm btn-ghost text-neutral-content"
                    >
                        <Icon name="uil:discord" size="1.25rem" />
                    </a>
                </div>
            </div>
        </div>
        <div class="border-t border-neutral-content/15">
            <p class="mx-auto max-w-6xl px-4 py-4 text-xs opacity-70 sm:px-6">
                &copy; {{ new Date().getFullYear() }} {{ $t('app_name') }}. {{ $t('footer') }}
            </p>
        </div>
    </footer>
</template>
