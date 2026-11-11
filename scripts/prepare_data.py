"""Deterministic workbook snapshots, source validation, and independent calculation controls."""
import hashlib
import json
from pathlib import Path

import pandas as pd
from reference_visuals import visual_controls

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'public' / 'data'
OUTPUT.mkdir(parents=True, exist_ok=True)

MAPPINGS = {
    'calls': ('Task 1 - Call Centre Trends/01 Call-Center-Dataset.xlsx', 'Sheet1', {
        'Call Id': 'id', 'Agent': 'agent', 'Date': 'date', 'DateTime': 'datetime', 'Topic': 'topic',
        'Answered (Y/N)': 'answered', 'Resolved': 'resolved', 'Speed of answer in secs': 'speed', 'Satisfaction rating': 'satisfaction'}),
    'retention': ('Task 2 - Customer Retention/02 Churn-Dataset.xlsx', '01 Churn-Dataset', {
        'customerID': 'id', 'gender': 'gender', 'SeniorCitizen': 'senior', 'Partner': 'partner', 'Dependents': 'dependents',
        'tenure': 'tenure', 'PhoneService': 'phone', 'MultipleLines': 'lines', 'InternetService': 'internet',
        'OnlineSecurity': 'security', 'OnlineBackup': 'backup', 'DeviceProtection': 'protection', 'TechSupport': 'support',
        'StreamingTV': 'tv', 'StreamingMovies': 'movies', 'Contract': 'contract', 'PaperlessBilling': 'paperless',
        'PaymentMethod': 'payment', 'MonthlyCharges': 'monthly', 'TotalCharges': 'total',
        'numAdminTickets': 'admin', 'numTechTickets': 'tech', 'Churn': 'churn'}),
    'inclusion': ('Task 3 - Diversity & Inclusion/03 Diversity-Inclusion-Dataset.xlsx', 'Pharma Group AG', {
        'Employee ID': 'id', 'Gender': 'gender', 'Job Level after FY20 promotions': 'level20',
        'Job Level after FY21 promotions': 'level21', 'New hire FY20?': 'newHire', 'FY20 Performance Rating': 'rating20',
        'FY19 Performance Rating': 'rating19', 'Promotion in FY21?': 'promoted21', 'Promotion in FY20?': 'promoted20',
        'In base group for Promotion FY21': 'promotionBase', 'FY20 leaver?': 'leaver',
        'In base group for turnover FY20': 'turnoverBase', 'Leaver FY': 'leaverFY',
        'Last Department in FY20': 'department', 'Age group': 'age', 'Broad region group: nationality 1': 'region',
        'Time in Job Level @01.07.2020': 'yearsInLevel'}),
}

def write(path, value, pretty=False):
    path.write_text(json.dumps(value, ensure_ascii=False, allow_nan=False, indent=2 if pretty else None, separators=None if pretty else (',', ':')) + '\n', encoding='utf-8', newline='\n')

def ratio(n, d, empty=None):
    return float(n / d * 100) if d else empty

def avg(frame, field):
    value = frame[field].mean()
    return None if pd.isna(value) else float(value)

def controls(report, frame):
    if report == 'calls':
        return {'count': len(frame), 'answered': int(frame.answered.eq('Y').sum()), 'resolved': int(frame.resolved.eq('Y').sum()),
                'satisfaction': avg(frame, 'satisfaction'), 'speed': avg(frame, 'speed')}
    if report == 'retention':
        churned = frame.loc[frame.churn.eq('Yes')]
        return {'count': len(frame), 'churned': len(churned), 'churnRate': ratio(len(churned), len(frame), 0),
                'total': float(frame.total.sum()), 'monthly': avg(frame, 'monthly'), 'averageTotal': avg(frame, 'total'),
                'tech': float(frame.tech.sum()), 'admin': float(frame.admin.sum())}
    men = frame.loc[frame.gender.eq('Male')]
    women = frame.loc[frame.gender.eq('Female')]
    before = int(frame.turnoverBase.eq('Y').sum())
    promoted = frame.loc[frame.promoted21.eq('Yes')]
    return {'count': len(frame), 'womenShare': ratio(len(women), len(men) + len(women)),
            'turnover': ratio(int(frame.leaver.eq('Yes').sum()), (before + len(frame)) / 2),
            'womenPromoted': ratio(int(promoted.gender.eq('Female').sum()), len(promoted)),
            'ratingMen': avg(men, 'rating20'), 'ratingWomen': avg(women, 'rating20'),
            'promotions': len(promoted), 'leavers': int(frame.leaver.eq('Yes').sum())}

