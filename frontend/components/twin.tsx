'use client';

import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Source {
    title: string;
    source: string;
    source_type: string;
}

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    sources?: Source[];
    intent?: string;
    error?: boolean;
}

type Chip = { label: string; prompt: string };

const CHIP_CLASS =
    'rounded-sm border border-[#2d3a4a] bg-[#151b24] px-3 py-1.5 text-sm text-[#c5d0dc] transition-colors hover:border-[#67e8f9]/50 hover:text-[#e8eef4] disabled:cursor-not-allowed disabled:opacity-50';

type TwinProps = {
    onBusy?: (busy: boolean) => void;
    compact?: boolean;
    pendingPrompt?: string;
    onPromptConsumed?: () => void;
};

const CHIPS: Chip[] = [
    { label: 'Thesis', prompt: "What is your master's thesis about?" },
    { label: 'Work', prompt: 'Where have you worked?' },
    { label: 'This project', prompt: 'How is this digital twin built and deployed?' },
];

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');

const FOLLOWUPS: Record<string, Chip[]> = {
    tfm: [
        { label: '17,301× speedup', prompt: 'How much faster were the surrogate models than the physics engine?' },
        { label: 'PINN recall', prompt: 'How did the Physics-Informed Neural Network change collision detection recall?' },
        { label: 'Official title', prompt: "What is the official title of your master's thesis?" },
    ],
    experience: [
        { label: 'LSTM R² 0.69', prompt: 'What R² did your LSTM traffic forecast reach at Managing Innovation Strategies?' },
        { label: 'Getecsa remote', prompt: 'What did you do at Getecsa for Internet Brands / Nolo Legal?' },
        { label: 'SHAP', prompt: 'How did you use SHAP in the MainStrat internship?' },
    ],
    project: [
        { label: 'Public documents', prompt: 'Which public documents does this twin retrieve with RAG?' },
        { label: 'Terraform teardown', prompt: 'How is this digital twin deployed and torn down with Terraform?' },
        { label: 'How it is built', prompt: 'How is this digital twin built and deployed?' },
    ],
    other: CHIPS,
};

function chipsForIntent(intent?: string): Chip[] {
    return FOLLOWUPS[intent ?? ''] ?? FOLLOWUPS.other;
}

