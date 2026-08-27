/**
 * Google Apps Script da página /confirmacao/.
 *
 * 1. Crie ou abra a planilha de confirmações.
 * 2. Copie o ID que aparece entre /d/ e /edit na URL e cole abaixo.
 * 3. No Apps Script, implante como Aplicativo da Web:
 *    - Executar como: você
 *    - Quem pode acessar: qualquer pessoa
 * 4. Cole a URL terminada em /exec em CONFIRMATION_FORM_ENDPOINT.
 */

const SPREADSHEET_ID = "17bfJtTLs4_fn_5Upk3yMRiIDxOsJH_e0LGyl_gubXN8";
const SHEET_NAME = "Página1";

function doPost(event) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.insertSheet(SHEET_NAME);

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["Nome", "Convidado"]);
      sheet.getRange(1, 1, 1, 2).setFontWeight("bold");
      sheet.setFrozenRows(1);
    }

    const nome = String(event?.parameter?.nome || "").trim();
    const convidado = String(event?.parameter?.convidado || "").trim();

    if (!nome || !["Sim", "Não"].includes(convidado)) {
      return resposta({ ok: false, erro: "Dados inválidos." });
    }

    sheet.appendRow([nome, convidado]);
    return resposta({ ok: true });
  } catch (error) {
    return resposta({ ok: false, erro: String(error) });
  } finally {
    lock.releaseLock();
  }
}

function resposta(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
