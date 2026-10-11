#!/bin/sh
# 推送前檢查：這個專案是公開的，不能出現家用網路與主機的資訊。
# 通用的樣式寫在這裡；只屬於你自己的字串（例如私人網路名稱）寫在 ~/.config/llm-site/private-patterns（一行一個，不進 git）。
# 用法：scripts/check-private.sh            檢查目前所有追蹤中與即將提交的檔案
#       放進 .git/hooks/pre-push 就會在每次推送前自動執行
cd "$(git rev-parse --show-toplevel)" || exit 1
PATTERNS='\.ts\.net|tailscale|k3s-node|home-cluster|/var/lib/|nodePort|NodePort|192\.168\.[0-9]+\.[0-9]+|10\.[0-9]+\.[0-9]+\.[0-9]+|172\.(1[6-9]|2[0-9]|3[01])\.[0-9]+\.[0-9]+'
PRIVATE="$HOME/.config/llm-site/private-patterns"
FILES=$(git ls-files -co --exclude-standard | grep -v '^scripts/check-private.sh$' | grep -vE '\.(png|jpg|mp3|onnx)$')
found=$(echo "$FILES" | tr '\n' '\0' | xargs -0 grep -nIE "$PATTERNS" 2>/dev/null | grep -v "/var/lib/apt/")   # Dockerfile 常見的系統路徑不算
if [ -f "$PRIVATE" ]; then
  more=$(echo "$FILES" | tr '\n' '\0' | xargs -0 grep -nIF -f "$PRIVATE" 2>/dev/null)
  found=$(printf '%s\n%s' "$found" "$more" | sed '/^$/d')
fi
if [ -n "$found" ]; then
  echo "停止：以下內容可能是私人資訊，不能推送到公開的專案："
  echo "$found"
  exit 1
fi
echo "檢查通過：沒有找到私人資訊。"