export default function Twin({ onBusy, compact = false, pendingPrompt, onPromptConsumed }: TwinProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId, setSessionId] = useState<string>('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        onBusy?.(isLoading);
    }, [isLoading, onBusy]);

    const applyAssistantResult = (
        assistantId: string,
        data: { response?: string; session_id?: string; sources?: Source[]; intent?: string },
        replaceContent: boolean,
    ) => {
        if (data.session_id) {
            setSessionId(data.session_id);
        }
        setMessages(prev =>
            prev.map((message) =>
                message.id === assistantId
                    ? {
                          ...message,
                          content: replaceContent ? (data.response || message.content) : message.content,
                          sources: data.sources || [],
                          intent: data.intent || 'other',
                      }
                    : message,
            ),
        );
    };

    const postChat = async (payload: { message: string; session_id?: string }) => {
        const response = await fetch(`${API_BASE}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error('Failed to send message');
        return response.json();
    };

    const consumeStream = async (
        payload: { message: string; session_id?: string },
        onText: (chunk: string) => void,
    ) => {
        const response = await fetch(`${API_BASE}/chat/stream`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'text/event-stream',
            },
            body: JSON.stringify(payload),
        });
        if (!response.ok || !response.body) {
            throw new Error('Failed to stream message');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let donePayload: { session_id?: string; sources?: Source[]; intent?: string } | null = null;

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const parts = buffer.split('\n\n');
            buffer = parts.pop() ?? '';
            for (const part of parts) {
                const line = part.split('\n').find((entry) => entry.startsWith('data: '));
                if (!line) continue;
                const event = JSON.parse(line.slice(6));
                if (event.error) throw new Error(event.error);
                if (event.text) onText(event.text);
                if (event.done) {
                    donePayload = event;
                }
            }
        }

        if (!donePayload) throw new Error('Stream ended without a done event');
        return donePayload;
    };

    const sendMessage = async (raw?: string) => {
        const content = (raw ?? input).trim();
        if (!content || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content,
            timestamp: new Date(),
        };
        const assistantId = (Date.now() + 1).toString();
        const assistantMessage: Message = {
            id: assistantId,
            role: 'assistant',
            content: '',
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMessage, assistantMessage]);
        setInput('');
        setIsLoading(true);

        const payload = {
            message: userMessage.content,
            session_id: sessionId || undefined,
        };

        try {
            try {
                const done = await consumeStream(payload, (chunk) => {
                    setMessages(prev =>
                        prev.map((message) =>
                            message.id === assistantId
                                ? { ...message, content: message.content + chunk }
                                : message,
                        ),
                    );
                });
                applyAssistantResult(assistantId, done, false);
            } catch (streamError) {
                console.error('Stream failed, falling back to /chat', streamError);
                const data = await postChat(payload);
                applyAssistantResult(assistantId, data, true);
            }
        } catch (error) {
            console.error('Error:', error);
            setMessages(prev =>
                prev.map((message) =>
                    message.id === assistantId
                        ? {
                              ...message,
                              content: 'Sorry, I encountered an error. Please try again.',
                              error: true,
                          }
                        : message,
                ),
            );
        } finally {
            setIsLoading(false);
            setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
        }
    };

    useEffect(() => {
        const prompt = pendingPrompt?.trim();
        if (!prompt || isLoading) return;
        onPromptConsumed?.();
        void sendMessage(prompt);
        // One-shot seed from a node panel; sendMessage is recreated each render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pendingPrompt]);

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    return (
        <div className={`flex flex-1 flex-col ${compact ? 'min-h-0 h-full' : 'min-h-[calc(100vh-1.5rem)] md:min-h-[calc(100vh-2rem)]'}`}>
            <header className={`shrink-0 text-center ${compact ? 'mb-2' : 'mb-3'}`}>
                {!compact && (
                    <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-[0.08em] text-[#e8eef4] md:text-5xl">
                        Esteban Ruiz
                    </h1>
                )}
                <p className={`text-[#e8eef4] ${compact ? 'text-sm' : 'mt-2 text-base md:text-lg'}`}>
                    Ask anything about me!
                </p>
                {messages.length === 0 && (
                    <div className={`flex flex-wrap justify-center gap-2 ${compact ? 'mt-2' : 'mt-3'}`}>
                        {CHIPS.map((chip) => (
                            <button
                                key={chip.label}
                                type="button"
                                onClick={() => sendMessage(chip.prompt)}
                                disabled={isLoading}
                                className={CHIP_CLASS}
                            >
                                {chip.label}
                            </button>
                        ))}
                    </div>
                )}
            </header>

            <div className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-sm border border-[#2d3a4a] bg-[#10151c]/90 shadow-[0_0_80px_rgba(103,232,249,0.06)] ${compact ? '' : 'min-h-[28rem]'}`}>
                <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
                    {messages.map((message, index) => {
                        const isLastAssistant =
                            message.role === 'assistant' &&
                            !message.error &&
                            !isLoading &&
                            index === messages.length - 1;
                        const followups = isLastAssistant ? chipsForIntent(message.intent) : [];

                        return (
                        <div
                            key={message.id}
                            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div className="max-w-[78%]">
                            <div
                                className={`rounded-sm px-4 py-3 ${
                                    message.role === 'user'
                                        ? 'border border-[#67e8f9]/30 bg-[#163044] text-[#e8eef4]'
                                        : 'border border-[#2d3a4a] bg-[#151b24] text-[#c5d0dc]'
                                }`}
                            >
                                {message.role === 'assistant' ? (
                                    <div className="twin-md">
                                        {message.content ? (
                                        <ReactMarkdown
                                            skipHtml
                                            remarkPlugins={[remarkGfm]}
                                            components={{
                                                a: ({ href, children }) => (
                                                    <a href={href} target="_blank" rel="noreferrer">
                                                        {children}
                                                    </a>
                                                ),
                                            }}
                                        >
                                            {message.content}
                                        </ReactMarkdown>
                                        ) : (
                                            <p className="text-sm text-[#67e8f9]/80">…</p>
                                        )}
                                    </div>
                                ) : (
                                    <p className="whitespace-pre-wrap">{message.content}</p>
                                )}
                                {message.role === 'assistant' && message.sources && message.sources.length > 0 && (
                                    <details className="mt-2 border-t border-[#2d3a4a] pt-2">
                                        <summary className="cursor-pointer text-[11px] uppercase tracking-wide text-[#67e8f9]/80">
                                            Sources
                                        </summary>
                                        <ul className="mt-1 space-y-1">
                                            {message.sources.map((source) => (
                                                <li key={`${source.source}-${source.title}`} className="text-xs text-[#93a4b8]">
                                                    {source.title} · {source.source}
                                                </li>
                                            ))}
                                        </ul>
                                    </details>
                                )}
                                <p
                                    className={`mt-1 text-xs ${
                                        message.role === 'user' ? 'text-[#67e8f9]/70' : 'text-[#6b7c90]'
                                    }`}
                                >
                                    {message.timestamp.toLocaleTimeString()}
                                </p>
                            </div>
                            {followups.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {followups.map((chip) => (
                                        <button
                                            key={chip.label}
                                            type="button"
                                            onClick={() => sendMessage(chip.prompt)}
                                            disabled={isLoading}
                                            className={CHIP_CLASS}
                                        >
                                            {chip.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                            </div>
                        </div>
                        );
                    })}


                    <div ref={messagesEndRef} />
                </div>

                <div className="border-t border-[#2d3a4a] bg-[#0c1118] p-4">
                    <div className="flex gap-2">
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyPress}
                            placeholder="Ask anything about me"
                            className="flex-1 rounded-sm border border-[#2d3a4a] bg-[#151b24] px-4 py-2.5 text-[#e8eef4] outline-none ring-[#67e8f9] placeholder:text-[#6b7c90] focus:ring-1"
                            disabled={isLoading}
                            autoFocus
                        />
                        <button
                            onClick={() => sendMessage()}
                            disabled={!input.trim() || isLoading}
                            className="rounded-sm bg-[#163044] px-4 py-2 text-[#67e8f9] transition-colors hover:bg-[#1d4d6b] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <Send className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
