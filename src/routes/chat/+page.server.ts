import type { Actions } from './$types';
import { Readable } from 'stream';
import { promises as fsPromises } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { pipeline } from 'stream/promises'
import fs from 'fs'
import { WebPDFLoader } from '@langchain/community/document_loaders/web/pdf';
import type { WeaviateClient } from 'weaviate-client';
import weaviate from 'weaviate-client';
import type { ChunkObject } from '$lib/types/ChunkObject'

const OPTIMAL_CHUNK_SIZE = 400
const CHUNK_OVERLAP = 50
const CHARS_PER_TOKEN = 4

let client: WeaviateClient;

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const uploadPath = process.env.NODE_ENV === 'production' ? '/uploads' : path.resolve(__dirname, '../../uploads')


async function connectToWeaviate(): Promise<WeaviateClient> {
	const clientPromise = await weaviate.connectToLocal()

	return clientPromise;
}

export async function load() {
    client = await connectToWeaviate()
    if (!client) {
        return {
            status: 500,
            error: 'Failed to connect to Weaviate'
        }
    }
    const fileChunkCollection = client.collections.get<ChunkObject>('Chunks')
    if (fileChunkCollection) {
        const uniqueFileNames = new Set<string>()
        let count = 0

        for await (const fileChunk of fileChunkCollection.iterator()) {
            count++
            uniqueFileNames.add(fileChunk.properties.file_name)
        }

        return {
            status: 200,
            count,
            fileNames: Array.from(uniqueFileNames),
        }
    } else {
        return {
            status: 404,
            error: 'File chunk collection not found'
        }
    }
}



export const actions = {
    uploadFile: async ( {request} ) => {
        const formData = await request.formData();
        console.log(formData);
        const uploadedFile = formData?.get('file') as unknown as File | undefined

        if (!uploadedFile) {
            console.log('No file uploaded')
            return {
                status: 400,
                body: {
                    error: 'No file uploaded'
                }
            }
        }

        try {
            const fileBuffer = await uploadedFile.arrayBuffer();
            
            const readableStream = new Readable()
            readableStream.push(Buffer.from(fileBuffer))
            readableStream.push(null)

            // Delete all existing files in the uploads directory
            const files = await fsPromises.readdir(uploadPath)
            for (const file of files ) {
                await fsPromises.unlink(path.join(uploadPath, file))
            }

            const uploadedFilePath = path.join(uploadPath, uploadedFile.name)

            await pipeline(readableStream, fs.createWriteStream(uploadedFilePath))

            console.log('File uploaded')

            const addedFileData = await createFileDataObject(uploadedFilePath)

            return {
                status: 200,
                success: 'File uploaded and processed successfully',
                data: addedFileData
            }
        }
        catch (e) {
            return {
                status: 500,
                body: {
                    error: 'Failed to upload file'
                }
            }
        }
    }
} as Actions

async function createFileDataObject(uploadedFilePath: string) {
    const fileData = await fsPromises.readFile(uploadedFilePath)
    const fileBlob = new Blob([fileData])

    const loader = new WebPDFLoader(fileBlob, {
        splitPages: true,
    })

    const docs = await loader.load()
    const chunks:any[] = []

    for (const doc of docs) {
        const pageContent = doc.pageContent

        let startingPos = 0
        while (startingPos < pageContent.length) {
            const chunk = pageContent.slice(startingPos, startingPos + (OPTIMAL_CHUNK_SIZE * CHARS_PER_TOKEN))

            chunks.push({
                chunk_text: chunk,
                file_name: path.basename(uploadedFilePath),
                metadata: {
                    totalPages: docs.length,
                    pageNumberLocation: doc.metadata?.loc?.pageNumber,
                    chunkIndex: chunks.length,
                }

            })

            startingPos += ((OPTIMAL_CHUNK_SIZE - CHUNK_OVERLAP) * CHARS_PER_TOKEN)

        }
        console.log('Chunks: ', chunks)
    }
    await importedFileChunks(chunks)
    return { success: true}
}

async function importedFileChunks(chunks: any[]) {
    client = await connectToWeaviate()
    const fileChunkCollection = client.collections.get<ChunkObject>('Chunks')


	const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
	const logPath = path.join(uploadPath, `chunks-log-${timestamp}.json`)

    await fsPromises.writeFile(
        logPath,
        JSON.stringify(
			{
				totalChunks: chunks.length,
				timestamp: new Date().toISOString(),
				chunks: chunks.map((chunk) => ({
					text: chunk.chunk_text,
					fileName: chunk.file_name,
					metadata: chunk.metadata
				}))
			},
            null,
            2
        )
    )
	console.log(`Chunk log written to: ${logPath}`)

    const BATCH_SIZE = 100
    const batches = []

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        batches.push(chunks.slice(i, i + BATCH_SIZE))
    }

    let totalInserted = 0
    for (const [index, batch] of batches.entries()) {
        try {
            await fileChunkCollection.data.insertMany(batch)
            totalInserted += batch.length
            console.log(`Inserted batch ${index + 1} of ${batches.length}: ${batch.length} chunks`)
        } catch (e) {
            console.error(`Failed at chunk ${totalInserted + 1} of ${chunks.length}`, e)
            throw e
        }
    }
}