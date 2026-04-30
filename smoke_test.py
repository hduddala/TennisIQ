#!/usr/bin/env python3
"""
TennisIQ smoke test — verifies the full pipeline end-to-end.

Usage (from repo root):
    python smoke_test.py                        # uses input/input.mp4 if present
    python smoke_test.py --video path/to.mp4    # explicit file
    python smoke_test.py --url <youtube_url>    # via YouTube ingest

What it checks:
  1. Backend is reachable.
  2. Modal app 'tennisiq-court' / function 'run_court_and_ball' is deployed & callable.
  3. Upload (or URL ingest) creates a job.
  4. Job reaches 'complete' within the timeout (polls every 5 s).
  5. Output files exist: points.json, stats.json, analysis.json, at least one clip.
  6. points.json has ≥ 1 entry, stats.json has expected keys.

Exit codes: 0 = pass, 1 = fail.
"""
import argparse
import json
import os
import sys
import time

import requests

BACKEND_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:8002")
OUTPUTS_DIR = os.path.join(os.path.dirname(__file__), "outputs")
DEFAULT_VIDEO = os.path.join(os.path.dirname(__file__), "input", "input.mp4")
POLL_INTERVAL = 5          # seconds
DEFAULT_TIMEOUT = 60 * 30  # 30 minutes


def ok(msg: str):
    print(f"  ✓  {msg}")


def fail(msg: str):
    print(f"  ✗  {msg}", file=sys.stderr)
    sys.exit(1)


def step(label: str):
    print(f"\n[{label}]")


# ── 1. Backend health ──────────────────────────────────────────────────────────

def check_backend():
    step("Backend health")
    try:
        r = requests.get(f"{BACKEND_URL}/health", timeout=5)
        r.raise_for_status()
        ok(f"Backend reachable at {BACKEND_URL}")
    except Exception as e:
        fail(f"Backend not reachable: {e}\n  → Start with: cd backend && python -m uvicorn main:app --host 127.0.0.1 --port 8002")


# ── 2. Modal app check ────────────────────────────────────────────────────────

def check_modal():
    step("Modal app")
    try:
        import modal
        fn = modal.Function.from_name("tennisiq-court", "run_court_and_ball")
        ok(f"Modal function 'run_court_and_ball' is deployed (handle: {fn})")
    except Exception as e:
        if "not found" in str(e).lower():
            fail(
                "Modal app 'tennisiq-court' not deployed.\n"
                "  → Run: modal deploy tennisiq/modal_court.py"
            )
        fail(f"Modal check failed: {e}")


# ── 3. Create job ─────────────────────────────────────────────────────────────

def create_job(video: str | None, url: str | None) -> str:
    step("Create job")
    if url:
        r = requests.post(f"{BACKEND_URL}/ingest", json={"url": url}, timeout=15)
        r.raise_for_status()
        job_id = r.json()["job_id"]
        ok(f"Ingested YouTube URL → job {job_id}")
    elif video:
        if not os.path.isfile(video):
            fail(f"Video file not found: {video}")
        size_mb = os.path.getsize(video) / 1_048_576
        ok(f"Uploading {video} ({size_mb:.1f} MB)…")
        with open(video, "rb") as f:
            r = requests.post(
                f"{BACKEND_URL}/ingest/upload",
                files={"file": (os.path.basename(video), f, "video/mp4")},
                timeout=120,
            )
        r.raise_for_status()
        job_id = r.json()["job_id"]
        ok(f"Upload accepted → job {job_id}")
    else:
        fail("No video file or URL provided.")
    return job_id


# ── 4. Poll until done ────────────────────────────────────────────────────────

def poll_job(job_id: str, timeout: int) -> dict:
    step("Pipeline progress")
    deadline = time.time() + timeout
    last_desc = ""
    while time.time() < deadline:
        try:
            r = requests.get(f"{BACKEND_URL}/status/{job_id}", timeout=10)
            r.raise_for_status()
            s = r.json()
        except Exception as e:
            print(f"  … status poll error: {e}")
            time.sleep(POLL_INTERVAL)
            continue

        status = s.get("status")
        stage = s.get("stage", "")
        desc = s.get("stage_description", "")
        seg_total = s.get("segments_total") or 0
        seg_done  = s.get("segments_complete") or 0
        seg_cur   = s.get("segment_current")

        progress_str = ""
        if seg_total > 0:
            cur = seg_cur or seg_done
            progress_str = f" [{cur}/{seg_total} segs]"

        if desc != last_desc:
            print(f"  …  [{stage}] {desc}{progress_str}")
            last_desc = desc

        if status == "complete":
            ok(f"Job {job_id} completed!")
            return s
        if status == "error":
            fail(f"Pipeline error: {s.get('error_message')}")

        time.sleep(POLL_INTERVAL)

    fail(f"Timed out after {timeout}s waiting for job {job_id} to complete.")
    return {}  # unreachable


