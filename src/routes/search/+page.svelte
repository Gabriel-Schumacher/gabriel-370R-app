<script lang="ts">
    import type { ActionData, PageData } from './$types'
    import { testData } from './test-data'; 

    type ImageResult = {
        id: string;
        thumbnailUrl: string;
        title: string;
    }

const props = $props<{ data: PageData; form: ActionData }>();

let results = $state<ImageResult[]>([]);

console.log(props.form);

</script>

<main class="container mx-auto max-w-4xl p-4">
    <h1 class="mb-6 text-center text-3xl font-bold text-primary-700">AI Image Search</h1>
    <div class="mb-8 rounded-lg bg-white p-6 shadow-lg">
		<h2 class="mb-4 text-xl font-semibold">Search Images</h2>
        <form
        method="POST"
        action="?/imageSearch"
        class="flext items-center space-x-2">
        <div class="flex-grow">
            <input
            type="text"
            name="query"
            placeholder="Search for images"
            class="w-full p-2 border border-gray-300 rounded-lg"
            />
        </div>
        <button
        type="submit"
        class="bg-primary-500 text-white p-2 rounded-lg">
        Search
        </button>
        </form>
    </div>

    <div>
        {#each testData.images as result, i}
        <li class="flex items-center space-x-4">
            <div>
                <p>Title: {result.title}</p>
                <img src={result.thumbnailUrl} alt={result.title} class="w-32 h-32" />
            </div>
        </li>
        {/each}
    </div>
</main>