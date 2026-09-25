#!/bin/bash
# Deploy Medic1905 to Vercel via REST API using curl
set -e

VERCEL_TOKEN="$VERCEL_TOKEN"
PROJECT_ID="prj_29ChVRCuCtUx6BGskchtGrkmhoR7"
TEAM_ID="team_xfMqpQ1z58MhNhCwp7h0Gupx"
BASE_URL="https://api.vercel.com"
PROJECT_ROOT="/home/user/workspace/medic1905"

# Collect files and their SHA hashes
echo "Collecting files..."
MANIFEST="[]"
FILE_COUNT=0

# Function to add a file to the manifest
add_file() {
    local filepath="$1"
    local relpath="$2"
    local sha
    sha=$(sha1sum "$filepath" | awk '{print $1}')
    local size
    size=$(wc -c < "$filepath")
    
    # Upload the file
    local upload_resp
    upload_resp=$(curl -s -X POST "${BASE_URL}/v2/files?teamId=${TEAM_ID}" \
        -H "Authorization: Bearer ${VERCEL_TOKEN}" \
        -H "Content-Type: application/octet-stream" \
        -H "x-vercel-digest: ${sha}" \
        --data-binary "@${filepath}" 2>&1)
    
    if echo "$upload_resp" | grep -q "error"; then
        echo "  Failed: $relpath"
    else
        echo "  Uploaded: $relpath"
    fi
    
    # Add to manifest
    MANIFEST=$(echo "$MANIFEST" | python3 -c "
import sys, json
manifest = json.load(sys.stdin)
manifest.append({'file': '$relpath', 'sha': '$sha', 'size': $size})
print(json.dumps(manifest))
" <<< "$MANIFEST")
    
    FILE_COUNT=$((FILE_COUNT + 1))
}

# Process src directory
find "$PROJECT_ROOT/src" -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.css" \) | while read -r filepath; do
    relpath="${filepath#$PROJECT_ROOT/}"
    add_file "$filepath" "$relpath"
done

# Process prisma directory
find "$PROJECT_ROOT/prisma" -type f -name "*.prisma" | while read -r filepath; do
    relpath="${filepath#$PROJECT_ROOT/}"
    add_file "$filepath" "$relpath"
done

# Add root files
for f in package.json next.config.ts tsconfig.json postcss.config.mjs README.md; do
    filepath="$PROJECT_ROOT/$f"
    if [ -f "$filepath" ]; then
        add_file "$filepath" "$f"
    fi
done

echo "Uploaded $FILE_COUNT files. Creating deployment..."

# Create deployment
curl -s -X POST "${BASE_URL}/v13/deployments?teamId=${TEAM_ID}" \
    -H "Authorization: Bearer ${VERCEL_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{
        \"projectId\": \"${PROJECT_ID}\",
        \"files\": $(echo "$MANIFEST"),
        \"target\": \"preview\",
        \"projectSettings\": {
            \"framework\": \"nextjs\",
            \"buildCommand\": \"npm run build\",
            \"outputDirectory\": \".next\",
            \"installCommand\": \"npm install\"
        }
    }" 2>&1 | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    if 'error' in d:
        print('Error:', d['error'])
    else:
        print('Deployment created!')
        print('  URL: https://' + d.get('url', 'unknown'))
        print('  State:', d.get('readyState', 'unknown'))
except:
    print('Failed to parse response')
"
