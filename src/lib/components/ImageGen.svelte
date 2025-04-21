<script lang="ts">
    import { enhance } from '$app/forms';
    import { invalidateAll } from '$app/navigation';
    import { Avatar, Progress } from '@skeletonlabs/skeleton-svelte';
    import { Wand, RefreshCw, Save, Upload, X, Trash2 } from 'lucide-svelte';
    import { goto } from '$app/navigation';
    import { onMount } from 'svelte';
    
    // Model selection state
    let selectedModel = $state('flux-schnell');
    
    // Track state
    let prompt = $state('');
    let refinementPrompt = $state('');
    let generatedImageUrl = $state<string | null>(null);
    let isGenerating = $state(false);
    let error = $state<string | null>(null);
    let generationHistory = $state<{prompt: string, imageUrl: string}[]>([]);
    let selectedImage = $state<string | null>(null);
    
    // Reference image state
    let referenceImage = $state<File | null>(null);
    let referenceImagePreview = $state<string | null>(null);
    
    // Local Storage key for history
    const HISTORY_STORAGE_KEY = 'imageGenHistory';
    
    // Load history from local storage on component mount
    onMount(() => {
        try {
            const savedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
            if (savedHistory) {
                generationHistory = JSON.parse(savedHistory);
                console.log('Loaded generation history from local storage:', generationHistory.length, 'items');
            }
        } catch (err) {
            console.error('Failed to load history from local storage:', err);
        }
    });
    
    // Save history to local storage
    function saveHistoryToStorage() {
        try {
            localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(generationHistory));
        } catch (err) {
            console.error('Failed to save history to local storage:', err);
        }
    }
    
    // Clear generation history
    function clearGenerationHistory() {
        if (confirm('Are you sure you want to clear your generation history?')) {
            generationHistory = [];
            saveHistoryToStorage();
        }
    }
    
    // Handle reference image upload
    function handleReferenceImageUpload(event: Event) {
        const input = event.target as HTMLInputElement;
        if (!input.files?.length) {
            clearReferenceImage();
            return;
        }
        
        const file = input.files[0];
        if (file && file.type.startsWith('image/')) {
            referenceImage = file;
            
            // Create a preview of the image
            const reader = new FileReader();
            reader.onload = (e) => {
                referenceImagePreview = e.target?.result as string;
            };
            reader.readAsDataURL(file);
        }
    }
    
    // Handle model selection change
    function handleModelChange(model: string) {
        selectedModel = model;
    }
    
    function clearReferenceImage() {
        referenceImage = null;
        referenceImagePreview = null;
        const input = document.getElementById('reference-image') as HTMLInputElement;
        if (input) input.value = '';
    }
    
    // Handle initial image generation
    async function generateImage() {
        if (!prompt.trim()) {
            error = 'Please enter a prompt';
            return;
        }
        
        // If user selected flux-redux-dev but didn't provide a reference image
        if ((selectedModel === 'flux-redux-dev' || selectedModel === 'flux-canny-dev') && !referenceImage) {
            error = 'Reference image is required when using Flux Redux or Flux Canny';
            return;
        }
        
        isGenerating = true;
        error = null;
        
        try {
            // Create FormData to send both prompt and reference image
            const formData = new FormData();
            formData.append('prompt', prompt);
            formData.append('model', selectedModel);
            
            if (referenceImage) {
                formData.append('referenceImage', referenceImage);
            }
            
            const response = await fetch('/api/imageGen', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`Error: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.success && result.imageUrl) {
                generatedImageUrl = result.imageUrl;
                selectedImage = result.imageUrl;
                
                // Add to history and save to local storage
                generationHistory = [...generationHistory, {
                    prompt,
                    imageUrl: result.imageUrl
                }];
                saveHistoryToStorage();
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
            // Create FormData for refinement (similar to generateImage)
            const formData = new FormData();
            formData.append('prompt', refinementPrompt);
            formData.append('originalImageUrl', selectedImage);
            formData.append('model', selectedModel);
            
            if (referenceImage) {
                formData.append('referenceImage', referenceImage);
            }
            
            const response = await fetch('/api/refine-image', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`Error: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.success && result.imageUrl) {
                generatedImageUrl = result.imageUrl;
                selectedImage = result.imageUrl;
                
                // Add to history and save to local storage
                generationHistory = [...generationHistory, {
                    prompt: refinementPrompt,
                    imageUrl: result.imageUrl
                }];
                saveHistoryToStorage();
                
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
            <!-- Model selection -->
            <div>
                <p class="mb-1 block text-sm font-medium text-gray-700">
                    Select AI Model
                </p>
                <div class="grid grid-cols-1 gap-2 md:grid-cols-3">
                    <label class="flex cursor-pointer items-center rounded-md border border-gray-300 px-4 py-2 hover:bg-gray-50 {selectedModel === 'flux-schnell' ? 'border-primary-500 bg-primary-50' : ''}">
                        <input 
                            type="radio" 
                            name="model" 
                            value="flux-schnell"
                            checked={selectedModel === 'flux-schnell'}
                            onclick={() => handleModelChange('flux-schnell')}
                            class="mr-2 text-primary-600"
                        />
                        <div>
                            <h5 class="h5">Text to Image</h5>
                            <span class="font-medium">Flux Schnell</span>
                            <p class="text-xs text-gray-600">Fast image generation</p>
                            <p class="text-xs text-gray-600">$0.003 per image</p>
                        </div>
                    </label>
                    
                    <label class="flex cursor-pointer items-center rounded-md border border-gray-300 px-4 py-2 hover:bg-gray-50 {selectedModel === 'flux-1.1-pro' ? 'border-primary-500 bg-primary-50' : ''}">
                        <input 
                            type="radio" 
                            name="model" 
                            value="flux-1.1-pro"
                            checked={selectedModel === 'flux-1.1-pro'}
                            onclick={() => handleModelChange('flux-1.1-pro')}
                            class="mr-2 text-primary-600"
                        />
                        <div>
                            <h5 class="h5">High Quality</h5>
                            <span class="font-medium">Flux Pro 1.1</span>
                            <p class="text-xs text-gray-600">Premium image quality</p>
                            <p class="text-xs text-gray-600">$0.04 per image</p>
                        </div>
                    </label>
                    
                    <label class="flex cursor-pointer items-center rounded-md border border-gray-300 px-4 py-2 hover:bg-gray-50 {selectedModel === 'flux-canny-dev' ? 'border-primary-500 bg-primary-50' : ''}">
                        <input 
                            type="radio" 
                            name="model" 
                            value="flux-canny-dev"
                            checked={selectedModel === 'flux-canny-dev'}
                            onclick={() => handleModelChange('flux-canny-dev')}
                            class="mr-2 text-primary-600"
                        />
                        <div>
                            <h5 class="h5">Image to Image</h5>
                            <span class="font-medium">Flux Canny</span>
                            <p class="text-xs text-gray-600">Edge-based transformation</p>
                            <p class="text-xs text-gray-600">$0.025 per image</p>
                        </div>
                    </label>
                </div>
            </div>
            
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
            
            <!-- Reference Image Upload -->
            {#if selectedModel === 'flux-redux-dev' || selectedModel === 'flux-canny-dev'}
            <div>
                <label for="reference-image" class="mb-1 block text-sm font-medium text-gray-700">
                    Reference Image {selectedModel === 'flux-canny-dev' ? '(Required)' : '(Optional)'}
                </label>
                <div class="flex items-center gap-3">
                    <input
                        type="file"
                        id="reference-image"
                        accept="image/*"
                        onchange={handleReferenceImageUpload}
                        class="file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 block
                              w-full text-sm text-gray-500
                              file:mr-4 file:rounded-md
                              file:border-0 file:px-4
                              file:py-2 file:text-sm
                              file:font-semibold"
                    />
                    {#if referenceImagePreview}
                        <button 
                            type="button" 
                            class="text-red-500 hover:text-red-700" 
                            onclick={clearReferenceImage}
                        >
                            <X size={18} />
                        </button>
                    {/if}
                </div>
                
                {#if referenceImagePreview}
                    <div class="mt-2 rounded-md border border-gray-200 p-2">
                        <p class="mb-1 text-xs text-gray-600">Reference Image:</p>
                        <img 
                            src={referenceImagePreview} 
                            alt="Reference" 
                            class="mx-auto h-24 object-contain"
                        />
                    </div>
                {/if}
                
                {#if selectedModel === 'flux-canny-dev'}
                    <div class="mt-2">
                        <p class="text-xs text-gray-600">
                            The Flux Canny model uses edge detection to transform your reference image 
                            according to your prompt.
                        </p>
                    </div>
                {/if}
            </div>
            {/if}
            
            <button
                type="button"
                onclick={generateImage}
                disabled={isGenerating || !prompt.trim() || (selectedModel === 'flux-canny-dev' && !referenceImage)}
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
                <div class="flex justify-between items-center mb-3">
                    <h3 class="text-lg font-medium">Generation History</h3>
                    <button 
                        type="button" 
                        onclick={clearGenerationHistory}
                        class="flex items-center text-sm text-red-600 hover:text-red-800"
                    >
                        <Trash2 size={16} class="mr-1" />
                        Clear History
                    </button>
                </div>
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
                                onerror={(e) => {
                                    (e.target as HTMLImageElement).src = '/placeholder-image.png';
                                    (e.target as HTMLImageElement).alt = 'Image not available';
                                }}
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