#!/bin/bash
# agentmemory wrapper for Hermes Agent
# Usage: 
#   ./agentmemory.sh recall   - Load previous context
#   ./agentmemory.sh save     - Save current context
#   ./agentmemory.sh start    - Start the agentmemory server
#   ./agentmemory.sh stop     - Stop the agentmemory server

REST_URL="http://localhost:3111"
SESSION_ID="hermes-eventflow-$(date +%Y-%m-%d)"

case "$1" in
  recall)
    # Recall previous observations
    curl -s "$REST_URL/agentmemory/observe/list?sessionId=$SESSION_ID" 2>/dev/null
    ;;
  save)
    # Save session observation
    curl -s -X POST "$REST_URL/agentmemory/observe" \
      -H "Content-Type: application/json" \
      -d "{\"hookType\":\"session_end\",\"sessionId\":\"$SESSION_ID\",\"project\":\"/root/workspace/EventFlow\",\"cwd\":\"/root/workspace/EventFlow\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"data\":{}}"
    ;;
  start)
    cd /root/workspace/EventFlow
    nohup npx @agentmemory/agentmemory > /tmp/agentmemory.log 2>&1 &
    sleep 3
    echo "agentmemory started on $REST_URL"
    ;;
  stop)
    pkill -f "agentmemory" 2>/dev/null
    echo "agentmemory stopped"
    ;;
  status)
    cd /root/workspace/EventFlow
    npx @agentmemory/agentmemory status 2>&1
    ;;
  *)
    echo "Usage: $0 {recall|save|start|stop|status}"
    ;;
esac
