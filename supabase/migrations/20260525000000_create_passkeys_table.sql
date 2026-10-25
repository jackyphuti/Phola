-- Create passkeys table for storing WebAuthn credentials
CREATE TABLE IF NOT EXISTS passkeys (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  transports TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(user_id, credential_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_passkeys_user_id ON passkeys(user_id);
CREATE INDEX IF NOT EXISTS idx_passkeys_credential_id ON passkeys(credential_id);

-- Enable RLS on passkeys table
ALTER TABLE passkeys ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
drop policy if exists "Users can view their own passkeys" on passkeys;
create policy "Users can view their own passkeys" on passkeys FOR SELECT
  USING (auth.uid() = user_id);

drop policy if exists "Users can insert their own passkeys" on passkeys;
create policy "Users can insert their own passkeys" on passkeys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

drop policy if exists "Users can update their own passkeys" on passkeys;
create policy "Users can update their own passkeys" on passkeys FOR UPDATE
  USING (auth.uid() = user_id);

drop policy if exists "Users can delete their own passkeys" on passkeys;
create policy "Users can delete their own passkeys" on passkeys FOR DELETE
  USING (auth.uid() = user_id);
