import { hydrateRoot } from "react-dom/client";
import { StartClient } from "@tanstack/start";
import { createRouter } from "./router";

// StartClient gerencia o router internamente
hydrateRoot(document.getElementById("root")!, <StartClient />);
