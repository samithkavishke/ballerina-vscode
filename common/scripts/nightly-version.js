#!/usr/bin/env node

/**
 * Derives the nightly version from the root package.json and prints it.
 *
 * main always carries the *next* release as a snapshot — 'major.minor.patch-SNAPSHOT'
 * (e.g. 5.14.0-SNAPSHOT). A nightly is unreleased work heading toward that version,
 * so it is published as:
 *
 *     major.(minor - 1).<yymmddHHmm>     5.14.0-SNAPSHOT -> 5.13.2607290130
 *
 * The minor is decremented so a nightly sorts *above* every real release of the
 * previous line (5.13.4 < 5.13.2607290130) and *below* the release main is heading
 * for (5.13.2607290130 < 5.14.0). Publishing it as 5.14.x instead would make the
 * nightly outrank the eventual 5.14.0 release, and VS Code would never update off
 * it. The timestamp lands in the patch position rather than being appended so the
 * result is a plain three-part version, with no leading-zero semver trap.
 *
 * Pre-releases use this same derivation. The timestamp is minute-granular so a
 * nightly and a pre-release cut on the same day can never collide on a version.
 *
 * Usage: node common/scripts/nightly-version.js [--timestamp yymmddHHmm]
 *
 * Exit codes:
 * - 0: version printed on stdout
 * - 1: the root version is not a 'major.minor.patch-SNAPSHOT' with a decrementable minor
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SNAPSHOT_VERSION = /^(\d+)\.(\d+)\.\d+-SNAPSHOT$/;

/** yymmddHHmm in UTC — CI runners are UTC, so this matches `date '+%y%m%d%H%M'` there. */
function timestamp(now) {
  const pad = (n) => String(n).padStart(2, '0');
  return [
    pad(now.getUTCFullYear() % 100),
    pad(now.getUTCMonth() + 1),
    pad(now.getUTCDate()),
    pad(now.getUTCHours()),
    pad(now.getUTCMinutes()),
  ].join('');
}

function deriveNightlyVersion(rootVersion, stamp) {
  const match = SNAPSHOT_VERSION.exec(rootVersion);
  if (!match) {
    throw new Error(
      `The root package.json version is "${rootVersion}", which is not a snapshot.\n` +
      `main must always carry the next release as 'major.minor.patch-SNAPSHOT' ` +
      `(e.g. 5.14.0-SNAPSHOT); the nightly version is derived from it as ` +
      `major.(minor-1).<yymmddHH>.`
    );
  }

  const major = Number(match[1]);
  const minor = Number(match[2]);

  if (minor === 0) {
    // No sensible answer: 'major.-1.<timestamp>' is nonsense, and silently reusing
    // minor 0 would make the nightly outrank the release main is heading for.
    // Fail loudly — a human has to decide what the first nightly of a new major
    // line should be called.
    throw new Error(
      `Cannot derive a nightly version from "${rootVersion}": the minor version is 0, ` +
      `so there is no 'minor - 1' to publish under. Set the root version to a ` +
      `non-zero minor (e.g. ${major}.1.0-SNAPSHOT) or adjust the nightly scheme.`
    );
  }

  return `${major}.${minor - 1}.${stamp}`;
}

function main() {
  const args = process.argv.slice(2);
  const flagIndex = args.indexOf('--timestamp');
  const stamp = flagIndex !== -1 ? args[flagIndex + 1] : timestamp(new Date());

  if (!/^\d+$/.test(stamp || '')) {
    console.error(`Invalid --timestamp "${stamp}": expected digits (yymmddHHmm).`);
    process.exit(1);
  }

  const rootVersion = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')
  ).version;

  try {
    console.log(deriveNightlyVersion(rootVersion, stamp));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { deriveNightlyVersion, timestamp };
