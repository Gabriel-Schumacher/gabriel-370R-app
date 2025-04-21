<script lang="ts">
    import ImageGenerator from '$lib/components/ImageGen.svelte';
   </script>
   
   <svelte:head>
       <title>Generate AI Images | Future Image</title>
   </svelte:head>
   
   <main class="container mx-auto py-6">
       <h1 class="mb-6 text-center text-3xl font-bold text-primary-700">AI Image Generator</h1>
       
       <p class="mb-8 text-center text-lg text-gray-600">
           Create stunning AI-generated images from text prompts using Flux-Schnell
       </p>
       
       <ImageGenerator />
       
       <div class="mt-12 text-center">
           <a href="/images" class="text-primary-600 hover:underline">
               View your image collection
           </a>
       </div>
   </main>