import type { Actions, RequestEvent } from '@sveltejs/kit'
import { connectToWeaviate } from '$lib/weaviate'

// Define the interface at the top of your file or in a separate types file
interface SearchResultImage {
    id: string;
    title: string;
    thumbnailUrl: string;
    matchScore: number | null;
    distance: number | undefined;
    rank: number;
}

export const actions: Actions = {
    imageSearch: async ({ request }: RequestEvent) => {
        try {

        const client = await connectToWeaviate();
        const formData = await request.formData()
        const query = formData.get('query') as string;

        if (!query) {
            return {
                success: false,
                message: 'Search query is required'
            }
        }

        // get the ImageCollection
        const collection = client.collections.get('ImageCollection')

        // perform a vector search using the query
        // Use nearText for semantic search

        const searchResults = await collection.query.nearText(query, {
            returnProperties: ["title", "thumbnailPath"],
            limit: 20,
            returnMetadata: ["distance", "certainty"]
        })

        let images: SearchResultImage[] = []

        if (searchResults.objects) {
            images = searchResults.objects.map((obj, index) => {
                return {
                    id: obj.uuid || '',
                    title: String(obj.properties.title || ''),
                    thumbnailUrl: String(obj.properties.thumbnailPath || ''),
                    // calculate a percentage match score
                    matchScore: obj.metadata?.certainty
                    ? Math.round(obj.metadata.certainty * 100)
                    : null,
                    distance: obj.metadata?.distance,
                    rank: index + 1
                }
            })
        }

        console.log(`Search results for "${query}":`, searchResults)

        return {
            success: true,
            data: images
        }

        } catch (error) {
            console.error('Error in imageSearch action:', error)
        }
    }
}