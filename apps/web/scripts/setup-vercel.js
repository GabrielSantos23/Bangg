import { mkdir, copyFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const distDir = join(process.cwd(), 'dist');
const apiDir = join(distDir, 'api');
const serverFile = join(distDir, 'server', 'server.js');
const apiServerFile = join(apiDir, 'server.js');

async function setupVercel() {
  try {
    // Create api directory if it doesn't exist
    if (!existsSync(apiDir)) {
      await mkdir(apiDir, { recursive: true });
    }

    // Copy server.js to api directory so Vercel recognizes it as a serverless function
    if (existsSync(serverFile)) {
      await copyFile(serverFile, apiServerFile);
      console.log('✅ Copied server.js to api directory for Vercel');
    } else {
      console.error('❌ server.js not found at:', serverFile);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error setting up Vercel structure:', error);
    process.exit(1);
  }
}

setupVercel();

