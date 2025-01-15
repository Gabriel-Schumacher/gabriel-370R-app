<script lang='ts'>
    import type { PageData } from './$types';

    let { data }: { data: PageData } = $props()

    console.log(data)

</script>

<div class="container m-4">
    <h1>Check Readiness</h1>
    <p>Is Weaviate ready?: {data.ready ? 'Yes' : 'No'}</p>    
</div>
