import logging
from googleapiclient.discovery import build
from google.oauth2.service_account import Credentials

logger = logging.getLogger("bitacoras")

SCOPES = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/documents'
]

class DriveService:
    def __init__(self, credentials_path):
        self.credentials_path = credentials_path
        self.credentials = None
        self.drive = None
        self.docs = None
        self._authenticate()

    def _authenticate(self):
        try:
            self.credentials = Credentials.from_service_account_file(
                self.credentials_path,
                scopes=SCOPES
            )
            self.drive = build('drive', 'v3', credentials=self.credentials)
            self.docs = build('docs', 'v1', credentials=self.credentials)
            logger.debug("✓ Autenticado en Google Drive y Docs")
        except Exception as e:
            logger.error(f"✗ Error al autenticar: {str(e)}")
            raise

    def find_folder_by_name(self, name, parent_id=None):
        """Busca una carpeta por nombre dentro de parent_id. Retorna folder_id o None."""
        try:
            # Escapar comillas simples en el nombre para la query
            name_escaped = name.replace("'", "\\'")
            query = (
                f"name='{name_escaped}' "
                "and mimeType='application/vnd.google-apps.folder' "
                "and trashed=false"
            )
            if parent_id:
                query += f" and '{parent_id}' in parents"

            results = self.drive.files().list(
                q=query,
                spaces='drive',
                fields='files(id, name)',
                pageSize=10
            ).execute()

            files = results.get('files', [])
            if files:
                return files[0]['id']
            return None
        except Exception as e:
            logger.error(f"✗ Error buscando carpeta '{name}': {str(e)}")
            return None

    def create_folder(self, name, parent_id=None):
        """Crea una carpeta nueva. Retorna folder_id o None."""
        try:
            metadata = {
                'name': name,
                'mimeType': 'application/vnd.google-apps.folder'
            }
            if parent_id:
                metadata['parents'] = [parent_id]

            folder = self.drive.files().create(
                body=metadata,
                fields='id'
            ).execute()

            folder_id = folder.get('id')
            logger.debug(f"  → Carpeta creada: '{name}' ({folder_id})")
            return folder_id
        except Exception as e:
            logger.error(f"✗ Error creando carpeta '{name}': {str(e)}")
            return None

    def ensure_folder_exists(self, name, parent_id=None):
        """Verifica si existe la carpeta; si no, la crea. Retorna folder_id."""
        folder_id = self.find_folder_by_name(name, parent_id)
        if folder_id:
            logger.debug(f"  → Carpeta ya existe: '{name}' ({folder_id})")
            return folder_id
        return self.create_folder(name, parent_id)

    def document_exists(self, name, parent_id):
        """Verifica si un Google Doc ya existe en una carpeta. Retorna (doc_id, url) o (None, None)."""
        try:
            name_escaped = name.replace("'", "\\'")
            query = (
                f"name='{name_escaped}' "
                "and mimeType='application/vnd.google-apps.document' "
                "and trashed=false "
                f"and '{parent_id}' in parents"
            )
            results = self.drive.files().list(
                q=query,
                spaces='drive',
                fields='files(id, webViewLink)',
                pageSize=1
            ).execute()

            files = results.get('files', [])
            if files:
                return files[0]['id'], files[0]['webViewLink']
            return None, None
        except Exception as e:
            logger.error(f"✗ Error verificando documento '{name}': {str(e)}")
            return None, None

    def create_document(self, title, parent_id, content=""):
        """
        Crea un Google Doc vacío y luego inserta el contenido.
        Retorna (doc_id, url) o (None, None) si falla.
        """
        try:
            metadata = {
                'name': title,
                'mimeType': 'application/vnd.google-apps.document',
                'parents': [parent_id]
            }

            file = self.drive.files().create(
                body=metadata,
                fields='id, webViewLink'
            ).execute()

            doc_id = file.get('id')
            doc_url = file.get('webViewLink')
            logger.debug(f"  → Documento creado: '{title}' ({doc_id})")

            if content:
                self._write_content(doc_id, content)

            return doc_id, doc_url
        except Exception as e:
            logger.error(f"✗ Error creando documento '{title}': {str(e)}")
            return None, None

    def _write_content(self, doc_id, content):
        """
        Escribe contenido en un Google Doc usando la Docs API.
        El doc recién creado tiene el cursor en índice 1.
        """
        try:
            requests_body = [
                {
                    'insertText': {
                        'location': {'index': 1},
                        'text': content
                    }
                }
            ]
            self.docs.documents().batchUpdate(
                documentId=doc_id,
                body={'requests': requests_body}
            ).execute()
            logger.debug(f"  → Contenido insertado en documento {doc_id}")
        except Exception as e:
            logger.warning(f"⚠ No se pudo insertar contenido en {doc_id}: {str(e)}")
