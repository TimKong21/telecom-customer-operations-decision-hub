"""Read-only PBIX inspection. Run separately; the browser never needs PBIXRay."""
import hashlib
import json
import re
import zipfile
from pathlib import Path

from pbixray import PBIXRay

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'docs' / 'reference'
OUT.mkdir(parents=True, exist_ok=True)
reports = []
for path in sorted(ROOT.glob('reports/Task*/*.pbix')):
    model = PBIXRay(str(path))
    with zipfile.ZipFile(path) as archive:
        layout = json.loads(archive.read('Report/Layout').decode('utf-16-le'))
        pages = []
        for section in layout['sections']:
            visuals = []
            for visual in section['visualContainers']:
                config = json.loads(visual.get('config', '{}'))
                single = config.get('singleVisual', {})
                if single.get('visualType') in ('basicShape', 'shape', 'textbox'):
                    continue
                visuals.append({
                    'id': config.get('name'), 'type': single.get('visualType'),
                    'position': {k: visual.get(k) for k in ('x', 'y', 'width', 'height')},
                    'projections': single.get('projections'), 'query': single.get('prototypeQuery'),
                    'objects': single.get('objects'), 'containerObjects': single.get('vcObjects'),
                    'filters': json.loads(visual.get('filters', '[]')),
                })
            pages.append({'name': section['displayName'].strip(), 'id': section['name'],
                          'width': section['width'], 'height': section['height'],
                          'filters': json.loads(section.get('filters', '[]')),
                          'config': json.loads(section.get('config', '{}')), 'visuals': visuals})
        themes = {n: json.loads(archive.read(n)) for n in archive.namelist() if n.endswith('.json') and 'Themes/' in n}
    queries = json.loads(model.power_query.to_json(orient='records'))
    for query in queries:
        query['Expression'] = re.sub(r'File.Contents\("[^"]+"\)', 'File.Contents("<source-workbook>")', query['Expression'])
    tables = [str(t) for t in model.tables if not str(t).startswith(('DateTableTemplate_', 'LocalDateTable_'))]
    reports.append({'source': path.relative_to(ROOT).as_posix(), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                    'measures': json.loads(model.dax_measures.to_json(orient='records')),
                    'calculatedColumns': json.loads(model.dax_columns.to_json(orient='records')),
                    'relationships': json.loads(model.relationships.to_json(orient='records')),
                    'powerQuery': queries, 'pages': pages, 'themes': themes,
                    'embeddedRows': {t: len(model.get_table(t)) for t in tables}})
(OUT / 'reports.json').write_text(json.dumps(reports, indent=2, ensure_ascii=False) + '\n', encoding='utf-8', newline='\n')
print(f'Extracted {len(reports)} reports, {sum(len(r["measures"]) for r in reports)} DAX measures, and {sum(len(r["pages"]) for r in reports)} pages.')
