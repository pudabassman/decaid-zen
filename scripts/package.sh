#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
version="$(node -p "require('$root/package.json').version")"
out="$root/decaid-zen-$version.zip"

cd "$root"
npm run build
cd dist
rm -f "$out"
zip -qr "$out" .
echo "$out"
