import { useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FeedbackForm } from "@/components/feedback-form";

export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="lg"
          className="fixed bottom-6 right-6 z-40 rounded-full shadow-lg bg-accent text-accent-foreground hover:bg-accent/90 gap-2 print:hidden"
        >
          <MessageSquarePlus className="h-4 w-4" />
          Feedback
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Report a bug or request a feature</DialogTitle>
          <DialogDescription>
            Tell us what's broken or what you'd like to see. Goes straight to the admin queue.
          </DialogDescription>
        </DialogHeader>
        <FeedbackForm onSubmitted={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
