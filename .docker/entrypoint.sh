#!/bin/sh
set -e

# Fix permissions on every start (host volume may override)
mkdir -p storage/framework/{sessions,views,cache} storage/logs bootstrap/cache storage/app/public database
touch database/database.sqlite 2>/dev/null || true
chown -R www-data:www-data storage bootstrap/cache database 2>/dev/null || true
chmod -R 775 storage bootstrap/cache 2>/dev/null || true

# Generate .env if missing
if [ ! -f .env ]; then
  echo ">> .env not found, copying from .env.example"
  cp .env.example .env
fi

# Generate APP_KEY if empty
if ! grep -q "^APP_KEY=base64" .env 2>/dev/null; then
  echo ">> Generating APP_KEY"
  php artisan key:generate --force || true
fi

# Wait for DB if using mysql/pgsql
if echo "$DB_CONNECTION" | grep -qE "mysql|pgsql|mariadb"; then
  echo ">> Waiting for DB $DB_HOST:$DB_PORT ..."
  until php -r "
    try {
      \$pdo = new PDO(
        getenv('DB_CONNECTION').':host='.getenv('DB_HOST').';port='.getenv('DB_PORT').';dbname='.getenv('DB_DATABASE'),
        getenv('DB_USERNAME'),
        getenv('DB_PASSWORD')
      );
      exit(0);
    } catch (Exception \$e) { exit(1); }
  " 2>/dev/null; do
    sleep 2
  done
  echo ">> DB ready"
fi

# Wait for Redis if configured
if [ "$CACHE_STORE" = "redis" ] || [ "$SESSION_DRIVER" = "redis" ] || [ "$QUEUE_CONNECTION" = "redis" ]; then
  echo ">> Waiting for Redis $REDIS_HOST:$REDIS_PORT ..."
  until php -r "
    \$fp=@fsockopen(getenv('REDIS_HOST') ?: 'redis', getenv('REDIS_PORT') ?: 6379, \$e, \$s, 2);
    if(\$fp){fclose(\$fp); exit(0);} exit(1);
  " 2>/dev/null; do
    sleep 1
  done
  echo ">> Redis ready"
fi

# Clear stale cache
php artisan config:clear || true

# Run migrations (non-destructive)
echo ">> Running migrations --force"
php artisan migrate --force || echo "!! migrate failed, check DB creds"

# Storage link
php artisan storage:link || true

# Optimize caches
php artisan config:cache || true
php artisan route:cache || true
php artisan view:cache || true
php artisan event:cache || true

# Permissions again after cache
chown -R www-data:www-data storage bootstrap/cache 2>/dev/null || true

echo ">> Starting $@"
exec "$@"
