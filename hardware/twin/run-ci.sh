#!/bin/sh
# CI entry point: start firmware's mock server with the twin's device registry on a free port,
# run every scenario against it once per ball size (TWIN_BALLS, mm), exit non-zero if any run failed.
# No hardware, no secrets.
set -eu
cd "$(dirname "$0")"
make -s build/twin
./build/twin devices > build/devices.json
PORT=${TWIN_PORT:-$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1])')}
python3 ../firmware/tools/mock_server.py --token twin --port "$PORT" --devices build/devices.json > build/mock.log 2>&1 &
MOCK=$!
trap 'kill $MOCK 2>/dev/null' EXIT
for _ in 1 2 3 4 5 6 7 8 9 10; do curl -s -o /dev/null "http://127.0.0.1:$PORT/" && break; sleep 0.3; done
rc=0
for mm in ${TWIN_BALLS:-31 36}; do
  echo "== ball $mm mm"
  ./build/twin --base "http://127.0.0.1:$PORT" --token twin --ball "$mm" run "${@:-all}" || rc=1
done
exit $rc
