# skill-crear-bitacoras

Automatiza la creación de bitácoras académicas en Google Drive para estudiantes nuevos registrados en GoHighLevel (GHL).

[![Crear Bitácoras](https://github.com/Lili-FullStackAI/skill-crear-bitacoras/actions/workflows/bitacoras.yml/badge.svg)](https://github.com/Lili-FullStackAI/skill-crear-bitacoras/actions/workflows/bitacoras.yml)

## Qué hace

Cada **4 horas** (automáticamente, en GitHub Actions):

1. Lee los contactos de GHL con la etiqueta `nuevo estudiante`
2. Crea la estructura de carpetas en Google Drive si no existe
3. Genera los documentos de bitácora con la plantilla correcta
4. Actualiza GHL con los links de los documentos y cambia el tag a `bitacora_creada`
5. Genera un log detallado de todo lo procesado

**Latencia máxima** entre que un estudiante paga (recibe tag `nuevo estudiante`) y se crea su bitácora: **~4 horas**.

## Estructura del proyecto

```
skill-crear-bitacoras/
├── .github/
│   └── workflows/
│       └── bitacoras.yml                    ← Rutina automatizada en GitHub Actions
├── .claude/
│   └── skills/
│       └── bitacoras-academicas/
│           ├── SKILL.md                     ← Descripción de la skill para Claude
│           ├── .env.example                 ← Plantilla de variables (solo dev local)
│           ├── requirements.txt
│           ├── assets/
│           │   ├── plantilla_general.md     ← Plantilla para TODOS los estudiantes
│           │   └── plantilla_avanzados.md   ← Plantilla solo para nivel avanzado
│           ├── references/
│           │   ├── configuracion.md         ← Guía de setup local + Google Cloud
│           │   └── github-actions-setup.md  ← Guía de setup en GitHub Actions
│           └── scripts/
│               ├── crear_bitacoras.py       ← Orquestador principal
│               ├── drive_service.py         ← Lógica Google Drive
│               ├── ghl_service.py           ← Lógica GoHighLevel
│               └── utils.py                 ← Utilidades compartidas
├── .gitignore
└── README.md                                ← Este archivo
```

## Setup en producción (GitHub Actions)

**El proceso corre solo, en la nube de GitHub. No depende de tu PC.**

1. Crear los GitHub Secrets requeridos. Guía completa:
   `.claude/skills/bitacoras-academicas/references/github-actions-setup.md`

2. Confirmar que el workflow está activo:
   [github.com/Lili-FullStackAI/skill-crear-bitacoras/actions](https://github.com/Lili-FullStackAI/skill-crear-bitacoras/actions)

3. Para ejecutar manualmente sin esperar al próximo run:
   - Pestaña **Actions** del repo
   - Click en **"Crear Bitácoras Académicas"**
   - Click en **"Run workflow"**

## Setup local (desarrollo / debugging)

Si quieres ejecutar el script en tu PC para probar o debuggear:

### 1. Instalar dependencias

```bash
cd .claude/skills/bitacoras-academicas
pip install -r requirements.txt
```

### 2. Crear el archivo .env

```bash
cp .env.example .env
# Editar con tus credenciales reales
```

Guía completa: `references/configuracion.md`

### 3. Ejecutar

```bash
python scripts/crear_bitacoras.py
```

## Estructura de carpetas que mantiene en Drive

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

## Cómo monitorear

- **Logs en GitHub:** pestaña Actions → cualquier ejecución → ver el output completo
- **Logs descargables:** cada ejecución incluye un Artifact con el `bitacoras_creadas.log` completo
- **Notificaciones de fallo:** GitHub te envía email automático si un workflow falla

## Cambiar la cadencia

Editar `.github/workflows/bitacoras.yml` y modificar el cron:

```yaml
- cron: '0 */4 * * *'    # cada 4h (default)
- cron: '0 */2 * * *'    # cada 2h
- cron: '0 * * * *'      # cada hora
```

Después: commit + push, y GitHub aplica el cambio en el próximo run.

## Costos

- **GitHub Actions:** gratis (~90 min/mes de los 2000 disponibles)
- **GHL:** dentro de tu plan actual (rate limit: 100 req/10s, sobra)
- **Google Drive API:** gratis hasta 1000 req/100s (sobra)

## Credenciales necesarias

Ver `references/github-actions-setup.md` para configurarlas como GitHub Secrets:

- `GHL_API_KEY` — API key de GoHighLevel
- `GHL_LOCATION_ID` — Location ID
- `GHL_FIELD_ID_*` — IDs de los 6 custom fields en GHL
- `BITACORAS_ROOT_ID` — ID de la carpeta "BITACORAS" en Drive
- `GOOGLE_CREDENTIALS_JSON` — Contenido completo del JSON del Service Account
