#!/usr/bin/env python3
"""
Turns the secretary's "Elenco iscritti" workbook into the two tabs the Google
Sheet wants, as CSV.

Python rather than Node, which is what the rest of this repository speaks, for
one reason: an .xlsx is a zip of XML documents, and Python has both a zip
reader and an XML parser in its standard library while Node has neither. The
alternative was a dependency to run something once a year.

It reads, it never writes to the workbook, and its output goes wherever you
point it: keep that somewhere outside this repository, because it is a list of
members and this repository is public.

  python3 tools/soci/importa-excel.py "scratch/Elenco iscritti 26.xlsx" scratch/

## What the workbook looks like, and what this assumes

Two sheets, one per tier, laid out the same way:

  A         B         C      D          E              F       G
  FIVL?     COGNOME   NOME   CONTANTI   BB/SATISPAY    DATA    note

and in each, three blocks in order: the people who paid this year, one summary
row of totals, then a tail of names with nothing beside them. That tail is
last year's members who have not renewed, which is why they have no amount and
no date. They come out as `inattivo` rather than being dropped: a row costs
nothing, and next January's renewal run only looks at active members anyway.
Delete them from the CSV if the committee would rather they were gone.

**The summary row is what separates the two blocks**, and it is found by
having amounts but no name rather than by its position, which moves every
year.

## The two things it cannot do

There are **no email addresses in the workbook**. Every member comes out with
an empty Email, and until that column is filled the club can send neither a
renewal request nor a card.

The amounts recorded are **net of the Satispay fee** (29.65 and 9.95 against
quotas of 30 and 10), so they are what the club banked, not what the member
paid. The quota is what goes in `Importo`; the sheet's figure would not match
anything Satispay reports.
"""

import csv
import re
import sys
import zipfile
from datetime import date, timedelta
from pathlib import Path
from xml.etree import ElementTree as ET

NS = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
REL = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'

QUOTE = {'soci': ('Socio', 30), 'donazioni': ('Sostenitore', 10)}

# Members who should hold the first ids, in this order. Everybody else follows
# alphabetically by surname, and the people who have not renewed go last, so a
# lapsed member never sits above an active one.
#
# A membership number is only a number until it is printed on somebody's card,
# so this is worth getting right once rather than arguing about later. After
# the first card is issued, use "Rinumera i soci" in the spreadsheet, which
# refuses to run once any of them are out.
PRIMI = [
    'Luca Odetto',
]


def fogli(percorso):
    """Every sheet as (name, [row of {column letter: value}])."""
    z = zipfile.ZipFile(percorso)
    condivise = []
    if 'xl/sharedStrings.xml' in z.namelist():
        for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall(f'{NS}si'):
            condivise.append(''.join(t.text or '' for t in si.iter(f'{NS}t')))

    rels = {r.get('Id'): r.get('Target')
            for r in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}

    for sh in ET.fromstring(z.read('xl/workbook.xml')).find(f'{NS}sheets'):
        target = rels[sh.get(f'{REL}id')].lstrip('/')
        if not target.startswith('xl/'):
            target = 'xl/' + target
        righe = []
        for row in ET.fromstring(z.read(target)).iter(f'{NS}row'):
            celle = {}
            for c in row.findall(f'{NS}c'):
                col = re.match(r'[A-Z]+', c.get('r')).group()
                v = c.find(f'{NS}v')
                inline = c.find(f'{NS}is')
                if c.get('t') == 's' and v is not None:
                    val = condivise[int(v.text)]
                elif inline is not None:
                    val = ''.join(t.text or '' for t in inline.iter(f'{NS}t'))
                else:
                    val = v.text if v is not None else ''
                val = (val or '').strip()
                if val:
                    celle[col] = val
            if celle:
                righe.append(celle)
        yield sh.get('name'), righe


def data_excel(valore):
    """
    Excel's serial day number as a date.

    Day 1 is 1900-01-01 and the epoch is two days behind because Excel keeps
    1900-02-29, a date that never happened, for compatibility with a 1980s
    spreadsheet. Anything that is not a number (one cell reads "12/2025") comes
    back as itself.
    """
    try:
        return (date(1899, 12, 30) + timedelta(days=int(float(valore)))).isoformat()
    except (TypeError, ValueError):
        return valore or ''


def nome_proprio(testo):
    """ALLEGRINI SIMONE reads badly on a membership card. Allegrini Simone."""
    return ' '.join(p.capitalize() for p in ' '.join(testo.split()).split(' '))


