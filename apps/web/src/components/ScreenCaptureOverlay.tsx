import { useEffect, useRef, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { X, MousePointer2, Scan } from "lucide-react";

interface Selection {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

interface SelectionCoords {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function ScreenCaptureOverlay() {
  const [isSelecting, setIsSelecting] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  // Track mouse position for the crosshair guides
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const overlayRef = useRef<HTMLDivElement>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);

  const getSelectionRect = useCallback((): SelectionCoords | null => {
    if (!selection) return null;
    const x = Math.min(selection.startX, selection.endX);
    const y = Math.min(selection.startY, selection.endY);
    const width = Math.abs(selection.endX - selection.startX);
    const height = Math.abs(selection.endY - selection.startY);
    return { x, y, width, height };
  }, [selection]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsSelecting(true);
    startPosRef.current = { x, y };
    setSelection({ startX: x, startY: y, endX: x, endY: y });
  }, []);

  const handleMouseUp = useCallback(async () => {
    if (!isSelecting) return;
    setIsSelecting(false);

    const rect = getSelectionRect();
    if (!rect || rect.width < 5 || rect.height < 5) {
      setSelection(null);
      return;
    }

    try {
      // Optional: Add a small delay or visual flash here before capturing
      await invoke("capture_selected_area", {
        coords: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
      });
    } catch (error) {
      console.error("Failed to capture selection:", error);
      try {
        await invoke("close_overlay_window");
      } catch (e) {
        /* ignore */
      }
    }
  }, [isSelecting, getSelectionRect]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      // Update global mouse position for guides
      setMousePos({ x: e.clientX, y: e.clientY });

      if (!isSelecting || !startPosRef.current) return;

      const rect = overlayRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      setSelection({
        startX: startPosRef.current.x,
        startY: startPosRef.current.y,
        endX: x,
        endY: y,
      });
    },
    [isSelecting]
  );

  useEffect(() => {
    if (!isSelecting) return;
    const handleGlobalMouseMove = (e: MouseEvent) => handleMouseMove(e);
    const handleGlobalMouseUp = () => handleMouseUp();
    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [isSelecting, handleMouseMove, handleMouseUp]);

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selection) {
          setSelection(null);
          setIsSelecting(false);
        } else {
          await invoke("close_overlay_window");
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selection]);

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    window.addEventListener("contextmenu", handleContextMenu);
    return () => window.removeEventListener("contextmenu", handleContextMenu);
  }, []);

  const selectionRect = getSelectionRect();

  return (
    <div
      ref={overlayRef}
      className={`fixed inset-0 z-50 cursor-none transition-colors duration-200 ${
        isSelecting ? "bg-transparent" : "bg-black/10"
      }`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* 1. Background Dimmer with Cutout (SVG Mask) */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
        <defs>
          <mask id="selection-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {selectionRect && (
              <rect
                x={selectionRect.x}
                y={selectionRect.y}
                width={selectionRect.width}
                height={selectionRect.height}
                fill="black"
              />
            )}
          </mask>
        </defs>
        {/* The actual dark overlay */}
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.4)"
          mask="url(#selection-mask)"
        />
      </svg>

      {/* 2. Crosshair Guides (Only visible when NOT selecting) */}
      {!isSelecting && !selection && (
        <>
          <div
            className="absolute border-l border-white/30 pointer-events-none h-full transition-opacity"
            style={{ left: mousePos.x }}
          />
          <div
            className="absolute border-t border-white/30 pointer-events-none w-full transition-opacity"
            style={{ top: mousePos.y }}
          />
          {/* Coordinates Tag following cursor */}
          <div
            className="absolute pointer-events-none bg-black/80 text-white text-[10px] font-mono px-1.5 py-0.5 rounded ml-2 mt-2 backdrop-blur-md"
            style={{ left: mousePos.x, top: mousePos.y }}
          >
            x:{Math.round(mousePos.x)} y:{Math.round(mousePos.y)}
          </div>
        </>
      )}

      {/* 3. Active Selection UI */}
      {selectionRect && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: selectionRect.x,
            top: selectionRect.y,
            width: selectionRect.width,
            height: selectionRect.height,
          }}
        >
          {/* Crisp White Border */}
          <div className="absolute inset-0 border border-white/90 shadow-sm outline outline-1 outline-black/10" />

          {/* Dashed Inner Border for contrast */}
          <div className="absolute inset-0 border border-dashed border-black/30" />

          {/* Corner Handles (Decoration only) */}
          <div className="absolute -top-1 -left-1 w-2 h-2 bg-white border border-gray-400 rounded-full shadow-sm" />
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-white border border-gray-400 rounded-full shadow-sm" />
          <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-white border border-gray-400 rounded-full shadow-sm" />
          <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-white border border-gray-400 rounded-full shadow-sm" />

          {/* Dimensions Badge - Centered below selection if space permits, else inside */}
          <div className="absolute left-1/2 -translate-x-1/2 -bottom-8 flex items-center gap-2">
            <div className="bg-black/80 backdrop-blur-md text-white text-xs font-medium px-2 py-1 rounded-full shadow-lg whitespace-nowrap flex items-center gap-2 border border-white/10">
              <span className="font-mono text-gray-300">
                {Math.round(selectionRect.width)}
              </span>
              <span className="text-gray-500">×</span>
              <span className="font-mono text-gray-300">
                {Math.round(selectionRect.height)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 4. Floating Control Bar (Bottom Center) */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 z-50 pointer-events-auto">
        <div className="flex items-center gap-3 bg-zinc-900/90 backdrop-blur-xl border border-white/10 px-4 py-2.5 rounded-full shadow-2xl text-sm text-gray-300">
          {!selection ? (
            <>
              <Scan className="w-4 h-4 text-blue-400" />
              <span className="font-medium text-white">Drag to Capture</span>
              <div className="h-4 w-px bg-white/10 mx-1" />
              <span className="text-xs bg-white/10 px-1.5 py-0.5 rounded text-gray-400">
                ESC
              </span>
            </>
          ) : (
            <>
              <MousePointer2 className="w-4 h-4 text-blue-400" />
              <span className="font-medium text-white">Release to Finish</span>
            </>
          )}
        </div>

        {/* Close Button Circle */}
        <button
          onClick={async () => await invoke("close_overlay_window")}
          className="bg-zinc-900/90 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 text-gray-400 p-2.5 rounded-full transition-all duration-200 border border-white/10 backdrop-blur-xl shadow-xl"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
