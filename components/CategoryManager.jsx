"use client";

import { useState, useEffect } from "react";
import CategoryCard from "./CategoryCard";
import CategoryEditor from "./CategoryEditor";
import RecomputeStatus from "./RecomputeStatus";
import ConsumptionMetrics from "./ConsumptionMetrics";
import { useToast } from "./ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

export default function CategoryManager() {
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recomputing, setRecomputing] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [recomputeConsumption, setRecomputeConsumption] = useState(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await fetch("/api/categories");
      if (!response.ok) throw new Error("Failed to fetch categories");
      const data = await response.json();
      setCategories(data);
      // Keep the same selected category if it still exists, otherwise select first
      if (
        !selectedCategoryId ||
        !data.find((c) => c.id === selectedCategoryId)
      ) {
        const firstId = data[0]?.id || null;
        setSelectedCategoryId(firstId);
        if (firstId) {
          fetchCategoryDetails(firstId);
        } else {
          setSelectedCategory(null);
        }
      } else {
        // Refresh selected category details
        fetchCategoryDetails(selectedCategoryId);
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
      toast({
        title: "Error",
        description: "Failed to fetch categories",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCategoryDetails = async (categoryId) => {
    try {
      const response = await fetch(`/api/categories/${categoryId}`);
      if (!response.ok) throw new Error("Failed to fetch category details");
      const data = await response.json();
      setSelectedCategory(data);
    } catch (error) {
      console.error("Error fetching category details:", error);
      toast({
        title: "Error",
        description: "Failed to fetch category details",
        variant: "destructive",
      });
    }
  };

  const handleCategoryUpdate = async () => {
    await fetchCategories();
    if (selectedCategoryId) {
      await fetchCategoryDetails(selectedCategoryId);
    }
  };

  const handleCategorySelect = async (categoryId) => {
    setSelectedCategoryId(categoryId);
    if (categoryId) {
      await fetchCategoryDetails(categoryId);
    } else {
      setSelectedCategory(null);
    }
  };

  const handleCreateCategory = async (categoryData) => {
    try {
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(categoryData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.details || errorData.error || "Failed to create category"
        );
      }

      const newCategory = await response.json();
      toast({
        title: "Success",
        description: "Category created successfully",
        variant: "success",
      });
      setShowCreateDialog(false);
      await fetchCategories();
      await handleCategorySelect(newCategory.id);
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to create category",
        variant: "destructive",
      });
    }
  };

  const handleDeleteCategory = async () => {
    if (!deletingCategoryId) return;

    try {
      const response = await fetch(`/api/categories/${deletingCategoryId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.details || errorData.error || "Failed to delete category"
        );
      }

      toast({
        title: "Success",
        description: "Category deleted successfully",
        variant: "success",
      });
      setDeleteDialogOpen(false);
      setDeletingCategoryId(null);
      await fetchCategories();
      setSelectedCategoryId(null);
      setSelectedCategory(null);
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete category",
        variant: "destructive",
      });
    }
  };

  const handleRecompute = async () => {
    setRecomputing(true);
    setRecomputeConsumption(null);
    try {
      const response = await fetch("/api/recompute", {
        method: "POST",
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.details || errorData.error || "Recomputation failed"
        );
      }
      const result = await response.json();

      // Store consumption data if available
      if (result.consumption) {
        setRecomputeConsumption(result.consumption);
      }

      toast({
        title: "Success",
        description: `Embeddings recomputed successfully! Processed ${
          result.labelsProcessed || result.categoriesProcessed || 0
        } categories with ${result.totalExamples || 0} examples.`,
        variant: "success",
      });
    } catch (error) {
      console.error("Error recomputing:", error);
      toast({
        title: "Error",
        description: "Failed to recompute embeddings: " + error.message,
        variant: "destructive",
      });
    } finally {
      setRecomputing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-muted-foreground">Loading categories...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-foreground">
          Manage Categories & Examples
        </h2>
        <div className="flex gap-3">
          <button
            onClick={() => setShowCreateDialog(true)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            + New Category
          </button>
          <button
            onClick={handleRecompute}
            disabled={recomputing}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed transition-colors"
          >
            {recomputing ? "Recomputing..." : "Recompute Embeddings"}
          </button>
        </div>
      </div>

      {recomputing && <RecomputeStatus />}

      {/* Show consumption metrics after recomputation */}
      {!recomputing && recomputeConsumption && (
        <div className="mb-6">
          <ConsumptionMetrics consumption={recomputeConsumption} />
        </div>
      )}

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-border pb-4">
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => handleCategorySelect(category.id)}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              selectedCategoryId === category.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground hover:bg-muted/80"
            }`}
          >
            {category.name} ({category.examplesCount || 0})
            {category.threshold !== undefined && (
              <span className="ml-2 text-xs opacity-75">
                [t:{category.threshold.toFixed(2)}]
              </span>
            )}
          </button>
        ))}
        {categories.length === 0 && (
          <p className="text-muted-foreground">
            No categories yet. Create one to get started!
          </p>
        )}
      </div>

      {/* Selected Category Card */}
      {selectedCategory && (
        <CategoryCard
          category={selectedCategory}
          onUpdate={handleCategoryUpdate}
          onDelete={() => {
            setDeletingCategoryId(selectedCategory.id);
            setDeleteDialogOpen(true);
          }}
        />
      )}

      {/* Create Category Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Category</DialogTitle>
            <DialogDescription>
              Create a new category for classification
            </DialogDescription>
          </DialogHeader>
          <CategoryEditor
            onSave={handleCreateCategory}
            onCancel={() => setShowCreateDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Category Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Category</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this category? This will also
              delete all examples in this category. This action cannot be
              undone.
              {selectedCategory && (
                <div className="mt-2 p-2 bg-muted rounded text-sm text-foreground">
                  Category: "{selectedCategory.name}"
                  {selectedCategory.examplesCount > 0 && (
                    <div className="mt-1 text-destructive">
                      {selectedCategory.examplesCount} example
                      {selectedCategory.examplesCount !== 1 ? "s" : ""} will be
                      deleted
                    </div>
                  )}
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
              onClick={handleDeleteCategory}
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
