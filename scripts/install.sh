#!/bin/sh
# AgenticAle convenience installer for POSIX systems (Linux, macOS, WSL).
#
# Resolves the latest stable release tag (or a pinned --version TAG), downloads
# that release's source archive, extracts it to a temporary directory, and
# delegates ALL install semantics to scripts/install.mjs from the extracted
# release. It never launches any AI session, never changes the caller's
# working directory, and cleans up its temporary directory on every exit path.
#
# Typical use (download, then run so options are visible):
#   curl -fsSL -o install.sh https://raw.githubusercontent.com/alefranz/AgenticAle/main/scripts/install.sh
#   sh install.sh --dry-run
#
# POSIX sh on purpose (must run under dash): no arrays, no bashisms. The
# installer argv is rebuilt as discrete quoted words, so paths with spaces
# survive as single arguments.

default_base_url="https://github.com/alefranz/AgenticAle"

usage() {
  cat <<'EOF'
Usage:
  sh scripts/install.sh [options]

Downloads the latest stable AgenticAle release (or a pinned --version TAG),
extracts it to a temporary directory, and runs scripts/install.mjs from the
extracted release to install the generated OpenCode bundle. All install
options are forwarded to the installer verbatim. No AI session is launched,
and the caller's working directory is never changed.

Wrapper options:
  --version TAG     Install this release tag instead of resolving the latest.
                    The tag is used verbatim: a leading "v" is part of the tag
                    when the release is tagged that way.
  --base-url URL    Repository base for release resolution and download
                    (default: https://github.com/alefranz/AgenticAle; the
                    AGENTICALE_BASE_URL environment variable is also honored,
                    with --base-url taking precedence). Useful for mirrors.
  --setup           Also create the personal routing customization file
                    (~/.agenticale/routing.md) after a successful install.
                    Skipped with --dry-run.
  --help, -h        Show this help.

Forwarded installer options (see: node scripts/install.mjs --help):
  --models PATH|PRESET  --effort LEVEL  --source-root PATH  --routing PATH
  --target PATH  --replace  --no-model  --dry-run

If no routing selection (--models, --routing, or --no-model) is given, the
wrapper appends --no-model so every role inherits the session model and
effort.

After a successful non-dry-run install the wrapper offers the consented setup
step (create ~/.agenticale/routing.md as a minimal scaffold only if absent):
with --setup it runs unconditionally; on a terminal without --setup it asks
"Create a personal routing customization file (~/.agenticale/routing.md)?
[y/N]" (default no); non-interactive runs skip it and print a tip. The
AGENTICALE_INSTALL_CONSENT=yes|no environment variable replaces the
interactive answer where the prompt would occur (a documented testing seam).
The install is never undone by a setup failure; the wrapper exits with the
setup subcommand's exit code in that case.

Exit codes: the installer's exit code is propagated. If the install succeeds
and the setup step runs, the setup exit code is propagated when it is
non-zero.
EOF
}

fail() {
  printf 'Error: %s\n' "$1" >&2
  printf 'Run with --help for usage.\n' >&2
  exit 1
}

# --- Parse wrapper options -------------------------------------------------

base_url="${AGENTICALE_BASE_URL:-$default_base_url}"
version=""
version_given=0
models=""
models_given=0
effort=""
effort_given=0
source_root=""
source_root_given=0
routing=""
routing_given=0
target=""
target_given=0
replace=0
no_model=0
dry_run=0
setup=0

