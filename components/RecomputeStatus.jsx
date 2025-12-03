'use client';

export default function RecomputeStatus() {
  return (
    <div className="mb-6 bg-secondary/10 border border-border rounded-lg p-4">
      <div className="flex items-center space-x-3">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
        <div>
          <p className="font-semibold text-foreground">
            Recomputing Embeddings
          </p>
          <p className="text-sm text-muted-foreground">
            This may take a few minutes. Please wait...
          </p>
        </div>
      </div>
    </div>
  );
}

