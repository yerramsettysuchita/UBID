"""Phase 3 migration: new tables + new columns on review_cases."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from sqlalchemy import create_engine, text

DATABASE_URL = os.environ.get("SYNC_DATABASE_URL") or os.environ["DATABASE_URL"].replace(
    "postgresql+asyncpg://", "postgresql://"
).replace("?ssl=require", "?sslmode=require")


DDL = [
    # -- review_cases: Phase 3 columns ----------------------------------------
    """
    ALTER TABLE review_cases
      ADD COLUMN IF NOT EXISTS priority_level  VARCHAR(2)  NOT NULL DEFAULT 'P3',
      ADD COLUMN IF NOT EXISTS sla_deadline    TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS assigned_reviewer_id UUID REFERENCES users(id),
      ADD COLUMN IF NOT EXISTS assigned_at     TIMESTAMPTZ
    """,

    # -- review_comments -------------------------------------------------------
    """
    CREATE TABLE IF NOT EXISTS review_comments (
      id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      review_case_id  UUID        NOT NULL REFERENCES review_cases(id) ON DELETE CASCADE,
      user_id         UUID        NOT NULL REFERENCES users(id),
      comment         TEXT        NOT NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,

    # -- cluster_history -------------------------------------------------------
    """
    CREATE TABLE IF NOT EXISTS cluster_history (
      id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      cluster_id    UUID        NOT NULL REFERENCES ubid_clusters(id) ON DELETE CASCADE,
      action        VARCHAR(30) NOT NULL,
      performed_by  UUID        REFERENCES users(id),
      before_state  JSONB,
      after_state   JSONB,
      note          TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,

    # -- indexes ---------------------------------------------------------------
    "CREATE INDEX IF NOT EXISTS idx_review_cases_priority   ON review_cases(priority_level)",
    "CREATE INDEX IF NOT EXISTS idx_review_cases_sla        ON review_cases(sla_deadline) WHERE sla_deadline IS NOT NULL",
    "CREATE INDEX IF NOT EXISTS idx_review_cases_assigned   ON review_cases(assigned_reviewer_id) WHERE assigned_reviewer_id IS NOT NULL",
    "CREATE INDEX IF NOT EXISTS idx_review_comments_case    ON review_comments(review_case_id)",
    "CREATE INDEX IF NOT EXISTS idx_cluster_history_cluster ON cluster_history(cluster_id)",
]


def run():
    engine = create_engine(DATABASE_URL, echo=False)
    with engine.begin() as conn:
        for stmt in DDL:
            s = stmt.strip()
            if not s:
                continue
            label = s.split("\n")[0][:60].strip()
            try:
                conn.execute(text(s))
                print(f"  OK  {label}")
            except Exception as e:
                print(f"  SKIP {label}  -- {e}")
    engine.dispose()
    print("\nPhase 3 migration complete.")


if __name__ == "__main__":
    run()
