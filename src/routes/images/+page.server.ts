import weaviate, { type WeaviateClient } from 'weaviate-client';

let client: WeaviateClient

async function connectToWeaviate(): Promise<WeaviateClient> {
    const clientPromise = await weaviate.connectToLocal()

    return clientPromise
}

export const actions: Actions = {
    imageToBase64: async 
}