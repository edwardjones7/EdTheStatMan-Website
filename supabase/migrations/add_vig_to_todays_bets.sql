-- Add vig column to todays_bets table
ALTER TABLE todays_bets ADD COLUMN IF NOT EXISTS vig TEXT;
