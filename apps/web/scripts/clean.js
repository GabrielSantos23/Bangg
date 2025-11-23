import { rmSync } from 'fs';
import { join } from 'path';

const dirsToClean = [
  'dist',
  '.tanstack',
  join('node_modules', '.vite'),
];

console.log('🧹 Limpando diretórios de build...');

dirsToClean.forEach((dir) => {
  try {
    rmSync(dir, { recursive: true, force: true });
    console.log(`✅ Removido: ${dir}`);
  } catch (error) {
    // Ignora erros se o diretório não existir
    if (error.code !== 'ENOENT') {
      console.warn(`⚠️  Aviso ao remover ${dir}:`, error.message);
    }
  }
});

console.log('✨ Limpeza concluída!');









