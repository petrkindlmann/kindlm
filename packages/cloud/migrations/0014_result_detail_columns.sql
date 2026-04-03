-- Add response text and tool calls detail columns to results table
ALTER TABLE results ADD COLUMN response_text TEXT;
ALTER TABLE results ADD COLUMN tool_calls_json TEXT;
