import { EditableTitle } from "@/components/conversations-components/EditableTitle";
import { SummaryTab } from "@/components/conversations-components/SummaryTab";
import { TranscriptTab } from "@/components/conversations-components/TranscriptTab";
import { UsageTab } from "@/components/conversations-components/UsageTab";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, Play, MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { useUser } from "@/hooks/useUser";
import {
  getConversation,
  updateConversationTitle,
  type ConversationDetails,
} from "@/services/conversation.server";
import { useSummaryEditor } from "@/hooks/useSummaryEditor";
import {
  getChatByConversationId,
  createChatForConversation,
} from "@/services/chat.server";
import { invoke } from "@tauri-apps/api/core";

export const Route = createFileRoute("/conversation/$id")({
  component: RouteComponent,
});

function RouteComponent() {
  const { id } = Route.useParams();
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState<string>("summary");
  const [conversation, setConversation] = useState<ConversationDetails | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [existingChat, setExistingChat] = useState<any>(null);
  const [isCheckingChat, setIsCheckingChat] = useState(true);

  // Fetch conversation details and check for existing chat
  useEffect(() => {
    const fetchConversation = async () => {
      if (!id) return;

      try {
        setIsLoading(true);
        setIsCheckingChat(true);
        const conv = await getConversation({ data: { conversationId: id } });
        setConversation(conv);

        // Check if there's an existing chat for this conversation
        if (conv && user?.id) {
          const chat = await getChatByConversationId({
            data: { conversationId: id },
          });
          setExistingChat(chat);
        }
      } catch (error) {
        console.error("Failed to fetch conversation:", error);
      } finally {
        setIsLoading(false);
        setIsCheckingChat(false);
      }
    };

    fetchConversation();
  }, [id, user?.id]);

  // Use summary editor hook
  const { editor, handleEditorChange, handleImmediateSave } = useSummaryEditor({
    conversationId: id,
    summaryId: conversation?.summary?.id,
    summaryContent: conversation?.summary?.content,
    userId: user?.id || "",
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
        <p className="text-muted-foreground">Loading conversation...</p>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
        <p className="text-muted-foreground">Conversation not found</p>
      </div>
    );
  }

  const formatDate = (date: Date) => {
    const days = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const d = new Date(date);
    return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
  };

  const handleResumeOrStartSession = async () => {
    try {
      let chat = existingChat;

      // Se não existe chat, criar um novo vinculado à conversa
      if (!chat && user?.id) {
        chat = await createChatForConversation({
          data: {
            conversationId: id,
            userId: user.id,
            title: conversation?.title || "New Chat",
          },
        });
        setExistingChat(chat);
      }

      if (!chat) {
        console.error("Failed to get or create chat for this conversation");
        return;
      }

      // Usar comando Tauri para mostrar a janela menu e emitir o evento
      await invoke("show_menu_window_and_emit", { chatId: chat.id });
    } catch (error) {
      console.error("Failed to resume/start session:", error);
    }
  };

  const handleTabChange = (value: string) => {
    // Save before switching tabs
    if (editor && activeTab === "summary") {
      handleImmediateSave(editor.children);
    }
    setActiveTab(value);
  };

  const handleTitleSave = async (newTitle: string) => {
    try {
      await updateConversationTitle({
        data: { conversationId: id, title: newTitle },
      });
      // Update local state to reflect the new title
      setConversation((prev: ConversationDetails | null) =>
        prev ? { ...prev, title: newTitle } : null
      );
    } catch (error) {
      console.error("Failed to save title:", error);
    }
  };

  return (
    <div className="flex h-full w-full flex-col bg-background text-foreground overflow-y-auto">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 shrink-0 ">
        <div className="mx-auto max-w-4xl flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">
              {formatDate(conversation.updatedAt)}
            </p>
            <EditableTitle
              initialTitle={conversation.title || "Untitled session"}
              onSave={handleTitleSave}
            />
          </div>
        </div>
      </header>

      <div className="flex-1 flex items-start justify-center min-h-0">
        <div className="max-w-4xl w-full">
          {/* Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={handleTabChange}
            className="w-full h-full flex flex-col"
          >
            <div className="pt-4 shrink-0">
              <div className="mx-auto max-w-4xl">
                <TabsList className="h-auto bg-card rounded-2xl border p-0 gap-1">
                  <TabsTrigger
                    value="summary"
                    className="rounded-2xl px-3 py-1 text-xs m-1 font-medium data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground data-[state=active]:shadow-none data-[state=inactive]:text-muted-foreground"
                  >
                    Summary
                  </TabsTrigger>
                  <TabsTrigger
                    value="transcript"
                    className="rounded-2xl px-3 py-1 text-xs m-1 font-medium data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground data-[state=active]:shadow-none data-[state=inactive]:text-muted-foreground"
                  >
                    Transcript
                  </TabsTrigger>
                  <TabsTrigger
                    value="usage"
                    className="rounded-2xl px-3 py-1 text-xs m-1 font-medium data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground data-[state=active]:shadow-none data-[state=inactive]:text-muted-foreground"
                  >
                    Usage
                  </TabsTrigger>
                </TabsList>
              </div>
            </div>

            {/* Main Content */}
            <main className=" flex-1 min-h-0 flex flex-col">
              <div className="flex-1 min-h-0">
                <TabsContent value="summary" className="h-full">
                  <SummaryTab
                    editor={editor}
                    onEditorChange={handleEditorChange}
                  />
                </TabsContent>

                <TabsContent value="transcript" className="mt-0">
                  <TranscriptTab conversationId={id} />
                </TabsContent>

                <TabsContent value="usage" className="mt-0">
                  <UsageTab conversationId={id} />
                </TabsContent>
              </div>
            </main>
          </Tabs>

          {/* Bottom Bar */}
          <div className=" fixed bottom-0 left-0 right-0 border-border px-6 py-4">
            <div className="mx-auto flex max-w-2xl items-center gap-4">
              <Button
                variant="outline"
                className="gap-2 bg-card/70! backdrop-blur-sm rounded-full text-xs text-muted-foreground"
                onClick={handleResumeOrStartSession}
                disabled={isCheckingChat}
              >
                {existingChat ? (
                  <>
                    <Play className=" fill-card-foreground"  />
                    Resume Session
                  </>
                ) : (
                  <>
                    <MessageSquare className="h-3 w-3" />
                    Start Conversation
                  </>
                )}
              </Button>
              <div className="flex-1 bg-card/70! backdrop-blur-sm border rounded-full pl-4 pr-1 py-0.5 flex items-center justify-between">
                <input
                  type="text"
                  placeholder="Ask about this meeting..."
                  className="flex-1  text-sm outline-none placeholder:text-muted-foreground "
                />
                <Button size="sm" className="h-8 w-8 rounded-full p-0 bg-accent text-card-foreground">
                  <ArrowUpRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
