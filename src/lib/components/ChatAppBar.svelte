<script lang="ts">
  export let selectedSystemPrompt: string;
  export let selectedExamplePrompt: string;
  export let selectedModel: string;

  const systemPrompts = [
    'Hal 9000',
    'Yoda',
    'Jesse Pinkman',
    'Forest Gump',
    'Dwight Schrute'
  ];

  const examplePrompts = [
    'Explain HTML to a beginner',
    'What is TypeScript?',
    'How do I use Git branches?',
    'Explain the CSS box model',
    'What is the difference between let and const?'
  ];

  const models = [
    { id: 'gpt4o', name: 'GPT-4o' },
    { id: 'deepseek', name: 'DeepSeek (Local)' },
    { id: 'ollama', name: 'Ollama (Local)' }
  ];
</script>

<div class="p-4">
  <h2 class="text-xl font-bold mb-4">Chat Settings</h2>
  
  <div class="mb-6">
    <h3 class="font-semibold mb-2">Choose a Model</h3>
    <div class="space-y-2">
      {#each models as model}
        <label class="flex items-center space-x-2">
          <input 
            type="radio" 
            name="model" 
            value={model.id} 
            bind:group={selectedModel} 
          />
          <span>{model.name}</span>
        </label>
      {/each}
    </div>
  </div>

  <div class="mb-6">
    <h3 class="font-semibold mb-2">Choose a Personality</h3>
    <div class="space-y-2">
      {#each systemPrompts as prompt}
        <label class="flex items-center space-x-2">
          <input 
            type="radio" 
            name="systemPrompt" 
            value={prompt} 
            bind:group={selectedSystemPrompt} 
          />
          <span>{prompt}</span>
        </label>
      {/each}
    </div>
  </div>

  <div class="mb-6">
    <h3 class="font-semibold mb-2">Example Prompts</h3>
    <select 
      class="w-full p-2 text-black bg-white border rounded" 
      bind:value={selectedExamplePrompt}
    >
      <option value="">Select an example prompt</option>
      {#each examplePrompts as prompt}
        <option value={prompt}>{prompt}</option>
      {/each}
    </select>
  </div>
</div>
