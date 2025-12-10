-- Fix the link_type constraint to include 'search'
-- This migration updates the check constraint to allow 'search' as a valid link_type

-- Drop the existing constraint
ALTER TABLE recommendation_history DROP CONSTRAINT IF EXISTS recommendation_history_link_type_check;

-- Add the new constraint with 'search' included
ALTER TABLE recommendation_history ADD CONSTRAINT recommendation_history_link_type_check
  CHECK (link_type IN ('product', 'video', 'book', 'location', 'article', 'app', 'music', 'movie', 'game', 'restaurant', 'recipe', 'hotel', 'course', 'search'));