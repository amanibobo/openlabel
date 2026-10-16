"use client";

import { useState } from "react";

export function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <span className="cmd">
      <code>
        <span className="p">❯</span>
        {command}
      </code>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(command);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </span>
  );
}
