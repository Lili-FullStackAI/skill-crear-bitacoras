#!/usr/bin/env python3
"""
Orquestador principal de bitácoras académicas.
Uso: python scripts/crear_bitacoras.py
"""
import os
import sys
from pathlib import Path

# Cargar .env desde la raíz de la skill (no desde el CWD)
SKILL_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = SKILL_DIR / ".env"

from dotenv import load_dotenv
load_dotenv(dotenv_path=ENV_PATH)

# Agregar scripts/ al path de importación
sys.path.insert(0, str(Path(__file__).parent))

from drive_service import DriveService
from ghl_service import GHLService
from utils import (
    setup_logger, get_folder_names,
    format_log_creada, format_log_existe, format_log_error, format_resumen,
    es_avanzado
)

logger = setup_logger()


def _validate_env():
    """Valida que las variables de entorno requeridas estén presentes."""
    required = ['GHL_API_KEY', 'GHL_LOCATION_ID', 'BITACORAS_ROOT_ID', 'GOOGLE_CREDENTIALS_PATH']
    missing = [v for v in required if not os.getenv(v)]
    if missing:
        logger.error(f"✗ Variables de entorno faltantes: {', '.join(missing)}")
        logger.error(f"  Configura el archivo: {ENV_PATH}")
        sys.exit(1)

    creds_path = os.getenv('GOOGLE_CREDENTIALS_PATH')
    if not Path(creds_path).exists():
        logger.error(f"✗ Archivo de credenciales no encontrado: {creds_path}")
        sys.exit(1)


