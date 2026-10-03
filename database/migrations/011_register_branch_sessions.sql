-- Allow an authorized user to operate one register session per branch while
-- preserving the invariant that a physical register cannot be opened twice.
DROP INDEX IF EXISTS uq_open_register_user;

CREATE UNIQUE INDEX IF NOT EXISTS uq_open_register_user_branch
  ON register_sessions(user_id,branch_id)
  WHERE status='OPEN';

CREATE UNIQUE INDEX IF NOT EXISTS uq_open_register_register
  ON register_sessions(register_id)
  WHERE status='OPEN';
