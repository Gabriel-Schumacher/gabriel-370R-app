import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import path from 'path'
import fs from 'fs/promises'
import sharp from 'sharp'
import crypto from 'crypto'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import type { WeaviateClient } from 'weaviate-client'
import { connectToWeaviate } from '$lib/weaviate'

let client: WeaviateClient

/**
 * Converts an image file to base64 string
 * @param buffer Image file buffer
 * @returns Base64 string
 */
function bufferToBase64(buffer: Buffer): string {
	return buffer.toString('base64')
}

/**
 * Handles requests to save a generated image to the user's collection
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const { imageUrl, title } = await request.json()

		if (!imageUrl || !title) {
			return json(
				{
					success: false,
					message: 'Both image URL and title are required'
				},
				{ status: 400 }
			)
		}

		 // Read the file from the static directory where imageGen saved it
		const imagePath = path.join(process.cwd(), 'static', imageUrl)
		const buffer = await fs.readFile(imagePath)

		// 1. Create thumbnail
		const thumbnailBuffer = await sharp(buffer)
			.resize(200, 200, { fit: 'cover' })
			.jpeg({ quality: 80 })
			.toBuffer()

		// 2. Save thumbnail to static folder
		const thumbnailDir = ensureThumbnailDir()
		const thumbnailFilename = `${path.basename(imageUrl)}.jpg`
		const thumbnailPath = path.join(thumbnailDir, thumbnailFilename)

		writeFileSync(thumbnailPath, thumbnailBuffer)

		// 3. Convert original to base64 for Weaviate
		const base64Image = bufferToBase64(buffer)

		// Insert the image into Weaviate or any other database if needed
		const result = await addImageToCollection(base64Image, path.basename(imageUrl), title)

		if (result) {
			return json({
				success: true,
				message: 'Image saved to collection'
			})
		} else {
			return json(
				{
					success: false,
					message: 'Failed to save image'
				},
				{ status: 500 }
			)
		}
	} catch (error) {
		console.error('Save image error:', error)
		return json(
			{
				success: false,
				message: error instanceof Error ? error.message : 'Failed to save image'
			},
			{ status: 500 }
		)
	}
}

/**
 * Add an image to the ImageCollection
 * @param title Text title for the image
 * @param imageBase64 Base64 encoded image data
 * @param imagePath Path to the image file
 */
async function addImageToCollection(imageBase64: string, imageUrl: string, title?: string) {
	try {
		console.log(`Adding image to collection: ${imageUrl}`)
		// Initialize Weaviate client if not already done
		if (!client) {
			client = await connectToWeaviate()
		}
		await client.collections.get('ImageCollection').data.insert({
			title: title || 'Untitled Generated Image',
			poster: imageBase64,
			thumbnailPath: `/thumbnails/${imageUrl}.jpg` // Store the path to the thumbnail
		})

		console.log(`Successfully added image: ${title}`)
		return true
	} catch (error) {
		console.error(`Failed to add image to collection: ${error}`)
		return false
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
