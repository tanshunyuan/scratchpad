# docker run --rm \
#   -v "$PWD:/app" \
#   -w /app \
#   -p 5174:5174 \
#   node:24 \
#   sh -lc "corepack enable && pnpm install && pnpm dev --host 0.0.0.0 --port 5174"

# docker run --rm \
#      -v "$PWD:/app" \
#      -v sample-preview-node-modules:/app/node_modules \
#      -w /app \
#      -p 5174:5174 \
#      node:24 \
#      sh -lc "corepack enable && pnpm install && pnpm dev --host 0.0.0.0 --port 5174"

PREVIEW_DIR="/tmp/sample-preview-run"
rm -rf "$PREVIEW_DIR"
mkdir -p "$PREVIEW_DIR"
rsync -a --delete \
  --exclude node_modules \
  --exclude .pnpm-store \
  ./ "$PREVIEW_DIR/"

docker run --rm \
  -v "$PREVIEW_DIR:/app" \
  -v sample-preview-node-modules:/app/node_modules \
  -w /app \
  -p 5174:5174 \
  node:24 \
  sh -lc "corepack enable && pnpm install && pnpm dev --host 0.0.0.0 --port 5174"
