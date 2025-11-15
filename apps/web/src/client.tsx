import { StartClient } from "@tanstack/react-start/client";
import { StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import "katex/dist/katex.min.css";

hydrateRoot(
  document,
  <StrictMode>
    <StartClient />
  </StrictMode>
);
