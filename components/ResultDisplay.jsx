"use client";

export default function ResultDisplay({ result }) {
  if (result.error) {
    return (
      <div className="bg-destructive/10 border border-destructive rounded-lg p-4 text-destructive">
        <p>Error: {result.error}</p>
      </div>
    );
  }

  const getLabelColor = (label) => {
    const colors = {
      code: "bg-primary/10 text-primary",
      low_effort: "bg-muted text-muted-foreground",
      reasoning: "bg-secondary text-secondary-foreground",
      image_generation: "bg-accent text-accent-foreground",
      image_edit: "bg-accent/10 text-accent-foreground",
      web_surfing: "bg-secondary/10 text-secondary-foreground",
      ppt_generation: "bg-primary/10 text-primary",
    };
    return colors[label] || "bg-muted text-muted-foreground";
  };

  const getSourceBadge = (source) => {
    if (source === "gpt_fallback" || source === "fallback") {
      return (
        <span className="px-2 py-1 text-xs rounded bg-secondary text-secondary-foreground">
          GPT Fallback
        </span>
      );
    }
    return (
      <span className="px-2 py-1 text-xs rounded bg-muted text-muted-foreground">
        Local
      </span>
    );
  };

  const formatCost = (cost) => {
    if (!cost || cost === 0) return "$0.000000";
    if (cost < 0.01) return `$${cost.toFixed(6)}`;
    return `$${cost.toFixed(4)}`;
  };

  // Handle multiple results
  if (result.results && Array.isArray(result.results)) {
    return (
      <div className="bg-card text-foreground rounded-lg shadow-md p-6">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-2xl font-semibold">Classification Results</h2>
          <span className="text-xs text-muted-foreground">
            {result.results.length} prompt
            {result.results.length !== 1 ? "s" : ""} classified
          </span>
        </div>
        <div className="space-y-4">
          {result.results.map((r, index) => (
            <div
              key={index}
              className="border border-border rounded-xl p-4 space-y-3 bg-background"
            >
              {/* Header: label + source + score */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${getLabelColor(
                        r.label
                      )}`}
                    >
                      {r.label}
                    </span>
                    {getSourceBadge(r.source)}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Prompt {index + 1}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Score
                  </div>
                  <div className="font-mono text-sm text-foreground">
                    {r.score.toFixed(3)}
                  </div>
                  <div className="mt-1 w-28 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${(r.score * 100).toFixed(1)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Prompt text */}
              <div>
                {/* <div className="text-[11px] font-medium text-muted-foreground mb-1">
                  Prompt
                </div> */}
                <p className="text-sm bg-muted text-foreground p-2 rounded-md border border-border/40">
                  {r.prompt}
                </p>
              </div>

              {/* Per-prompt consumption */}
              {r.consumption && (
                <div className="pt-2 border-t border-border/50 text-[11px] text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                  <span>
                    Tokens: {r.consumption.tokens?.total?.toLocaleString() ?? 0}
                  </span>
                  <span>
                    Cost: {formatCost(r.consumption.cost?.total ?? 0)}
                  </span>
                  {r.consumption.cost?.gpt > 0 && (
                    <span>GPT: {formatCost(r.consumption.cost.gpt)}</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Handle single result
  return (
    <div className="bg-card text-foreground rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-semibold mb-4">Classification Result</h2>

      <div className="space-y-4">
        {/* Prompt */}
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">
            Prompt:
          </label>
          <p className="bg-muted text-foreground p-3 rounded border border-border">
            {result.prompt}
          </p>
        </div>

        {/* Label */}
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">
            Label:
          </label>
          <div className="flex items-center">
            <span
              className={`px-4 py-2 rounded-md font-semibold ${getLabelColor(
                result.label
              )}`}
            >
              {result.label}
            </span>
            {getSourceBadge(result.source)}
          </div>
        </div>

        {/* Score */}
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">
            Score:
          </label>
          <div className="flex items-center space-x-2">
            <div className="flex-1 bg-muted rounded-full h-4">
              <div
                className="bg-primary h-4 rounded-full transition-all"
                style={{ width: `${(result.score * 100).toFixed(1)}%` }}
              />
            </div>
            <span className="text-sm font-semibold text-foreground">
              {result.score.toFixed(3)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
