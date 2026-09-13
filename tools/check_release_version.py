"""Validate plugin manifest version against release branch names."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

RELEASE_BRANCH_RE = re.compile(r"^release/v(?P<version>\d+\.\d+\.\d+)$")
RELEASE_BRANCH_PREFIX = "release/"


def main() -> None:
    """Validate version consistency."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--branch", default="", help="Git branch name to validate")
    parser.add_argument(
        "--manifest", required=True, type=Path, help="Path to manifest.json"
    )
    args = parser.parse_args()

    branch_version = _release_branch_version(args.branch)
    if branch_version is None:
        if args.branch.startswith(RELEASE_BRANCH_PREFIX):
            message = (
                "Invalid release branch name:\n"
                f"branch:   {args.branch}\n"
                "expected: release/v<major>.<minor>.<patch>"
            )
            raise SystemExit(message)
        return

    manifest_version = _manifest_version(args.manifest)

    errors: list[str] = []
    if manifest_version != branch_version:
        errors.append(
            f"release branch version ({branch_version}) does not match "
            f"manifest.json version ({manifest_version})"
        )

    if errors:
        details = [
            "Release version mismatch:",
            f"branch:     {args.branch or '<none>'}",
            f"expected:   {branch_version}",
            f"manifest:   {manifest_version}",
            *(f"- {error}" for error in errors),
        ]
        raise SystemExit("\n".join(details))


def _manifest_version(path: Path) -> str:
    return str(json.loads(path.read_text(encoding="utf-8"))["version"])


def _release_branch_version(branch: str) -> str | None:
    match = RELEASE_BRANCH_RE.fullmatch(branch)
    if match is None:
        return None
    return match.group("version")


if __name__ == "__main__":
    raise SystemExit(main())
