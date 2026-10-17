#!/bin/sh
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Instale o Node.js 22.19 ou superior para abrir o Scratches."
  exit 1
fi
if [ -e .git ]; then
  exec npm run dev
fi
if [ ! -f app/dist/index.html ]; then
  npm run build || exit 1
fi
exec node --use-system-ca scripts/run.mjs
