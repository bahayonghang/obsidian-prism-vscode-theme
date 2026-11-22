#!/usr/bin/env python3
"""Download pinned, official IDE test fixtures; inspect color contracts; never install them.

Only development/CI uses this script. Google application resources remain in an
ignored disposable cache and are not included in the extension or repository.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import tarfile
import time
import urllib.request

FIXTURES = {
    "1.23.2": {
        "url": "https://edgedl.me.gvt1.com/edgedl/release2/j0qc3/antigravity/stable/1.23.2-4781536860569600/linux-x64/Antigravity.tar.gz",
        "sha256": "5232a4048ff4fa15685d9a981ba4fba573e297f3efc9b76f638e794baf775725",
        "folder": "Antigravity",
        "executable": "antigravity",
    },
    "2.8.0": {
        "url": "https://edgedl.me.gvt1.com/edgedl/release2/j0qc3/antigravity/stable/2.8.0-6733682917113856/linux-x64/Antigravity%20IDE.tar.gz",
        "sha256": "7baa36baab285cb46101af958b8f7be6305458db9a44d8b3d0938d61f38597d7",
        "folder": "Antigravity IDE",
        "executable": "antigravity-ide",
    },
}


def sha256(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def download(url, destination):
    partial = destination.with_suffix(".part")
    try:
        with urllib.request.urlopen(url, timeout=60) as response, partial.open("wb") as output:
            count = 0
            last = time.monotonic()
            while chunk := response.read(1024 * 1024):
                output.write(chunk)
                count += len(chunk)
                if time.monotonic() - last > 15:
                    print(f"[antigravity] Downloaded {count // 1048576} MiB", flush=True)
                    last = time.monotonic()
        partial.replace(destination)
    finally:
        partial.unlink(missing_ok=True)


def require(condition, message):
    if not condition:
        raise RuntimeError(f"Antigravity source contract changed: {message}")


def inspect(app, version):
    product_path = app / "resources/app/product.json"
    product = json.loads(product_path.read_text())
    require(product.get("ideVersion") == version, "product ideVersion")
    report = {
        "scope": "Official distribution source contracts; not a signed-in chat screenshot",
        "ideVersion": version,
        "vscodeBaseVersion": product["version"],
        "productName": product["nameLong"],
        "archive": FIXTURES[version],
        "files": {"product.json": sha256(product_path)},
    }
    resources = app / "resources/app"
    if version == "1.23.2":
        css_path = resources / "out/vs/workbench/workbench.desktop.main.css"
        js_path = resources / "out/vs/workbench/workbench.desktop.main.js"
        css, js = css_path.read_text(), js_path.read_text()
        require(".antigravity-agent-side-panel" in css, "legacy sidebar selector")
        require("--ide-task-section-background: var(--vscode-sideBar-background)" in css
                or "--ide-task-section-background:var(--vscode-sideBar-background)" in css,
                "legacy conversation background")
        require(re.search(r"\.bg-input\s*\{[^}]*editor-background[^}]*90%[^}]*#6b7280\s+10%", css),
                "legacy composer mixes editor background with gray")
        require("antigravity.agentSidePanelInputBox" in js and "rounded-2xl bg-gray-500/20" in js,
                "legacy fixed-gray composer frame")
        report.update({"colorPath": "legacy", "composer": "90% editor.background + 10% #6B7280; fixed gray outer frame"})
        report["files"].update({"workbench.desktop.main.css": sha256(css_path), "workbench.desktop.main.js": sha256(js_path)})
    else:
        extension = resources / "extensions/agy"
        package = json.loads((extension / "package.json").read_text())
        require(package.get("publisher") == "google" and package.get("name") == "google-antigravity", "Google extension identity")
        require(package.get("version") == "1.12.0", "bundled Google bridge version")
        renderer_path, bridge_path = extension / "vscode/extension.js", extension / "bridge.js"
        renderer, bridge = renderer_path.read_text(), bridge_path.read_text()
        require('location:"sideBar"' in renderer, "main chat sideBar location")
        require("--vscode-agy-background: var(--vscode-${" in renderer, "location-based background alias")
        match = re.search(r'"(--vscode-editor-background[^"\n]+)"\.split\(" "\)', bridge)
        require(match is not None, "explicit color relay allowlist")
        variables = match.group(1).split()
        for name in ["agy-background", "agy-foreground", "input-background", "input-border", "input-foreground", "sideBar-background", "button-background"]:
            require(f"--vscode-{name}" in variables, f"relayed {name}")
        require(not any(name.startswith("--vscode-chat-") for name in variables), "chat.* must not be mistaken for this bridge")
        require(".setTheme({" in bridge and "new MutationObserver" in bridge, "live theme forwarding")
        require(not package.get("contributes", {}).get("colors"), "agy aliases are not contributed color IDs")
        report.update({"colorPath": "bridge", "bridgeVersion": package["version"], "relayedVariables": variables})
        report["files"].update({"agy/bridge.js": sha256(bridge_path), "agy/vscode/extension.js": sha256(renderer_path)})
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", choices=FIXTURES, required=True)
    parser.add_argument("--archive", type=Path, help="Reuse an already downloaded archive (SHA-256 still required)")
    parser.add_argument("--cache", type=Path, default=Path(".antigravity-test"))
    parser.add_argument("--github-output", type=Path)
    args = parser.parse_args()
    fixture = FIXTURES[args.version]
    cache = args.cache.resolve() / args.version
    cache.mkdir(parents=True, exist_ok=True)
    archive = args.archive.resolve() if args.archive else cache / "official-ide.tar.gz"
    if not archive.exists():
        print(f"[antigravity] Fetching official IDE {args.version}", flush=True)
        download(fixture["url"], archive)
    require(sha256(archive) == fixture["sha256"], "official archive SHA-256")
    app = cache / fixture["folder"]
    marker = cache / ".verified-archive-sha256"
    if not marker.exists() or marker.read_text().strip() != fixture["sha256"] or not (app / fixture["executable"]).is_file():
        with tarfile.open(archive) as bundle:
            bundle.extractall(cache, filter="data")
        marker.write_text(fixture["sha256"] + "\n")
    executable = app / fixture["executable"]
    require(executable.is_file() and os.access(executable, os.X_OK), "isolated IDE executable")
    report = inspect(app, args.version)
    artifacts = Path("artifacts")
    artifacts.mkdir(exist_ok=True)
    report_path = artifacts / f"antigravity-source-{args.version}.json"
    report_path.write_text(json.dumps(report, indent=2) + "\n")
    if args.github_output:
        with args.github_output.open("a") as output:
            output.write(f"executable={executable}\n")
    print(f"[antigravity] PASS {args.version} source contracts; report: {report_path}")
    print(f"[antigravity] Test executable: {executable}")


if __name__ == "__main__":
    main()
