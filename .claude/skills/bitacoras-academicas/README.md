# Bitácoras Académicas - Skill

Automatiza completamente la creación de bitácoras para nuevos estudiantes.

## Quick Start

### 1. Setup Inicial

```bash
# Instalar dependencias
pip install -r requirements.txt

# Crear archivo .env (ver references/configuracion.md)
cp .env.example .env
# Editar .env con tus credenciales
```

### 2. Configuración

Lee `references/configuracion.md` para:
- Obtener `GHL_API_KEY`
- Obtener `GHL_LOCATION_ID`
- Encontrar `BITACORAS_ROOT_ID`
- Crear `GOOGLE_CREDENTIALS_PATH`

### 3. Ejecutar

```bash
python scripts/crear_bitacoras.py
```

## Cómo funciona

1. **Obtiene** estudiantes nuevos de GHL (con etiqueta "nuevo estudiante")
2. **Valida** que tengan promoción y nivel de ingreso
3. **Crea** estructura de carpetas en Drive:
   - Año (2026)
   - Mes numerado (05. PROM MAYO)
   - Promoción específica (PROM 10 MAYO 2026)
   - Subcarpetas (GENERAL, AVANZADOS/BITACORAS CONSULTOR)
4. **Crea** documentos con plantillas
5. **Actualiza** GHL con links
6. **Genera** logs en `logs/bitacoras_creadas.log`

## Estructura de Carpetas

```
BITACORAS/
└── 2026/
    └── 05. PROM MAYO/
        ├── PROM 10 MAYO 2026/
        │   ├── GENERAL/
        │   │   ├── Bitacora - Ana Garcia Torres
        │   │   └── Bitacora - Luis Mora Perez
        │   └── AVANZADOS/
        │       └── BITACORAS CONSULTOR/
        │           └── Bitacora - Luis Mora Perez
        └── PROM 25 MAYO 2026/
            ├── GENERAL/
            └── AVANZADOS/
                └── BITACORAS CONSULTOR/
```

## Reglas Importantes

**Niveles de ingreso:**
- Cualquier nivel que NO sea "Avanzado" → GENERAL solo
- Avanzado (+ de 500 ventas) → GENERAL + AVANZADOS

**Avanzados:** Reciben 2 documentos (uno en cada carpeta)

## Logs

Ver `logs/bitacoras_creadas.log` para:
- Cada estudiante procesado
- Links creados
- Errores encontrados
- Resumen final

## Archivos

```
.claude/skills/bitacoras-academicas/
├── SKILL.md                          ← Descripción de la skill
├── README.md                         ← Este archivo
├── requirements.txt                  ← Dependencias Python
├── scripts/
│   ├── crear_bitacoras.py           ← Orquestador principal
│   ├── drive_service.py             ← Lógica Google Drive
│   ├── ghl_service.py               ← Lógica GoHighLevel
│   └── utils.py                     ← Utilidades
├── assets/
│   ├── plantilla_general.md         ← Plantilla para GENERAL
│   └── plantilla_avanzados.md       ← Plantilla para AVANZADOS
├── references/
│   └── configuracion.md             ← Guía completa de setup
└── logs/
    └── bitacoras_creadas.log        ← Log de ejecuciones
```

## Troubleshooting

**¿Credenciales no funcionan?**
→ Ver `references/configuracion.md`

**¿Carpetas no se crean?**
→ Verifica BITACORAS_ROOT_ID
→ Verifica permisos del Service Account

**¿Documentos no se crean?**
→ Verifica que Drive API esté habilitada
→ Verifica credenciales de Google

## Más Info

- [Documentación completa](references/configuracion.md)
- [GHL API Docs](https://docs.gohighlevel.com)
- [Google Drive API Docs](https://developers.google.com/drive/api)
