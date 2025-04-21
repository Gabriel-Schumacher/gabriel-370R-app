interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export interface MessageBody {
    chats: Array<{
        role: string;
        content: string;
    }>;
    systemPrompt: string;
    model: string;
    fileNames?: string[];
}