#!/bin/bash

# Deployment verification script
# Run this after deploying to Vercel to verify embeddings and classifications work

VERCEL_URL="${1:-}"

if [ -z "$VERCEL_URL" ]; then
    echo "Usage: ./verify-deployment.sh https://your-project.vercel.app"
    exit 1
fi

# Remove trailing slash
VERCEL_URL="${VERCEL_URL%/}"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║         Vercel Deployment Verification Script              ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Testing: $VERCEL_URL"
echo ""

# Function to print test result
test_endpoint() {
    local name=$1
    local method=$2
    local endpoint=$3
    local data=$4

    echo -n "Testing $name... "

    if [ -z "$data" ]; then
        response=$(curl -s -X $method "$VERCEL_URL$endpoint")
    else
        response=$(curl -s -X $method "$VERCEL_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi

    if [ $? -eq 0 ]; then
        echo "✓"
        echo "  Response: ${response:0:200}..."
    else
        echo "✗"
        echo "  Error: Failed to connect"
        return 1
    fi
    echo ""
}

# Test 1: Health check
echo "[1] Checking embeddings health..."
test_endpoint "Health Check" "GET" "/api/health/embeddings"

# Test 2: Recompute status
echo "[2] Checking recompute status..."
test_endpoint "Recompute Status" "GET" "/api/recompute/status"

# Test 3: Classify with example text
echo "[3] Testing classification..."
test_endpoint "Classification" "POST" "/api/classify" \
    '{"text": "write a Node.js server"}'

# Test 4: Get categories
echo "[4] Getting categories..."
test_endpoint "Categories" "GET" "/api/categories"

echo "════════════════════════════════════════════════════════════"
echo ""
echo "Verification complete!"
echo ""
echo "Next steps:"
echo "1. If any tests failed, check the error message above"
echo "2. If recompute status shows 0 examples, run:"
echo "   curl -X POST $VERCEL_URL/api/recompute"
echo "3. Test classification again after recompute completes"
echo ""
echo "For full verification, check:"
echo "- Vercel Dashboard → Logs"
echo "- Vercel Dashboard → Storage → Blob"
echo "- Look for classifier-embeddings.json file"
