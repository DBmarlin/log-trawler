import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { StickyNote, Save } from "lucide-react";

interface NotesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  itemId: string;
  itemName: string;
  initialNotes?: string;
  onSaveNotes: (itemId: string, notes: string) => void;
}

const NotesDialog = ({
  isOpen,
  onClose,
  itemId,
  itemName,
  initialNotes = "",
  onSaveNotes,
}: NotesDialogProps) => {
  const [notes, setNotes] = useState(initialNotes);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  // Update notes when itemId or initialNotes changes
  useEffect(() => {
    setNotes(initialNotes);
    setSaveStatus("idle");
  }, [itemId, initialNotes]);

  const handleSave = () => {
    setSaveStatus("saving");
    setIsSaving(true);

    try {
      onSaveNotes(itemId, notes);
      setSaveStatus("saved");

      // Reset status after 2 seconds
      setTimeout(() => {
        setSaveStatus("idle");
      }, 2000);
    } catch (error) {
      console.error("Error saving notes:", error);
      setSaveStatus("error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    // Reset state when closing
    setNotes(initialNotes);
    setSaveStatus("idle");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StickyNote className="h-5 w-5" />
            Notes for "{itemName}"
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Textarea
            placeholder="Add notes about this item..."
            className="min-h-[200px] text-sm"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <div className="flex justify-between items-center">
            <div className="text-sm">
              {saveStatus === "saved" && (
                <span className="text-green-500">Notes saved successfully</span>
              )}
              {saveStatus === "error" && (
                <span className="text-red-500">Error saving notes</span>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NotesDialog;