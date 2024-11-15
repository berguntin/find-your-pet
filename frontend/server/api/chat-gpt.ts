import { defineEventHandler, readBody } from "h3";
import { OpenAI } from "openai";
import { useRuntimeConfig } from "#imports";

export default defineEventHandler(async (event) => {
  
  const config = useRuntimeConfig();

  const body = await readBody(event);
  const { type, image } = body;

  const userPrompt = `Describe un animal (Perro|Gato|Otro) de tipo: ${type} basándote en la siguiente imagen. 
Reglas:
 - Dame solo datos que ves claramente en la imagen: Raza, color o tamaño.
 - No proporciones información de cosas de la imagen que no tengan que ver con ese animal en concreto. Es decir nada de información de cosas como el entorno o de como suele ser la raza
 - Dame la información de forma resumida y sencilla, ya que necesitamos una clasificación clara de los rasgos principales de ese animal
 - Limitate solametente a dar la respuesta. Si no puedes responder, devuelve una respuesta vacia
 - No devuelvas el tipo de animal salvo que no sea perro o gato`;

  const openai = new OpenAI({
    apiKey: config.openAIKey,
  });
 
  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      stream: true,
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: userPrompt },
            { type: "image_url", image_url: { url: image } },
          ],
        },
      ],
    });

    let response = "";
    for await (const chunk of stream) {
      response += chunk.choices[0]?.delta?.content || "";
    }
    console.log("ChatGPT response:", response);
    return { description: response };
  } catch (error) {
    console.error("Error fetching description from ChatGPT:", error);
    throw new Error("Failed to fetch description from ChatGPT");
  }
});
