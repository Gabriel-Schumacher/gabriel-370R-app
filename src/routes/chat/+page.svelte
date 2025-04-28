<script lang="ts">
	import { Avatar } from '@skeletonlabs/skeleton-svelte';
	import TypingIndicator from '$lib/utils/typingIndicator.svelte';
	import { readableStreamStore } from '$lib/readableStreamStore.svelte';
	import { Marked } from 'marked';
	import { markedHighlight } from 'marked-highlight';
	import DOMPurify from 'dompurify';
	import ChatAppBar from '$lib/components/ChatAppBar.svelte';
	import FileUploadAside from '$lib/components/FileUploadAside.svelte';
	import { CircleX } from 'lucide-svelte'

	import hljs from 'highlight.js';
	import javascript from 'highlight.js/lib/languages/javascript';
	import typescript from 'highlight.js/lib/languages/typescript';
	import css from 'highlight.js/lib/languages/css';

	hljs.registerLanguage('javascript', javascript);
	hljs.registerLanguage('typescript', typescript);
	hljs.registerLanguage('css', css);

	const marked = new Marked(
		markedHighlight({
			langPrefix: 'hljs language-',
			highlight: (code, lang) => {
				const language = hljs.getLanguage(lang) ? lang : 'plaintext'
				return hljs.highlight(code, { language }).value
			}
		})
	)

	interface PageData {
		fileNames?: string[]
	}

	let { data } = $props<{data: PageData}>()

	let systemPrompt = $state('Hal 9000');
	let examplePrompt = $state('');
	let selectedModel = $state('gpt4o');
	// let deepSeek = $state(false);
	let fileNames = $state([] as string[])

	let chatHistory = $state(
		typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('chatHistory') || '[]') : []
	);

	$effect(() => {
		if (data?.fileNames) {
			fileNames = [...data.fileNames]
		}
	})

	$effect(() => {
		if (typeof window !== 'undefined') {
			localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
		}
	});

	const response = readableStreamStore();

	let responseText = $state('');

	// Add this helper function
	function stripThinkTags(text: string): string {
		const thinkRegex = /<think>[\s\S]*?<\/think>/g;
		return text.replace(thinkRegex, '');
	}

	$effect(() => {
		if (response.text !== '') {
			(async () => {
				// Strip <think> tags from the response text
				// const cleanedText = stripThinkTags(response.text);
				const parsedText = await marked.parse(response.text);
				responseText = DOMPurify.sanitize(parsedText)
					.replace(/<script>/g, '&lt;script&gt;')
					.replace(/<\/script>/g, '&lt;/script&gt;');
			})();
		}
	});

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			const target = event.target as HTMLTextAreaElement;
			const form = target.closest('form');
			if (form) {
				handleSubmit.call(form, event);
			}
		}
	}

	async function handleSubmit(this: HTMLFormElement, event: Event) {
		event?.preventDefault();
		if (response.loading) return; // prevent request while waiting for response

		const formData: FormData = new FormData(this);
		const message = formData.get('message');

		if (!message) {
			return;
		}

		chatHistory = [...chatHistory, { role: 'user', content: message as string }];

		try {
			const answer = response.request(
				new Request('/api/chat', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						chats: chatHistory,
						systemPrompt,
						model: selectedModel,
						fileNames,
					})
				})
			);

			this.reset(); // clear the form

			const answerText = (await answer) as string;

			const parsedAnswer = await marked.parse(answerText);
			//const cleanedAnswer = stripThinkTags(parsedAnswer);
			const purifiedText = DOMPurify.sanitize(parsedAnswer)
				.replace(/<script>/g, '&lt;script&gt;')
				.replace(/<\/script>/g, '&lt;/script&gt;');

			// put the answer into the chat history with role 'assistant'

			chatHistory = [...chatHistory, { role: 'assistant', content: purifiedText }, ];

			console.log(answerText);
		} catch (error) {
			console.error(error);
		}
	}

	function deleteAllChats() {
		chatHistory = [];
	}

	function deleteFileName(fileName: string) {
		fileNames = fileNames.filter((name) => name !== fileName)
	}

	// Function to scroll chat history to the bottom
	function scrollToBottom() {
		const chatContainer = document.querySelector('.chat-container');
		if (chatContainer) {
			chatContainer.scrollTop = chatContainer.scrollHeight;
		}
	}

	$effect(() => {
		scrollToBottom();

		// Run the async function without making $effect async
		(async () => {
			if (response.text !== '') {
				// Strip <think> tags from the response text
				const cleanedText = stripThinkTags(response.text);
				const parsedText = await marked.parse(cleanedText);
				responseText = DOMPurify.sanitize(parsedText)
					.replace(/<script>/g, '&lt;script&gt;')
					.replace(/<\/script>/g, '&lt;/script&gt;');
			}
		})();
	});
</script>

