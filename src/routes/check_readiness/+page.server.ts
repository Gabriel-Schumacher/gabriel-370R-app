import weaviate, { connectToWeaviateCloud } from "weaviate-client";
import type  { WeaviateClient } from "weaviate-client";
import type { PageServerLoad } from "./$types";

let client: WeaviateClient;

export const load: PageServerLoad = async () => {
    client = await weaviate.connectToLocal()

    const clientReadiness = await client.isReady()
    
    console.log('Client is ready:', clientReadiness)    

    client.close()

    return {
        ready: clientReadiness
    }
}



