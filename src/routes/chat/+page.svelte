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
	let deepSeek = $state(false);
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

<main class="flex min-h-screen flex-col bg-gray-50">
	<div class="hover-area">
		<img src="/setting-icon.png" alt="Settings" class="w-10 h-10 m-8" />
	</div>
    <div class="side-nav bg-secondary-300 text-white">
        <ChatAppBar
            bind:selectedSystemPrompt={systemPrompt}
            bind:selectedExamplePrompt={examplePrompt}
            bind:selectedModel={selectedModel}

        />
    </div>


	<div class="mx-auto max-w-[75%] min-w-[75%]">
		<form
			onsubmit={handleSubmit}
			class="m-4 p-2 flex flex-col"
		>
			<div class="space-y-4">
				

				<!-- Need to display each chat item here -->
				 <div class="chat-container h-[60vh] overflow-y-auto space-y-4 px-4">
				<div class="flex space-x-2">
					<Avatar src="/hal9000.jpg" name="Hal tutor image" />
					<div class="assistant-chat">Good Afternoon. How can I help you?</div>
				</div>					
					{#each chatHistory as chat, i}
						{#if chat.role === 'user'}
							<div class="ml-auto flex justify-end">
								<div class="user-chat">
									{chat.content}
								</div>
								<div>
									<Avatar src="/userAvatar.png" name="User image" />
								</div>							
							</div>
							<!-- this else handles the assistant role chat display -->
						{:else}
							<div class="mr-4 flex">
								<div>
									<Avatar src="/hal9000.jpg" name="Hal tutor image" />
								</div>
								<div class="assistant-chat">
									{@html chat.content}
								</div>
							</div>
						{/if}
					{/each}

					{#if response.loading}
						{#await new Promise((res) => setTimeout(res, 400)) then _}
							<div class="flex">
								<div class="flex space-x-2">
									<div>
										<Avatar name="Hal tutor image" src={'/hal9000.jpg'} />										
									</div>

									<div class="assistant-chat">
										{#if response.text === ''}
											<div class="flex">
												<p>Collating &nbsp;</p>
												<TypingIndicator />											
											</div>

										{:else}
											{@html responseText}
										{/if}
									</div>
								</div>
							</div>
						{/await}
					{/if}					
				 </div>

				<div class="space-y-4">
					<hr />
					<div class="flex space-x-4">
						<textarea
							onkeydown={handleKeydown}
							class="textarea"
							required
							placeholder="Type your message..."
							name="message"
							rows="3"
							bind:value={examplePrompt}
						></textarea>
						<div class="flex flex-col justify-between">
							<button type="submit" class="btn preset-filled-primary-200-800">Send</button>
							<button type="button" class="btn preset-filled-secondary-200-800" onclick={deleteAllChats}>Clear Chats</button>
						</div>
					</div>
				</div>
			</div>
		</form>
		<div class="flex gap-1">
			<FileUploadAside/>
			<div>
				<p>You can also upload a file. I will do my best to help you!</p>
				{#if fileNames.length > 0}
				<div class="flex items-center gap-4 flex-wrap">
					{#each fileNames as fileName}
						<div class="flex items-center gap-2">
							<button
								type="button"
								class="btn preset-filled-primary-500">
								<span>{fileName}</span>
								<CircleX onclick={() => deleteFileName(fileName)} />
							</button>
						</div>
					{/each}
				</div>
			{/if}
			</div>			
		</div>

	</div>
</main>

<style lang="postcss">
	.assistant-chat {
		background-color: white;
		margin: 0 1rem;
		padding: 1rem;
		border-radius: 0.5rem;
		box-shadow: 0 0 0.5rem rgba(0, 0, 0, 0.1);
	}
	.user-chat {
		background-color: rgb(var(--color-primary-200) / var(--tw-bg-opacity, 1));
		margin: 0 1rem;
		padding: 1rem;
		border-radius: 0.5rem;
		box-shadow: 0 0 0.5rem rgba(0, 0, 0, 0.1);
	}
	.side-nav {
		position: fixed;
		top: 0;
		left: -250px; /* Hide the nav initially */
		width: 250px;
		height: 100%;
		transition: left 0.3s ease;
		z-index: 1000;
		padding: 1rem;
	}

	/* Adjust hover area to trigger the nav slide */
	.side-nav:hover,
	.hover-area:hover + .side-nav {
		left: 0; /* Show the nav on hover */
	}

	/* Add a hover area to trigger the nav slide */
	.hover-area {
		position: fixed;
		top: 20;
		left: 0;
		width: 50px; /* Adjust this value to change the hover area width */
		height: 100%;
		z-index: 999;
	}
	</style>