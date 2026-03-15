/************ CONFIG ************/
const PARENT_FOLDER_ID = "16Kv77c0uO66jk6fAO85nHWZKBCWAm5Wx"; // Opcional: carpeta en Drive (deja "" si no deseas carpeta)
const ALLOWED_EMAILS = [
  "aguilared.96@gmail.com",
  "sarahi.eu99@gmail.com",
  "ocastillo.update@gmail.com",
  "draeuniceaguilar.odomsa@gmail.com"
];

// Nombre del archivo global de catálogo
const GLOBAL_CATALOG_FILENAME = "ODOMSA-Catalogo-Global";

/************ CONFIG — USERS SHEET ************/
// Nombre del archivo Google Sheet que tiene la hoja "Users"
// Columnas: email | password_hash | role | name | active
// role: "admin" | "staff"
// active: TRUE | FALSE
const USERS_SPREADSHEET_NAME = "ODOMSA-Users";

// Simple token secret — change this to any random string you want
const TOKEN_SECRET = "odomsa_2026_secret_changeme";

/************ CORS HEADERS ************/
function corsHeaders_() {
  return {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function makeResponse_(data) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

/************ WEB ENTRY POINTS ************/

// doGet: kept for backward compat with original GAS Web App
function doGet() {
  return HtmlService
    .createHtmlOutput('<p>ODOMSA API — use the GitHub Pages frontend.</p>')
    .setTitle('ODOMSA API');
}

// doPost: unified router for GitHub Pages frontend
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const { action, token } = body;

    // Auth endpoint — no token required
    if (action === 'validateUser') {
      return makeResponse_(validateUserHandler_(body.email, body.password));
    }

    // All other endpoints require a valid token
    const authResult = verifyToken_(token);
    if (!authResult.ok) return makeResponse_({ error: 'No autorizado', ok: false });

    const role = authResult.role;

    switch (action) {
      case 'getDayData':      return makeResponse_(getDayData(body.dateStr));
      case 'addIncome':       return makeResponse_(addIncome(body.ing));
      case 'updateIncome':    return makeResponse_(updateIncome(body.ing));
      case 'deleteIncome':    requireAdmin_(role); return makeResponse_(deleteIncome(body.payload));
      case 'addExpense':      return makeResponse_(addExpense(body.exp));
      case 'updateExpense':   return makeResponse_(updateExpense(body.exp));
      case 'deleteExpense':   requireAdmin_(role); return makeResponse_(deleteExpense(body.payload));
      case 'saveCatalog':     requireAdmin_(role); return makeResponse_(saveCatalog(body.dateStr, body.items));
      case 'consolidateDay':  requireAdmin_(role); return makeResponse_(consolidateDay(body.dateStr));
      default: return makeResponse_({ error: 'Acción desconocida', ok: false });
    }
  } catch (err) {
    return makeResponse_({ error: err.message, ok: false });
  }
}

function requireAdmin_(role) {
  if (role !== 'admin') throw new Error('Se requiere rol de administrador');
}

/************ AUTH: USERS SHEET ************/

function getUsersSheet_() {
  let file = null;
  if (PARENT_FOLDER_ID && PARENT_FOLDER_ID.trim()) {
    const folder = DriveApp.getFolderById(PARENT_FOLDER_ID.trim());
    const iter = folder.getFilesByName(USERS_SPREADSHEET_NAME);
    while (iter.hasNext()) {
      const f = iter.next();
      if (f.getMimeType() === MimeType.GOOGLE_SHEETS) { file = f; break; }
    }
    if (!file) {
      const ss = SpreadsheetApp.create(USERS_SPREADSHEET_NAME);
      DriveApp.getRootFolder().removeFile(DriveApp.getFileById(ss.getId()));
      folder.addFile(DriveApp.getFileById(ss.getId()));
      const sh = ss.getActiveSheet();
      sh.setName('Users');
      sh.appendRow(['email', 'password_hash', 'role', 'name', 'active']);
      sh.setFrozenRows(1);
      return { ss, sh };
    }
  } else {
    const iter = DriveApp.getFilesByName(USERS_SPREADSHEET_NAME);
    while (iter.hasNext()) {
      const f = iter.next();
      if (f.getMimeType() === MimeType.GOOGLE_SHEETS) { file = f; break; }
    }
    if (!file) {
      const ss = SpreadsheetApp.create(USERS_SPREADSHEET_NAME);
      const sh = ss.getActiveSheet();
      sh.setName('Users');
      sh.appendRow(['email', 'password_hash', 'role', 'name', 'active']);
      sh.setFrozenRows(1);
      return { ss, sh };
    }
  }
  const ss = SpreadsheetApp.openById(file.getId());
  const sh = ss.getSheetByName('Users') || ss.getActiveSheet();
  return { ss, sh };
}

// Simple hash using Utilities.computeDigest (SHA-256)
function hashPassword_(password) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    password + TOKEN_SECRET
  );
  return bytes.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

// Generate a simple session token (email + timestamp, hashed)
function generateToken_(email, role) {
  const payload = email + '|' + role + '|' + Date.now() + '|' + TOKEN_SECRET;
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, payload);
  const sig = bytes.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('').slice(0, 32);
  // token = base64(email|role) + "." + sig
  return Utilities.base64Encode(email + '|' + role) + '.' + sig;
}

