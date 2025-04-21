<script lang="ts">
    import ImageGenerator from '$lib/components/ImageGen.svelte';
</script>
   
<svelte:head>
    <title>Generate AI Images | Future Image</title>
</svelte:head>
   
<main class="container mx-auto py-6">
    <h1 class="mb-6 text-center text-3xl font-bold text-primary-700">AI Image Generator</h1>
       
    <p class="mb-4 text-center text-lg text-gray-600">
        Create stunning AI-generated images using advanced Flux models
    </p>
       
    <div class="mb-8 mx-auto max-w-2xl">
        <div class="rounded-md bg-blue-50 p-4">
            <h2 class="font-medium text-blue-800">Available Models</h2>
            <ul class="mt-2 list-disc pl-5 space-y-1 text-sm text-blue-700">
                <li><strong>Flux Schnell:</strong> Fast text-to-image generation</li>
                <li><strong>Flux Pro 1.1:</strong> High-quality text-to-image generation</li>
                <li><strong>Flux Canny:</strong> Image-to-image transformation with edge detection</li>
            </ul>
        </div>
    </div>
       
    <ImageGenerator />
       
    <div class="mt-12 text-center">
        <a href="/images" class="text-primary-600 hover:underline">
            View your image collection
        </a>
    </div>
</main>