while [ $# -gt 0 ]; do
  arg="$1"
  case "$arg" in
    --help|-h)
      usage
      exit 0
      ;;
    --version)
      [ $# -ge 2 ] || fail "--version requires a release tag."
      version="$2"
      version_given=1
      shift 2
      ;;
    --version=*)
      version="${arg#--version=}"
      [ -n "$version" ] || fail "--version requires a release tag."
      version_given=1
      shift
      ;;
    --base-url)
      [ $# -ge 2 ] || fail "--base-url requires a URL."
      base_url="$2"
      shift 2
      ;;
    --base-url=*)
      base_url="${arg#--base-url=}"
      [ -n "$base_url" ] || fail "--base-url requires a URL."
      shift
      ;;
    --models)
      [ $# -ge 2 ] || fail "--models requires a path or preset."
      models="$2"
      models_given=1
      shift 2
      ;;
    --models=*)
      models="${arg#--models=}"
      models_given=1
      shift
      ;;
    --effort)
      [ $# -ge 2 ] || fail "--effort requires a level."
      effort="$2"
      effort_given=1
      shift 2
      ;;
    --effort=*)
      effort="${arg#--effort=}"
      effort_given=1
      shift
      ;;
    --source-root)
      [ $# -ge 2 ] || fail "--source-root requires a path."
      source_root="$2"
      source_root_given=1
      shift 2
      ;;
    --source-root=*)
      source_root="${arg#--source-root=}"
      source_root_given=1
      shift
      ;;
    --routing)
      [ $# -ge 2 ] || fail "--routing requires a path."
      routing="$2"
      routing_given=1
      shift 2
      ;;
    --routing=*)
      routing="${arg#--routing=}"
      routing_given=1
      shift
      ;;
    --target)
      [ $# -ge 2 ] || fail "--target requires a path."
      target="$2"
      target_given=1
      shift 2
      ;;
    --target=*)
      target="${arg#--target=}"
      target_given=1
      shift
      ;;
    --replace)
      replace=1
      shift
      ;;
    --no-model)
      no_model=1
      shift
      ;;
    --dry-run)
      dry_run=1
      shift
      ;;
    --setup)
      setup=1
      shift
      ;;
    -*)
      fail "Unknown option '$arg'."
      ;;
    *)
      fail "Unexpected argument '$arg'."
      ;;
  esac
done

# A trailing slash would double up in the resolved URLs.
base_url="${base_url%/}"

# --- Prerequisites ---------------------------------------------------------
# Checked before any external tool (mktemp, curl, tar) is needed, so a missing
# Node on the PATH yields a clear, actionable error.

check_prerequisites() {
  node_cmd="$(command -v node)" || fail "Node.js is required, but no node executable was found on the PATH. Install Node.js 20 or later from https://nodejs.org and retry."
  node_version="$("$node_cmd" --version 2>/dev/null)" || fail "Could not determine the Node.js version. Node.js 20 or later is required (https://nodejs.org)."
  case "$node_version" in
    v[0-9]*) ;;
    *) fail "Unrecognized Node.js version '$node_version'. Node.js 20 or later is required (https://nodejs.org)." ;;
  esac
  node_major="${node_version#v}"
  node_major="${node_major%%.*}"
  case "$node_major" in
    ''|*[!0-9]*) fail "Unrecognized Node.js version '$node_version'. Node.js 20 or later is required (https://nodejs.org)." ;;
  esac
  [ "$node_major" -ge 20 ] || fail "Node.js 20 or later is required (found $node_version). Install a newer Node.js from https://nodejs.org and retry."
  command -v curl >/dev/null 2>&1 || fail "curl is required to download the release archive. Install curl and retry."
  command -v tar >/dev/null 2>&1 || fail "tar is required to extract the release archive. Install tar and retry."
}
check_prerequisites

# --- Resolve the release tag ------------------------------------------------

