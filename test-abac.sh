#!/bin/bash

# Script para probar la implementación de ABAC
# Este script demuestra los 5 criterios de aceptación

echo "=========================================="
echo "TESTING ATTRIBUTE-BASED ACCESS CONTROL (ABAC)"
echo "=========================================="
echo ""

# Base URL
BASE_URL="http://localhost:3000/api"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Nota: Asegúrate que el servidor esté corriendo en puerto 3000${NC}"
echo ""

# Para este test usamos tokens JWT válidos (los cuales deberías generar primero)
# Este es un ejemplo de cómo se verían los tests con curl

echo -e "${YELLOW}PASO 1: Crear usuarios y obtener tokens${NC}"
echo "Crear usuario Admin..."
ADMIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"SecurePass123!"}')
echo "Admin creado: $ADMIN_RESPONSE"
echo ""

echo "Crear usuario Developer..."
DEV_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"developer@test.com","password":"SecurePass123!"}')
echo "Developer creado: $DEV_RESPONSE"
echo ""

echo "Crear usuario Viewer..."
VIEWER_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"viewer@test.com","password":"SecurePass123!"}')
echo "Viewer creado: $VIEWER_RESPONSE"
echo ""

echo -e "${YELLOW}NOTA: Los siguientes tests requieren tokens JWT válidos${NC}"
echo "Los tokens se obtienen después de login exitoso"
echo ""
echo "Ejemplo de tokens esperados:"
echo '  ADMIN_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."'
echo '  DEV_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."'
echo '  VIEWER_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."'
echo ""

echo -e "${YELLOW}Los tests de ABAC se encuentran en: tests/integration/abac.test.js${NC}"
echo "Ejecutar con: npm test -- tests/integration/abac.test.js"