class BitacorasOrquestador:
    def __init__(self):
        self.drive = DriveService(os.getenv('GOOGLE_CREDENTIALS_PATH'))
        self.ghl = GHLService(os.getenv('GHL_API_KEY'), os.getenv('GHL_LOCATION_ID'))
        self.root_id = os.getenv('BITACORAS_ROOT_ID')

        self.creadas = 0
        self.existentes = 0
        self.errores = 0
        self.procesadas = 0

    def procesar_todos(self):
        logger.info("=" * 50)
        logger.info("INICIANDO CREACIÓN DE BITÁCORAS ACADÉMICAS")
        logger.info("=" * 50)

        estudiantes = self.ghl.get_new_students()

        if not estudiantes:
            logger.info("⚠ No se encontraron estudiantes con etiqueta 'nuevo estudiante'")
            logger.info(format_resumen(0, 0, 0, 0))
            return

        logger.info(f"→ {len(estudiantes)} estudiante(s) a procesar\n")

        for estudiante in estudiantes:
            self.procesadas += 1
            self._procesar(estudiante)

        logger.info(format_resumen(self.creadas, self.existentes, self.errores, self.procesadas))

    def _procesar(self, est):
        nombre = est.get('nombre', 'DESCONOCIDO')
        logger.info(f"\nProcesando: {nombre}")

        # ── Validación ────────────────────────────────────────────
        if not nombre:
            logger.info(format_log_error(est, "Nombre vacío en GHL"))
            self.errores += 1
            return

        if not est.get('promocion'):
            logger.info(format_log_error(est, "Campo 'promocion' vacío en GHL"))
            self.errores += 1
            return

        if not est.get('nivel'):
            logger.info(format_log_error(est, "Campo 'nivel de ingreso' vacío en GHL"))
            self.errores += 1
            return

        # ── Estructura de carpetas ────────────────────────────────
        carpetas = self._crear_carpetas(est['promocion'])
        if not carpetas:
            logger.info(format_log_error(est, "Falla al crear/acceder carpetas en Drive"))
            self.errores += 1
            return

        avanzado = es_avanzado(est['nivel'])

        # ── Documento AVANZADOS (solo si aplica, primero) ─────────
        doc_avanzado_url = None
        if avanzado:
            doc_adv_id, doc_avanzado_url = self._obtener_o_crear_doc(
                f"Bitacora - {nombre}",
                carpetas['avanzados'],
                plantilla='avanzados'
            )
            if not doc_adv_id:
                logger.info(format_log_error(est, "Falla al crear documento en AVANZADOS"))
                self.errores += 1
                return

        # ── Documento GENERAL (todos) ─────────────────────────────
        doc_gen_id, doc_gen_url = self._obtener_o_crear_doc(
            f"Bitacora - {nombre}",
            carpetas['general'],
            plantilla='general',
            doc_avanzado_url=doc_avanzado_url
        )

        if not doc_gen_id:
            logger.info(format_log_error(est, "Falla al crear documento en GENERAL"))
            self.errores += 1
            return

        # Si ambos documentos ya existían, registrar y saltar
        if doc_gen_id.startswith('existe:'):
            logger.info(format_log_existe(est))
            self.existentes += 1
            return

        # ── Actualizar GHL ────────────────────────────────────────
        ghl_ok = self.ghl.update_contact_bitacora(
            est['id'],
            doc_gen_url,
            doc_avanzado_url if avanzado else None
        )

        # ── Log de éxito ──────────────────────────────────────────
        folders = get_folder_names(est['promocion'])
        est['ruta_general'] = (
            f"{folders['año']} > {folders['mes']} > {folders['promocion']} > GENERAL"
        )
        est['doc_general_url'] = doc_gen_url
        if avanzado:
            est['doc_avanzado_url'] = doc_avanzado_url
        est['ghl_actualizado'] = ghl_ok

        logger.info(format_log_creada(est))
        self.creadas += 1

    def _crear_carpetas(self, promocion_str):
        """Crea/verifica la jerarquía completa de carpetas. Retorna dict con IDs."""
        folders = get_folder_names(promocion_str)
        if not folders:
            logger.error(f"✗ Formato de promoción inválido: '{promocion_str}'")
            return None

        # Nivel 1 — Año
        id_año = self.drive.ensure_folder_exists(folders['año'], self.root_id)
        if not id_año:
            return None

        # Nivel 2 — Mes numerado
        id_mes = self.drive.ensure_folder_exists(folders['mes'], id_año)
        if not id_mes:
            return None

        # Nivel 3 — Promoción específica
        id_promo = self.drive.ensure_folder_exists(folders['promocion'], id_mes)
        if not id_promo:
            return None

        # Nivel 4 — Subcarpetas internas
        id_general = self.drive.ensure_folder_exists('GENERAL', id_promo)
        id_avanzados = self.drive.ensure_folder_exists('AVANZADOS', id_promo)

        if not id_avanzados:
            return None

        id_consultor = self.drive.ensure_folder_exists('BITACORAS CONSULTOR', id_avanzados)

        if not all([id_general, id_consultor]):
            return None

        return {
            'año':      id_año,
            'mes':      id_mes,
            'promocion': id_promo,
            'general':  id_general,
            'avanzados': id_consultor    # apunta a AVANZADOS/BITACORAS CONSULTOR
        }

    def _obtener_o_crear_doc(self, titulo, parent_id, plantilla, doc_avanzado_url=None):
        """
        Si el documento ya existe lo devuelve con el prefijo 'existe:'.
        Si no existe, lo crea con la plantilla indicada.
        Retorna (doc_id, url).
        """
        doc_id, doc_url = self.drive.document_exists(titulo, parent_id)
        if doc_id:
            logger.debug(f"  → Documento ya existe: '{titulo}'")
            return f'existe:{doc_id}', doc_url

        contenido = self._cargar_plantilla(plantilla, doc_avanzado_url)
        return self.drive.create_document(titulo, parent_id, contenido)

    def _cargar_plantilla(self, plantilla, doc_avanzado_url=None):
        """Carga el contenido de la plantilla desde assets/."""
        assets_dir = SKILL_DIR / "assets"
        archivo = assets_dir / (
            "plantilla_general.md" if plantilla == 'general' else "plantilla_avanzados.md"
        )

        try:
            contenido = archivo.read_text(encoding='utf-8')

            if plantilla == 'general' and doc_avanzado_url:
                contenido = contenido.replace(
                    'Enlace Bitácora Avanzada: ',
                    f'Enlace Bitácora Avanzada: {doc_avanzado_url}'
                )
            return contenido
        except Exception as e:
            logger.error(f"✗ Error cargando plantilla '{plantilla}': {str(e)}")
            return ""


def main():
    _validate_env()
    try:
        orquestador = BitacorasOrquestador()
        orquestador.procesar_todos()
    except Exception as e:
        logger.critical(f"✗ Error crítico inesperado: {str(e)}", exc_info=True)
        sys.exit(1)


if __name__ == '__main__':
    main()
