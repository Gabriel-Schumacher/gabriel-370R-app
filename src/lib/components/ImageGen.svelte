<script lang="ts">
    import { enhance } from '$app/forms';
    import { invalidateAll } from '$app/navigation';
    import { Avatar, Progress } from '@skeletonlabs/skeleton-svelte';
    import { Wand, RefreshCw, Save } from 'lucide-svelte';
    import { goto } from '$app/navigation';
    
    // Track state
    let prompt = $state('');
    let refinementPrompt = $state('');
    let generatedImageUrl = $state<string | null>(null);
    let isGenerating = $state(false);
    let error = $state<string | null>(null);
    let generationHistory = $state<{prompt: string, imageUrl: string}[]>([]);
    let selectedImage = $state<string | null>(null);
    
    // Handle initial image generation
    async function generateImage() {
        if (!prompt.trim()) {
            error = 'Please enter a prompt';
            return;
        }
        
        isGenerating = true;
        error = null;
        
        try {
            const response = await fetch('/api/imageGen', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ prompt })
            });
            
            if (!response.ok) {
                throw new Error(`Error: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.success && result.imageUrl) {
                generatedImageUrl = result.imageUrl;
                selectedImage = result.imageUrl;
                
                // Add to history
                generationHistory = [...generationHistory, {
                    prompt,
                    imageUrl: result.imageUrl
                }];
            } else {
                error = result.message || 'Failed to generate image';
            }
        } catch (err) {
            error = err instanceof Error ? err.message : 'An unexpected error occurred';
            console.error('Image generation error:', err);
        } finally {
            isGenerating = false;
        }
    }
    
    // Handle image refinement
    async function refineImage() {
        if (!refinementPrompt.trim() || !selectedImage) {
            error = 'Please enter a refinement prompt and select an image';
            return;
        }
        
        isGenerating = true;
        error = null;
        
        try {
            const response = await fetch('/api/refine-image', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    originalImageUrl: selectedImage,
                    refinementPrompt
                })
            });
            
            if (!response.ok) {
                throw new Error(`Error: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.success && result.imageUrl) {
                generatedImageUrl = result.imageUrl;
                selectedImage = result.imageUrl;
                
                // Add to history
                generationHistory = [...generationHistory, {
                    prompt: refinementPrompt,
                    imageUrl: result.imageUrl
                }];
                
                // Clear refinement prompt
                refinementPrompt = '';
            } else {
                error = result.message || 'Failed to refine image';
            }
        } catch (err) {
            error = err instanceof Error ? err.message : 'An unexpected error occurred';
            console.error('Image refinement error:', err);
        } finally {
            isGenerating = false;
        }
    }
    
    function selectHistoryImage(imageUrl: string) {
        selectedImage = imageUrl;
    }
    
    async function saveGeneratedImage() {
        if (!selectedImage) return;
        
        try {
            const response = await fetch('/api/saveImage', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    imageUrl: selectedImage,
                    title: prompt || refinementPrompt || 'Generated Image'
                })
            });
            
            if (!response.ok) {
                throw new Error(`Error: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                // Navigate AFTER successful save
                await goto('/images');
            } else {
                error = result.message || 'Failed to save image';
            }
        } catch (err) {
            error = err instanceof Error ? err.message : 'An unexpected error occurred';
        }
    }
</script>

<div class="container mx-auto max-w-4xl p-4">
    <div class="mb-8 rounded-lg bg-white p-6 shadow-lg">
        <h2 class="mb-4 text-xl font-semibold">Generate AI Images</h2>
        
        <!-- Initial generation form -->
        <div class="mb-6 space-y-4">
            <div>
                <label for="image-prompt" class="mb-1 block text-sm font-medium text-gray-700">
                    Enter your prompt
                </label>
                <textarea
                    id="image-prompt"
                    bind:value={prompt}
                    placeholder="A serene mountain landscape with a lake reflecting the sunset..."
                    rows="3"
                    class="w-full rounded-md border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                ></textarea>
            </div>
            
            <button
                type="button"
                onclick={generateImage}
                disabled={isGenerating || !prompt.trim()}
                class="inline-flex items-center justify-center gap-2 rounded-md bg-primary-600 px-4 py-2 font-bold text-white transition duration-200 hover:bg-primary-700 disabled:bg-gray-400"
            >
                <Wand size={18} />
                {isGenerating ? 'Generating...' : 'Generate Image'}
            </button>
        </div>
        
        <!-- Display generated image -->
        {#if isGenerating}
            <div class="flex flex-col items-center justify-center space-y-4 py-8">
                <Progress value={undefined} />
                <p class="text-center text-gray-600">Creating your masterpiece...</p>
            </div>
        {:else if selectedImage}
            <div class="mb-6">
                <div class="relative mb-4 overflow-hidden rounded-lg border border-gray-200">
                    <img 
                        src={selectedImage} 
                        alt="Generated by AI" 
                        class="mx-auto max-h-[500px] w-full object-contain"
                    />
                    <button
                        type="button"
                        onclick={saveGeneratedImage}
                        class="absolute bottom-3 right-3 rounded-full bg-primary-600 p-2 text-white shadow-lg hover:bg-primary-700"
                        title="Save to collection"
                    >
                        <Save size={20} />
                    </button>
                </div>
                
                <!-- Refinement section -->
                <div class="mt-4 space-y-3 rounded-lg bg-gray-50 p-4">
                    <h3 class="text-lg font-medium">Refine your image</h3>
                    <textarea
                        bind:value={refinementPrompt}
                        placeholder="Add details or modifications to the current image..."
                        rows="2"
                        class="w-full rounded-md border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    ></textarea>
                    <button
                        type="button"
                        onclick={refineImage}
                        disabled={isGenerating || !refinementPrompt.trim()}
                        class="inline-flex items-center justify-center gap-2 rounded-md bg-secondary-600 px-4 py-2 font-bold text-white transition duration-200 hover:bg-secondary-700 disabled:bg-gray-400"
                    >
                        <RefreshCw size={18} />
                        {isGenerating ? 'Refining...' : 'Refine Image'}
                    </button>
                </div>
            </div>
        {/if}
        
        <!-- Error display -->
        {#if error}
            <div class="mb-4 rounded-md bg-red-100 p-3 text-red-800">
                {error}
            </div>
        {/if}
        
        <!-- Generation history -->
        {#if generationHistory.length > 0}
            <div class="mt-6">
                <h3 class="mb-3 text-lg font-medium">Generation History</h3>
                <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {#each generationHistory as item, i}
                        <!-- svelte-ignore a11y_click_events_have_key_events -->
                        <!-- svelte-ignore a11y_no_static_element_interactions -->
                        <div 
                            class="cursor-pointer overflow-hidden rounded-md border border-gray-200 transition-all hover:shadow-md {selectedImage === item.imageUrl ? 'ring-2 ring-primary-500' : ''}"
                            onclick={() => selectHistoryImage(item.imageUrl)}
                        >
                            <img
                                src={item.imageUrl}
                                alt={`Generation ${i+1}`}
                                class="h-24 w-full object-cover"
                            />
                            <div class="p-1">
                                <p class="truncate text-xs text-gray-600">{item.prompt}</p>
                            </div>
                        </div>
                    {/each}
                </div>
            </div>
        {/if}
    </div>
</div>