function verifyToken_(token) {
  if (!token) return { ok: false };
  try {
    const [b64] = token.split('.');
    const decoded = Utilities.newBlob(Utilities.base64Decode(b64)).getDataAsString();
    const [email, role] = decoded.split('|');
    if (!email || !role) return { ok: false };
    return { ok: true, email, role };
  } catch { return { ok: false }; }
}

function validateUserHandler_(email, password) {
  if (!email || !password) return { ok: false, message: 'Faltan credenciales' };
  const { sh } = getUsersSheet_();
  const values = sh.getDataRange().getValues();
  const hash = hashPassword_(password);

  for (let i = 1; i < values.length; i++) {
    const [rowEmail, rowHash, rowRole, rowName, rowActive] = values[i];
    if (
      String(rowEmail).toLowerCase().trim() === email.toLowerCase().trim() &&
      String(rowHash).trim() === hash &&
      String(rowActive).toLowerCase() === 'true'
    ) {
      const token = generateToken_(email, rowRole);
      return { ok: true, role: rowRole, name: rowName || email, token };
    }
  }
  return { ok: false, message: 'Credenciales incorrectas o cuenta inactiva' };
}

function getCurrentUser() {
  return { email: (Session.getActiveUser() && Session.getActiveUser().getEmail()) || "" };
}

/************ HELPERS: headers, ids, search ************/
function getHeaderMap_(sheet) {
  const lastCol = sheet.getLastColumn();
  if (lastCol < 1) return {};
  const header = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const map = {};
  header.forEach((h, i) => { map[String(h || "").toLowerCase()] = i + 1; });
  return map;
}

// Hallar fila por ID en la columna cuyo encabezado sea idHeaderName (1-based)
function findRowByHeaderId_(sheet, id, idHeaderName) {
  if (!id) return -1;
  const header = getHeaderMap_(sheet);
  const idColIndex = header[idHeaderName.toLowerCase()];
  if (!idColIndex) return -1;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const range = sheet.getRange(2, idColIndex, lastRow - 1, 1);
  const values = range.getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]) === String(id)) return i + 2;
  }
  return -1;
}

// ID corto aleatorio
function genShortId_() {
  return Math.random().toString(36).slice(2, 9);
}

// Backfill de IDs en blanco bajo el encabezado indicado (p.ej., 'ingreso_id' o 'egreso_id')
function backfillIdsIfMissing_(sheet, idHeaderName) {
  const header = getHeaderMap_(sheet);
  const idCol = header[idHeaderName.toLowerCase()];
  if (!idCol) return 0;

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;

  const range = sheet.getRange(2, idCol, lastRow - 1, 1);
  const values = range.getValues();
  let changed = 0;

  for (let i = 0; i < values.length; i++) {
    const v = String(values[i][0] || "");
    if (!v) {
      values[i][0] = genShortId_();
      changed++;
    }
  }
  if (changed > 0) range.setValues(values);
  return changed;
}

/************ DRIVE/SPREADSHEET HELPERS ************/
function getOrCreateDailySpreadsheet_(dateStr) {
  const name = `ODOMSA-${dateStr}`;
  let file = null;

  if (PARENT_FOLDER_ID && PARENT_FOLDER_ID.trim()) {
    const folder = DriveApp.getFolderById(PARENT_FOLDER_ID.trim());
    const iter = folder.getFilesByName(name);
    while (iter.hasNext()) {
      const f = iter.next();
      if (f.getMimeType() === MimeType.GOOGLE_SHEETS) { file = f; break; }
    }
    if (!file) {
      const ss = SpreadsheetApp.create(name);
      DriveApp.getRootFolder().removeFile(DriveApp.getFileById(ss.getId()));
      folder.addFile(DriveApp.getFileById(ss.getId()));
      return ss;
    }
    return SpreadsheetApp.openById(file.getId());
  } else {
    const iter = DriveApp.getFilesByName(name);
    while (iter.hasNext()) {
      const f = iter.next();
      if (f.getMimeType() === MimeType.GOOGLE_SHEETS) { file = f; break; }
    }
    if (!file) return SpreadsheetApp.create(name);
    return SpreadsheetApp.openById(file.getId());
  }
}

