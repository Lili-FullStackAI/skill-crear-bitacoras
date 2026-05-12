// ============================================================
// BITÁCORAS ACADÉMICAS — Master Escala
// Apps Script — v2.1
//
// HOSTING:    Google Apps Script (script.google.com)
// TRIGGER:    Cada 4 horas — procesarBitacoras
// SAFETY:     procesarBitacoras NUNCA toca docs existentes.
//             Solo recrearTodasLasBitacoras (manual) los reescribe.
//
// ARQUITECTURA:
//   GHL V2 (services.leadconnectorhq.com con PIT)
//   Drive (DocumentApp + DriveApp)
//
// ESTRUCTURA DE CARPETAS EN DRIVE:
//   BITACORAS/
//   └── 2026/
//       └── 05. PROM MAYO/
//           └── PROM 10 MAYO 2026/
//               ├── GENERAL/     ← todos los estudiantes
//               └── AVANZADOS/   ← solo niveles con experiencia (sin subcarpeta)
//
// REGLAS DE NIVEL → AVANZADO:
//   "Básico con ventas (10 a 100)"   → tiene bitácora avanzada
//   "Escalando ventas"               → tiene bitácora avanzada
//   "Avanzado (+ de 500 ventas)"     → tiene bitácora avanzada
//   Otros niveles                    → solo GENERAL
// ============================================================

const VERSION_BITACORAS = 'v2.1 — sin subcarpeta consultor + link avanzada inyectado';

// ============================================================
// 1. CONFIGURACIÓN
// ============================================================
function getConfig() {
  const props = PropertiesService.getScriptProperties();
  return {
    GHL_API_KEY:           props.getProperty('GHL_API_KEY'),
    GHL_LOCATION_ID:       props.getProperty('GHL_LOCATION_ID'),
    BITACORAS_ROOT_ID:     props.getProperty('BITACORAS_ROOT_ID'),
    FIELD_ID_PROMOCION:    props.getProperty('GHL_FIELD_ID_PROMOCION'),
    FIELD_ID_NIVEL:        props.getProperty('GHL_FIELD_ID_NIVEL'),
    FIELD_ID_BITACORA_URL: props.getProperty('GHL_FIELD_ID_BITACORA_URL'),
  };
}

// ============================================================
// 2. ENTRY POINTS
// ============================================================

// ── Función principal que ejecuta el trigger cada 4 horas ──
function procesarBitacoras() {
  const config = getConfig();
  for (const [k, v] of Object.entries(config)) {
    if (!v) throw new Error(`Falta ${k} en Script Properties`);
  }

  Logger.log('═════════════════════════════════════');
  Logger.log(`PROCESO DE BITÁCORAS — INICIO`);
  Logger.log(`Versión: ${VERSION_BITACORAS}`);
  Logger.log('═════════════════════════════════════');

  const estudiantes = obtenerEstudiantesNuevos(config);
  Logger.log(`→ ${estudiantes.length} estudiantes con tag "estudiante nuevo"`);

  let creadas = 0, existentes = 0, errores = 0;
  for (const est of estudiantes) {
    try {
      const r = procesarEstudiante(est, config);
      if (r === 'CREADA') creadas++;
      else if (r === 'EXISTE') existentes++;
      else errores++;
    } catch (e) {
      Logger.log(`✗ ${est.nombre}: ${e.message}`);
      errores++;
    }
  }

  Logger.log('═════════════════════════════════════');
  Logger.log(`RESUMEN: ${creadas} creadas | ${existentes} existían | ${errores} errores`);
  Logger.log('═════════════════════════════════════');
}

// ── Recrear todas las bitácoras existentes (renombra + reformatea) ──
// ⚠️ DESTRUCTIVA: reescribe contenido. Solo usar manualmente cuando
// se quiera refrescar el diseño de TODAS las bitácoras.
function recrearTodasLasBitacoras() {
  const config = getConfig();
  const url = `${GHL_V2_BASE}/contacts/?locationId=${config.GHL_LOCATION_ID}&limit=100`;
  const res = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: ghlHeaders(config.GHL_API_KEY),
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) {
    Logger.log(`✗ Error: ${res.getResponseCode()}`);
    return;
  }

  const contacts = JSON.parse(res.getContentText()).contacts || [];
  const candidatos = contacts.filter(c => {
    const tags = (c.tags || []).map(t => t.toLowerCase());
    return tags.includes('estudiante nuevo') || tags.includes('bitacora_creada');
  });

  Logger.log('════════════════════════════════════════');
  Logger.log(`RECREANDO — ${candidatos.length} candidatos`);
  Logger.log(`Versión: ${VERSION_BITACORAS}`);
  Logger.log('════════════════════════════════════════');

  let reescritos = 0, creados = 0, saltados = 0, errores = 0;
  for (const c of candidatos) {
    const est = parseContacto(c, config);
    if (!est.nombre) { saltados++; continue; }
    if (!est.promocion) {
      Logger.log(`⊘ ${est.nombre}: sin promoción`);
      saltados++;
      continue;
    }

    try {
      const carpetas = crearEstructuraCarpetas(est.promocion, config.BITACORAS_ROOT_ID);
      if (!carpetas) { errores++; continue; }

      const titulo = `Bitacora - ${est.nombre}`;
      const avanzado = est.nivel ? esAvanzado(est.nivel) : false;

      let avanzadaUrl = null;
      if (avanzado) {
        const avanzadaDoc = reescribirOCrearDoc(titulo, carpetas.avanzados, 'avanzada', est);
        avanzadaUrl = avanzadaDoc.url;
        Logger.log(`  ✓ ${est.nombre} (avanzado): avanzada → ${avanzadaUrl}`);
      }

      const r1 = reescribirOCrearDoc(titulo, carpetas.general, 'general', est, avanzadaUrl);
      if (r1.reescrito) reescritos++; else creados++;

      Logger.log(`  ✓ ${est.nombre}: GENERAL ${avanzado ? '(con link avanzada)' : ''}`);
    } catch (e) {
      Logger.log(`  ✗ ${est.nombre}: ${e.message}`);
      errores++;
    }
  }

  Logger.log('════════════════════════════════════════');
  Logger.log(`RESUMEN: ${reescritos} reescritos | ${creados} creados | ${saltados} saltados | ${errores} errores`);
  Logger.log('════════════════════════════════════════');
}

