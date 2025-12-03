"use client";

import { useState } from "react";
import ExampleList from "./ExampleList";

export default function LabelCard({ label, onUpdate }) {
  if (!label) return null;

  return (
    <div className="bg-background rounded-lg shadow-md p-6">
      <div className="mb-4">
        <h3 className="text-2xl font-semibold text-foreground capitalize">
          {label.name}
        </h3>
        <p className="text-muted-foreground mt-1">{label.description}</p>
        <p className="text-sm text-muted-foreground mt-2">
          {label.examples?.length || 0} example
          {label.examples?.length !== 1 ? "s" : ""}
        </p>
      </div>

      <ExampleList label={label} onUpdate={onUpdate} />
    </div>
  );
}
