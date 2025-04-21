import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import path from 'path'
import fs from 'fs/promises'
import crypto from 'crypto'
import sharp from 'sharp'
import { writeFileSync, existsSync } from 'fs'
import Replicate from 'replicate'
import { REPLICATE_API_TOKEN } from '$env/static/private'

const replicate = new Replicate({
  auth: REPLICATE_API_TOKEN,
})

// Model configuration for Replicate's models
const MODELS: Record<string, `${string}/${string}` | `${string}/${string}:${string}`> = {
  'flux-schnell': 'black-forest-labs/flux-schnell',
  'flux-redux-dev': 'black-forest-labs/flux-redux-dev',
  'flux-1.1-pro': 'black-forest-labs/flux-1.1-pro',
  'flux-canny-dev': 'black-forest-labs/flux-canny-dev'
}

/**
 * Handles image refinement requests using Replicate's models
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		// Parse the FormData from the request
		const formData = await request.formData()
		const prompt = formData.get('prompt') as string
		const originalImageUrl = formData.get('originalImageUrl') as string
		const referenceImage = formData.get('referenceImage') as File | null
		const modelName = (formData.get('model') as keyof typeof MODELS) || 'flux-schnell' // Default to flux-schnell

		if (!prompt || !originalImageUrl) {
			return json({ 
				success: false, 
				message: 'Prompt and original image URL are required' 
			}, { status: 400 })
		}

			// Validate model selection
		if (!MODELS[modelName]) {
			return json({ success: false, message: 'Invalid model selected' }, { status: 400 })
		}

		// For flux-redux-dev model, reference image is required
		if ((modelName === 'flux-redux-dev' || modelName === 'flux-canny-dev') && !referenceImage) {
			return json({ 
				success: false, 
				message: 'Reference image is required for this model' 
			}, { status: 400 })
		}

		// Read the original image
		const originalImagePath = path.join(process.cwd(), 'static', originalImageUrl)
		const originalBuffer = await fs.readFile(originalImagePath)
		const originalBase64 = originalBuffer.toString('base64')
		const originalDataUrl = `data:image/png;base64,${originalBase64}`

		// Build base Replicate input
		let replicateInput: any = {
			prompt,
			num_outputs: 1,
		}
		
		// Model-specific configurations
		if (modelName === 'flux-schnell') {
			replicateInput = {
				...replicateInput,
				go_fast: true,
				aspect_ratio: '1:1',
				output_format: 'webp',
				output_quality: 80,
				image: originalDataUrl
			}
			
			// If additional reference image is provided for style reference
			if (referenceImage) {
				const arrayBuffer = await referenceImage.arrayBuffer()
				const buffer = Buffer.from(arrayBuffer)
				const base64Image = buffer.toString('base64')
				const refDataUrl = `data:${referenceImage.type};base64,${base64Image}`
				replicateInput.style_reference_image = refDataUrl
			}
		} else if (modelName === 'flux-redux-dev') {
			// For flux-redux-dev, process the reference image
			if (!referenceImage) {
				return json({ 
					success: false, 
					message: 'Reference image is required for Flux Redux' 
				}, { status: 400 })
			}
			
			const arrayBuffer = await referenceImage.arrayBuffer()
			const buffer = Buffer.from(arrayBuffer)
			const base64Image = buffer.toString('base64')
			const refDataUrl = `data:${referenceImage.type};base64,${base64Image}`
			
			replicateInput = {
				...replicateInput,
				redux_image: refDataUrl,
				target_image: originalDataUrl,
				scale: 0.8,
				output_format: 'webp',
				output_quality: 80,
			}
		} else if (modelName === 'flux-1.1-pro') {
				// Now used as high-quality text-to-image model
				replicateInput = {
					...replicateInput,
					image: originalDataUrl, // Use the original image as a starting point
					strength: 0.7,
					guidance_scale: 7.0,
					negative_prompt: "ugly, disfigured, low quality, blurry, nsfw",
					num_inference_steps: 40, // Higher quality
					width: 768,
					height: 768,
					scheduler: "K_EULER_ANCESTRAL"
				}
				
				// If reference image provided, use it for additional guidance
				if (referenceImage) {
					const arrayBuffer = await referenceImage.arrayBuffer()
					const buffer = Buffer.from(arrayBuffer)
					const base64Image = buffer.toString('base64')
					const refDataUrl = `data:${referenceImage.type};base64,${base64Image}`
					
					// For some models, a style reference might be useful
					replicateInput.style_reference_image = refDataUrl
				}
		} else if (modelName === 'flux-canny-dev') {
			// For flux-canny-dev
			if (!referenceImage) {
				// Can use original as control image if no reference provided
				replicateInput = {
					...replicateInput,
					control_image: originalDataUrl,
					guidance_scale: 7.0,
					negative_prompt: "ugly, disfigured, low quality, blurry, nsfw"
				}
			} else {
				// If reference image provided, use it as control image
				const arrayBuffer = await referenceImage.arrayBuffer()
				const buffer = Buffer.from(arrayBuffer)
				const base64Image = buffer.toString('base64')
				const refDataUrl = `data:${referenceImage.type};base64,${base64Image}`
				
				replicateInput = {
					...replicateInput,
					control_image: refDataUrl,
					guidance_scale: 7.0,
					negative_prompt: "ugly, disfigured, low quality, blurry, nsfw"
				}
			}
		}

		console.log(`Refining with model: ${MODELS[modelName]}`, {
			prompt: replicateInput.prompt,
			model: MODELS[modelName]
		});
		
		const imageData: any = await replicate.run(MODELS[modelName], {
			input: replicateInput
		})

		// Different models return different response formats
		let resultImageUrl: string;
		
		if (modelName === 'flux-redux-dev' || modelName === 'flux-canny-dev') {
			// Flux Redux and Canny return a direct URL string
			resultImageUrl = imageData as string;
		} else {
			// Other models return array with objects that have url() methods
			resultImageUrl = Array.isArray(imageData) && imageData.length > 0 ? imageData[0].url() : '';
		}

		if (!resultImageUrl) {
			throw new Error('Failed to get image URL from model response');
		}

		const imageResponse = await fetch(resultImageUrl)
		const imageArrayBuffer = await imageResponse.arrayBuffer()
		const base64ImageBuffer = Buffer.from(imageArrayBuffer).toString('base64')

		// Save the refined image to a static directory
		const imageId = crypto.randomUUID()
		const imagePath = `${imageId}.png`
		const fullPath = path.join(process.cwd(), 'static', imagePath)

		// Ensure directory exists
		await fs.mkdir(path.dirname(fullPath), { recursive: true })

		// Save the image buffer to disk
		await fs.writeFile(fullPath, Buffer.from(base64ImageBuffer, 'base64'))

		return json({
			success: true,
			imageUrl: imagePath,
			imageId
		})
	} catch (error) {
		console.error('Image refinement error:', error)
		return json(
			{
				success: false,
				message: error instanceof Error ? error.message : 'Failed to generate image'
			},
			{ status: 500 }
		)
	}
}
