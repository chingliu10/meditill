# MediTill Deployment and Backup

## Update the existing server

The current production-style installation lives at:

```text
/home/true/apps/meditill
```

PM2 is managed with:

```text
/home/true/trueodds/node_modules/pm2/bin/pm2
```

Deploy:

```bash
cd /home/true/apps/meditill

git status
git pull
npm install
npm run db:migrate
npm run check

/home/true/trueodds/node_modules/pm2/bin/pm2 restart meditill
/home/true/trueodds/node_modules/pm2/bin/pm2 logs meditill --lines 60
```

After installing new permissions, log out of MediTill and sign in again once so the session reloads the role permissions.

## Verify

```bash
curl -I http://127.0.0.1:6000/login
curl -s http://127.0.0.1:6000/login | head
```

Public endpoint:

```text
https://meditill.soliduslogic.co.tz
```

Caddy should proxy that host to:

```text
127.0.0.1:6000
```

Do not expose port 6000 publicly when Caddy is the public reverse proxy.

## Database backup before significant updates

The exact database/user values come from `.env`.

A simple custom-format backup:

```bash
mkdir -p ~/backups/meditill
pg_dump "$DATABASE_URL" -Fc -f ~/backups/meditill/meditill-$(date +%F-%H%M).dump
```

If your shell has not loaded `DATABASE_URL`:

```bash
cd /home/true/apps/meditill
set -a
. ./.env
set +a
pg_dump "$DATABASE_URL" -Fc -f ~/backups/meditill/meditill-$(date +%F-%H%M).dump
```

Check the backup:

```bash
pg_restore --list ~/backups/meditill/<backup-file>.dump | head
```

## Restore into a separate database first

Do not test restores directly over the live database.

Example:

```bash
createdb meditill_restore_test
pg_restore --no-owner --no-privileges -d meditill_restore_test ~/backups/meditill/<backup-file>.dump
psql -d meditill_restore_test -c "select count(*) from medicines;"
```

Drop the test DB when finished:

```bash
dropdb meditill_restore_test
```

## Application rollback

Find a previous application commit:

```bash
git log --oneline -10
```

For an emergency code rollback, create a new branch or checkout the known-good commit temporarily. Do **not** blindly roll back the PostgreSQL schema after migrations if newer application data depends on it.

The safest recovery order is:

1. stop/restart the application if needed,
2. preserve a database backup,
3. restore application code to a known-good version,
4. only restore a database backup when the data/schema itself must be rolled back.
