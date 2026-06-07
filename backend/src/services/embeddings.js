const HF_API_URL = 'https://api-inference.huggingface.co/models/openai/clip-vit-large-patch14';

export async function generateImageEmbedding(imageBuffer) {
  const response = await fetch(HF_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
      'Content-Type': 'application/octet-stream',
    },
    body: imageBuffer,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Hugging Face API error: ${error}`);
  }

  const embedding = await response.json();

  if (!Array.isArray(embedding)) {
    throw new Error('Unexpected embedding format from Hugging Face');
  }

  return embedding;
}
