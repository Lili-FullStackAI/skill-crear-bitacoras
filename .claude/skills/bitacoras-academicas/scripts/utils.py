import logging
import os
from pathlib import Path

MESES = {
    1: "ENERO", 2: "FEBRERO", 3: "MARZO", 4: "ABRIL",
    5: "MAYO", 6: "JUNIO", 7: "JULIO", 8: "AGOSTO",
    9: "SEPTIEMBRE", 10: "OCTUBRE", 11: "NOVIEMBRE", 12: "DICIEMBRE"
}

# Directorio base de la skill (dos niveles arriba del script)
SKILL_DIR = Path(__file__).resolve().parent.parent


def setup_logger(log_dir=None):
    """
    Configura el logger 'bitacoras'.
    Idempotente: no agrega handlers duplicados si se llama más de una vez.
    """
    logger = logging.getLogger("bitacoras")

    if logger.handlers:
        return logger  # Ya configurado

    logger.setLevel(logging.DEBUG)

    # Log a archivo (relativo a la skill, no al CWD)
    if log_dir is None:
        log_dir = SKILL_DIR / "logs"
    Path(log_dir).mkdir(parents=True, exist_ok=True)

    file_handler = logging.FileHandler(
        Path(log_dir) / "bitacoras_creadas.log",
        encoding="utf-8"
    )
    file_handler.setFormatter(
        logging.Formatter("[%(asctime)s] %(message)s", datefmt="%Y-%m-%d %H:%M:%S")
    )

    # Log a consola
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(logging.Formatter("%(message)s"))

    logger.addHandler(file_handler)
    logger.addHandler(console_handler)
    return logger


# ─────────────────────────────────────────────
# Parseo de fechas de promoción
# ─────────────────────────────────────────────

def parse_promocion_date(promocion_str):
    """
    Parsea "10 mayo 2026" → (dia=10, mes_num=5, año=2026, mes_nombre="MAYO").
    Acepta el mes en cualquier capitalización.
    Retorna None si el formato no es válido.
    """
    try:
        partes = promocion_str.strip().split()
        if len(partes) < 3:
            return None

        dia = int(partes[0])
        mes_input = partes[1].upper()
        año = int(partes[2])

        # Buscar mes por los primeros 3 caracteres (tolerante a abreviaciones)
        mes_num = next(
            (num for num, nombre in MESES.items() if nombre.startswith(mes_input[:3])),
            None
        )
        if mes_num is None:
            return None

        return (dia, mes_num, año, MESES[mes_num])
    except (ValueError, AttributeError):
        return None


def get_folder_names(promocion_str):
    """
    Retorna los nombres exactos de carpetas para una promoción.
    Ejemplo para "10 mayo 2026":
      { 'año': '2026', 'mes': '05. PROM MAYO', 'promocion': 'PROM 10 MAYO 2026' }
    Retorna None si el formato es inválido.
    """
    fecha = parse_promocion_date(promocion_str)
    if not fecha:
        return None

    dia, mes_num, año, mes_nombre = fecha
    return {
        'año':      str(año),
        'mes':      f"{mes_num:02d}. PROM {mes_nombre}",
        'promocion': f"PROM {dia} {mes_nombre} {año}",
    }


# ─────────────────────────────────────────────
# Niveles de ingreso
# ─────────────────────────────────────────────

def es_avanzado(nivel_ingreso):
    """
    Determina si un estudiante recibe documento en AVANZADOS/BITACORAS CONSULTOR
    además del de GENERAL.

    Niveles SOLO en GENERAL:
      - Desde cero (0 ventas)
      - Básico sin ventas

    Niveles en GENERAL + AVANZADOS:
      - Básico con ventas (10 a 100)
      - Escalando ventas
      - Avanzado (+ de 500 ventas)
    """
    if not nivel_ingreso:
        return False

    nivel_lower = nivel_ingreso.lower().strip()

    # Patterns que disparan AVANZADOS:
    #  "con ventas"  → "Básico con ventas (10 a 100)"  (no matchea "sin ventas")
    #  "escalando"   → "Escalando ventas"
    #  "avanzado"    → "Avanzado (+ de 500 ventas)"
    return any(pattern in nivel_lower for pattern in [
        "con ventas",
        "escalando",
        "avanzado",
    ])


# ─────────────────────────────────────────────
# Formateo de logs
# ─────────────────────────────────────────────

def format_log_creada(e):
    lines = [
        "✓ CREADA",
        f"  Estudiante: {e['nombre']}",
        f"  Promoción:  {e.get('promocion', '')}",
        f"  Nivel:      {e.get('nivel', '')}",
        f"  Ruta:       {e.get('ruta_general', '')}",
        f"  Doc General:   {e.get('doc_general_url', 'N/A')}",
    ]
    if e.get('doc_avanzado_url'):
        lines.append(f"  Doc Avanzado:  {e['doc_avanzado_url']}")
    lines.append(f"  GHL actualizado: {'SÍ' if e.get('ghl_actualizado') else 'NO'}")
    return "\n".join(lines)


def format_log_existe(e):
    return f"⚠ YA EXISTÍA\n  Estudiante: {e['nombre']}\n  Acción: Saltado sin modificar"


def format_log_error(e, motivo):
    nombre = e.get('nombre', 'DESCONOCIDO') if isinstance(e, dict) else str(e)
    return f"✗ ERROR\n  Estudiante: {nombre}\n  Motivo: {motivo}\n  Acción: Requiere revisión manual"


def format_resumen(creadas, existentes, errores, total):
    sep = "═" * 35
    return (
        f"\n{sep}\n"
        f"RESUMEN\n"
        f"Total procesados: {total}\n"
        f"Creadas nuevas:   {creadas}\n"
        f"Ya existían:      {existentes}\n"
        f"Errores:          {errores}\n"
        f"{sep}\n"
    )
