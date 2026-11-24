"use client";

import { Toaster as Sonner } from "sonner";

function Toaster() {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      toastOptions={{
        style: {
          background: "#161d28",
          border: "1px solid rgba(255,255,255,0.08)",
          color: "#e7ecf3",
        },
      }}
    />
  );
}

export { Toaster };
