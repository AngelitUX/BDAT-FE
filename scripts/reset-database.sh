#!/bin/bash
# Script para resetear la base de datos completamente

echo "🛑 Deteniendo contenedores..."
docker-compose -f docker-compose.dev.yml down

echo "🗑️  Eliminando volumen de base de datos..."
docker volume rm bdat_dbdata 2>/dev/null || echo "Volumen no existe o ya fue eliminado"

echo "🔨 Reconstruyendo servicios..."
docker-compose -f docker-compose.dev.yml build mysql

echo "🚀 Iniciando servicios..."
docker-compose -f docker-compose.dev.yml up -d mysql

echo "⏳ Esperando a que MySQL esté listo..."
sleep 10

echo "✅ Verificando tablas..."
docker-compose -f docker-compose.dev.yml exec mysql mysql -uUserBDAT -pBDATpassword BDAT_FE_simulations -e "SHOW TABLES;"

echo "🎉 Base de datos reseteada exitosamente!"
