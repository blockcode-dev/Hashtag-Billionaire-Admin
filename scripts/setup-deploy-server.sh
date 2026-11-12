#!/usr/bin/env bash
# One-time server setup for automated deploys (README.md, "Deploying"). Run it
# as root on the server:
#
#   bash setup-deploy-server.sh <folder> '<deploy public key>' <panel address>
#   e.g. bash setup-deploy-server.sh /var/www/admin/dist 'ssh-ed25519 AAAA... github-actions-deploy' https://admin.example.com
#
# <folder> is the built panel, which the web server (Apache, nginx or another)
# serves at <panel address>. First the script asks this machine's web server for
# the panel; unless it gets that folder's index.html, it changes nothing. Then it:
#   1. adds a "deploy" user that can sign in only with that key, never a password;
#   2. moves the live build to <folder>-releases/before-ci, links
#      <folder>-releases/current to it and makes <folder> a link to current;
#   3. checks that the panel still loads, and that the site follows a switch of
#      current, by switching to a copy of the build for a moment. If either check
#      fails, it puts <folder> back as it was.
# Running it again is safe. At the end it prints the values for the workflow's secrets.
set -euo pipefail
export LC_ALL=C

usage="usage: bash setup-deploy-server.sh <folder> '<deploy public key>' <panel address>"
live=${1:?$usage}
pubkey=${2:?$usage}
url=${3:?$usage}
user=deploy

stop() {
  echo "STOPPED: $*" >&2
  exit 1
}

