import OpenAI from 'openai';

// Create a new OpenAI instance to connect with your OpenAI API key
//const openai = new OpenAI({apiKey: process.env.OPENAI_API_KEY})

const openai = new OpenAI({
    baseURL: 'http://localhost:11434/v1',
    apiKey: 'ollama', // required but unused
  })

//export type MessageBody = { chats: { role: 'user' | 'assistant'; content: string }[]}

export const POST = async ({ request }) => {
    //const body: MessageBody = await request.json()
  
  const completion = await openai.chat.completions.create({
    model: 'llama3.2',
    messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'assistant', content: 'What can I help you with today?' },
        { role: 'user', content: 'What can you tell me about Svelte?' }
    ],
  })
  
  console.log(completion.choices[0].message.content)

  return new Response(JSON.stringify({ message: completion.choices[0].message.content }))
}