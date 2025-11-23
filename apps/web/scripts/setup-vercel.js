import { mkdir, copyFile, cp, writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const distDir = join(process.cwd(), 'dist');
const apiDir = join(distDir, 'api');
const serverDir = join(distDir, 'server');
const serverFile = join(serverDir, 'server.js');

async function setupVercel() {
  try {
    // Create api directory if it doesn't exist
    if (!existsSync(apiDir)) {
      await mkdir(apiDir, { recursive: true });
    }

    // Copy server assets to api directory so imports work
    const serverAssetsDir = join(serverDir, 'assets');
    const apiAssetsDir = join(apiDir, 'assets');
    if (existsSync(serverAssetsDir)) {
      await cp(serverAssetsDir, apiAssetsDir, { recursive: true });
      console.log('✅ Copied server assets to api directory');
    }

    // Create a catch-all route that imports the server function
    // This makes Vercel recognize it as a serverless function
    const catchAllRoute = join(apiDir, '[...path].js');
    const catchAllContent = `// Catch-all route for TanStack Start
// This file makes Vercel recognize the serverless function
export { default } from '../server/server.js';
`;

    await writeFile(catchAllRoute, catchAllContent);
    console.log('✅ Created catch-all API route for Vercel');
  } catch (error) {
    console.error('❌ Error setting up Vercel structure:', error);
    process.exit(1);
  }
}

setupVercel();

