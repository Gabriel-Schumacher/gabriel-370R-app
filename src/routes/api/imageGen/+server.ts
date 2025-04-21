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

const replicate = new Replicate({
  auth: REPLICATE_API_TOKEN,
})

// Model configuration for Replicate's models
const MODELS = {
  'flux-schnell': 'black-forest-labs/flux-schnell',
  'flux-redux-dev': 'black-forest-labs/flux-redux-dev',
  'flux-1.1-pro': 'black-forest-labs/flux-1.1-pro',
  'flux-canny-dev': 'black-forest-labs/flux-canny-dev'
}

/**
 * Handles image generation requests using Replicate's models
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		// Parse the FormData from the request
		const formData = await request.formData()
		const prompt = formData.get('prompt') as string
		const referenceImage = formData.get('referenceImage') as File | null
		const modelName = formData.get('model') as string || 'flux-schnell' // Default to flux-schnell

		if (!prompt) {
			return json({ success: false, message: 'Prompt is required' }, { status: 400 })
		}

		// Validate model selection
		if (!MODELS[modelName]) {
			return json({ success: false, message: 'Invalid model selected' }, { status: 400 })
		}

			// Setup base input configuration
		let replicateInput: any = {
			prompt,
			num_outputs: 1,
		};

		// Model-specific configurations
		if (modelName === 'flux-schnell') {
			replicateInput = {
				...replicateInput,
				go_fast: true,
				aspect_ratio: '1:1',
				output_format: 'webp',
				output_quality: 80,
			};
		} else if (modelName === 'flux-redux-dev') {
				// Validate reference image for models that require it
			if (!referenceImage) {
				return json({ 
					success: false, 
					message: 'Reference image is required for flux-redux-dev model' 
				}, { status: 400 })
			}

			// Process reference image for Flux Redux
			const arrayBuffer = await referenceImage.arrayBuffer();
			const buffer = Buffer.from(arrayBuffer);
			const base64Image = buffer.toString('base64');
			const dataUrl = `data:${referenceImage.type};base64,${base64Image}`;
			
			replicateInput = {
				...replicateInput,
				redux_image: dataUrl,
				scale: 0.8,
				output_format: 'webp',
				output_quality: 80,
			};
		} else if (modelName === 'flux-1.1-pro') {
			// Now used as high-quality text-to-image model
			replicateInput = {
				...replicateInput,
				guidance_scale: 7.0,
				negative_prompt: "ugly, disfigured, low quality, blurry, nsfw",
				num_inference_steps: 40 // Higher steps for better quality
			};
		} else if (modelName === 'flux-canny-dev') {
			// Validate reference image for models that require it
			if (!referenceImage) {
				return json({ 
					success: false, 
					message: 'Reference image is required for flux-canny-dev model' 
				}, { status: 400 })
			}

			// Process reference image for Flux Canny
			const arrayBuffer = await referenceImage.arrayBuffer();
			const buffer = Buffer.from(arrayBuffer);
			const base64Image = buffer.toString('base64');
			const dataUrl = `data:${referenceImage.type};base64,${base64Image}`;
			
			replicateInput = {
				...replicateInput,
				control_image: dataUrl, // This is the parameter name for Flux Canny
				guidance_scale: 7.0,
				negative_prompt: "ugly, disfigured, low quality, blurry, nsfw",
			};
		}

		console.log(`Using model: ${MODELS[modelName]} with parameters:`, {
			...replicateInput,
			image: replicateInput.image ? "[BASE64_IMAGE]" : undefined,
			redux_image: replicateInput.redux_image ? "[BASE64_IMAGE]" : undefined,
			control_image: replicateInput.control_image ? "[BASE64_IMAGE]" : undefined
		});

		const imageData: any = await replicate.run(MODELS[modelName], {
			input: replicateInput
		});

			// Log the response for debugging
		console.log(`Response from ${modelName}:`, JSON.stringify(imageData));

		// Different models may return data in different formats
		let resultImageUrl: string = '';
		
		if (modelName === 'flux-redux-dev' || modelName === 'flux-canny-dev') {
			// These models return a direct URL string
			resultImageUrl = imageData as string;
		} else if (modelName === 'flux-1.1-pro') {
			// Flux 1.1 Pro might return data in a different format
			if (typeof imageData === 'string') {
				resultImageUrl = imageData;
			} else if (Array.isArray(imageData)) {
				// If it's an array, try to get the first item
				if (imageData.length > 0) {
					// Check if it's an array of strings
					if (typeof imageData[0] === 'string') {
						resultImageUrl = imageData[0];
					}
					// Check if it has a url property or method
					else if (imageData[0].url) {
						resultImageUrl = typeof imageData[0].url === 'function' 
							? imageData[0].url() 
							: imageData[0].url;
					}
				}
			} else if (imageData && typeof imageData === 'object') {
				// It might be a single object with a URL property
				if (imageData.url) {
					resultImageUrl = typeof imageData.url === 'function' 
						? imageData.url() 
						: imageData.url;
				} else if (imageData.output) {
					// Some Replicate models return { output: ... }
					const output = imageData.output;
					if (typeof output === 'string') {
						resultImageUrl = output;
					} else if (Array.isArray(output) && output.length > 0) {
						resultImageUrl = typeof output[0] === 'string' ? output[0] : '';
					}
				}
			}
		} else {
			// Flux Schnell typically returns array with objects that have url() methods
			resultImageUrl = Array.isArray(imageData) && imageData.length > 0 
				? (typeof imageData[0].url === 'function' ? imageData[0].url() : imageData[0].url) 
				: '';
		}

		if (!resultImageUrl) {
			console.error('Failed to extract image URL. Full response:', JSON.stringify(imageData));
			throw new Error('Failed to get image URL from model response');
		}

		// Download and save the image
		const imageResponse = await fetch(resultImageUrl);
		const imageArrayBuffer = await imageResponse.arrayBuffer();
		const base64ImageBuffer = Buffer.from(imageArrayBuffer).toString('base64');

		// Save the generated image to a static directory
		const imageId = crypto.randomUUID();
		const imagePath = `${imageId}.png`;
		const fullPath = path.join(process.cwd(), 'static', imagePath);

		// Ensure directory exists
		await fs.mkdir(path.dirname(fullPath), { recursive: true });

		// Save the image buffer to disk
		await fs.writeFile(fullPath, Buffer.from(base64ImageBuffer, 'base64'));

		return json({
			success: true,
			imageUrl: imagePath,
			imageId
		});
	} catch (error) {
		console.error('Image generation error:', error);
		return json(
			{
				success: false,
				message: error instanceof Error ? error.message : 'Failed to generate image'
			},
			{ status: 500 }
		);
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


