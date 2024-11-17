
export const getChatGPTDescription = async (file: File, type: string) => {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.readAsDataURL(file)
        reader.onload = () => {
            const base64Image = reader.result as string

            const img = new Image()
            img.src = base64Image
            img.onload = async () => {
                const canvas = document.createElement('canvas')
                const ctx = canvas.getContext('2d')

                const maxWidth = 500
                const maxHeight = 500
                let width = img.width
                let height = img.height

                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width
                        width = maxWidth
                    }
                } else {
                    if (height > maxHeight) {
                        width *= maxHeight / height
                        height = maxHeight
                    }
                }

                canvas.width = width
                canvas.height = height

                ctx?.drawImage(img, 0, 0, width, height)

                const resizedBase64Image = canvas.toDataURL('image/jpeg', 0.7)

                try {
                    const { data, error } = await useFetch<string>('/api/chat-gpt', {
                        timeout: 10000, //  Wait max 10 secs
                        method: 'POST',
                        body: JSON.stringify({ type, image: resizedBase64Image })
                    })

                    if (error.value) {
                        console.error('Error fetching description:', error.value)
                        reject(error.value)
                    } else {
                        
                        resolve(data.value ?? "{}" )
                    }
                } catch (error) {
                    console.error('Error fetching description:', error)
                    reject(error)
                }
            }
            img.onerror = error => {
                reject(error)
            }
        }
        reader.onerror = error => {
            reject(error)
        }
    })
}