# Follow the /releases/latest redirect to /releases/tag/<tag> and read the
# final URL. No JSON parsing involved; the base-url seam lets a local fixture
# emulate the GitHub surface. Before any download, the redirect target is
# validated: it must be exactly <base>/releases/tag/<tag> (same host as the
# base, the tag page for this repository) and <tag> must be version-like, so
# a redirect to an unrelated URL (e.g. a login page) or a missing redirect
# fails here instead of being "installed". A release tag is version-like: it
# starts with a digit, or with v/V directly followed by a digit, and contains
# only alphanumerics plus dot, underscore, plus, or hyphen (v9.9.9, 1.2.3,
# v1.0.0-rc.1). Prints the tag on success; non-zero on failure.
resolve_latest_tag() {
  rl_url="$(curl -sIL --max-time 60 -o /dev/null -w '%{url_effective}' "$1/releases/latest" 2>/dev/null)" || return 1
  case "$rl_url" in
    http://*|https://*) ;;
    *) return 1 ;;
  esac
  # A query string or fragment is not part of the path that must match.
  rl_url="${rl_url%%\?*}"
  rl_url="${rl_url%%#*}"
  # The redirect must land exactly on this base's releases tag page: the
  # entire suffix after the tag prefix must itself be the tag, with no
  # further /-separated path segments after it (a nested path such as
  # /releases/tag/unrelated/v9.9.9 is not a tag page and must not resolve).
  case "$rl_url" in
    "$1/releases/tag/"*) ;;
    *) return 1 ;;
  esac
  rl_tag="${rl_url#"$1/releases/tag/"}"
  case "$rl_tag" in
    */*) return 1 ;;
  esac
  case "$rl_tag" in
    [0-9]*|[vV][0-9]*) ;;
    *) return 1 ;;
  esac
  case "$rl_tag" in
    *[!A-Za-z0-9._+-]*) return 1 ;;
  esac
  printf '%s\n' "$rl_tag"
}

if [ "$version_given" -eq 1 ]; then
  # The pin is used verbatim as the release tag (a leading "v" is part of the
  # tag when the release is tagged that way); a pin that matches no tag fails
  # at download time with a clear error.
  tag="$version"
  echo "AgenticAle $tag (pinned release)"
else
  tag="$(resolve_latest_tag "$base_url")" || fail "Could not resolve the latest release from ${base_url}/releases/latest. Pin an exact tag with --version TAG, or check the --base-url setting."
  echo "AgenticAle $tag (latest release)"
fi

# --- Temp directory and cleanup ---------------------------------------------

tmp_dir=""
install_pid=""
cleanup() {
  # A Ctrl-C during a child run must not leave the installer behind.
  if [ -n "$install_pid" ] && kill -0 "$install_pid" 2>/dev/null; then
    kill "$install_pid" 2>/dev/null
  fi
  if [ -n "$tmp_dir" ]; then
    rm -rf -- "$tmp_dir" 2>/dev/null
  fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

tmp_dir="$(mktemp -d "${TMPDIR:-/tmp}/agenticale-install.XXXXXX")" || fail "Could not create a temporary directory."

# --- Download and verify the release archive --------------------------------

archive="$tmp_dir/release.tar.gz"
archive_url="$base_url/archive/refs/tags/$tag.tar.gz"
echo "Downloading $archive_url"
# -f makes HTTP error statuses fail instead of saving an error page; -sS
# keeps the progress meter off but still shows errors; the tar -tzf pass
# below is a second guard against a non-tarball body.
curl -fsSL --retry 3 --max-time 600 -o "$archive" "$archive_url" || fail "Failed to download $archive_url. Check your network connection, or pin an exact release with --version TAG."
[ -s "$archive" ] || fail "The download from $archive_url is empty; the release archive may be missing."
tar -tzf "$archive" >/dev/null 2>&1 || fail "The download from $archive_url is not a readable gzip tarball. It may be an error page; check that '$tag' is a valid release tag."

echo "Extracting release archive"
tar -xzf "$archive" -C "$tmp_dir" || fail "Failed to extract the release archive."

# Locate the single top-level AgenticAle-<tag> directory. The archive file
# itself lives in the temp dir, so it is excluded from the layout check.
top_dir=""
top_count=0
for entry in "$tmp_dir"/*; do
  [ -e "$entry" ] || continue
  [ "$entry" = "$archive" ] && continue
  top_count=$((top_count + 1))
  top_dir="$entry"
done
[ "$top_count" -eq 1 ] || fail "Unexpected archive layout: expected a single top-level directory, found $top_count."
[ -d "$top_dir" ] || fail "Unexpected archive layout: the top-level entry is not a directory."
top_name="${top_dir##*/}"
case "$top_name" in
  AgenticAle-*) ;;
  *) fail "Unexpected archive layout: top-level directory '$top_name' is not an AgenticAle release (expected AgenticAle-<tag>)." ;;
esac
installer="$top_dir/scripts/install.mjs"
[ -f "$installer" ] || fail "The release archive does not contain scripts/install.mjs; the tag may not be a real AgenticAle release."

