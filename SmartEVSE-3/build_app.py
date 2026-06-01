# Run by platformio.ini (pre: hook) from the project's native directory.
#
# Builds the Vue web UI in app/ as one self-contained index.html and drops it
# into data/ as app.html, so packfs.py packs it into the firmware image and the
# device serves it at /app.html (alongside the legacy data/index.html).
#
# Requires Node.js + npm on PATH. Set SKIP_APP_BUILD=1 to skip the build and
# ship firmware with the legacy UI only.

import os, sys, shutil, subprocess

APP_DIR = "app"
DIST_HTML = os.path.join(APP_DIR, "dist", "index.html")
DIST_FAVICON = os.path.join(APP_DIR, "dist", "favicon.svg")
OUT_HTML = os.path.join("data", "app.html")
OUT_FAVICON = os.path.join("data", "favicon.svg")


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

    npm = shutil.which("npm") or shutil.which("npm.cmd")
    if not npm:
        sys.exit(
            "build_app.py: npm/Node.js not found on PATH. Install Node.js "
            "(https://nodejs.org) to build the web UI, or set SKIP_APP_BUILD=1 "
            "to build firmware with the legacy UI only."
        )

    # Install deps once (fresh checkout / CI); reuse on later builds.
    if not os.path.isdir(os.path.join(APP_DIR, "node_modules")):
        run(npm, "ci")
    run(npm, "run", "build:singlefile")

    if not os.path.isfile(DIST_HTML):
        sys.exit("build_app.py: expected %s after build — not found" % DIST_HTML)
    shutil.copy(DIST_HTML, OUT_HTML)
    print("build_app.py: packed web UI -> %s" % OUT_HTML)
    if os.path.isfile(DIST_FAVICON):
        shutil.copy(DIST_FAVICON, OUT_FAVICON)


main()
