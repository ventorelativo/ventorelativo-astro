/* exported onOpen, preparaFogli, apriAnno, importaIncassi, generaTessere, doPost */
/**
 * Ventorelativo: soci, quote e tessere.
 *
 * This is Google Apps Script, bound to the club's members spreadsheet. It is
 * kept in this repository because it is the only copy that is reviewed, and
 * because a script that lives solely inside one Google account is a script
 * nobody can read after the person who wrote it leaves the committee. It is
 * **not** part of the website build: nothing imports it, and Astro never sees
 * it. See docs/soci.md for what to do with it.
 *
 * It holds no personal data and no secrets. The webhook token lives in Script
 * Properties, never here.
 *
 * ## What it does
 *
 * Four things, all from one menu in the spreadsheet:
 *
 *  - takes a new member straight from the website's form (`doPost`);
 *  - opens a new year, which is the whole point of the exercise: one row per
 *    member and one email each, instead of a committee working through a list;
 *  - marks quotas paid from a Satispay export;
 *  - makes the membership card, a PDF, and emails it.
 *
 * ## The one design rule
 *
 * **A person is a row in `Soci`, forever. A year is a row in `Quote`.** Every
 * renewal is a new Quote row and nothing about the member is copied or
 * rewritten. That is what makes "who was a member in 2026" answerable in three
 * years, and it is why the year is never a column.
 */

/** Everything a committee member might need to change, in one place. */
const CONFIG = {
  sheets: { soci: 'Soci', quote: 'Quote', incassi: 'Incassi' },

  /* The quotas, and the Satispay amount in cents that proves one was paid. */
  quote: {
    Sostenitore: { euro: 10, centesimi: 1000 },
    Socio: { euro: 30, centesimi: 3000 },
  },

  /* The club's Satispay shop. The links on the website use the same one. */
  satispayShop: '1746ccbc-eae4-4ad8-90d8-96712d59e356',

  /* A Slides file with {{nome}}, {{quota}}, {{anno}} and {{tessera}} in it. */
  templateTessera: 'INCOLLA_QUI_L_ID_DEL_TEMPLATE_SLIDES',

  /* Where the generated cards are filed. A Drive folder id. */
  cartellaTessere: 'INCOLLA_QUI_L_ID_DELLA_CARTELLA_DRIVE',

  mittente: 'Parapendio Club Ventorelativo',
  rispondiA: 'segreteria@ventorelativo.it',
};

const HEADERS = {
  soci: ['ID', 'Nome', 'Email', 'Stato', 'Iscritto dal', 'Note'],
  quote: [
    'ID',
    'Anno',
    'Quota',
    'Importo',
    'Rail',
    'Data',
    'Stato',
    'Invito',
    'Tessera',
  ],
};

/* The three states a quota can be in. Nothing else is a valid value. */
const STATO = { attesa: 'in attesa', rinnovo: 'da rinnovare', pagato: 'pagato' };

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Ventorelativo')
    .addItem('Prepara i fogli', 'preparaFogli')
    .addSeparator()
    .addItem('Apri il nuovo anno', 'apriAnno')
    .addItem('Importa incassi Satispay', 'importaIncassi')
    .addItem('Genera e invia le tessere', 'generaTessere')
    .addToUi();
}

/* -------------------------------------------------------------------------
   Fogli
   ------------------------------------------------------------------------- */

/**
 * Creates the tabs and their header rows, once.
 *
 * Safe to run on a spreadsheet that already has them: it only adds what is
 * missing, and never touches a row of data. Run it after importing the club's
 * existing Excel, then move the old columns under the new headings by hand.
 */
function preparaFogli() {
  const ss = SpreadsheetApp.getActive();
  for (const [key, name] of Object.entries(CONFIG.sheets)) {
    let sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    const headers = HEADERS[key];
    if (!headers) continue;
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    }
  }
  SpreadsheetApp.getUi().alert('Fogli pronti.');
}

function foglio(name) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sheet) throw new Error(`Manca il foglio "${name}". Usa "Prepara i fogli".`);
  return sheet;
}

/** A sheet as objects keyed by its header row, plus the row number of each. */
function leggi(name) {
  const sheet = foglio(name);
  const values = sheet.getDataRange().getValues();
  const headers = values.shift();
  return values.map((row, i) => {
    const record = { _riga: i + 2 };
    headers.forEach((h, c) => {
      record[h] = row[c];
    });
    return record;
  });
}

/** Writes one cell by its column name, so column order can change freely. */
function scrivi(name, riga, colonna, valore) {
  const sheet = foglio(name);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const index = headers.indexOf(colonna);
  if (index === -1) throw new Error(`Manca la colonna "${colonna}" in "${name}".`);
  sheet.getRange(riga, index + 1).setValue(valore);
}

