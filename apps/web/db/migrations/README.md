# Database Migrations

Este diretório contém as migrações SQL para criar as tabelas do banco de dados.

## Ordem de Execução das Migrações

⚠️ **IMPORTANTE**: Execute as migrações na seguinte ordem:

### Para Novos Projetos:

1. **`create_users_and_sessions_tables.sql`** - Cria as tabelas `users` e `sessions` (DEVE ser executada primeiro para autenticação)
2. **`create_conversations_table.sql`** - Cria a tabela pai `conversations`
3. **`create_chats_tables.sql`** - Cria as tabelas `chats` e `messages`
4. **`create_transcriptions_tables.sql`** - Cria as tabelas `transcriptions` e `transcription_segments`
5. **`create_summaries_table.sql`** - Cria a tabela `summaries`

### Para Projetos Existentes (com dados):

1. **`create_conversations_table.sql`** - Cria a tabela pai `conversations` (DEVE ser executada primeiro)
2. **`add_conversation_id_to_existing_tables.sql`** - Adiciona `conversation_id` às tabelas existentes, cria conversações para registros existentes e adiciona as foreign keys

**Nota**: Se você já tem as tabelas `chats` e `transcriptions`, não precisa executar `create_chats_tables.sql` e `create_transcriptions_tables.sql`, apenas `add_conversation_id_to_existing_tables.sql`.

## Executando as Migrações

### Opção 1: Executar via SQL direto

Execute os arquivos SQL na ordem listada acima no seu banco de dados PostgreSQL/Supabase.

### Opção 2: Executar via código TypeScript

Você pode criar um script para executar as migrações na ordem correta:

```typescript
import { getClient } from "../db";
import { readFileSync } from "fs";
import { join } from "path";

async function runMigrations() {
  const client = await getClient();
  if (!client) {
    throw new Error("Database client not available");
  }

  // Para novos projetos:
  const migrations = [
    "create_conversations_table.sql",
    "create_chats_tables.sql",
    "create_transcriptions_tables.sql",
    "create_summaries_table.sql",
  ];

  // Para projetos existentes:
  // const migrations = [
  //   "create_conversations_table.sql",
  //   "add_conversation_id_to_existing_tables.sql",
  // ];

  for (const migration of migrations) {
    const migrationSQL = readFileSync(
      join(__dirname, "migrations", migration),
      "utf-8"
    );
    await client.query(migrationSQL);
    console.log(`Migration ${migration} completed successfully`);
  }
}

runMigrations();
```

## Estrutura das Tabelas

### `conversations` (Tabela Pai)

Tabela que agrupa todos os tipos de conversas (chats, transcrições, resumos, etc.).

- `id` (UUID): Identificador único da conversação
- `user_id` (TEXT): ID do usuário
- `title` (TEXT, opcional): Título da conversação
- `type` (TEXT): Tipo da conversação (`chat`, `transcription`, `summary`, `mixed`)
- `created_at` (TIMESTAMP): Data de criação
- `updated_at` (TIMESTAMP): Data da última atualização

### `chats`

Armazena sessões de chat. Cada chat tem seu próprio ID único, mas compartilha um `conversation_id`.

- `id` (UUID): Identificador único do chat
- `conversation_id` (UUID): Referência à conversação pai
- `user_id` (TEXT): ID do usuário
- `title` (TEXT, opcional): Título do chat
- `created_at` (TIMESTAMP): Data de criação
- `updated_at` (TIMESTAMP): Data da última atualização

### `messages`

Armazena mensagens individuais de chat.

- `id` (UUID): Identificador único
- `chat_id` (UUID): Referência ao chat pai
- `role` (TEXT): Papel da mensagem (`user`, `assistant`, `system`)
- `content` (TEXT): Conteúdo da mensagem
- `created_at` (TIMESTAMP): Data de criação

### `transcriptions`

Armazena sessões de transcrição. Cada transcrição tem seu próprio ID único, mas compartilha um `conversation_id`.

- `id` (UUID): Identificador único da transcrição
- `conversation_id` (UUID): Referência à conversação pai
- `user_id` (TEXT): ID do usuário
- `title` (TEXT, opcional): Título da transcrição
- `created_at` (TIMESTAMP): Data de criação
- `updated_at` (TIMESTAMP): Data da última atualização

### `transcription_segments`

Armazena os segmentos de texto transcritos.

- `id` (UUID): Identificador único
- `transcription_id` (UUID): Referência à transcrição pai
- `text` (TEXT): Texto transcrito
- `start_time` (REAL, opcional): Tempo de início em segundos
- `end_time` (REAL, opcional): Tempo de fim em segundos
- `created_at` (TIMESTAMP): Data de criação

### `summaries`

Armazena resumos de documentos vinculados a conversações. Cada resumo tem seu próprio ID único, mas compartilha um `conversation_id`.

- `id` (UUID): Identificador único do resumo
- `conversation_id` (UUID): Referência à conversação pai
- `user_id` (TEXT): ID do usuário
- `title` (TEXT, opcional): Título do resumo
- `content` (TEXT, opcional): Conteúdo do resumo (pode ser JSON/Plate format ou texto simples)
- `created_at` (TIMESTAMP): Data de criação
- `updated_at` (TIMESTAMP): Data da última atualização

## Relacionamentos

### Hierarquia Principal

```
conversations (tabela pai)
├── chats (cada chat tem seu próprio ID, mas compartilha conversation_id)
│   └── messages
├── transcriptions (cada transcrição tem seu próprio ID, mas compartilha conversation_id)
│   └── transcription_segments
└── summaries (cada resumo tem seu próprio ID, mas compartilha conversation_id)
```

### Foreign Keys

- `chats.conversation_id` → `conversations.id` (CASCADE DELETE)
- `transcriptions.conversation_id` → `conversations.id` (CASCADE DELETE)
- `summaries.conversation_id` → `conversations.id` (CASCADE DELETE)
- `messages.chat_id` → `chats.id` (CASCADE DELETE)
- `transcription_segments.transcription_id` → `transcriptions.id` (CASCADE DELETE)

### Comportamento de Deleção

- Quando uma `conversation` é deletada, todos os `chats`, `transcriptions` e `summaries` relacionados são deletados automaticamente
- Quando um `chat` é deletado, todas as suas `messages` são deletadas automaticamente
- Quando uma `transcription` é deletada, todos os seus `transcription_segments` são deletados automaticamente

## Índices

As seguintes colunas têm índices para melhorar a performance das consultas:

### `conversations`

- `user_id`
- `type`
- `created_at`

### `chats`

- `conversation_id`
- `user_id`
- `created_at`

### `messages`

- `chat_id`
- `created_at`

### `transcriptions`

- `conversation_id`
- `user_id`
- `created_at`

### `transcription_segments`

- `transcription_id`
- `created_at`

### `summaries`

- `conversation_id`
- `user_id`
- `created_at`

## Conceito de Conversações

A tabela `conversations` serve como um agrupador unificado para diferentes tipos de conteúdo:

- **Chats**: Cada chat aberto cria uma conversação do tipo `chat`
- **Transcrições**: Cada transcrição criada cria uma conversação do tipo `transcription`
- **Resumos**: Cada resumo criado cria uma conversação do tipo `summary`
- **Conversações mistas**: Tipo `mixed` para conversações que contêm múltiplos tipos de conteúdo

Cada chat, transcrição e resumo mantém seu próprio ID único para operações específicas, mas todos compartilham o `conversation_id` para agrupamento e consultas unificadas.
