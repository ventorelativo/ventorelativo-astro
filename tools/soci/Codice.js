/* exported onOpen, preparaFogli, apriAnno, sincronizza, generaTessere, attivaSatispay, installaControllo, doPost */
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
 * ## What runs by itself
 *
 * `sincronizza` is the whole loop, and wants the hourly trigger: it pulls the
 * shop's payments from Satispay, matches each one to the member who owed it,
 * marks the quota paid and emails the card. Nobody has to be watching.
 *
 * The menu is for what needs a decision: opening a year, and the setup.
 *
 * ## Why it calls the API rather than reading an export
 *
 * The payout report gives a payment id, a timestamp and an amount, and no way
 * to tell whose payment it was. Working that out, one payment at a time, was
 * the job this replaces. `GET /g_business/v1/payments` returns **`sender.name`**
 * on every payment, so the same question answers itself.
 *
 * The cost is authentication: an RSA key pair and a signed request. That was
 * once the reason not to do this, when the alternative was standing up a
 * server. It is not, now that the club already runs this script.
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

  /* Told about anything the matching could not decide. */
  avvisi: 'segreteria@ventorelativo.it',
};

const SATISPAY_HOST = 'authservices.satispay.com';

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
    /* The Satispay payment id, once a payment has been matched to this quota:
       the identifier the treasurer used to be handed on its own. */
    'Pagamento',
    'Tessera',
  ],
  /* The club's own copy of what Satispay said, kept rather than consumed: when
     a match looks wrong in eighteen months this is where the original answer
     still is. */
  incassi: ['ID pagamento', 'Data', 'Importo', 'Nome', 'Stato', 'Abbinato a'],
};

/* The three states a quota can be in. Nothing else is a valid value. */
const STATO = { attesa: 'in attesa', rinnovo: 'da rinnovare', pagato: 'pagato' };

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Ventorelativo')
    .addItem('Sincronizza adesso', 'sincronizza')
    .addSeparator()
    .addItem('Apri il nuovo anno', 'apriAnno')
    .addItem('Genera e invia le tessere', 'generaTessere')
    .addSeparator()
    .addItem('Prepara i fogli', 'preparaFogli')
    .addItem('Attiva Satispay', 'attivaSatispay')
    .addItem('Installa il controllo automatico', 'installaControllo')
    .addToUi();
}

/**
 * True when a person is watching, false inside a trigger.
 *
 * `getUi()` throws when the script runs on a timer, which is how a working
 * script becomes a broken one the moment it is automated. Everything that
 * reports goes through here.
 */
function interattivo() {
  try {
    SpreadsheetApp.getUi();
    return true;
  } catch {
    return false;
  }
}

function riferisci(titolo, testo) {
  if (interattivo()) {
    SpreadsheetApp.getUi().alert(`${titolo}\n\n${testo}`);
  } else {
    Logger.log(`${titolo}: ${testo}`);
  }
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
  riferisci('Fogli pronti', 'Le tre schede ci sono.');
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
  });

  return ContentService.createTextOutput('ok');
}

/**
 * Adds a member if they are new, and a quota row for this year if they have
 * none. Idempotent on both counts: somebody who submits the form twice, which
 * people do when they are not sure it worked, gets one row and one quota.
 *
 * ## Why it also matches on the name
 *
 * The register imported from the club's spreadsheet has **no email addresses**:
 * that column never existed. Matching on email alone, every one of those
 * members filling in the form would be greeted as a stranger and given a second
 * row, and the register would quietly double.
 *
 * So a submission whose email matches nobody is checked against the names that
 * have no email yet, and when exactly one fits, **that row gets the address**.
 * The form is not only how a stranger joins, it is how the club collects the
 * addresses it never had, one member at a time, without anybody transcribing
 * anything.
 *
 * Only rows with an empty Email are considered, and only an exact match on the
 * words of the name. Two members called Marco Rossi is a collision the script
 * refuses: it makes a new row and the committee merges them, which is a
 * nuisance, where guessing would be a stranger reading somebody else's card.
 */
