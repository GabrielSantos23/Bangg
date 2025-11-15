import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
import { listen } from "@tauri-apps/api/event";

interface AppSettings {
  appIconVisible: boolean;
  alwaysOnTop: boolean;
  autostart: boolean;
}

interface AppSettingsContextType {
  settings: AppSettings;
  toggleAppIconVisibility: (visible: boolean) => Promise<void>;
  toggleAlwaysOnTop: (enabled: boolean) => Promise<void>;
  toggleAutostart: (enabled: boolean) => Promise<void>;
  refreshSettings: () => Promise<void>;
  isLoading: boolean;
}

const AppSettingsContext = createContext<AppSettingsContextType | undefined>(
  undefined
);

const STORAGE_KEY = "app_settings";

export const AppSettingsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [settings, setSettings] = useState<AppSettings>(() => {
    // Default values for SSR - will be hydrated from localStorage on client
    return {
      appIconVisible: true,
      alwaysOnTop: false,
      autostart: false,
    };
  });

  const [isLoading, setIsLoading] = useState(true);

  // Load from localStorage on client mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setSettings(parsed);
        } catch (e) {
          console.error("Failed to parse stored settings:", e);
        }
      }
    }
  }, []);

  // Save settings to localStorage whenever they change (client-side only)
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }
  }, [settings]);

  // Listen for window toggle events to update app icon visibility
  useEffect(() => {
    const unlisten = listen("toggle-window-visibility", (event) => {
      const isHidden = event.payload as boolean;
      console.log(
        "Window visibility changed:",
        isHidden ? "hidden" : "visible"
      );

      // Update app icon based on stored preference when window toggles
      if (settings.appIconVisible !== undefined) {
        invoke("set_app_icon_visibility", {
          visible: settings.appIconVisible,
        }).catch((err) =>
          console.error("Failed to set app icon visibility:", err)
        );
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [settings.appIconVisible]);

  // Initialize settings from system state
  const refreshSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      // Check autostart status
      const autostartEnabled = await isEnabled();

      setSettings((prev) => ({
        ...prev,
        autostart: autostartEnabled,
      }));
    } catch (error) {
      console.error("Failed to refresh settings:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initialize on mount
  useEffect(() => {
    refreshSettings();
  }, [refreshSettings]);

  // Apply settings on mount and when they change
  useEffect(() => {
    if (!isLoading) {
      // Apply app icon visibility
      invoke("set_app_icon_visibility", {
        visible: settings.appIconVisible,
      }).catch((err) =>
        console.error("Failed to set app icon visibility:", err)
      );

      // Apply always on top
      invoke("set_always_on_top", { enabled: settings.alwaysOnTop }).catch(
        (err) => console.error("Failed to set always on top:", err)
      );
    }
  }, [settings.appIconVisible, settings.alwaysOnTop, isLoading]);

  const toggleAppIconVisibility = useCallback(async (visible: boolean) => {
    try {
      await invoke("set_app_icon_visibility", { visible });
      setSettings((prev) => ({ ...prev, appIconVisible: visible }));
    } catch (error) {
      console.error("Failed to toggle app icon visibility:", error);
      throw error;
    }
  }, []);

  const toggleAlwaysOnTop = useCallback(async (enabled: boolean) => {
    try {
      await invoke("set_always_on_top", { enabled });
      setSettings((prev) => ({ ...prev, alwaysOnTop: enabled }));
    } catch (error) {
      console.error("Failed to toggle always on top:", error);
      throw error;
    }
  }, []);

  const toggleAutostart = useCallback(async (enabled: boolean) => {
    try {
      if (enabled) {
        await enable();
      } else {
        await disable();
      }
      setSettings((prev) => ({ ...prev, autostart: enabled }));
    } catch (error) {
      console.error("Failed to toggle autostart:", error);
      throw error;
    }
  }, []);

  const value: AppSettingsContextType = {
    settings,
    toggleAppIconVisibility,
    toggleAlwaysOnTop,
    toggleAutostart,
    refreshSettings,
    isLoading,
  };

  return (
    <AppSettingsContext.Provider value={value}>
      {children}
    </AppSettingsContext.Provider>
  );
};

export const useAppSettings = () => {
  const context = useContext(AppSettingsContext);
  if (context === undefined) {
    throw new Error(
      "useAppSettings must be used within an AppSettingsProvider"
    );
  }
  return context;
};
