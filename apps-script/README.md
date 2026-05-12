# Bitácoras Académicas — Google Apps Script

Código fuente del proyecto que crea las bitácoras de estudiantes nuevos en Google Drive y actualiza GHL.

## Archivo principal

- **`Code.gs`** — todo el código del proyecto (v2.1)

## Dónde corre

Este código vive en Google Apps Script ([script.google.com](https://script.google.com)), con la cuenta Workspace de Master Escala. Este archivo es solo una **copia versionada** del código que está allí.

## Setup (primera vez)

1. Abrir [script.google.com](https://script.google.com) con la cuenta Workspace de Master Escala
2. Crear proyecto nuevo, pegar el contenido de `Code.gs`
3. Configurar las 6 Script Properties (Project Settings → Script Properties):
   - `GHL_API_KEY` — PIT (Private Integration Token) de GHL V2
   - `GHL_LOCATION_ID` — Location ID de GHL
   - `BITACORAS_ROOT_ID` — ID de la carpeta "BITACORAS" en Google Drive
   - `GHL_FIELD_ID_PROMOCION` — ID del custom field "Promoción"
   - `GHL_FIELD_ID_NIVEL` — ID del custom field "Nivel de ingreso"
   - `GHL_FIELD_ID_BITACORA_URL` — ID del custom field "Bitácora URL"
   - `LOGO_FILE_ID` — (opcional) ID del logo Master Escala en Drive
4. Ejecutar `guardarLogoId` una vez para guardar el logo
5. Crear trigger:
   - Función: `procesarBitacoras`
   - Origen: Tiempo → Temporizador por horas → cada 4 horas

## Funciones

### Producción

| Función | Cuándo se usa |
|---|---|
| `procesarBitacoras` | Cada 4 horas (trigger automático). Crea bitácoras solo si no existen. NUNCA toca docs existentes. |

### Mantenimiento manual

| Función | Cuándo se usa |
|---|---|
| `diagnosticarGHL` | Verificar que la API key y el location ID funcionan |
| `verificarLinksEstudiantes` | Auditoría: confirma que cada link en GHL apunta a la bitácora correcta |
| `eliminarCarpetasConsultorViejas` | Mover a papelera las subcarpetas viejas (estructura previa a v2.1) |
| `guardarLogoId` | Guardar/actualizar el ID del logo |

### ⚠️ Destructiva — usar con cuidado

| Función | Riesgo |
|---|---|
| `recrearTodasLasBitacoras` | **REESCRIBE el contenido** de TODAS las bitácoras existentes. Solo usar cuando se cambia el diseño y se quiere refrescar todas las plantillas. Borra cualquier contenido que hayan escrito los consultores. |

## Reglas de negocio

### Niveles que reciben AVANZADA (además de la GENERAL)

- `Básico con ventas (10 a 100)`
- `Escalando ventas`
- `Avanzado (+ de 500 ventas)`

El resto solo recibe GENERAL.

### Estructura de carpetas en Drive

```
BITACORAS/
└── {AÑO}/
    └── {MES_NUM}. PROM {MES}/
        └── PROM {DIA} {MES} {AÑO}/
            ├── GENERAL/       ← todos los estudiantes
            └── AVANZADOS/     ← solo niveles con experiencia (sin subcarpeta)
```

### Tags GHL

- Detecta: contactos con tag `estudiante nuevo`
- Después de crear bitácora: quita `estudiante nuevo`, agrega `bitacora_creada`

## Versión

**v2.1** — sin subcarpeta `BITACORAS POR EL CONSULTOR` + link de avanzada inyectado en general como hipervínculo clickeable + protección de contenido (no se sobreescriben docs existentes).
