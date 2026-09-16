#!/usr/bin/env bash
# Proves a refactor changed no output. Builds, then stores every prerendered
# page with the <script> tags (chunk hashes, RSC payload), hashed <link>s and
# Next's image preload hints (attribute order varies per build) removed, so
# two captures can be diffed. Structured data lives in <script> tags too, so
# every page's JSON-LD blocks are kept beside it as <page>.jsonld — one block
# per line, keys sorted (jq -S), because JSON-LD is a graph in which key
# order means nothing and a builder may emit it differently — and the
# non-HTML routes (sitemap.xml, feed.xml, robots.txt, the icons) are copied
# as they are:
#
#   scripts/parity.sh before        # on the base commit
#   scripts/parity.sh after         # with the change applied
#   diff -r .parity/before .parity/after && echo identical
set -euo pipefail
label=${1:?usage: scripts/parity.sh <label>}
root=$(cd "$(dirname "$0")/.." && pwd); out="$root/.parity/$label"
cd "$root"
pnpm build > ".parity/$label.build.log" 2>&1 || { echo "build failed, see .parity/$label.build.log"; exit 1; }
rm -rf "$out"; mkdir -p "$out"
find .next/server/app -name '*.html' | while read -r f; do
  rel=${f#.next/server/app/}; mkdir -p "$out/$(dirname "$rel")"
  perl -0ne 'while (m{<script type="application/ld\+json">(.*?)</script>}gs) { print "$1\n" }' "$f" | jq -S -c . > "$out/${rel%.html}.jsonld"
  perl -0pe 's{<script\b[^>]*>.*?</script>}{}gs; s{<link\b[^>]*/_next/static/[^>]*>}{}g; s{<link rel="preload"[^>]*>}{}g' "$f" > "$out/$rel"
done
find .next/server/app -name '*.body' | while read -r f; do
  rel=${f#.next/server/app/}; mkdir -p "$out/$(dirname "$rel")"; cp "$f" "$out/$rel"
done
echo "$label: $(find "$out" -name '*.html' | wc -l) pages, $(find "$out" -name '*.jsonld' | wc -l) jsonld, $(find "$out" -name '*.body' | wc -l) bodies in .parity/$label"
