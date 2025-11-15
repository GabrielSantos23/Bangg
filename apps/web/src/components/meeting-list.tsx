"use client";

import { MeetingItem } from "@/components/meeting-item";

interface Meeting {
  id: string | number;
  title: string;
  duration: string;
  uses: number;
  time: string;
}

interface MeetingSection {
  section: string;
  items: Meeting[];
}

interface MeetingListProps {
  meetings: MeetingSection[];
  onDelete?: () => void;
}

export function MeetingList({ meetings, onDelete }: MeetingListProps) {
  return (
    <div className="space-y-8">
      {meetings.map((section) => (
        <div key={section.section}>
          <h2 className="mb-4 text-sm font-medium text-muted-foreground">
            {section.section}
          </h2>
          <div className="space-y-2">
            {section.items.map((meeting) => (
              <MeetingItem
                key={meeting.id}
                meeting={meeting}
                onDelete={onDelete}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
