-- Migration to add conversation_id to existing chats and transcriptions tables
-- IMPORTANT: Run create_conversations_table.sql FIRST before running this migration
-- This migration assumes the tables already exist and adds the conversation_id column
-- and creates conversations for existing records

-- Step 1: Add conversation_id column to chats table (if it doesn't exist)
-- First add as nullable, then we'll populate it, then make it NOT NULL
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'chats' AND column_name = 'conversation_id'
  ) THEN
    -- Add column as nullable first
    ALTER TABLE chats ADD COLUMN conversation_id UUID;
    CREATE INDEX IF NOT EXISTS idx_chats_conversation_id ON chats(conversation_id);
  END IF;
END $$;

-- Step 2: Add conversation_id column to transcriptions table (if it doesn't exist)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transcriptions' AND column_name = 'conversation_id'
  ) THEN
    -- Add column as nullable first
    ALTER TABLE transcriptions ADD COLUMN conversation_id UUID;
    CREATE INDEX IF NOT EXISTS idx_transcriptions_conversation_id ON transcriptions(conversation_id);
  END IF;
END $$;

-- Step 3: Create conversations for existing chats (one conversation per chat)
-- Each chat gets its own conversation
DO $$
DECLARE
  chat_record RECORD;
  new_conv_id UUID;
BEGIN
  FOR chat_record IN 
    SELECT id, user_id, title, created_at, updated_at 
    FROM chats 
    WHERE conversation_id IS NULL
  LOOP
    -- Create a new conversation for this chat
    INSERT INTO conversations (id, user_id, title, type, created_at, updated_at)
    VALUES (
      gen_random_uuid(),
      chat_record.user_id,
      chat_record.title,
      'chat',
      chat_record.created_at,
      chat_record.updated_at
    )
    RETURNING id INTO new_conv_id;
    
    -- Link the chat to the new conversation
    UPDATE chats 
    SET conversation_id = new_conv_id 
    WHERE id = chat_record.id;
  END LOOP;
END $$;

-- Step 4: Create conversations for existing transcriptions (one conversation per transcription)
-- Each transcription gets its own conversation
DO $$
DECLARE
  trans_record RECORD;
  new_conv_id UUID;
BEGIN
  FOR trans_record IN 
    SELECT id, user_id, title, created_at, updated_at 
    FROM transcriptions 
    WHERE conversation_id IS NULL
  LOOP
    -- Create a new conversation for this transcription
    INSERT INTO conversations (id, user_id, title, type, created_at, updated_at)
    VALUES (
      gen_random_uuid(),
      trans_record.user_id,
      trans_record.title,
      'transcription',
      trans_record.created_at,
      trans_record.updated_at
    )
    RETURNING id INTO new_conv_id;
    
    -- Link the transcription to the new conversation
    UPDATE transcriptions 
    SET conversation_id = new_conv_id 
    WHERE id = trans_record.id;
  END LOOP;
END $$;

-- Step 5: Add foreign key constraints (now that all records have conversation_id)
DO $$
BEGIN
  -- Add FK constraint to chats if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'chats_conversation_id_fkey'
  ) THEN
    ALTER TABLE chats 
    ADD CONSTRAINT chats_conversation_id_fkey 
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;
  END IF;
  
  -- Add FK constraint to transcriptions if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'transcriptions_conversation_id_fkey'
  ) THEN
    ALTER TABLE transcriptions 
    ADD CONSTRAINT transcriptions_conversation_id_fkey 
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;
  END IF;
  
  -- Add FK constraint to summaries if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'summaries_conversation_id_fkey'
  ) THEN
    ALTER TABLE summaries 
    ADD CONSTRAINT summaries_conversation_id_fkey 
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;
  END IF;
END $$;