[ "$(id -u)" = 0 ] || stop "Run this as root. Nothing was changed."
while [ "${live%/}" != "$live" ]; do live=${live%/}; done
[[ $live =~ ^(/[A-Za-z0-9._-]+){2,}$ && /$live/ != */../* ]] ||
  stop "Give the folder as a full path, such as /var/www/admin/dist. Nothing was changed."
[[ $pubkey =~ ^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp[0-9]+)\ [A-Za-z0-9+/=]+(\ .*)?$ ]] ||
  stop "The second argument must be a public key line, starting with ssh-ed25519. Nothing was changed."
[[ $url =~ ^(https?)://([A-Za-z0-9.-]+)/?$ ]] ||
  stop "The third argument must be the panel's address, such as https://admin.example.com. Nothing was changed."
own=${BASH_REMATCH[1]}
host=${BASH_REMATCH[2]}
url=${url%/}
other=https
[ "$own" = http ] || other=http
releases=$live-releases
name=${releases##*/}
command -v curl >/dev/null || stop "curl isn't installed (apt install curl). Nothing was changed."

if [ -L "$live" ]; then
  [ "$(readlink -- "$live")" = "$name/current" ] ||
    stop "$live is already a link, to $(readlink -- "$live"), not to $name/current. Nothing was changed."
elif [ -d "$live" ]; then
  [ -f "$live/index.html" ] || stop "$live has no index.html, so it isn't a built site. Nothing was changed."
  for f in package.json node_modules src; do
    [ ! -e "$live/$f" ] || stop "$live looks like a project folder (it has $f), not a built site. Nothing was changed."
  done
  [ ! -e "$releases/before-ci" ] || stop "$releases/before-ci already exists. Nothing was changed."
else
  stop "$live doesn't exist. Nothing was changed."
fi

# From step 3 on, a failure puts the folder back (restore, below).
tmp=$(mktemp -d)
moved='' probe='' settled=''
on_exit() {
  if [ -n "$moved" ] && [ -z "$settled" ]; then restore; fi
  rm -rf -- "$tmp"
}
trap on_exit EXIT

# get <scheme> <address> <path>: asks the web server at <address> for
# <scheme>://<host><path> as a browser would, without the request leaving this
# machine. Saves the page in $tmp/page and prints the HTTP status (000: no answer).
get() {
  curl -sk --connect-timeout 3 --max-time 10 --max-redirs 3 -L \
    --resolve "$host:80:$2" --resolve "$host:443:$2" -H 'Cache-Control: no-cache' \
    -o "$tmp/page" -w '%{http_code}' "$1://$host$3" 2>/dev/null || true
}
# serves <scheme> <address> <path> <file>: whether that request returns exactly <file>.
serves() {
  rm -f -- "$tmp/page"
  [ "$(get "$1" "$2" "$3")" = 200 ] && cmp -s -- "$tmp/page" "$4"
}

# Find where on this machine the panel's address serves this folder's index.html.
# Visitors get what the address's own scheme answers, so the other scheme is
# tried only when that one gets no answer at all, as behind a proxy that
# connects to this server over plain http.
mapfile -t addrs < <(
  echo 127.0.0.1
  hostname -I 2>/dev/null | tr ' ' '\n' | grep -E '^[0-9]+(\.[0-9]+){3}$' | grep -vxF 127.0.0.1
)
scheme='' addr=''
for s in "$own" "$other"; do
  answered=''
  for a in "${addrs[@]}"; do
    rm -f -- "$tmp/page"
    code=$(get "$s" "$a" /)
    if [ "$code" = 200 ] && cmp -s -- "$tmp/page" "$live/index.html"; then
      scheme=$s addr=$a
      break 2
    fi
    [ "$code" = 000 ] || answered=1
  done
  [ -z "$answered" ] || break
done
if [ -z "$scheme" ]; then
  hint=''
  {
    echo "Asked this machine for $url/:"
    for s in "$own" "$other"; do
      for a in "${addrs[@]}"; do
        rm -f -- "$tmp/page"
        code=$(get "$s" "$a" /)
        if [ "$code" = 200 ] && cmp -s -- "$tmp/page" "$live/index.html"; then
          echo "  $s on $a: $live/index.html"
          hint=$s
        elif [ "$code" = 200 ]; then
          echo "  $s on $a: a page, but not $live/index.html"
        elif [ "$code" = 000 ]; then
          echo "  $s on $a: no answer"
        else
          echo "  $s on $a: HTTP $code"
        fi
      done
    done
    echo "Listening on this machine:"
    ss -ltnp 2>/dev/null | awk 'NR > 1 { print "  " $4 "  " $NF }'
    if command -v apache2ctl >/dev/null; then
      echo "Apache's sites:"
      apache2ctl -S 2>/dev/null | grep -E 'namevhost|default server' | sed -E 's/^[[:space:]]+/  /'
      grep -HiE '^[[:space:]]*(ServerName|DocumentRoot|Alias|ProxyPass|Options)[[:space:]]' /etc/apache2/sites-enabled/* 2>/dev/null |
        sed -E 's#^/etc/apache2/sites-enabled/##; s/:[[:space:]]+/: /; s/^/  /'
    fi
    if command -v nginx >/dev/null; then
      echo "nginx's sites:"
      nginx -T 2>/dev/null | grep -oE '(^|[[:space:];{])(server_name|root|alias|proxy_pass)[[:space:]][^;]*;' |
        sed -E 's/^[[:space:];{]+//; s/^/  /'
    fi
  } >&2 || true
  [ -z "$hint" ] ||
    stop "$url doesn't serve $live on this machine, but $hint://$host does. If Cloudflare or another proxy connects to this server over $hint, run this again with $hint://$host. Nothing was changed."
  stop "$url doesn't serve $live on this machine. Run this again with the folder the web server serves for the panel. Nothing was changed."
fi
echo "Checked: $url serves $live ($scheme on $addr)."

# 1. The deploy user: no password, signs in with the deploy key only.
if ! id "$user" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash "$user"
  usermod --password '*' "$user"
  echo "Added the user $user."
fi
home=$(getent passwd "$user" | cut -d: -f6)
install -d -m 700 -o "$user" -g "$user" "$home/.ssh"
keys=$home/.ssh/authorized_keys
touch "$keys"
grep -qxF -- "restrict $pubkey" "$keys" || echo "restrict $pubkey" >>"$keys"
chown "$user:$user" "$keys"
chmod 600 "$keys"

# 2. The releases folder and the deploys' lock, owned by the deploy user. Holding
#    the lock keeps a deploy from running during the checks below.
install -d -m 755 -o "$user" -g "$user" "$releases"
lock=$releases/.deploy.lock
[ -e "$lock" ] || install -m 644 -o "$user" -g "$user" /dev/null "$lock"
exec 9>"$lock"
flock -n 9 || stop "A deploy is running. Run this again when it's done. $live wasn't changed."

# switch <build>: points current at <build> in one step, as a deploy does.
switch() {
  ln -sfn -- "$1" "$releases/.current.tmp" &&
    chown -h "$user:$user" "$releases/.current.tmp" &&
    mv -Tf -- "$releases/.current.tmp" "$releases/current"
}
restore() { # puts the folder back as it was before this run
  [ -z "$probe" ] || rm -rf -- "$probe"
  rm -f -- "$live" "$releases/current" "$releases/.current.tmp"
  mv -- "$releases/before-ci" "$live" ||
    echo "Couldn't put $live back. Run: rm -f $live && mv $releases/before-ci $live" >&2
}

# 3. Move the live build in and link the folder to it. The site is missing only
#    between the move and the link, well under a millisecond.
if [ ! -L "$live" ]; then
  switch before-ci
  mv -- "$live" "$releases/before-ci"
  moved=1
  ln -s -- "$name/current" "$live"
  echo "Moved the live build to $releases/before-ci. $live now links to $name/current."
fi

# Ask the web server for the panel through the link. Then test a switch: point
# current at a copy of the live build with one extra file for a moment, ask for
# that file, and point current back.
why=''
verify() {
  local was check=deploy-check-$$.txt token=$tmp/token served=''
  serves "$scheme" "$addr" / "$live/index.html" || {
    why="Through the link, $url no longer loads the panel. The web server has to follow links (in Apache: Options FollowSymLinks)."
    return 1
  }
  was=$(readlink -- "$releases/current")
  probe=$releases/check-$$
  printf 'deploy check %s %s\n' "$$" "$RANDOM" >"$token"
  if ! { cp -a -- "$releases/$was" "$probe" &&
    cp -- "$token" "$probe/$check" &&
    chown -R "$user:$user" "$probe" &&
    switch "${probe##*/}"; }; then
    rm -rf -- "$probe"
    probe=''
    why="Couldn't copy the live build to test a switch."
    return 1
  fi
  if serves "$scheme" "$addr" "/$check" "$token"; then served=1; fi
  if ! switch "$was"; then
    probe=''
    why="Couldn't point $name/current back to $was."
    return 1
  fi
  rm -rf -- "$probe"
  probe=''
  [ -n "$served" ] || {
    why="After $name/current was switched to another build, $url didn't serve it. The web server has to follow links to files of another owner (in Apache: Options FollowSymLinks, not SymLinksIfOwnerMatch) and read files fresh, not from a cache."
    return 1
  }
}
if ! verify; then
  [ -z "$moved" ] || restore
  settled=1
  [ -z "$moved" ] || stop "$why $live is back as it was."
  stop "$why The live build wasn't changed."
