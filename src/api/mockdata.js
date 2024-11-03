const pets = [
    {
        id: '534gessd34',
        type: 'dog',
        image: '',
        description: 'Encontrado muy asustado y desorientado',
        name: null,
        breed: 'Podenco',
        status: 'found',
        location: 'La Pobla de Vallbona',
        alive: true,
        contact: '646530891',
        date: '2024-10-01'
    },
    {
        id: '345343fgd4',
        type: 'dog',
        image: '',
        description: 'Perdido, asustadizo, no perseguir',
        name: null,
        breed: 'Mestizo',
        status: 'lost',
        location: 'Naquera',
        alive: true,
        contact: '646530891',
        date: '2024-10-01'
    }
]

export function getList() {
    return pets
}