<main class="flex min-h-screen bg-gray-50">
	<!-- Sidebar -->
	<aside class="bg-secondary-900 text-white w-72 flex flex-col h-screen transition-all duration-300 ease-in-out overflow-auto shadow-md">
		
		<ChatAppBar
			bind:selectedSystemPrompt={systemPrompt}
			bind:selectedExamplePrompt={examplePrompt}
			bind:selectedModel={selectedModel}
		/>

		<div class="mt-8 p-4 border-t border-secondary-700">
			<button 
				type="button" 
				class="flex items-center gap-2 w-full py-2 px-3 rounded-md text-secondary-300 hover:bg-secondary-700 transition-colors text-sm font-medium"
				onclick={deleteAllChats}
			>
				<span class="material-icons"><img src="/trash-solid.svg" alt="delete" width="15" height="15" class="invert"></span>
				Clear Conversations
			</button>
		</div>
	</aside>

	<!-- Chat Area -->
	<div class="flex-1 flex flex-col h-[80vh]">
		<!-- Chat Header -->
		<header class="bg-white border-b border-gray-200 p-4 flex justify-between items-center sticky top-0 z-10 shadow-sm">
			<h1 class="text-xl font-medium">Chat with {systemPrompt}</h1>
			<div class="flex items-center gap-2">
				<div class="px-2 py-1 rounded-full bg-gray-100 text-secondary-700 text-xs font-medium">
					{selectedModel}
				</div>
				{#if fileNames.length > 0}
					<div class="px-2 py-1 rounded-full bg-blue-100 text-blue-500 text-xs font-medium">
						{fileNames.length} file{fileNames.length > 1 ? 's' : ''}
					</div>
				{/if}
			</div>
		</header>

		<!-- Chat Messages -->
		<div class="flex-1 overflow-y-auto p-4 space-y-6 chat-container mx-20">
			<!-- Initial greeting message -->
			<div class="flex items-start gap-3 max-w-4xl">
				<!-- <div class="flex-shrink-0">
					<Avatar src="/hal9000.jpg" name="Hal tutor image" />
				</div> -->
				<div class="text-secondary-900 max-w-[90%]">
					<p>Hello! I'm your AI assistant. How can I help you today?</p>
				</div>
			</div>
			
			<!-- Chat history -->
			{#each chatHistory as chat, i}
				{#if chat.role === 'user'}
					<div class="flex items-start gap-3 max-w-3xl ml-auto justify-end">
						<div class="p-4 rounded-lg max-w-[60%] bg-primary-500 text-white rounded-bl-none">
							{chat.content}
						</div>
						<!-- <div class="flex-shrink-0">
							<Avatar src="/userAvatar.png" name="User image" />
						</div> -->
					</div>
				{:else}
					<div class="flex items-start gap-3">
						<!-- <div class="flex-shrink-0">
							<Avatar src="/hal9000.jpg" name="Hal tutor image" />
						</div> -->
						<div class="text-secondary-900">
							{@html chat.content}
						</div>
					</div>
				{/if}
			{/each}

			<!-- Loading state -->
			{#if response.loading}
				{#await new Promise((res) => setTimeout(res, 400)) then _}
					<div class="flex items-start gap-3 max-w-4xl">
						<!-- <div class="flex-shrink-0">
							<Avatar name="Hal tutor image" src="/hal9000.jpg" />
						</div> -->
						<div class="max-w-[90%] text-secondary-900">
							{#if response.text === ''}
								<div class="flex items-center">
									<span>Thinking</span>
									<TypingIndicator />
								</div>
							{:else}
								{@html responseText}
							{/if}
						</div>
					</div>
				{/await}
			{/if}
		</div>

		<!-- File display area -->
		{#if fileNames.length > 0}
			<div class="px-4 py-2 border-t border-gray-200 bg-gray-50">
				<h3 class="text-sm font-medium text-gray-500">Uploaded Files:</h3>
				<div class="flex flex-wrap gap-2 mt-1">
					{#each fileNames as fileName}
						<div class="flex items-center gap-1 bg-primary-100 text-primary-700 px-2 py-1 rounded-md text-xs">
							<span class="truncate max-w-[150px]">{fileName}</span>
							<button 
								type="button" 
								class="text-primary-400 hover:text-primary-700" 
								onclick={() => deleteFileName(fileName)} 
								aria-label="Remove file {fileName}"
							>
								<CircleX size={16} />
							</button>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Chat Input -->
		<form onsubmit={handleSubmit} class="p-4 border-t border-gray-200 bg-white">
			<div class="flex items-end rounded-lg border border-gray-300 bg-white overflow-hidden shadow-sm">
				<textarea
					onkeydown={handleKeydown}
					class="w-full p-3 focus:outline-none text-secondary-900"
					required
					placeholder="Message..."
					name="message"
					rows="1"
					bind:value={examplePrompt}
					style="max-height: 200px;"
				></textarea>
					<button 
						type="submit" 
						class="p-2 rounded-full bg-primary-500 text-white m-1 flex items-center justify-center hover:bg-primary-600 transition-colors h-9 w-9 disabled:bg-gray-300 disabled:cursor-not-allowed" 
						disabled={response.loading} 
						aria-label="Send message"
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M22 2L11 13"></path>
							<path d="M22 2L15 22L11 13L2 9L22 2Z"></path>
						</svg>
					</button>				

			</div>
				<div class="flex items-center p-2">
					<FileUploadAside />

				</div>			
		</form>
	</div>
</main>