function ensureDailySheets_(ss) {
  // Ingresos (nuevo layout: sin paciente_id)
  let ingresos = ss.getSheetByName('Ingresos');
  if (!ingresos) {
    ingresos = ss.insertSheet('Ingresos');
    ingresos.appendRow([
      'timestamp_servidor', 'fecha', 'paciente_nombre',
      'detalle_servicios', 'forma_pago', 'notas',
      'total_hnl', 'ingreso_id'
    ]);
    ingresos.setFrozenRows(1);
  }

  // Egresos
  let egresos = ss.getSheetByName('Egresos');
  if (!egresos) {
    egresos = ss.insertSheet('Egresos');
    egresos.appendRow(['timestamp_servidor', 'fecha', 'concepto', 'monto_hnl', 'notas', 'egreso_id']);
    egresos.setFrozenRows(1);
  } else {
    const header = egresos.getRange(1,1,1,egresos.getLastColumn()).getValues()[0].map(x=>String(x||'').toLowerCase());
    if (!header.includes('notas')) {
      egresos.insertColumnBefore(egresos.getLastColumn() + 1);
      egresos.insertColumnBefore(5);
      egresos.getRange(1,5).setValue('notas');
    }
    const egresoIdIndex = header.indexOf('egreso_id') + 1;
    if (egresoIdIndex && egresoIdIndex !== 6) {
      const last = egresos.getLastRow();
      if (last >= 2) {
        const vals = egresos.getRange(2, egresoIdIndex, last-1, 1).getValues();
        egresos.getRange(2, 6, last-1, 1).setValues(vals);
      }
      egresos.getRange(1,6).setValue('egreso_id');
    }
  }

  // Balance (del archivo diario)
  let balance = ss.getSheetByName('Balance');
  if (!balance) {
    balance = ss.insertSheet('Balance');
    balance.getRange(1,1).setValue('Métrica');
    balance.getRange(1,2).setValue('Valor');
    balance.setFrozenRows(1);
    balance.autoResizeColumns(1, 2);
  }
  balance.getRange(2,1).setValue('Total Ingresos');
  balance.getRange(3,1).setValue('Total Egresos');
  balance.getRange(4,1).setValue('Balance (Ingresos - Egresos)');
  balance.getRange(2,2).setFormula('=IFNA(SUM(INDEX(Ingresos!1:1048576,0,MATCH("total_hnl",Ingresos!1:1,0))),0)');
  balance.getRange(3,2).setFormula('=IFNA(SUM(Egresos!D2:D),0)');
  balance.getRange(4,2).setFormula('=B2-B3');

  // Catálogo local (solo para visualización/compatibilidad)
  let catalogo = ss.getSheetByName('Catalogo');
  if (!catalogo) {
    catalogo = ss.insertSheet('Catalogo');
    catalogo.appendRow(['key','name','price']);
    catalogo.setFrozenRows(1);
  }

  return { ingresos, egresos, balance, catalogo };
}

/** Consolidado: archivo único por MES **/
function getOrCreateConsolidatedForMonth_(dateStr) {
  const [y, m] = String(dateStr).split('-');
  const monthTag = `${y}-${m}`;
  const name = `ODOMSA-Consolidado-${monthTag}`;
  let file = null;

  if (PARENT_FOLDER_ID && PARENT_FOLDER_ID.trim()) {
    const folder = DriveApp.getFolderById(PARENT_FOLDER_ID.trim());
    const iter = folder.getFilesByName(name);
    while (iter.hasNext()) {
      const f = iter.next();
      if (f.getMimeType() === MimeType.GOOGLE_SHEETS) { file = f; break; }
    }
    if (!file) {
      const ss = SpreadsheetApp.create(name);
      DriveApp.getRootFolder().removeFile(DriveApp.getFileById(ss.getId()));
      folder.addFile(DriveApp.getFileById(ss.getId()));
      return ss;
    }
    return SpreadsheetApp.openById(file.getId());
  } else {
    const iter = DriveApp.getFilesByName(name);
    while (iter.hasNext()) {
      const f = iter.next();
      if (f.getMimeType() === MimeType.GOOGLE_SHEETS) { file = f; break; }
    }
    if (!file) return SpreadsheetApp.create(name);
    return SpreadsheetApp.openById(file.getId());
  }
}

/** Castea Mes/Año a números (B/C) y repara desde fecha si hace falta **/
function coerceMonthYearToNumbers_(sheet) {
  const last = sheet.getLastRow();
  if (last < 2) return;
  const rng = sheet.getRange(2, 1, last - 1, 3).getValues(); // A..C
  let changed = false;
  for (let i = 0; i < rng.length; i++) {
    const fecha = rng[i][0];
    let mes   = Number(rng[i][1]);
    let anio  = Number(rng[i][2]);

    if (!mes || !anio) {
      let d = null;
      if (fecha instanceof Date) d = fecha;
      else if (typeof fecha === 'string' && fecha) {
        const parts = fecha.split('-');
        if (parts.length >= 2 && parts[0].length === 4) {
          anio = Number(parts[0]) || anio;
          mes  = Number(parts[1]) || mes;
        } else {
          const tmp = new Date(fecha);
          if (!isNaN(tmp)) d = tmp;
        }
      }
      if (d) {
        anio = anio || d.getFullYear();
        mes  = mes  || (d.getMonth() + 1);
      }
    }

    const newMes = Number(mes) || '';
    const newAno = Number(anio) || '';
    if (rng[i][1] !== newMes || rng[i][2] !== newAno) {
      rng[i][1] = newMes;
      rng[i][2] = newAno;
      changed = true;
    }
  }
  if (changed) sheet.getRange(2, 1, rng.length, 3).setValues(rng);
}

/**
 * Asegura hojas de consolidado, renombra CI/CE si existen y construye Resumen
 * con 8 ingresos adicionales y 8 egresos adicionales.
 * (Actualizado para fórmulas robustas y etiquetas estables en Resumen)
 */