manifest = {'schemaVersion': 1, 'datasets': {}, 'modelSpecification': 'docs/reference/reports.json'}
fixtures = []
visual_fixtures = []
expected_counts = {'calls': 5000, 'retention': 7043, 'inclusion': 500}
for report, (source, sheet, mapping) in MAPPINGS.items():
    original = pd.read_excel(ROOT / source, sheet_name=sheet)
    missing = set(mapping) - set(original.columns)
    if missing:
        raise ValueError(f'{report}: missing columns {missing}')
    frame = original[list(mapping)].rename(columns=mapping).copy()
    assert len(frame) == expected_counts[report], f'{report}: unexpected row count'
    assert frame.id.notna().all() and frame.id.is_unique, f'{report}: missing/duplicate IDs'
    # Internal keys retain row identity without distributing the source identifiers.
    frame['id'] = [f'{report}-{i+1}' for i in range(len(frame))]
    if report == 'calls':
        frame.date = pd.to_datetime(frame.date).dt.strftime('%Y-%m-%d')
        frame['hour'] = pd.to_datetime(frame.datetime, dayfirst=True, format='mixed').dt.hour
        frame['month'] = frame.date.str.slice(0, 7)
        frame = frame.drop(columns='datetime')
        assert frame.date.min() == '2021-01-01' and frame.date.max() == '2021-03-31'
    elif report == 'retention':
        frame.total = pd.to_numeric(frame.total, errors='coerce')
        assert int(frame.total.isna().sum()) == 11
        frame['loyalty'] = frame.tenure.map(lambda x: ['0–12 months', '13–24 months', '25–36 months', '37–48 months', '49–60 months', '61–72 months'][min(max(int(x)-1, 0)//12, 5)])
        assert frame.tenure.between(0, 72).all()
    else:
        assert frame.gender.isin(['Male', 'Female']).all()
    rows = json.loads(frame.to_json(orient='records', date_format='iso', double_precision=15))
    write(OUTPUT / f'{report}.json', rows)
    manifest['datasets'][report] = {'source': source, 'sheet': sheet, 'rows': len(rows),
        'sourceSha256': hashlib.sha256((ROOT / source).read_bytes()).hexdigest(),
        'dataSha256': hashlib.sha256((OUTPUT / f'{report}.json').read_bytes()).hexdigest(),
        'nullCounts': {str(k): int(v) for k, v in frame.isna().sum().items() if v}, 'controls': controls(report, frame)}
    scenarios = [('default', {})]
    if report == 'calls':
        scenarios += [('topic', {'topic': ['Technical Support']}), ('intersection', {'topic': ['Technical Support'], 'month': ['2021-01']}), ('multi', {'topic': ['Technical Support', 'Contract related']})]
    elif report == 'retention':
        scenarios += [('churned', {'churn': ['Yes']}), ('intersection', {'contract': ['Month-to-month'], 'internet': ['Fiber optic']}), ('zero-tenure', {'tenure': [0]})]
    else:
        scenarios += [('department', {'department': ['Operations']}), ('intersection', {'department': ['Operations'], 'age': ['30 to 39']}), ('region', {'region': ['Europe']})]
    scenarios += [('empty', {'id': ['missing']})]
    for name, filters in scenarios:
        selected = frame
        for field, values in filters.items():
            selected = selected.loc[selected[field].isin(values)]
        fixtures.append({'report': report, 'name': name, 'filters': filters, 'expected': controls(report, selected)})
        for page in ([1] if report == 'calls' else [1, 2]):
            visual_fixtures.append({'report': report, 'page': page, 'name': name, 'filters': filters, 'expected': visual_controls(report, selected, page)})

spec = json.loads((ROOT / 'docs/reference/reports.json').read_text(encoding='utf-8'))
for report in spec:
    assert hashlib.sha256((ROOT / report['source']).read_bytes()).hexdigest() == report['sha256'], 'PBIX changed: regenerate report specifications'
manifest['measureCount'] = sum(len(r['measures']) for r in spec)
write(OUTPUT / 'manifest.json', manifest, True)
write(ROOT / 'src' / 'reference-cases.json', fixtures, True)
write(ROOT / 'src' / 'reference-visuals.json', visual_fixtures, True)
(ROOT / 'public' / 'methodology.txt').write_text((ROOT / 'docs/report-fidelity.md').read_text(encoding='utf-8'), encoding='utf-8', newline='\n')
(ROOT / 'public' / 'case-material-notice.txt').write_text((ROOT / 'NOTICE.md').read_text(encoding='utf-8'), encoding='utf-8', newline='\n')
print('Prepared 12,543 records, source checks, provenance, and independent calculation fixtures.')
