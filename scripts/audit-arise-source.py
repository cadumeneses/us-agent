"""Read-only audit of the preserved ARISE supplement; Python standard library only."""
import hashlib
import json
import argparse
from pathlib import Path
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'research/sources/arise-a26/zenodo-17093973'
NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}


def check(condition, message):
    if not condition:
        raise ValueError(message)


def audit():
    inventory = json.loads((SOURCE / 'inventory.json').read_text(encoding='utf-8'))
    metadata_bytes = (SOURCE / 'record-metadata.json').read_bytes()
    check(hashlib.sha256(metadata_bytes).hexdigest() == inventory['metadataSha256'], 'Metadata hash mismatch')
    metadata = json.loads(metadata_bytes)
    check(metadata['id'] == 17093973, 'Unexpected record')
    check(metadata['metadata']['license']['id'] == 'cc-by-4.0', 'Unexpected license')
    check(len(metadata['files']) == 10, 'Record file list changed')
    published = {f['key']: f for f in metadata['files']}
    check(set(published) == set(inventory['files']) | set(inventory['excludedFiles']), 'Unaccounted published file')
    for name, expected in inventory['files'].items():
        check(Path(name).name == name, 'Unsafe source name')
        data = (SOURCE / name).read_bytes()
        check(len(data) == expected['bytes'] == published[name]['size'], f'Size mismatch: {name}')
        check(hashlib.sha256(data).hexdigest() == expected['sha256'], f'SHA-256 mismatch: {name}')
        check('md5:' + hashlib.md5(data).hexdigest() == published[name]['checksum'], f'MD5 mismatch: {name}')

    groups = []
    with zipfile.ZipFile(SOURCE / 'Examples of Feature Vectors.xlsx') as book:
        strings = [''.join(t.text or '' for t in s.findall('.//s:t', NS))
                   for s in ET.fromstring(book.read('xl/sharedStrings.xml')).findall('s:si', NS)]
        workbook = ET.fromstring(book.read('xl/workbook.xml'))
        relationships = ET.fromstring(book.read('xl/_rels/workbook.xml.rels'))
        links = {r.attrib['Id']: r.attrib['Target'] for r in relationships}
        for sheet in workbook.findall('s:sheets/s:sheet', NS):
            rel = sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']
            target = links[rel]
            entry = target.lstrip('/') if target.startswith('/') else 'xl/' + target
            rows = []
            for row in ET.fromstring(book.read(entry)).findall('s:sheetData/s:row', NS):
                cells = {}
                for cell in row.findall('s:c', NS):
                    value = cell.find('s:v', NS)
                    text = value.text if value is not None else ''
                    if cell.get('t') == 's':
                        text = strings[int(text)]
                    elif cell.get('t') == 'inlineStr':
                        text = ''.join(t.text or '' for t in cell.findall('.//s:t', NS))
                    cells[cell.attrib['r']] = text
                rows.append(cells)
            columns = [(address[:-1], value) for address, value in rows[0].items() if value]
            headers = [value for _, value in columns]
            duplicates = sorted({h.strip() for h in headers if sum(x.strip() == h.strip() for x in headers) > 1})
            vectors = []
            for row_number, row in enumerate(rows[1:10], start=2):
                values = [row.get(column + str(row_number)) for column, _ in columns]
                check(all(v in ('0', '1') for v in values), 'Non-binary or missing feature cell')
                vectors.append({'label': row['A' + str(row_number)], 'values': [int(v) for v in values]})
            check(len(vectors) == 9, 'Expected target plus eight illustrative projects')
            groups.append({'sheet': sheet.attrib['name'], 'dimensions': len(columns),
                           'literalHeaders': headers, 'duplicateHeadersAfterTrim': duplicates,
                           'targetLabel': vectors[0]['label'], 'vectors': vectors})

    # Diagnostic only: concatenate the literal columns and use each sheet's row 2
    # as reference. PE/PA are recorded, not silently asserted to be identical.
    dimensions = sum(g['dimensions'] for g in groups)
    scores = []
    for index in range(1, 9):
        labels = {g['vectors'][index]['label'] for g in groups}
        check(len(labels) == 1, 'Project rows do not align across sheets')
        distance = sum(abs(a - b) for g in groups for a, b in
                       zip(g['vectors'][0]['values'], g['vectors'][index]['values']))
        scores.append({'project': labels.pop(), 'distance': distance,
                       'similarity': 1 - distance / dimensions})
    scores.sort(key=lambda x: (-x['similarity'], x['project']))
    published_scores = {'P01': 0.81, 'P03': 0.72, 'P02': 0.65}
    comparisons = [{'project': s['project'], 'literalWorkbookScore': s['similarity'],
                    'articleSection5Score': published_scores[s['project']],
                    'matchesAtTwoDecimals': round(s['similarity'], 2) == published_scores[s['project']]}
                   for s in scores if s['project'] in published_scores]
    figure = json.loads((SOURCE.parent / 'figure-4-review.json').read_text(encoding='utf-8'))
    check(figure['articleSha256'] == inventory['article']['sha256'], 'Figure review article mismatch')
    highlighted = set(figure['highlightedNeighbors'])
    union = {risk for project in figure['projects'] if project['id'] in highlighted for risk in project['risks']}
    displayed = set(figure['displayedRecommendations'])
    ties = {}
    for project in figure['projects']:
        ties.setdefault(str(project['similarity']), []).append(project['id'])
    return {'schemaVersion': 1, 'kind': 'arise_source_diagnostic_not_empirical_reproduction',
            'recordId': 17093973, 'verifiedPreservedFiles': len(inventory['files']),
            'publishedFiles': len(published), 'codeFilesInPublishedList': [n for n in published if n.endswith(('.py', '.R', '.r', '.ipynb'))],
            'featureGroups': groups, 'literalConcatenation': {'dimensions': dimensions,
                'referenceRows': {g['sheet']: g['targetLabel'] for g in groups},
                'formula': '1 - sum(abs(target_i - candidate_i)) / n', 'scores': scores,
                'comparisonToArticle': comparisons},
            'figure4LiteralReview': {'highlightedNeighborRiskUnion': sorted(union),
                'displayedButNotInUnion': sorted(displayed - union),
                'inUnionButNotDisplayed': sorted(union - displayed),
                'tiedSimilarities': {score: ids for score, ids in ties.items() if len(ids) > 1}},
            'limits': ['PE_PA_identity_not_resolved', 'duplicate_columns_preserved',
                'concatenation_is_a_diagnostic_convention_not_confirmed_author_code',
                'no_complete_project_risk_association_matrix_identified',
                'no_operational_import_or_empirical_reproduction']}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--verify', action='store_true', help='Compare with the preserved audit report')
    args = parser.parse_args()
    result = audit()
    if args.verify:
        stored = json.loads((SOURCE.parent / 'source-audit.json').read_text(encoding='utf-8'))
        check(result == stored, 'Preserved audit differs from current sources')
        print(json.dumps({'verifiedPreservedFiles': result['verifiedPreservedFiles'],
                          'reportMatched': True, 'literalDimensions': result['literalConcatenation']['dimensions']}))
    else:
        print(json.dumps(result, ensure_ascii=False, indent=2))
