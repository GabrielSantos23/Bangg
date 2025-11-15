import { useEffect, useRef } from "react";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";

type PanelType = "chat" | "grid" | "models" | "help" | "settings" | null;

interface PanelSize {
  width?: number;
  height?: number;
}

const PANEL_SIZES: Record<NonNullable<PanelType>, PanelSize> = {
  chat: { height: 400 },
  grid: { width: 800, height: 600 },
  models: { height: 500 },
  help: { height: 500 },
  settings: { height: 500 },
};

interface UsePanelWindowResizeOptions {
  activePanel: PanelType;
  restoreDelay?: number;
}

/**
 * Hook que gerencia automaticamente o redimensionamento da janela baseado no painel ativo.
 * 
 * Funcionalidades:
 * - Armazena o tamanho original da janela ao montar
 * - Redimensiona automaticamente quando um painel é aberto
 * - Restaura o tamanho original quando o painel é fechado
 * - Suporta delay para animações de fechamento
 */
export function usePanelWindowResize({
  activePanel,
  restoreDelay = 350,
}: UsePanelWindowResizeOptions) {
  const originalSize = useRef<{ width: number; height: number } | null>(null);
  const isRestoringRef = useRef(false);

  // Armazena o tamanho original da janela ao montar
  useEffect(() => {
    const storeOriginalSize = async () => {
      if (originalSize.current) return; // Já armazenado

      const appWindow = getCurrentWindow();
      try {
        const size = await appWindow.innerSize();
        originalSize.current = { width: size.width, height: size.height };
      } catch (error) {
        console.error("Error getting window size:", error);
      }
    };
    storeOriginalSize();
  }, []);

  // Redimensiona automaticamente baseado no painel ativo
  useEffect(() => {
    const appWindow = getCurrentWindow();
    let timeoutId: NodeJS.Timeout | null = null;

    const resizeWindow = async () => {
      try {
        if (activePanel && PANEL_SIZES[activePanel]) {
          // Painel ativo - redimensionar para o tamanho do painel
          const panelSize = PANEL_SIZES[activePanel];
          const currentSize = await appWindow.innerSize();

          const newWidth = panelSize.width ?? currentSize.width;
          const newHeight = panelSize.height ?? currentSize.height;

          await appWindow.setSize(new LogicalSize(newWidth, newHeight));
          isRestoringRef.current = false;
        } else if (!activePanel && originalSize.current && !isRestoringRef.current) {
          // Nenhum painel ativo - restaurar tamanho original com delay
          isRestoringRef.current = true;
          
          timeoutId = setTimeout(async () => {
            // Verificar novamente se ainda não há painel ativo
            const currentSize = await appWindow.innerSize();
            
            if (originalSize.current) {
              // Só restaura se o tamanho atual for diferente do original
              if (
                currentSize.width !== originalSize.current.width ||
                currentSize.height !== originalSize.current.height
              ) {
                await appWindow.setSize(
                  new LogicalSize(
                    originalSize.current.width,
                    originalSize.current.height
                  )
                );
              }
            }
            isRestoringRef.current = false;
          }, restoreDelay);
        }
      } catch (error) {
        console.error("Error resizing window:", error);
        isRestoringRef.current = false;
      }
    };

    resizeWindow();

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [activePanel, restoreDelay]);

  return {
    originalSize: originalSize.current,
  };
}

