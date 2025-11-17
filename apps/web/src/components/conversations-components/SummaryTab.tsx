import { Button } from "@/components/ui/button";
import { Editor, EditorContainer } from "@/components/ui/editor";
import { FixedToolbar } from "@/components/ui/fixed-toolbar";
import { MarkToolbarButton } from "@/components/ui/mark-toolbar-button";
import { ToolbarButton } from "@/components/ui/toolbar";
import { Plate } from "platejs/react";
import { ArrowUpRight, Check, ChevronDown, Copy, Files, Sparkles, Loader2 } from "lucide-react";
import type { PlateEditor } from "platejs/react";
import type { Value } from "platejs";
import { useState, useMemo, useEffect, useCallback } from "react";
import { generateSummaryWithAI, getOrCreateSummary, updateSummaryContent } from "@/services/conversation";
import { createValueFromText } from "@/config/plate/initialValue";

interface SummaryTabProps {
  editor: PlateEditor | null;
  onEditorChange: (options: { value: Value }) => void;
  conversationId: string;
  userId: string;
  onSummaryGenerated?: () => void;
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

export function SummaryTab({ editor, onEditorChange, conversationId, userId, onSummaryGenerated }: SummaryTabProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [editorText, setEditorText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

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

  const handleGenerateSummary = useCallback(async () => {
    if (!conversationId || !userId || !editor) return;

    try {
      setIsGenerating(true);

      // Gerar resumo com IA
      const result = await generateSummaryWithAI(conversationId);

      if (!result || !result.success || !result.summary) {
        throw new Error("Failed to generate summary");
      }

      // Garantir que existe um summary no banco
      let summary = await getOrCreateSummary(conversationId, userId);

      if (!summary) {
        throw new Error("Failed to get or create summary");
      }

      // Converter o texto do resumo para o formato do Plate
      const summaryValue = createValueFromText(result.summary);
      const contentString = JSON.stringify(summaryValue);

      console.log("Saving summary:", {
        summaryId: summary.id,
        contentLength: contentString.length,
        preview: contentString.substring(0, 100),
      });

      // Salvar o resumo no banco de dados
      const saveResult = await updateSummaryContent(
        summary.id,
        contentString,
        undefined
      );

      console.log("Save result:", saveResult);

      if (!saveResult || !saveResult.success) {
        throw new Error("Failed to save summary to database");
      }

      // Atualizar o editor com o novo conteúdo
      editor.tf.setValue(summaryValue);
      onEditorChange({ value: summaryValue });

      // Atualizar o texto do editor para refletir as mudanças
      const text = extractTextFromValue(summaryValue);
      setEditorText(text);

      // Notificar o componente pai para recarregar a conversa
      if (onSummaryGenerated) {
        onSummaryGenerated();
      }
    } catch (error) {
      console.error("Failed to generate summary:", error);
      alert("Failed to generate summary. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  }, [conversationId, userId, editor, onEditorChange]);

  if (!editor) {
    return (
      <div className="">
        <p className="text-muted-foreground">Loading editor...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with Generate Button */}
      <div className="flex items-center justify-between mb-4 shrink-0 px-0">
        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-xs"
          onClick={handleGenerateSummary}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate Summary with AI
            </>
          )}
        </Button>
        {editorHasContent && (
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
        )}
      </div>

      {/* Plate Editor */}
      <div className="flex h-full relative">
        <div className="flex-1 min-h-0">
          <Plate editor={editor} onChange={handleChange}>
            <EditorContainer variant="default" className="h-full">
              <Editor
                placeholder="Write your summary here or click 'Generate Summary with AI' to create one automatically..."
                variant="default"
                className="px-0!"
              />
            </EditorContainer>
          </Plate>
        </div>
      </div>
    </div>
  );
}
