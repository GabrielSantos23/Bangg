import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

interface Result {
  text: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function useGeminiSearch() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<string | null>(null);

  const search = useCallback(async (query: string) => {
    setLoading(true);
    setError(null);

    try {
      const res = await invoke<Result>("gemini_search", {
        payload: { query },
      });

      setData(res.text);
    } catch (err: any) {
      setError(err.toString());
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, data, search };
}
