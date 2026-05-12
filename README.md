# skill-crear-bitacoras

Automatización que crea bitácoras académicas en Google Drive para estudiantes nuevos de Master Escala registrados en GoHighLevel (GHL), y guarda el link en el contacto.

## ⚡ Stack actual

**Google Apps Script** (corriendo en script.google.com con la cuenta Workspace de Master Escala).

Ver código completo: [`apps-script/Code.gs`](./apps-script/Code.gs)

Ver instrucciones de setup: [`apps-script/README.md`](./apps-script/README.md)

## Qué hace

Cada 4 horas (trigger automático):

1. Lee contactos de GHL con tag `estudiante nuevo`
2. Crea estructura de carpetas en Drive si no existe
3. Crea bitácoras con diseño Master Escala (logo + tablas + tipografía)
4. Para niveles con experiencia: también crea bitácora avanzada
5. Guarda el link en el custom field `bitacora_url` de GHL
6. Cambia el tag a `bitacora_creada`

## ⚠️ Garantía de no-borrado

`procesarBitacoras` (la función automática) **NUNCA toca** docs existentes. Si la bitácora ya existe, la deja intacta — protegiendo el contenido que escribieron los consultores.

La única función que reescribe contenido es `recrearTodasLasBitacoras`, y solo se ejecuta manualmente cuando se necesita refrescar el diseño.

## Estructura de carpetas

```
BITACORAS/
└── 2026/
    └── 05. PROM MAYO/
        └── PROM 10 MAYO 2026/
            ├── GENERAL/       ← todos los estudiantes
            └── AVANZADOS/     ← solo niveles con experiencia
```

## Reglas de nivel

| Nivel | GENERAL | AVANZADA |
|---|:---:|:---:|
| Desde cero (0 ventas) | ✓ | — |
| Básico sin ventas | ✓ | — |
| **Básico con ventas (10 a 100)** | ✓ | ✓ |
| **Escalando ventas** | ✓ | ✓ |
| **Avanzado (+ de 500 ventas)** | ✓ | ✓ |

## Por qué Apps Script (y no Python + GitHub Actions)

La política `iam.disableServiceAccountKeyCreation` de la organización masterescala.co bloquea la generación de JSON keys de Service Account, lo que hacía imposible autenticar Python desde GitHub Actions contra Google Drive. Apps Script no necesita Service Account porque corre nativo en Workspace con la cuenta del dueño del script — cero fricción de autenticación, cero infraestructura adicional, y gratis.

## Historial

Este repo nació como un proyecto Python que se ejecutaba en GitHub Actions. Esa implementación se descartó por el bloqueo de la org policy. El código vive ahora en Apps Script — ver carpeta `apps-script/`.
