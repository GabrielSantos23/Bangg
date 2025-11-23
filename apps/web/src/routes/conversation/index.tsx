import { MeetingList } from "@/components/meeting-list";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useUser } from "@/hooks/useUser";
import { getUserConversations } from "@/services/conversation";
import { ConversationHeader } from "@/components/conversations-components/ConversationHeader";
import { DashedBorder } from "@/components/DashedBorder";
import { useVisibility } from "@/contexts/VisibilityContext";
import { getCurrentUser } from "@/services/auth";
import { Bot } from "lucide-react";

export const Route = createFileRoute("/conversation/")({
  beforeLoad: async ({ navigate }) => {
    const user = await getCurrentUser();
    if (!user) {
      navigate({ to: "/Login" });
    }
  },
  component: RouteComponent,
});

interface Meeting {
  id: string;
  title: string;
  duration: string;
  uses: number;
  time: string;
}

interface MeetingSection {
  section: string;
  items: Meeting[];
}

function RouteComponent() {
  const [showShadow, setShowShadow] = useState(false);
  const [meetings, setMeetings] = useState<MeetingSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const { user } = useUser();
  const [refresh, setRefresh] = useState(false);
  const { isVisible } = useVisibility();

  const fetchConversations = async (isRefresh = false) => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      if (!isRefresh) {
        setIsLoading(true);
      }
      const conversations = await getUserConversations(user.id);

      // Group conversations by date
      const grouped = groupConversationsByDate(conversations);
      setMeetings(grouped);
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
      setMeetings([]);
    } finally {
      if (!isRefresh) {
        setIsLoading(false);
      }
      setRefresh(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [user?.id]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;

      // Calculate if we're at or near the bottom
      const scrollBottom = scrollTop + clientHeight;
      const isAtBottom = scrollBottom >= scrollHeight - 20; // 20px threshold
      const hasScrollableContent = scrollHeight > clientHeight;

      // Show shadow if there's scrollable content and we're not at the bottom
      setShowShadow(hasScrollableContent && !isAtBottom);
    };

    // Use a slight delay to ensure DOM is fully rendered
    const timeoutId = setTimeout(() => {
      handleScroll();
    }, 100);

    // Check on scroll and resize
    container.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    // Also check when content changes
    const resizeObserver = new ResizeObserver(handleScroll);
    resizeObserver.observe(container);

    return () => {
      clearTimeout(timeoutId);
      container.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
      resizeObserver.disconnect();
    };
  }, [meetings]);

  // Helper function to group conversations by date
  const groupConversationsByDate = (
    conversations: Array<{
      id: string;
      title?: string;
      createdAt: Date;
      updatedAt: Date;
    }>
  ): MeetingSection[] => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const groups: { [key: string]: Meeting[] } = {};

    conversations.forEach((conv) => {
      const date = new Date(conv.updatedAt);
      const dateKey = date.toDateString();
      const timeStr = formatTime(date);

      // Calculate duration (placeholder for now)
      const duration = "0:00";

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }

      groups[dateKey].push({
        id: conv.id,
        title: conv.title || "Untitled session",
        duration,
        uses: 0, // Placeholder
        time: timeStr,
      });
    });

    // Convert to sections with formatted dates
    const sections: MeetingSection[] = Object.entries(groups).map(
      ([dateKey, items]) => {
        const date = new Date(dateKey);
        let sectionLabel: string;

        if (date.toDateString() === today.toDateString()) {
          sectionLabel = "Today";
        } else if (date.toDateString() === yesterday.toDateString()) {
          sectionLabel = "Yesterday";
        } else {
          sectionLabel = formatDate(date);
        }

        return {
          section: sectionLabel,
          items: items.sort(
            (a, b) =>
              new Date(
                conversations.find((c) => c.id === b.id)?.updatedAt || 0
              ).getTime() -
              new Date(
                conversations.find((c) => c.id === a.id)?.updatedAt || 0
              ).getTime()
          ),
        };
      }
    );

    // Sort sections by date (newest first)
    return sections.sort((a, b) => {
      const dateA = parseSectionDate(a.section);
      const dateB = parseSectionDate(b.section);
      return dateB.getTime() - dateA.getTime();
    });
  };

  const formatTime = (date: Date): string => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? "pm" : "am";
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, "0");
    return `${displayHours}:${displayMinutes}${ampm}`;
  };

  const formatDate = (date: Date): string => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
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

    const dayName = days[date.getDay()];
    const month = months[date.getMonth()];
    const day = date.getDate();

    return `${dayName}, ${month} ${day}`;
  };

  const parseSectionDate = (section: string): Date => {
    const now = new Date();
    if (section === "Today") {
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }
    if (section === "Yesterday") {
      const yesterday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday;
    }
    // Try to parse date string like "Mon, Nov 10"
    const match = section.match(/(\w+), (\w+) (\d+)/);
    if (match) {
      const months: { [key: string]: number } = {
        Jan: 0,
        Feb: 1,
        Mar: 2,
        Apr: 3,
        May: 4,
        Jun: 5,
        Jul: 6,
        Aug: 7,
        Sep: 8,
        Oct: 9,
        Nov: 10,
        Dec: 11,
      };
      const month = months[match[2]];
      const day = parseInt(match[3]);
      if (month !== undefined && !isNaN(day)) {
        return new Date(now.getFullYear(), month, day);
      }
    }
    return new Date(0);
  };

  return (
    <div
      ref={containerRef}
      className="h-screen bg-transparent text-foreground overflow-y-auto relative"
    >
      <div className="w-full">
        {/* Header */}
        {!isLoading && (
          <ConversationHeader
            refresh={refresh}
            onRefresh={async () => {
              setRefresh(true);
              await fetchConversations(true);
            }}
          />
        )}
        <Link to="/chatbot">
          <Bot className="w-4 h-4" />
          AI Chatbot
        </Link>
        <main className="mx-auto   py-8 pb-20 max-w-5xl">
          {isLoading ? (
            <p className="mb-8 text-muted-foreground h-screen flex items-center justify-center">
              Loading conversations...
            </p>
          ) : meetings.length === 0 ? (
            <p className="mb-8 text-muted-foreground">
              You have no conversations yet.
            </p>
          ) : (
            <MeetingList
              meetings={meetings}
              onDelete={() => fetchConversations(true)}
            />
          )}
        </main>

        {/* Shadow gradient - fixed to viewport */}
        <div
          className={`pointer-events-none fixed bottom-0 left-0 right-0 h-32 bg-linear-to-t from-background via-background/80 to-transparent transition-opacity duration-300 z-20 ${
            showShadow ? "opacity-100" : "opacity-0"
          }`}
        />
      </div>
    </div>
  );
}
