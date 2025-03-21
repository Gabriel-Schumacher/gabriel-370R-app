<script lang="ts">
	import { enhance } from '$app/forms'
	import type { ActionData, PageData } from './$types'

	// Converting props to $props rune
	const { data, form } = $props<{ data: PageData; form: ActionData }>()

	let selectedFile: File | null = null
	let previewUrl = $state<string | null>(null)
	let loading = $state(false)

	// Get existing images from server data
	let images = data.images || []

	const maxSizeInBytes = 10 * 1024 * 1024 // 10MB

	// Handle file selection
	function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement
		if (!input.files?.length) {
			selectedFile = null
			previewUrl = null
			return
		}
		// Check if the file is too large
		selectedFile = input.files[0]
		if (selectedFile.size > maxSizeInBytes) {
			alert('File is too large. Maximum size is 5MB.')
			input.value = '' // Clear the input
			return
		}

		// Create a preview URL for the selected image
		if (selectedFile && selectedFile.type.startsWith('image/')) {
			const reader = new FileReader()
			reader.onload = (e) => {
				previewUrl = (e.target?.result as string) || null
			}
			reader.readAsDataURL(selectedFile)
		}
	}

	// Reset the form
	function resetForm() {
		selectedFile = null
		previewUrl = null
		const fileInput = document.getElementById('image-upload') as HTMLInputElement
		if (fileInput) fileInput.value = ''
	}

	// Converting reactive statement to $effect rune
	$effect(() => {
		if (images.length > 0) {
			console.log('First few images:', images.slice(0, 3))
		}
	})
</script>

<svelte:head>
	<title>Image Upload | AI Image Collection</title>
</svelte:head>

<main class="container mx-auto max-w-4xl p-4">
	<h1 class="mb-6 text-center text-3xl font-bold text-primary-700">AI Image Collection</h1>

	<div class="mb-8 rounded-lg bg-white p-6 shadow-lg">
		<h2 class="mb-4 text-xl font-semibold">Upload a New Image</h2>

		<form
			method="POST"
			action="?/imageToBase64"
			enctype="multipart/form-data"
			use:enhance={() => {
				loading = true

				return async ({ update }) => {
					await update()
					if (form?.success) {
						resetForm()
					}
					loading = false
				}
			}}
			class="space-y-4">
			<div>
				<label for="image-upload" class="mb-1 block text-sm font-medium text-gray-700">
					Select Image
				</label>
				<input
					type="file"
					id="image-upload"
					name="image"
					accept="image/*"
					required
					onchange={handleFileSelect}
					class="block w-full text-sm text-gray-500
                           file:mr-4 file:rounded-md file:border-0
                           file:bg-primary-50 file:px-4
                           file:py-2 file:text-sm
                           file:font-semibold file:text-primary-700
                           hover:file:bg-primary-100" />
			</div>

			<div>
				<label for="title" class="mb-1 block text-sm font-medium text-gray-700">
					Image Title
				</label>
				<input
					type="text"
					id="title"
					name="title"
					placeholder="Enter a descriptive title"
					required
					class="w-full rounded-md border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500" />
			</div>

			{#if previewUrl}
				<div class="mt-4">
					<p class="mb-1 text-sm font-medium text-gray-700">Preview</p>
					<div class="rounded-md border p-2">
						<img
							src={previewUrl}
							alt="Preview"
							class="mx-auto max-h-60 max-w-full object-contain" />
					</div>
				</div>
			{/if}

			<button
				type="submit"
				disabled={loading}
				class="w-full rounded-md bg-primary-600 px-4 py-2 font-bold text-white transition duration-200 hover:bg-primary-700 disabled:bg-gray-400">
				{loading ? 'Uploading...' : 'Upload Image'}
			</button>

			{#if form}
				<div
					class={`mt-4 rounded-md p-3 ${form.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
					{form.message}
				</div>
			{/if}
		</form>
	</div>

	{#if images.length > 0}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
			{#each images as image}
				<div class="rounded-md border p-2 transition-shadow hover:shadow-md">
					{#if image.thumbnailUrl}
						{@const debugUrl = image.thumbnailUrl}
						{@const showDebug = () => console.log('Thumbnail URL:', debugUrl)}
						<img
							src={image.thumbnailUrl}
							alt={image.title}
							class="h-40 w-full rounded object-cover"
							loading="lazy"
							onerror={() => console.error(`Failed to load thumbnail: ${image.thumbnailUrl}`)}
							onload={showDebug} />
					{:else}
						<div class="flex h-40 items-center justify-center rounded bg-gray-200">
							<div class="text-gray-500">[No thumbnail: {JSON.stringify(image)}]</div>
						</div>
					{/if}
					<p class="mt-2 truncate text-center font-medium">{image.title}</p>
				</div>
			{/each}
		</div>
	{:else}
		<p class="text-gray-500">No images uploaded yet. Add your first image above!</p>
	{/if}
</main>
