"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MoreHorizontal, Loader2 } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deleteConversationById } from "@/services/conversation";

interface Meeting {
  id: string | number;
  title: string;
  duration: string;
  uses: number;
  time: string;
}

interface MeetingItemProps {
  meeting: Meeting;
  onDelete?: () => void;
}

export function MeetingItem({ meeting, onDelete }: MeetingItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const navigate = useNavigate();

  const handleItemClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on the dropdown or dialog
    if ((e.target as HTMLElement).closest('[role="menu"], [role="dialog"]')) {
      return;
    }
    navigate({
      to: "/conversation/$id",
      params: { id: String(meeting.id) },
    });
  };

  // Mantém o hover ativo quando o dropdown está aberto
  const shouldShowEllipsis = isHovered || isDropdownOpen;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteConversationById(String(meeting.id));
      // Call the onDelete callback to refresh the list
      if (onDelete) {
        await onDelete();
      }
      // Close dialog only after delete and refresh are complete
      setShowDeleteDialog(false);
    } catch (error) {
      console.error("Failed to delete conversation:", error);
      // You might want to show an error toast here
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="group relative cursor-pointer rounded-lg px-4 py-2 transition-colors hover:bg-accent/50"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleItemClick}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-base font-medium">{meeting.title}</h3>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            {meeting.duration}
          </span>
          <span className="text-sm text-blue-500">{meeting.uses} uses</span>
          {/* Time and Ellipsis container */}
          <div className="relative flex w-20 items-center justify-end">
            {/* Time - fades out on hover */}
            <AnimatePresence>
              {!shouldShowEllipsis && (
                <motion.span
                  initial={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                  className="absolute right-0 text-sm text-muted-foreground"
                >
                  {meeting.time}
                </motion.span>
              )}
            </AnimatePresence>
            {/* Ellipsis button - fades in on hover */}
            <AnimatePresence>
              {shouldShowEllipsis && (
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                  className="absolute right-0"
                >
                  <DropdownMenu onOpenChange={setIsDropdownOpen}>
                    <DropdownMenuTrigger asChild>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
                      >
                        <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-40"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DropdownMenuItem className="cursor-pointer">
                        Copy link
                      </DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer">
                        Regenerate
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="cursor-pointer text-red-500 focus:text-red-500"
                        onClick={(e) => {
                          e.preventDefault();
                          setShowDeleteDialog(true);
                        }}
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Alert Dialog for Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent
          onClick={(e) => e.stopPropagation()}
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the conversation
              "{meeting.title}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-500 hover:bg-red-600 text-card-foreground disabled:opacity-50"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
