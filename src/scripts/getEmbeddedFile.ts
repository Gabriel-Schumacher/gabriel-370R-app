import weaviate, { dataType, type WeaviateClient, type Collection } from 'weaviate-client';

let client: WeaviateClient;

async function connectToWeaviate(): Promise<WeaviateClient> {
    const clientPromise = await weaviate.connectToLocal()

    return clientPromise;
}

async function getCollectionCount(collectionName: string) {
    try {
        const collection: Collection = client.collections.get(collectionName)
        let count = 0
        for await (const _ of collection.iterator()) {
            count++
        }
        console.log(`The ${collectionName} collection has ${count} items`)
    } catch (err) {
        console.error(`Failed to get the ${collectionName} collection`)
    }
}

async function run() {
    const startTime: Date = new Date()
    console.log('Starting user embedded file schema creation...')

    client = await connectToWeaviate()

    
    // await addCollection()
    await getCollectionCount('Chunks')
    // await client.collections.delete('Chunks')

    const endTime: Date = new Date()
    const elapsedTime: number = endTime.getTime() - startTime.getTime();
    const elapsedTimeSeconds: number = elapsedTime / 1000;
    const elapsedTimeMinutes: number = elapsedTimeSeconds / 60;

    console.log(
        `Total running time: ${elapsedTimeSeconds} seconds or ${elapsedTimeMinutes} minutes.`
    );
}

await run()


