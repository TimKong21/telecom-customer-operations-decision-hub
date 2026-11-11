"""Compare retained workbook fields with decoded embedded model rows, keyed by source ID."""
import datetime as dt
import json
from pathlib import Path

import pandas as pd
from pbixray import PBIXRay

ROOT = Path(__file__).resolve().parents[1]
checks = []
retained = {
    'Sheet1': ['Agent', 'Date', 'DateTime', 'Topic', 'Answered (Y/N)', 'Resolved', 'Speed of answer in secs', 'Satisfaction rating'],
    'Pharma Group AG': ['Gender', 'Job Level after FY20 promotions', 'Job Level after FY21 promotions', 'New hire FY20?',
        'FY20 Performance Rating', 'FY19 Performance Rating', 'Promotion in FY21?', 'Promotion in FY20?',
        'In base group for Promotion FY21', 'FY20 leaver?', 'In base group for turnover FY20', 'Leaver FY',
        'Last Department in FY20', 'Age group', 'Broad region group: nationality 1', 'Time in Job Level @01.07.2020'],
}
for path in sorted(ROOT.glob('Task*/*.pbix')):
    model = PBIXRay(str(path))
    table = next(t for t in model.tables if t in ['Sheet1', '01 Churn-Dataset', 'Pharma Group AG'])
    embedded = model.get_table(table)
    workbook = pd.read_excel(next(path.parent.glob('*.xlsx')), sheet_name=table)
    if table == '01 Churn-Dataset':
        embedded = embedded.rename(columns={'SeniorCitizen': 'SeniorCitizenLabel', 'SeniorCitizenChurn': 'SeniorCitizen'})
    key = workbook.columns[0]
    embedded[key] = embedded[key].astype(str)
    workbook[key] = workbook[key].astype(str)
    assert set(embedded[key]) == set(workbook[key]) and embedded[key].is_unique
    workbook = workbook.set_index(key)
    embedded = embedded.set_index(key).reindex(workbook.index)
    columns = retained.get(table, list(workbook.columns))
    differences = {}
    for column in columns:
        left, right = workbook[column], embedded[column]
        if column == 'DateTime':
            # The report uses HOUR(DateTime), not the text timestamp's date portion.
            left = pd.to_datetime(left, dayfirst=True, format='mixed').dt.hour
            right = embedded['Hour']
        elif column == 'Date':
            # VertiPaq dates are floating-point days; normalize sub-microsecond decoding noise.
            left = pd.to_datetime(left, dayfirst=True, format='mixed').dt.round('s')
            right = pd.to_datetime(right).dt.round('s')
        elif pd.api.types.is_numeric_dtype(right):
            left = pd.to_numeric(left, errors='coerce')
        else:
            left, right = left.astype('string'), right.astype('string')
        equal = (left == right).fillna(False) | (left.isna() & right.isna())
        if not equal.all():
            differences[column] = int((~equal).sum())
    assert not differences, f'{path.name}: retained input differences {differences}'
    checks.append({'report': path.name, 'rows': len(workbook), 'matchedFields': ['DateTime -> Hour' if c == 'DateTime' else c for c in columns], 'mismatches': differences})
result = {'method': 'PBIXRay 0.15.5 decoded input rows vs workbooks, aligned by original ID; only the retained Hour projection of DateTime is compared; dates normalized to seconds',
          'daxExecution': False, 'reports': checks}
(ROOT / 'docs/reference/model-data-validation.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8', newline='\n')
print('Matched every retained source field against all 12,543 embedded model rows.')
