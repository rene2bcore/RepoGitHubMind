#!/usr/bin/env bash
# RepoGitHubMind · preparar un VPS Ubuntu 24.04 recién creado (RGM-14).
#
# Se ejecuta UNA vez como root, entrando por SSH con clave. Es idempotente:
# repetirlo no rompe nada. Deja:
#   - el sistema actualizado y con actualizaciones de seguridad automáticas
#   - Docker Engine y el plugin de Compose desde el repositorio oficial
#   - el usuario `rgm` (grupo docker) con las mismas claves SSH que root
#   - SSH solo con clave (sin contraseñas) y root solo con clave
#   - firewall con solo el 22 abierto: la web entra por Cloudflare Tunnel
#   - fail2ban para SSH
#   - el repositorio clonado en /opt/repogithubmind, propiedad de `rgm`
#
#   ssh root@<ip> 'bash -s' < deploy/preparar-vps.sh
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/rene2bcore/RepoGitHubMind.git}"
APP_DIR=/opt/repogithubmind
APP_USER=rgm

[ "$(id -u)" -eq 0 ] || { echo "preparar-vps: ejecutar como root" >&2; exit 1; }
. /etc/os-release
echo "preparar-vps: $PRETTY_NAME en $(hostname)"

# Sin clave autorizada, desactivar las contraseñas dejaría el servidor fuera
# de alcance salvo por la consola del proveedor.
if ! [ -s /root/.ssh/authorized_keys ]; then
  echo "preparar-vps: /root/.ssh/authorized_keys está vacío; no se toca SSH" >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get -y -q -o Dpkg::Options::=--force-confold upgrade
apt-get -y -q install ca-certificates curl git ufw fail2ban unattended-upgrades gnupg

# --- Docker Engine desde el repositorio oficial de Docker ---
if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -q
  apt-get -y -q install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker
# Logs de contenedores acotados: sin esto crecen hasta llenar el disco.
if ! [ -f /etc/docker/daemon.json ]; then
  printf '{\n  "log-driver": "json-file",\n  "log-opts": { "max-size": "10m", "max-file": "5" }\n}\n' > /etc/docker/daemon.json
  systemctl restart docker
fi

# --- Usuario de despliegue ---
id "$APP_USER" >/dev/null 2>&1 || useradd --create-home --shell /bin/bash "$APP_USER"
usermod -aG docker "$APP_USER"
install -d -m 700 -o "$APP_USER" -g "$APP_USER" "/home/$APP_USER/.ssh"
install -m 600 -o "$APP_USER" -g "$APP_USER" /root/.ssh/authorized_keys "/home/$APP_USER/.ssh/authorized_keys"

# --- SSH solo con clave ---
# `00-` para ganar a los ficheros del proveedor (p. ej. 50-cloud-init.conf con
# PasswordAuthentication yes): en sshd_config.d gana el primer valor leído.
cat > /etc/ssh/sshd_config.d/00-repogithubmind.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
PubkeyAuthentication yes
EOF
sshd -t
systemctl reload ssh || systemctl reload sshd

# --- Firewall: solo SSH ---
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw --force enable

# --- fail2ban para SSH ---
cat > /etc/fail2ban/jail.d/repogithubmind.local <<'EOF'
[sshd]
enabled = true
maxretry = 5
bantime = 1h
EOF
systemctl enable --now fail2ban
systemctl restart fail2ban

# --- Actualizaciones de seguridad automáticas ---
printf 'APT::Periodic::Update-Package-Lists "1";\nAPT::Periodic::Unattended-Upgrade "1";\n' \
  > /etc/apt/apt.conf.d/20auto-upgrades

# --- Código ---
install -d -m 755 -o "$APP_USER" -g "$APP_USER" "$APP_DIR"
if ! [ -d "$APP_DIR/.git" ]; then
  sudo -u "$APP_USER" git clone "$REPO_URL" "$APP_DIR"
fi
install -d -m 700 -o "$APP_USER" -g "$APP_USER" "$APP_DIR/backups"

# --- Backups: diario a las 03:30 UTC y restauración de prueba los lunes ---
printf '%s\n' \
  'SHELL=/bin/bash' \
  'PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' \
  "30 3 * * * $APP_USER $APP_DIR/deploy/backup.sh >> $APP_DIR/backups/backup.log 2>&1" \
  "15 4 * * 1 $APP_USER $APP_DIR/deploy/restaurar.sh >> $APP_DIR/backups/restaurar.log 2>&1" \
  > /etc/cron.d/repogithubmind
chmod 644 /etc/cron.d/repogithubmind

echo "preparar-vps: listo"
docker --version
docker compose version
ufw status | head -5
sshd -T 2>/dev/null | grep -E '^(passwordauthentication|permitrootlogin) '