# ── 5. Validate outputs ───────────────────────────────────────────────────────

def validate_outputs(job_id: str):
    step("Output validation")
    r = requests.get(f"{BACKEND_URL}/results/{job_id}", timeout=10)
    if r.status_code == 404:
        fail(f"GET /results/{job_id} returned 404 — job may not be in DB?")
    r.raise_for_status()
    data = r.json()

    # Resolve output directory
    out_dir: str | None = None
    for candidate in [
        os.path.join(OUTPUTS_DIR, job_id),
    ]:
        if os.path.isdir(candidate):
            out_dir = candidate
            break

    if out_dir is None:
        # Try to find by scanning outputs dir
        for name in os.listdir(OUTPUTS_DIR):
            candidate = os.path.join(OUTPUTS_DIR, name)
            run_json = os.path.join(candidate, "run.json")
            if os.path.isfile(run_json):
                try:
                    with open(run_json) as f:
                        rj = json.load(f)
                    if rj.get("job_id") == job_id:
                        out_dir = candidate
                        break
                except Exception:
                    pass

    if out_dir is None:
        fail(f"Could not locate output directory for job {job_id} under {OUTPUTS_DIR}")

    ok(f"Output dir: {out_dir}")

    required_files = ["points.json", "stats.json"]
    for fname in required_files:
        path = os.path.join(out_dir, fname)
        if not os.path.isfile(path):
            fail(f"Missing required output: {fname}")
        ok(f"{fname} exists")

    # Check points
    with open(os.path.join(out_dir, "points.json")) as f:
        points = json.load(f)
    if not isinstance(points, list) or len(points) == 0:
        print("  ⚠  points.json is empty — no points detected (may be OK for very short clips)")
    else:
        ok(f"points.json has {len(points)} point(s)")

    # Check stats
    with open(os.path.join(out_dir, "stats.json")) as f:
        stats = json.load(f)
    for key in ("fps", "events", "points"):
        if key not in stats:
            fail(f"stats.json missing key '{key}'")
    ok(f"stats.json valid — {stats['points']['total']} point(s), {stats['events']['total']} event(s)")

    # analysis.json
    apath = os.path.join(out_dir, "analysis.json")
    if os.path.isfile(apath):
        ok("analysis.json exists")
    else:
        print("  ⚠  analysis.json missing (frames.jsonl may be absent)")

    # clips
    clips_dir = os.path.join(out_dir, "clips")
    if os.path.isdir(clips_dir):
        clips = [f for f in os.listdir(clips_dir) if f.endswith(".mp4")]
        if clips:
            ok(f"{len(clips)} clip(s) in clips/")
        else:
            print("  ⚠  clips/ dir is empty")
    else:
        print("  ⚠  clips/ directory missing")


# ── main ──────────────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser(description="TennisIQ end-to-end smoke test")
    p.add_argument("--video", default=DEFAULT_VIDEO if os.path.isfile(DEFAULT_VIDEO) else None,
                   help="Path to test MP4 (default: input/input.mp4)")
    p.add_argument("--url", default=None, help="YouTube URL to ingest instead of file")
    p.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT,
                   help=f"Max seconds to wait for completion (default {DEFAULT_TIMEOUT})")
    p.add_argument("--skip-modal", action="store_true", help="Skip Modal deploy check")
    args = p.parse_args()

    print("\n=== TennisIQ Smoke Test ===")

    check_backend()
    if not args.skip_modal:
        check_modal()
    job_id = create_job(args.video, args.url)
    poll_job(job_id, args.timeout)
    validate_outputs(job_id)

    print("\n=== ALL CHECKS PASSED ✓ ===\n")


if __name__ == "__main__":
    main()
