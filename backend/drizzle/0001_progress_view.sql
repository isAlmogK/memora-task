-- Custom migration (drizzle-kit generate --custom): the Drizzle DSL can't express views
-- like this. Everything the UI shows about a book's progress is derived here, in one place.
--
--   current progress  the event that OCCURRED last (occurred_at, then id), not the one that
--                     arrived last, so a late device event can't move you backwards
--   status            abandoned > finished (explicit, or 100%) > reading (any event) > want_to_read
--   pace              percent gained over the trailing 14 days / 14, only while reading;
--                     the baseline is the latest event at or before the window start
--   eta               now + remaining / pace, when pace > 0
CREATE VIEW "user_book_progress" AS
SELECT
  ub.id            AS user_book_id,
  ub.user_id,
  ub.book_id,
  ub.added_at,
  ub.finished_at   AS finished_marked_at,
  ub.abandoned_at,
  coalesce(cur.percent, 0)::numeric(5, 2) AS percent,
  cur.page,
  cur.source,
  cur.occurred_at  AS progress_at,
  s.status,
  CASE WHEN s.status = 'finished'
       THEN coalesce(ub.finished_at, cur.occurred_at) END AS finished_at,
  pace.percent_per_day,
  CASE WHEN pace.percent_per_day > 0
       THEN now() + ((100 - cur.percent) / pace.percent_per_day) * interval '1 day' END AS eta
FROM user_book ub
LEFT JOIN LATERAL (
  SELECT e.percent, e.page, e.source, e.occurred_at
  FROM reading_event e
  WHERE e.user_book_id = ub.id
  ORDER BY e.occurred_at DESC, e.id DESC
  LIMIT 1
) cur ON true
CROSS JOIN LATERAL (
  SELECT CASE
    WHEN ub.abandoned_at IS NOT NULL AND ub.finished_at IS NULL THEN 'abandoned'
    WHEN ub.finished_at IS NOT NULL OR cur.percent >= 100      THEN 'finished'
    WHEN cur.occurred_at IS NOT NULL                            THEN 'reading'
    ELSE 'want_to_read'
  END AS status
) s
LEFT JOIN LATERAL (
  SELECT round((cur.percent - coalesce(base.percent, 0)) / 14.0, 2) AS percent_per_day
  FROM (
    SELECT b.percent
    FROM reading_event b
    WHERE b.user_book_id = ub.id AND b.occurred_at <= now() - interval '14 days'
    ORDER BY b.occurred_at DESC, b.id DESC
    LIMIT 1
  ) base
  RIGHT JOIN (SELECT 1) one ON true
  WHERE s.status = 'reading'
) pace ON true;
