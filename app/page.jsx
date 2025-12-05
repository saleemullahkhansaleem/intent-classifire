"use client";

import { useState } from "react";
import Image from "next/image";
import ClassificationForm from "../components/ClassificationForm";
import ResultDisplay from "../components/ResultDisplay";
import ConsumptionMetrics from "../components/ConsumptionMetrics";
import CategoryManager from "../components/CategoryManager";
import BulkTest from "../components/BulkTest";
import { ThemeToggle } from "../components/ui/theme-toggle";

// Skeleton component for loading state
function ResultSkeleton({ count }) {
  return (
    <div className="bg-card text-foreground rounded-lg shadow-md p-6">
      <div className="flex items-baseline justify-between mb-4">
        <div className="h-7 w-48 bg-muted rounded animate-pulse" />
        <div className="h-4 w-20 bg-muted rounded animate-pulse" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: count }).map((_, index) => (
          <div
            key={index}
            className="border border-border rounded-lg p-4 space-y-3 bg-background"
          >
            {/* Header with label and score */}
            <div className="flex items-center justify-between">
              <div className="h-4 w-16 bg-muted rounded animate-pulse" />
              <div className="flex items-center gap-2">
                <div className="h-6 w-20 bg-muted rounded animate-pulse" />
                <div className="h-5 w-16 bg-muted rounded animate-pulse" />
              </div>
            </div>
            {/* Prompt text skeleton */}
            <div>
              <div className="h-3 w-12 bg-muted rounded mb-2 animate-pulse" />
              <div className="h-12 w-full bg-muted rounded-md animate-pulse" />
            </div>
            {/* Score bar skeleton */}
            <div className="flex items-center justify-between">
              <div className="flex-1 space-y-2">
                <div className="h-3 w-12 bg-muted rounded animate-pulse" />
                <div className="flex items-center space-x-2">
                  <div className="flex-1 h-2 bg-muted rounded-full animate-pulse" />
                  <div className="h-3 w-12 bg-muted rounded animate-pulse" />
                </div>
              </div>
            </div>
            {/* Consumption skeleton */}
            <div className="pt-2 border-t border-border/50">
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <div className="h-3 w-20 bg-muted rounded animate-pulse" />
                <div className="h-3 w-16 bg-muted rounded animate-pulse" />
                <div className="h-3 w-14 bg-muted rounded animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState("classify");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [promptCount, setPromptCount] = useState(0);

  const aggregateConsumption = (res) => {
    if (!res?.results || !Array.isArray(res.results)) return null;
    const agg = {
      tokens: { input: 0, output: 0, total: 0 },
      cost: { embeddings: 0, gpt: 0, total: 0 },
    };
    for (const r of res.results) {
      const c = r.consumption;
      if (!c) continue;
      agg.tokens.input += c.tokens?.input ?? 0;
      agg.tokens.output += c.tokens?.output ?? 0;
      agg.tokens.total += c.tokens?.total ?? 0;
      agg.cost.embeddings += c.cost?.embeddings ?? 0;
      agg.cost.gpt += c.cost?.gpt ?? 0;
      agg.cost.total += c.cost?.total ?? 0;
    }
    return agg;
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="container max-w-7xl mx-auto p-4">
        {/* Top bar: logo left, tabs center, theme toggle right */}
        <header className="mb-8 border-b pb-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            {/* Logo + Title (left) */}
            <div className="flex items-center gap-2 text-foreground">
              <div className="relative h-14 w-14 flex items-center justify-center">
                {!logoError ? (
                  <Image
                    src="/logo.png"
                    alt="Palvoro AI Logo"
                    width={56}
                    height={56}
                    className="object-contain"
                    priority
                    onError={() => setLogoError(true)}
                  />
                ) : (
                  <div className="h-14 w-14 rounded-full bg-gradient-to-r from-primary to-secondary flex items-center justify-center shadow-lg">
                    <span className="text-white font-bold text-2xl">P</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col justify-center">
                <h1 className="text-2xl md:text-3xl font-semibold leading-none">
                  Palvoro
                </h1>
                <p className="text-xs font-normal text-muted-foreground uppercase tracking-tight">
                  Intent Classifire
                </p>
              </div>
            </div>

            {/* Tabs + Theme toggle (right) */}
            <div className="flex items-center justify-center md:justify-end gap-4">
              <nav className="flex rounded-full bg-muted border border-border overflow-hidden">
                <button
                  onClick={() => setActiveTab("classify")}
                  className={`px-5 py-2 text-sm font-medium transition-colors ${
                    activeTab === "classify"
                      ? "bg-background text-primary shadow-sm"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  Classification
                </button>
                <button
                  onClick={() => setActiveTab("bulk")}
                  className={`px-5 py-2 text-sm font-medium transition-colors ${
                    activeTab === "bulk"
                      ? "bg-background text-primary shadow-sm"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  Bulk Test
                </button>
                <button
                  onClick={() => setActiveTab("categories")}
                  className={`px-5 py-2 text-sm font-medium transition-colors ${
                    activeTab === "categories"
                      ? "bg-background text-primary shadow-sm"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  Manage
                </button>
              </nav>
            </div>
            <ThemeToggle />
          </div>
        </header>

        {/* Content */}
        {activeTab === "classify" ? (
          <div className="max-w-4xl mx-auto">
            <ClassificationForm
              onResult={setResult}
              loading={loading}
              setLoading={setLoading}
              onPromptCountChange={setPromptCount}
            />
            {loading && promptCount > 0 && (
              <div className="mt-8 space-y-6">
                <ResultSkeleton count={promptCount} />
              </div>
            )}
            {result && !loading && (
              <div className="mt-8 space-y-6">
                <ResultDisplay result={result} />
                {/* Aggregate consumption across all prompts */}
                {result.results &&
                  Array.isArray(result.results) &&
                  result.results.length > 0 && (
                    <>
                      <ConsumptionMetrics
                        consumption={aggregateConsumption(result)}
                      />
                      <div className="bg-muted border border-border rounded-lg p-3 text-sm text-muted-foreground">
                        Processed {result.results.length} prompt
                        {result.results.length !== 1 ? "s" : ""}. Consumption
                        metrics above reflect the total across all prompts.
                      </div>
                    </>
                  )}
              </div>
            )}
          </div>
        ) : activeTab === "bulk" ? (
          <BulkTest />
        ) : (
          <CategoryManager />
        )}
      </div>
    </div>
  );
}
