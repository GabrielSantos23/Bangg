import { useEffect, useState, useRef, useCallback } from "react";
import { usePlateEditor } from "platejs/react";
import type { Value } from "platejs";
import { platePlugins } from "@/config/plate/plugins";
import { initialPlateValue } from "@/config/plate/initialValue";
import {
  getOrCreateSummary,
  updateSummary,
} from "@/services/conversation.server";
import { processMediaToBase64 } from "@/utils/media-utils";

interface UseSummaryEditorOptions {
  conversationId: string;
  summaryId?: string;
  summaryContent?: string;
  userId: string;
}

interface UseSummaryEditorReturn {
  editor: ReturnType<typeof usePlateEditor>;
  handleEditorChange: (options: { value: Value }) => void;
  handleImmediateSave: (value: Value) => void;
}

/**
 * Hook customizado para gerenciar o editor de summary com salvamento automático
 * 
 * Funcionalidades:
 * - Carrega ou cria summary automaticamente
 * - Gerencia salvamento automático com debounce inteligente
 * - Previne salvamentos desnecessários
 * - Salva imediatamente em momentos críticos (tab change, unmount, etc.)
 */
export function useSummaryEditor({
  conversationId,
  summaryId,
  summaryContent,
  userId,
}: UseSummaryEditorOptions): UseSummaryEditorReturn {
  const [editorValue, setEditorValue] = useState<Value | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedContentRef = useRef<string | null>(null);
  const isSavingRef = useRef(false);
  const pendingSaveRef = useRef<Value | null>(null);
  const currentSummaryIdRef = useRef<string | undefined>(summaryId);

  // Update summary ID ref when it changes
  useEffect(() => {
    currentSummaryIdRef.current = summaryId;
  }, [summaryId]);

  // Initialize summary content
  useEffect(() => {
    const initializeSummary = async () => {
      // If summary content exists, parse it
      if (summaryContent) {
        try {
          const parsed = JSON.parse(summaryContent);
          setEditorValue(parsed);
          lastSavedContentRef.current = summaryContent;
        } catch {
          // If parsing fails, use initial value
          setEditorValue(initialPlateValue);
          lastSavedContentRef.current = JSON.stringify(initialPlateValue);
        }
      } else if (userId && conversationId) {
        // Get or create summary if it doesn't exist
        try {
          const summary = await getOrCreateSummary({
            data: { conversationId, userId },
          });
          currentSummaryIdRef.current = summary?.id;
          setEditorValue(initialPlateValue);
          lastSavedContentRef.current = JSON.stringify(initialPlateValue);
        } catch (error) {
          console.error("Failed to initialize summary:", error);
          setEditorValue(initialPlateValue);
        }
      }
    };

    initializeSummary();
  }, [conversationId, userId, summaryContent]);

  // Create editor instance
  const editor = usePlateEditor({
    plugins: platePlugins,
    value: editorValue || initialPlateValue,
    // Configure node ID normalization to prevent errors when pasting
    nodeId: {
      normalizeInitialValue: true,
      filterInline: true,
      filterText: true,
    },
  });

  // Update editor value when summary content changes
  useEffect(() => {
    if (editorValue && editor) {
      editor.tf.setValue(editorValue);
    }
  }, [editorValue, editor]);

  // Save summary content to database
  const saveSummary = useCallback(
    async (value: Value) => {
      const summaryId = currentSummaryIdRef.current;
      if (!summaryId || isSavingRef.current) {
        // Store pending save if we're already saving
        pendingSaveRef.current = value;
        return;
      }

      const contentString = JSON.stringify(value);

      // Skip if content hasn't changed
      if (lastSavedContentRef.current === contentString) {
        return;
      }

      try {
        isSavingRef.current = true;
        
        // Process media to base64 before saving
        const processedValue = Array.isArray(value)
          ? await processMediaToBase64(value)
          : value;
        const processedContentString = JSON.stringify(processedValue);
        
        await updateSummary({
          data: {
            summaryId,
            content: processedContentString,
          },
        });
        lastSavedContentRef.current = processedContentString;

        // Process pending save if exists
        if (pendingSaveRef.current) {
          const pending = pendingSaveRef.current;
          pendingSaveRef.current = null;
          // Recursively save pending content
          setTimeout(() => saveSummary(pending), 100);
        }
      } catch (error) {
        console.error("Failed to save summary:", error);
      } finally {
        isSavingRef.current = false;
      }
    },
    []
  );

  // Save summary content when editor changes (with intelligent debounce)
  const handleEditorChange = useCallback(
    ({ value }: { value: Value }) => {
      const summaryId = currentSummaryIdRef.current;
      if (!summaryId) return;

      // Clear previous timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Progressive debounce: shorter delay for first save, longer for subsequent saves
      // This prevents rapid saves while typing but ensures quick initial save
      const debounceDelay = lastSavedContentRef.current === null ? 500 : 2000;

      // Set new timeout
      saveTimeoutRef.current = setTimeout(() => {
        saveSummary(value);
      }, debounceDelay);
    },
    [saveSummary]
  );

  // Save immediately when user leaves the editor (blur, tab change, etc.)
  const handleImmediateSave = useCallback(
    (value: Value) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      saveSummary(value);
    },
    [saveSummary]
  );

  // Save when component unmounts or user navigates away
  useEffect(() => {
    return () => {
      // Save on unmount
      if (editor && currentSummaryIdRef.current) {
        handleImmediateSave(editor.children);
      }
      // Cleanup timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [editor, handleImmediateSave]);

  // Save before page unload (attempt synchronous save)
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (editor && currentSummaryIdRef.current) {
        const content = JSON.stringify(editor.children);
        if (content !== lastSavedContentRef.current) {
          // Attempt to save synchronously (may not always complete, but we try)
          // This is best effort - the unmount effect should handle most cases
          saveSummary(editor.children).catch(() => {
            // Silently fail on beforeunload - we can't do much here
          });
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [editor, saveSummary]);

  return {
    editor,
    handleEditorChange,
    handleImmediateSave,
  };
}





