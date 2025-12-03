"use client";

import { useState } from "react";
import ExampleEditor from "./ExampleEditor";
import { useToast } from "./ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";

export default function ExampleList({ label, onUpdate }) {
  const [editingIndex, setEditingIndex] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [deletingIndex, setDeletingIndex] = useState(null);
  const [adding, setAdding] = useState(false);
  const [updatingIndex, setUpdatingIndex] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [exampleToDelete, setExampleToDelete] = useState(null);
  const { toast } = useToast();

  const handleAdd = async (example) => {
    setAdding(true);
    try {
      const response = await fetch(`/api/labels/${label.name}/examples`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ example }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.details || errorData.error || "Failed to add example"
        );
      }

      const result = await response.json();
      toast({
        title: "Success",
        description:
          result.message ||
          "Example added successfully! Embeddings are being recomputed in the background.",
        variant: "success",
      });
      setShowAddForm(false);
      // Refresh the labels to get updated data
      await onUpdate();
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to add example",
        variant: "destructive",
      });
    } finally {
      setAdding(false);
    }
  };

  const handleEdit = async (index, newExample) => {
    setUpdatingIndex(index);
    try {
      const response = await fetch(
        `/api/labels/${label.name}/examples/${index}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ example: newExample }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.details || errorData.error || "Failed to update example"
        );
      }

      const result = await response.json();
      toast({
        title: "Success",
        description:
          result.message ||
          "Example updated successfully! Embeddings are being recomputed in the background.",
        variant: "success",
      });
      setEditingIndex(null);
      // Refresh the labels to get updated data
      await onUpdate();
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to update example",
        variant: "destructive",
      });
    } finally {
      setUpdatingIndex(null);
    }
  };

  const handleDeleteClick = (index) => {
    setExampleToDelete(index);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (exampleToDelete === null) return;

    const index = exampleToDelete;
    setDeleteDialogOpen(false);
    setDeletingIndex(index);

    try {
      const response = await fetch(
        `/api/labels/${label.name}/examples/${index}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.details || errorData.error || "Failed to delete example"
        );
      }

      const result = await response.json();
      toast({
        title: "Success",
        description:
          result.message ||
          "Example deleted successfully! Embeddings are being recomputed in the background.",
        variant: "success",
      });
      // Refresh the labels to get updated data
      await onUpdate();
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete example",
        variant: "destructive",
      });
    } finally {
      setDeletingIndex(null);
      setExampleToDelete(null);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-lg font-semibold text-foreground">Examples</h4>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          + Add Example
        </button>
      </div>

      {showAddForm && (
        <ExampleEditor
          onSave={(example) => {
            handleAdd(example);
          }}
          onCancel={() => setShowAddForm(false)}
          disabled={adding}
        />
      )}

      <div className="space-y-2 mt-4">
        {label.examples && label.examples.length > 0 ? (
          label.examples.map((example, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-muted/50 rounded-md border border-border"
            >
              {editingIndex === index ? (
                <ExampleEditor
                  initialValue={example}
                  onSave={(newExample) => {
                    handleEdit(index, newExample);
                  }}
                  onCancel={() => setEditingIndex(null)}
                  disabled={updatingIndex === index}
                />
              ) : (
                <>
                  <span className="flex-1 text-foreground">{example}</span>
                  <div className="flex gap-2 ml-4">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setEditingIndex(index)}
                      disabled={
                        deletingIndex === index || updatingIndex === index
                      }
                      className="px-3 py-1"
                    >
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteClick(index)}
                      disabled={
                        deletingIndex === index || updatingIndex === index
                      }
                      className="px-3 py-1"
                    >
                      {deletingIndex === index ? "Deleting..." : "Delete"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))
        ) : (
          <p className="text-muted-foreground text-center py-4">
            No examples yet. Add one to get started!
          </p>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Example</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this example? This action cannot
              be undone.
              {exampleToDelete !== null &&
                label.examples?.[exampleToDelete] && (
                  <div className="mt-2 p-2 bg-muted rounded text-sm text-foreground">
                    "{label.examples[exampleToDelete]}"
                  </div>
                )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={() => setDeleteDialogOpen(false)}
              className="px-4 py-2 bg-muted text-foreground rounded-md hover:bg-muted/80 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteConfirm}
              className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors"
            >
              Delete
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
