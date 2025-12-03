'use client';

export default function ConsumptionMetrics({ consumption }) {
  if (!consumption) return null;

  const formatCost = (cost) => {
    if (cost < 0.0001) return `$${(cost * 1000000).toFixed(2)} (microcents)`;
    if (cost < 0.01) return `$${cost.toFixed(6)}`;
    return `$${cost.toFixed(4)}`;
  };

  return (
    <div className="bg-card text-foreground rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-semibold mb-4">Consumption Metrics</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Tokens */}
        <div className="bg-blue-500/5 rounded-lg p-4">
          <h3 className="font-semibold mb-3 text-blue-500">Token Usage</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Input Tokens:</span>
              <span className="font-semibold">
                {consumption.tokens.input.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Output Tokens:</span>
              <span className="font-semibold">
                {consumption.tokens.output.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t border-blue-500/20">
              <span className="text-muted-foreground font-semibold">
                Total Tokens:
              </span>
              <span className="font-bold">
                {consumption.tokens.total.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Costs */}
        <div className="bg-green-500/5 rounded-lg p-4">
          <h3 className="font-semibold mb-3 text-green-500">Cost Breakdown</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Embeddings:</span>
              <span className="font-semibold">
                {formatCost(consumption.cost.embeddings)}
              </span>
            </div>
            {consumption.cost.gpt > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">GPT-4o-mini:</span>
                <span className="font-semibold">
                  {formatCost(consumption.cost.gpt)}
                </span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-green-500/20">
              <span className="text-muted-foreground font-semibold">
                Total Cost:
              </span>
              <span className="font-bold">
                {formatCost(consumption.cost.total)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

