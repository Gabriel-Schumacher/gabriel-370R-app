<script lang='ts'>
    import type { PageData } from './$types';

    let { data }: { data: PageData } = $props()

    console.log(data)

</script>

<div class="container m-4">
    <h1>Check Readiness</h1>
    {#if data.ready}
        <p class="text-green-500">Weaviate is ready!</p>
    {:else}
        <p class="text-red-500">Weaviate is not ready.</p>
    {/if}
    
</div>
