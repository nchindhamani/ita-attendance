#!/usr/bin/env python3
"""
=============================================================================
SUPABASE KEEP-ALIVE SCRIPT
=============================================================================

WHY THIS SCRIPT EXISTS
---------------------
Supabase free-tier projects are automatically PAUSED after approximately 7 days
of database inactivity. When paused:
  - All API requests fail with "Failed to fetch" or connection errors
  - Users cannot log in or use the application
  - The project must be manually restored via the Supabase Dashboard

This script performs a minimal database query (SELECT on system_settings) to
register activity and reset the inactivity timer. Run it weekly (e.g. via cron
or GitHub Actions) to prevent the project from being paused.

SCHEDULING (run weekly)
---------------------
  Cron (macOS/Linux):
    crontab -e
    # Run every Sunday at 9:00 AM
    0 9 * * 0 /usr/bin/env python3 /path/to/scripts/supabase_keepalive.py

  GitHub Actions (if app is in a repo):
    .github/workflows/keepalive.yml - weekly workflow that runs this script
    or curls your deployed API's /api/test if it hits the database

USAGE
-----
  From project root:
    python scripts/supabase_keepalive.py

  With explicit env file:
    python scripts/supabase_keepalive.py --env .env.local

REQUIREMENTS
-----------
  - .env.local with VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
  - Python 3.7+ (uses only standard library)
=============================================================================
"""

import os
import sys
import urllib.request
import urllib.error
from pathlib import Path


def load_env_file(env_path: Path) -> None:
    """Load KEY=VALUE pairs from a .env file into os.environ."""
    if not env_path.exists():
        return
    with open(env_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key, _, value = line.partition("=")
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                if key:
                    os.environ[key] = value


def main() -> int:
    script_dir = Path(__file__).resolve().parent
    project_root = script_dir.parent

    # Parse --env argument
    env_path = project_root / ".env.local"
    if len(sys.argv) >= 3 and sys.argv[1] == "--env":
        env_path = Path(sys.argv[2])
        if not env_path.is_absolute():
            env_path = project_root / env_path

    # Load environment
    load_env_file(env_path)

    url = os.environ.get("VITE_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not url:
        print("❌ Error: VITE_SUPABASE_URL or SUPABASE_URL not found")
        print("   Set it in .env.local or pass --env path/to/.env.local")
        return 1

    if not service_key:
        print("❌ Error: SUPABASE_SERVICE_ROLE_KEY not found")
        print("   Set it in .env.local (Supabase Dashboard → Settings → API)")
        return 1

    url = url.rstrip("/")
    rest_url = f"{url}/rest/v1/system_settings?id=eq.1&select=id"

    req = urllib.request.Request(
        rest_url,
        headers={
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Accept": "application/json",
        },
        method="GET",
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            if resp.status == 200:
                print("✅ Supabase keep-alive success (database activity registered)")
                return 0
            print(f"⚠️  Unexpected status: {resp.status}")
            return 1
    except urllib.error.HTTPError as e:
        print(f"❌ HTTP error: {e.code} {e.reason}")
        if e.code == 404:
            print("   (Project may be paused - restore it in Supabase Dashboard)")
        return 1
    except urllib.error.URLError as e:
        print(f"❌ Request failed: {e.reason}")
        print("   (Project may be paused or unreachable - check Supabase Dashboard)")
        return 1
    except Exception as e:
        print(f"❌ Error: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
