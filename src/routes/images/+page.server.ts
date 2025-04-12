import type { WeaviateClient } from 'weaviate-client'
import weaviate from 'weaviate-client'
import type { Actions, RequestEvent } from '@sveltejs/kit'
import fs from 'fs/promises'
import path from 'path'
import { writeFileSync, existsSync, mkdirSync } from 'fs'
import sharp from 'sharp'

let client: WeaviateClient

async function connectToWeaviate(): Promise<WeaviateClient> {
    const clientPromise = await weaviate.connectToLocal()

    return clientPromise
}

/**
 * Converts an image file to base64 string
 * @param buffer Image file buffer
 * @returns Base64 string
 */
function bufferToBase64(buffer: Buffer): string {
	return buffer.toString('base64')
}

/**
 * Process an image buffer and store it in the system
 * @param buffer Original image buffer
 * @param title Image title/description
 * @returns Object with processing results
 */
async function processAndStoreImage(buffer: Buffer, title: string) {
	try {
		// Generate a unique ID for this image
		const imageId = crypto.randomUUID()

		// 1. Create thumbnail
		const thumbnailBuffer = await sharp(buffer)
			.resize(200, 200, { fit: 'cover' })
			.jpeg({ quality: 80 })
			.toBuffer()

		// 2. Save thumbnail to static folder
		const thumbnailDir = ensureThumbnailDir()
		const thumbnailFilename = `${imageId}.jpg`
		const thumbnailPath = path.join(thumbnailDir, thumbnailFilename)

		writeFileSync(thumbnailPath, thumbnailBuffer)

		// 3. Convert original to base64 for Weaviate
		const base64Image = bufferToBase64(buffer)

		// 4. Store image data in Weaviate with the imageId
		const success = await addImageToCollection(title, base64Image, imageId)

		if (success) {
			return {
				success: true,
				imageId,
				message: `Successfully processed image: ${title}`
			}
		} else {
			// Try to clean up thumbnail if Weaviate insert failed
			try {
				await fs.unlink(thumbnailPath)
			} catch (e) {
				console.error('Failed to remove thumbnail after failed upload', e)
			}
			return {
				success: false,
				message: 'Failed to store image in database'
			}
		}
	} catch (error) {
		return {
			success: false,
			message: `Error processing image: ${error instanceof Error ? error.message : 'Unknown error'}`
		}
	}
}

/**
 * Add an image to the ImageCollection
 * @param title Text title for the image
 * @param imageBase64 Base64 encoded image data
 * @param imageId Unique ID for the image
 */
async function addImageToCollection(title: string, imageBase64: string, imageId: string): Promise<boolean> {
    try {
      await client.collections.get('ImageCollection').data.insert({
        title: title,
        poster: imageBase64,
        thumbnailPath: `/thumbnails/${imageId}.jpg` // Store the path to the thumbnail
      });
  
      console.log(`Successfully added image: ${title}`);
      return true;
    } catch (error) {
      console.error(`Failed to add image to collection: ${error}`);
      return false;
    }
  }

  // Add this function to ensure thumbnail directory exists
function ensureThumbnailDir() {
	const thumbnailDir = path.join(process.cwd(), 'static', 'thumbnails')
	if (!existsSync(thumbnailDir)) {
		mkdirSync(thumbnailDir, { recursive: true })
	}
	return thumbnailDir
}

export const actions: Actions = {
	imageToBase64: async ({ request }: RequestEvent) => {
		try {
			// Initialize Weaviate client if not already done
			if (!client) {
				client = await connectToWeaviate()
			}

			const formData = await request.formData()
			const imageFile = formData.get('image') as File
			const imageTitle = formData.get('title') as string

			if (!imageFile || !imageTitle) {
				return {
					success: false,
					message: 'Image file or title missing'
				}
			}

			// Generate a unique ID for this image
			const imageId = crypto.randomUUID()

			// Convert file to ArrayBuffer then to Buffer
			const arrayBuffer = await imageFile.arrayBuffer()
			const buffer = Buffer.from(arrayBuffer)

			// Process and store the image
			const result = await processAndStoreImage(buffer, imageTitle)

			return {
				success: result.success,
				message: result.message,
				imageId: result.imageId
			}

/* 			// 1. Create thumbnail
			const thumbnailBuffer = await sharp(buffer)
				.resize(200, 200, { fit: 'cover' })
				.jpeg({ quality: 80 })
				.toBuffer()

			// 2. Save thumbnail to static folder
			const thumbnailDir = ensureThumbnailDir()
			const thumbnailFilename = `${imageId}.jpg`
			const thumbnailPath = path.join(thumbnailDir, thumbnailFilename)

			writeFileSync(thumbnailPath, thumbnailBuffer)

			// 3. Convert original to base64 for Weaviate
			const base64Image = bufferToBase64(buffer)

			// 4. Store image data in Weaviate with the imageId
			const success = await addImageToCollection(imageTitle, base64Image, imageId)

			if (success) {
				return {
					success: true,
					message: `Successfully uploaded image: ${imageTitle}`,
					imageId
				}
			} else {
				// Try to clean up thumbnail if Weaviate insert failed
				try {
					await fs.unlink(thumbnailPath)
				} catch (e) {
					console.error('Failed to remove thumbnail after failed upload', e)
				}
				return {
					success: false,
					message: 'Failed to store image in database'
				}
			} */
		} catch (error) {
			console.error('Error in imageToBase64 action:', error)
			return {
				success: false,
				message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
			}
		}
	}
}

// For displaying existing images
export async function load() {
    try {
      if (!client) {
        client = await connectToWeaviate();
      }
  
      let images: { id: string; title: string; thumbnailUrl: string }[] = [];
      try {
        const collection = client.collections.get('ImageCollection');

		console.log('Collection:', collection.data.exists);
        
        // Just get the basic information and thumbnail path
        for await (const item of collection.iterator(
			{
				returnProperties: ['title', 'thumbnailPath']
			}
		)) {
          if (item) {
            // Map thumbnailPath to thumbnailUrl for the client
            images.push({
              id: item.uuid,
              title: String(item.properties?.title || ''),
              thumbnailUrl: String(item.properties?.thumbnailPath || '')
            });
            
            // Add debug log to see what's happening
            console.log(`Found ${images.length} images`)
          }
        }
        
        // Log the first few entries to see what's being returned
        console.log('First 3 images:', images.slice(0, 3));
      } catch (e) {
        console.error('Could not get images collection:', e);
      }
  
      return { images };
    } catch (error) {
      console.error('Load function error:', error);
      return { images: [] };
    }
  }