/* -------------------------------------------------------------------------
   Il modulo del sito
   ------------------------------------------------------------------------- */

/**
 * The website's membership form, arriving as a Netlify outgoing webhook.
 *
 * Deployed as a Web App (Deploy → New deployment → Web app, execute as
 * yourself, access "Anyone"). "Anyone" is unavoidable: Netlify cannot log in.
 * The defence is the token, which lives in Script Properties under
 * `WEBHOOK_TOKEN` and travels in the URL Netlify calls. A leak buys somebody
 * junk rows in a spreadsheet and nothing else, which is the right amount of
 * exposure for what this is.
 */
function doPost(e) {
  const atteso = PropertiesService.getScriptProperties().getProperty('WEBHOOK_TOKEN');
  if (!atteso || e.parameter.token !== atteso) {
    return ContentService.createTextOutput('no');
  }

  const payload = JSON.parse(e.postData.contents);
  /* Netlify wraps the fields in `data`; a hand test may post them flat. */
  const dati = payload.data || payload;

  registra({
    nome: String(dati.name || '').trim(),
    email: String(dati.email || '')
      .trim()
      .toLowerCase(),
    quota: String(dati.quota || '').trim(),
    rail: 'satispay',
  });

  return ContentService.createTextOutput('ok');
}

/**
 * Adds a member if they are new, and a quota row for this year if they have
 * none. Idempotent on both counts: somebody who submits the form twice, which
 * people do when they are not sure it worked, gets one row and one quota.
 */
function registra({ nome, email, quota, rail }) {
  const anno = new Date().getFullYear();
  const soci = leggi(CONFIG.sheets.soci);
  let socio = soci.find((s) => String(s.Email).toLowerCase() === email);

  if (!socio) {
    const id = nuovoId(soci);
    foglio(CONFIG.sheets.soci).appendRow([id, nome, email, 'attivo', new Date(), '']);
    socio = { ID: id, Nome: nome, Email: email };
  }

  const esistente = leggi(CONFIG.sheets.quote).find(
    (q) => q.ID === socio.ID && Number(q.Anno) === anno,
  );
  if (esistente) return socio;

  foglio(CONFIG.sheets.quote).appendRow([
    socio.ID,
    anno,
    quota,
    (CONFIG.quote[quota] || {}).euro || '',
    rail,
    '',
    STATO.attesa,
    '',
    '',
  ]);
  return socio;
}

/** VR-0001, VR-0002. Readable, sortable, and short enough to say out loud. */
function nuovoId(soci) {
  const numeri = soci
    .map((s) => Number(String(s.ID).replace(/\D/g, '')))
    .filter((n) => !isNaN(n));
  const prossimo = numeri.length ? Math.max(...numeri) + 1 : 1;
  return `VR-${String(prossimo).padStart(4, '0')}`;
}

/* -------------------------------------------------------------------------
   Il rinnovo: il motivo per cui esiste tutto questo
   ------------------------------------------------------------------------- */

/**
 * Opens a new year: one quota row per active member, then one email each.
 *
 * This is the committee's whole January. Everyone who was a member keeps the
 * quota they had last year, which is right far more often than not and is a
 * dropdown to change when it is not.
 */
function apriAnno() {
  const ui = SpreadsheetApp.getUi();
  const anno = new Date().getFullYear();
  const risposta = ui.alert(
    `Aprire l'anno ${anno}?`,
    `Verrà creata una riga per ogni socio attivo che non ne ha già una, e verrà inviata una email di rinnovo a ciascuno.`,
    ui.ButtonSet.OK_CANCEL,
  );
  if (risposta !== ui.Button.OK) return;

  const quote = leggi(CONFIG.sheets.quote);
  const attivi = leggi(CONFIG.sheets.soci).filter((s) => s.Stato === 'attivo');
  let creati = 0;

  for (const socio of attivi) {
    if (quote.some((q) => q.ID === socio.ID && Number(q.Anno) === anno)) continue;

    /* Last year's quota, or Socio for someone whose history says nothing. */
    const precedenti = quote
      .filter((q) => q.ID === socio.ID)
      .sort((a, b) => Number(b.Anno) - Number(a.Anno));
    const quota = precedenti.length ? precedenti[0].Quota : 'Socio';

    foglio(CONFIG.sheets.quote).appendRow([
      socio.ID,
      anno,
      quota,
      (CONFIG.quote[quota] || {}).euro || '',
      '',
      '',
      STATO.rinnovo,
      '',
      '',
    ]);
    creati += 1;
  }

  const inviate = inviaRinnovi(anno);
  const restano = leggi(CONFIG.sheets.quote).filter(
    (q) => Number(q.Anno) === anno && q.Stato === STATO.rinnovo && !q.Invito,
  ).length;

  ui.alert(
    `Anno ${anno} aperto.\n\nRighe create: ${creati}\nEmail inviate: ${inviate}` +
      (restano
        ? `\n\nDa scrivere ancora: ${restano}. È finita la quota giornaliera di Gmail: ` +
          `rilancia "Apri il nuovo anno" domani, scriverà solo a chi manca.`
        : ''),
  );
}

