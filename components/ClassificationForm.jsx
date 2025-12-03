"use client";

import { useState, useRef, useEffect } from "react";

export default function ClassificationForm({
  onResult,
  loading,
  setLoading,
  onPromptCountChange,
}) {
  const [prompts, setPrompts] = useState([""]);
  const textareaRefs = useRef({});

  const handleChangePrompt = (index, value) => {
    setPrompts((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });

    // Auto-resize textarea
    const textarea = textareaRefs.current[index];
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  };

  // Auto-resize on mount and when prompts array changes
  useEffect(() => {
    prompts.forEach((_, index) => {
      const textarea = textareaRefs.current[index];
      if (textarea) {
        textarea.style.height = "auto";
        textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
      }
    });
  }, [prompts.length]);

  const handleAddPrompt = () => {
    setPrompts((prev) => [...prev, ""]);
  };

  const handleRemovePrompt = (index) => {
    setPrompts((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

  const trimmedPrompts = prompts.map((p) => p.trim());
  const validPrompts = trimmedPrompts.filter((p) => p.length > 0);
  const promptCount = validPrompts.length;
  const hasValidInput = promptCount > 0;

  // Notify parent of prompt count changes
  useEffect(() => {
    if (onPromptCountChange) {
      onPromptCountChange(promptCount);
    }
  }, [promptCount, onPromptCountChange]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!promptCount) return;

    setLoading(true);
    try {
      const response = await fetch("/api/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompts: validPrompts }),
      });

      if (!response.ok) {
        throw new Error("Classification failed");
      }

      const data = await response.json();
      onResult(data);
    } catch (error) {
      console.error("Error:", error);
      onResult({ error: error.message || "Unknown error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card text-foreground rounded-lg shadow-md p-4 md:p-6">
      <div className="flex flex-col gap-2 mb-3">
        <h2 className="text-lg md:text-xl font-semibold">
          Classify multiple prompts
        </h2>
        <p className="text-xs md:text-sm text-muted-foreground">
          Each field below is treated as a separate prompt in a single request.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-2">
          {prompts.map((p, index) => (
            <div
              key={index}
              className="rounded-3xl border border-input bg-background px-2 py-1.5 flex items-center gap-2 shadow-sm"
            >
              <div className="h-6 w-6 flex items-center justify-center rounded-full bg-muted text-[11px] text-muted-foreground font-medium shrink-0">
                {index + 1}
              </div>
              <textarea
                ref={(el) => (textareaRefs.current[index] = el)}
                value={p}
                onChange={(e) => handleChangePrompt(index, e.target.value)}
                placeholder={`Prompt ${index + 1}...`}
                className="w-full bg-transparent text-sm md:text-base resize-none outline-none focus:ring-0 placeholder:text-muted-foreground/70 min-h-[24px] max-h-[200px] overflow-y-auto"
                rows={1}
                disabled={loading}
                onInput={(e) => {
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(
                    e.target.scrollHeight,
                    200
                  )}px`;
                }}
              />
              {prompts.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemovePrompt(index)}
                  disabled={loading}
                  className="text-xs text-muted-foreground hover:text-destructive px-2 py-1"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {promptCount === 0
              ? "No prompts yet"
              : `${promptCount} prompt${promptCount !== 1 ? "s" : ""} ready`}
          </span>
          <button
            type="button"
            onClick={handleAddPrompt}
            disabled={loading}
            className="inline-flex items-center justify-center px-3 py-1 rounded-full border border-input bg-muted/60 text-foreground text-[11px] font-medium hover:bg-muted disabled:opacity-50 transition-colors"
          >
            + Add prompt
          </button>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading || !hasValidInput}
            className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed transition-colors"
          >
            {loading
              ? "Classifying..."
              : `Classify${promptCount ? ` (${promptCount})` : ""}`}
          </button>
        </div>
      </form>
    </div>
  );
}