fi
settled=1
echo "Checked: $url still serves the panel through the link, and follows a switch to another build."

# Values for the workflow's secrets.
sshd_conf=$(sshd -T 2>/dev/null || true)
port=$(awk '$1 == "port" { print $2; exit }' <<<"$sshd_conf")
host_key=$(cat /etc/ssh/ssh_host_ed25519_key.pub 2>/dev/null || true)

echo
echo "Done. In GitHub, add these secrets to the production environment (README.md, Deploying):"
echo "  DEPLOY_HOST       this server's address, the one you connect to"
echo "  DEPLOY_USER       $user"
echo "  DEPLOY_PATH       $live"
echo "  DEPLOY_HOST_KEY   ${host_key:-the line in one of /etc/ssh/ssh_host_*_key.pub}"
echo "  DEPLOY_SSH_KEY    the private half of the key you gave this script"
echo "  ADMIN_URL         $url"
[ "${port:-22}" = 22 ] || echo "  DEPLOY_PORT       $port"

allow=$(awk '$1 == "allowusers" || $1 == "allowgroups"' <<<"$sshd_conf")
if [ -n "$allow" ]; then
  echo
  echo "Note: SSH lets only some users sign in ($(echo "$allow" | paste -sd ' ' -))."
  echo "Add $user to that list in /etc/ssh/sshd_config, then run: systemctl reload ssh"
fi
if command -v ufw >/dev/null && ufw status 2>/dev/null | grep -q '^Status: active'; then
  echo
  echo "Firewall rules for SSH. GitHub connects from changing addresses, so port ${port:-22} must be open to Anywhere:"
  ufw status | grep -E "^(${port:-22}(/tcp)?|OpenSSH)[[:space:]]" | sed 's/^/  /' || echo "  (none found)"
fi

# What builds from GitHub won't have: the server's own build settings, edits in
# the project copy here, and hidden files in the build that was live.
project=${live%/*}
envs=$(cd "$project" 2>/dev/null && grep -HE '^VITE_' .env .env.local .env.production .env.production.local 2>/dev/null || true)
if [ -n "$envs" ]; then
  echo
  echo "The panel's build settings here. The workflow's Build step must use the same values:"
  while IFS= read -r line; do echo "  $line"; done <<<"$envs"
fi
if git -C "$project" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo
  echo "The project copy in $project is at commit $(git -C "$project" log -1 --format='%h from %cs: %s' 2>/dev/null || echo '(unknown)')."
  changes=$(git -C "$project" status --porcelain 2>/dev/null | grep -vxF "?? $name/" || true)
  if [ -n "$changes" ]; then
    echo "Files there that differ from git. Builds from GitHub won't have these changes:"
    while IFS= read -r line; do echo "  $line"; done <<<"$changes"
  fi
fi
for f in "$releases"/before-ci/.[!.]*; do
  [ -f "$f" ] || continue
  echo
  echo "The build that was live has ${f##*/}, which builds from GitHub won't have. It contains:"
  head -n 40 -- "$f" | while IFS= read -r line; do echo "  $line"; done
done
