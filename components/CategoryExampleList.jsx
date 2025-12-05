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

export default function CategoryExampleList({ category, onUpdate }) {
  const [editingId, setEditingId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [exampleToDelete, setExampleToDelete] = useState(null);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkImporting, setBulkImporting] = useState(false);
  const [selectedExamples, setSelectedExamples] = useState(new Set());
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const { toast } = useToast();

  // Fetch examples from API
  const fetchExamples = async () => {
    try {
      const response = await fetch(`/api/categories/${category.id}`);
      if (!response.ok) throw new Error("Failed to fetch category");
      const data = await response.json();
      return data.examples || [];
    } catch (error) {
      console.error("Error fetching examples:", error);
      return [];
    }
  };

  const handleAdd = async (example) => {
    setAdding(true);
    try {
      const response = await fetch(`/api/categories/${category.id}/examples`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: example }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.details || errorData.error || "Failed to add example"
        );
      }

      toast({
        title: "Success",
        description: "Example added successfully",
        variant: "success",
      });
      setShowAddForm(false);
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

  const handleEdit = async (exampleId, newText) => {
    setUpdatingId(exampleId);
    try {
      const response = await fetch(
        `/api/categories/${category.id}/examples/${exampleId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: newText }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.details || errorData.error || "Failed to update example"
        );
      }

      toast({
        title: "Success",
        description: "Example updated successfully",
        variant: "success",
      });
      setEditingId(null);
      await onUpdate();
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to update example",
        variant: "destructive",
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteClick = (example) => {
    setExampleToDelete(example);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!exampleToDelete) return;

    const exampleId = exampleToDelete.id;
    setDeleteDialogOpen(false);
    setDeletingId(exampleId);

    try {
      const response = await fetch(
        `/api/categories/${category.id}/examples/${exampleId}`,
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

      toast({
        title: "Success",
        description: "Example deleted successfully",
        variant: "success",
      });
      await onUpdate();
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete example",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
      setExampleToDelete(null);
    }
  };

  const handleBulkImport = async () => {
    const lines = bulkText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      toast({
        title: "Error",
        description: "Please enter at least one example",
        variant: "destructive",
      });
      return;
    }

    setBulkImporting(true);
    try {
      const response = await fetch(
        `/api/categories/${category.id}/examples/bulk`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ examples: lines }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.details || errorData.error || "Failed to import examples"
        );
      }

      const result = await response.json();
      toast({
        title: "Success",
        description: `Imported ${
          result.count || lines.length
        } examples successfully`,
        variant: "success",
      });
      setShowBulkImport(false);
      setBulkText("");
      await onUpdate();
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to import examples",
        variant: "destructive",
      });
    } finally {
      setBulkImporting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedExamples.size === 0) return;

    setBulkDeleting(true);
    try {
      const response = await fetch(
        `/api/categories/${category.id}/examples/bulk`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ exampleIds: Array.from(selectedExamples) }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.details || errorData.error || "Failed to delete examples"
        );
      }

      toast({
        title: "Success",
        description: `Deleted ${selectedExamples.size} examples successfully`,
        variant: "success",
      });
      setShowBulkDelete(false);
      setSelectedExamples(new Set());
      await onUpdate();
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete examples",
        variant: "destructive",
      });
    } finally {
      setBulkDeleting(false);
    }
  };

  const toggleExampleSelection = (exampleId) => {
    const newSelected = new Set(selectedExamples);
    if (newSelected.has(exampleId)) {
      newSelected.delete(exampleId);
    } else {
      newSelected.add(exampleId);
    }
    setSelectedExamples(newSelected);
  };

  const toggleSelectAll = () => {
    const examples = category.examples || [];
    if (selectedExamples.size === examples.length) {
      setSelectedExamples(new Set());
    } else {
      setSelectedExamples(new Set(examples.map((e) => e.id)));
    }
  };

  const examples = category.examples || [];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-lg font-semibold text-foreground">Examples</h4>
        <div className="flex gap-2">
          <button
            onClick={() => setShowBulkImport(true)}
            className="px-4 py-2 bg-muted text-foreground rounded-md hover:bg-muted/80 transition-colors"
          >
            Bulk Import
          </button>
          {examples.length > 0 && (
            <button
              onClick={() => setShowBulkDelete(true)}
              className="px-4 py-2 bg-muted text-foreground rounded-md hover:bg-muted/80 transition-colors"
            >
              Bulk Delete
            </button>
          )}
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            + Add Example
          </button>
        </div>
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
        {examples.length > 0 ? (
          examples.map((example) => (
            <div
              key={example.id}
              className="flex items-center gap-2 p-3 bg-muted/50 rounded-md border border-border"
            >
              {showBulkDelete && (
                <input
                  type="checkbox"
                  checked={selectedExamples.has(example.id)}
                  onChange={() => toggleExampleSelection(example.id)}
                  className="w-4 h-4"
                />
              )}
              {editingId === example.id ? (
                <div className="flex-1">
                  <ExampleEditor
                    initialValue={example.text}
                    onSave={(newText) => {
                      handleEdit(example.id, newText);
                    }}
                    onCancel={() => setEditingId(null)}
                    disabled={updatingId === example.id}
                  />
                </div>
              ) : (
                <>
                  <span className="flex-1 text-foreground">{example.text}</span>
                  {!showBulkDelete && (
                    <div className="flex gap-2 ml-4">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setEditingId(example.id)}
                        disabled={
                          deletingId === example.id || updatingId === example.id
                        }
                        className="px-3 py-1"
                      >
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteClick(example)}
                        disabled={
                          deletingId === example.id || updatingId === example.id
                        }
                        className="px-3 py-1"
                      >
                        {deletingId === example.id ? "Deleting..." : "Delete"}
                      </Button>
                    </div>
                  )}
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

      {showBulkDelete && examples.length > 0 && (
        <div className="mt-4 p-4 bg-muted/30 rounded-md border border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">
              {selectedExamples.size} example
              {selectedExamples.size !== 1 ? "s" : ""} selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={toggleSelectAll}
                className="px-3 py-1 text-sm bg-muted text-foreground rounded-md hover:bg-muted/80 transition-colors"
              >
                {selectedExamples.size === examples.length
                  ? "Deselect All"
                  : "Select All"}
              </button>
              <button
                onClick={() => {
                  setShowBulkDelete(false);
                  setSelectedExamples(new Set());
                }}
                className="px-3 py-1 text-sm bg-muted text-foreground rounded-md hover:bg-muted/80 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={selectedExamples.size === 0 || bulkDeleting}
                className="px-3 py-1 text-sm bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 disabled:opacity-50 transition-colors"
              >
                {bulkDeleting
                  ? "Deleting..."
                  : `Delete ${selectedExamples.size}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Dialog */}
      <Dialog open={showBulkImport} onOpenChange={setShowBulkImport}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bulk Import Examples</DialogTitle>
            <DialogDescription>
              Enter multiple examples, one per line. Each line will be added as
              a separate example.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              className="w-full min-h-[300px] p-4 border border-border rounded-md bg-background text-foreground font-mono text-sm"
              placeholder="Example 1&#10;Example 2&#10;Example 3&#10;..."
              disabled={bulkImporting}
            />
            <div className="text-xs text-muted-foreground">
              {
                bulkText.split("\n").filter((line) => line.trim().length > 0)
                  .length
              }{" "}
              example
              {bulkText.split("\n").filter((line) => line.trim().length > 0)
                .length !== 1
                ? "s"
                : ""}{" "}
              detected
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => {
                setShowBulkImport(false);
                setBulkText("");
              }}
              disabled={bulkImporting}
              className="px-4 py-2 bg-muted text-foreground rounded-md hover:bg-muted/80 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleBulkImport}
              disabled={
                bulkImporting ||
                bulkText.split("\n").filter((line) => line.trim().length > 0)
                  .length === 0
              }
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed transition-colors"
            >
              {bulkImporting ? "Importing..." : "Import"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Example</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this example? This action cannot
              be undone.
              {exampleToDelete && (
                <div className="mt-2 p-2 bg-muted rounded text-sm text-foreground">
                  "{exampleToDelete.text}"
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
