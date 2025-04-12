<script lang="ts">
	import type { ActionResult } from '@sveltejs/kit';
	import type { ActionData, PageData } from './$types';
    import { enhance } from '$app/forms';
	// import { testData } from './test-data';
	type ImageResult = {
		id: string
		thumbnailUrl: string
		title: string
		[key: string]: any // Allow for additional properties
	}

	const props = $props<{ data: PageData; form: ActionData }>();

	let searchPerformed = $state(false);
	let searchQuery = $state('');
	let results = $state<ImageResult[]>([]);

	function handleSubmit() {
		return async ({ result }: { result: ActionResult }) => {
			console.log('Form submission result:', result);
			if (result.type === 'success' && result.data) {
				searchPerformed = true;
				searchQuery = result.data.searchQuery || '';

				// Ensure we have an array of properly typed objects
				if (Array.isArray(result.data.images)) {
					results = result.data.images.map((img: any) => ({
						id: img.id || '',
						title: img.title || 'Untitled',
						thumbnailUrl: img.thumbnailUrl || '',
						...img // Include any other properties
					}));
				} else {
					results = [];
				}

				console.log(`Got ${results.length} results for "${searchQuery}"`);
			}
		};
	}

	console.log(props.form);
</script>

<main class="container mx-auto max-w-4xl p-4">
	<h1 class="text-primary-700 mb-6 text-center text-3xl font-bold">AI Image Search</h1>
	<div class="mb-8 rounded-lg bg-white p-6 shadow-lg">
		<h2 class="mb-4 text-xl font-semibold">Search Database for Images</h2>
		<form method="POST" action="?/imageSearch" class="flext items-center space-x-2" use:enhance={handleSubmit}>
			<div class="flex-grow">
				<input
					type="text"
					name="query"
					placeholder="Search for images"
					class="w-full rounded-lg border border-gray-300 p-2"
				/>
			</div>
			<button type="submit" class="bg-primary-500 rounded-lg p-2 text-white mt-4"> Search </button>
		</form>
	</div>

	<div class="grid grid-cols-2 gap-4">
		{#each results as result, i}
			<li class="flex items-center space-x-4 card rounded-lg bg-white p-4 shadow-md">
				<div>
					<img src={result.thumbnailUrl} alt={result.title} class="w-full h-auto" />
				</div>
				<div>
					<p class="h4">Title: {result.title}</p>                    
                    <p>Rank: {i + 1}</p>
					<p>Distance: {result.distance}</p>
					<p>Match Score: {result.matchScore}</p>
				</div>
			</li>
		{/each}
	</div>
</main>