/**
 * The renewal email, one per member, carrying their own payment link.
 *
 * `external_code` is the member's id. If the Satispay export includes that
 * column, `importaIncassi` can match a payment to a person exactly, with no
 * judgement at all. If it does not, the link still works and matching falls
 * back to the amount and the date. It costs nothing to send it either way.
 *
 * ## Why the `Invito` column exists
 *
 * Apps Script will send 100 emails a day from a consumer Gmail account, which
 * a club of eighty clears in one run and nothing else that day. Without a
 * record of who has already been written to, a run that stops halfway leaves
 * no way to tell, and the obvious remedy, running it again, writes to
 * everybody who did get theirs a second time.
 *
 * So each successful send stamps the date and this skips anyone stamped. Run
 * it as often as you like: it only ever writes to whoever is left. That is
 * also what makes stopping early safe, which it does when the quota runs out
 * rather than throwing in the middle of a loop.
 */
function inviaRinnovi(anno) {
  const soci = leggi(CONFIG.sheets.soci);
  let inviate = 0;
  let rimaste = MailApp.getRemainingDailyQuota();

  for (const quota of leggi(CONFIG.sheets.quote)) {
    if (Number(quota.Anno) !== anno || quota.Stato !== STATO.rinnovo) continue;
    if (quota.Invito) continue;
    const socio = soci.find((s) => s.ID === quota.ID);
    if (!socio || !socio.Email) continue;
    if (rimaste < 1) break;

    const importo = (CONFIG.quote[quota.Quota] || {}).centesimi;
    const link =
      `https://www.satispay.com/app/pay/shops/${CONFIG.satispayShop}` +
      `?amount=${importo}&currency=EUR&external_code=${encodeURIComponent(quota.ID)}`;

    GmailApp.sendEmail(
      socio.Email,
      `Rinnovo quota ${anno}`,
      rinnovoTesto(socio, quota, anno, link),
      {
        name: CONFIG.mittente,
        replyTo: CONFIG.rispondiA,
      },
    );
    /* Stamped at once, so an error on the next member cannot un-send this. */
    scrivi(CONFIG.sheets.quote, quota._riga, 'Invito', new Date());
    inviate += 1;
    rimaste -= 1;
  }
  return inviate;
}

function rinnovoTesto(socio, quota, anno, link) {
  return [
    `Ciao ${String(socio.Nome).split(' ')[0]},`,
    '',
    `è il momento di rinnovare la quota ${anno} come ${quota.Quota} (${quota.Importo} euro).`,
    '',
    `Puoi pagare con Satispay qui:`,
    link,
    '',
    `Oppure con bonifico a Associazione Sportiva Vento Relativo,`,
    `IBAN IT67W0326830750052117945240, indicando "${socio.ID} ${anno}" nella causale.`,
    '',
    `Appena registriamo il pagamento ti arriva la tessera ${anno}.`,
    '',
    `Grazie,`,
    `il direttivo`,
  ].join('\n');
}

/* -------------------------------------------------------------------------
   Gli incassi
   ------------------------------------------------------------------------- */

/**
 * Marks quotas paid from the Satispay export.
 *
 * Paste the report into the `Incassi` tab, headers and all, and run this. It
 * looks for a column whose name contains "external" first, because that is an
 * exact match to a member; failing that it matches on the amount within the
 * current year and refuses to guess when two people owe the same amount and
 * neither has paid. Whatever it cannot decide it leaves alone and reports, and
 * a person settles it in ten seconds.
 *
 * Wire transfers are not here on purpose. The treasurer sees them in the bank,
 * types `pagato` in the row, and that is less work than any import would be.
 */
