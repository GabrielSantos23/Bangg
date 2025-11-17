import { useState, useRef, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Loader2,
  Monitor,
  Zap,
  ChevronDown,
  CornerDownLeft,
  XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ChatInputFormProps {
  handleSubmit: (event: FormEvent<HTMLFormElement>) => void;
  inputValue: string;
  setInputValue: (value: string) => void;
  attachments: string[];
  removeAttachment: (index: number) => void;
  isSending: boolean;
  autoScreenshot: boolean;
  chatError?: Error | null;
  autoFocus?: boolean;
  setAutoScreenshot: (value: boolean) => void;
}

export function ChatInputForm({
  handleSubmit,
  inputValue,
  setInputValue,
  attachments,
  removeAttachment,
  isSending,
  autoScreenshot,
  chatError,
  autoFocus = false,
  setAutoScreenshot,
}: ChatInputFormProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [smart, setSmart] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // ✨ 3. Handlers to set focus state
  const handleFocus = () => {
    setIsFocused(true);
  };
  const toggleAutoScreenshot = () => setAutoScreenshot(!autoScreenshot);

  const isAutoScreenshotEnabled = autoScreenshot;
  const isSmartEnabled = smart;

  const handleBlur = (event: React.FocusEvent<HTMLFormElement>) => {
    if (
      formRef.current &&
      !formRef.current.contains(event.relatedTarget as Node)
    ) {
      setIsFocused(false);
    }
  };
  const toggleSmart = () => setSmart(!smart);

  return (
    <form
      ref={formRef}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onSubmit={handleSubmit}
      className={`relative rounded-2xl border transition-colors border-muted-foreground/20' }`}
    >
      {/* Preview da imagem capturada acima do input */}
      {attachments.length > 0 && (
        <div className="p-2 pb-2 border-b border-border/50 flex justify-start">
          <div className="space-y-2">
            {attachments.map((img, index) => (
              <div
                key={index}
                className="relative inline-block rounded-lg border border-border/50 overflow-hidden bg-muted/30"
                style={{ display: "inline-block" }}
              >
                <img
                  src={`data:image/png;base64,${img}`}
                  alt={`Preview ${index + 1}`}
                  className="max-h-10 object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeAttachment(index)}
                  className="absolute top-0 right-0 flex items-center justify-center w-6 h-6 bg-zinc-900/90 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 text-muted-foreground rounded-full transition-all duration-200 border border-white/10 backdrop-blur-xl shadow-xl p-0"
                  aria-label="Remove attachment"
                  disabled={isSending}
                >
                  <XIcon className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="relative flex items-center p-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder=""
          className="flex-1 bg-transparent! border-none focus-visible:ring-0 focus-visible:ring-offset-0 text-card-foreground text-sm px-2 py-0"
          autoFocus={autoFocus}
          disabled={isSending}
        />
        {inputValue === "" && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center space-x-1 text-muted-foreground/40 text-sm pointer-events-none">
            <span>Ask about your screen or conversation, or</span>
            <span className="inline-flex items-center px-1 py-0.5 border border-muted rounded-md text-xs bg-muted text-card-foreground">
              ⇧
            </span>
            <span className="inline-flex items-center px-1 py-0.5 border border-muted rounded-md text-xs bg-muted text-card-foreground">
              <CornerDownLeft className="h-3 w-3" />
            </span>
            <span>for Assist</span>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isFocused && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="flex items-center justify-between p-2 pt-1 border-t ">
              <div className="flex space-x-2">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={attachments.length > 0}
                  className={`flex items-center gap-1 px-2 py-1 h-auto rounded-full text-[11px] leading-none
                    ${
                      attachments.length > 0
                        ? "bg-transparent border border-muted-foreground/20 text-muted-foreground/30 cursor-not-allowed opacity-50"
                        : isAutoScreenshotEnabled
                        ? "bg-[#1a2943] border border-[#6dbeef] text-[#6dbeef] hover:text-primary hover:bg-[#1b335a]!"
                        : "bg-transparent border border-muted-foreground/20 text-muted-foreground/50 hover:text-muted-foreground/70"
                    }
                  `}
                  onClick={toggleAutoScreenshot}
                  title={
                    attachments.length > 0
                      ? "Remove existing screenshot to enable"
                      : undefined
                  }
                >
                  <Monitor className="h-3 w-3" />
                  <span>Use Screen</span>
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className={`flex items-center gap-1 px-2 py-1 h-auto rounded-full text-[11px] leading-none
                    ${
                      isSmartEnabled
                        ? "bg-[#453e1b] border border-[#eadc79] text-[#eadc79]  hover:bg-[#5d521c]! hover:text-[#f5e67f]"
                        : "bg-transparent border border-muted-foreground/20 text-muted-foreground/50 hover:text-muted-foreground/70"
                    }
                  `}
                  onClick={toggleSmart}
                >
                  <Monitor className="h-3 w-3" />
                  <span>Smart</span>
                </Button>
              </div>
              <Button
                type="submit"
                size="icon"
                className="h-8 w-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white"
                disabled={
                  (!inputValue.trim() && attachments.length === 0) || isSending
                }
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {chatError && (
        <div className="rounded-md border border-red-500/50 bg-red-900/10 px-3 py-2 text-xs text-red-400 mx-2 mb-2">
          {chatError.message}
        </div>
      )}
    </form>
  );
}
