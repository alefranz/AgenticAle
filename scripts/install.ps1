# AgenticAle convenience installer for Windows (Windows PowerShell 5.1;
# pwsh 7 also works).
#
# Resolves the latest stable release tag (or a pinned --version TAG), downloads
# that release's source archive, extracts it to a temporary directory, and
# delegates ALL install semantics to scripts/install.mjs from the extracted
# release. It never launches any AI session, never changes the caller's
# working directory, and cleans up its temporary directory on every exit path.
#
# Typical use (download, then run so options are visible):
#   powershell -NoProfile -Command "Invoke-WebRequest -Uri https://raw.githubusercontent.com/alefranz/AgenticAle/main/scripts/install.ps1 -OutFile install.ps1"
#   powershell -ExecutionPolicy Bypass -File install.ps1 --dry-run
#
# Written for Windows PowerShell 5.1: no here-strings, no && or || statement
# operators, no ternary or ??, and no param() at script level (all arguments
# are parsed from $args). curl.exe and tar are invoked directly, never the
# curl alias (which in Windows PowerShell is Invoke-WebRequest). The
# installer argv is built as a discrete array of strings, so values
# containing spaces survive as single arguments.

# $ErrorActionPreference 'Stop' makes cmdlet failures terminating, so an
# unexpected cmdlet failure cannot be silently swallowed.
#
# Note for the native calls below: in Windows PowerShell 5.1 a native
# command's stderr is NOT an OS-level stream that 2>$null redirects away.
# Each stderr line is converted into an error record on PowerShell's error
# stream, and under 'Stop' that record terminates the script BEFORE the
# $LASTEXITCODE check runs - even when the command itself exited 0 (a
# progress or warning line on stderr is enough). So every result-bearing
# native call runs under a scoped error policy: save the previous
# preference, set 'Continue' for the call, restore it in a finally block,
# and capture $LASTEXITCODE immediately afterward. The native process's
# real exit code - not a stderr line - decides success. 2>$null is kept
# where the POSIX wrapper discards stderr; it now only keeps those
# (non-terminating) error records off the console.
$ErrorActionPreference = 'Stop'

$defaultBaseUrl = 'https://github.com/alefranz/AgenticAle'

function Show-Usage {
  # An array of single-quoted strings (no here-string), so the text is immune
  # to line-ending differences; the content mirrors scripts/install.sh usage
  # so both wrappers share one documented contract.
  $lines = @(
    'Usage:',
    '  powershell -ExecutionPolicy Bypass -File install.ps1 [options]',
    '',
    'Downloads the latest stable AgenticAle release (or a pinned --version TAG),',
    'extracts it to a temporary directory, and runs scripts/install.mjs from the',
    'extracted release to install the generated OpenCode bundle. All install',
    'options are forwarded to the installer verbatim. No AI session is launched,',
    'and the caller''s working directory is never changed.',
    '',
    'Wrapper options:',
    '  --version TAG     Install this release tag instead of resolving the latest.',
    '                    The tag is used verbatim: a leading "v" is part of the tag',
    '                    when the release is tagged that way.',
    '  --base-url URL    Repository base for release resolution and download',
    '                    (default: https://github.com/alefranz/AgenticAle; the',
    '                    AGENTICALE_BASE_URL environment variable is also honored,',
    '                    with --base-url taking precedence). Useful for mirrors.',
    '  --setup           Also create the personal routing customization file',
    '                    (~/.agenticale/routing.md) after a successful install.',
    '                    Skipped with --dry-run.',
    '  --help, -h        Show this help.',
    '',
    'Forwarded installer options (see: node scripts/install.mjs --help):',
    '  --models PATH|PRESET  --effort LEVEL  --source-root PATH  --routing PATH',
    '  --target PATH  --replace  --no-model  --dry-run',
    '',
    'If no routing selection (--models, --routing, or --no-model) is given, the',
    'wrapper appends --no-model so every role inherits the session model and',
    'effort.',
    '',
    'After a successful non-dry-run install the wrapper offers the consented setup',
    'step (create ~/.agenticale/routing.md as a minimal scaffold only if absent):',
    'with --setup it runs unconditionally; on a terminal without --setup it asks',
    '"Create a personal routing customization file (~/.agenticale/routing.md)?',
    '[y/N]" (default no); non-interactive runs skip it and print a tip. The',
    'AGENTICALE_INSTALL_CONSENT=yes|no environment variable replaces the',
    'interactive answer where the prompt would occur (a documented testing seam).',
    'The install is never undone by a setup failure; the wrapper exits with the',
    'setup subcommand''s exit code in that case.',
    '',
    'Exit codes: the installer''s exit code is propagated. If the install succeeds',
    'and the setup step runs, the setup exit code is propagated when it is',
    'non-zero.'
  )
  $lines | Write-Output
}

