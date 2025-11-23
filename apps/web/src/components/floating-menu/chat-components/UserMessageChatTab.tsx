import { motion } from "framer-motion";
import type { UIMessage } from "ai";
import { getTextFromMessage, getImagesFromMessage } from "@/lib/chat-utils";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Paperclip } from "lucide-react";

interface UserMessageChatTabProps {
  message: UIMessage;
}

export function UserMessageChatTab({ message }: UserMessageChatTabProps) {
  const text = getTextFromMessage(message);
  const images = getImagesFromMessage(message);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex justify-end"
    >
      <div className="flex flex-col items-end gap-1">
        <div className=" rounded-2xl px-4 py-2 bg-primary text-card-foreground">
          {text && <p className="text-sm whitespace-pre-wrap">{text}</p>}
        </div>
        {images.length > 0 && (
          <HoverCard openDelay={200}>
            <HoverCardTrigger asChild>
              <button className="flex items-center mr-2 gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                <Paperclip className="w-3 h-3" />
                <span>sent with attachment</span>
              </button>
            </HoverCardTrigger>
            <HoverCardContent
              side="left"
              align="start"
              className="w-auto max-w-sm p-2"
            >
              <div className="space-y-2">
                {images.map((img, imgIndex) => (
                  <div
                    key={imgIndex}
                    className="rounded-lg overflow-hidden border border-border"
                  >
                    <img
                      src={img}
                      alt={`Attachment ${imgIndex + 1}`}
                      className="max-w-full h-auto max-h-64 object-contain"
                    />
                  </div>
                ))}
              </div>
            </HoverCardContent>
          </HoverCard>
        )}
      </div>
    </motion.div>
  );
}
