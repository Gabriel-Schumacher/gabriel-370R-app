<script lang="ts">

	let systemPrompts = ['Hal 9000', 'Yoda', 'Jesse Pinkman', 'Forest Gump', 'Dwight Schrute'];

	let examplePrompts = [
		'Tell me a joke',
		'Explain quantum computing',
		'Write a haiku about programming',
		'Describe the benefits of exercise'
	];

	let {
		selectedSystemPrompt = $bindable(systemPrompts[0]),
		selectedExamplePrompt = $bindable(''),
		deepSeek = $bindable(false)
	} = $props<{
		selectedSystemPrompt?: string;
		selectedExamplePrompt?: string;
		deepSeek?: boolean;
	}>();
</script>

<nav class="w-full p-4">
	<div class="container mx-auto justify-between">
		<div class="mb-4 text-xl font-bold">AI Chat Settings</div>

		<div class="items-center space-y-4">
			<!-- System Prompt Dropdown -->
			<div class="relative">
				<select
					class="w-full rounded-md bg-secondary-900 px-4 py-2"
					bind:value={selectedSystemPrompt}
				>
					{#each systemPrompts as prompt}
						<option value={prompt}>{prompt}</option>
					{/each}
				</select>
			</div>

			<!-- Example Prompts Dropdown -->
			<div class="relative">
				<select
					class="w-full rounded-md bg-secondary-900 px-4 py-2"
					bind:value={selectedExamplePrompt}
				>
					<option value="">Select an example prompt</option>
					{#each examplePrompts as prompt}
						<option value={prompt}>{prompt}</option>
					{/each}
				</select>
			</div>

			<!-- JSON Mode Toggle -->
			<div class="flex items-center">
				<span class="mr-2 text-white">Use DeepSeek?</span>
				<!-- svelte-ignore a11y_consider_explicit_label -->
				<button
					class={`h-6 w-12 rounded-full p-1 ${deepSeek ? 'bg-red-600' : 'bg-gray-400'}`}
					onclick={() => (deepSeek = !deepSeek)}
				>
					<div
						class={`h-4 w-4 transform rounded-full bg-white transition-transform ${
							deepSeek ? 'translate-x-6' : ''
						}`}
					></div>
				</button>
			</div>
		</div>
	</div>
</nav>

{#if selectedSystemPrompt}
	<div class="mt-4 bg-yellow-100 p-4">
		<p class="text-primary-800">System Prompt: {selectedSystemPrompt}</p>
	</div>
{/if}
