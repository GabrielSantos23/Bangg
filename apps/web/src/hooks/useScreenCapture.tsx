import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

export function useScreenCapture() {
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Listen for captured selection events
  useEffect(() => {
    const unlisten = listen<string>("captured-selection", (event) => {
      setCapturedImage(event.payload);
      setIsCapturing(false);
      setError(null);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Listen for capture closed events
  useEffect(() => {
    const unlisten = listen("capture-closed", () => {
      setIsCapturing(false);
      setError(null);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const startCapture = useCallback(async () => {
    setIsCapturing(true);
    setError(null);
    setCapturedImage(null);

    try {
      await invoke("start_screen_capture");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to start screen capture";
      setError(errorMessage);
      setIsCapturing(false);
      console.error("Screen capture error:", err);
    }
  }, []);

  const cancelCapture = useCallback(async () => {
    try {
      await invoke("close_overlay_window");
      setIsCapturing(false);
      setError(null);
    } catch (err) {
      console.error("Failed to cancel capture:", err);
    }
  }, []);

  return {
    startCapture,
    cancelCapture,
    isCapturing,
    capturedImage,
    error,
  };
}

