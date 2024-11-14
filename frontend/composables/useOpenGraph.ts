export const useOpenGraph = (pet: Pet | null) : Object => {
    
    const metaData = useMetadata(pet)

    return {
        title: metaData.title,
        meta: [
          { name: "description", content: metaData.text },
          // Open Graph (Facebook, LinkedIn)
          { property: "og:title", content: metaData.title },
          { property: "og:description", content: metaData.text },
          { property: "og:image", content: metaData.image },
          { property: "og:url", content: metaData.url },
          { property: "og:type", content: "website" },
          // Twitter Card
          { name: "twitter:card", content: metaData.image },
          { name: "twitter:title", content: metaData.title },
          { name: "twitter:description", content: metaData.text },
          { name: "twitter:image", content: metaData.image },
        ],
      }
}