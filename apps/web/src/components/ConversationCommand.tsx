import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { useUser } from "@/hooks/useUser";
import {
  getUserConversations,
  getConversation,
  getConversationMessages,
} from "@/services/conversation.server";
import type { Conversation } from "@/services/conversation.server";

interface ConversationCommandProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ConversationWithPreview extends Conversation {
  preview?: string;
}

export function ConversationCommand({
  open,
  onOpenChange,
}: ConversationCommandProps) {
  const [conversations, setConversations] = useState<ConversationWithPreview[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const { user } = useUser();
  const navigate = useNavigate();

  // Fetch conversations when dialog opens
  useEffect(() => {
    if (open && user?.id) {
      fetchConversations();
    }
  }, [open, user?.id]);

  const fetchConversations = async () => {
    if (!user?.id) return;

    try {
      setIsLoading(true);
      const convs = await getUserConversations({
        data: { userId: user.id },
      });

      // Fetch preview for each conversation (summary or first message)
      const convsWithPreview = await Promise.all(
        convs.map(async (conv) => {
          try {
            const details = await getConversation({
              data: { conversationId: conv.id },
            });

            let preview: string | undefined;

            // Try to get summary content first
            if (details?.summary?.content) {
              try {
                const summaryContent = JSON.parse(details.summary.content);
                const extractText = (node: any): string => {
                  if (typeof node === "string") return node;
                  if (node?.text && typeof node.text === "string")
                    return node.text;
                  if (Array.isArray(node?.children)) {
                    return node.children.map(extractText).join("");
                  }
                  return "";
                };
                const summaryText = Array.isArray(summaryContent)
                  ? summaryContent.map(extractText).join(" ").trim()
                  : extractText(summaryContent).trim();
                if (summaryText) {
                  preview = summaryText;
                }
              } catch (parseError) {
                // If parsing fails, use content as is if it's not JSON
                const rawContent = details.summary.content.trim();
                if (rawContent && !rawContent.startsWith("[")) {
                  preview = rawContent;
                }
              }
            }

            // If no summary, try to get first message
            if (!preview) {
              try {
                const messages = await getConversationMessages({
                  data: { conversationId: conv.id },
                });
                if (messages && messages.length > 0) {
                  const firstMessage = messages[0];
                  if (firstMessage.content) {
                    preview = firstMessage.content;
                  }
                }
              } catch (error) {
                // Ignore errors when fetching messages
              }
            }

            return {
              ...conv,
              preview: preview
                ? preview.length > 100
                  ? preview.substring(0, 100) + "..."
                  : preview
                : undefined,
            };
          } catch (error) {
            console.warn("Failed to fetch preview for conversation:", conv.id);
            return { ...conv, preview: undefined };
          }
        })
      );

      setConversations(convsWithPreview);
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
      setConversations([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter conversations based on search
  const filteredConversations = useMemo(() => {
    if (!search.trim()) {
      return conversations;
    }

    const searchLower = search.toLowerCase();
    return conversations.filter((conv) => {
      const titleMatch = conv.title?.toLowerCase().includes(searchLower);
      const previewMatch = conv.preview?.toLowerCase().includes(searchLower);
      return titleMatch || previewMatch;
    });
  }, [conversations, search]);

  const handleSelect = (conversationId: string) => {
    navigate({
      to: "/conversation/$id",
      params: { id: conversationId },
    });
    onOpenChange(false);
    setSearch("");
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search conversations"
      description="Search or ask anything..."
      className="max-w-2xl"
    >
      <CommandInput
        placeholder="Search or ask anything..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList className="max-h-[400px]">
        {isLoading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Loading conversations...
          </div>
        ) : filteredConversations.length === 0 ? (
          <CommandEmpty>No conversations found.</CommandEmpty>
        ) : (
          <CommandGroup heading="Recent sessions">
            {filteredConversations.map((conv) => (
              <CommandItem
                key={conv.id}
                value={`${conv.title || "Untitled session"} ${
                  conv.preview || ""
                }`}
                onSelect={() => handleSelect(conv.id)}
                className="flex flex-col items-start gap-1.5 px-3 py-3 cursor-pointer"
              >
                <div className="flex items-center gap-2 w-full">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm">
                    {conv.title || "Untitled session"}
                  </span>
                </div>
                {conv.preview && (
                  <div className="text-xs text-muted-foreground ml-6 line-clamp-2 leading-relaxed">
                    {conv.preview}
                  </div>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
