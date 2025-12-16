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

// Skeleton component for loading category details
function CategoryCardSkeleton() {
  return (
    <div className="bg-card rounded-lg shadow-md p-6 animate-pulse">
      {/* Header skeleton */}
      <div className="mb-6">
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {/* Category name skeleton */}
              <div className="h-8 w-48 bg-muted rounded mb-2" />
              {/* Description skeleton */}
              <div className="h-4 w-96 bg-muted rounded mb-1" />
              <div className="h-4 w-64 bg-muted rounded mb-2" />
              {/* Meta info skeleton */}
              <div className="flex items-center gap-4 mt-2">
                <div className="h-4 w-24 bg-muted rounded" />
                <div className="h-4 w-32 bg-muted rounded" />
              </div>
            </div>
            {/* Action buttons skeleton */}
            <div className="flex gap-2">
              <div className="h-9 w-16 bg-muted rounded" />
              <div className="h-9 w-20 bg-muted rounded" />
            </div>
          </div>
        </div>
      </div>

      {/* Examples section skeleton */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <div className="h-6 w-24 bg-muted rounded" />
          <div className="flex gap-2">
            <div className="h-9 w-28 bg-muted rounded" />
            <div className="h-9 w-32 bg-muted rounded" />
            <div className="h-9 w-28 bg-muted rounded" />
          </div>
        </div>

        {/* Example items skeleton - show 5 placeholder examples */}
        <div className="space-y-2 mt-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="flex items-center gap-2 p-3 bg-muted/50 rounded-md border border-border"
            >
              <div
                className="h-5 bg-muted rounded flex-1"
                style={{ maxWidth: `${60 + i * 8}%` }}
              />
              <div className="flex gap-2 ml-4">
                <div className="h-7 w-14 bg-muted rounded" />
                <div className="h-7 w-16 bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CategoryManager() {
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [loading, setLoading] = useState(false); // Start false - lazy load
  const [loadingCategoryDetails, setLoadingCategoryDetails] = useState(false); // Loading state for category details
  const [recomputing, setRecomputing] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [recomputeConsumption, setRecomputeConsumption] = useState(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false); // Track if we've loaded once
  const { toast } = useToast();

  // Lazy load: Only fetch when component first mounts (when Manage tab is clicked)
  useEffect(() => {
    if (!hasLoaded) {
      fetchCategories();
      setHasLoaded(true);
    }
  }, [hasLoaded]);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/categories");
      if (!response.ok) throw new Error("Failed to fetch categories");
      const data = await response.json();
      setCategories(data);
      // Don't auto-select first category - wait for user to click
      // Only restore previously selected category if it still exists
      if (selectedCategoryId && data.find((c) => c.id === selectedCategoryId)) {
        // Category still exists, but don't auto-load details
        setSelectedCategory(null);
      } else {
        // Reset selection
        setSelectedCategoryId(null);
        setSelectedCategory(null);
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
    setLoadingCategoryDetails(true);
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
      setSelectedCategory(null);
    } finally {
      setLoadingCategoryDetails(false);
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
    setSelectedCategory(null); // Clear previous category immediately
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
      if (result.stats?.consumption) {
        setRecomputeConsumption(result.stats.consumption);
      }

      // Get accurate count from stats
      const computedCount = result.stats?.success || 0;
      const failedCount = result.stats?.failed || 0;
      
      let description = "Embeddings recomputed successfully! ";
      if (computedCount > 0) {
        description += `Computed ${computedCount} embedding${computedCount !== 1 ? 's' : ''}.`;
        if (failedCount > 0) {
          description += ` ${failedCount} failed.`;
        }
      } else {
        description += "No new embeddings to compute.";
      }

      toast({
        title: "Success",
        description,
        variant: "success",
      });

      // Refresh categories list to update completion percentages
      await fetchCategories();
      
      // Refresh selected category details if one is selected
      if (selectedCategoryId) {
        await fetchCategoryDetails(selectedCategoryId);
      }
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


  // Skeleton for loading categories list
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto animate-pulse">
        <div className="flex justify-between items-center mb-6">
          <div className="h-8 w-64 bg-muted rounded" />
          <div className="flex gap-3">
            <div className="h-10 w-32 bg-muted rounded" />
            <div className="h-10 w-40 bg-muted rounded" />
          </div>
        </div>

        {/* Category tabs skeleton */}
        <div className="flex flex-wrap gap-2 mb-6 border-b border-border pb-4">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div
              key={i}
              className="h-10 bg-muted rounded-md"
              style={{ width: `${80 + i * 15}px` }}
            />
          ))}
        </div>
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
            className={`px-4 py-2 rounded-md font-medium transition-colors flex items-center gap-2 ${selectedCategoryId === category.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground hover:bg-muted/80"
              }`}
          >
            <div className="flex items-center gap-2">
              <span>{category.name} ({category.examplesCount || 0})</span>

              {/* Status badge */}
              {category.completionPercentage !== undefined && (
                <span className={`px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${category.completionPercentage === 100
                    ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                    : category.completionPercentage === 0
                      ? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                      : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                  }`}>
                  {category.completionPercentage}%
                </span>
              )}
            </div>
          </button>
        ))}
        {categories.length === 0 && (
          <p className="text-muted-foreground">
            No categories yet. Create one to get started!
          </p>
        )}
      </div>

      {/* Selected Category Card */}
      {loadingCategoryDetails ? (
        <CategoryCardSkeleton />
      ) : selectedCategory ? (
        <CategoryCard
          category={selectedCategory}
          onUpdate={handleCategoryUpdate}
          onDelete={() => {
            setDeletingCategoryId(selectedCategory.id);
            setDeleteDialogOpen(true);
          }}
        />
      ) : null}

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
