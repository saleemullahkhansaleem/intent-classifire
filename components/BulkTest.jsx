"use client";

import { useState } from "react";
import ResultDisplay from "./ResultDisplay";
import ConsumptionMetrics from "./ConsumptionMetrics";
import { useToast } from "./ui/use-toast";

// Skeleton component for bulk test results - matches ResultDisplay layout
function BulkTestSkeleton({ count }) {
  return (
    <div className="bg-card text-foreground rounded-lg shadow-md p-6">
      <div className="flex items-baseline justify-between mb-4">
        <div className="h-7 w-48 bg-muted rounded animate-pulse" />
        <div className="h-4 w-20 bg-muted rounded animate-pulse" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: Math.min(count || 5, 10) }).map((_, index) => (
          <div
            key={index}
            className="border border-border rounded-xl p-4 space-y-3 bg-background animate-pulse"
          >
            {/* Header with label and score */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-6 w-24 bg-muted rounded-full" />
                  <div className="h-5 w-16 bg-muted rounded-full" />
                </div>
                <div className="h-3 w-16 bg-muted rounded" />
              </div>
              <div className="text-right">
                <div className="h-3 w-12 bg-muted rounded mb-1" />
                <div className="h-5 w-16 bg-muted rounded mb-1" />
                <div className="w-28 h-1.5 bg-muted rounded-full" />
              </div>
            </div>
            {/* Prompt text skeleton */}
            <div>
              <div className="h-10 w-full bg-muted rounded-md" />
            </div>
            {/* Consumption skeleton */}
            <div className="pt-2 border-t border-border/50">
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <div className="h-3 w-20 bg-muted rounded" />
                <div className="h-3 w-16 bg-muted rounded" />
                <div className="h-3 w-14 bg-muted rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BulkTest() {
  const [promptText, setPromptText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Split by newlines and filter empty lines
    const prompts = promptText
      .split("\n")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    if (prompts.length === 0) {
      toast({
        title: "Error",
        description: "Please enter at least one prompt",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/classify/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompts }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.details || errorData.error || "Bulk classification failed"
        );
      }

      const data = await response.json();
      setResult({
        results: data.results,
        consumption: data.consumption,
      });

      toast({
        title: "Success",
        description: `Classified ${data.processedPrompts} prompts successfully`,
        variant: "success",
      });
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: error.message || "Bulk classification failed",
        variant: "destructive",
      });
      setResult({ error: error.message || "Unknown error" });
    } finally {
      setLoading(false);
    }
  };

  const promptCount = promptText
    .split("\n")
    .map((p) => p.trim())
    .filter((p) => p.length > 0).length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-card text-foreground rounded-lg shadow-md p-6">
        <div className="mb-4">
          <h2 className="text-2xl font-semibold mb-2">
            Bulk Test Classification
          </h2>
          <p className="text-sm text-muted-foreground">
            Paste multiple prompts (one per line) to classify them all at once.
            Each line will be treated as a separate prompt.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="bulk-prompts"
              className="block text-sm font-medium text-foreground mb-2"
            >
              Prompts (one per line)
            </label>
            <textarea
              id="bulk-prompts"
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="Enter prompts here, one per line...&#10;&#10;Example:&#10;write a Python function to parse JSON&#10;what is the capital of France&#10;create a React component for login"
              className="w-full min-h-[300px] p-4 border border-border rounded-md bg-background text-foreground resize-y font-mono text-sm"
              disabled={loading}
            />
            <div className="mt-2 text-xs text-muted-foreground">
              {promptCount === 0
                ? "No prompts entered"
                : `${promptCount} prompt${
                    promptCount !== 1 ? "s" : ""
                  } detected`}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setPromptText("");
                setResult(null);
              }}
              disabled={loading}
              className="px-4 py-2 bg-muted text-foreground rounded-md hover:bg-muted/80 disabled:opacity-50 transition-colors"
            >
              Clear
            </button>
            <button
              type="submit"
              disabled={loading || promptCount === 0}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed transition-colors"
            >
              {loading
                ? `Classifying ${promptCount} prompt${
                    promptCount !== 1 ? "s" : ""
                  }...`
                : `Classify ${promptCount > 0 ? `${promptCount} ` : ""}Prompt${
                    promptCount !== 1 ? "s" : ""
                  }`}
            </button>
          </div>
        </form>
      </div>

      {loading && <BulkTestSkeleton count={promptCount} />}

      {result && !loading && (
        <div className="space-y-6">
          <ResultDisplay result={result} />
          {result.consumption && (
            <>
              <ConsumptionMetrics consumption={result.consumption} />
              <div className="bg-muted border border-border rounded-lg p-3 text-sm text-muted-foreground">
                Processed {result.results?.length || 0} prompt
                {result.results?.length !== 1 ? "s" : ""}. Consumption metrics
                above reflect the total across all prompts.
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