def chiave(testo):
    """A name reduced to its words, in order, for comparing two spellings."""
    return ' '.join(sorted(' '.join(str(testo).split()).lower().split()))


def ordinamento(socio):
    """
    First the names in PRIMI, in their order. Then the active members by
    surname, then the lapsed ones.

    The surname is the sort key even though the name is stored the other way
    round: a members list read by a person is alphabetical by surname, and the
    card and the greeting want "Luca Odetto".
    """
    try:
        primo = PRIMI.index(next(p for p in PRIMI if chiave(p) == chiave(socio['Nome'])))
    except StopIteration:
        primo = len(PRIMI)
    return (primo, 0 if socio['Stato'] == 'attivo' else 1,
            socio['_cognome'].lower(), socio['_nome'].lower())


def main():
    if len(sys.argv) < 3:
        sys.exit(f'uso: {sys.argv[0]} <elenco.xlsx> <cartella di uscita>')
    origine, uscita = Path(sys.argv[1]), Path(sys.argv[2])
    uscita.mkdir(parents=True, exist_ok=True)

    soci = {}           # normalised name -> row, so one person is one row
    quote = []
    ordine = 0

    for nome_foglio, righe in fogli(origine):
        tipo = next((k for k in QUOTE if k in nome_foglio.lower()), None)
        if not tipo:
            print(f'  saltato il foglio "{nome_foglio}": non è soci né donazioni')
            continue
        tier, importo = QUOTE[tipo]
        pagati, scaduti, oltre_totali = 0, 0, False

        for celle in righe[1:]:                      # row 1 is the header
            cognome, nome = celle.get('B', ''), celle.get('C', '')
            if not (cognome or nome):
                oltre_totali = True                  # the totals row
                continue

            cognome, nome = nome_proprio(cognome), nome_proprio(nome)
            intero = f'{nome} {cognome}'.strip()
            k = chiave(intero)
            if k not in soci:
                soci[k] = {
                    'ID': '',
                    'Nome': intero,
                    '_cognome': cognome,
                    '_nome': nome,
                    'Email': '',
                    'Stato': 'inattivo' if oltre_totali else 'attivo',
                    'Iscritto dal': '',
                    'Note': '',
                }
            socio = soci[k]
            if not socio['ID']:
                ordine += 1
                socio['ID'] = f'tmp-{ordine}'
            if not oltre_totali:
                socio['Stato'] = 'attivo'            # paying beats lapsed
            if celle.get('A', '').upper() == 'FIVL' and 'FIVL' not in socio['Note']:
                socio['Note'] = (socio['Note'] + ' FIVL').strip()

            if oltre_totali:
                scaduti += 1
                continue

            contanti = celle.get('D')
            quando = data_excel(celle.get('F', ''))
            if not socio['Iscritto dal']:
                socio['Iscritto dal'] = quando
            quote.append({
                'ID': socio['ID'],
                'Anno': 2026,
                'Quota': tier,
                'Importo': importo,
                'Rail': 'contanti' if contanti else 'satispay',
                'Data': quando,
                'Stato': 'pagato',
                'Invito': '',
                'Pagamento': '',
                'Tessera': '',
            })
            pagati += 1

        print(f'  "{nome_foglio}": {pagati} paganti, {scaduti} non rinnovati')

    ordinati = sorted(soci.values(), key=ordinamento)
    rinumerazione = {}
    for posizione, socio in enumerate(ordinati, start=1):
        nuovo = f'VR-{posizione:04d}'
        rinumerazione[socio['ID']] = nuovo
        socio['ID'] = nuovo
    for q in quote:
        q['ID'] = rinumerazione[q['ID']]

    for socio in ordinati:
        del socio['_cognome']
        del socio['_nome']

    scrivi(uscita / 'Soci.csv', ordinati)
    scrivi(uscita / 'Quote.csv', quote)

    senza_email = sum(1 for s in soci.values() if not s['Email'])
    print(f'\n{len(soci)} soci, {len(quote)} quote 2026.')
    print(f'{senza_email} senza email: finché restano così non possono ricevere '
          'né il rinnovo né la tessera.')


def scrivi(percorso, righe):
    with open(percorso, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=list(righe[0].keys()))
        w.writeheader()
        w.writerows(righe)
    print(f'  scritto {percorso} ({len(righe)} righe)')


if __name__ == '__main__':
    main()
