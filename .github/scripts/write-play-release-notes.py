#!/usr/bin/env python3
"""Write Play "what's new" text from the current commit subject.

Reads package.json and `git log -1`. Does not read credentials.
"""

from __future__ import annotations

import json
import os
import pathlib
import re
import subprocess
import sys

MAX_NOTE_CHARS = 500


def build_note(version: str, sha: str, subject: str) -> str:
    version = " ".join(str(version).split())
    sha = " ".join(str(sha).split())
    if not version or not sha:
        raise ValueError("version and sha are required")
    cleaned = re.sub(r"[\x00-\x1f\x7f]", " ", subject or "")
    cleaned = " ".join(cleaned.split())
    prefix = f"{version} ({sha})"
    note = f"{prefix}: {cleaned}" if cleaned else prefix
    if len(note) > MAX_NOTE_CHARS:
        note = note[:MAX_NOTE_CHARS]
    return note


def main() -> None:
    out_dir = pathlib.Path(os.environ.get("PLAY_DIR", "play"))
    notes_dir = out_dir / "whatsnew"
    notes_dir.mkdir(parents=True, exist_ok=True)

    subject = subprocess.check_output(
        ["git", "log", "-1", "--format=%s"], text=True
    )
    version = json.loads(pathlib.Path("package.json").read_text(encoding="utf-8"))["version"]
    sha = os.environ["GITHUB_SHA"][:7]
    note = build_note(str(version), sha, subject)
    (notes_dir / "whatsnew-en-US").write_text(note + "\n", encoding="utf-8")

    release_name = build_note(str(version), sha, "")
    output = os.environ.get("GITHUB_OUTPUT")
    if output:
        with open(output, "a", encoding="utf-8") as handle:
            handle.write(f"release_name={release_name}\n")
    # Prefix the log line so a commit subject cannot start a workflow command.
    print(f"Release name: {release_name}")
    print(f"Release notes: {note}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"::error title=Release notes::{exc}", file=sys.stderr)
        sys.exit(1)
