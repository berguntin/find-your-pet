export default defineI18nConfig(() => ({
    legacy: false,
    locale: 'es',

    messages: {
        es: {
            welcome: 'Bienvenido',
            home: 'Inicio',
            add_pet: '+ Añadir mascota',
            header_title: 'MASCOTAS DANA',
            header_desc: 'Mascotas Perdidas y Encontradas en Valencia',
            mainpage_title: 'Mascotas perdidas - Valencia',
            mainpage_subtitle_1: `A causa de las inundaciones provocadas en Valencia por la DANA, muchas mascotas están perdidas, lejos de su
            familia.`,
            we_need: 'Necesitamos',
            your_help: 'tu ayuda',
            mainpage_subtitle_2: 'para que puedan regresar a sus hogares.',
            search: 'Buscar',
            all: 'Todos',
            lost_f: 'Perdidas',
            found_f: 'Encontradas'
        },
        en: {
            welcome: 'Welcome',
            home: 'Home',
            add_pet: '+ Add pet',
            header_title: 'DANA PETS',
            header_desc: 'Lost and Found Pets in Valencia',
            mainpage_title: 'Lost pets - Valencia',
            mainpage_subtitle_1: `Due to the floods caused in Valencia by the DANA, many pets are lost, far from their family.`,
            we_need: 'We need',
            your_help: 'your help',
            mainpage_subtitle_2: 'so they can return to their homes.',
            search: 'Search',
            all: 'All',
            lost_f: 'Lost',
            found_f: 'Found'
        }
    }
}))
