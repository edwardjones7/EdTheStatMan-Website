-- Adds the 'elite' subscription tier (NFL Season Pass).
--
-- IMPORTANT: run this statement ALONE, in its own SQL editor execution.
-- ALTER TYPE ... ADD VALUE cannot run in the same transaction as any
-- statement that uses the new value, and the Supabase SQL editor wraps
-- each pasted script in a single transaction. Run add_elite_posts_rls.sql
-- and add_elite_content_flags.sql only AFTER this has committed.

alter type subscription_tier add value if not exists 'elite';
