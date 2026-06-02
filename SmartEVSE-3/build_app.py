# Run by platformio.ini (pre: hook) from the project's native directory.
#
# Builds the Vue web UI in app/ as one self-contained index.html and drops it
# into data/ as app.html, so packfs.py packs it into the firmware image and the
# device serves it at /app.html (alongside the legacy data/index.html).
#
# Incremental by default: the npm build only runs when the app sources changed
# since the last pack (a content hash is stored in app/.app_build_stamp). A
# clean firmware build is therefore not slowed down by an unchanged UI.
#
# Flags (env vars on the pio run):
#   FORCE_APP_BUILD=1  rebuild even when the sources look unchanged
#   SKIP_APP_BUILD=1   skip the build entirely (ship the legacy UI only)
#
# If a build is needed but Node.js/npm aren't on PATH, it's skipped with a
# warning rather than failing — building the firmware never requires Node.

import os, sys, shutil, subprocess, hashlib

APP_DIR = "app"
DIST_HTML = os.path.join(APP_DIR, "dist", "index.html")
OUT_HTML = os.path.join("data", "app.html")
STAMP = os.path.join(APP_DIR, ".app_build_stamp")

# Static sidecar assets emitted alongside index.html (from app/public/): the PWA
# manifest, service worker and home-screen icons. Copied verbatim into data/ so
# the device serves them next to /app.html; packfs.py gzips and packs them, and
# Mongoose maps their extensions to the right MIME types (.json, .js, .png).
# (favicon.ico is already a tracked data/ asset — the device's own plug icon —
# so it isn't copied here; the app just reuses it.)
SIDECARS = [
    "manifest.json",
    "app-sw.js",
    "apple-touch-icon.png",
    "pwa-192.png",
    "pwa-512.png",
]

# Inputs that determine the built bundle. Docs, mock, .env and node_modules are
# excluded so editing them doesn't trigger a rebuild.
SRC_INPUTS = [
    os.path.join(APP_DIR, "src"),
    os.path.join(APP_DIR, "public"),
    os.path.join(APP_DIR, "index.html"),
    os.path.join(APP_DIR, "vite.config.ts"),
    os.path.join(APP_DIR, "tsconfig.json"),
    os.path.join(APP_DIR, "package.json"),
    os.path.join(APP_DIR, "package-lock.json"),
    os.path.join(APP_DIR, "env.d.ts"),
]


def source_hash():
    files = []
    for inp in SRC_INPUTS:
        if os.path.isdir(inp):
            for root, _dirs, names in os.walk(inp):
                files.extend(os.path.join(root, n) for n in names)
        elif os.path.isfile(inp):
            files.append(inp)
    h = hashlib.sha256()
    for path in sorted(files):
        h.update(path.replace(os.sep, "/").encode())
        h.update(b"\0")
        with open(path, "rb") as f:
            h.update(f.read())
        h.update(b"\0")
    return h.hexdigest()


def read_stamp():
    try:
        with open(STAMP) as f:
            return f.read().strip()
    except OSError:
        return None


def run(npm, *args):
    print("build_app.py: running", npm, *args, "in", APP_DIR + "/")
    try:
        subprocess.run([npm, *args], cwd=APP_DIR, check=True)
    except subprocess.CalledProcessError as e:
        sys.exit("build_app.py: command failed (%d): %s %s" % (e.returncode, npm, " ".join(args)))


def main():
    # Skip paths return (not sys.exit) so the rest of the PlatformIO build runs.
    if os.environ.get("SKIP_APP_BUILD"):
        print("build_app.py: SKIP_APP_BUILD set — skipping web UI build (legacy UI only)")
        return
    if not os.path.isdir(APP_DIR):
        print("build_app.py: '%s/' not found — skipping web UI build" % APP_DIR)
        return

    current = source_hash()
    if not os.environ.get("FORCE_APP_BUILD") and os.path.isfile(OUT_HTML) and read_stamp() == current:
        print("build_app.py: web UI unchanged — skipping (FORCE_APP_BUILD=1 to rebuild)")
        return

    npm = shutil.which("npm") or shutil.which("npm.cmd")
    if not npm:
        # No toolchain — don't block the firmware build. Ship whatever UI is
        # already packed (the legacy data/index.html at minimum).
        print(
            "build_app.py: npm/Node.js not found — skipping web UI build. "
            "Install Node.js to include the new UI (or set SKIP_APP_BUILD=1 to silence)."
        )
        return

    # Install deps once (fresh checkout / CI); reuse on later builds.
    if not os.path.isdir(os.path.join(APP_DIR, "node_modules")):
        run(npm, "ci")
    run(npm, "run", "build:singlefile")

    if not os.path.isfile(DIST_HTML):
        sys.exit("build_app.py: expected %s after build — not found" % DIST_HTML)
    shutil.copy(DIST_HTML, OUT_HTML)
    for name in SIDECARS:
        src = os.path.join(APP_DIR, "dist", name)
        if os.path.isfile(src):
            shutil.copy(src, os.path.join("data", name))
    with open(STAMP, "w") as f:
        f.write(current)
    print("build_app.py: packed web UI -> %s" % OUT_HTML)


main()