// ============================================================
// 3. PROCESAR UN ESTUDIANTE
// ============================================================
function procesarEstudiante(est, config) {
  const nombre = est.nombre;
  Logger.log(`\nProcesando: ${nombre}`);

  if (!nombre) { Logger.log('  ✗ Sin nombre'); return 'ERROR'; }
  if (!est.promocion) { Logger.log('  ✗ Sin promoción'); return 'ERROR'; }

  const carpetas = crearEstructuraCarpetas(est.promocion, config.BITACORAS_ROOT_ID);
  if (!carpetas) { Logger.log('  ✗ Error en carpetas'); return 'ERROR'; }

  const titulo = `Bitacora - ${nombre}`;
  const avanzado = est.nivel ? esAvanzado(est.nivel) : false;
  Logger.log(`  Nivel: "${est.nivel}" → avanzado: ${avanzado}`);

  // 1. Si es avanzado: crear (o reusar) la AVANZADA primero
  let avanzadaUrl = null;
  if (avanzado) {
    const avanzadaDoc = crearDocSiNoExiste(titulo, carpetas.avanzados, 'avanzada', est);
    avanzadaUrl = avanzadaDoc.url;
    Logger.log(`  ${avanzadaDoc.existia ? '⚠ Avanzada ya existía' : '✓ Avanzada creada'} → ${avanzadaUrl}`);
  }

  // 2. GENERAL para todos (con link inyectado si aplica)
  const general = crearDocSiNoExiste(titulo, carpetas.general, 'general', est, avanzadaUrl);

  if (general.existia) {
    Logger.log('  ⚠ General ya existía — NO se tocó (contenido protegido)');
    return 'EXISTE';
  }

  actualizarContactoGHL(est.id, general.url, config);
  Logger.log(`  ✓ ${nombre}: ${general.url}`);
  return 'CREADA';
}

// ============================================================
// 4. GHL V2 — API
// ============================================================
const GHL_V2_BASE = 'https://services.leadconnectorhq.com';

function ghlHeaders(apiKey, includeContentType) {
  const h = {
    'Authorization': `Bearer ${apiKey}`,
    'Version': '2021-07-28',
    'Accept': 'application/json'
  };
  if (includeContentType) h['Content-Type'] = 'application/json';
  return h;
}

function obtenerEstudiantesNuevos(config) {
  const url = `${GHL_V2_BASE}/contacts/?locationId=${config.GHL_LOCATION_ID}&limit=100`;
  const res = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: ghlHeaders(config.GHL_API_KEY),
    muteHttpExceptions: true
  });

  if (res.getResponseCode() !== 200) {
    Logger.log(`✗ GHL error ${res.getResponseCode()}: ${res.getContentText()}`);
    return [];
  }

  const contacts = JSON.parse(res.getContentText()).contacts || [];
  return contacts
    .filter(c => (c.tags || []).some(t => t.toLowerCase() === 'estudiante nuevo'))
    .map(c => parseContacto(c, config));
}

function parseContacto(c, config) {
  const map = {};
  (c.customFields || []).forEach(f => {
    const v = f.value !== undefined ? f.value :
              f.field_value !== undefined ? f.field_value :
              f.fieldValue !== undefined ? f.fieldValue : '';
    map[f.id] = v;
  });
  return {
    id:              c.id,
    nombre:          capitalizarNombre(`${c.firstName || ''} ${c.lastName || ''}`),
    email:           c.email || '',
    telefono:        c.phone || '',
    pais_residencia: nombrePais(c.country),
    promocion:       map[config.FIELD_ID_PROMOCION] || '',
    nivel:           map[config.FIELD_ID_NIVEL] || '',
    tags:            c.tags || []
  };
}