function ensureConsolidatedSheets_(ss, dateStr) {
  const [y, m] = String(dateStr).split('-');
  const yearNum = Number(y);
  const monthNum = Number(m);

  // Renombrar legacy
  let ci = ss.getSheetByName('Consolidado_Ingresos');
  let ce = ss.getSheetByName('Consolidado_Egresos');
  const oldCI = ss.getSheetByName('CI');
  const oldCE = ss.getSheetByName('CE');
  if (!ci && oldCI) { oldCI.setName('Consolidado_Ingresos'); ci = oldCI; }
  if (!ce && oldCE) { oldCE.setName('Consolidado_Egresos'); ce = oldCE; }

  // Crear si faltan
  if (!ci) {
    ci = ss.insertSheet('Consolidado_Ingresos');
    ci.appendRow([
      'fecha','mes','año',
      'paciente_id','paciente_nombre',
      'detalle_servicios','forma_pago','notas',
      'total_hnl','ingreso_id','origen'
    ]);
    ci.setFrozenRows(1);
  }
  if (!ce) {
    ce = ss.insertSheet('Consolidado_Egresos');
    ce.appendRow([
      'fecha','mes','año',
      'concepto','monto_hnl','notas',
      'egreso_id','origen'
    ]);
    ce.setFrozenRows(1);
  }

  // Normaliza mes/año a números
  coerceMonthYearToNumbers_(ci);
  coerceMonthYearToNumbers_(ce);

  // Resumen
  let resumen = ss.getSheetByName('Resumen');
  if (!resumen) resumen = ss.insertSheet('Resumen');

  function L(r, text) { resumen.getRange(r, 1).setValue(text); }
  function V(r, value) { resumen.getRange(r, 2).setValue(value); }
  function F(r, f) { resumen.getRange(r, 2).setFormula(f); }
  function setIfEmpty(r, value) {
    const c = resumen.getRange(r, 2);
    if (String(c.getValue()).trim() === '') c.setValue(value);
  }

  const INIT_MARKER_CELL = resumen.getRange('Z1');
  const isInitialized = String(INIT_MARKER_CELL.getValue()) === 'INIT_v2';

  // Run ONCE: lay out headers/labels and default zeros for manual cells if blank.
  if (!isInitialized) {
    resumen.getRange(1,1,1,2).setValues([['Métrica','Valor']]);
    resumen.setFrozenRows(1);

    // Labels
    L(2, 'Mes');
    L(3, 'Año');

    L(5, 'Total Ingresos (mes)');
    L(6, 'Total Egresos (mes)');

    // Manual adicionales (only set zeros IF EMPTY, so user input persists)
    const ING_ADIC_START = 8;
    for (let i = 0; i < 8; i++) {
      L(ING_ADIC_START + i, `Ingreso adicional ${i+1}`);
      setIfEmpty(ING_ADIC_START + i, 0);
    }
    L(16, 'Total Ingresos + Adicionales (mes)');

    const EGR_ADIC_START = 18;
    for (let i = 0; i < 8; i++) {
      L(EGR_ADIC_START + i, `Egreso adicional ${i+1}`);
      setIfEmpty(EGR_ADIC_START + i, 0);
    }
    L(26, 'Total Egresos + Adicionales (mes)');

    L(28, 'Balance (Ingresos - [Egresos + Adicionales]) (mes)');

    L(30, 'Acumulado Ingresos (año)');
    setIfEmpty(30, 0);
    L(31, 'Acumulado Egresos (año)');
    setIfEmpty(31, 0);
    L(32, 'Acumulado Balance (año)');

    // Mark as initialized
    INIT_MARKER_CELL.setValue('INIT_v2');
  }

  // Always (idempotent): set month/year selectors and formulas.
  V(2, monthNum);
  V(3, yearNum);

  // Monthly base totals (CI col I, CE col E) — robust SUMIFS with VALUE()
  F(5, '=IFERROR(SUMIFS(Consolidado_Ingresos!I:I,Consolidado_Ingresos!B:B,VALUE($B$2),Consolidado_Ingresos!C:C,VALUE($B$3)),0)');
  F(6, '=IFERROR(SUMIFS(Consolidado_Egresos!E:E,Consolidado_Egresos!B:B,VALUE($B$2),Consolidado_Egresos!C:C,VALUE($B$3)),0)');

  // Totals including manual adicionales (do NOT touch B8:B15 or B18:B25 values)
  F(16, '=IFERROR($B$5,0)+IFERROR(SUM($B$8:$B$15),0)');
  F(26, '=IFERROR($B$6,0)+IFERROR(SUM($B$18:$B$25),0)');
  F(28, '=IFERROR($B$16,0)-IFERROR($B$26,0)');

  // Year accumulators (values written by the YTD refresher)
  F(32, '=N($B$30)-N($B$31)');

  return { ci, ce, resumen, monthNum, yearNum, monthTag: `${y}-${m}` };
}

/************ CONSOLIDADO DEDUPE HELPER ************/
// Elimina filas existentes si coinciden por FECHA (col dateColIndex) o por ID (col idColIndex).
function removeExistingForDateOrIds_(sheet, dateStr, idSet, idColIndex, dateColIndex) {
  const last = sheet.getLastRow();
  if (last < 2) return 0;
  const ids    = sheet.getRange(2, idColIndex, last - 1, 1).getValues();
  const fechas = sheet.getRange(2, dateColIndex, last - 1, 1).getValues();
  let removed = 0;
  for (let i = ids.length - 1; i >= 0; i--) {
    const rowId = String(ids[i][0] || "");
    const rowDate = String(fechas[i][0] || "");
    if ((dateStr && rowDate === dateStr) || (rowId && idSet.has(rowId))) {
      sheet.deleteRow(i + 2);
      removed++;
    }
  }
  return removed;
}

