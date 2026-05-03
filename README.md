# skill-crear-bitacoras

Automatiza la creación de bitácoras académicas en Google Drive para estudiantes nuevos registrados en GoHighLevel (GHL).

## Qué hace

Cada vez que corre (días 10 y 25 de cada mes):

1. Lee los contactos de GHL con la etiqueta `nuevo estudiante`
2. Crea la estructura de carpetas en Google Drive si no existe
3. Genera los documentos de bitácora con la plantilla correcta
4. Actualiza GHL con los links de los documentos
5. Genera un log de todo lo procesado

## Estructura del proyecto

```
skill-crear-bitacoras/
├── .claude/
│   └── skills/
│       └── bitacoras-academicas/
│           ├── SKILL.md                    ← Descripción de la skill para Claude
│           ├── assets/
│           │   ├── plantilla_general.md    ← Plantilla para TODOS los estudiantes
│           │   └── plantilla_avanzados.md  ← Plantilla solo para nivel avanzado
│           ├── references/
│           │   └── configuracion.md        ← Guía completa de setup
│           └── scripts/
│               ├── crear_bitacoras.py      ← Orquestador principal
│               ├── drive_service.py        ← Lógica Google Drive
│               ├── ghl_service.py          ← Lógica GoHighLevel
│               └── utils.py               ← Utilidades compartidas
├── rutina/
│   ├── ejecutar_rutina.py                  ← Punto de entrada de la rutina
│   ├── verificar_env.py                    ← Diagnóstico de configuración
│   ├── programar_tarea_windows.ps1         ← Setup de Windows Task Scheduler
│   └── README.md                           ← Instrucciones de la rutina
├── .gitignore
├── .env.example                            ← Plantilla de variables de entorno
├── requirements.txt
└── README.md                               ← Este archivo
```

## Configuración inicial

### 1. Instalar dependencias

```bash
pip install -r requirements.txt
```

### 2. Crear el archivo .env

```bash
cp .env.example .claude/skills/bitacoras-academicas/.env
# Editar con tus credenciales reales
```

Ver la guía completa en:
`.claude/skills/bitacoras-academicas/references/configuracion.md`

### 3. Verificar que todo está configurado

```bash
python rutina/verificar_env.py
```

### 4. Programar la rutina automática (Windows)

```powershell
# PowerShell como Administrador
.\rutina\programar_tarea_windows.ps1
```

Las tareas `Bitacoras Promo 10` y `Bitacoras Promo 25` quedarán registradas en Windows Task Scheduler.

## Ejecución manual

```bash
# Ejecutar el proceso completo ahora
python rutina/ejecutar_rutina.py

# O directamente el script principal
python .claude/skills/bitacoras-academicas/scripts/crear_bitacoras.py
```

## Estructura de carpetas en Drive

```
BITACORAS/
└── 2026/
    └── 05. PROM MAYO/
        ├── PROM 10 MAYO 2026/
        │   ├── GENERAL/
        │   └── AVANZADOS/
        │       └── BITACORAS CONSULTOR/
        └── PROM 25 MAYO 2026/
            ├── GENERAL/
            └── AVANZADOS/
                └── BITACORAS CONSULTOR/
```

## Niveles de ingreso

| Nivel | GENERAL | AVANZADOS |
|-------|---------|-----------|
| Desde cero (0 ventas) | ✓ | — |
| Básico sin ventas | ✓ | — |
| Básico con ventas (10 a 100) | ✓ | — |
| Escalando ventas | ✓ | — |
| **Avanzado (+ de 500 ventas)** | ✓ | ✓ |

## Credenciales necesarias

Ver `.env.example` y `configuracion.md` para el detalle completo.

- `GHL_API_KEY` — API key de GoHighLevel
- `GHL_LOCATION_ID` — ID de tu location en GHL
- `GHL_FIELD_ID_*` — IDs de los custom fields en GHL
- `BITACORAS_ROOT_ID` — ID de la carpeta "BITACORAS" en Google Drive
- `GOOGLE_CREDENTIALS_PATH` — Ruta al JSON del Service Account de Google
