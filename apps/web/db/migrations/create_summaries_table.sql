-- Create summaries table
-- This table stores summary documents linked to conversations
-- NOTE: conversation_id is nullable initially to allow for migration of existing data
-- After migration, you may want to make it NOT NULL if desired
CREATE TABLE IF NOT EXISTS summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID,
  user_id TEXT NOT NULL,
  title TEXT,
  content TEXT, -- Stores the summary content (can be JSON/Plate format or plain text)
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Foreign key constraint will be added in add_conversation_id_to_existing_tables.sql
  -- or can be added here if this is a fresh installation
  CONSTRAINT summaries_conversation_id_fkey 
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_summaries_conversation_id ON summaries(conversation_id);
CREATE INDEX IF NOT EXISTS idx_summaries_user_id ON summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_summaries_created_at ON summaries(created_at DESC);

-- Create a function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_summary_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at when summary is updated
CREATE TRIGGER update_summary_timestamp
  BEFORE UPDATE ON summaries
  FOR EACH ROW
  EXECUTE FUNCTION update_summary_updated_at();

