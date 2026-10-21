#!/usr/bin/env bash
set -euo pipefail
# Optional Linux x86_64 browser for reliable cloud validation. No system writes.
# The signing key comes from Google's official TLS endpoint and is fingerprint
# pinned. Release signature -> package-index SHA256 -> package SHA256 are checked.
if [[ "$(uname -sm)" != "Linux x86_64" ]]; then
  echo 'This optional installer supports Linux x86_64. Set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH to your installed browser instead.' >&2
  exit 1
fi
browserCacheRoot="${LAANNDET_BROWSER_CACHE:-/workspace/.cache}"
chromeDownloadRoot="$browserCacheRoot/chrome-download"
mkdir -p "$chromeDownloadRoot"
chromeGpgTemp="$(mktemp -d /tmp/laanndet-chrome-key.XXXXXX)"
trap 'rm -rf "$chromeGpgTemp"' EXIT
curl -fsSL --max-time 60 https://dl.google.com/linux/linux_signing_key.pub -o "$chromeDownloadRoot/signing-key.pub"
curl -fsSL --max-time 60 https://dl.google.com/linux/chrome/deb/dists/stable/Release -o "$chromeDownloadRoot/Release"
curl -fsSL --max-time 60 https://dl.google.com/linux/chrome/deb/dists/stable/Release.gpg -o "$chromeDownloadRoot/Release.gpg"
gpg --homedir "$chromeGpgTemp" --batch --import "$chromeDownloadRoot/signing-key.pub"
gpg --homedir "$chromeGpgTemp" --batch --with-colons --fingerprint 7721F63BD38B4796 | python3 -c 'import sys; assert "fpr:::::::::EB4C1BFD4F042F6DDDCCEC917721F63BD38B4796:" in sys.stdin.read(), "Unexpected Google signing key fingerprint"'
gpg --homedir "$chromeGpgTemp" --batch --verify "$chromeDownloadRoot/Release.gpg" "$chromeDownloadRoot/Release"
curl -fsSL --max-time 60 https://dl.google.com/linux/chrome/deb/dists/stable/main/binary-amd64/Packages.gz -o "$chromeDownloadRoot/Packages.gz"
python3 - "$chromeDownloadRoot" "$browserCacheRoot/google-chrome" <<'PY'
from pathlib import Path
import gzip, hashlib, subprocess, re, sys
root=Path(sys.argv[1])
release=(root/'Release').read_text()
sha_section=release.split('SHA256:\n',1)[1].split('\nSHA512:',1)[0]
expected=next(l for l in sha_section.splitlines() if l.endswith(' main/binary-amd64/Packages.gz')).split()[0]
data=(root/'Packages.gz').read_bytes()
assert hashlib.sha256(data).hexdigest()==expected, 'Package index checksum mismatch'
entry=next(e for e in gzip.decompress(data).decode().split('\n\n') if e.startswith('Package: google-chrome-stable\n'))
fields=dict(l.split(': ',1) for l in entry.splitlines() if ': ' in l and not l.startswith(' '))
filename=fields['Filename']
assert re.fullmatch(r'pool/main/g/google-chrome-stable/[A-Za-z0-9_.+-]+\.deb',filename), 'Unexpected package path'
package=root/'chrome.deb'
if not package.exists() or hashlib.sha256(package.read_bytes()).hexdigest()!=fields['SHA256']:
    subprocess.run(['curl','-fsSL','--max-time','120','https://dl.google.com/linux/chrome/deb/'+filename,'-o',str(package)],check=True)
assert hashlib.sha256(package.read_bytes()).hexdigest()==fields['SHA256'], 'Chrome package checksum mismatch'
subprocess.run(['dpkg-deb','-x',str(package),sys.argv[2]],check=True)
print('Verified and extracted Google Chrome '+fields['Version'])
PY
"$browserCacheRoot/google-chrome/opt/google/chrome/chrome" --version