function actualizarContactoGHL(contactId, docUrl, config) {
  const url = `${GHL_V2_BASE}/contacts/${contactId}`;

  const getRes = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: ghlHeaders(config.GHL_API_KEY),
    muteHttpExceptions: true
  });
  if (getRes.getResponseCode() !== 200) {
    Logger.log(`  ✗ Error obteniendo contacto: ${getRes.getResponseCode()}`);
    return false;
  }

  const contact = JSON.parse(getRes.getContentText()).contact;
  const tagsActuales = contact.tags || [];
  const nuevosTags = tagsActuales.filter(t => t.toLowerCase() !== 'estudiante nuevo');
  if (!nuevosTags.some(t => t.toLowerCase() === 'bitacora_creada')) {
    nuevosTags.push('bitacora_creada');
  }

  const payload = {
    tags: nuevosTags,
    customFields: [{ id: config.FIELD_ID_BITACORA_URL, field_value: docUrl }]
  };

  const putRes = UrlFetchApp.fetch(url, {
    method: 'put',
    headers: ghlHeaders(config.GHL_API_KEY, true),
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  if (putRes.getResponseCode() >= 300) {
    Logger.log(`  ✗ Error actualizando: ${putRes.getResponseCode()} ${putRes.getContentText()}`);
    return false;
  }
  return true;
}

// ============================================================
// 5. DRIVE — CARPETAS
// ============================================================
// Estructura: AÑO / MES / PROMOCIÓN / { GENERAL, AVANZADOS }
function crearEstructuraCarpetas(promocionStr, rootId) {
  const folders = getFolderNames(promocionStr);
  if (!folders) { Logger.log(`  ✗ Promoción inválida: ${promocionStr}`); return null; }

  const root = DriveApp.getFolderById(rootId);
  const año       = ensureFolder(folders.año, root);
  const mes       = ensureFolder(folders.mes, año);
  const promo     = ensureFolder(folders.promocion, mes);
  const general   = ensureFolder('GENERAL', promo);
  const avanzados = ensureFolder('AVANZADOS', promo);

  return { general, avanzados };
}

function ensureFolder(name, parent) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

// ============================================================
// 6. DRIVE — CREAR / REESCRIBIR DOCUMENTOS
// ============================================================
// Hay 2 funciones con propósitos distintos:
//
//   crearDocSiNoExiste — SEGURA para uso automatizado.
//     Si el doc existe: NO toca el contenido, solo renombra si el case
//     es diferente. Esto protege lo que escribieron los consultores.
//
//   reescribirOCrearDoc — DESTRUCTIVA. Solo para uso manual cuando
//     quieres refrescar el diseño de TODAS las bitácoras (ejecutada
//     desde `recrearTodasLasBitacoras`).
// ============================================================

// ── SEGURA — usada por procesarBitacoras (trigger cada 4h) ──
function crearDocSiNoExiste(titulo, parentFolder, plantilla, estudiante, avanzadaUrl) {
  const tituloLower = titulo.toLowerCase();
  const files = parentFolder.getFiles();

  while (files.hasNext()) {
    const f = files.next();
    if (f.getName().toLowerCase() === tituloLower) {
      // Existe → renombra si case diferente, NO toca contenido
      if (f.getName() !== titulo) {
        f.setName(titulo);
        Logger.log(`    ↻ Renombrado: ${titulo}`);
      }
      return { existia: true, url: f.getUrl() };
    }
  }

  // No existe → crear nuevo con plantilla
  const doc = DocumentApp.create(titulo);
  const body = doc.getBody();
  limpiarBodySeguro(body);
  aplicarPlantilla(body, plantilla, estudiante, avanzadaUrl);
  doc.saveAndClose();
  DriveApp.getFileById(doc.getId()).moveTo(parentFolder);
  return { existia: false, url: doc.getUrl() };
}

// ── DESTRUCTIVA — solo para uso manual (recrearTodasLasBitacoras) ──
function reescribirOCrearDoc(titulo, parentFolder, plantilla, estudiante, avanzadaUrl) {
  const tituloLower = titulo.toLowerCase();
  const files = parentFolder.getFiles();
  let foundFile = null;

  while (files.hasNext()) {
    const f = files.next();
    if (f.getName().toLowerCase() === tituloLower) {
      foundFile = f;
      break;
    }
  }

  if (foundFile) {
    if (foundFile.getName() !== titulo) {
      foundFile.setName(titulo);
      Logger.log(`    ↻ Renombrado: ${titulo}`);
    }
    const doc = DocumentApp.openById(foundFile.getId());
    const body = doc.getBody();
    limpiarBodySeguro(body);
    aplicarPlantilla(body, plantilla, estudiante, avanzadaUrl);
    doc.saveAndClose();
    return { reescrito: true, url: foundFile.getUrl() };
  }

  const doc = DocumentApp.create(titulo);
  const body = doc.getBody();
  limpiarBodySeguro(body);
  aplicarPlantilla(body, plantilla, estudiante, avanzadaUrl);
  doc.saveAndClose();
  DriveApp.getFileById(doc.getId()).moveTo(parentFolder);
  return { reescrito: false, url: doc.getUrl() };
}

// ── Limpia el body manejando documentos con estructuras raras ──
function limpiarBodySeguro(body) {
  try {
    body.clear();
    return;
  } catch (e) {
    Logger.log(`    ⚠ body.clear() falló (${e.message}) — usando fallback`);
  }

  body.appendParagraph('');
  while (body.getNumChildren() > 1) {
    try {
      body.removeChild(body.getChild(0));
    } catch (e) {
      Logger.log(`    ⚠ no se pudo borrar elemento: ${e.message}`);
      break;
    }
  }
}

// Dispatcher: enruta a la plantilla correcta
function aplicarPlantilla(body, plantilla, estudiante, avanzadaUrl) {
  if (plantilla === 'avanzada') {
    construirPlantillaAvanzada(body, estudiante);
  } else {
    construirPlantillaGeneral(body, estudiante, avanzadaUrl);
  }
}

// ============================================================
// 7. PLANTILLAS — DISEÑO MASTER ESCALA
// ============================================================
const STYLE = {
  TEAL:    '#1AC4B6',
  BLACK:   '#000000',
  TEXT:    '#1A1A1A',
  WHITE:   '#FFFFFF',
  ANSWER:  '#666666',
  BORDER:  '#000000',
  LINK:    '#1155CC'
};

const PREGUNTAS = [
  '¿Ya tienes tienda activa o has creado alguna vez una tienda?',
  '¿Tienes experiencia previa en el campo de ventas?',
  '¿Tienes un perfil de Facebook y hace cuánto tiempo lo tienes?',
  '¿Has hecho alguna vez campañas publicitarias en Meta o TikTok?',
  'Si la respuesta anterior es sí, ¿tuviste algún baneo o inconveniente en plataformas publicitarias?',
  '¿Qué tal es tu nivel tecnológico en cuanto al manejo del computador?',
  '¿Sabes utilizar Canva?',
  '¿Sabes utilizar CapCut?',
  '¿De cuántas horas al día dispones para dedicarle al negocio?'
];

const PREGUNTAS_AVANZADA = [
  {
    titulo: '1. Contexto general del negocio',
    preguntas: [
      '¿Cuánto tiempo llevas haciendo e-commerce y cuántas tiendas activas tienes hoy?',
      '¿Por qué plataforma estás realizando actualmente tus ventas? (Ej: landing page, WhatsApp, marketplace u otra. ¿Cuál?)',
      '¿En qué país o países estás vendiendo actualmente?',
      '¿Cuál es tu promedio de pedidos diario y cuántos productos tienes activos? ¿Te consideras estable en ese nivel?',
      '¿Cuáles han sido tus mayores logros hasta ahora? (ventas, productos ganadores)',
      '¿Qué parte del proceso sientes que dominas mejor (producto, anuncios, tienda, atención al cliente)?',
      '¿Qué es lo que más se te dificulta actualmente de tu tienda o en tu proceso?',
      '¿Cuánto tiempo dedicas semanalmente a tu tienda (en horas o días)?'
    ]
  },
  {
    titulo: '2. Logística y operación',
    preguntas: [
      '¿Cómo estás gestionando actualmente la logística de tus pedidos? (Equipo, automatizaciones o terceros)',
      '¿Conoces tus números de pedidos, entregados, cancelados y devueltos?'
    ]
  },
  {
    titulo: '3. Producto y desarrollo',
    preguntas: [
      '¿Cuántos productos pruebas a la semana?',
      '¿Qué producto estás vendiendo actualmente y cuál metodología empleaste para encontrarlo? — Inserta el enlace',
      '¿Qué tan involucrado estás en la parte de desarrollo de productos? ¿Eres tú quien los hace?',
      '¿Has probado diferentes precios, bonos o estructuras de oferta con los productos que tienes actualmente activos?',
      '¿Desarrollas videos propios o los descargas de internet?',
      '¿Conoces los términos UGC, VSL, AIDA, storytelling, etc.?',
      '¿Tienes manejo de CapCut, Canva o herramientas de IA?',
      '¿Te desenvuelves bien en el uso de la plataforma de Shopify?'
    ]
  },
  {
    titulo: '4. Anuncios, creativos y plataformas',
    preguntas: [
      '¿Cuánto presupuesto tienes disponible actualmente para campañas?',
      '¿En qué plataforma estás invirtiendo más? (Meta o TikTok)',
      'Si no vendes por TikTok o Meta, ¿por qué?',
      '¿Cuántos testeos realizas semanalmente y cuántos productos tienes activos actualmente?',
      '¿Cuántos videos pruebas con cada producto que lanzas?',
      '¿Cuál ha sido tu anuncio con mejor desempeño y por qué crees que funcionó? Adjunta enlace.',
      '¿Renuevas creativos de los productos que funcionan y con qué frecuencia lo haces?'
    ]
  },
  {
    titulo: '5. Tienda, conversión y oferta',
    preguntas: [
      '¿Sabes qué tan optimizado está el tema de tu tienda y cuál es su velocidad de carga?',
      '¿Cuál es la estructura que usas en la plantilla de tu landing page? (solo prueba social, storytelling, modelo AIDA o características técnicas) Explica brevemente cómo defines qué plantilla usar.',
      '¿Qué métodos de pago tienes habilitados en tu tienda?',
      '¿Sabes qué tasa de conversión tiene actualmente tu tienda?'
    ]
  },
  {
    titulo: '6. Métricas, control financiero y gestión',
    preguntas: [
      '¿Tienes estructura de contingencia en Facebook o en TikTok / o ambas?',
      '¿Cuál es la herramienta que estás utilizando para costear actualmente tus productos?',
      '¿Haces control diario de tus utilidades?',
      '(Si la respuesta anterior es no) Si no haces control diario, ¿cómo sabes cuánto dinero estás ganando para tomar decisiones diarias?',
      'Cuando haces el costeo de tu producto, ¿cuánto dejas para CPA, fletes y ganancias?',
      '¿Entiendes para qué sirven las métricas (CTR, CPA, ROAS, CPM)?',
      '(Si la respuesta es sí) ¿Cómo monitoreas tus métricas diarias?',
      '¿Haces cierre financiero semanal/mensual?',
      '¿Cuál fue tu utilidad promedio el último mes en %?',
      '¿Qué porcentaje de tus ganancias reinviertes en anuncios?'
    ]
  },
  {
    titulo: '7. Escalamiento y backend',
    preguntas: [
      '¿Tienes una metodología clara para decidir qué anuncio escalar y cuál pausar?',
      'Si dice que no está escalando, ¿por qué no lo haces? (desconocimiento, miedo, falta de estructura, no has tenido el producto, etc.)',
      '¿Qué formatos de campaña has probado? (ABO, CBO, Advantage+ / Smart+)',
      '¿Has probado integrar email marketing, SMS o retargeting?',
      '¿Tienes una estrategia de fidelización o recompra activa?',
      '¿Has pautado en Google?'
    ]
  },
  {
    titulo: '8. Rutina, mentalidad y liderazgo',
    preguntas: [
      '¿Cómo es tu día a día actualmente dentro del negocio?',
      '¿Tienes hábitos o rutinas que te mantienen enfocado? ¿A qué horas trabajas exactamente?',
      '¿Qué sientes que te ha limitado más a escalar al siguiente nivel?',
      '¿En qué área del negocio sientes que necesitas más acompañamiento?',
      'Para dar prioridad a tus necesidades, si tuvieras solo un mes con nosotros, ¿qué te gustaría resolver primero?',
      'Si tienes equipo: ¿cómo está delegada la operación y qué nivel de conocimiento tiene cada persona? (diseñador, media buyer, logística, atención al cliente, confirmación de pedidos, fulfillment)'
    ]
  }
];

const RECURSOS_AVANZADA = [
  'Captura de Shopify y el dashboard de la plataforma logística (Ejemplo: Dropi) de los últimos 60 días.',
  'Foto del Ads Manager: histórico de las campañas identificando a qué producto hace referencia y fecha de inicio de la campaña.',
  'Link de tu tienda (opcional: en caso de no tenerla).',
  'Los 3 creativos que más ventas han generado.',
  'Cierre financiero del último mes que haya realizado.',
  'Cierre logístico del último mes que haya realizado que demuestre la efectividad (entrega, devolución y cancelados).',
  'Captura de costeo de uno de tus productos activos.'
];

// ──────────────────────────────────────────────────────────────
// PLANTILLA GENERAL (carpeta GENERAL/)
// Recibe avanzadaUrl: si el estudiante es avanzado, se inyecta como
// hipervínculo clickeable junto al label "Enlace Bitácora Avanzada:".
// ──────────────────────────────────────────────────────────────
function construirPlantillaGeneral(body, est, avanzadaUrl) {
  body.setMarginTop(50).setMarginBottom(50).setMarginLeft(60).setMarginRight(60);

  agregarLogo(body);

  const lblNombre = body.appendParagraph('Nombre:');
  lblNombre.editAsText().setFontFamily('Roboto').setFontSize(11)
    .setBold(false).setForegroundColor(STYLE.TEXT);
  lblNombre.setSpacingBefore(20).setSpacingAfter(2);

  const nombrePara = body.appendParagraph(est.nombre || '');
  nombrePara.editAsText().setFontFamily('Roboto').setFontSize(20)
    .setBold(true).setForegroundColor(STYLE.BLACK);
  nombrePara.setSpacingAfter(20);

  const tabla = body.appendTable([
    ['Nivel de ingreso:',                          ''],
    ['País de residencia:',                        ''],
    ['País de Venta:',                             ''],
    ['¿Cuál es tu meta en los próximos 30 días?',  '']
  ]);
  estilizarTablaSimple(tabla);

  espacio(body);

  const sesion = body.appendParagraph('Sesión 1: Reconocimiento');
  sesion.editAsText().setBold(true).setFontFamily('Roboto').setFontSize(11)
    .setForegroundColor(STYLE.BLACK);
  sesion.setSpacingBefore(15).setSpacingAfter(8);

  ['Consultor:', 'Fecha de la sesión:', 'Hora de la sesión:',
   'Link de la reunión:'].forEach(label => {
    const p = body.appendParagraph(label);
    p.editAsText().setBold(true).setFontFamily('Roboto').setFontSize(10)
     .setForegroundColor(STYLE.BLACK);
    p.setSpacingAfter(4);
  });

  // ── Enlace Bitácora Avanzada — hipervínculo clickeable si aplica ──
  const enlacePara = body.appendParagraph('');
  enlacePara.setSpacingAfter(4);

  const labelText = enlacePara.appendText('Enlace Bitácora Avanzada: ');
  labelText.setBold(true)
           .setFontFamily('Roboto')
           .setFontSize(10)
           .setForegroundColor(STYLE.BLACK);

  if (avanzadaUrl) {
    Logger.log(`    📎 Inyectando link en general: ${avanzadaUrl}`);
    const urlText = enlacePara.appendText(avanzadaUrl);
    urlText.setBold(false)
           .setFontFamily('Roboto')
           .setFontSize(10)
           .setForegroundColor(STYLE.LINK)
           .setUnderline(true)
           .setLinkUrl(avanzadaUrl);
  }

  espacio(body);

  const infoImp = body.appendParagraph('Información importante:');
  infoImp.editAsText().setBold(true).setFontFamily('Roboto').setFontSize(11)
    .setForegroundColor(STYLE.BLACK);
  infoImp.setSpacingBefore(15).setSpacingAfter(10);

  PREGUNTAS.forEach((p, i) => agregarPregunta(body, i + 1, p));
}

// ──────────────────────────────────────────────────────────────
// PLANTILLA AVANZADA — solo se usa en carpeta AVANZADOS/
// ──────────────────────────────────────────────────────────────
function construirPlantillaAvanzada(body, est) {
  body.setMarginTop(50).setMarginBottom(50).setMarginLeft(60).setMarginRight(60);

  agregarLogo(body);

  const lblNombre = body.appendParagraph('Nombre:');
  lblNombre.editAsText().setFontFamily('Roboto').setFontSize(11)
    .setBold(false).setForegroundColor(STYLE.TEXT);
  lblNombre.setSpacingBefore(20).setSpacingAfter(2);

  const nombrePara = body.appendParagraph(est.nombre || '');
  nombrePara.editAsText().setFontFamily('Roboto').setFontSize(20)
    .setBold(true).setForegroundColor(STYLE.BLACK);
  nombrePara.setSpacingAfter(20);

  const tabla = body.appendTable([
    ['Nivel de ingreso:',                                                      ''],
    ['Tienda:',                                                                ''],
    ['País de residencia:',                                                    ''],
    ['País de Venta:',                                                         ''],
    ['¿Cuál es tu meta económica o de facturación para los próximos 90 días?', '']
  ]);
  estilizarTablaSimple(tabla);

  espacio(body);

  const sesion = body.appendParagraph('Sesión 1: Reconocimiento');
  sesion.editAsText().setBold(true).setFontFamily('Roboto').setFontSize(11)
    .setForegroundColor(STYLE.BLACK);
  sesion.setSpacingBefore(15).setSpacingAfter(8);

  ['Fecha de la sesión:', 'Hora de la sesión:', 'Consultor:'].forEach(label => {
    const p = body.appendParagraph(label);
    p.editAsText().setBold(true).setFontFamily('Roboto').setFontSize(10)
     .setForegroundColor(STYLE.BLACK);
    p.setSpacingAfter(4);
  });

  espacio(body);

  const infoImp = body.appendParagraph('Información importante:');
  infoImp.editAsText().setBold(true).setFontFamily('Roboto').setFontSize(11)
    .setForegroundColor(STYLE.BLACK);
  infoImp.setSpacingBefore(15).setSpacingAfter(10);

  PREGUNTAS_AVANZADA.forEach(seccion => {
    const tit = body.appendParagraph(seccion.titulo);
    tit.editAsText().setBold(true).setFontFamily('Roboto').setFontSize(13)
       .setForegroundColor(STYLE.BLACK);
    tit.setSpacingBefore(15).setSpacingAfter(8);

    seccion.preguntas.forEach((p, i) => {
      const pPara = body.appendParagraph((i + 1) + '. ' + p);
      pPara.editAsText().setFontFamily('Roboto').setFontSize(10)
           .setBold(false).setForegroundColor(STYLE.BLACK);
      pPara.setSpacingBefore(6).setSpacingAfter(15);
    });
  });

  espacio(body);
  const recTit = body.appendParagraph('Recursos que deben enviar:');
  recTit.editAsText().setBold(true).setFontFamily('Roboto').setFontSize(11)
        .setForegroundColor(STYLE.BLACK);
  recTit.setSpacingBefore(20).setSpacingAfter(10);

  RECURSOS_AVANZADA.forEach(rec => {
    const r = body.appendListItem(rec);
    r.setGlyphType(DocumentApp.GlyphType.BULLET);
    r.editAsText().setFontFamily('Roboto').setFontSize(10)
     .setBold(false).setForegroundColor(STYLE.BLACK);
    r.setSpacingAfter(6);
  });
}

// ── Helpers de formato ──
function agregarLogo(body) {
  const logoFileId = PropertiesService.getScriptProperties().getProperty('LOGO_FILE_ID');
  if (logoFileId) {
    try {
      const blob = DriveApp.getFileById(logoFileId).getBlob();
      const para = body.appendParagraph('');
      para.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
      const img = para.appendInlineImage(blob);
      img.setWidth(200);
      img.setHeight(130);
      para.setSpacingAfter(10);
      return;
    } catch (e) {
      Logger.log(`⚠ No se pudo cargar logo: ${e.message}`);
    }
  }
  const logoText = body.appendParagraph('MASTER ESCALA');
  logoText.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  logoText.editAsText().setBold(true).setFontFamily('Roboto').setFontSize(22)
    .setForegroundColor(STYLE.TEAL);
  logoText.setSpacingAfter(15);
}

function estilizarTablaSimple(tabla) {
  tabla.setBorderColor(STYLE.BORDER);
  tabla.setBorderWidth(1);
  for (let r = 0; r < tabla.getNumRows(); r++) {
    const row = tabla.getRow(r);
    const labelCell = row.getCell(0);
    const valueCell = row.getCell(1);
    labelCell.setPaddingTop(10).setPaddingBottom(10)
             .setPaddingLeft(12).setPaddingRight(12).setWidth(220);
    labelCell.editAsText().setFontFamily('Roboto').setFontSize(10)
             .setBold(false).setForegroundColor(STYLE.TEXT);
    valueCell.setPaddingTop(10).setPaddingBottom(10)
             .setPaddingLeft(12).setPaddingRight(12);
    valueCell.editAsText().setFontFamily('Roboto').setFontSize(10)
             .setBold(true).setForegroundColor(STYLE.BLACK);
  }
}

function agregarPregunta(body, numero, texto) {
  const pPara = body.appendParagraph(numero + '. ' + texto);
  pPara.editAsText().setFontFamily('Roboto').setFontSize(10)
       .setBold(false).setForegroundColor(STYLE.BLACK);
  pPara.setSpacingBefore(10).setSpacingAfter(20);
}

function espacio(body) {
  body.appendParagraph('').editAsText().setFontSize(8);
}

// ============================================================
// 8. UTILIDADES
// ============================================================
const MESES = ['', 'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
               'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

function capitalizarNombre(nombre) {
  if (!nombre) return '';
  return nombre.toLowerCase().trim().split(/\s+/)
    .map(palabra => palabra.charAt(0).toUpperCase() + palabra.slice(1))
    .join(' ');
}

function getFolderNames(promocionInput) {
  if (!promocionInput) return null;

  let promocionStr;
  if (typeof promocionInput === 'number') {
    const d = new Date(promocionInput);
    promocionStr = `${d.getUTCDate()} ${MESES[d.getUTCMonth() + 1]} ${d.getUTCFullYear()}`;
  } else if (promocionInput instanceof Date) {
    promocionStr = `${promocionInput.getUTCDate()} ${MESES[promocionInput.getUTCMonth() + 1]} ${promocionInput.getUTCFullYear()}`;
  } else if (typeof promocionInput === 'string') {
    promocionStr = promocionInput.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(promocionStr)) {
      const d = new Date(promocionStr);
      if (!isNaN(d.getTime())) {
        promocionStr = `${d.getUTCDate()} ${MESES[d.getUTCMonth() + 1]} ${d.getUTCFullYear()}`;
      }
    }
  } else {
    Logger.log(`  ⚠ Tipo inesperado: ${typeof promocionInput}`);
    return null;
  }

  if (!promocionStr) return null;

  const partes = promocionStr.split(/\s+/);
  if (partes.length < 3) {
    Logger.log(`  ⚠ Formato inválido: "${promocionStr}"`);
    return null;
  }

  const dia = parseInt(partes[0]);
  const mesInput = partes[1].toUpperCase();
  const año = parseInt(partes[2]);
  if (isNaN(dia) || isNaN(año)) return null;

  let mesNum = -1;
  for (let i = 1; i <= 12; i++) {
    if (MESES[i].startsWith(mesInput.substring(0, 3))) { mesNum = i; break; }
  }
  if (mesNum === -1) return null;

  const mesNombre = MESES[mesNum];
  const mesPad = mesNum < 10 ? '0' + mesNum : '' + mesNum;
  return {
    año:       '' + año,
    mes:       `${mesPad}. PROM ${mesNombre}`,
    promocion: `PROM ${dia} ${mesNombre} ${año}`
  };
}

function esAvanzado(nivel) {
  if (!nivel) return false;
  const lower = nivel.toLowerCase();
  return lower.includes('con ventas') ||
         lower.includes('escalando') ||
         lower.includes('avanzado');
}

// ============================================================
// 9. PAÍSES — ISO → nombre español
// ============================================================
const PAISES = {
  'AR': 'Argentina',  'BO': 'Bolivia',     'BR': 'Brasil',
  'CL': 'Chile',      'CO': 'Colombia',    'CR': 'Costa Rica',
  'CU': 'Cuba',       'DO': 'República Dominicana',
  'EC': 'Ecuador',    'GT': 'Guatemala',   'HN': 'Honduras',
  'MX': 'México',     'NI': 'Nicaragua',   'PA': 'Panamá',
  'PE': 'Perú',       'PR': 'Puerto Rico', 'PY': 'Paraguay',
  'SV': 'El Salvador','UY': 'Uruguay',     'VE': 'Venezuela',
  'US': 'Estados Unidos', 'CA': 'Canadá',
  'ES': 'España',     'FR': 'Francia',     'IT': 'Italia',
  'PT': 'Portugal',   'DE': 'Alemania',    'GB': 'Reino Unido',
  'CH': 'Suiza',      'NL': 'Países Bajos','BE': 'Bélgica',
  'AT': 'Austria',    'IE': 'Irlanda',     'SE': 'Suecia',
  'NO': 'Noruega',    'DK': 'Dinamarca',   'FI': 'Finlandia',
  'PL': 'Polonia',    'GR': 'Grecia',
  'JP': 'Japón',      'CN': 'China',       'KR': 'Corea del Sur',
  'IN': 'India',      'AU': 'Australia',   'NZ': 'Nueva Zelanda',
  'IL': 'Israel',     'AE': 'Emiratos Árabes Unidos',
  'TR': 'Turquía',    'EG': 'Egipto',      'ZA': 'Sudáfrica'
};

function nombrePais(codigo) {
  if (!codigo) return '';
  const upper = String(codigo).toUpperCase().trim();
  return PAISES[upper] || codigo;
}

// ============================================================
// 10. SETUP / DEBUG / LIMPIEZA
// ============================================================

function guardarLogoId() {
  PropertiesService.getScriptProperties().setProperty(
    'LOGO_FILE_ID',
    '1jSyT0z9ueiBBRTWbupc8mnR2If2961I4'
  );
  Logger.log('✓ Logo ID guardado');
}

function diagnosticarGHL() {
  const config = getConfig();
  Logger.log(`API Key: ${config.GHL_API_KEY ? config.GHL_API_KEY.substring(0, 20) + '...' : '(VACÍA)'}`);
  Logger.log(`Location ID: ${config.GHL_LOCATION_ID}`);

  const url = `${GHL_V2_BASE}/contacts/?locationId=${config.GHL_LOCATION_ID}&limit=1`;
  const res = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: ghlHeaders(config.GHL_API_KEY),
    muteHttpExceptions: true
  });
  Logger.log(`Status: ${res.getResponseCode()}`);
}

