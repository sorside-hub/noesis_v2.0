import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeRaw from 'rehype-raw';
import { NoteItem } from '../../features/vault/pages/VaultPage';

interface MarkdownRendererProps {
  content: string;
  allNotes?: NoteItem[];
  onWikilinkClick?: (title: string) => void;
}

/**
 * Transforms `[[Nama Note]]` patterns in raw content into custom HTML anchor tags
 * so ReactMarkdown + rehype-raw can render them cleanly without brackets.
 */
function processWikilinks(text: string): string {
  if (!text) return '';

  // Split by code blocks or inline backticks to avoid replacing wikilinks inside code
  const parts = text.split(/(```[\s\S]*?```|`[^`\n]+`)/g);

  return parts
    .map((part) => {
      if (part.startsWith('`')) return part;
      return part.replace(/\[\[([^\]]+)\]\]/g, (_match, rawTitle) => {
        const trimmed = rawTitle.trim();
        if (!trimmed) return _match;
        const encoded = encodeURIComponent(trimmed);
        return `<a data-wikilink="${encoded}" href="#wikilink-${encoded}">${trimmed}</a>`;
      });
    })
    .join('');
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  allNotes,
  onWikilinkClick,
}) => {
  const processedContent = useMemo(() => {
    return processWikilinks(content);
  }, [content]);

  return (
    <div className="markdown-content text-sm text-[#E5E5E5] leading-relaxed break-words">
      <ReactMarkdown
        urlTransform={(url) => url}
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[rehypeRaw]}
        components={{
          p({ children }) {
            return <p className="mb-3 last:mb-0 leading-relaxed min-h-[1em]">{children}</p>;
          },
          u({ children }) {
            return <u className="underline underline-offset-2 decoration-current font-normal">{children}</u>;
          },
          ins({ children }) {
            return <u className="underline underline-offset-2 decoration-current font-normal">{children}</u>;
          },
          h1({ children }) {
            return (
              <h1 className="text-lg font-bold text-white mt-4 mb-2 first:mt-0 pb-1 border-b border-[#303030]">
                {children}
              </h1>
            );
          },
          h2({ children }) {
            return (
              <h2 className="text-base font-bold text-white mt-3.5 mb-2 first:mt-0">
                {children}
              </h2>
            );
          },
          h3({ children }) {
            return (
              <h3 className="text-sm font-semibold text-white mt-3 mb-1.5 first:mt-0">
                {children}
              </h3>
            );
          },
          ul({ children }) {
            return <ul className="list-disc pl-5 mb-3 space-y-1 text-[#E5E5E5]">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal pl-5 mb-3 space-y-1 text-[#E5E5E5]">{children}</ol>;
          },
          li({ children }) {
            return <li className="leading-relaxed">{children}</li>;
          },
          strong({ children }) {
            return <strong className="font-semibold text-white">{children}</strong>;
          },
          em({ children }) {
            return <em className="italic text-[#E5E5E5]">{children}</em>;
          },
          blockquote({ children }) {
            return (
              <blockquote className="border-l-3 border-[#4F8CFF] pl-3 py-1 my-3 bg-[#1C1C1C] rounded-r-lg text-[#A3A3A3] italic">
                {children}
              </blockquote>
            );
          },
          a({ href, children, ...props }) {
            const dataWikilink = (props as any)['data-wikilink'] || (props as any)['dataWikilink'];
            const rawHref = href || '';
            const isWikilink =
              Boolean(dataWikilink) ||
              rawHref.startsWith('#wikilink-') ||
              rawHref.startsWith('wikilink:') ||
              rawHref.includes('wikilink:');

            if (isWikilink) {
              const rawTarget =
                dataWikilink ||
                rawHref.replace(/^#wikilink-|^wikilink:|^https:\/\/wikilink:|^http:\/\/wikilink:/, '');
              const targetTitle = decodeURIComponent(rawTarget);
              const exists = allNotes
                ? allNotes.some(
                    (n) => n.title.trim().toLowerCase() === targetTitle.trim().toLowerCase()
                  )
                : true;

              return (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (onWikilinkClick) {
                      onWikilinkClick(targetTitle);
                    }
                  }}
                  className={`inline-flex items-center gap-1 font-medium transition-all cursor-pointer text-left ${
                    exists === false
                      ? 'text-[#4F8CFF]/70 hover:text-[#4F8CFF] underline underline-offset-2 decoration-dashed'
                      : 'text-[#4F8CFF] hover:text-[#70A3FF] hover:underline underline-offset-2'
                  }`}
                  title={
                    exists === false
                      ? `Klik untuk membuat catatan: ${targetTitle}`
                      : `Buka catatan: ${targetTitle}`
                  }
                >
                  <span>{children}</span>
                  {exists === false && (
                    <span className="text-[9px] text-[#8E8E93] bg-[#222222] px-1 py-0.2 rounded border border-[#333333] font-sans no-underline font-normal">
                      (belum ada)
                    </span>
                  )}
                </button>
              );
            }

            const formattedHref =
              rawHref &&
              !rawHref.startsWith('http://') &&
              !rawHref.startsWith('https://') &&
              !rawHref.startsWith('mailto:') &&
              !rawHref.startsWith('tel:') &&
              !rawHref.startsWith('#')
                ? `https://${rawHref}`
                : rawHref;

            return (
              <a
                href={formattedHref || '#'}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  e.stopPropagation();
                  if (formattedHref && formattedHref !== '#') {
                    e.preventDefault();
                    window.open(formattedHref, '_blank', 'noopener,noreferrer');
                  }
                }}
                className="text-[#4F8CFF] underline underline-offset-2 hover:text-[#70A3FF] transition-colors break-all cursor-pointer"
                {...props}
              >
                {children}
              </a>
            );
          },
          code({ className, children, ...props }) {
            const isInline = !className && !String(children).includes('\n');
            if (isInline) {
              return (
                <code
                  className="bg-[#262626] text-[#4F8CFF] px-1.5 py-0.5 rounded text-xs font-mono border border-[#363636]"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <code className={`${className || ''} font-mono text-xs`} {...props}>
                {children}
              </code>
            );
          },
          pre({ children }) {
            return (
              <div className="my-3 bg-[#1A1A1A] border border-[#303030] rounded-xl overflow-hidden shadow-sm">
                <div className="bg-[#222222] px-3 py-1.5 border-b border-[#303030] flex items-center justify-between text-[11px] text-[#A3A3A3] font-mono select-none">
                  <span>Code</span>
                </div>
                <pre className="p-3 overflow-x-auto text-xs font-mono text-[#E5E5E5] leading-relaxed">
                  {children}
                </pre>
              </div>
            );
          },
          table({ children }) {
            return (
              <div className="my-3 overflow-x-auto rounded-xl border border-[#303030]">
                <table className="w-full text-left text-xs text-[#E5E5E5] border-collapse">
                  {children}
                </table>
              </div>
            );
          },
          thead({ children }) {
            return <thead className="bg-[#222222] text-white font-semibold">{children}</thead>;
          },
          tbody({ children }) {
            return <tbody className="divide-y divide-[#303030] bg-[#1A1A1A]">{children}</tbody>;
          },
          tr({ children }) {
            return <tr>{children}</tr>;
          },
          th({ children }) {
            return <th className="px-3 py-2 border-b border-[#303030]">{children}</th>;
          },
          td({ children }) {
            return <td className="px-3 py-2">{children}</td>;
          },
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};