function Fail {
  param([string]$Message)
  # Mirrors scripts/install.sh fail(): the message and a usage pointer go to
  # stderr, then the script exits 1. exit terminates the whole script; the
  # top-level finally block still removes the temp directory when one exists.
  [Console]::Error.WriteLine("Error: $Message")
  [Console]::Error.WriteLine('Run with --help for usage.')
  exit 1
}

# Follow the /releases/latest redirect to /releases/tag/<tag> and read the
# final URL. No JSON parsing involved; the base-url seam lets a local fixture
# emulate the GitHub surface. Before any download, the redirect target is
# validated: it must be exactly <base>/releases/tag/<tag> (the tag page for
# this repository on the base host) and <tag> must be version-like, so a
# redirect to an unrelated URL (e.g. a login page) or a missing redirect
# fails here instead of being "installed". The rules below mirror the POSIX
# wrapper's resolver one for one:
#   1. the effective URL must use the http:// or https:// scheme
#   2. a query string and a fragment are stripped (not part of the path)
#   3. the URL must start with <base>/releases/tag/
#   4. the remainder after that prefix must contain no further / (a nested
#      path such as /releases/tag/unrelated/v9.9.9 is not a tag page and
#      must not resolve)
#   5. the tag must start with a digit, or with v/V directly followed by a
#      digit, and contain only alphanumerics plus dot, underscore, plus, or
#      hyphen (v9.9.9, 1.2.3, v1.0.0-rc.1)
# Returns the tag on success; $null on any mismatch or missing redirect.
function Resolve-LatestTag {
  param([string]$Base)
  # Scoped 'Continue' so this call's stderr records cannot terminate the
  # script before the exit-code check (see the header note); 2>$null keeps
  # them off the console, as the POSIX wrapper's 2>/dev/null does.
  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $out = & $curlCmd -sIL --max-time 60 -o NUL -w '%{url_effective}' ($Base + '/releases/latest') 2>$null
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
  $curlExitCode = $LASTEXITCODE
  if ($curlExitCode -ne 0) { return $null }
  if ($null -eq $out) { return $null }
  if (@($out).Count -ne 1) { return $null }
  $finalUrl = [string]$out
  if (-not ($finalUrl.StartsWith('http://') -or $finalUrl.StartsWith('https://'))) { return $null }
  $queryIndex = $finalUrl.IndexOf('?')
  if ($queryIndex -ge 0) { $finalUrl = $finalUrl.Substring(0, $queryIndex) }
  $fragmentIndex = $finalUrl.IndexOf('#')
  if ($fragmentIndex -ge 0) { $finalUrl = $finalUrl.Substring(0, $fragmentIndex) }
  $prefix = $Base + '/releases/tag/'
  if (-not $finalUrl.StartsWith($prefix)) { return $null }
  $tag = $finalUrl.Substring($prefix.Length)
  if ($tag.IndexOf('/') -ge 0) { return $null }
  if ($tag -notmatch '^(?:[0-9]|[vV][0-9])[A-Za-z0-9._+-]*$') { return $null }
  return $tag
}

