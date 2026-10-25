"""Restore a paused (INACTIVE) Supabase project linked in .env.local."""
from __future__ import annotations

import json
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENV_LOCAL = ROOT / ".env.local"
API = "https://api.supabase.com"
POLL_INTERVAL_SEC = 10
POLL_MAX = 40


def fail(msg: str) -> None:
    print(f"\n[supabase:restore] {msg}\n", file=sys.stderr)
    sys.exit(1)


def project_ref_from_env() -> str:
    if not ENV_LOCAL.is_file():
        fail("Missing .env.local — copy .env.example first.")
    for line in ENV_LOCAL.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith("VITE_SUPABASE_URL="):
            url = line.split("=", 1)[1].strip().strip("\"'")
            host = url.replace("https://", "").replace("http://", "").split("/")[0]
            ref = host.split(".")[0]
            if ref:
                return ref
    fail("VITE_SUPABASE_URL not found in .env.local.")


def access_token() -> str:
    try:
        import keyring
    except ImportError:
        fail("Install keyring: pip install keyring")

    raw = keyring.get_password("Supabase CLI:supabase", "supabase")
    if not raw:
        fail("No Supabase CLI token. Run: supabase login")

    # Windows Credential Manager stores CLI tokens as UTF-16 code units.
    return b"".join(
        ((ord(c) & 0xFF).to_bytes(1, "little") + (ord(c) >> 8).to_bytes(1, "little"))
        for c in raw
    ).decode("ascii")


def api(method: str, path: str, token: str, body: bytes | None = None) -> tuple[int, str]:
    req = urllib.request.Request(
        f"{API}{path}",
        method=method,
        data=body,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "ZongoSupabaseRestore/1.0",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return resp.status, resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as err:
        return err.code, err.read().decode("utf-8", errors="replace")


def curl_post_restore(ref: str, token: str) -> int:
    proc = subprocess.run(
        [
            "curl.exe",
            "-s",
            "-o",
            "NUL",
            "-w",
            "%{http_code}",
            "-X",
            "POST",
            f"{API}/v1/projects/{ref}/restore",
            "-H",
            f"Authorization: Bearer {token}",
            "-H",
            "Content-Type: application/json",
            "-d",
            "{}",
            "-A",
            "SupabaseCLI/2.84.2",
        ],
        capture_output=True,
        text=True,
        cwd=ROOT,
    )
    code = proc.stdout.strip()
    return int(code) if code.isdigit() else 0


def main() -> None:
    ref = project_ref_from_env()
    token = access_token()

    status_code, body = api("GET", f"/v1/projects/{ref}", token)
    if status_code == 403 and "1010" in body:
        # urllib is blocked by Cloudflare; use curl for management API.
        list_proc = subprocess.run(
            ["supabase", "projects", "list", "-o", "json"],
            capture_output=True,
            text=True,
            cwd=ROOT,
        )
        if list_proc.returncode != 0:
            fail("Could not read project status via Supabase CLI.")
        projects = json.loads(list_proc.stdout)
        match = next((p for p in projects if p.get("ref") == ref), None)
        if not match:
            fail(f"Project {ref} not found in your Supabase account.")
        status = match.get("status", "UNKNOWN")
    elif status_code != 200:
        fail(f"Could not fetch project status (HTTP {status_code}).")
    else:
        status = json.loads(body).get("status", "UNKNOWN")

    print(f"[supabase:restore] Project {ref} status: {status}")

    if status == "ACTIVE_HEALTHY":
        print("[supabase:restore] Already active — nothing to do.")
        return

    if status not in ("INACTIVE", "PAUSED"):
        if status in ("COMING_UP", "RESTORING"):
            print("[supabase:restore] Restore already in progress.")
        else:
            fail(f"Unexpected status '{status}'. Restore from https://supabase.com/dashboard/project/{ref}")

    print("[supabase:restore] Starting restore…")
    http = curl_post_restore(ref, token)
    if http not in (200, 201):
        fail(f"Restore request failed (HTTP {http}). Open the dashboard to restore manually.")

    for i in range(POLL_MAX):
        list_proc = subprocess.run(
            ["supabase", "projects", "list", "-o", "json"],
            capture_output=True,
            text=True,
            cwd=ROOT,
        )
        projects = json.loads(list_proc.stdout)
        status = next((p.get("status") for p in projects if p.get("ref") == ref), "UNKNOWN")
        print(f"[supabase:restore] Waiting… ({i + 1}/{POLL_MAX}) status={status}")
        if status == "ACTIVE_HEALTHY":
            print("[supabase:restore] Project is active. Restart `npm run dev` and try login again.")
            return
        time.sleep(POLL_INTERVAL_SEC)

    fail("Timed out waiting for project to become active. Check the Supabase dashboard.")


if __name__ == "__main__":
    main()