function registra({ nome, email, quota }) {
  const anno = new Date().getFullYear();
  const soci = leggi(CONFIG.sheets.soci);
  let socio = soci.find((s) => String(s.Email).toLowerCase() === email);

  if (!socio) {
    const senzaEmail = soci.filter(
      (s) => !s.Email && normalizza(s.Nome) === normalizza(nome),
    );
    if (senzaEmail.length === 1) {
      socio = senzaEmail[0];
      scrivi(CONFIG.sheets.soci, socio._riga, 'Email', email);
      socio.Email = email;
    }
  }

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
    '',
    '',
    STATO.attesa,
    '',
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
      '',
    ]);
    creati += 1;
  }

  const esiti = { senzaEmail: 0 };
  const inviate = inviaRinnovi(anno, esiti);
  const restano = leggi(CONFIG.sheets.quote).filter(
    (q) => Number(q.Anno) === anno && q.Stato === STATO.rinnovo && !q.Invito,
  ).length;

  riferisci(
    `Anno ${anno} aperto`,
    `Righe create: ${creati}\nEmail inviate: ${inviate}` +
      (esiti.senzaEmail
        ? `\n\nSenza indirizzo email: ${esiti.senzaEmail}. Non ricevono il rinnovo ` +
          'né la tessera finché la colonna Email resta vuota.'
        : '') +
      (restano
        ? `\n\nDa scrivere ancora: ${restano}. È finita la quota giornaliera di Gmail: ` +
          'rilancia "Apri il nuovo anno" domani, scriverà solo a chi manca.'
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
function inviaRinnovi(anno, esiti) {
  const soci = leggi(CONFIG.sheets.soci);
  let inviate = 0;
  let rimaste = MailApp.getRemainingDailyQuota();

  for (const quota of leggi(CONFIG.sheets.quote)) {
    if (Number(quota.Anno) !== anno || quota.Stato !== STATO.rinnovo) continue;
    if (quota.Invito) continue;
    const socio = soci.find((s) => s.ID === quota.ID);
    if (!socio) continue;
    /* Counted, not skipped in silence: a member with no address is the one
       thing here a person has to go and fix, and the register arrived from
       the club's spreadsheet without a single email in it. */
    if (!socio.Email) {
      esiti.senzaEmail += 1;
      continue;
    }
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
   Satispay
   ------------------------------------------------------------------------- */

/**
 * Exchanges a one-time activation code for a KeyId, once, ever.
 *
 * Before running it, generate the key pair on a computer and paste both halves
 * into Script Properties as `SATISPAY_PRIVATE_KEY` and `SATISPAY_PUBLIC_KEY`:
 *
 *   openssl genrsa -out satispay.key 4096
 *   openssl rsa -in satispay.key -pubout -out satispay.pub
 *
 * Apps Script cannot generate an RSA pair, and would be the wrong place to do
 * it anyway: the private key should exist somewhere the club controls before
 * it is pasted anywhere.
 *
 * The activation code comes from the Satispay Business account and is burned
 * on use, so a failed run needs a fresh one.
 */
function attivaSatispay() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();
  const pubblica = props.getProperty('SATISPAY_PUBLIC_KEY');
  if (!pubblica) {
    ui.alert('Manca SATISPAY_PUBLIC_KEY nelle proprietà dello script.');
    return;
  }

  const risposta = ui.prompt(
    'Attivazione Satispay',
    'Incolla il codice di attivazione preso dal profilo Satispay Business:',
    ui.ButtonSet.OK_CANCEL,
  );
  if (risposta.getSelectedButton() !== ui.Button.OK) return;

  const esito = UrlFetchApp.fetch(
    `https://${SATISPAY_HOST}/g_business/v1/authentication_keys`,
    {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        public_key: pubblica,
        token: risposta.getResponseText().trim(),
      }),
      muteHttpExceptions: true,
    },
  );

  if (esito.getResponseCode() !== 200) {
    ui.alert(
      `Attivazione fallita (${esito.getResponseCode()}).\n\n${esito.getContentText()}`,
    );
    return;
  }

  props.setProperty('SATISPAY_KEY_ID', JSON.parse(esito.getContentText()).key_id);
  ui.alert('Satispay attivato. Il KeyId è salvato nelle proprietà dello script.');
}

/**
 * The RFC 2822 date the signature is built on, in English, always.
 *
 * Not `Utilities.formatDate`: it renders day and month names in the script's
 * locale, so on an Italian account the header reads "lun, 08 set 2026" and
 * every request comes back rejected. The failure looks like a key problem and
 * is not one, which is worth the fifteen lines.
 */
function dataRfc(d) {
  const GIORNI = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MESI = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const due = (n) => String(n).padStart(2, '0');
  return (
    `${GIORNI[d.getUTCDay()]}, ${due(d.getUTCDate())} ${MESI[d.getUTCMonth()]} ` +
    `${d.getUTCFullYear()} ${due(d.getUTCHours())}:${due(d.getUTCMinutes())}:` +
    `${due(d.getUTCSeconds())} +0000`
  );
}

/**
 * A signed GET against the Business API.
 *
 * The signature covers four lines in a fixed order, `(request-target)`, host,
 * date and digest. The digest of an empty body is still a digest: leaving it
 * out because there is nothing to hash fails.
 *
 * `Host` is deliberately not sent as a header. UrlFetchApp sets it itself and
 * will not be told otherwise; what matters is that the value signed here is
 * the one it is going to send.
 */
function satispayGet(percorso) {
  const props = PropertiesService.getScriptProperties();
  const keyId = props.getProperty('SATISPAY_KEY_ID');
  const chiave = props.getProperty('SATISPAY_PRIVATE_KEY');
  if (!keyId || !chiave)
    throw new Error('Satispay non è attivato. Usa "Attiva Satispay".');

  const data = dataRfc(new Date());
  const digest =
    'SHA-256=' +
    Utilities.base64Encode(
      Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, ''),
    );

  const messaggio = [
    `(request-target): get ${percorso}`,
    `host: ${SATISPAY_HOST}`,
    `date: ${data}`,
    `digest: ${digest}`,
  ].join('\n');

  const firma = Utilities.base64Encode(
    Utilities.computeRsaSha256Signature(messaggio, chiave),
  );

  const esito = UrlFetchApp.fetch(`https://${SATISPAY_HOST}${percorso}`, {
    method: 'get',
    headers: {
      Date: data,
      Digest: digest,
      Authorization:
        `Signature keyId="${keyId}", algorithm="rsa-sha256", ` +
        `headers="(request-target) host date digest", signature="${firma}"`,
    },
    muteHttpExceptions: true,
  });

  if (esito.getResponseCode() !== 200) {
    throw new Error(`Satispay ${esito.getResponseCode()}: ${esito.getContentText()}`);
  }
  return JSON.parse(esito.getContentText());
}