/************ GLOBAL CATALOG ************/
function getOrCreateGlobalCatalog_() {
  let file = null;

  if (PARENT_FOLDER_ID && PARENT_FOLDER_ID.trim()) {
    const folder = DriveApp.getFolderById(PARENT_FOLDER_ID.trim());
    const iter = folder.getFilesByName(GLOBAL_CATALOG_FILENAME);
    while (iter.hasNext()) {
      const f = iter.next();
      if (f.getMimeType() === MimeType.GOOGLE_SHEETS) { file = f; break; }
    }
    if (!file) {
      const ss = SpreadsheetApp.create(GLOBAL_CATALOG_FILENAME);
      DriveApp.getRootFolder().removeFile(DriveApp.getFileById(ss.getId()));
      folder.addFile(DriveApp.getFileById(ss.getId()));
      const sh = ss.getActiveSheet();
      sh.setName('Catalogo');
      sh.appendRow(['key','name','price']);
      sh.setFrozenRows(1);
      return ss;
    }
    return SpreadsheetApp.openById(file.getId());
  } else {
    const iter = DriveApp.getFilesByName(GLOBAL_CATALOG_FILENAME);
    while (iter.hasNext()) {
      const f = iter.next();
      if (f.getMimeType() === MimeType.GOOGLE_SHEETS) { file = f; break; }
    }
    if (!file) {
      const ss = SpreadsheetApp.create(GLOBAL_CATALOG_FILENAME);
      const sh = ss.getActiveSheet();
      sh.setName('Catalogo');
      sh.appendRow(['key','name','price']);
      sh.setFrozenRows(1);
      return ss;
    }
    return SpreadsheetApp.openById(file.getId());
  }
}

function readGlobalCatalog_() {
  const ss = getOrCreateGlobalCatalog_();
  const cat = ss.getSheetByName('Catalogo') || ss.getActiveSheet();
  const values = cat.getDataRange().getValues();
  const items = [];
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    if (!r[0] && !r[1]) continue;
    items.push({ key: String(r[0]||''), name: String(r[1]||''), price: Number(r[2]||0) });
  }
  return { ss, items };
}

function writeGlobalCatalog_(items) {
  const ss = getOrCreateGlobalCatalog_();
  const cat = ss.getSheetByName('Catalogo') || ss.getActiveSheet();
  cat.clear();
  cat.getRange(1,1,1,3).setValues([['key','name','price']]);
  if (items.length) {
    const rows = items.map(it => [String(it.key||''), String(it.name||''), Number(it.price)||0]);
    cat.getRange(2,1,rows.length,3).setValues(rows);
  }
  cat.setFrozenRows(1);
  return ss.getUrl();
}

/************ API: WRITE (INGRESOS) ************/
function addIncome(ing) {
  if (!ing || !ing.date) throw new Error('Falta fecha en ingreso');
  const ss = getOrCreateDailySpreadsheet_(ing.date);
  const { ingresos } = ensureDailySheets_(ss);

  const h = getHeaderMap_(ingresos);
  const hasOld = !!h['paciente_id'];
  const valuesNew = [
    new Date(),
    ing.date || "",
    ing.patientName || "",
    ing.servicesText || "",
    ing.payment || "",
    ing.notes || "",
    Number(ing.totalHNL) || 0,
    ing.ingresoId || genShortId_()
  ];
  const valuesOld = [
    new Date(),
    ing.date || "",
    "", // paciente_id
    ing.patientName || "",
    ing.servicesText || "",
    ing.payment || "",
    ing.notes || "",
    Number(ing.totalHNL) || 0,
    ing.ingresoId || genShortId_()
  ];

  ingresos.appendRow(hasOld ? valuesOld : valuesNew);
  return { ok: true, url: ss.getUrl(), sheetName: 'Ingresos' };
}

function updateIncome(ing) {
  if (!ing || !ing.date || !ing.ingresoId) throw new Error('Faltan datos para actualizar ingreso');
  const targetDate = ing.date;
  const sourceDate = ing.previousDate || ing.date;

  // Abrir hoja origen
  const ssSrc = getOrCreateDailySpreadsheet_(sourceDate);
  const { ingresos: shSrc } = ensureDailySheets_(ssSrc);

  backfillIdsIfMissing_(shSrc, 'ingreso_id');

  const row = findRowByHeaderId_(shSrc, ing.ingresoId, 'ingreso_id');

  // Mismo día → actualizar en sitio
  if (sourceDate === targetDate) {
    if (row === -1) throw new Error('Ingreso no encontrado');
    const h = getHeaderMap_(shSrc);
    const hasOld = !!h['paciente_id'];

    const valsNew = [
      new Date(),
      ing.date || "",
      ing.patientName || "",
      ing.servicesText || "",
      ing.payment || "",
      ing.notes || "",
      Number(ing.totalHNL) || 0,
      ing.ingresoId
    ];
    const valsOld = [
      new Date(),
      ing.date || "",
      "", // paciente_id
      ing.patientName || "",
      ing.servicesText || "",
      ing.payment || "",
      ing.notes || "",
      Number(ing.totalHNL) || 0,
      ing.ingresoId
    ];

    shSrc.getRange(row, 1, 1, (hasOld ? valsOld : valsNew).length).setValues([hasOld ? valsOld : valsNew]);
    return { ok: true, url: ssSrc.getUrl(), sheetName: 'Ingresos', moved: false };
  }

  // Fecha cambió → mover fila
  if (row === -1) throw new Error('Ingreso no encontrado');
  shSrc.deleteRow(row);

  const ssTgt = getOrCreateDailySpreadsheet_(targetDate);
  const { ingresos: shTgt } = ensureDailySheets_(ssTgt);
  const hTgt = getHeaderMap_(shTgt);
  const valsNew = [
    new Date(),
    targetDate || "",
    ing.patientName || "",
    ing.servicesText || "",
    ing.payment || "",
    ing.notes || "",
    Number(ing.totalHNL) || 0,
    ing.ingresoId
  ];
  const valsOld = [
    new Date(),
    targetDate || "",
    "", // paciente_id
    ing.patientName || "",
    ing.servicesText || "",
    ing.payment || "",
    ing.notes || "",
    Number(ing.totalHNL) || 0,
    ing.ingresoId
  ];
  shTgt.appendRow(hTgt['paciente_id'] ? valsOld : valsNew);

  return { ok: true, url: ssTgt.getUrl(), sheetName: 'Ingresos', moved: true };
}

