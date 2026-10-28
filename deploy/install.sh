#!/bin/bash
# Portfolio-only deployment; never migrates/replaces the existing live data.
set -euo pipefail
[[ $(id -u) == 0 && $(uname -m) == aarch64 ]] || exit 1
source_dir=$(realpath "${1:?Artifact required}");release=${2:?Release ID required}
[[ $release =~ ^[a-zA-Z0-9_-]+$ ]] || exit 1
[[ $source_dir == /home/thadmin/actions-runner/_work/_temp/th-release-*/unpacked ]] || exit 1
for file in dist/web/index.html dist/web/build-info.json dist/server/app.cjs runtime/bin/node start-rpi.mjs deploy/th-portfolio.service deploy/nginx-portfolio.conf deploy/nginx-portfolio.py; do test -f "$source_dir/$file"; done
[[ -f /etc/th-app/runtime.env && -f /opt/th-app/current/server/app.cjs && ! -f /run/th-storage/backup-active ]] || { echo 'Existing Pi runtime required; or backup active'; exit 1; }
for service in th-app nginx postgresql; do systemctl is-active --quiet "$service"; done
if ! systemctl is-active --quiet th-portfolio && [[ -n $(ss -H -ltn 'sport = :3001') ]]; then echo 'Port 3001 is occupied'; exit 1; fi
[[ $(sudo -u postgres psql -d th_app -Atqc "select to_regclass('portfolio.content') is not null") == t ]] || { echo 'Existing content schema required'; exit 1; }
state_sql="select version::text||':'||md5(data::text) from portfolio.content where id='main'"
before=$(sudo -u postgres psql -d th_app -Atqc "$state_sql")
backup="/var/backups/th-portfolio/$release";install -d -m 700 "$backup"
sudo -u postgres pg_dump -Fc -n portfolio th_app > "$backup/portfolio.dump";chmod 600 "$backup/portfolio.dump"
legacy=/etc/nginx/sites-available/th-app;newsite=/etc/nginx/sites-available/th-portfolio;unit=/etc/systemd/system/th-portfolio.service
[[ -f $legacy ]] || { echo 'Legacy routing missing; refusing automatic changes'; exit 1; }
cp -a "$legacy" "$backup/legacy-nginx"
[[ ! -f $newsite ]] || cp -a "$newsite" "$backup/portfolio-nginx"
[[ ! -f $unit ]] || cp -a "$unit" "$backup/portfolio-service"
old=$(readlink -f /opt/th-portfolio/current || true);was_active=false
if systemctl is-active --quiet th-portfolio; then was_active=true; fi
rollback(){
 trap - ERR
 if [[ -n $old && -d $old ]]; then ln -s "$old" /opt/th-portfolio/.rollback;mv -Tf /opt/th-portfolio/.rollback /opt/th-portfolio/current;else rm -f /opt/th-portfolio/current;fi
 cp -a "$backup/legacy-nginx" "$legacy"
 if [[ -f $backup/portfolio-nginx ]];then cp -a "$backup/portfolio-nginx" "$newsite";else rm -f /etc/nginx/sites-enabled/th-portfolio "$newsite";fi
 if [[ -f $backup/portfolio-service ]];then cp -a "$backup/portfolio-service" "$unit";else systemctl disable --now th-portfolio || true;rm -f "$unit";fi
 systemctl daemon-reload
 if [[ $was_active == true ]];then systemctl restart th-portfolio || true;fi
 nginx -t && systemctl reload nginx
 echo 'Prior routing/application restored; database and media were not replaced.' >&2
}
trap rollback ERR
install -d -m 755 /opt/th-portfolio/releases
[[ ! -e /opt/th-portfolio/releases/$release ]]
cp -a "$source_dir" "/opt/th-portfolio/releases/$release"
chown -R root:root "/opt/th-portfolio/releases/$release";chmod -R a+rX "/opt/th-portfolio/releases/$release"
ln -s "/opt/th-portfolio/releases/$release" /opt/th-portfolio/.next;mv -Tf /opt/th-portfolio/.next /opt/th-portfolio/current
install -m 644 "$source_dir/deploy/th-portfolio.service" "$unit"
systemctl daemon-reload;systemctl enable th-portfolio;systemctl restart th-portfolio
for attempt in $(seq 1 30);do if curl -fsS --max-time 3 -H 'Host: th.io.vn' http://127.0.0.1:3001/api/health >/dev/null;then break;fi;sleep 1;done
curl -fsS --max-time 15 -H 'Host: th.io.vn' http://127.0.0.1:3001/api/portfolio/content/ >/dev/null
python3 "$source_dir/deploy/nginx-portfolio.py" "$legacy" "$backup/legacy-updated"
install -m 644 "$backup/legacy-updated" "$legacy";install -m 644 "$source_dir/deploy/nginx-portfolio.conf" "$newsite";ln -sfn "$newsite" /etc/nginx/sites-enabled/th-portfolio
nginx -t
[[ $before == "$(sudo -u postgres psql -d th_app -Atqc "$state_sql")" ]] || { echo 'Concurrent content edit detected; refusing automatic cutover';false; }
systemctl reload nginx
curl -fsS --max-time 15 -H 'Host: th.io.vn' http://127.0.0.1/build-info.json >/dev/null
curl -fsS --max-time 15 -H 'Host: mes.th.io.vn' http://127.0.0.1/api/health >/dev/null
for service in th-portfolio th-app nginx postgresql cloudflared ssh; do systemctl is-active --quiet "$service"; done
trap - ERR
echo 'Portfolio deployed; existing content fingerprint preserved; MES health passed.'
