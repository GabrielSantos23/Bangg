import { Button } from "@/components/ui/button";
import { Editor, EditorContainer } from "@/components/ui/editor";
import { FixedToolbar } from "@/components/ui/fixed-toolbar";
import { MarkToolbarButton } from "@/components/ui/mark-toolbar-button";
import { ToolbarButton } from "@/components/ui/toolbar";
import { Plate } from "platejs/react";
import { ArrowUpRight, Check, ChevronDown, Copy, Files } from "lucide-react";
import type { PlateEditor } from "platejs/react";
import type { Value } from "platejs";
import { useState, useMemo, useEffect, useCallback } from "react";

interface SummaryTabProps {
  editor: PlateEditor | null;
  onEditorChange: (options: { value: Value }) => void;
}

// Helper function to extract text from Plate value
function extractTextFromValue(value: Value): string {
  if (!Array.isArray(value)) return "";

  const extractText = (node: any): string => {
    if (typeof node === "string") return node;
    if (node?.text && typeof node.text === "string") return node.text;
    if (Array.isArray(node?.children)) {
      return node.children.map(extractText).join("");
    }
    return "";
  };

  return value.map(extractText).join("\n").trim();
}

export function SummaryTab({ editor, onEditorChange }: SummaryTabProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [editorText, setEditorText] = useState("");

  // Get text from editor using API or fallback
  const getEditorText = useCallback(() => {
    if (!editor) return "";

    try {
      // Try using Plate API first
      if (editor.api && typeof editor.api.string === "function") {
        return editor.api.string() || "";
      }
    } catch (error) {
      // Fall through to fallback
    }

    // Fallback: extract text from children
    if (Array.isArray(editor.children)) {
      return extractTextFromValue(editor.children);
    }

    return "";
  }, [editor]);

  // Update editor text when editor content changes
  const handleChange = useCallback(
    (options: { value: Value }) => {
      onEditorChange(options);
      // Extract text from the new value
      const text = extractTextFromValue(options.value);
      setEditorText(text);
    },
    [onEditorChange]
  );

  // Initial update of editor text
  useEffect(() => {
    if (editor) {
      const text = getEditorText();
      setEditorText(text);
    }
  }, [editor, getEditorText]);

  // Determine if editor has any content (not empty/blank)
  const editorHasContent = useMemo(() => {
    return editorText.trim().length > 0;
  }, [editorText]);

  const handleCopyFullSummary = useCallback(async () => {
    if (!editorText) return;

    try {
      await navigator.clipboard.writeText(editorText);
      setIsCopied(true);
      setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    } catch (error) {
      console.error("Failed to copy text:", error);
      // Fallback: try using document.execCommand
      try {
        const textArea = document.createElement("textarea");
        textArea.value = editorText;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
        setIsCopied(true);
        setTimeout(() => {
          setIsCopied(false);
        }, 2000);
      } catch (fallbackError) {
        console.error("Fallback copy failed:", fallbackError);
      }
    }
  }, [editorText]);

  if (!editor) {
    return (
      <div className="">
        <p className="text-muted-foreground">Loading editor...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Plate Editor */}
      <div className="flex h-full relative">
        <div className="flex-1 min-h-0">
          <Plate editor={editor} onChange={handleChange}>
            <EditorContainer variant="default" className="h-full">
              <Editor
                placeholder="Write your summary here..."
                variant="default"
                className="px-0!"
              />
            </EditorContainer>
          </Plate>
        </div>
        {editorHasContent && (
          <div className="flex items-center justify-between mb-4 shrink-0 absolute top-5 right-0">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-muted-foreground/50 text-xs"
              onClick={handleCopyFullSummary}
            >
              {isCopied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Files className="h-4 w-4" />
              )}
              {isCopied ? "Copied full summary" : "Copy full summary"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
