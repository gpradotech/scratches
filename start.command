#!/bin/sh
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Instale o Node.js 22.19 ou superior para abrir o Scratches."
  exit 1
fi
exec node --use-system-ca scripts/open-app.mjs
