import {
  Cancel01Icon,
  MaximizeIcon,
  MinimizeIcon,
} from "@hugeicons/core-free-icons";
import {
  getCurrentWindow,
  type Window as TauriWindow,
} from "@tauri-apps/api/window";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft, LoaderPinwheel, Minus, Search, Square } from "lucide-react";
import { Button } from "./ui/button";
import { Kbd, KbdGroup } from "./ui/kbd";
import { ProfileDropdown } from "./ProfileDropdown";
import { useEffect, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { useRouterState } from "@tanstack/react-router";
import { useVisibility } from "@/contexts/VisibilityContext";
import { motion, AnimatePresence } from "framer-motion";
interface TitleBarProps {
  children: React.ReactNode;
  onSearchClick?: () => void;
}

function TitleBar({ children, onSearchClick }: TitleBarProps) {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isHome = pathname === "/";
  const { isVisible } = useVisibility();
  const [appWindow, setAppWindow] = useState<TauriWindow | null>(null);


  // Only get window in client-side (Tauri)
  useEffect(() => {
    if (typeof window !== "undefined" && window.__TAURI__) {
      (async () => {
        try {
          const tauriWindow = await getCurrentWindow();
          setAppWindow(tauriWindow);
        } catch (error) {
          console.error("Error getting current window:", error);
        }
      })();
    }
  }, []);

  const minimize = async () => {
    try {
      if (appWindow) {
        await appWindow.minimize();
      } else if (typeof window !== "undefined" && window.__TAURI__) {
        const tauriWindow = await getCurrentWindow();
        await tauriWindow.minimize();
      }
    } catch (error) {
      console.error("Error minimizing window:", error);
    }
  };
  
  const toggleMaximize = async () => {
    try {
      if (appWindow) {
        await appWindow.toggleMaximize();
      } else if (typeof window !== "undefined" && window.__TAURI__) {
        const tauriWindow = await getCurrentWindow();
        await tauriWindow.toggleMaximize();
      }
    } catch (error) {
      console.error("Error toggling maximize:", error);
    }
  };
  
  const close = async () => {
    try {
      if (appWindow) {
        await appWindow.close();
      } else if (typeof window !== "undefined" && window.__TAURI__) {
        const tauriWindow = await getCurrentWindow();
        await tauriWindow.close();
      }
    } catch (error) {
      console.error("Error closing window:", error);
    }
  };

  return (
    <div className="flex flex-col  w-full h-[calc(100vh-1px)] min-h-0 bg-sidebar ">
      <div
        data-tauri-drag-region="true"
        className=" flex h-8 items-center justify-between select-none sticky top-0 left-0 right-0 z-50"
      >
        <div className="flex items-center ml-1.5 ">
          <Link className="text-muted-foreground hover:text-foreground" to="/">
            <LoaderPinwheel />
          </Link>
          <Link
            className="bg-transparent"
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            disabled={isHome}
            to="/"
          >
            <ArrowLeft size={25} />
          </Link>
        </div>

        <div
          className="flex items-center justify-between w-full bg-muted/50 max-w-md rounded-xl placeholder:text-muted-foreground/20 px-2 cursor-pointer hover:bg-muted/70 transition-colors"
          onClick={onSearchClick}
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <Search className="text-muted-foreground w-4" />
          <span className="text-muted-foreground/40 text-sm">
            Search or ask anything...
          </span>
          <KbdGroup className="py-1">
            <Kbd className="rounded-md py-1 text-xs">Ctrl</Kbd>
            <Kbd className="rounded-md text-xs">K</Kbd>
          </KbdGroup>
        </div>

        <div className="flex h-full " style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
          <ProfileDropdown />
          <button
            onClick={minimize}
            className=" h-full p-2 rounded flex items-center justify-center border-none bg-transparent cursor-pointer hover:bg-accent"
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          >
            <Minus className="w-3.5" />
          </button>
          <button
            onClick={toggleMaximize}
            className=" h-full p-2 rounded flex items-center justify-center border-none bg-transparent cursor-pointer hover:bg-accent"
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          >
            <Square className="w-3.5" />
          </button>
          <button
            onClick={close}
            className="  h-full p-2 rounded flex items-center justify-center border-none bg-transparent cursor-pointer hover:bg-destructive"
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          >
            <HugeiconsIcon icon={Cancel01Icon} className="w-5" />
          </button>
        </div>
      </div>
      <div className="flex-1 border mx-1 rounded-md z-50 mb-1 relative bg-background h-[calc(100vh-1px)] overflow-hidden">
        {children}
        <AnimatePresence>
          {!isVisible && (
            <motion.div
              key="dashed-border"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 border-2 border-dashed border-muted-foreground/30 rounded-md pointer-events-none"
              style={{
                zIndex: 9999
              }}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default TitleBar;
