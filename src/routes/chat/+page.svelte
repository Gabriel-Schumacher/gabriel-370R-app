<script lang="ts">
	import { Avatar } from '@skeletonlabs/skeleton-svelte';
	import TypingIndicator from '$lib/utils/typingIndicator.svelte';
	import { readableStreamStore } from '$lib/readableStreamStore.svelte';
	import { marked } from 'marked';
	import DOMPurify from 'dompurify';
	import ChatAppBar from '$lib/components/ChatAppBar.svelte';
	import FileUploadAside from '$lib/components/FileUploadAside.svelte';

	let systemPrompt = $state('');
	let examplePrompt = $state('');
	let deepSeek = $state(false);

	let chatHistory = $state(
		typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('chatHistory') || '[]') : []
	);

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
				const cleanedText = stripThinkTags(response.text);
				const parsedText = await marked.parse(cleanedText);
				responseText = DOMPurify.sanitize(parsedText)
					.replace(/<script>/g, '&lt;script&gt;')
					.replace(/<\/script>/g, '&lt;/script&gt;');
			})();
		}
	});

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
						deepSeek
					})
				})
			);

			this.reset(); // clear the form

			const answerText = (await answer) as string;

			const parsedAnswer = await marked.parse(answerText);
			const cleanedAnswer = stripThinkTags(parsedAnswer);
			const purifiedText = DOMPurify.sanitize(cleanedAnswer)
				.replace(/<script>/g, '&lt;script&gt;')
				.replace(/<\/script>/g, '&lt;/script&gt;');

			// put the answer into the chat history with role 'assistant'

			chatHistory = [...chatHistory, { role: 'assistant', content: purifiedText }];

			console.log(answerText);
		} catch (error) {
			console.error(error);
		}
	}

	function deleteAllChats() {
		chatHistory = [];
	}
</script>

<main class="flex min-h-screen flex-col bg-gray-50">
	<!-- The app bar for this page -->
	<ChatAppBar
		bind:selectedSystemPrompt={systemPrompt}
		bind:selectedExamplePrompt={examplePrompt}
		bind:deepSeek
	/>

	<div class="mx-auto max-w-[80%] min-w-[80%]">
		<form
			onsubmit={handleSubmit}
			class="m-4 p-2 flex flex-col"
		>
			<div class="space-y-4">
				<div class="flex space-x-2">
					<Avatar src="/hal9000.jpg" name="Hal tutor image" />
					<div class="assistant-chat">Good Afternoon. How can I help you?</div>
				</div>
				<!-- Need to display each chat item here -->
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
						<div class="mr-auto flex">
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
								<Avatar name="Hal tutor image" src={'/hal9000.jpg'} />
								<div class="assistant-chat">
									{#if response.text === ''}
										<TypingIndicator />
									{:else}
										{@html responseText}
									{/if}
								</div>
							</div>
						</div>
					{/await}
				{/if}
				<div class="space-y-4">
					<hr />
					<div class="flex space-x-4">
						<textarea
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
		<FileUploadAside/>
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
</style>