"use client";

import { useState, useEffect } from "react";
import LabelCard from "./LabelCard";
import RecomputeStatus from "./RecomputeStatus";
import { useToast } from "./ui/use-toast";

export default function ExampleManager() {
  const [labels, setLabels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recomputing, setRecomputing] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchLabels();
  }, []);

  const fetchLabels = async () => {
    try {
      const response = await fetch("/api/labels");
      if (!response.ok) throw new Error("Failed to fetch labels");
      const data = await response.json();
      setLabels(data);
      // Keep the same selected label if it still exists, otherwise select first
      if (!selectedLabel || !data.find((l) => l.name === selectedLabel)) {
        setSelectedLabel(data[0]?.name || null);
      }
    } catch (error) {
      console.error("Error fetching labels:", error);
      toast({
        title: "Error",
        description: "Failed to fetch labels",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLabelUpdate = async () => {
    await fetchLabels();
  };

  const handleRecompute = async () => {
    setRecomputing(true);
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
      toast({
        title: "Success",
        description: `Embeddings recomputed successfully! Processed ${result.labelsProcessed} labels with ${result.totalExamples} examples.`,
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
        <div className="text-muted-foreground">Loading labels...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-foreground">
          Manage Training Examples
        </h2>
        <button
          onClick={handleRecompute}
          disabled={recomputing}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed transition-colors"
        >
          {recomputing ? "Recomputing..." : "Recompute Embeddings"}
        </button>
      </div>

      {recomputing && <RecomputeStatus />}

      {/* Label Tabs */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-border pb-4">
        {labels.map((label) => (
          <button
            key={label.name}
            onClick={() => setSelectedLabel(label.name)}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              selectedLabel === label.name
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground hover:bg-muted/80"
            }`}
          >
            {label.name} ({label.examples?.length || 0})
          </button>
        ))}
      </div>

      {/* Selected Label Card */}
      {selectedLabel && (
        <LabelCard
          label={labels.find((l) => l.name === selectedLabel)}
          onUpdate={handleLabelUpdate}
        />
      )}
    </div>
  );
}
