'use client';

import React from 'react';
import { ResponseMode } from '@/lib/types';
import { Zap, AlignLeft, BookOpen } from 'lucide-react';

interface ModeSelectorProps {
  currentMode: ResponseMode;
  onModeChange: (mode: ResponseMode) => void;
  disabled?: boolean;
}

const MODES: Array<{
  id: ResponseMode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}> = [
  {
    id: 'answer_only',
    label: 'Answer Only',
    icon: Zap,
    description: 'Direct answer or option. Zero extra fluff.',
  },
  {
    id: 'short',
    label: 'Short',
    icon: AlignLeft,
    description: 'Direct answer + 1-2 sentence explanation.',
  },
  {
    id: 'detailed',
    label: 'Detailed',
    icon: BookOpen,
    description: 'In-depth breakdown, code trace & nuances.',
  },
];

export default function ModeSelector({
  currentMode,
  onModeChange,
  disabled = false,
}: ModeSelectorProps) {
  return (
    <div className="flex items-center rounded-xl bg-slate-100 p-1 dark:bg-slate-900">
      {MODES.map((mode) => {
        const Icon = mode.icon;
        const isActive = currentMode === mode.id;

        return (
          <button
            key={mode.id}
            type="button"
            disabled={disabled}
            onClick={() => onModeChange(mode.id)}
            title={mode.description}
            className={`group flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              isActive
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
          >
            <Icon
              className={`h-3.5 w-3.5 transition ${
                isActive
                  ? 'text-blue-500 dark:text-blue-400'
                  : 'text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300'
              }`}
            />
            <span className="hidden sm:inline">{mode.label}</span>
          </button>
        );
      })}
    </div>
  );
}