# --- Build the installer argv ------------------------------------------------
# POSIX sh has no arrays; the argv is rebuilt as discrete quoted words from the
# parsed options, in a fixed order, so values containing spaces survive as
# single words.
set -- "$node_cmd" "$installer"
if [ "$models_given" -eq 1 ]; then set -- "$@" "--models" "$models"; fi
if [ "$effort_given" -eq 1 ]; then set -- "$@" "--effort" "$effort"; fi
if [ "$source_root_given" -eq 1 ]; then set -- "$@" "--source-root" "$source_root"; fi
if [ "$routing_given" -eq 1 ]; then set -- "$@" "--routing" "$routing"; fi
if [ "$target_given" -eq 1 ]; then set -- "$@" "--target" "$target"; fi
if [ "$replace" -eq 1 ]; then set -- "$@" "--replace"; fi
if [ "$no_model" -eq 1 ]; then set -- "$@" "--no-model"; fi
if [ "$dry_run" -eq 1 ]; then set -- "$@" "--dry-run"; fi
# Default routing selection: with no --models, --routing, or --no-model given,
# append --no-model so every role inherits the session model and effort.
if [ "$models_given" -eq 0 ] && [ "$routing_given" -eq 0 ] && [ "$no_model" -eq 0 ]; then
  set -- "$@" "--no-model"
fi

# --- Run the installer --------------------------------------------------------
# Backgrounded so a trapped signal can kill the child during cleanup.

echo "Running installer"
"$@" &
install_pid=$!
wait "$install_pid"
install_status=$?
install_pid=""

# --- Consent-gated setup step --------------------------------------------------
# Runs only after a successful non-dry-run install. The entire consent decision
# — including the interactive prompt — is gated on the install having succeeded:
# a failing install goes straight to propagating the installer's exit code and
# must never reach the prompt, which would wait for input on a terminal instead
# of returning the failure promptly. A setup failure does not undo the install;
# it is reported and its exit code becomes the wrapper's.

run_setup=0
hint_setup=0
if [ "$install_status" -eq 0 ]; then
  if [ "$setup" -eq 1 ] && [ "$dry_run" -eq 0 ]; then
    run_setup=1
  elif [ "$dry_run" -eq 0 ]; then
    if [ -t 0 ] && [ -t 1 ]; then
      # On a terminal, ask. AGENTICALE_INSTALL_CONSENT (yes|no) is a documented
      # testing seam: when set, it replaces the interactive answer here, and is
      # consulted nowhere else.
      consent="${AGENTICALE_INSTALL_CONSENT:-}"
      case "$consent" in
        [Yy][Ee][Ss])
          run_setup=1
          ;;
        [Nn][Oo])
          run_setup=0
          ;;
        *)
          printf 'Create a personal routing customization file (~/.agenticale/routing.md)? [y/N] '
          answer=""
          read -r answer || answer=""
          case "$answer" in
            [Yy]|[Yy][Ee][Ss]) run_setup=1 ;;
          esac
          ;;
      esac
    else
      # Non-interactive: skip silently; a one-line tip is printed on success.
      hint_setup=1
    fi
  fi
fi

status="$install_status"
if [ "$status" -eq 0 ] && [ "$run_setup" -eq 1 ]; then
  echo "Creating the personal routing customization file"
  # Forward an explicit --target so the setup guidance points at the packaged
  # example under the target the install used; with no --target, pass nothing
  # and setup resolves the same default. Same discrete-word rebuilding as the
  # installer argv above, so a spaced path survives as one argument.
  set -- "$node_cmd" "$installer" setup
  if [ "$target_given" -eq 1 ]; then set -- "$@" "--target" "$target"; fi
  "$@" &
  install_pid=$!
  wait "$install_pid"
  setup_status=$?
  install_pid=""
  if [ "$setup_status" -ne 0 ]; then
    printf 'Error: the install succeeded, but the routing setup step failed (exit %s). The install is intact; re-run the setup step manually if needed.\n' "$setup_status" >&2
    status="$setup_status"
  fi
fi
if [ "$status" -eq 0 ] && [ "$hint_setup" -eq 1 ]; then
  echo "Tip: run with --setup to also create the personal routing customization file (~/.agenticale/routing.md)."
fi

exit "$status"