/**
 * Pulls the shop's payments and writes the unseen ones into `Incassi`.
 *
 * Accepted payments only, and only newer than the high-water mark kept in
 * Script Properties, so a quiet day costs one request. The mark moves only
 * after the rows are written: a run that dies halfway repeats itself next time
 * rather than losing a payment, and the id column stops anything being counted
 * twice.
 *
 * `Incassi` is not working state, it is the club's own copy of what Satispay
 * said. Keep it: when a match looks wrong in eighteen months, this is the only
 * place the original answer survives.
 */
function scaricaIncassi() {
  const props = PropertiesService.getScriptProperties();
  const da = Number(props.getProperty('SATISPAY_ULTIMO') || 0);
  const visti = new Set(
    leggi(CONFIG.sheets.incassi).map((r) => String(r['ID pagamento'])),
  );

  let percorso = '/g_business/v1/payments?status=ACCEPTED&limit=100';
  if (da) percorso += `&starting_after_timestamp=${da}`;

  const pagamenti = satispayGet(percorso).data || [];
  let massimo = da;
  let nuovi = 0;

  for (const p of pagamenti) {
    const quando = new Date(p.insert_date);
    massimo = Math.max(massimo, quando.getTime());
    if (visti.has(String(p.id))) continue;

    foglio(CONFIG.sheets.incassi).appendRow([
      p.id,
      quando,
      (p.amount_unit || 0) / 100,
      (p.sender && p.sender.name) || '',
      p.status,
      '',
    ]);
    nuovi += 1;
  }

  if (massimo > da) props.setProperty('SATISPAY_ULTIMO', String(massimo));
  return nuovi;
}

/* -------------------------------------------------------------------------
   L'abbinamento
   ------------------------------------------------------------------------- */

/**
 * Two names are the same person if their words are, in any order.
 *
 * Satispay reports whatever the payer called their own account, so "Mario
 * Rossi" and "Rossi Mario" are one person, and accents are noise.
 */
