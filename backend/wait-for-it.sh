#!/bin/bash
set -e

# Función para esperar a un host/puerto
wait_for() {
  host=$1
  port=$2
  echo "⏳ Esperando a $host:$port..."
  while ! nc -z $host $port; do
    sleep 2
  done
  echo "✅ $host:$port listo"
}

if [ "$#" -lt 3 ]; then
  echo "Uso: $0 <host1:port1> <host2:port2> ... -- <comando>"
  exit 1
fi

# Separa hosts de comando
hosts=()
while [[ "$1" != "--" ]]; do
  hosts+=("$1")
  shift
done
shift # eliminar '--'

# Espera a cada host
for h in "${hosts[@]}"; do
  host=$(echo $h | cut -d: -f1)
  port=$(echo $h | cut -d: -f2)
  wait_for $host $port
done

# Ejecuta el comando final
exec "$@"
