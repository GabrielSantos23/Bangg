# Tauri Updater Service

Este serviço fornece endpoints para o sistema de atualização automática do Tauri v2.

## 📋 Visão Geral

O Tauri Updater Plugin verifica atualizações fazendo requisições HTTP para endpoints configurados. Este serviço implementa esses endpoints usando Vercel Serverless Functions.

## 🏗️ Estrutura

```
apps/updater/
├── api/
│   └── [target]/
│       └── [arch]/
│           └── [version].ts    # Endpoint principal
├── package.json
├── tsconfig.json
├── vercel.json                 # Configuração do Vercel
└── README.md
```

## 🔧 Configuração

### 1. Configuração no Tauri

O endpoint está configurado no `tauri.conf.json`:

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

### 2. Variáveis de Ambiente (Opcional)

Você pode usar variáveis de ambiente no Vercel para configurar:

- `UPDATER_BASE_URL`: URL base para os arquivos de atualização
- `UPDATER_SIGNATURE_KEY`: Chave para assinatura (se necessário)

### 3. Deploy no Vercel

1. Conecte o repositório ao Vercel
2. Configure o projeto:
   - **Root Directory**: `apps/updater`
   - **Build Command**: (deixe vazio ou `echo 'No build step'`)
   - **Output Directory**: (deixe vazio)
   - **Install Command**: `bun install` ou `npm install`

3. Configure o domínio:
   - Use um domínio personalizado (ex: `updater.bangg.xyz`)
   - Ou use o domínio padrão do Vercel

## 📝 Formato da Resposta

O endpoint retorna um JSON no formato esperado pelo Tauri:

```json
{
  "version": "0.1.1",
  "notes": "Correções de bugs e melhorias de performance",
  "pub_date": "2024-01-01T00:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "assinatura-do-arquivo",
      "url": "https://github.com/.../app_0.1.1_x64-setup.exe"
    }
  }
}
```

### Status Codes

- `200`: Atualização disponível (retorna JSON)
- `204`: Sem atualização disponível (versão atual é a mais recente)
- `400`: Parâmetros inválidos
- `500`: Erro interno do servidor

## 🚀 Como Funciona

1. O app Tauri faz uma requisição GET para:
   ```
   https://updater.bangg.xyz/windows-x86_64/0.1.0
   ```

2. O endpoint verifica:
   - Se há uma atualização disponível para a plataforma
   - Se a versão disponível é mais recente que a atual

3. Se houver atualização:
   - Retorna JSON com informações da atualização
   - O Tauri baixa e instala automaticamente

4. Se não houver atualização:
   - Retorna status 204 (No Content)

## 🔐 Assinatura de Arquivos

O Tauri verifica a assinatura dos arquivos de atualização usando a chave pública configurada. Para gerar as assinaturas:

```bash
# Após buildar o app
tauri signer sign <caminho-do-arquivo> --private-key <chave-privada>
```

A assinatura deve ser incluída no campo `signature` da resposta.

## 📦 Gerenciamento de Versões

### Opção 1: Hardcoded (Atual)

As versões estão definidas diretamente no código (`api/[target]/[arch]/[version].ts`).

### Opção 2: Banco de Dados (Recomendado para produção)

Para um sistema mais robusto, você pode:

1. Armazenar versões em um banco de dados
2. Criar uma API admin para gerenciar versões
3. Buscar versões dinamicamente no endpoint

Exemplo com banco de dados:

```typescript
// Exemplo simplificado
const update = await db.updates.findFirst({
  where: {
    target: targetKey,
    version: { gt: currentVersion }
  },
  orderBy: { version: 'desc' }
});
```

### Opção 3: GitHub Releases

Você pode integrar com GitHub Releases para buscar versões automaticamente:

```typescript
const response = await fetch(
  `https://api.github.com/repos/your-org/your-repo/releases/latest`
);
const release = await response.json();
```

## 🧪 Testando Localmente

```bash
cd apps/updater
bun install
vercel dev
```

Teste o endpoint:

```bash
curl http://localhost:3000/api/windows-x86_64/0.1.0
```

## 📚 Referências

- [Tauri Updater Plugin Documentation](https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/updater)
- [Tauri Updater Guide](https://tauri.app/v2/guides/distribution/updater)
- [Vercel Serverless Functions](https://vercel.com/docs/functions)

## 🔄 Próximos Passos

1. ✅ Estrutura básica criada
2. ⏳ Integrar com banco de dados ou GitHub Releases
3. ⏳ Adicionar autenticação para endpoints admin
4. ⏳ Implementar cache para melhor performance
5. ⏳ Adicionar logging e monitoramento