function normalizza(nome) {
  return String(nome || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ');
}

/**
 * Matches payments to the quotas they paid, and marks those quotas paid.
 *
 * **It marks nothing it had to guess at.** A payment matches when exactly one
 * unpaid quota fits: by the payer's name where the name is a member's,
 * otherwise by an amount only one person still owes. Two people owing thirty
 * euro and neither having paid is not a match, it is a question, and it goes
 * into the report for a person rather than being settled by coin flip.
 *
 * Every match writes the Satispay payment id into the quota row. That id is
 * what the treasurer used to be handed on its own, with the work of finding
 * out whose it was left as an exercise. Now it arrives already attached to
 * somebody.
 */
function abbina() {
  const soci = leggi(CONFIG.sheets.soci);
  const quote = leggi(CONFIG.sheets.quote).filter((q) => q.Stato !== STATO.pagato);
  const esiti = { abbinati: 0, dubbi: [] };

  for (const incasso of leggi(CONFIG.sheets.incassi)) {
    if (incasso['Abbinato a']) continue;
    const euro = Number(incasso.Importo);
    if (!euro) continue;

    const perImporto = quote.filter(
      (q) => q.Stato !== STATO.pagato && Math.abs(Number(q.Importo) - euro) < 0.01,
    );

    /* The name first: it is the field the payout report never carried. */
    let candidate = [];
    const nome = normalizza(incasso.Nome);
    if (nome) {
      const suoi = soci.filter((s) => normalizza(s.Nome) === nome).map((s) => s.ID);
      candidate = perImporto.filter((q) => suoi.indexOf(q.ID) !== -1);
      /* A known member paying an odd amount is still that member. */
      if (!candidate.length) {
        candidate = quote.filter(
          (q) => q.Stato !== STATO.pagato && suoi.indexOf(q.ID) !== -1,
        );
      }
    }
    if (!candidate.length) candidate = perImporto;

    if (candidate.length !== 1) {
      esiti.dubbi.push(
        `${euro} euro il ${incasso.Data} da "${incasso.Nome || 'sconosciuto'}": ` +
          (candidate.length
            ? 'più di una quota possibile'
            : 'nessuna quota corrispondente'),
      );
      continue;
    }

    const quota = candidate[0];
    scrivi(CONFIG.sheets.quote, quota._riga, 'Stato', STATO.pagato);
    scrivi(CONFIG.sheets.quote, quota._riga, 'Rail', 'satispay');
    scrivi(CONFIG.sheets.quote, quota._riga, 'Data', incasso.Data);
    scrivi(CONFIG.sheets.quote, quota._riga, 'Pagamento', incasso['ID pagamento']);
    scrivi(CONFIG.sheets.incassi, incasso._riga, 'Abbinato a', quota.ID);
    quota.Stato = STATO.pagato;
    esiti.abbinati += 1;
  }

  return esiti;
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
  let senzaEmail = 0;

  for (const quota of leggi(CONFIG.sheets.quote)) {
    if (quota.Stato !== STATO.pagato || quota.Tessera) continue;
    const socio = soci.find((s) => s.ID === quota.ID);
    if (!socio) continue;
    /* Same as the renewal: a paid-up member with no address is somebody owed a
       card that cannot be sent, and that has to be said out loud. */
    if (!socio.Email) {
      senzaEmail += 1;
      continue;
    }
    if (MailApp.getRemainingDailyQuota() < 1) break;

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

  if (interattivo()) {
    riferisci(
      'Tessere',
      `Generate e inviate: ${fatte}` +
        (senzaEmail ? `\nIn attesa di un indirizzo email: ${senzaEmail}` : ''),
    );
  }
  return { fatte, senzaEmail };
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

/* -------------------------------------------------------------------------
   Il giro completo
   ------------------------------------------------------------------------- */

/**
 * Payments in, quotas marked, cards out. The whole job, every hour.
 *
 * Runs from the menu and from a trigger, and knows which: on a timer it says
 * nothing unless something actually needs a person. An automation that emails
 * somebody hourly to report that it found nothing is an automation somebody
 * turns off.
 *
 * A dead API does not stop the rest. Bank transfers typed in by hand are
 * waiting for their cards too, and they should not be held up by Satispay
 * having a bad afternoon.
 */
function sincronizza() {
  let nuovi = 0;
  let errore = null;
  try {
    nuovi = scaricaIncassi();
  } catch (e) {
    errore = e.message;
  }

  const esiti = abbina();
  const tessere = generaTessere();

  const riga =
    `Incassi nuovi: ${nuovi}\nQuote abbinate: ${esiti.abbinati}\n` +
    `Tessere inviate: ${tessere.fatte}` +
    (tessere.senzaEmail ? `\nTessere ferme senza email: ${tessere.senzaEmail}` : '') +
    (esiti.dubbi.length ? `\n\nDa sistemare a mano:\n${esiti.dubbi.join('\n')}` : '') +
    (errore ? `\n\nSatispay non ha risposto: ${errore}` : '');

  if (interattivo()) {
    riferisci('Sincronizzazione', riga);
  } else if (esiti.dubbi.length || errore) {
    GmailApp.sendEmail(CONFIG.avvisi, 'Quote: qualcosa da guardare', riga, {
      name: CONFIG.mittente,
    });
  }
}

/** An hourly trigger for `sincronizza`, installed once and idempotently. */
function installaControllo() {
  for (const t of ScriptApp.getProjectTriggers()) {
    if (t.getHandlerFunction() === 'sincronizza') ScriptApp.deleteTrigger(t);
  }
  ScriptApp.newTrigger('sincronizza').timeBased().everyHours(1).create();
  riferisci(
    'Controllo automatico',
    'Da adesso i pagamenti vengono controllati ogni ora.',
  );
}
