import weaviate from 'weaviate-client';
import type { WeaviateClient } from 'weaviate-client';

// Singleton client instance
let client: WeaviateClient | null = null;

/**
 * Connect to Weaviate and return a client instance
 * Maintains a singleton pattern to avoid multiple connections
 */
export async function connectToWeaviate(): Promise<WeaviateClient> {
  const clientPromise = await weaviate.connectToLocal()

  return clientPromise
}
/**
 * Reset the client connection (useful for testing)
 */
export function resetWeaviateConnection(): void {
  if (client) {
    client.close();
    client = null;
  }
}

/**
 * Check if Weaviate is ready
 */
export async function isWeaviateReady(): Promise<boolean> {
  const weaviateClient = await connectToWeaviate();
  return weaviateClient.isReady();
}