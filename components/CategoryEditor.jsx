"use client";

import { useState } from "react";

export default function CategoryEditor({
  onSave,
  onCancel,
  initialData = null,
}) {
  const [name, setName] = useState(initialData?.name || "");
  const [description, setDescription] = useState(
    initialData?.description || ""
  );
  const [threshold, setThreshold] = useState(initialData?.threshold || 0.4);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || null,
        threshold: parseFloat(threshold) || 0.4,
      });
    } catch (error) {
      console.error("Error saving category:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Name *
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
          placeholder="e.g., code, reasoning, image_generation"
          required
          disabled={saving}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
          placeholder="Brief description of this category"
          rows={3}
          disabled={saving}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Threshold
          <span className="ml-2 text-xs text-muted-foreground">
            (0.0 - 1.0)
          </span>
        </label>
        <input
          type="number"
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          min="0"
          max="1"
          step="0.01"
          className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
          placeholder="0.4"
          disabled={saving}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Classification score must be &gt;= this threshold to use local
          embeddings instead of GPT fallback (default: 0.4)
        </p>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="px-4 py-2 bg-muted text-foreground rounded-md hover:bg-muted/80 disabled:opacity-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "Saving..." : initialData ? "Update" : "Create"}
        </button>
      </div>
    </form>
  );
}