function deleteIncome(payload) {
  if (!payload || !payload.ingresoId) throw new Error('Faltan datos para eliminar ingreso');
  const sourceDate = payload.previousDate || payload.date;
  if (!sourceDate) throw new Error('Falta fecha de origen');

  const ss = getOrCreateDailySpreadsheet_(sourceDate);
  const { ingresos } = ensureDailySheets_(ss);

  backfillIdsIfMissing_(ingresos, 'ingreso_id');

  const row = findRowByHeaderId_(ingresos, payload.ingresoId, 'ingreso_id');
  if (row === -1) throw new Error('Ingreso no encontrado');
  ingresos.deleteRow(row);

  return { ok: true, url: ss.getUrl(), sheetName: 'Ingresos' };
}

/************ API: WRITE (EGRESOS) ************/
function addExpense(exp) {
  if (!exp || !exp.date) throw new Error('Falta fecha en egreso');
  const ss = getOrCreateDailySpreadsheet_(exp.date);
  const { egresos } = ensureDailySheets_(ss);

  egresos.appendRow([
    new Date(),
    exp.date || "",
    exp.concept || "",
    Number(exp.amount) || 0,
    exp.notes || "",
    exp.egresoId || genShortId_()
  ]);

  return { ok: true, url: ss.getUrl(), sheetName: 'Egresos' };
}

function updateExpense(exp) {
  if (!exp || !exp.date || !exp.egresoId) throw new Error('Faltan datos para actualizar egreso');
  const targetDate = exp.date;
  const sourceDate = exp.previousDate || exp.date;

  const ssSrc = getOrCreateDailySpreadsheet_(sourceDate);
  const { egresos: shSrc } = ensureDailySheets_(ssSrc);

  backfillIdsIfMissing_(shSrc, 'egreso_id');

  const row = findRowByHeaderId_(shSrc, exp.egresoId, 'egreso_id');

  if (sourceDate === targetDate) {
    if (row === -1) throw new Error('Egreso no encontrado');
    const values = [
      new Date(),
      exp.date || "",
      exp.concept || "",
      Number(exp.amount) || 0,
      exp.notes || "",
      exp.egresoId
    ];
    shSrc.getRange(row, 1, 1, values.length).setValues([values]);
    return { ok: true, url: ssSrc.getUrl(), sheetName: 'Egresos', moved: false };
  }

  // mover entre días
  if (row === -1) throw new Error('Egreso no encontrado');
  shSrc.deleteRow(row);

  const ssTgt = getOrCreateDailySpreadsheet_(targetDate);
  const { egresos: shTgt } = ensureDailySheets_(ssTgt);
  const values = [
    new Date(),
    targetDate || "",
    exp.concept || "",
    Number(exp.amount) || 0,
    exp.notes || "",
    exp.egresoId
  ];
  shTgt.appendRow(values);

  return { ok: true, url: ssTgt.getUrl(), sheetName: 'Egresos', moved: true };
}

function deleteExpense(payload) {
  if (!payload || !payload.egresoId) throw new Error('Faltan datos para eliminar egreso');
  const sourceDate = payload.previousDate || payload.date;
  if (!sourceDate) throw new Error('Falta fecha de origen');

  const ss = getOrCreateDailySpreadsheet_(sourceDate);
  const { egresos } = ensureDailySheets_(ss);

  backfillIdsIfMissing_(egresos, 'egreso_id');

  const row = findRowByHeaderId_(egresos, payload.egresoId, 'egreso_id');
  if (row === -1) throw new Error('Egreso no encontrado');
  egresos.deleteRow(row);

  return { ok: true, url: ss.getUrl(), sheetName: 'Egresos' };
}

/************ API: CATALOGO (GLOBAL PERSISTENCE) ************/
function saveCatalog(dateStr, items) {
  if (!Array.isArray(items)) throw new Error('Items inválidos');

  // 1) Guardar en el catálogo GLOBAL (fuente de verdad)
  const globalUrl = writeGlobalCatalog_(items);

  // 2) Espejo (opcional) en la hoja del día
  if (dateStr) {
    const ssDaily = getOrCreateDailySpreadsheet_(dateStr);
    const { catalogo } = ensureDailySheets_(ssDaily);
    catalogo.clear();
    catalogo.getRange(1,1,1,3).setValues([['key','name','price']]);
    if (items.length) {
      const rows = items.map(it => [String(it.key||''), String(it.name||''), Number(it.price)||0]);
      catalogo.getRange(2,1,rows.length,3).setValues(rows);
    }
    catalogo.setFrozenRows(1);
  }

  return { ok: true, url: globalUrl, sheetName: 'Catalogo', count: items.length, scope: 'global' };
}

