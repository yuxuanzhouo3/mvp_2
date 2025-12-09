-- Add 'search' to the valid link_type values in recommendation_history table
ALTER TABLE recommendation_history
DROP CONSTRAINT IF EXISTS recommendation_history_link_type_check;

ALTER TABLE recommendation_history
ADD CONSTRAINT recommendation_history_link_type_check
CHECK (link_type IN ('product', 'video', 'book', 'location', 'article', 'app', 'music', 'movie', 'game', 'restaurant', 'recipe', 'hotel', 'course', 'search'));