import weaviate, { dataType, type WeaviateClient, type Collection, connectToLocal } from 'weaviate-client';

let client: WeaviateClient;

async function connectToWeaviate(): Promise<WeaviateClient> {
	const clientPromise = await weaviate.connectToLocal()

	return clientPromise;
}

const embeddedFileSchema = {
    name: 'Chunks',
    description: 'Relevant chunks of text from selected PDF files',
    vectorizers: weaviate.configure.vectorizer.text2VecOllama({
        // Configure the Ollama embedding integration
        model: 'nomic-embed-text',
        apiEndpoint: 'http://host.docker.internal:11434'
    }),
    generative: weaviate.configure.generative.ollama({
        model: 'llama3.2',
        apiEndpoint: 'http://host.docker.internal:11434'
    }),
    properties: [
        {
            name: 'Chunks',
            dataType: dataType.TEXT
        },
        {
            name: 'file_name',
            dataType: dataType.TEXT
        },
        {
            name: 'metadata',
            dataType: dataType.OBJECT,
            nestedProperties: [
                {
                    name: 'totalPages',
                    dataType: dataType.INT
                },
                {
                    name: 'pageNumberLocation',
                    dataType: dataType.INT
                },
                {
                    name: 'chunkIndex',
                    dataType: dataType.INT
                }
            ]
        }
    ]
}
async function addCollection() {
    try {
        await client.collections.create(embeddedFileSchema);
        console.log('Added chunks collection')
    } catch (error) {
        console.error('Error adding chunks collection. Does the it already exist?', error)
    }
}

async function run() {
    const startTime: Date = new Date()
    console.log('Starting user embedded file schema creation...')

    client = await connectToWeaviate()
    await addCollection()
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


