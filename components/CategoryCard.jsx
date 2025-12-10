"use client";

import { useState } from "react";
import CategoryExampleList from "./CategoryExampleList";
import { useToast } from "./ui/use-toast";

export default function CategoryCard({ category, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [threshold, setThreshold] = useState(category.threshold || 0.4);
  const [name, setName] = useState(category.name);
  const [description, setDescription] = useState(category.description || "");
  const { toast } = useToast();

  const handleSave = async () => {
    setSaving(true);
    try {
      // Update category details
      const updateData = {
        name: name.trim(),
        description: description.trim() || null,
      };

      const response = await fetch(`/api/categories/${category.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.details || errorData.error || "Failed to update category"
        );
      }

      // Update threshold separately
      if (threshold !== category.threshold) {
        const thresholdResponse = await fetch(
          `/api/categories/${category.id}/threshold`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ threshold: parseFloat(threshold) }),
          }
        );

        if (!thresholdResponse.ok) {
          const errorData = await thresholdResponse.json().catch(() => ({}));
          throw new Error(
            errorData.details || errorData.error || "Failed to update threshold"
          );
        }
      }

      toast({
        title: "Success",
        description: "Category updated successfully",
        variant: "success",
      });
      setEditing(false);
      await onUpdate();
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to update category",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setName(category.name);
    setDescription(category.description || "");
    setThreshold(category.threshold || 0.4);
    setEditing(false);
  };

  if (!category) return null;

  return (
    <div className="bg-card rounded-lg shadow-md p-6">
      <div className="mb-6">
        {editing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                placeholder="Category name"
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
                placeholder="Category description"
                rows={2}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Threshold
                <span className="ml-2 text-xs text-muted-foreground">
                  (0.0 - 1.0, default: 0.4)
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
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Classification score must be &gt;= this threshold to use local
                embeddings instead of GPT fallback
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving || !name.trim()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed transition-colors"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={handleCancel}
                disabled={saving}
                className="px-4 py-2 bg-muted text-foreground rounded-md hover:bg-muted/80 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-2xl font-semibold text-foreground capitalize">
                    {category.name}
                  </h3>
                  {category.description && (
                    <p className="text-muted-foreground mt-1">
                      {category.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    <span>
                      {category.examplesCount || 0} example
                      {(category.examplesCount || 0) !== 1 ? "s" : ""}
                    </span>
                    <span>
                      Threshold: {category.threshold?.toFixed(2) || "0.40"}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditing(true)}
                    className="px-4 py-2 bg-muted text-foreground rounded-md hover:bg-muted/80 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={onDelete}
                    className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>

            {/* Embedding Status Progress Bar */}
            {category.examplesCount > 0 && category.completionPercentage !== undefined && (
              <div className="p-4 bg-muted/20 rounded-lg">
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">Embedding Status</span>
                  <span className="text-sm text-muted-foreground">
                    {category.computedCount || 0} of {category.examplesCount || 0} computed
                  </span>
                </div>
                <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${category.completionPercentage === 100
                        ? 'bg-green-500'
                        : category.completionPercentage === 0
                          ? 'bg-gray-400'
                          : 'bg-yellow-500'
                      }`}
                    style={{ width: `${category.completionPercentage || 0}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {!editing && (
        <CategoryExampleList category={category} onUpdate={onUpdate} />
      )}
    </div>
  );
}
