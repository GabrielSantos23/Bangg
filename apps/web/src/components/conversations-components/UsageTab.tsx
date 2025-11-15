interface UsageTabProps {
  conversationId: string;
}

export function UsageTab({ conversationId }: UsageTabProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <p className="text-muted-foreground">
        Usage information will be available here once implemented.
      </p>
      <p className="text-xs text-muted-foreground mt-2">
        Conversation ID: {conversationId}
      </p>
    </div>
  );
}