function importaIncassi() {
  const incassi = leggi(CONFIG.sheets.incassi);
  if (!incassi.length) {
    SpreadsheetApp.getUi().alert(`Incolla il report Satispay nel foglio "Incassi".`);
    return;
  }

  const colonne = Object.keys(incassi[0]);
  const colCodice = colonne.find((c) => /external|codice|riferimento/i.test(c));
  const colImporto = colonne.find((c) => /importo|amount|netto/i.test(c));
  const colData = colonne.find((c) => /data|date/i.test(c));

  const quote = leggi(CONFIG.sheets.quote).filter((q) => q.Stato !== STATO.pagato);
  let segnate = 0;
  const irrisolti = [];

  for (const incasso of incassi) {
    const euro = Math.abs(Number(String(incasso[colImporto]).replace(',', '.')));
    if (!euro) continue;

    let candidate = [];
    if (colCodice && incasso[colCodice]) {
      const codice = String(incasso[colCodice]).trim();
      candidate = quote.filter((q) => q.ID === codice && q.Stato !== STATO.pagato);
    }
    if (!candidate.length) {
      candidate = quote.filter(
        (q) => Math.abs(Number(q.Importo) - euro) < 0.01 && q.Stato !== STATO.pagato,
      );
    }

    if (candidate.length !== 1) {
      irrisolti.push(`${euro} euro del ${incasso[colData] || '?'}`);
      continue;
    }

    const quota = candidate[0];
    scrivi(CONFIG.sheets.quote, quota._riga, 'Stato', STATO.pagato);
    scrivi(CONFIG.sheets.quote, quota._riga, 'Rail', 'satispay');
    scrivi(CONFIG.sheets.quote, quota._riga, 'Data', incasso[colData] || new Date());
    quota.Stato = STATO.pagato;
    segnate += 1;
  }

  SpreadsheetApp.getUi().alert(
    `Incassi importati.\n\nQuote segnate come pagate: ${segnate}\n` +
      (irrisolti.length
        ? `Da sistemare a mano (${irrisolti.length}):\n${irrisolti.join('\n')}`
        : 'Nessun pagamento ambiguo.'),
  );
}

/* -------------------------------------------------------------------------
   Le tessere
   ------------------------------------------------------------------------- */

/**
 * A PDF card for every quota marked paid that has not had one yet, emailed to
 * the member and filed in Drive.
 *
 * A PDF rather than a wallet pass, decided 2026-09-08: it opens on every phone,
 * it costs nothing, it needs no developer account, and a committee member can
 * restyle it by editing a Slides file. Google Wallet is a possible second step
 * and would not change anything here; Apple Wallet is 99 dollars a year and a
 * certificate that must be renewed or cards stop being issued, which is the
 * kind of chore a volunteer club discovers eleven months late.
 *
 * The `Tessera` column holding the file's URL is also the guard: this runs
 * over the whole sheet and only touches rows that have none, so it can be run
 * twice without emailing anybody twice.
 */
function generaTessere() {
  const soci = leggi(CONFIG.sheets.soci);
  const cartella = DriveApp.getFolderById(CONFIG.cartellaTessere);
  const template = DriveApp.getFileById(CONFIG.templateTessera);
  let fatte = 0;

  for (const quota of leggi(CONFIG.sheets.quote)) {
    if (quota.Stato !== STATO.pagato || quota.Tessera) continue;
    const socio = soci.find((s) => s.ID === quota.ID);
    if (!socio || !socio.Email) continue;

    const nome = `Tessera ${quota.Anno} ${socio.Nome} (${socio.ID})`;
    const copia = template.makeCopy(nome, cartella);
    const slides = SlidesApp.openById(copia.getId());
    slides.replaceAllText('{{nome}}', socio.Nome);
    slides.replaceAllText('{{quota}}', quota.Quota);
    slides.replaceAllText('{{anno}}', String(quota.Anno));
    slides.replaceAllText('{{tessera}}', socio.ID);
    slides.saveAndClose();

    /* The PDF is the artefact; the Slides copy was only a way to make it. */
    const pdf = cartella.createFile(
      copia.getAs('application/pdf').setName(`${nome}.pdf`),
    );
    copia.setTrashed(true);

    GmailApp.sendEmail(
      socio.Email,
      `La tua tessera ${quota.Anno}`,
      tesseraTesto(socio, quota),
      {
        name: CONFIG.mittente,
        replyTo: CONFIG.rispondiA,
        attachments: [pdf.getAs('application/pdf')],
      },
    );

    scrivi(CONFIG.sheets.quote, quota._riga, 'Tessera', pdf.getUrl());
    fatte += 1;
  }

  SpreadsheetApp.getUi().alert(`Tessere generate e inviate: ${fatte}`);
}

function tesseraTesto(socio, quota) {
  return [
    `Ciao ${String(socio.Nome).split(' ')[0]},`,
    '',
    `abbiamo registrato la tua quota ${quota.Anno} come ${quota.Quota}. Grazie!`,
    '',
    `In allegato trovi la tessera ${quota.Anno}. Il numero è ${socio.ID}.`,
    '',
    `Buoni voli,`,
    `il direttivo`,
  ].join('\n');
}
