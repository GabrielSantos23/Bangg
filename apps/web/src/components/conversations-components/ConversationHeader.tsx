import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { invoke } from "@tauri-apps/api/core";
import { Loader } from "@/components/ai-elements/loader";
import { CalendarSync, Eye, HatGlasses, Loader2 } from "lucide-react";
import { useVisibility } from "@/contexts/VisibilityContext";
import { Switch } from "../ui/switch";
import { Label } from "../ui/label";

interface ConversationHeaderProps {
  refresh: boolean;
  onRefresh: () => void;
}

export function ConversationHeader({
  refresh,
  onRefresh,
}: ConversationHeaderProps) {
  const { isVisible, isContentProtected, toggleVisibilityAndProtection } =
    useVisibility();

  return (
    <header className="py-6 z-10 bg-card/50 w-full">
      <div className="mx-auto flex max-w-5xl items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-xl text-muted-foreground">My Conversations</h1>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="secondary"
                  className="rounded-full hover:bg-muted/70 bg-transparent text-card-foreground border "
                  disabled={refresh}
                  onClick={onRefresh}
                >
                  {refresh ? (
                    <Loader2 className="animate-spin w-4" />
                  ) : (
                    <CalendarSync className="w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Refresh conversations</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div
            className="flex items-center gap-2 hover:bg-muted/70 px-2 py-1 border rounded-2xl cursor-pointer"
            onClick={toggleVisibilityAndProtection}
          >
            <span className="text-muted-foreground">
              {isVisible ? (
                <Eye className="w-4" />
              ) : (
                <HatGlasses className="w-4" />
              )}
            </span>
            <Switch
              id="visibility-switch"
              checked={!isVisible}
              onCheckedChange={toggleVisibilityAndProtection}
            />
            <Label
              // htmlFor="visibility-switch"
              className={`${
                isVisible ? "text-card-foreground" : "text-muted-foreground"
              }`}
            >
              {isVisible ? "Visible" : "Hidden"}
            </Label>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button
            className="bg-linear-to-b from-[#0845a7] to-[#264070] rounded-full text-card-foreground"
            onClick={async () => {
              try {
                await invoke("show_menu_window");
              } catch (error) {
                console.error("Failed to show menu window:", error);
              }
            }}
          >
            Start Bangg
          </Button>
        </div>
      </div>
    </header>
  );
}
