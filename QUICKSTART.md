#!/usr/bin/env bash

# ===================================================================
# SYNAPSE NEXUS 2.0 — QUICK DEMO RUNNER
# ===================================================================
#
# This script bootstraps the entire Synapse demo in one shot.
# Run from the repo root: bash demo.sh
#
# Prerequisites:
#   - Node ≥ 20.0.0, pnpm ≥ 9.0.0
#   - .env.local with all API keys filled in:
#     OPENAI_API_KEY, ANTHROPIC_API_KEY, NVIDIA_NIM_API_KEY,
#     NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
#   - Supabase project created with migrations run
#
# ===================================================================

set -e

echo "🚀 SYNAPSE BOOTSTRAP"
echo "==================="

# Check deps
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Install Node ≥ 20.0.0"
    exit 1
fi

if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm not found. Install pnpm ≥ 9.0.0"
    exit 1
fi

# Check .env.local
if [ ! -f .env.local ]; then
    echo "❌ .env.local not found. Copy from .env.local.example and fill in API keys."
    exit 1
fi

echo "✓ Node $(node --version)"
echo "✓ pnpm $(pnpm --version)"
echo "✓ .env.local found"
echo ""

# Step 1: Install dependencies
echo "📦 Installing dependencies..."
pnpm install
echo "✓ Dependencies installed"
echo ""

# Step 2: Bootstrap Stellar
echo "⛓️  Bootstrapping Stellar (treasury + issuer)..."
pnpm stellar:bootstrap 2>&1 | tee .bootstrap.log
echo "✓ Stellar bootstrap complete"
echo "💡 Copy the env vars printed above into .env.local if not already there"
echo ""

# Step 3: Seed agents
echo "🤖 Seeding 12 demo agents..."
pnpm agents:seed
echo "✓ Agents seeded"
echo ""

# Done
echo ""
echo "✅ BOOTSTRAP COMPLETE"
echo ""
echo "🎬 START DEMO (3 terminals):"
echo "  Terminal 1: pnpm dev:web       # http://localhost:3000"
echo "  Terminal 2: pnpm dev:bridge    # ws://localhost:8080"
echo "  Terminal 3: pnpm dev:mobile    # Expo (choose platform)"
echo ""
echo "📝 Then go to http://localhost:3000 and click 'Try Demo'"
echo ""
