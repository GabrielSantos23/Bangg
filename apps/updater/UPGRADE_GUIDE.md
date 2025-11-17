# Guia de Upgrade do Tauri Updater

Este guia explica como usar corretamente o updater do Tauri v2 e como configurar o serviço de atualização.

## 📦 Configuração Básica

### 1. Plugin no Tauri

O plugin updater já está configurado no `lib.rs`:

```rust
.plugin(tauri_plugin_updater::Builder::new().build())
```

### 2. Configuração no tauri.conf.json

```json
{
  "plugins": {
    "updater": {
      "active": true,
      "endpoints": [
        "https://updater.bangg.xyz/{{target}}/{{arch}}/{{current_version}}"
      ],
      "dialog": true,
      "pubkey": "sua-chave-publica-aqui"
    }
  }
}
```

**Variáveis disponíveis:**
- `{{target}}`: windows, darwin, linux
- `{{arch}}`: x86_64, aarch64
- `{{current_version}}`: versão atual do app (ex: 0.1.0)

### 3. Chave Pública (pubkey)

A chave pública é usada para verificar a assinatura dos arquivos de atualização.

**Para gerar as chaves:**

```bash
# Gerar par de chaves
tauri signer generate -w ~/.tauri/myapp.key

# A chave pública será exibida no terminal
# Copie e cole no campo "pubkey" do tauri.conf.json
```

**Importante:** Mantenha a chave privada segura! Ela é usada para assinar os arquivos durante o build.

## 🔐 Assinatura de Arquivos

### Durante o Build

Após buildar o app, você precisa assinar os arquivos:

```bash
# Windows
tauri signer sign target/release/bundle/nsis/your-app_0.1.1_x64-setup.exe \
  -w ~/.tauri/myapp.key

# macOS
tauri signer sign target/release/bundle/macos/your-app.app.tar.gz \
  -w ~/.tauri/myapp.key

# Linux
tauri signer sign target/release/bundle/appimage/your-app_0.1.1_amd64.AppImage.tar.gz \
  -w ~/.tauri/myapp.key
```

### Automatizar no CI/CD

Você pode automatizar a assinatura no seu pipeline:

```yaml
# Exemplo GitHub Actions
- name: Sign Windows installer
  run: |
    tauri signer sign target/release/bundle/nsis/*.exe \
      -w ${{ secrets.TAURI_SIGNING_KEY }}

- name: Sign macOS bundle
  run: |
    tauri signer sign target/release/bundle/macos/*.app.tar.gz \
      -w ${{ secrets.TAURI_SIGNING_KEY }}
```

## 📝 Atualizando o Endpoint

### Opção 1: Hardcoded (Desenvolvimento)

Edite `apps/updater/api/[target]/[arch]/[version].ts` e atualize o objeto `UPDATES`:

```typescript
const UPDATES: Record<string, UpdateManifest> = {
  'windows-x86_64': {
    version: '0.1.2', // Nova versão
    notes: 'Novas funcionalidades',
    pub_date: new Date().toISOString(),
    platforms: {
      'windows-x86_64': {
        signature: 'nova-assinatura',
        url: 'https://github.com/.../app_0.1.2_x64-setup.exe'
      }
    }
  }
};
```

### Opção 2: GitHub Releases (Produção)

Use o exemplo em `[version].example.ts` que integra automaticamente com GitHub Releases.

**Configurar variáveis de ambiente no Vercel:**

- `GITHUB_OWNER`: seu-username-ou-org
- `GITHUB_REPO`: nome-do-repositorio
- `GITHUB_TOKEN`: token do GitHub (opcional, para rate limit)

## 🚀 Deploy no Vercel

### Passo a Passo

1. **Conectar repositório:**
   - Vá para [vercel.com](https://vercel.com)
   - Importe o repositório
   - Configure o projeto:
     - **Root Directory**: `apps/updater`
     - **Framework Preset**: Other
     - **Build Command**: (deixe vazio)
     - **Output Directory**: (deixe vazio)

2. **Configurar domínio:**
   - Vá em Settings > Domains
   - Adicione `updater.bangg.xyz` (ou seu domínio)
   - Configure DNS conforme instruções

3. **Variáveis de ambiente (se necessário):**
   - Settings > Environment Variables
   - Adicione `GITHUB_OWNER`, `GITHUB_REPO`, etc.

### Testar o Deploy

```bash
# Teste local
cd apps/updater
vercel dev

# Teste o endpoint
curl http://localhost:3000/api/windows-x86_64/0.1.0
```

## 🧪 Testando no App

### 1. Verificar atualizações manualmente

O hook `useUpdater` já está implementado. Use no componente:

```tsx
import { useUpdater } from '@/hooks/useUpdater';

const { checkForUpdates, updateAvailable } = useUpdater();

// Verificar atualizações
await checkForUpdates();

if (updateAvailable) {
  console.log('Nova versão:', updateAvailable.version);
}
```

### 2. Verificar automaticamente na inicialização

Adicione no `__root.tsx` ou componente principal:

```tsx
useEffect(() => {
  // Verificar atualizações ao iniciar o app
  checkForUpdates();
}, []);
```

### 3. Testar com versão antiga

Para testar, você pode:

1. Buildar o app com uma versão antiga (ex: 0.1.0)
2. Configurar o endpoint com uma versão mais nova (ex: 0.1.1)
3. O app deve detectar a atualização

## 🔍 Debugging

### Verificar logs do endpoint

No Vercel, vá em Functions > [sua-função] > Logs para ver os logs do servidor.

### Verificar no app

O hook `useUpdater` já tem logs no console:

```typescript
console.log('🔍 Verificando atualizações...');
console.log(`🎉 Atualização ${update.version} disponível!`);
```

### Erros comuns

1. **"Failed to check for updates"**
   - Verifique se o endpoint está acessível
   - Verifique CORS no Vercel
   - Verifique os logs do servidor

2. **"Invalid signature"**
   - Verifique se a chave pública está correta
   - Verifique se o arquivo foi assinado corretamente
   - Verifique se a assinatura no endpoint está correta

3. **"No update available" quando deveria haver**
   - Verifique a comparação de versões
   - Verifique se o target/arch está correto
   - Verifique os logs do endpoint

## 📚 Recursos Adicionais

- [Tauri Updater Plugin](https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/updater)
- [Tauri Updater Guide](https://tauri.app/v2/guides/distribution/updater)
- [Tauri Signer](https://github.com/tauri-apps/tauri-plugin-updater#signing-updates)