/************ API: READ (sync multi-dispositivo) ************/
function getDayData(dateStr) {
  if (!dateStr) throw new Error('Falta fecha');
  const ss = getOrCreateDailySpreadsheet_(dateStr);
  const { ingresos, egresos, catalogo } = ensureDailySheets_(ss);

  // Backfill IDs por si faltan en filas antiguas
  backfillIdsIfMissing_(ingresos, 'ingreso_id');
  backfillIdsIfMissing_(egresos, 'egreso_id');

  // Ingresos (compat: viejo layout con paciente_id vs nuevo sin paciente_id)
  const ingValues = ingresos.getDataRange().getValues();
  const incomes = [];
  if (ingValues.length > 0) {
    const header = ingValues[0].map(h => String(h || '').toLowerCase());
    const hasOld = header.includes('paciente_id') || header.includes('paciente id');
    for (let i = 1; i < ingValues.length; i++) {
      const r = ingValues[i];
      if (!r[1]) continue;

      if (hasOld) {
        incomes.push({
          id: String(r[8] || ""),
          date: String(r[1] || ""),
          patientName: String(r[3] || ""),
          servicesText: String(r[4] || ""),
          services: [],
          payment: String(r[5] || ""),
          notes: String(r[6] || ""),
          totalHNL: Number(r[7] || 0)
        });
      } else {
        incomes.push({
          id: String(r[7] || ""),
          date: String(r[1] || ""),
          patientName: String(r[2] || ""),
          servicesText: String(r[3] || ""),
          services: [],
          payment: String(r[4] || ""),
          notes: String(r[5] || ""),
          totalHNL: Number(r[6] || 0)
        });
      }
    }
  }

  // Egresos
  const egValues = egresos.getDataRange().getValues();
  const expenses = [];
  for (let i = 1; i < egValues.length; i++) {
    const r = egValues[i];
    if (!r[1]) continue;
    expenses.push({
      id: String(r[5] || ""),
      date: String(r[1] || ""),
      concept: String(r[2] || ""),
      amount: Number(r[3] || 0),
      notes: String(r[4] || "")
    });
  }

  // Catálogo: preferir GLOBAL
  const global = readGlobalCatalog_();
  const catalogItems = (global.items && global.items.length)
    ? global.items
    : (function(){
        const catValues = catalogo.getDataRange().getValues();
        const arr = [];
        for (let i = 1; i < catValues.length; i++) {
          const r = catValues[i];
          if (!r[0] && !r[1]) continue;
          arr.push({ key: String(r[0] || ""), name: String(r[1] || ""), price: Number(r[2] || 0) });
        }
        return arr;
      })();

  const totalIngresos = incomes.reduce((t, x) => t + (Number(x.totalHNL) || 0), 0);
  const totalEgresos = expenses.reduce((t, x) => t + (Number(x.amount) || 0), 0);
  const balance = totalIngresos - totalEgresos;

  return {
    ok: true,
    url: ss.getUrl(),
    incomes,
    expenses,
    catalog: catalogItems,
    stats: { totalIngresos, totalEgresos, balance }
  };
}

/************ (NUEVO) Helpers para YTD leyendo Resumen mensual ************/
function getConsolidatedFilesForYear_(yearNum) {
  const out = [];
  const prefix = `ODOMSA-Consolidado-${yearNum}-`; // e.g., ODOMSA-Consolidado-2025-09
  if (PARENT_FOLDER_ID && PARENT_FOLDER_ID.trim()) {
    const folder = DriveApp.getFolderById(PARENT_FOLDER_ID.trim());
    const it = folder.getFiles();
    while (it.hasNext()) {
      const f = it.next();
      if (f.getMimeType() === MimeType.GOOGLE_SHEETS && f.getName().startsWith(prefix)) {
        out.push(f);
      }
    }
  } else {
    const it = DriveApp.getFiles();
    while (it.hasNext()) {
      const f = it.next();
      if (f.getMimeType() === MimeType.GOOGLE_SHEETS && f.getName().startsWith(prefix)) {
        out.push(f);
      }
    }
  }
  return out;
}

function findResumenValueByLabel_(ss, labelText) {
  const sh = ss.getSheetByName('Resumen');
  if (!sh) return null;
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return null;

  const labels = sh.getRange(1, 1, lastRow, 1).getValues()
    .map(r => String(r[0] || '').trim());
  const idx = labels.findIndex(x => x.toLowerCase() === String(labelText).toLowerCase());
  if (idx === -1) return null;

  const val = sh.getRange(idx + 1, 2).getValue();
  const num = Number(val);
  return isNaN(num) ? 0 : num;
}

/**
 * Lee de cada archivo mensual (Consolidado) los valores del Resumen:
 *  - "Total Ingresos + Adicionales (mes)"
 *  - "Total Egresos + Adicionales (mes)"
 * y suma para el año seleccionado. Escribe el YTD en B30 y B31 del Resumen actual.
 */
