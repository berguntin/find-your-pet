import { defineEventHandler, readBody } from 'h3'
import { OpenAI } from 'openai'
import { useRuntimeConfig } from '#imports'
import { provide } from 'vue'

export default defineEventHandler(async event => {
    const config = useRuntimeConfig()

    const body = await readBody(event)
    const { type, image } = body

    const userPrompt = `I need you to act as a REST API, so I need a JSON response only. Avoid the markup format to style json, only a plain JSON response.
                        In other case, the app will crash.
                        Describe the animal in the following image. Extract as much information as you can. 
                        This is the response schema I am expecting:
                        {
                            error: boolean // if the image didnt contain a pet
                            data : {
                                type: string | null ('Perro' | 'Gato' | 'Otro') //only this values are allowed (Capitalized)
                                description: string | null //(Short text describing the animal, in SPANISH)
                                name: string | null // if known
                                location: string | null // usually a city name
                                contact: string | null // phone number, email, social media profile, etc... (only the value, not the contact type)
                                date: datetime(yyyy-mm-dd) | null // the moment pet was found or lost
                            }
                        }
                        Put only the info you can extract to the image, if you dont find texts, only describe the pet using "description". 
                        Use a objective description of the pet itself, don't analyse gestures or pets attitude. The description has to be usefull to identify the pet.
                        Return the plain json. I need to parse it directly to the frontend
                        If you found that the image not contain a pet, set the error field to true.
                        `

    const openai = new OpenAI({
        apiKey: process.env.NUXT_OPENAI_KEY
    })

    try {
        const stream = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            stream: true,
            max_tokens: 4096,
            messages: [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: userPrompt },
                        { type: 'image_url', image_url: { url: image } }
                    ]
                }
            ]
        })

        let response = ''
        for await (const chunk of stream) {
            response += chunk.choices[0]?.delta?.content || ''
        }
       
        return response
    } catch (error) {
        console.error('Error fetching description from ChatGPT:', error)
        throw new Error('Failed to fetch description from ChatGPT')
    }
})
