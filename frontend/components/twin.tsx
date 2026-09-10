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
}

type TwinProps = {
    onBusy?: (busy: boolean) => void;
    compact?: boolean;
    pendingPrompt?: string;
    onPromptConsumed?: () => void;
};

const CHIPS = [
    { label: 'Thesis', prompt: "What is your master's thesis about?" },
    { label: 'Work', prompt: 'Where have you worked?' },
    { label: 'This project', prompt: 'How is this digital twin built and deployed?' },
] as const;

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

    const sendMessage = async (raw?: string) => {
        const content = (raw ?? input).trim();
        if (!content || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content,
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: userMessage.content,
                    session_id: sessionId || undefined,
                }),
            });

            if (!response.ok) throw new Error('Failed to send message');

            const data = await response.json();

            if (!sessionId) {
                setSessionId(data.session_id);
            }

            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: data.response,
                timestamp: new Date(),
                sources: data.sources || [],
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            console.error('Error:', error);
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please try again.',
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, errorMessage]);
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
                                className="rounded-sm border border-[#2d3a4a] bg-[#151b24] px-3 py-1.5 text-sm text-[#c5d0dc] transition-colors hover:border-[#67e8f9]/50 hover:text-[#e8eef4] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {chip.label}
                            </button>
                        ))}
                    </div>
                )}
            </header>

            <div className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-sm border border-[#2d3a4a] bg-[#10151c]/90 shadow-[0_0_80px_rgba(103,232,249,0.06)] ${compact ? '' : 'min-h-[28rem]'}`}>
                <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
                    {messages.map((message) => (
                        <div
                            key={message.id}
                            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[78%] rounded-sm px-4 py-3 ${
                                    message.role === 'user'
                                        ? 'border border-[#67e8f9]/30 bg-[#163044] text-[#e8eef4]'
                                        : 'border border-[#2d3a4a] bg-[#151b24] text-[#c5d0dc]'
                                }`}
                            >
                                {message.role === 'assistant' ? (
                                    <div className="twin-md">
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
                        </div>
                    ))}

                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="border border-[#2d3a4a] bg-[#151b24] px-4 py-3 text-sm text-[#67e8f9]/80">
                                …
                            </div>
                        </div>
                    )}

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