function refreshResumenAnnualFromMonthlyResumen_(consSS) {
  const resumen = consSS.getSheetByName('Resumen');
  if (!resumen) return;

  const yearNum = Number(resumen.getRange(3, 2).getValue()); // B3
  if (!yearNum) return;

  const files = getConsolidatedFilesForYear_(yearNum);
  let ytdIng = 0, ytdEgr = 0;

  files.forEach(f => {
    const ss = SpreadsheetApp.openById(f.getId());
    const ingMes = findResumenValueByLabel_(ss, 'Total Ingresos + Adicionales (mes)') ?? 0;
    const egrMes = findResumenValueByLabel_(ss, 'Total Egresos + Adicionales (mes)') ?? 0;
    ytdIng += Number(ingMes) || 0;
    ytdEgr += Number(egrMes) || 0;
  });

  resumen.getRange(30, 2).setValue(ytdIng); // B30
  resumen.getRange(31, 2).setValue(ytdEgr); // B31
  // B32 ya es = B30 - B31
}

/************ API: CONSOLIDAR DÍA (robusto e idempotente) ************/
function consolidateDay(dateStr) {
  if (!dateStr) throw new Error('Falta fecha');

  // Abrir archivos
  const dailySS = getOrCreateDailySpreadsheet_(dateStr);
  const { ingresos, egresos } = ensureDailySheets_(dailySS);

  const consSS = getOrCreateConsolidatedForMonth_(dateStr);
  const { ci, ce, resumen, monthNum, yearNum, monthTag } =
    ensureConsolidatedSheets_(consSS, dateStr);

  // Leer valores del día
  const ingVals = ingresos.getDataRange().getValues();
  const egVals  = egresos.getDataRange().getValues();

  // Detectar layout de ingresos
  const ingHeader = ingVals.length ? ingVals[0].map(s => String(s||'').toLowerCase()) : [];
  const hasOld = ingHeader.includes('paciente_id') || ingHeader.includes('paciente id');

  // Recolectar IDs del día (para dedupe)
  const dayIngresoIds = new Set();
  const dayEgresoIds  = new Set();

  // Preparar lotes
  const batchIng = [];
  for (let i = 1; i < ingVals.length; i++) {
    const r = ingVals[i];
    if (!r[1]) continue; // no fecha
    if (hasOld) {
      const id = String(r[8] || "");
      if (id) dayIngresoIds.add(id);
      batchIng.push([
        String(r[1] || ""), monthNum, yearNum,
        String(r[2] || ""), // paciente_id histórico
        String(r[3] || ""), // paciente_nombre
        String(r[4] || ""), String(r[5] || ""), String(r[6] || ""),
        Number(r[7] || 0),  id,  dailySS.getName()
      ]);
    } else {
      const id = String(r[7] || "");
      if (id) dayIngresoIds.add(id);
      batchIng.push([
        String(r[1] || ""), monthNum, yearNum,
        "",                 // paciente_id
        String(r[2] || ""), // paciente_nombre
        String(r[3] || ""), String(r[4] || ""), String(r[5] || ""),
        Number(r[6] || 0),  id,  dailySS.getName()
      ]);
    }
  }

  const batchEgr = [];
  for (let i = 1; i < egVals.length; i++) {
    const r = egVals[i];
    if (!r[1]) continue; // no fecha
    const id = String(r[5] || "");
    if (id) dayEgresoIds.add(id);
    batchEgr.push([
      String(r[1] || ""), monthNum, yearNum,
      String(r[2] || ""), Number(r[3] || 0),
      String(r[4] || ""), id, dailySS.getName()
    ]);
  }

  // Dedupe por FECHA o por ID antes de insertar
  removeExistingForDateOrIds_(ci, dateStr, dayIngresoIds, 10, 1); // id col J(10), fecha col A(1)
  removeExistingForDateOrIds_(ce, dateStr, dayEgresoIds, 7,  1);  // id col G(7),  fecha col A(1)

  // Insertar
  if (batchIng.length) ci.getRange(ci.getLastRow() + 1, 1, batchIng.length, batchIng[0].length).setValues(batchIng);
  if (batchEgr.length) ce.getRange(ce.getLastRow() + 1, 1, batchEgr.length, batchEgr[0].length).setValues(batchEgr);

  // Asegurar Mes/Año numéricos
  coerceMonthYearToNumbers_(ci);
  coerceMonthYearToNumbers_(ce);

  // Resumen Mes/Año (las fórmulas usan $B$2/$B$3)
  resumen.getRange(2,2).setValue(monthNum);
  resumen.getRange(3,2).setValue(yearNum);

  // NUEVO: YTD leyendo los totales (con adicionales) desde cada Resumen mensual
  refreshResumenAnnualFromMonthlyResumen_(consSS);

  return {
    ok: true,
    consolidatedUrl: consSS.getUrl(),
    consolidatedName: consSS.getName(),
    monthTag,
    appendedIngresos: batchIng.length,
    appendedEgresos: batchEgr.length
  };
}

/************ (Opcional) Migrar catálogo de un día a GLOBAL ************/
function migrateDailyCatalogToGlobal_(dateStr) {
  const ss = getOrCreateDailySpreadsheet_(dateStr);
  const sh = ss.getSheetByName('Catalogo');
  if (!sh) throw new Error("No existe hoja 'Catalogo' en " + ss.getName());
  const vals = sh.getDataRange().getValues();
  const items = [];
  for (let i = 1; i < vals.length; i++) {
    const r = vals[i];
    if (!r[0] && !r[1]) continue;
    items.push({ key: String(r[0]||''), name: String(r[1]||''), price: Number(r[2]||0) });
  }
  writeGlobalCatalog_(items);
  return { ok: true, count: items.length };
}