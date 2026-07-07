#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

readonly OUT_DIR="${1:-_sevalla_public}"

if [[ -z "$OUT_DIR" || "$OUT_DIR" == "/" || "$OUT_DIR" == "." ]]; then
  echo "Refusing unsafe output directory: $OUT_DIR" >&2
  exit 1
fi

copy_file() {
  local source_path="$1"

  if [[ -f "$source_path" ]]; then
    mkdir -p "$OUT_DIR/$(dirname "$source_path")"
    cp "$source_path" "$OUT_DIR/$source_path"
  fi
}

copy_dir() {
  local source_path="$1"

  if [[ -d "$source_path" ]]; then
    mkdir -p "$OUT_DIR/$(dirname "$source_path")"
    cp -R "$source_path" "$OUT_DIR/$source_path"
  fi
}

main() {
  rm -rf "$OUT_DIR"
  mkdir -p "$OUT_DIR"

  local file
  for file in \
    index.html \
    404.html \
    robots.txt \
    sitemap.xml \
    llms.txt \
    favicon.ico \
    _redirects; do
    copy_file "$file"
  done

  local dir
  for dir in \
    additional-info \
    blog \
    broken-chain-sell-house-for-cash \
    contact \
    faqs \
    important-advice \
    lp \
    middle-form \
    modern-method-of-auction \
    privacy-policy \
    privacy-policy-2 \
    sell-former-buy-to-let \
    sell-your-house-fast \
    selling-house-after-divorce \
    selling-house-due-illness \
    selling-house-pay-debt \
    selling-inherited-property \
    selling-your-house-with-japanese-knotweed \
    SMSJFDESIGN \
    stop-repossession \
    terms-conditions \
    testimonials \
    thank-you \
    why-us; do
    copy_dir "$dir"
  done

  # Keep the public artifact static-only: Sevalla serves this directory directly.
  find "$OUT_DIR" -name '.DS_Store' -delete
  find "$OUT_DIR" -type d \( -name '__pycache__' -o -name '.claude' \) -prune -exec rm -rf {} +
  find "$OUT_DIR/lp/shared" -type f \( -name '*.py' -o -name '*.pyc' \) -delete

  local forbidden
  for forbidden in \
    "$OUT_DIR/.github" \
    "$OUT_DIR/.gg" \
    "$OUT_DIR/lp/.claude" \
    "$OUT_DIR/BLOG-SETUP.md" \
    "$OUT_DIR/BLOG-DEPLOYMENT.md" \
    "$OUT_DIR/CONTRIBUTING.md" \
    "$OUT_DIR/DEPLOY.md" \
    "$OUT_DIR/.env" \
    "$OUT_DIR/.env.local" \
    "$OUT_DIR/.env.example" \
    "$OUT_DIR/.github/BLOG-CREDENTIALS.md"; do
    if [[ -e "$forbidden" ]]; then
      echo "Private file leaked into public artifact: $forbidden" >&2
      exit 1
    fi
  done

  if find "$OUT_DIR/lp/shared" -type f \( -name '*.py' -o -name '*.pyc' \) | grep -q .; then
    echo "Python tooling leaked into public artifact under lp/shared" >&2
    exit 1
  fi

  echo "Built clean Sevalla public artifact at $OUT_DIR"
}

main "$@"
