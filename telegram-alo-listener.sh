#!/bin/bash

source /home/srvsozu/.openclaw/secrets/.bw-credentials
export BW_CLIENTID
export BW_CLIENTSECRET
export BW_MASTER_PASSWORD

TOKEN=$(bw get password "Token @open_alo_bot" 2>/dev/null)
if [ -z "$TOKEN" ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: No se pudo obtener el token de Bitwarden"
  exit 1
fi
OFFSET=0
STATE_FILE="/tmp/telegram-alo-listener-state.json"

if [ -f "$STATE_FILE" ]; then
  OFFSET=$(jq -r '.last_offset' "$STATE_FILE" 2>/dev/null || echo "0")
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Iniciando listener @open_alo_bot"

while true; do
  UPDATES=$(curl -s "https://api.telegram.org/bot${TOKEN}/getUpdates?offset=$((OFFSET+1))&timeout=30")

  RESULT=$(echo "$UPDATES" | jq -r '.result[] | @json' 2>/dev/null)

  while IFS= read -r UPDATE_JSON; do
    [ -z "$UPDATE_JSON" ] && continue

    UPDATE_ID=$(echo "$UPDATE_JSON" | jq -r '.update_id')
    MESSAGE=$(echo "$UPDATE_JSON" | jq -r '.message.text // empty')
    CHAT_ID=$(echo "$UPDATE_JSON" | jq -r '.message.chat.id // empty')
    MESSAGE_ID=$(echo "$UPDATE_JSON" | jq -r '.message.message_id // 0')
    USERNAME=$(echo "$UPDATE_JSON" | jq -r '.message.from.username // "Usuario"')

    if [ -z "$CHAT_ID" ]; then
      continue
    fi

    if [ -n "$MESSAGE" ] && (echo "$MESSAGE" | grep -qi "@open_alo_bot\|alo"); then
      echo "[$(date '+%Y-%m-%d %H:%M:%S')] Mensaje de @$USERNAME: $MESSAGE"

      HOUR=$(TZ='America/Mexico_City' date +%H)

      if [ "$HOUR" -ge 9 ] && [ "$HOUR" -lt 18 ]; then
        RESPONSE="Entendido. Procesando tu solicitud 💼"
      else
        RAND=$((RANDOM % 4))
        case $RAND in
          0) RESPONSE="Oye, ¿qué hora es? 🦉 Pero sí, lo haré... mañana a las 9 AM con más energía" ;;
          1) RESPONSE="Son las $(TZ='America/Mexico_City' date '+%I:%M %p') y ya estoy en modo duermevela 😴 Pero dale, anoto la tarea" ;;
          2) RESPONSE="¿Saben que está cerrada la oficina? Pero bueno, aquí ando... adelante 🔧" ;;
          3) RESPONSE="Jefe, estoy offline pero despierto... ¿qué necesitas? Que sea breve 😅" ;;
        esac
      fi

      ESCAPED_RESPONSE=$(echo "$RESPONSE" | sed 's/"/\\"/g' | sed "s/'/\\\\'/g")

      curl -s -X POST "https://api.telegram.org/bot${TOKEN}/sendMessage" \
        -H "Content-Type: application/json" \
        -d "{\"chat_id\": $CHAT_ID, \"text\": \"$ESCAPED_RESPONSE\", \"reply_to_message_id\": $MESSAGE_ID}" \
        > /dev/null

      echo "[$(date '+%Y-%m-%d %H:%M:%S')] Respuesta enviada a chat $CHAT_ID"

      echo "{\"last_offset\": $UPDATE_ID, \"last_update\": \"$(date -Iseconds)\"}" > "$STATE_FILE"
      OFFSET=$UPDATE_ID
    fi
  done <<< "$RESULT"

  sleep 1
done
