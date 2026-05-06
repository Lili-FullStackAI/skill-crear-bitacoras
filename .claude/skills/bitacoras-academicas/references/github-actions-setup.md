# Setup de GitHub Actions

Este documento explica cómo configurar la ejecución automática del proceso de bitácoras en GitHub Actions, **sin depender de tu PC**.

## Cómo funciona

- El workflow `.github/workflows/bitacoras.yml` corre **cada 4 horas**, automáticamente.
- En cada ejecución busca contactos nuevos en GHL y crea sus bitácoras.
- Los logs quedan disponibles en la pestaña **Actions** del repo durante 30 días.
- También se puede ejecutar manualmente desde GitHub.

**Cadencia configurada:** cada 4 horas (00, 04, 08, 12, 16, 20 UTC).
En Bogotá: aprox. cada 4h durante todo el día.
**Latencia máxima** entre que un estudiante paga y se crea su bitácora: ~4 horas.

---

## Configurar Secrets en GitHub

Las credenciales NO van en el código. Se guardan encriptadas como GitHub Secrets.

### 1. Ir a la configuración de Secrets del repo

```
https://github.com/Lili-FullStackAI/skill-crear-bitacoras/settings/secrets/actions
```

O desde el repo:
```
Settings → Secrets and variables → Actions → New repository secret
```

### 2. Agregar estos 8 secrets

| Nombre del Secret | Valor a poner |
|---|---|
| `GHL_API_KEY` | Tu API key de GoHighLevel |
| `GHL_LOCATION_ID` | El Location ID de GHL |
| `GHL_FIELD_ID_PROMOCION` | ID del custom field "Promoción" |
| `GHL_FIELD_ID_NIVEL` | ID del custom field "Nivel de ingreso" |
| `GHL_FIELD_ID_PAIS_VENTA` | ID del custom field "País de venta" |
| `GHL_FIELD_ID_BITACORA_URL` | ID del custom field "Bitácora URL" |
| `GHL_FIELD_ID_BITACORA_CONSULTOR_URL` | ID del custom field "Bitácora Consultor URL" |
| `BITACORAS_ROOT_ID` | ID de la carpeta "BITACORAS" en Google Drive |
| `GOOGLE_CREDENTIALS_JSON` | **El contenido completo** del JSON del Service Account |

> **Nota:** "País de residencia" NO necesita un secret porque es un **campo estándar** de GHL (`contact.country`), no un custom field. El script lo lee automáticamente.

### 3. Caso especial: `GOOGLE_CREDENTIALS_JSON`

⚠️ Este secret es diferente — se guarda **el contenido del archivo JSON completo**, no una ruta.

1. Abrir el archivo `google-credentials.json` que descargaste de Google Cloud
2. Copiar TODO su contenido (desde `{` hasta `}`)
3. Pegarlo como valor del secret `GOOGLE_CREDENTIALS_JSON`

Ejemplo del contenido:
```json
{
  "type": "service_account",
  "project_id": "tu-proyecto",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "bitacoras@tu-proyecto.iam.gserviceaccount.com",
  ...
}
```

GitHub lo almacena encriptado. El workflow lo escribe a un archivo temporal en cada ejecución y lo elimina al terminar.

---

## Ejecutar manualmente

Para correr el proceso sin esperar al próximo schedule:

```
https://github.com/Lili-FullStackAI/skill-crear-bitacoras/actions
```

→ Click en **"Crear Bitácoras Académicas"** (en el sidebar izquierdo)
→ Click en **"Run workflow"** (botón gris arriba a la derecha)
→ Click en **"Run workflow"** (botón verde)

Resultado: comienza una ejecución en 5-10 segundos.

---

## Ver logs

Después de cada ejecución (programada o manual):

1. Ir a la pestaña **Actions**
2. Click en la ejecución que quieras revisar
3. Click en el job **"Procesar nuevos estudiantes"**
4. Expandir el step **"Ejecutar script de creación de bitácoras"** para ver el output completo

Además, los logs detallados (`bitacoras_creadas.log`) quedan disponibles como **Artifact** descargable en la parte inferior de cada run.

---

## Cambiar la cadencia

Editar `.github/workflows/bitacoras.yml`, línea del cron:

```yaml
- cron: '0 */4 * * *'    # cada 4 horas (default)
- cron: '0 */2 * * *'    # cada 2 horas
- cron: '0 * * * *'      # cada hora
- cron: '*/30 * * * *'   # cada 30 minutos (¡ojo con rate limits de GHL!)
- cron: '0 13 * * *'     # diario a las 8 AM Bogotá
- cron: '0 13,21 * * *'  # 2x al día: 8 AM y 4 PM Bogotá
```

> ⚠️ Los crons en GitHub Actions usan **UTC**. Bogotá es UTC-5.

Después de editar el archivo:
```bash
git add .github/workflows/bitacoras.yml
git commit -m "ajustar cadencia del workflow"
git push
```

GitHub aplica el cambio automáticamente en la próxima ejecución.

---

## Pausar / desactivar el workflow

Sin borrarlo:
```
Actions → Crear Bitácoras Académicas → ⋯ (menú) → Disable workflow
```

Para reactivarlo, mismo menú → "Enable workflow".

---

## Costos

GitHub Actions ofrece **2000 minutos/mes gratis** en cuentas Free.

Esta rutina consume ~30 segundos por ejecución × 6 ejecuciones/día = 3 min/día = **~90 minutos/mes**.

Margen de sobra. Sin tarjeta de crédito requerida.

---

## Notificaciones de fallos

Por default, GitHub envía un email a la dueña del repo cuando un workflow falla.

Para personalizar:
```
Settings → Notifications → Actions → Send notifications for failed workflows only
```
