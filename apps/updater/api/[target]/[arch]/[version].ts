import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Tauri Updater API Endpoint
 *
 * Este endpoint retorna informações sobre atualizações disponíveis
 * no formato esperado pelo plugin updater do Tauri v2.
 *
 * URL Pattern: /{target}/{arch}/{current_version}
 *
 * Exemplo: /windows-x86_64/0.1.0
 *
 * O Tauri substitui automaticamente:
 * - {{target}} -> windows-x86_64, darwin-x86_64, darwin-aarch64, linux-x86_64
 * - {{arch}} -> x86_64, aarch64
 * - {{current_version}} -> versão atual do app
 */

interface UpdateManifest {
  version: string;
  notes?: string;
  pub_date?: string;
  platforms: {
    [key: string]: {
      signature: string;
      url: string;
    };
  };
}

// Configuração das atualizações disponíveis
// TODO: Mover para um banco de dados ou arquivo de configuração
const UPDATES: Record<string, UpdateManifest> = {
  // Windows x86_64
  "windows-x86_64": {
    version: "0.1.1",
    notes: "Correções de bugs e melhorias de performance",
    pub_date: new Date().toISOString(),
    platforms: {
      "windows-x86_64": {
        signature: "", // Assinatura do arquivo (gerada pelo Tauri)
        url: "https://github.com/your-org/your-repo/releases/download/v0.1.1/your-app_0.1.1_x64-setup.exe",
      },
    },
  },
  // macOS Intel
  "darwin-x86_64": {
    version: "0.1.1",
    notes: "Correções de bugs e melhorias de performance",
    pub_date: new Date().toISOString(),
    platforms: {
      "darwin-x86_64": {
        signature: "",
        url: "https://github.com/your-org/your-repo/releases/download/v0.1.1/your-app_0.1.1_x64.app.tar.gz",
      },
    },
  },
  // macOS Apple Silicon
  "darwin-aarch64": {
    version: "0.1.1",
    notes: "Correções de bugs e melhorias de performance",
    pub_date: new Date().toISOString(),
    platforms: {
      "darwin-aarch64": {
        signature: "",
        url: "https://github.com/your-org/your-repo/releases/download/v0.1.1/your-app_0.1.1_aarch64.app.tar.gz",
      },
    },
  },
  // Linux x86_64
  "linux-x86_64": {
    version: "0.1.1",
    notes: "Correções de bugs e melhorias de performance",
    pub_date: new Date().toISOString(),
    platforms: {
      "linux-x86_64": {
        signature: "",
        url: "https://github.com/your-org/your-repo/releases/download/v0.1.1/your-app_0.1.1_amd64.AppImage.tar.gz",
      },
    },
  },
};

/**
 * Compara duas versões no formato semver
 * Retorna: 1 se v1 > v2, -1 se v1 < v2, 0 se v1 === v2
 */
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split(".").map(Number);
  const parts2 = v2.split(".").map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;

    if (part1 > part2) return 1;
    if (part1 < part2) return -1;
  }

  return 0;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Suporte para CORS preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { target, arch, version: currentVersion } = req.query;

    if (!target || !arch || !currentVersion) {
      return res.status(400).json({
        error:
          "Missing required parameters: target, arch, and version are required",
      });
    }

    // Normaliza o target para o formato esperado
    const targetKey = `${target}-${arch}` as keyof typeof UPDATES;

    // Verifica se há uma atualização disponível para esta plataforma
    const update = UPDATES[targetKey];

    if (!update) {
      // Não há atualização disponível para esta plataforma
      return res.status(204).end();
    }

    // Compara versões
    const hasUpdate =
      compareVersions(update.version, currentVersion as string) > 0;

    if (!hasUpdate) {
      // A versão atual já é a mais recente
      return res.status(204).end();
    }

    // Retorna a atualização disponível
    return res.status(200).json(update);
  } catch (error) {
    console.error("Error in updater endpoint:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