// ── Mueve a la papelera todas las subcarpetas "BITACORAS POR EL CONSULTOR" viejas ──
function eliminarCarpetasConsultorViejas() {
  const config = getConfig();
  const root = DriveApp.getFolderById(config.BITACORAS_ROOT_ID);

  Logger.log('═══ LIMPIEZA: BITACORAS POR EL CONSULTOR ═══');
  let eliminadas = 0;

  const años = root.getFolders();
  while (años.hasNext()) {
    const año = años.next();
    const meses = año.getFolders();
    while (meses.hasNext()) {
      const mes = meses.next();
      const promos = mes.getFolders();
      while (promos.hasNext()) {
        const promo = promos.next();
        const avanzadosIt = promo.getFoldersByName('AVANZADOS');
        if (!avanzadosIt.hasNext()) continue;
        const avanzados = avanzadosIt.next();
        const consultorIt = avanzados.getFoldersByName('BITACORAS POR EL CONSULTOR');
        if (!consultorIt.hasNext()) continue;
        const consultor = consultorIt.next();

        const ruta = `${año.getName()}/${mes.getName()}/${promo.getName()}/AVANZADOS/BITACORAS POR EL CONSULTOR`;
        Logger.log(`🗑 A papelera: ${ruta}`);
        consultor.setTrashed(true);
        eliminadas++;
      }
    }
  }

  Logger.log(`═══ ${eliminadas} carpetas enviadas a papelera ═══`);
  Logger.log('Revisa la papelera de Drive antes de vaciarla por seguridad.');
}

