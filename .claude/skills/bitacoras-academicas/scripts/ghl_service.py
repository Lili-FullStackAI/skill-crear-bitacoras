import requests
import logging
import os

logger = logging.getLogger("bitacoras")

# GHL API v1 — rest.gohighlevel.com
# Los custom fields en la respuesta de la API son una lista:
#   [{"id": "field_id", "value": "field_value"}, ...]
# Para actualizar se envía el mismo formato.

class GHLService:
    def __init__(self, api_key, location_id):
        self.api_key = api_key
        self.location_id = location_id
        self.base_url = "https://rest.gohighlevel.com/v1"
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        # IDs de custom fields en GHL (configurables en .env)
        # NOTA: 'pais_residencia' NO está aquí porque es un campo ESTÁNDAR de GHL
        # (contact.country), no un custom field.
        # NOTA: 'pais_venta' NO se auto-llena — el consultor lo registra en sesión 1
        # (cada estudiante puede vender en múltiples países).
        self.field_ids = {
            'promocion':               os.getenv('GHL_FIELD_ID_PROMOCION', ''),
            'nivel_de_ingreso':        os.getenv('GHL_FIELD_ID_NIVEL', ''),
            'bitacora_url':            os.getenv('GHL_FIELD_ID_BITACORA_URL', ''),
            'bitacora_consultor_url':  os.getenv('GHL_FIELD_ID_BITACORA_CONSULTOR_URL', ''),
        }

    # ─────────────────────────────────────────────
    # Lectura de contactos
    # ─────────────────────────────────────────────

    def get_new_students(self):
        """
        Obtiene TODOS los contactos con etiqueta 'nuevo estudiante'.
        Maneja paginación (GHL devuelve max 100 por página).
        """
        all_students = []
        start_after = None

        while True:
            params = {
                'locationId': self.location_id,
                'limit': 100,
                'query': 'nuevo estudiante'
            }
            if start_after:
                params['startAfterId'] = start_after

            try:
                response = requests.get(
                    f"{self.base_url}/contacts",
                    headers=self.headers,
                    params=params
                )
                response.raise_for_status()
                data = response.json()
            except Exception as e:
                logger.error(f"✗ Error obteniendo contactos de GHL: {str(e)}")
                break

            contacts = data.get('contacts', [])

            for contact in contacts:
                tags = [t.lower() for t in contact.get('tags', [])]
                if 'nuevo estudiante' in tags:
                    all_students.append(self._parse_contact(contact))

            # Paginación: GHL usa 'meta.nextPageUrl' o 'meta.startAfterId'
            meta = data.get('meta', {})
            next_page = meta.get('nextPageUrl') or meta.get('startAfterId')

            if not next_page or len(contacts) < 100:
                break
            start_after = meta.get('startAfterId')

        logger.debug(f"✓ {len(all_students)} estudiantes nuevos encontrados en GHL")
        return all_students

    def _parse_contact(self, contact):
        """
        Parsea un contacto de GHL.
        customFields en GHL API v1 es una lista: [{id, value}, ...]
        Se mapea usando los IDs configurados en .env.
        """
        custom_map = self._custom_fields_to_dict(contact.get('customFields', []))

        nombre = f"{contact.get('firstName', '')} {contact.get('lastName', '')}".strip()

        return {
            'id':              contact.get('id'),
            'nombre':          nombre,
            'email':           contact.get('email', ''),
            'telefono':        contact.get('phone', ''),
            # Campo ESTÁNDAR de GHL — viene directo en el contacto
            'pais_residencia': contact.get('country', ''),
            # Custom fields — vienen mapeados por ID
            'promocion':       custom_map.get(self.field_ids['promocion'], ''),
            'nivel':           custom_map.get(self.field_ids['nivel_de_ingreso'], ''),
            'tags':            contact.get('tags', [])
        }

    def _custom_fields_to_dict(self, custom_fields_list):
        """
        Convierte la lista [{id, value}, ...] de GHL a un dict {id: value}.
        """
        if isinstance(custom_fields_list, dict):
            # Fallback por si la API cambia a dict
            return custom_fields_list
        result = {}
        for field in (custom_fields_list or []):
            field_id = field.get('id', '')
            value = field.get('value') or field.get('fieldValue', '')
            if field_id:
                result[field_id] = str(value) if value is not None else ''
        return result

    # ─────────────────────────────────────────────
    # Actualización de contactos
    # ─────────────────────────────────────────────

    def update_contact_bitacora(self, contact_id, doc_general_url, doc_avanzado_url=None):
        """
        Actualiza el contacto en GHL:
        - Agrega links de bitácoras en los custom fields
        - Agrega etiqueta 'bitacora_creada' SIN quitar otras etiquetas
        - Quita etiqueta 'nuevo estudiante'
        """
        try:
            # Obtener estado actual del contacto
            contact_data = self._get_contact(contact_id)
            if not contact_data:
                return False

            current_tags = contact_data.get('tags', [])

            # Calcular nuevos tags: agregar 'bitacora_creada', quitar 'nuevo estudiante'
            new_tags = [t for t in current_tags if t.lower() != 'nuevo estudiante']
            if 'bitacora_creada' not in [t.lower() for t in new_tags]:
                new_tags.append('bitacora_creada')

            # Construir custom fields a actualizar
            fields_to_update = []

            if self.field_ids['bitacora_url']:
                fields_to_update.append({
                    'id': self.field_ids['bitacora_url'],
                    'value': doc_general_url
                })

            if doc_avanzado_url and self.field_ids['bitacora_consultor_url']:
                fields_to_update.append({
                    'id': self.field_ids['bitacora_consultor_url'],
                    'value': doc_avanzado_url
                })

            payload = {
                'tags': new_tags,
                'customFields': fields_to_update
            }

            response = requests.put(
                f"{self.base_url}/contacts/{contact_id}",
                headers=self.headers,
                json=payload
            )
            response.raise_for_status()

            logger.debug(f"  → GHL actualizado: tags={new_tags}, fields={len(fields_to_update)}")
            return True

        except Exception as e:
            logger.error(f"✗ Error actualizando contacto {contact_id} en GHL: {str(e)}")
            return False

    def _get_contact(self, contact_id):
        """Obtiene un contacto por ID. Retorna el dict del contacto o None."""
        try:
            response = requests.get(
                f"{self.base_url}/contacts/{contact_id}",
                headers=self.headers
            )
            response.raise_for_status()
            return response.json().get('contact', {})
        except Exception as e:
            logger.error(f"✗ Error obteniendo contacto {contact_id}: {str(e)}")
            return None
