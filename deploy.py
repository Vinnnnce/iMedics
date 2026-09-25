#!/usr/bin/env python3
"""Deploy Medic1905 to Vercel via the REST API."""
import os
import hashlib
import json
import requests

VERCEL_TOKEN = os.environ.get("VERCEL_TOKEN", "")
PROJECT_ID = "prj_29ChVRCuCtUx6BGskchtGrkmhoR7"
TEAM_ID = "team_xfMqpQ1z58MhNhCwp7h0Gupx"
BASE_URL = "https://api.vercel.com"

# Files to include
INCLUDE_DIRS = ["src", "prisma"]
INCLUDE_FILES = [
    "package.json", "next.config.ts", "tsconfig.json",
    "postcss.config.mjs", "README.md", ".env.example",
]
EXCLUDE_DIRS = {".next", "node_modules", ".git", ".vercel", "__pycache__"}
EXCLUDE_FILES = {".env"}

def collect_files():
    """Collect all files to upload."""
    files = []
    project_root = "/home/user/workspace/medic1905"
    
    for dir_name in INCLUDE_DIRS:
        dir_path = os.path.join(project_root, dir_name)
        if not os.path.isdir(dir_path):
            continue
        for root, dirs, filenames in os.walk(dir_path):
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
            for filename in filenames:
                if filename in EXCLUDE_FILES:
                    continue
                filepath = os.path.join(root, filename)
                relpath = os.path.relpath(filepath, project_root)
                files.append((filepath, relpath))
    
    for filename in INCLUDE_FILES:
        filepath = os.path.join(project_root, filename)
        if os.path.isfile(filepath):
            files.append((filepath, filename))
    
    return files

def upload_file(filepath, relpath):
    """Upload a single file to Vercel."""
    with open(filepath, "rb") as f:
        content = f.read()
    
    sha = hashlib.sha1(content).hexdigest()
    
    # Upload the file
    url = f"{BASE_URL}/v2/files?teamId={TEAM_ID}"
    headers = {
        "Authorization": f"Bearer {VERCEL_TOKEN}",
        "Content-Type": "application/octet-stream",
        "x-vercel-digest": sha,
    }
    resp = requests.post(url, headers=headers, data=content)
    if resp.status_code in (200, 201):
        print(f"  Uploaded: {relpath}")
    else:
        print(f"  Failed to upload {relpath}: {resp.status_code} {resp.text[:100]}")
    
    return {"file": relpath, "sha": sha, "size": len(content)}

def create_deployment(files):
    """Create a deployment with the uploaded files."""
    url = f"{BASE_URL}/v13/deployments?teamId={TEAM_ID}"
    headers = {
        "Authorization": f"Bearer {VERCEL_TOKEN}",
        "Content-Type": "application/json",
    }
    
    # Convert file list to the format expected by Vercel
    file_manifest = [{"file": f["file"], "sha": f["sha"], "size": f["size"]} for f in files]
    
    payload = {
        "projectId": PROJECT_ID,
        "files": file_manifest,
        "target": "preview",
        "projectSettings": {
            "framework": "nextjs",
            "buildCommand": "npm run build",
            "outputDirectory": ".next",
            "installCommand": "npm install",
        },
    }
    
    resp = requests.post(url, headers=headers, json=payload)
    if resp.status_code in (200, 201):
        data = resp.json()
        print(f"\nDeployment created successfully!")
        print(f"  ID: {data.get('id')}")
        print(f"  URL: https://{data.get('url')}")
        print(f"  State: {data.get('readyState')}")
        return data
    else:
        print(f"\nFailed to create deployment: {resp.status_code}")
        print(f"  Response: {resp.text[:500]}")
        return None

def main():
    print("Collecting files...")
    files_to_upload = collect_files()
    print(f"Found {len(files_to_upload)} files to upload\n")
    
    print("Uploading files...")
    uploaded = []
    for filepath, relpath in files_to_upload:
        result = upload_file(filepath, relpath)
        uploaded.append(result)
    
    print(f"\nUploaded {len(uploaded)} files. Creating deployment...")
    deployment = create_deployment(uploaded)
    
    if deployment:
        inspect_url = f"{BASE_URL}/v13/deployments/{deployment.get('id')}?teamId={TEAM_ID}"
        print(f"\nInspect URL: {inspect_url}")

if __name__ == "__main__":
    main()
