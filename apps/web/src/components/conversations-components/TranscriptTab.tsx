import { useEffect, useState } from "react";
import { FilePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getTranscriptionSegmentsByConversationId } from "@/services/transcription.server";
import type { TranscriptionSegment } from "@/services/transcription.server";

interface TranscriptTabProps {
  conversationId: string;
}

// Format time in seconds to MM:SS format
function formatTime(seconds?: number): string {
  if (seconds === undefined || seconds === null || isNaN(seconds)) {
    return "0:00";
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function TranscriptTab({ conversationId }: TranscriptTabProps) {
  const [segments, setSegments] = useState<TranscriptionSegment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchSegments = async () => {
      try {
        setIsLoading(true);
        const result = await getTranscriptionSegmentsByConversationId({
          data: { conversationId },
        });

        // Sort segments by startTime (treating null/undefined as 0), then by createdAt
        const sortedSegments = (result || []).sort((a, b) => {
          const timeA = a.startTime ?? 0;
          const timeB = b.startTime ?? 0;

          if (timeA !== timeB) {
            return timeA - timeB;
          }

          // If times are equal, sort by createdAt
          const dateA = new Date(a.createdAt).getTime();
          const dateB = new Date(b.createdAt).getTime();
          return dateA - dateB;
        });

        setSegments(sortedSegments);
      } catch (error) {
        console.error("Failed to fetch transcription segments:", error);
        setSegments([]);
      } finally {
        setIsLoading(false);
      }
    };

    if (conversationId) {
      fetchSegments();
    }
  }, [conversationId]);

  const handleCopyFullTranscript = async () => {
    const fullText = segments
      .map((seg) => {
        const time = formatTime(seg.startTime);
        return `${time}: ${seg.text}`;
      })
      .join("\n");

    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy transcript:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <p className="text-muted-foreground">Loading transcript...</p>
      </div>
    );
  }

  if (segments.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <p className="text-muted-foreground">
          No transcript available for this conversation.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Header with copy button */}
      <div className="flex items-center justify-end p-4 border-b border-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopyFullTranscript}
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <FilePlus className="h-4 w-4" />
          {copied ? "Copied!" : "Copy full transcript"}
        </Button>
      </div>

      {/* Transcript content */}
      <div className="p-6 space-y-4 max-h-[calc(100vh-300px)] overflow-y-auto">
        {segments.map((segment) => (
          <div key={segment.id}>
            {/* Speaker name and timestamp */}
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-sm font-medium text-blue-500">Speaker</span>
              <span className="text-sm text-blue-500">
                {formatTime(segment.startTime)}
              </span>
            </div>

            {/* Transcript text */}
            <div>
              <p className="text-sm text-foreground leading-relaxed">
                {segment.text}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
