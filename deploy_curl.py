#!/usr/bin/env python3
"""Deploy Medic1905 to Vercel via REST API using curl for uploads."""
import os
import hashlib
import json
import subprocess
import glob

VERCEL_TOKEN = os.environ.get("VERCEL_TOKEN", "")
PROJECT_ID = "prj_29ChVRCuCtUx6BGskchtGrkmhoR7"
TEAM_ID = "team_xfMqpQ1z58MhNhCwp7h0Gupx"
BASE_URL = "https://api.vercel.com"
PROJECT_ROOT = "/home/user/workspace/medic1905"

def collect_files():
    files = []
    # Source files
    for pattern in ["src/**/*.ts", "src/**/*.tsx", "src/**/*.css"]:
        for f in glob.glob(os.path.join(PROJECT_ROOT, pattern), recursive=True):
            relpath = os.path.relpath(f, PROJECT_ROOT)
            files.append((f, relpath))
    # Prisma files
    for f in glob.glob(os.path.join(PROJECT_ROOT, "prisma/**/*.prisma"), recursive=True):
        relpath = os.path.relpath(f, PROJECT_ROOT)
        files.append((f, relpath))
    # Root files
    for name in ["package.json", "next.config.ts", "tsconfig.json", "postcss.config.mjs", "README.md"]:
        filepath = os.path.join(PROJECT_ROOT, name)
        if os.path.isfile(filepath):
            files.append((filepath, name))
    return files

def upload_file(filepath, relpath):
    with open(filepath, "rb") as f:
        content = f.read()
    sha = hashlib.sha1(content).hexdigest()
    
    # Upload using curl
    result = subprocess.run(
        ["curl", "-s", "-X", "POST", f"{BASE_URL}/v2/files?teamId={TEAM_ID}",
         "-H", f"Authorization: Bearer {VERCEL_TOKEN}",
         "-H", "Content-Type: application/octet-stream",
         "-H", f"x-vercel-digest: {sha}",
         "--data-binary", f"@{filepath}"],
        capture_output=True, text=True
    )
    
    if "error" in result.stdout:
        print(f"  Failed: {relpath}")
    else:
        print(f"  OK: {relpath}")
    
    return {"file": relpath, "sha": sha, "size": len(content)}

def create_deployment(files):
    manifest = [{"file": f["file"], "sha": f["sha"], "size": f["size"]} for f in files]
    
    payload = json.dumps({
        "name": "medic1905",
        "files": manifest,
        "target": "preview",
    })
    
    result = subprocess.run(
        ["curl", "-s", "-X", "POST", f"{BASE_URL}/v13/deployments",
         "-H", f"Authorization: Bearer {VERCEL_TOKEN}",
         "-H", "Content-Type: application/json",
         "-d", payload],
        capture_output=True, text=True
    )
    
    try:
        data = json.loads(result.stdout)
        if "error" in data:
            print(f"Error: {data['error']}")
        else:
            print(f"\nDeployment created!")
            print(f"  URL: https://{data.get('url', 'unknown')}")
            print(f"  State: {data.get('readyState', 'unknown')}")
    except:
        print(f"Response: {result.stdout[:500]}")

def main():
    print("Collecting files...")
    files = collect_files()
    print(f"Found {len(files)} files to upload\n")
    
    print("Uploading files...")
    uploaded = []
    for filepath, relpath in files:
        result = upload_file(filepath, relpath)
        uploaded.append(result)
    
    print(f"\nUploaded {len(uploaded)} files. Creating deployment...")
    create_deployment(uploaded)

if __name__ == "__main__":
    main()