# $TmpDir is set only once the temp directory exists and is removed in the
# finally block on every exit path (failures, exit calls, Ctrl-C). The
# finally block runs only when the script exits - i.e. after the delegated
# installer and the optional setup step have completed - so nothing is
# cleaned up too early.
$TmpDir = $null

try {
  # --- Parse wrapper options -------------------------------------------------
  # No param() block on purpose: every argument arrives raw in $args, so the
  # parsing semantics match scripts/install.sh exactly: the value-taking
  # options accept both "--opt value" and "--opt=value", and unknown options
  # and positional arguments are rejected with a clear error.
  #
  # Empty values are rejected at parse time, in BOTH forms, for every
  # value-taking option. When an argument array crosses into a native
  # command, Windows PowerShell 5.1 drops empty-string elements, so a
  # forwarded "--models" + "" pair would lose the empty element and shift
  # every later flag into the wrong value position. scripts/install.sh
  # forwards the empty word and scripts/install.mjs rejects it in its own
  # parser; the wrapper here rejects the same input itself, one step
  # earlier, with the same outcome: a clear error and a non-zero exit.

  if ($null -eq $args) { $argList = @() } else { $argList = @($args) }

  $baseUrl = $defaultBaseUrl
  if ($env:AGENTICALE_BASE_URL) { $baseUrl = [string]$env:AGENTICALE_BASE_URL }
  $version = ''
  $versionGiven = $false
  $models = ''
  $modelsGiven = $false
  $effort = ''
  $effortGiven = $false
  $sourceRoot = ''
  $sourceRootGiven = $false
  $routing = ''
  $routingGiven = $false
  $target = ''
  $targetGiven = $false
  $replace = $false
  $noModel = $false
  $dryRun = $false
  $setup = $false

  $argIndex = 0
  while ($argIndex -lt $argList.Count) {
    $arg = [string]$argList[$argIndex]
    if ($arg -eq '--help' -or $arg -eq '-h') {
      Show-Usage
      exit 0
    }
    if ($arg -eq '--version') {
      if (($argIndex + 1) -ge $argList.Count) { Fail '--version requires a release tag.' }
      $version = [string]$argList[$argIndex + 1]
      $versionGiven = $true
      $argIndex += 2
      continue
    }
    if ($arg.StartsWith('--version=')) {
      $version = $arg.Substring('--version='.Length)
      if ($version -eq '') { Fail '--version requires a release tag.' }
      $versionGiven = $true
      $argIndex += 1
      continue
    }
    if ($arg -eq '--base-url') {
      if (($argIndex + 1) -ge $argList.Count) { Fail '--base-url requires a URL.' }
      $baseUrl = [string]$argList[$argIndex + 1]
      $argIndex += 2
      continue
    }
    if ($arg.StartsWith('--base-url=')) {
      $baseUrl = $arg.Substring('--base-url='.Length)
      if ($baseUrl -eq '') { Fail '--base-url requires a URL.' }
      $argIndex += 1
      continue
    }
    if ($arg -eq '--models') {
      if (($argIndex + 1) -ge $argList.Count) { Fail '--models requires a path or preset.' }
      $models = [string]$argList[$argIndex + 1]
      if ($models -eq '') { Fail '--models requires a path or preset.' }
      $modelsGiven = $true
      $argIndex += 2
      continue
    }
    if ($arg.StartsWith('--models=')) {
      $models = $arg.Substring('--models='.Length)
      if ($models -eq '') { Fail '--models requires a path or preset.' }
      $modelsGiven = $true
      $argIndex += 1
      continue
    }
    if ($arg -eq '--effort') {
      if (($argIndex + 1) -ge $argList.Count) { Fail '--effort requires a level.' }
      $effort = [string]$argList[$argIndex + 1]
      if ($effort -eq '') { Fail '--effort requires a level.' }
      $effortGiven = $true
      $argIndex += 2
      continue
    }
    if ($arg.StartsWith('--effort=')) {
      $effort = $arg.Substring('--effort='.Length)
      if ($effort -eq '') { Fail '--effort requires a level.' }
      $effortGiven = $true
      $argIndex += 1
      continue
    }
    if ($arg -eq '--source-root') {
      if (($argIndex + 1) -ge $argList.Count) { Fail '--source-root requires a path.' }
      $sourceRoot = [string]$argList[$argIndex + 1]
      if ($sourceRoot -eq '') { Fail '--source-root requires a path.' }
      $sourceRootGiven = $true
      $argIndex += 2
      continue
    }
    if ($arg.StartsWith('--source-root=')) {
      $sourceRoot = $arg.Substring('--source-root='.Length)
      if ($sourceRoot -eq '') { Fail '--source-root requires a path.' }
      $sourceRootGiven = $true
      $argIndex += 1
      continue
    }
    if ($arg -eq '--routing') {
      if (($argIndex + 1) -ge $argList.Count) { Fail '--routing requires a path.' }
      $routing = [string]$argList[$argIndex + 1]
      if ($routing -eq '') { Fail '--routing requires a path.' }
      $routingGiven = $true
      $argIndex += 2
      continue
    }
    if ($arg.StartsWith('--routing=')) {
      $routing = $arg.Substring('--routing='.Length)
      if ($routing -eq '') { Fail '--routing requires a path.' }
      $routingGiven = $true
      $argIndex += 1
      continue
    }
    if ($arg -eq '--target') {
      if (($argIndex + 1) -ge $argList.Count) { Fail '--target requires a path.' }
      $target = [string]$argList[$argIndex + 1]
      if ($target -eq '') { Fail '--target requires a path.' }
      $targetGiven = $true
      $argIndex += 2
      continue
    }
    if ($arg.StartsWith('--target=')) {
      $target = $arg.Substring('--target='.Length)
      if ($target -eq '') { Fail '--target requires a path.' }
      $targetGiven = $true
      $argIndex += 1
      continue
    }
    if ($arg -eq '--replace') {
      $replace = $true
      $argIndex += 1
      continue
    }
    if ($arg -eq '--no-model') {
      $noModel = $true
      $argIndex += 1
      continue
    }
    if ($arg -eq '--dry-run') {
      $dryRun = $true
      $argIndex += 1
      continue
    }
    if ($arg -eq '--setup') {
      $setup = $true
      $argIndex += 1
      continue
    }
    if ($arg.StartsWith('-')) {
      Fail ("Unknown option '{0}'." -f $arg)
    }
    Fail ("Unexpected argument '{0}'." -f $arg)
  }

  # A trailing slash would double up in the resolved URLs.
  if ($baseUrl.EndsWith('/')) {
    $baseUrl = $baseUrl.Substring(0, $baseUrl.Length - 1)
  }

  # --- Prerequisites ---------------------------------------------------------
  # Checked before any external tool (curl.exe, tar) is needed, so a missing
  # Node on the PATH yields a clear, actionable error.

  $nodeInfo = Get-Command node -ErrorAction SilentlyContinue
  if ($null -eq $nodeInfo -or [string]::IsNullOrEmpty($nodeInfo.Source)) {
    Fail 'Node.js is required, but no node executable was found on the PATH. Install Node.js 20 or later from https://nodejs.org and retry.'
  }
  $nodeCmd = $nodeInfo.Source

  # Scoped 'Continue' around the native call: under the global 'Stop'
  # policy even a stderr line from a SUCCESSFUL call would terminate the
  # script before the exit-code check (see the header note).
  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $nodeVersionRaw = & $nodeCmd --version 2>$null
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
  $nodeExitCode = $LASTEXITCODE
  if ($nodeExitCode -ne 0) {
    Fail 'Could not determine the Node.js version. Node.js 20 or later is required (https://nodejs.org).'
  }
  $nodeVersion = [string]$nodeVersionRaw
  if ($nodeVersion -notmatch '^v[0-9]') {
    Fail ("Unrecognized Node.js version '{0}'. Node.js 20 or later is required (https://nodejs.org)." -f $nodeVersion)
  }
  $versionRest = $nodeVersion.Substring(1)
  $dotIndex = $versionRest.IndexOf('.')
  if ($dotIndex -lt 0) {
    $majorPart = $versionRest
  } else {
    $majorPart = $versionRest.Substring(0, $dotIndex)
  }
  if ($majorPart -notmatch '^[0-9]+$') {
    Fail ("Unrecognized Node.js version '{0}'. Node.js 20 or later is required (https://nodejs.org)." -f $nodeVersion)
  }
  if ([int]$majorPart -lt 20) {
    Fail ("Node.js 20 or later is required (found {0}). Install a newer Node.js from https://nodejs.org and retry." -f $nodeVersion)
  }

  # curl is resolved and invoked as curl.exe, never the bare curl alias
  # (which in Windows PowerShell is Invoke-WebRequest). tar on Windows 10
  # and later is the bsdtar at System32\tar.exe.
  $curlInfo = Get-Command curl.exe -ErrorAction SilentlyContinue
  if ($null -eq $curlInfo -or [string]::IsNullOrEmpty($curlInfo.Source) -or -not $curlInfo.Source.EndsWith('.exe')) {
    Fail 'curl.exe is required to download the release archive. Windows 10 and later include it; otherwise install curl for Windows and retry.'
  }
  $curlCmd = $curlInfo.Source

  $tarInfo = Get-Command tar.exe -ErrorAction SilentlyContinue
  if ($null -eq $tarInfo -or [string]::IsNullOrEmpty($tarInfo.Source) -or -not $tarInfo.Source.EndsWith('.exe')) {
    Fail 'tar is required to extract the release archive. Windows 10 and later include it; otherwise install a tar implementation and retry.'
  }
  $tarCmd = $tarInfo.Source

  # --- Resolve the release tag ------------------------------------------------

  if ($versionGiven) {
    # The pin is used verbatim as the release tag (a leading "v" is part of
    # the tag when the release is tagged that way); a pin that matches no tag
    # fails at download time with a clear error.
    $tag = $version
    Write-Output "AgenticAle $tag (pinned release)"
  } else {
    $tag = Resolve-LatestTag $baseUrl
    if ($null -eq $tag) {
      Fail ("Could not resolve the latest release from {0}/releases/latest. Pin an exact tag with --version TAG, or check the --base-url setting." -f $baseUrl)
    }
    Write-Output "AgenticAle $tag (latest release)"
  }

  # --- Temp directory ----------------------------------------------------------

  $tempRoot = [System.IO.Path]::GetTempPath()
  $TmpDir = Join-Path $tempRoot ('agenticale-install-' + [System.Guid]::NewGuid().ToString('N'))
  try {
    New-Item -ItemType Directory -Path $TmpDir | Out-Null
  } catch {
    Fail 'Could not create a temporary directory.'
  }

  # --- Download and verify the release archive ---------------------------------

  $archive = Join-Path $TmpDir 'release.tar.gz'
  $archiveUrl = "$baseUrl/archive/refs/tags/$tag.tar.gz"
  Write-Output "Downloading $archiveUrl"
  # -f makes HTTP error statuses fail instead of saving an error page; -sS
  # keeps the progress meter off but still shows errors; the tar -tzf pass
  # below is a second guard against a non-tarball body.
  # Scoped 'Continue' so curl's stderr (kept visible on purpose: -sS shows
  # errors) can only surface as error records, never terminate the script
  # before the exit-code check (see the header note).
  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    & $curlCmd -fsSL --retry 3 --max-time 600 -o $archive $archiveUrl
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
  $downloadExitCode = $LASTEXITCODE
  if ($downloadExitCode -ne 0) {
    Fail ("Failed to download {0}. Check your network connection, or pin an exact release with --version TAG." -f $archiveUrl)
  }
  $archiveInfo = Get-Item -LiteralPath $archive -ErrorAction SilentlyContinue
  if ($null -eq $archiveInfo -or $archiveInfo.Length -le 0) {
    Fail ("The download from {0} is empty; the release archive may be missing." -f $archiveUrl)
  }
  # Scoped 'Continue' + 2>$null, mirroring the POSIX wrapper's
  # >/dev/null 2>&1: the list pass is a guard, its output is discarded, and
  # its stderr records must not terminate the script (see the header note).
  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $null = & $tarCmd -tzf $archive 2>$null
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
  $tarListExitCode = $LASTEXITCODE
  if ($tarListExitCode -ne 0) {
    Fail ("The download from {0} is not a readable gzip tarball. It may be an error page; check that '{1}' is a valid release tag." -f $archiveUrl, $tag)
  }

  Write-Output 'Extracting release archive'
  # Scoped 'Continue'; the extraction output (and any stderr records) stay
  # visible to the user and cannot terminate the script before the
  # exit-code check (see the header note).
  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    & $tarCmd -xzf $archive -C $TmpDir
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
  $tarExtractExitCode = $LASTEXITCODE
  if ($tarExtractExitCode -ne 0) {
    Fail 'Failed to extract the release archive.'
  }

  # Locate the single top-level AgenticAle-<tag> directory. The archive file
  # itself lives in the temp dir, so it is excluded from the layout check.
  $entries = @(Get-ChildItem -LiteralPath $TmpDir -Force | Where-Object { $_.FullName -ne $archive })
  if ($entries.Count -ne 1) {
    Fail ("Unexpected archive layout: expected a single top-level directory, found {0}." -f $entries.Count)
  }
  $topEntry = $entries[0]
  if (-not $topEntry.PSIsContainer) {
    Fail 'Unexpected archive layout: the top-level entry is not a directory.'
  }
  if ($topEntry.Name -notlike 'AgenticAle-*') {
    Fail ("Unexpected archive layout: top-level directory '{0}' is not an AgenticAle release (expected AgenticAle-<tag>)." -f $topEntry.Name)
  }
  $installer = Join-Path (Join-Path $topEntry.FullName 'scripts') 'install.mjs'
  if (-not (Test-Path -LiteralPath $installer -PathType Leaf)) {
    Fail 'The release archive does not contain scripts/install.mjs; the tag may not be a real AgenticAle release.'
  }

  # --- Build the installer argv --------------------------------------------------
  # A discrete array of strings in the same fixed order as the POSIX wrapper,
  # so a value containing spaces stays one element. Every element is
  # non-empty (empty values were rejected at parse time), so the 5.1
  # native-boundary drop of empty-string arguments cannot lose or shift
  # anything when the array crosses into node.
  $installerArgs = @()
  if ($modelsGiven) { $installerArgs = $installerArgs + @('--models', $models) }
  if ($effortGiven) { $installerArgs = $installerArgs + @('--effort', $effort) }
  if ($sourceRootGiven) { $installerArgs = $installerArgs + @('--source-root', $sourceRoot) }
  if ($routingGiven) { $installerArgs = $installerArgs + @('--routing', $routing) }
  if ($targetGiven) { $installerArgs = $installerArgs + @('--target', $target) }
  if ($replace) { $installerArgs = $installerArgs + '--replace' }
  if ($noModel) { $installerArgs = $installerArgs + '--no-model' }
  if ($dryRun) { $installerArgs = $installerArgs + '--dry-run' }
  # Default routing selection: with no --models, --routing, or --no-model
  # given, append --no-model so every role inherits the session model and
  # effort.
  if (-not $modelsGiven -and -not $routingGiven -and -not $noModel) {
    $installerArgs = $installerArgs + '--no-model'
  }

  # --- Run the installer ----------------------------------------------------------
  Write-Output 'Running installer'
  # Intentionally unredirected, so the installer's output reaches the user;
  # its stderr lines become error records in 5.1, and the scoped 'Continue'
  # policy keeps those records from terminating the wrapper - the installer's
  # own exit code decides what happens next (see the header note).
  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    & $nodeCmd $installer @installerArgs
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
  $installStatus = $LASTEXITCODE

  # --- Consent-gated setup step ----------------------------------------------------
  # Runs only after a successful non-dry-run install. The entire consent
  # decision - including the interactive prompt - is gated on the install
  # having succeeded: a failing install goes straight to propagating the
  # installer's exit code and must never reach the prompt, which would wait
  # for input on a terminal instead of returning the failure promptly. A
  # setup failure does not undo the install; it is reported and its exit
  # code becomes the wrapper's.

  $runSetup = $false
  $hintSetup = $false
  if ($installStatus -eq 0) {
    if ($setup -and -not $dryRun) {
      $runSetup = $true
    } elseif (-not $dryRun) {
      if (-not [Console]::IsInputRedirected -and -not [Console]::IsOutputRedirected) {
        # On a terminal, ask. AGENTICALE_INSTALL_CONSENT (yes|no) is a
        # documented testing seam: when set, it replaces the interactive
        # answer here, and is consulted nowhere else. The string comparisons
        # are case-insensitive by design (the POSIX wrapper matches
        # [Yy][Ee][Ss] and [Nn][Oo]).
        $consent = [string]$env:AGENTICALE_INSTALL_CONSENT
        if ($consent -eq 'yes') {
          $runSetup = $true
        } elseif ($consent -eq 'no') {
          $runSetup = $false
        } else {
          # Read-Host renders the prompt text verbatim (the default host
          # appends a trailing colon); Enter or N answers no, y/yes answers
          # yes.
          $answer = Read-Host 'Create a personal routing customization file (~/.agenticale/routing.md)? [y/N]'
          if ($null -eq $answer) { $answer = '' }
          $answer = [string]$answer
          if ($answer -eq 'y' -or $answer -eq 'yes') {
            $runSetup = $true
          }
        }
      } else {
        # Non-interactive: skip silently; a one-line tip is printed on success.
        $hintSetup = $true
      }
    }
  }

  $status = $installStatus
  if ($status -eq 0 -and $runSetup) {
    Write-Output 'Creating the personal routing customization file'
    # Forward an explicit --target so the setup guidance points at the packaged
    # example under the target the install used; with no --target, pass nothing
    # and setup resolves the same default. Same discrete-array pattern as the
    # installer argv: every element is non-empty ($target was rejected empty at
    # parse time), so the 5.1 native-boundary drop of empty-string arguments
    # cannot lose or shift anything.
    $setupArgs = @('setup')
    if ($targetGiven) { $setupArgs = $setupArgs + @('--target', $target) }
    # Intentionally unredirected (the user sees the setup output); the
    # scoped 'Continue' policy keeps its stderr records from terminating
    # the wrapper before the exit-code check (see the header note).
    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
      & $nodeCmd $installer @setupArgs
    } finally {
      $ErrorActionPreference = $previousErrorActionPreference
    }
    $setupStatus = $LASTEXITCODE
    if ($setupStatus -ne 0) {
      [Console]::Error.WriteLine(("Error: the install succeeded, but the routing setup step failed (exit {0}). The install is intact; re-run the setup step manually if needed." -f $setupStatus))
      $status = $setupStatus
    }
  }
  if ($status -eq 0 -and $hintSetup) {
    Write-Output 'Tip: run with --setup to also create the personal routing customization file (~/.agenticale/routing.md).'
  }

  exit $status
}
catch {
  # An unexpected terminating error (a guarded cmdlet failed): report it and
  # exit non-zero. The finally block still removes the temp directory.
  $errorMessage = $_.Exception.Message
  if ([string]::IsNullOrEmpty($errorMessage)) { $errorMessage = 'Unexpected error.' }
  [Console]::Error.WriteLine("Error: $errorMessage")
  [Console]::Error.WriteLine('Run with --help for usage.')
  exit 1
}
finally {
  if ($null -ne $TmpDir -and (Test-Path -LiteralPath $TmpDir)) {
    Remove-Item -LiteralPath $TmpDir -Recurse -Force -ErrorAction SilentlyContinue
  }
}
