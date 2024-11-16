export function formatDate(dateToFormat: string) {
    const date = new Date(dateToFormat)
    return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    })
}
