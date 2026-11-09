'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { ChatMessage, MessageAttachment } from '@/lib/types';
import CodeBlock from './CodeBlock';
import { Copy, Check, Sparkles, User, X } from 'lucide-react';

interface MessageItemProps {
  message: ChatMessage;
  isStreaming?: boolean;
}

export default function MessageItem({ message, isStreaming = false }: MessageItemProps) {
  const [copied, setCopied] = useState(false);
  const [selectedImage, setSelectedImage] = useState<MessageAttachment | null>(null);

  const isUser = message.role === 'user';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div
      className={`group relative flex w-full gap-3 px-4 py-4 md:px-6 ${
        isUser
          ? 'bg-transparent'
          : 'bg-slate-50/70 border-y border-slate-100 dark:border-slate-800/40 dark:bg-slate-900/30'
      }`}
    >
      {/* Lightbox Modal for Attachment */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-h-[90vh] max-w-[90vw]">
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-10 right-0 rounded-full bg-slate-800 p-1.5 text-white hover:bg-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:${selectedImage.mimeType};base64,${selectedImage.data}`}
              alt={selectedImage.name || 'Attachment'}
              className="max-h-[85vh] max-w-[85vw] rounded-lg object-contain shadow-2xl"
            />
          </div>
        </div>
      )}

      {/* Role Avatar */}
      <div className="shrink-0 pt-0.5">
        {isUser ? (
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <User className="h-4 w-4" />
          </div>
        ) : (
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
            <Sparkles className="h-4 w-4" />
          </div>
        )}
      </div>

      {/* Content Container */}
      <div className="min-w-0 flex-1 space-y-2">
        {/* Header with role and copy button */}
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-medium text-slate-700 dark:text-slate-300">
            {isUser ? 'You' : 'Technical Assistant'}
          </span>

          {!isUser && !isStreaming && message.content && (
            <button
              onClick={handleCopy}
              type="button"
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-slate-400 opacity-0 transition hover:bg-slate-200 hover:text-slate-700 group-hover:opacity-100 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              title="Copy answer"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 text-emerald-500" />
                  <span className="text-emerald-500">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  <span>Copy</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Uploaded image previews */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 pb-1">
            {message.attachments.map((att) => (
              <button
                key={att.id}
                type="button"
                onClick={() => setSelectedImage(att)}
                className="group/img relative overflow-hidden rounded-lg border border-slate-200 transition hover:opacity-90 dark:border-slate-700"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`data:${att.mimeType};base64,${att.data}`}
                  alt={att.name || 'Screenshot'}
                  className="h-24 w-auto max-w-[200px] object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition group-hover/img:opacity-100">
                  <span className="text-[10px] font-medium text-white">Expand</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Markdown Output */}
        <div
          className={`prose prose-slate dark:prose-invert max-w-none text-sm leading-relaxed ${
            isStreaming ? 'streaming-cursor' : ''
          }`}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={{
              code({ className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '');
                const codeString = String(children).replace(/\n$/, '');
                const isInline = !match && !codeString.includes('\n');

                if (isInline) {
                  return (
                    <code
                      className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-pink-600 dark:bg-slate-800 dark:text-pink-400"
                      {...props}
                    >
                      {children}
                    </code>
                  );
                }

                return (
                  <CodeBlock
                    language={match ? match[1] : undefined}
                    code={codeString}
                  />
                );
              },
              table({ children }) {
                return (
                  <div className="my-3 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                    <table className="min-w-full divide-y divide-slate-200 text-left text-xs dark:divide-slate-800">
                      {children}
                    </table>
                  </div>
                );
              },
              th({ children }) {
                return (
                  <th className="bg-slate-100 px-3 py-2 font-semibold text-slate-900 dark:bg-slate-800 dark:text-slate-200">
                    {children}
                  </th>
                );
              },
              td({ children }) {
                return (
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                    {children}
                  </td>
                );
              },
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
