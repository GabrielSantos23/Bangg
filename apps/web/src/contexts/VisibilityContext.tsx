import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow, getAllWindows } from "@tauri-apps/api/window";

interface VisibilityContextType {
  isVisible: boolean;
  isContentProtected: boolean;
  toggleVisibilityAndProtection: () => Promise<void>;
}

const VisibilityContext = createContext<VisibilityContextType | undefined>(
  undefined
);

const VISIBILITY_EVENT = "visibility-changed";
const CONTENT_PROTECTION_EVENT = "content-protection-changed";

export function VisibilityProvider({ children }: { children: ReactNode }) {
  const [isVisible, setIsVisible] = useState(true);
  const [isContentProtected, setIsContentProtectedState] = useState(false);
  const isUpdatingFromEvent = useRef(false);
  const isUpdatingProtectionFromEvent = useRef(false);

  // Listen for visibility changes from other windows
  useEffect(() => {
    const setupListener = async () => {
      try {
        const unlisten = await listen<{ isVisible: boolean }>(
          VISIBILITY_EVENT,
          (event) => {
            // Update state when receiving event from another window
            // Set flag before updating to prevent emitting event
            isUpdatingFromEvent.current = true;
            setIsVisible(event.payload.isVisible);
            // Reset flag in next tick to allow state update to complete
            requestAnimationFrame(() => {
              isUpdatingFromEvent.current = false;
            });
          }
        );
        return unlisten;
      } catch (error) {
        console.error("Failed to setup visibility listener:", error);
        return null;
      }
    };

    let unlistenFn: (() => void) | null = null;
    setupListener().then((unlisten) => {
      if (unlisten) {
        unlistenFn = unlisten;
      }
    });

    return () => {
      if (unlistenFn) {
        unlistenFn();
      }
    };
  }, []);

  // Listen for content protection changes from other windows
  useEffect(() => {
    const setupListener = async () => {
      try {
        const unlisten = await listen<{ isProtected: boolean }>(
          CONTENT_PROTECTION_EVENT,
          async (event) => {
            const protectedValue = event.payload.isProtected;
            console.log(`Content protection event received: ${protectedValue}`);

            isUpdatingProtectionFromEvent.current = true;

            // Apply content protection to the current window
            try {
              await getCurrentWindow().setContentProtected(protectedValue);
              console.log(
                `Content protection applied to current window: ${protectedValue}`
              );
            } catch (error) {
              console.error(
                "Failed to apply content protection from event:",
                error
              );
            }

            setIsContentProtectedState(protectedValue);
            requestAnimationFrame(() => {
              isUpdatingProtectionFromEvent.current = false;
            });
          }
        );
        console.log("Content protection listener setup complete");
        return unlisten;
      } catch (error) {
        console.error("Failed to setup content protection listener:", error);
        return null;
      }
    };

    let unlistenFn: (() => void) | null = null;
    setupListener().then((unlisten) => {
      if (unlisten) {
        unlistenFn = unlisten;
      }
    });

    return () => {
      if (unlistenFn) {
        unlistenFn();
      }
    };
  }, []);

  const updateVisibility = async (visible: boolean, skipEmit = false) => {
    setIsVisible(visible);
    // Only emit event if we're not updating from a received event and skipEmit is false
    if (!skipEmit && !isUpdatingFromEvent.current) {
      try {
        // Emit globally first
        await emit(VISIBILITY_EVENT, { isVisible: visible });

        // Also emit to visible windows only (to avoid showing hidden windows)
        try {
          const windows = await getAllWindows();
          const currentWindow = getCurrentWindow();
          const currentWindowLabel = currentWindow.label;

          for (const window of windows) {
            const label = window.label;
            // Skip current window
            if (label !== currentWindowLabel) {
              try {
                // Only emit to windows that are currently visible
                const isWindowVisible = await window.isVisible();
                if (isWindowVisible) {
                  await window.emit(VISIBILITY_EVENT, { isVisible: visible });
                }
              } catch (err) {
                // Ignore errors for hidden windows
                console.warn(`Failed to check/emit to window ${label}:`, err);
              }
            }
          }
        } catch (err) {
          console.warn("Failed to emit to individual windows:", err);
        }
      } catch (error) {
        console.error("Failed to emit visibility event:", error);
      }
    }
  };

  const updateContentProtection = async (
    protectedValue: boolean,
    skipEmit = false
  ) => {
    try {
      // Call Tauri API to actually protect the window
      await getCurrentWindow().setContentProtected(protectedValue);

      setIsContentProtectedState(protectedValue);

      // Emit event to sync with other windows
      // Emit to all windows explicitly to ensure menu window receives it
      if (!skipEmit && !isUpdatingProtectionFromEvent.current) {
        try {
          // First, emit globally (this should work for all windows)
          await emit(CONTENT_PROTECTION_EVENT, { isProtected: protectedValue });
          console.log(
            `Content protection event emitted globally: ${protectedValue}`
          );

          // Also try to emit to all windows explicitly as a fallback
          try {
            const windows = await getAllWindows();
            const currentWindow = getCurrentWindow();
            const currentWindowLabel = currentWindow.label;
            for (const window of windows) {
              const label = window.label;
              // Skip current window as it already has the protection applied
              if (label !== currentWindowLabel) {
                try {
                  await window.emit(CONTENT_PROTECTION_EVENT, {
                    isProtected: protectedValue,
                  });
                  console.log(
                    `Content protection event emitted to window ${label}: ${protectedValue}`
                  );
                } catch (err) {
                  console.warn(`Failed to emit to window ${label}:`, err);
                }
              }
            }
          } catch (err) {
            console.warn("Failed to emit to individual windows:", err);
          }
        } catch (error) {
          console.error("Failed to emit content protection event:", error);
        }
      }
    } catch (error) {
      console.error("Failed to set content protection:", error);
      throw error;
    }
  };

  // Combined function to toggle both visibility and content protection
  const toggleVisibilityAndProtection = async () => {
    try {
      const newVisible = !isVisible;
      const newProtected = !isContentProtected;

      // Update visibility (now async)
      await updateVisibility(newVisible);

      // Update content protection
      await updateContentProtection(newProtected);
    } catch (error) {
      console.error("Error toggling visibility and content protection:", error);
    }
  };

  return (
    <VisibilityContext.Provider
      value={{
        isVisible,
        isContentProtected,
        toggleVisibilityAndProtection,
      }}
    >
      {children}
    </VisibilityContext.Provider>
  );
}

export function useVisibility() {
  const context = useContext(VisibilityContext);
  if (context === undefined) {
    throw new Error("useVisibility must be used within a VisibilityProvider");
  }
  return context;
}
