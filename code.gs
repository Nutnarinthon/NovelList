const SHEET_NAME = "Novel";
const MAX_NAME_LENGTH = 200;
const MAX_CHAPTERS = 10000000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Run once from the Apps Script editor before deploying the web app. */
function setupNovelSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error("This script must be bound to a Google Spreadsheet.");

  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) sheet.appendRow(["ID", "Name", "Chapters"]);

  sheet.setFrozenRows(1);
  sheet.getRange("A:A").setNumberFormat("@");
  sheet.getRange("B:B").setNumberFormat("@");
  sheet.getRange("C:C").setNumberFormat("0");
}

function doGet() {
  try {
    const sheet = getNovelSheet_();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return output_({ success: true, data: [] });

    const rows = sheet.getRange(2, 1, lastRow - 1, 3).getDisplayValues();
    const data = rows
      .filter((row) => row[0].trim() !== "")
      .map((row) => ({
        id: row[0].trim(),
        name: row[1],
        chapters: normalizeStoredChapters_(row[2])
      }));

    return output_({ success: true, data: data });
  } catch (error) {
    console.error(error);
    return output_({ success: false, message: "Unable to load novel data." });
  }
}

function doPost(e) {
  let lockAcquired = false;
  const lock = LockService.getScriptLock();

  try {
    const body = parseRequest_(e);
    lockAcquired = lock.tryLock(10000);
    if (!lockAcquired) return output_({ success: false, message: "Server is busy. Please try again." });

    const sheet = getNovelSheet_();
    const action = requireAction_(body.action);
    const id = requireId_(body.id);

    if (action === "add") return addNovel_(sheet, id, body);
    if (action === "update") return updateNovel_(sheet, id, body);
    if (action === "delete") return deleteNovel_(sheet, id);

    return output_({ success: false, message: "Unsupported action." });
  } catch (error) {
    console.error(error);
    return output_({ success: false, message: publicErrorMessage_(error) });
  } finally {
    if (lockAcquired) lock.releaseLock();
  }
}

function addNovel_(sheet, id, body) {
  const name = requireName_(body.name);
  const chapters = requireChapters_(body.chapters);
  const rows = readRows_(sheet);

  if (rows.some((row) => row.id === id)) throw clientError_("ID already exists.");
  if (rows.some((row) => normalizeName_(row.name) === normalizeName_(name))) {
    throw clientError_("Novel name already exists.");
  }

  const rowIndex = sheet.getLastRow() + 1;
  writeNovelRow_(sheet, rowIndex, id, name, chapters);
  return output_({ success: true, action: "add", data: { id: id, name: name, chapters: chapters } });
}

function updateNovel_(sheet, id, body) {
  const rows = readRows_(sheet);
  const current = rows.find((row) => row.id === id);
  if (!current) throw clientError_("Novel ID was not found.");

  const name = body.name === undefined ? current.name : requireName_(body.name);
  const chapters = body.chapters === undefined ? current.chapters : requireChapters_(body.chapters);
  if (rows.some((row) => row.id !== id && normalizeName_(row.name) === normalizeName_(name))) {
    throw clientError_("Novel name already exists.");
  }

  writeNovelRow_(sheet, current.rowIndex, id, name, chapters);
  return output_({ success: true, action: "update", data: { id: id, name: name, chapters: chapters } });
}

function deleteNovel_(sheet, id) {
  const current = readRows_(sheet).find((row) => row.id === id);
  if (!current) throw clientError_("Novel ID was not found.");

  sheet.deleteRow(current.rowIndex);
  return output_({ success: true, action: "delete", data: { id: id } });
}

function readRows_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  return sheet.getRange(2, 1, lastRow - 1, 3).getDisplayValues()
    .map((row, index) => ({
      rowIndex: index + 2,
      id: row[0].trim(),
      name: row[1],
      chapters: normalizeStoredChapters_(row[2])
    }))
    .filter((row) => row.id !== "");
}

function writeNovelRow_(sheet, rowIndex, id, name, chapters) {
  const range = sheet.getRange(rowIndex, 1, 1, 3);
  range.setNumberFormats([["@", "@", "0"]]);
  range.setValues([[asPlainText_(id), asPlainText_(name), chapters]]);
}

function parseRequest_(e) {
  if (!e || !e.postData || !e.postData.contents) throw clientError_("No request body was received.");
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (_) {
    throw clientError_("Request body must be valid JSON.");
  }
  if (!body || Array.isArray(body) || typeof body !== "object") throw clientError_("Invalid request body.");
  return body;
}

function requireAction_(value) {
  const action = String(value || "").trim().toLowerCase();
  if (!["add", "update", "delete"].includes(action)) throw clientError_("Unsupported action.");
  return action;
}

function requireId_(value) {
  const id = String(value || "").trim();
  if (!UUID_PATTERN.test(id)) throw clientError_("Invalid novel ID.");
  return id;
}

function requireName_(value) {
  const name = String(value === undefined || value === null ? "" : value).trim();
  if (!name) throw clientError_("Novel name is required.");
  if (name.length > MAX_NAME_LENGTH) throw clientError_("Novel name is too long.");
  if(/[\u0000-\u001F\u007F]/.test(name)) throw clientError_("Novel name contains unsupported characters.");
  return name;
}

function requireChapters_(value) {
  const chapters = Number(value);
  if (!Number.isInteger(chapters) || chapters < 0 || chapters > MAX_CHAPTERS) {
    throw clientError_("Chapters must be an integer between 0 and " + MAX_CHAPTERS + ".");
  }
  return chapters;
}

function normalizeStoredChapters_(value) {
  const chapters = Number(String(value).replace(/,/g, ""));
  return Number.isInteger(chapters) && chapters >= 0 && chapters <= MAX_CHAPTERS ? chapters : 0;
}

function normalizeName_(value) {
  return String(value).trim().toLocaleLowerCase();
}

function asPlainText_(value) {
  const text = String(value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function getNovelSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error("Spreadsheet is unavailable.");
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error("Novel sheet is not initialized. Run setupNovelSheet first.");
  return sheet;
}

function clientError_(message) {
  const error = new Error(message);
  error.isClientError = true;
  return error;
}

function publicErrorMessage_(error) {
  return error && error.isClientError ? error.message : "The request could not be completed.";
}

function output_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
