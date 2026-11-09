'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MessageAttachment } from '@/lib/types';
import { ArrowUp, Image as ImageIcon, Square, X, Paperclip } from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (message: string, attachments: MessageAttachment[]) => void;
  isStreaming: boolean;
  onStopStreaming: () => void;
  disabled?: boolean;
}

const MAX_IMAGE_SIZE_MB = 10;
const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];

export default function ChatInput({
  onSendMessage,
  isStreaming,
  onStopStreaming,
  disabled = false,
}: ChatInputProps) {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<MessageAttachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 200)}px`;
    }
  }, [text]);

  // Focus textarea when not streaming
  useEffect(() => {
    if (!isStreaming) {
      textareaRef.current?.focus();
    }
  }, [isStreaming]);

  // Process and encode files
  const processFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);

    for (const file of fileArray) {
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        alert(`Unsupported file format: ${file.name}. Please upload PNG, JPG, or WEBP images.`);
        continue;
      }

      if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
        alert(`File too large: ${file.name} exceeds ${MAX_IMAGE_SIZE_MB}MB.`);
        continue;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const base64Data = (e.target?.result as string)?.split(',')[1];
        if (base64Data) {
          const newAtt: MessageAttachment = {
            id: Math.random().toString(36).substring(2, 9),
            name: file.name,
            mimeType: file.type,
            data: base64Data,
            size: file.size,
          };
          setAttachments((prev) => [...prev, newAtt]);
        }
      };
      reader.readAsDataURL(file);
    }
  }, []);

  // Clipboard paste handler for screenshots (Ctrl+V)
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const clipboardData = e.clipboardData;
      if (!clipboardData || !clipboardData.items) return;

      const items = Array.from(clipboardData.items);
      const imageFiles: File[] = [];

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            imageFiles.push(file);
          }
        }
      }

      if (imageFiles.length > 0) {
        processFiles(imageFiles);
      }
    },
    [processFiles]
  );

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    const trimmed = text.trim();
    if ((!trimmed && attachments.length === 0) || isStreaming || disabled) return;

    onSendMessage(trimmed, attachments);
    setText('');
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative mx-auto w-full max-w-4xl px-4 transition-all duration-150 ${
        isDragging ? 'scale-[1.01]' : ''
      }`}
    >
      {/* Drag Overlay visual cue */}
      {isDragging && (
        <div className="absolute inset-x-4 -top-12 bottom-0 z-30 flex items-center justify-center rounded-2xl border-2 border-dashed border-blue-500 bg-blue-500/10 backdrop-blur-xs">
          <div className="flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400">
            <ImageIcon className="h-5 w-5" />
            <span>Drop technical screenshots or diagrams here</span>
          </div>
        </div>
      )}

      {/* Input Box Card */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition dark:border-slate-800 dark:bg-slate-900">
        {/* Attachment chips preview */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 border-b border-slate-100 p-2.5 dark:border-slate-800/60">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="group relative flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 py-1 pl-1.5 pr-2 dark:border-slate-700 dark:bg-slate-800/80"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`data:${att.mimeType};base64,${att.data}`}
                  alt={att.name}
                  className="h-8 w-8 rounded object-cover"
                />
                <span className="max-w-[120px] truncate text-xs text-slate-700 dark:text-slate-300">
                  {att.name || 'Screenshot'}
                </span>
                <button
                  onClick={() => handleRemoveAttachment(att.id)}
                  type="button"
                  className="rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Textarea and Actions */}
        <div className="flex items-end gap-2 p-2">
          {/* File upload hidden input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) {
                processFiles(e.target.files);
                e.target.value = '';
              }
            }}
          />

          {/* Upload Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isStreaming || disabled}
            title="Attach screenshots or code images (or paste with Ctrl+V)"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <Paperclip className="h-4 w-4" />
          </button>

          {/* Text input */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={
              attachments.length > 0
                ? 'Ask a question about the image(s) or leave blank to solve directly...'
                : 'Ask a Python, SQL, Excel, or Cloud question... (Paste screenshot with Ctrl+V)'
            }
            disabled={isStreaming || disabled}
            className="max-h-[200px] min-h-[36px] w-full resize-none bg-transparent py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-50 dark:text-white dark:placeholder:text-slate-500"
          />

          {/* Send or Stop button */}
          {isStreaming ? (
            <button
              type="button"
              onClick={onStopStreaming}
              title="Stop generation"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white shadow-xs transition hover:bg-red-700"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSend}
              disabled={(!text.trim() && attachments.length === 0) || disabled}
              title="Send message (Enter)"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white shadow-xs transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200 dark:disabled:bg-slate-800 dark:disabled:text-slate-600"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      <div className="mt-1.5 text-center text-[11px] text-slate-400 dark:text-slate-600">
        Press <kbd className="rounded border border-slate-300 px-1 py-0.5 text-[10px] font-mono dark:border-slate-700">Enter</kbd> to send, <kbd className="rounded border border-slate-300 px-1 py-0.5 text-[10px] font-mono dark:border-slate-700">Shift+Enter</kbd> for newline
      </div>
    </div>
  );
}
