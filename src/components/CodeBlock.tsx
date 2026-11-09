'use client';

import React, { useState } from 'react';
import hljs from 'highlight.js';
import { Check, Copy } from 'lucide-react';

interface CodeBlockProps {
  language?: string;
  code: string;
}

export default function CodeBlock({ language, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const cleanLang = (language || 'plaintext').toLowerCase().replace('language-', '');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const highlightedCode = React.useMemo(() => {
    try {
      if (cleanLang && hljs.getLanguage(cleanLang)) {
        return hljs.highlight(code, { language: cleanLang, ignoreIllegals: true }).value;
      }
      return hljs.highlightAuto(code).value;
    } catch {
      return code;
    }
  }, [code, cleanLang]);

  return (
    <div className="relative my-3 overflow-hidden rounded-xl border border-slate-700/60 bg-[#0d1117] text-slate-100 shadow-xs">
      {/* Code Header */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-4 py-1.5 text-xs font-mono text-slate-400">
        <span className="font-semibold uppercase tracking-wider text-slate-400">
          {cleanLang}
        </span>
        <button
          onClick={handleCopy}
          type="button"
          className="flex items-center gap-1.5 rounded px-2 py-0.5 text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Content */}
      <div className="overflow-x-auto p-4 text-xs font-mono leading-relaxed sm:text-sm">
        <pre className="m-0 bg-transparent p-0">
          <code
            dangerouslySetInnerHTML={{ __html: highlightedCode }}
            className={`hljs language-${cleanLang}`}
          />
        </pre>
      </div>
    </div>
  );
}
