/**
 * EXEMPLO: Integração com GitHub Releases
 * 
 * Este é um exemplo de como você pode integrar o updater
 * com GitHub Releases para buscar versões automaticamente.
 * 
 * Para usar, substitua o conteúdo de [version].ts por este exemplo
 * e configure as variáveis de ambiente necessárias.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  assets: Array<{
    name: string;
    browser_download_url: string;
    size: number;
  }>;
}

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

// Mapeamento de targets do Tauri para padrões de nomes de arquivos
const ASSET_PATTERNS: Record<string, RegExp> = {
  'windows-x86_64': /.*_x64.*\.(exe|msi)$/i,
  'darwin-x86_64': /.*_x64.*\.(app\.tar\.gz|dmg)$/i,
  'darwin-aarch64': /.*_aarch64.*\.(app\.tar\.gz|dmg)$/i,
  'linux-x86_64': /.*_(amd64|x86_64).*\.(AppImage|deb|rpm|tar\.gz)$/i,
};

function compareVersions(v1: string, v2: string): number {
  // Remove 'v' prefix se existir
  const clean1 = v1.replace(/^v/, '');
  const clean2 = v2.replace(/^v/, '');
  
  const parts1 = clean1.split('.').map(Number);
  const parts2 = clean2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;
    
    if (part1 > part2) return 1;
    if (part1 < part2) return -1;
  }
  
  return 0;
}

async function getLatestRelease(
  owner: string,
  repo: string,
  token?: string
): Promise<GitHubRelease | null> {
  const headers: HeadersInit = {
    Accept: 'application/vnd.github.v3+json',
  };

  if (token) {
    headers.Authorization = `token ${token}`;
  }

  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/releases/latest`,
      { headers }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null; // Nenhum release encontrado
      }
      throw new Error(`GitHub API error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching GitHub release:', error);
    return null;
  }
}

function findAssetForTarget(
  release: GitHubRelease,
  target: string
): GitHubRelease['assets'][0] | null {
  const pattern = ASSET_PATTERNS[target];
  if (!pattern) return null;

  return release.assets.find((asset) => pattern.test(asset.name)) || null;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { target, arch, version: currentVersion } = req.query;

    if (!target || !arch || !currentVersion) {
      return res.status(400).json({
        error: 'Missing required parameters',
      });
    }

    const targetKey = `${target}-${arch}` as string;

    // Configuração do GitHub (use variáveis de ambiente)
    const GITHUB_OWNER = process.env.GITHUB_OWNER || 'your-org';
    const GITHUB_REPO = process.env.GITHUB_REPO || 'your-repo';
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // Opcional, para rate limit

    // Busca o último release
    const release = await getLatestRelease(
      GITHUB_OWNER,
      GITHUB_REPO,
      GITHUB_TOKEN
    );

    if (!release) {
      return res.status(204).end();
    }

    // Compara versões
    const releaseVersion = release.tag_name.replace(/^v/, '');
    const hasUpdate = compareVersions(releaseVersion, currentVersion as string) > 0;

    if (!hasUpdate) {
      return res.status(204).end();
    }

    // Encontra o asset para esta plataforma
    const asset = findAssetForTarget(release, targetKey);

    if (!asset) {
      return res.status(204).end(); // Sem asset para esta plataforma
    }

    // TODO: Buscar assinatura do asset
    // Você pode armazenar assinaturas em:
    // 1. Um arquivo .sig junto com o asset
    // 2. Um banco de dados
    // 3. Um arquivo de manifesto separado
    const signature = ''; // Implementar busca de assinatura

    const update: UpdateManifest = {
      version: releaseVersion,
      notes: release.body || release.name,
      pub_date: release.published_at,
      platforms: {
        [targetKey]: {
          signature,
          url: asset.browser_download_url,
        },
      },
    };

    return res.status(200).json(update);
  } catch (error) {
    console.error('Error in updater endpoint:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

