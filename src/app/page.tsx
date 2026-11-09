'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import ModeSelector from '@/components/ModeSelector';
import MessageItem from '@/components/MessageItem';
import ChatInput from '@/components/ChatInput';
import { ChatMessage, Conversation, MessageAttachment, ResponseMode } from '@/lib/types';
import { Menu, Terminal, Database, FileSpreadsheet, Cloud, AlertCircle, Plus } from 'lucide-react';

const SUGGESTIONS = [
  {
    icon: Database,
    title: 'SQL Query',
    prompt: 'Write an optimized PostgreSQL query using window functions to calculate a 7-day rolling average revenue.',
  },
  {
    icon: Terminal,
    title: 'Python Performance',
    prompt: 'Refactor this nested Python dictionary iteration into an efficient list comprehension / generator.',
  },
  {
    icon: FileSpreadsheet,
    title: 'Excel Formula',
    prompt: 'Provide an Excel formula to look up a price based on Product Name in Col A and Tier in Col B.',
  },
  {
    icon: Cloud,
    title: 'Cloud & DevOps',
    prompt: 'How to configure an AWS S3 bucket policy for least-privilege read-only access from an EC2 instance profile?',
  },
];

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [mode, setMode] = useState<ResponseMode>('answer_only');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  // Fetch conversations list on mount
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/conversations');
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Load active conversation messages
  const loadConversation = useCallback(async (id: string) => {
    try {
      setErrorMessage(null);
      const res = await fetch(`/api/conversations/${id}`);
      if (res.ok) {
        const data = await res.json();
        setActiveConversationId(id);
        setMessages(data.messages || []);
        if (data.conversation?.mode) {
          setMode(data.conversation.mode);
        }
        setTimeout(() => scrollToBottom('auto'), 50);
      }
    } catch (err) {
      console.error('Failed to fetch conversation messages:', err);
    }
  }, [scrollToBottom]);

  // Handle switching conversations
  const handleSelectConversation = (id: string) => {
    if (isStreaming) {
      handleStopStreaming();
    }
    loadConversation(id);
  };

  // Handle starting a new conversation
  const handleNewConversation = () => {
    if (isStreaming) {
      handleStopStreaming();
    }
    setActiveConversationId(null);
    setMessages([]);
    setStreamingText('');
    setErrorMessage(null);
  };

  // Handle deleting a conversation
  const handleDeleteConversation = async (id: string) => {
    try {
      const res = await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (activeConversationId === id) {
          handleNewConversation();
        }
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  // Change mode and update server if in existing conversation
  const handleModeChange = async (newMode: ResponseMode) => {
    setMode(newMode);
    if (activeConversationId) {
      try {
        await fetch(`/api/conversations/${activeConversationId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: newMode }),
        });
      } catch {
        // Non-critical
      }
    }
  };

  // Send message with SSE streaming
  const handleSendMessage = async (text: string, attachments: MessageAttachment[]) => {
    if (isStreaming) return;
    setErrorMessage(null);

    // Create optimistic user message
    const tempUserMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      conversationId: activeConversationId || 'pending',
      role: 'user',
      content: text,
      attachments: attachments.length > 0 ? attachments : undefined,
      createdAt: Date.now(),
    };

    setMessages((prev) => [...prev, tempUserMessage]);
    setIsStreaming(true);
    setStreamingText('');
    setTimeout(() => scrollToBottom('smooth'), 50);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: activeConversationId,
          message: text,
          attachments,
          mode,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with ${response.status}`);
      }

      if (!response.body) {
        throw new Error('ReadableStream not supported on this response');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentAssistantMessageId = '';
      let accumulatedText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const block of lines) {
          const matchEvent = block.match(/event:\s*(.+)/);
          const matchData = block.match(/data:\s*(.+)/);

          if (!matchData) continue;
          const eventType = matchEvent ? matchEvent[1].trim() : 'message';
          const eventData = JSON.parse(matchData[1]);

          if (eventType === 'start') {
            if (eventData.conversationId && eventData.conversationId !== activeConversationId) {
              setActiveConversationId(eventData.conversationId);
              fetchConversations();
            }
            currentAssistantMessageId = eventData.assistantMessageId;
          } else if (eventType === 'chunk') {
            accumulatedText += eventData.text;
            setStreamingText(accumulatedText);
            scrollToBottom('smooth');
          } else if (eventType === 'done') {
            const finalAssistantMessage: ChatMessage = {
              id: currentAssistantMessageId || `ast-${Date.now()}`,
              conversationId: eventData.conversationId,
              role: 'assistant',
              content: eventData.content || accumulatedText,
              createdAt: Date.now(),
            };
            setMessages((prev) => [...prev, finalAssistantMessage]);
            setStreamingText('');
            fetchConversations();
          } else if (eventType === 'error') {
            throw new Error(eventData.error || 'Response error');
          }
        }
      }
    } catch (err: unknown) {
      const error = err as Error;
      if (error.name !== 'AbortError') {
        console.error('Chat stream error:', error);
        setErrorMessage(error.message || 'An error occurred during communication.');
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  // Stop generation
  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (streamingText) {
      const partialMsg: ChatMessage = {
        id: `ast-${Date.now()}`,
        conversationId: activeConversationId || 'pending',
        role: 'assistant',
        content: streamingText + '\n\n*(Stopped)*',
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, partialMsg]);
    }
    setIsStreaming(false);
    setStreamingText('');
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      {/* Sidebar Navigation */}
      <Sidebar
        conversations={conversations}
        activeId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onDeleteConversation={handleDeleteConversation}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Chat Viewport */}
      <main className="flex flex-1 flex-col overflow-hidden bg-surface-50 dark:bg-background">
        {/* Top Header Bar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200/80 px-4 dark:border-slate-800/80">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 md:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

            <button
              onClick={handleNewConversation}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">New Chat</span>
            </button>
          </div>

          {/* Mode Selector */}
          <div className="flex items-center gap-3">
            <ModeSelector
              currentMode={mode}
              onModeChange={handleModeChange}
              disabled={isStreaming}
            />
          </div>
        </header>

        {/* Error Notification Banner */}
        {errorMessage && (
          <div className="flex items-center justify-between gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-xs font-semibold hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Scrollable Message History Area */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            /* Empty State / Suggestions */
            <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center px-4 py-12 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600/10 text-blue-600 dark:bg-blue-400/10 dark:text-blue-400">
                <Terminal className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
                Technical Assistant
              </h2>
              <p className="mt-1 max-w-md text-xs text-slate-500 dark:text-slate-400">
                Direct answers for Python, SQL, Excel, Cloud Architecture, and Data Engineering.
                Paste screenshots with <kbd className="rounded border border-slate-300 px-1 py-0.5 text-[10px] font-mono dark:border-slate-700">Ctrl+V</kbd>.
              </p>

              {/* Suggestions Grid */}
              <div className="mt-8 grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2 text-left">
                {SUGGESTIONS.map((s, idx) => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSendMessage(s.prompt, [])}
                      className="group flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-3.5 text-left shadow-2xs transition hover:border-blue-500/50 hover:shadow-xs dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-blue-400/50"
                    >
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                        <Icon className="h-3.5 w-3.5 text-blue-500" />
                        <span>{s.title}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500 transition group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-300">
                        {s.prompt}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Active Messages List */
            <div className="mx-auto max-w-4xl py-4">
              {messages.map((msg) => (
                <MessageItem key={msg.id} message={msg} />
              ))}

              {/* Streaming Assistant chunk */}
              {isStreaming && streamingText && (
                <MessageItem
                  message={{
                    id: 'streaming-preview',
                    conversationId: activeConversationId || '',
                    role: 'assistant',
                    content: streamingText,
                    createdAt: Date.now(),
                  }}
                  isStreaming={true}
                />
              )}

              {/* Loading Indicator before first chunk */}
              {isStreaming && !streamingText && (
                <div className="flex items-center gap-3 px-6 py-4">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  </div>
                  <div className="text-xs text-slate-400 dark:text-slate-500">
                    Reasoning...
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Bar pinned to bottom */}
        <div className="shrink-0 pb-4 pt-2">
          <ChatInput
            onSendMessage={handleSendMessage}
            isStreaming={isStreaming}
            onStopStreaming={handleStopStreaming}
          />
        </div>
      </main>
    </div>
  );
}
