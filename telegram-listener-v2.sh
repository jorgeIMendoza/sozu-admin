#!/bin/bash

# Telegram @open_alo_bot Listener v2
# Delega procesamiento a OpenClaw (Alo Agent)

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
STATE_FILE="/tmp/telegram-listener-state.json"

if [ -f "$STATE_FILE" ]; then
  OFFSET=$(jq -r '.last_offset // 0' "$STATE_FILE" 2>/dev/null)
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Listener iniciado"

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

    # Solo procesar si menciona @open_alo_bot
    if [ -n "$MESSAGE" ] && (echo "$MESSAGE" | grep -qi "@open_alo_bot\|alo"); then
      echo "[$(date '+%Y-%m-%d %H:%M:%S')] Procesando mensaje de @$USERNAME"

      # Guardar update para procesamiento
      echo "{\"update_id\": $UPDATE_ID, \"chat_id\": $CHAT_ID, \"message_id\": $MESSAGE_ID, \"username\": \"$USERNAME\", \"text\": \"$MESSAGE\", \"timestamp\": \"$(date -Iseconds)\"}" > /tmp/telegram-pending-message.json

      # Esperar a que se procese (máx 10 segundos)
      RESPONSE_FILE="/tmp/telegram-response-$UPDATE_ID.txt"
      WAITED=0
      while [ ! -f "$RESPONSE_FILE" ] && [ $WAITED -lt 50 ]; do
        sleep 0.2
        WAITED=$((WAITED + 1))
      done

      if [ -f "$RESPONSE_FILE" ]; then
        RESPONSE=$(cat "$RESPONSE_FILE")
        rm -f "$RESPONSE_FILE"

        ESCAPED_RESPONSE=$(echo "$RESPONSE" | sed 's/"/\\"/g')

        curl -s -X POST "https://api.telegram.org/bot${TOKEN}/sendMessage" \
          -H "Content-Type: application/json" \
          -d "{\"chat_id\": $CHAT_ID, \"text\": \"$ESCAPED_RESPONSE\", \"reply_to_message_id\": $MESSAGE_ID}" \
          > /dev/null

        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Respuesta enviada"
      else
        # Fallback si no hay respuesta
        RESPONSE="Procesando tu solicitud... 💼"
        ESCAPED_RESPONSE=$(echo "$RESPONSE" | sed 's/"/\\"/g')

        curl -s -X POST "https://api.telegram.org/bot${TOKEN}/sendMessage" \
          -H "Content-Type: application/json" \
          -d "{\"chat_id\": $CHAT_ID, \"text\": \"$ESCAPED_RESPONSE\", \"reply_to_message_id\": $MESSAGE_ID}" \
          > /dev/null

        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Fallback response"
      fi

      echo "{\"last_offset\": $UPDATE_ID, \"last_update\": \"$(date -Iseconds)\"}" > "$STATE_FILE"
      OFFSET=$UPDATE_ID
    fi
  done <<< "$RESULT"

  sleep 1
done
