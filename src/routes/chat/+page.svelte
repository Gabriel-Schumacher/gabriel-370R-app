<script lang="ts">
	import { Avatar } from '@skeletonlabs/skeleton-svelte';
    import TypingIndicator from '$lib/utils/TypingIndicator.svelte';
	import { readableStreamStore } from '$lib/readableStreamStore.svelte';
    import { marked } from 'marked'
    import DOMPurify from 'dompurify'

	type MessageBody = { chats: { role: 'user' | 'assistant'; content: string }[] };

	//let chatHistory: MessageBody['chats'] = [];

	let chatHistory = $state(
		typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('chatHistory') || '[]') : []
	);

	$effect(() => {
		if (typeof window !== 'undefined') {
			localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
		}
	});

	const response = readableStreamStore();

    let responseText = $state('')

    $effect(() => {
		if (response.text !== '') {
			(async () => {
				const parsedText = await marked.parse(response.text);
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
						chats: chatHistory
					})
				})
			);

			this.reset(); // clear the form

			const answerText = (await answer) as string;

			// put the answer into the chat history with role 'assistant'

			chatHistory = [...chatHistory, { role: 'assistant', content: answerText }];

			console.log(answerText);
		} catch (error) {
			console.error(error);
		}
	}
</script>

<main class="container card bg-gray-100 shadow-md border-surface-200-800 w-1/2 p-4 mx-auto my-4">
	<form onsubmit={handleSubmit}>
		<div class="space-y-4">
			<div class="flex space-x-2">
				<Avatar src="/hal9000.jpg" name="Tutor girl image" />
				<div class="assistant-chat container card bg-gray-50 shadow-md border-surface-200-800 p-4">Hello! How can I help you?</div>
			</div>

			{#each chatHistory as chat, i}
				{#if chat.role === 'user'}
					<div class="flex">

						<div class="user-chat container card bg-gray-50 shadow-md border-surface-200-800 p-4">
							{chat.content}
						</div>
						<Avatar src="/userAvatar.png" name="User image" />                        
					</div>
				{/if}
			{/each}

			<div class="flex">
				<div class="flex space-x-2 container card bg-gray-50 shadow-md border-surface-200-800 p-4">
                    <!-- <Avatar src="/userAvatar.png" name="User image" /> -->
					<div class="assistant-chat">
						{#if response.text === ''}
							<TypingIndicator />
						{:else}
							{@html responseText}
						{/if}
					</div>
				</div>
			</div>

			<textarea class="textarea" required placeholder="Type your message..." name="message" rows="3"
			></textarea>
			<button type="submit">Send</button>
		</div>
	</form>
</main>