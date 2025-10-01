import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import TagsPanel from "./TagsPanel";

interface TagsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  itemId: string;
  itemName: string;
  initialTags?: string[];
  onSaveTags: (itemId: string, tags: string[]) => void;
}

const TagsDialog: React.FC<TagsDialogProps> = ({
  isOpen,
  onClose,
  itemId,
  itemName,
  initialTags = [],
  onSaveTags,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Tags for "{itemName}"</DialogTitle>
        </DialogHeader>
        <TagsPanel
          itemId={itemId}
          initialTags={initialTags}
          onSaveTags={(tags) => {
            onSaveTags(itemId, tags);
            // Close dialog after saving
            onClose();
          }}
        />
      </DialogContent>
    </Dialog>
  );
};

export default TagsDialog;