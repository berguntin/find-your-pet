import type { Metadata } from '~/types/Metadata'

export const useMetadata = (pet: Pet | null): Metadata => {
    const config = useRuntimeConfig()

    if (!pet) {
        return {
            title: '',
            text: '',
            hastags: '',
            quote: '',
            image: '',
            url: '',
            via: config.public.baseUrl
        }
    }
    const getTitle = () => {
        if (pet.athome) {
            return `${pet.name || 'Esta mascota'} ya está con su familia!`
        }
        return pet.status === 'lost' ? `Ayúdame a encontrar a ${pet.name || 'mi mascota'}` : `¿Alguien lo busca?`
    }

    const getText = (): String => {
        if (pet.athome) {
            return 'Una historia con final feliz'
        }
        if (!pet.alive) {
            return `Tristemente, ha sido encontrado fallecido`
        }
        return pet.description || 'Mascotas perdidas y encontradas DANA Valencia'
    }

    const getHastags = (): String => {
        let hashtags = []
        hashtags.push(pet.status == 'lost' ? 'perdido' : 'encontrado')
        hashtags.push('DANA')
        hashtags.push('VLC')
        hashtags.push('ayuda')

        return hashtags.join(',')
    }
    // TODO fix this
    const getImage = (): String => {
        return pet.images[0]
    }

    const getUrl = () => {
        return encodeURI(`${config.public.baseUrl}/mascota/${pet.id}`)
    }

    return {
        title: getTitle(),
        text: getText(),
        hastags: getHastags(),
        quote: getText(),
        image: getImage(),
        url: getUrl(),
        via: config.public.baseUrl
    }
}
