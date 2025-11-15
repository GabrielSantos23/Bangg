import type React from "react";

import { useState, useRef, useEffect } from "react";

interface EditableTitleProps {
  initialTitle: string;
  onSave?: (title: string) => void | Promise<void>;
}

export function EditableTitle({ initialTitle, onSave }: EditableTitleProps) {
  const [title, setTitle] = useState(initialTitle);
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setTitle(initialTitle);
  }, [initialTitle]);

  const handleBlur = async () => {
    setIsEditing(false);
    if (!title.trim()) {
      setTitle(initialTitle);
    } else if (title.trim() !== initialTitle && onSave) {
      await onSave(title.trim());
    }
  };

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (title.trim() && title.trim() !== initialTitle && onSave) {
        await onSave(title.trim());
      }
      inputRef.current?.blur();
    }
    if (e.key === "Escape") {
      setTitle(initialTitle);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="text-3xl font-semibold bg-transparent border-none outline-none focus:ring-0 w-full border"
      />
    );
  }

  return (
    <h1
      onClick={() => setIsEditing(true)}
      className="text-3xl font-semibold cursor-text hover:text-muted-foreground transition-colors mt-1 rounded-lg py-2 px-1 hover:outline-1 hover:outline-border"
    >
      {title}
    </h1>
  );
}
