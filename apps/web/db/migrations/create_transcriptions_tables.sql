-- Create transcriptions table (similar to chats)
-- This table stores transcription sessions
-- NOTE: conversation_id is nullable initially to allow for migration of existing data
-- After migration, you may want to make it NOT NULL if desired
CREATE TABLE IF NOT EXISTS transcriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID,
  user_id TEXT NOT NULL,
  title TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create transcription_segments table (similar to messages)
-- This table stores individual transcription text segments
CREATE TABLE IF NOT EXISTS transcription_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transcription_id UUID NOT NULL REFERENCES transcriptions(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  start_time REAL,
  end_time REAL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_transcriptions_conversation_id ON transcriptions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_transcriptions_user_id ON transcriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_transcriptions_created_at ON transcriptions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transcription_segments_transcription_id ON transcription_segments(transcription_id);
CREATE INDEX IF NOT EXISTS idx_transcription_segments_created_at ON transcription_segments(created_at);

-- Create a function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_transcription_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at when transcription is updated
CREATE TRIGGER update_transcription_timestamp
  BEFORE UPDATE ON transcriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_transcription_updated_at();


