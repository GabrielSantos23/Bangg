"use client";

import { useState } from "react";
import type { JSX } from "react/jsx-runtime";

export function MarkdownEditor() {
  const [content, setContent] = useState("");

  const parseMarkdown = (text: string) => {
    const lines = text.split("\n");
    const parsed: JSX.Element[] = [];

    lines.forEach((line, index) => {
      // Numbered lists: 1. 2. 3. etc
      if (/^\d+\.\s/.test(line)) {
        const text = line.replace(/^\d+\.\s/, "");
        parsed.push(
          <li key={index} className="ml-4">
            {parseInlineFormatting(text)}
          </li>
        );
      }
      // Bullet lists: - or *
      else if (/^[-*]\s/.test(line)) {
        const text = line.replace(/^[-*]\s/, "");
        parsed.push(
          <li key={index} className="ml-4 list-disc">
            {parseInlineFormatting(text)}
          </li>
        );
      }
      // Headings: # ## ###
      else if (/^#{1,6}\s/.test(line)) {
        const level = line.match(/^#+/)?.[0].length || 1;
        const text = line.replace(/^#+\s/, "");
        const HeadingTag = `h${level}` as keyof JSX.IntrinsicElements;
        const sizes = [
          "text-2xl",
          "text-xl",
          "text-lg",
          "text-base",
          "text-sm",
          "text-xs",
        ];
        parsed.push(
          <HeadingTag
            key={index}
            className={`font-bold ${sizes[level - 1]} mt-4 mb-2`}
          >
            {parseInlineFormatting(text)}
          </HeadingTag>
        );
      }
      // Regular text
      else if (line.trim()) {
        parsed.push(
          <p key={index} className="mb-2">
            {parseInlineFormatting(line)}
          </p>
        );
      }
      // Empty line
      else {
        parsed.push(<br key={index} />);
      }
    });

    return parsed;
  };

  const parseInlineFormatting = (text: string) => {
    const parts: (string | JSX.Element)[] = [];
    const currentText = text;
    let key = 0;

    // Parse bold and italic: **bold** *italic* or __bold__ _italic_
    const regex = /(\*\*|__)(.*?)\1|(\*|_)(.*?)\3/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(currentText)) !== null) {
      // Add text before match
      if (match.index > lastIndex) {
        parts.push(currentText.slice(lastIndex, match.index));
      }

      // Bold
      if (match[1] && match[2]) {
        parts.push(
          <strong key={key++} className="font-bold">
            {match[2]}
          </strong>
        );
      }
      // Italic
      else if (match[3] && match[4]) {
        parts.push(
          <em key={key++} className="italic">
            {match[4]}
          </em>
        );
      }

      lastIndex = regex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < currentText.length) {
      parts.push(currentText.slice(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  return (
    <div className="min-h-[400px]">
      {/* Editor */}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write your notes here...

Commands:
- **bold** or __bold__ for bold text
- *italic* or _italic_ for italic text
- # Heading for headings (use ##, ### for smaller)
- 1. Item for numbered lists
- - Item or * Item for bullet lists"
        className="w-full min-h-[200px] resize-none border-none bg-transparent text-base placeholder:text-muted-foreground focus-visible:ring-0 outline-none font-mono text-sm mb-4 p-4 border border-border rounded-lg"
      />

      {/* Preview */}
      {content && (
        <div className="border-t border-border pt-4">
          <p className="text-xs text-muted-foreground mb-2 font-semibold uppercase">
            Preview
          </p>
          <div className="prose prose-invert max-w-none text-foreground">
            {parseMarkdown(content)}
          </div>
        </div>
      )}
    </div>
  );
}
