---
name: Bitácoras Académicas
description: Automatiza la creación de bitácoras en Google Drive para estudiantes nuevos en GHL
---

# Bitácoras Académicas

Automatiza completamente el flujo de creación de bitácoras académicas para nuevos estudiantes del programa GHL.

## Cuándo usarla

Úsala **SIEMPRE** cuando se mencione:
- Crear bitácoras
- Nuevo estudiante
- Promoción (10 de mayo, 25 de mayo, etc.)
- Carpetas en Drive (GENERAL, AVANZADOS)
- Subir link a GHL
- Proceso de ingreso
- BITACORAS CONSULTOR
- Bitácora vacía
- Seguimiento académico
- Subir documentos de estudiantes

## Qué hace

1. **Obtiene** estudiantes nuevos de GHL con etiqueta "nuevo estudiante"
2. **Valida** que tengan promoción, nivel de ingreso y nombre
3. **Crea** la estructura jerárquica de carpetas en Drive:
   - Año (2026, 2027, etc.)
   - Mes numerado (01. PROM ENERO, 05. PROM MAYO, etc.)
   - Promoción específica (PROM 10 MAYO 2026)
   - Subcarpetas internas (GENERAL, AVANZADOS/BITACORAS CONSULTOR)
4. **Crea** documentos con plantillas específicas
5. **Actualiza** GHL con los links de bitácoras
6. **Genera** logs detallados del proceso

## Estructura de carpetas que mantiene

```
BITACORAS/
└── 2026/
    ├── 01. PROM ENERO
    ├── 02. PROM FEBRERO
    ├── 03. PROM MARZO
    ├── 04. PROM ABRIL
    └── 05. PROM MAYO
        ├── PROM 10 MAYO 2026/
        │   ├── GENERAL/
        │   └── AVANZADOS/BITACORAS CONSULTOR/
        └── PROM 25 MAYO 2026/
            ├── GENERAL/
            └── AVANZADOS/BITACORAS CONSULTOR/
```

## Reglas importantes

**Niveles de ingreso y ubicación:**
- `Desde cero (0 ventas)` → GENERAL solo
- `Básico sin ventas` → GENERAL solo
- `Básico con ventas (10 a 100)` → **GENERAL + AVANZADOS/BITACORAS CONSULTOR**
- `Escalando ventas` → **GENERAL + AVANZADOS/BITACORAS CONSULTOR**
- `Avanzado (+ de 500 ventas)` → **GENERAL + AVANZADOS/BITACORAS CONSULTOR**

**Estudiantes con experiencia en ventas (3 niveles arriba) reciben 2 documentos:**
- Uno en GENERAL (con link al avanzado)
- Uno en AVANZADOS/BITACORAS CONSULTOR

## Ejecución

```bash
cd .claude/skills/bitacoras-academicas
python scripts/crear_bitacoras.py
```

## Configuración

Ver `references/configuracion.md` para setup del `.env`

Necesitas:
- `GHL_API_KEY`: Tu API key de GoHighLevel
- `GHL_LOCATION_ID`: ID de tu location en GHL
- `BITACORAS_ROOT_ID`: ID de la carpeta "BITACORAS" en Google Drive
- `GOOGLE_CREDENTIALS_PATH`: Ruta al JSON de credenciales OAuth2

## Output

Genera un log detallado en `logs/bitacoras_creadas.log` con:
- Timestamp de cada operación
- Nombres de estudiantes procesados
- Rutas exactas creadas
- Links de documentos
- Errores encontrados
- Resumen final
