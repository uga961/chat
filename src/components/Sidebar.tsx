'use client';

import React, { useState } from 'react';
import { Conversation } from '@/lib/types';
import ThemeToggle from './ThemeToggle';
import {
  Plus,
  MessageSquare,
  Trash2,
  LogOut,
  Search,
  Code2,
  X,
} from 'lucide-react';

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export default function Sidebar({
  conversations,
  activeId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  isOpenMobile,
  onCloseMobile,
}: SidebarProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login';
    } catch {
      window.location.href = '/login';
    }
  };

  const confirmDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (deletingId === id) {
      onDeleteConversation(id);
      setDeletingId(null);
    } else {
      setDeletingId(id);
      setTimeout(() => setDeletingId(null), 3000);
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Panel */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-200 bg-white transition-transform duration-200 ease-in-out dark:border-slate-800 dark:bg-[#090d16] md:static md:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* App Title & New Chat */}
        <div className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
                <Code2 className="h-4 w-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">
                  Technical Chat
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                  Python • SQL • Excel • Cloud
                </span>
              </div>
            </div>

            <button
              onClick={onCloseMobile}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 md:hidden"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              onNewConversation();
              onCloseMobile();
            }}
            className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium text-white shadow-xs transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
          >
            <Plus className="h-4 w-4" />
            <span>New Technical Chat</span>
          </button>
        </div>

        {/* Search */}
        {conversations.length > 5 && (
          <div className="px-4 pb-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search history..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500"
              />
            </div>
          </div>
        )}

        {/* Conversations History List */}
        <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-slate-400 dark:text-slate-500">
              {searchTerm ? 'No matching chats found' : 'No previous conversations'}
            </div>
          ) : (
            filtered.map((conv) => {
              const isActive = conv.id === activeId;
              const isDeleting = deletingId === conv.id;

              return (
                <div
                  key={conv.id}
                  onClick={() => {
                    onSelectConversation(conv.id);
                    onCloseMobile();
                  }}
                  className={`group relative flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-xs transition ${
                    isActive
                      ? 'bg-slate-100 font-medium text-slate-900 dark:bg-slate-800/80 dark:text-white'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900/50 dark:hover:text-slate-200'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <MessageSquare
                      className={`h-3.5 w-3.5 shrink-0 ${
                        isActive
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-slate-400'
                      }`}
                    />
                    <span className="truncate">{conv.title}</span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => confirmDelete(e, conv.id)}
                    title={isDeleting ? 'Click again to confirm delete' : 'Delete conversation'}
                    className={`shrink-0 rounded p-1 transition ${
                      isDeleting
                        ? 'bg-red-500/10 text-red-500 opacity-100'
                        : 'opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500'
                    }`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer actions: Theme toggle and logout */}
        <div className="border-t border-slate-200 p-3 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <ThemeToggle />
            <button
              onClick={handleLogout}
              type="button"
              title="Sign out"
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-slate-500 transition hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-950/30 dark:hover:text-red-400"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Lock</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
