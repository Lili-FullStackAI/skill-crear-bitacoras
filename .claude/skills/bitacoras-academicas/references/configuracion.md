# Configuración — Bitácoras Académicas

## Archivo .env

Crea `.env` en la raíz de la skill (junto a `SKILL.md`):

```env
# ── GoHighLevel ──────────────────────────────────────────────
GHL_API_KEY=tu_api_key_aqui
GHL_LOCATION_ID=tu_location_id_aqui

# IDs de los Custom Fields en GHL
# (se obtienen desde GHL → Settings → Custom Fields)
# NOTA: pais_residencia NO necesita ID — es campo estándar de GHL (contact.country)
GHL_FIELD_ID_PROMOCION=
GHL_FIELD_ID_NIVEL=
GHL_FIELD_ID_PAIS_VENTA=
GHL_FIELD_ID_BITACORA_URL=
GHL_FIELD_ID_BITACORA_CONSULTOR_URL=

# ── Google Drive ──────────────────────────────────────────────
BITACORAS_ROOT_ID=id_de_la_carpeta_BITACORAS_en_drive
GOOGLE_CREDENTIALS_PATH=C:\ruta\completa\google-credentials.json
```

---

## Cómo obtener cada variable

### GHL_API_KEY
```
GHL Dashboard → Settings → API → copia la API Key
```

### GHL_LOCATION_ID
```
GHL Dashboard → Settings → Locations → copia el Location ID
```

### IDs de Custom Fields en GHL

Estos son los IDs internos de cada campo personalizado. Sin ellos, el script
no puede leer ni escribir los datos del estudiante correctamente.

```
GHL Dashboard → Settings → Custom Fields
→ Busca cada campo
→ Clic en el campo → copia el "Field Key" o "ID"
```

Campos que necesitas mapear:

| Variable en .env                    | Nombre del campo en GHL          |
|-------------------------------------|----------------------------------|
| GHL_FIELD_ID_PROMOCION              | El campo "Promoción" del contacto|
| GHL_FIELD_ID_NIVEL                  | "Nivel de ingreso"               |
| GHL_FIELD_ID_PAIS_VENTA             | "País de venta"                  |

> **País de residencia NO está en esta tabla** porque es un campo **estándar** de GHL (`contact.country`), no custom. El script lo lee directamente sin necesidad de un ID.
| GHL_FIELD_ID_BITACORA_URL           | "Bitácora URL" (o el que uses)   |
| GHL_FIELD_ID_BITACORA_CONSULTOR_URL | "Bitácora Consultor URL"         |

> Si los campos `bitacora_url` y `bitacora_consultor_url` no existen, créalos
> primero en GHL → Settings → Custom Fields → Add Field → URL.

### BITACORAS_ROOT_ID
```
Google Drive → Abre la carpeta "BITACORAS"
→ La URL es: drive.google.com/drive/folders/[ESTE_ES_EL_ID]
→ Copia ese ID
```

### GOOGLE_CREDENTIALS_PATH

Ver sección "Setup Google Cloud" abajo.

---

## Setup Google Cloud

### 1. Crear Service Account

```
https://console.cloud.google.com
→ Selecciona o crea un proyecto
→ APIs & Services → Library → habilitar:
   ✓ Google Drive API
   ✓ Google Docs API
→ APIs & Services → Credentials → Create Credentials → Service Account
→ Nombre: bitacoras-academicas
→ Role: Editor (o más específico: Drive + Docs)
```

### 2. Descargar JSON de credenciales

```
Service Accounts → clic en tu cuenta → Keys
→ Add Key → Create new key → JSON
→ Se descarga un archivo como: proyecto-abc123.json
```

### 3. Compartir carpeta BITACORAS con el Service Account

```
Google Drive → Carpeta "BITACORAS" → Share (compartir)
→ Pega el email del Service Account (está en el JSON, campo "client_email")
   Ejemplo: bitacoras-academicas@tu-proyecto.iam.gserviceaccount.com
→ Acceso: Editor
→ Guardar
```

### 4. Configurar en .env

```env
GOOGLE_CREDENTIALS_PATH=C:\Users\tuusuario\proyecto\google-credentials.json
```

Usa la ruta COMPLETA, no relativa.

---

## Verificar que todo esté bien

Ejecuta el verificador antes del script real:

```bash
python rutina/verificar_env.py
```

Deberías ver algo como:
```
✓ GHL_API_KEY configurado
✓ GHL_LOCATION_ID configurado
✓ BITACORAS_ROOT_ID configurado
✓ GOOGLE_CREDENTIALS_PATH: C:\...\google-credentials.json
✓ Archivo de credenciales existe
✓ Conexión a GHL exitosa
✓ Conexión a Drive exitosa
✓ Carpeta BITACORAS accesible

Configuración correcta. Puedes ejecutar el script.
```

---

## Troubleshooting

| Error | Causa | Solución |
|-------|-------|----------|
| `credentials not found` | Ruta incorrecta | Usa ruta absoluta en `GOOGLE_CREDENTIALS_PATH` |
| `Permission denied` en Drive | Service Account sin acceso | Compartir carpeta BITACORAS con el email del SA |
| `Invalid API key` | API key de GHL incorrecta | Copiar nuevamente desde GHL Settings |
| `customFields vacíos` | IDs de campos mal configurados | Revisar IDs en GHL → Settings → Custom Fields |
| `No se encontraron estudiantes` | Sin contactos con la etiqueta | Verificar que GHL tenga contactos con "nuevo estudiante" |
| `Google Docs API not enabled` | API no habilitada en Cloud | Habilitar en Google Cloud Console → APIs & Services |
