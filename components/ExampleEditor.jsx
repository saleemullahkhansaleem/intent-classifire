"use client";

import { useState, useEffect } from "react";

export default function ExampleEditor({
  initialValue = "",
  onSave,
  onCancel,
  disabled = false,
}) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!value.trim()) {
      return;
    }
    if (disabled) return;
    onSave(value.trim());
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-4 p-4 bg-card/80 rounded-md border border-border w-full"
    >
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Enter example text..."
        className="w-full px-3 py-2 border border-input rounded-md focus:ring-2 focus:ring-primary focus:border-transparent resize-none disabled:opacity-50 disabled:cursor-not-allowed bg-background text-foreground"
        rows={2}
        autoFocus
        disabled={disabled}
      />
      <div className="flex gap-2 mt-2">
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {disabled ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={disabled}
          className="px-4 py-2 bg-muted text-foreground rounded-md hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