// ── Auditoría: verifica que cada link en GHL apunte a la bitácora correcta ──
function verificarLinksEstudiantes() {
  const config = getConfig();
  const url = `${GHL_V2_BASE}/contacts/?locationId=${config.GHL_LOCATION_ID}&limit=100`;
  const res = UrlFetchApp.fetch(url, {
    method: 'get', headers: ghlHeaders(config.GHL_API_KEY), muteHttpExceptions: true
  });
  const contacts = JSON.parse(res.getContentText()).contacts || [];
  const conBitacora = contacts.filter(c =>
    (c.tags || []).some(t => t.toLowerCase() === 'bitacora_creada')
  );

  Logger.log('═══ AUDITORÍA DE LINKS ═══');
  let ok = 0, malos = 0, sinLink = 0;

  conBitacora.forEach(c => {
    const est = parseContacto(c, config);
    const linkActual = (c.customFields || []).find(f => f.id === config.FIELD_ID_BITACORA_URL);
    const urlGuardada = linkActual ? (linkActual.value || linkActual.fieldValue || '') : '';

    if (!urlGuardada) {
      Logger.log(`⚠ ${est.nombre}: sin link en GHL`);
      sinLink++;
      return;
    }

    try {
      const docId = (urlGuardada.match(/\/d\/([a-zA-Z0-9_-]+)/) || [])[1];
      if (!docId) {
        Logger.log(`✗ ${est.nombre}: URL malformada → ${urlGuardada}`);
        malos++;
        return;
      }
      const file = DriveApp.getFileById(docId);
      const nombreEsperado = `Bitacora - ${est.nombre}`.toLowerCase();
      if (file.getName().toLowerCase() !== nombreEsperado) {
        Logger.log(`✗ ${est.nombre}: link apunta a "${file.getName()}" (esperado "${nombreEsperado}")`);
        malos++;
      } else {
        ok++;
      }
    } catch (e) {
      Logger.log(`✗ ${est.nombre}: archivo no accesible — ${e.message}`);
      malos++;
    }
  });

  Logger.log(`═══ ${ok} OK | ${malos} mal apuntados | ${sinLink} sin link ═══`);
}
