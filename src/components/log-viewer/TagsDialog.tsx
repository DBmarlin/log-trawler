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
  itemId?: string;
  itemName?: string;
  itemIds?: string[];
  itemNames?: string[];
  initialTags?: string[];
  onSaveTags: (itemId: string, tags: string[]) => void;
}

const TagsDialog: React.FC<TagsDialogProps> = ({
  isOpen,
  onClose,
  itemId,
  itemName,
  itemIds,
  itemNames,
  initialTags = [],
  onSaveTags,
}) => {
  const isBulk = itemIds && itemIds.length > 1;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isBulk
              ? `Manage Tags for ${itemIds.length} selected items`
              : `Manage Tags for "${itemName}"`
            }
          </DialogTitle>
        </DialogHeader>
        <TagsPanel
          itemId={itemId || ""}
          itemIds={itemIds}
          initialTags={initialTags}
          onSaveTags={(tags) => {
            if (isBulk && itemIds) {
              // Save tags for all selected items
              itemIds.forEach(id => onSaveTags(id, tags));
            } else if (itemId) {
              onSaveTags(itemId, tags);
            }
            // Close dialog after saving
            onClose();
          }}
        />
      </DialogContent>
    </Dialog>
  );
};

export default TagsDialog;