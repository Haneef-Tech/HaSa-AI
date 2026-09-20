"use client";

import React, { useRef } from "react";
import { Paperclip } from "lucide-react";
import { Attachment } from "@/types/chat";
import { Tooltip } from "@/components/ui/tooltip";

interface AttachmentButtonProps {
  onAttach: (attachments: Attachment[]) => void;
  disabled?: boolean;
}

export const AttachmentButton: React.FC<AttachmentButtonProps> = ({
  onAttach,
  disabled = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: Attachment[] = Array.from(files).map((f) => ({
      id: Math.random().toString(36).substring(2, 9),
      name: f.name,
      size: `${(f.size / 1024).toFixed(1)} KB`,
      type: f.type || "file",
    }));

    onAttach(newAttachments);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled}
      />
      <Tooltip content="Attach files (code, documents, CSV)">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface transition-colors focus-ring disabled:opacity-40 disabled:pointer-events-none"
          aria-label="Attach files to conversation"
        >
          <Paperclip className="w-4 h-4" />
        </button>
      </Tooltip>
    </>
  );
};

