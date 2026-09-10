#!/usr/bin/env bash
# Sobe o ambiente completo para testar pelo celular via USB:
# API (relay + IA), receiver no navegador e Metro no dev client.
# Usa `adb reverse` para que o app alcance Metro (8081) e API (8787) em localhost,
# sem depender do Wi-Fi. O receiver fica em http://localhost:5173.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PACKAGE="com.illusionreader.app"
APK="$ROOT/apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk"

if ! command -v adb >/dev/null; then
  echo "[localtest] adb não encontrado. Instale o Android SDK platform-tools." >&2
  exit 1
fi

DEVICES=$(adb devices | awk 'NR>1 && $2=="device" {print $1}')
if [ -z "$DEVICES" ]; then
  echo "[localtest] nenhum celular autorizado no adb. Conecte pelo USB e aceite a depuração." >&2
  adb devices >&2
  exit 1
fi
if [ "$(echo "$DEVICES" | wc -l)" -gt 1 ]; then
  echo "[localtest] mais de um dispositivo conectado; deixe só um." >&2
  exit 1
fi
echo "[localtest] celular: $DEVICES"

if ! adb shell pm list packages | grep -q "^package:$PACKAGE$"; then
  if [ ! -f "$APK" ]; then
    echo "[localtest] app não instalado e APK não encontrado. Rode: npm run android -w @illusion/mobile" >&2
    exit 1
  fi
  echo "[localtest] instalando dev build..."
  adb install -r "$APK"
fi

adb reverse tcp:8081 tcp:8081
adb reverse tcp:8787 tcp:8787

if [ ! -f "$ROOT/apps/api/.env" ] || ! grep -q '^ANTHROPIC_API_KEY=.\+' "$ROOT/apps/api/.env"; then
  echo "[localtest] aviso: ANTHROPIC_API_KEY ausente em apps/api/.env; escaneamento de páginas não vai funcionar." >&2
fi

cat <<MSG
[localtest] receiver: http://localhost:5173  (abra no navegador para ver o código de pareamento)
[localtest] no app, o servidor padrão passa a ser localhost:8787. Se já tiver salvo outro, ajuste em Servidor.
MSG

cd "$ROOT"
exec npx concurrently -n api,tv,app -c blue,magenta,yellow -k \
  "npm run dev -w @illusion/api" \
  "npm run dev -w @illusion/receiver" \
  "npm run start -w @illusion/mobile -- --dev-client --localhost --android"
