import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import path from 'path'
import fs from 'fs/promises'
import crypto from 'crypto'
//import OpenAI from 'openai'
import type { WeaviateClient } from 'weaviate-client'
import { connectToWeaviate } from '$lib/weaviate'
import sharp from 'sharp'
import { writeFileSync, existsSync, mkdirSync } from 'fs'
import Replicate from 'replicate'
import { REPLICATE_API_TOKEN } from '$env/static/private'

let client: WeaviateClient

//const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const replicate = new Replicate({
  auth: REPLICATE_API_TOKEN,
})

/**
 * Handles image generation requests using Gemma 3 via Ollama
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const { prompt } = await request.json()

		if (!prompt) {
			return json({ success: false, message: 'Prompt is required' }, { status: 400 })
		}

		// Call OpenAI API to generate image with OpenAI
		//const imageData = await generateImageWithOpenAI(prompt)

		// Call Replicate API to generate image with black forest labs flux-schnell
		const imageData: any = await replicate.run('black-forest-labs/flux-schnell', {
			input: {
				prompt,
				go_fast: true,
				num_outputs: 1,
				aspect_ratio: '1:1',
				output_format: 'webp',
				output_quality: 80,
			}
		})

		console.log('Image data:', imageData)

		if (!imageData || imageData.length === 0) {
			throw new Error('Failed to generate image')
		}

		const imageResponse = await fetch(imageData[0].url())
		const imageArrayBuffer = await imageResponse.arrayBuffer()
		const base64ImageBuffer = Buffer.from(imageArrayBuffer).toString('base64')


		// Save the generated image to a static directory
		const imageId = crypto.randomUUID()
		const imagePath = `${imageId}.png`
		const fullPath = path.join(process.cwd(), 'static', imagePath)

		// Ensure directory exists
		await fs.mkdir(path.dirname(fullPath), { recursive: true })

		// Save the image buffer to disk
		await fs.writeFile(fullPath, Buffer.from(base64ImageBuffer, 'base64'))

/* 		// 1. Create thumbnail
				const thumbnailBuffer = await sharp(Buffer.from(imageData, 'base64'))
					.resize(200, 200, { fit: 'cover' })
					.jpeg({ quality: 80 })
					.toBuffer()
		
				// 2. Save thumbnail to static folder
				const thumbnailDir = ensureThumbnailDir()
				const thumbnailFilename = `${imageId}.jpg`
				const thumbnailPath = path.join(thumbnailDir, thumbnailFilename)
		
				writeFileSync(thumbnailPath, thumbnailBuffer)
		
				// 3. Convert original to base64 for Weaviate
				const base64Image = bufferToBase64(Buffer.from(imageData, 'base64'))
		
				// 4. Store image data in Weaviate with the imageId
				const success = await addImageToCollection(prompt, base64Image, imageId) */

		return json({
			success: true,
			imageUrl: imagePath,
			imageId
		})
	} catch (error) {
		console.error('Image generation error:', error)
		return json(
			{
				success: false,
				message: error instanceof Error ? error.message : 'Failed to generate image'
			},
			{ status: 500 }
		)
	}
}

/**
 * Function to call OpenAI API for image generation
 */
async function generateImageWithOpenAI(prompt: string): Promise<string> {
	try {
		// 1. Call the API with the appropriate model (dall-e-3 or gtp-4o in the future)
		// 2. Process the response to get the image data
		// 3. Return the base64 encoded image data

		// Example API call (adjust based on actual API):
		const response = await openai.images.generate({
			model: 'dall-e-3',
			prompt: `Generate an image based on the following description: ${prompt}`,
			n: 1,
			size: '1792x1024', // 1792x1024 for landscape
			quality: 'hd',
			style: 'natural'
		})

		// OpenAI SDK returns the response directly, not a fetch Response object
		if (!response.data || response.data.length === 0) {
			throw new Error('Failed to generate image')
		}

		// Get the image URL from the response that points to OpenAI's server for 60 minutes after generation
		const imageUrl = response.data[0].url

		if (!imageUrl) {
			throw new Error('Image URL not provided in the API response')
		}

		// Fetch the image data from the URL and convert it to base64
		// Note: This is a placeholder. You may need to adjust this based on how the OpenAI API returns the image.
		// For example, if the image is returned as a URL, you would fetch it from OpenAI's server.
		const imageResponse = await fetch(imageUrl)
		const imageArrayBuffer = await imageResponse.arrayBuffer()
		return Buffer.from(imageArrayBuffer).toString('base64')
	} catch (error) {
		console.error('Ollama API error:', error)
		throw error
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

/**
 * Converts an image file to base64 string
 * @param buffer Image file buffer
 * @returns Base64 string
 */
function bufferToBase64(buffer: Buffer): string {
	return buffer.toString('base64')
}

/**
 * Add an image to the ImageCollection
 * @param title Text title for the image
 * @param imageBase64 Base64 encoded image data
 * @param imageId Unique ID for the image
 */
async function addImageToCollection(title: string, imageBase64: string, imageId: string): Promise<boolean> {
    try {
		client = await connectToWeaviate()
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


