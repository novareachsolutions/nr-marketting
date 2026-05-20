-- Rename DATAFORSEO to SERPAPI on the DataSource enum.
-- Any existing rows referencing DATAFORSEO have been re-tagged to GSC
-- in a prior data cleanup step (they were OpenAI estimates incorrectly
-- labeled as DATAFORSEO by the old rank-checker code path).

ALTER TYPE "DataSource" RENAME VALUE 'DATAFORSEO' TO 'SERPAPI';
