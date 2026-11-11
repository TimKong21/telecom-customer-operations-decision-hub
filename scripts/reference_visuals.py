"""Independent pandas controls for every rendered series in the five report pages."""
import pandas as pd

LEVELS = ['1 - Executive', '2 - Director', '3 - Senior Manager', '4 - Manager', '5 - Senior Officer', '6 - Junior Officer']
LOYALTY = ['0–12 months', '13–24 months', '25–36 months', '37–48 months', '49–60 months', '61–72 months']

def visual_controls(report, source, page):
    result = {}
    def avg(d, field):
        v = d[field].mean()
        return None if pd.isna(v) else float(v)
    def pct(n, d, fallback=None):
        return float(n / d * 100) if d else fallback
    def eq(d, field, value):
        return d.loc[d[field].eq(value)]
    def grouped(id, data, field, aggregate, order=None):
        keys = order if order is not None else sorted(data[field].dropna().unique().tolist(), key=str)
        result[id] = [{'key': k, 'values': aggregate(eq(data, field, k))} for k in keys]
    def counts(id, d, field, order=None): grouped(id, d, field, lambda g: [len(g)], order)
    def shares(id, d, field, order=None): grouped(id, d, field, lambda g: [pct(len(g), len(d), 0)], order)
    def gauge(id, value, key=''): result[id] = [{'key': key, 'values': [value]}]
    d = source.copy()
    if report == 'calls':
        gauge('satisfaction', avg(d, 'satisfaction'))
        gauge('answer-speed', avg(d, 'speed'))
        counts('answered', d, 'answered', ['Y', 'N'])
        counts('resolved', d, 'resolved', ['Y', 'N'])
        # Hour and month sort naturally because the dataset spans Jan–Mar of one year.
        grouped('hourly', d, 'hour', lambda g: [len(g)], sorted(d.hour.unique().tolist()))
        grouped('monthly', d, 'month', lambda g: [len(eq(g, 'answered', 'Y')), len(eq(g, 'answered', 'N'))])
    elif report == 'retention' and page == 1:
        d = eq(d, 'churn', 'Yes')
        counts('gender', d, 'gender')
        for f in ['senior', 'partner', 'dependents']:
            gauge('demographic-' + f, pct(len(eq(d, f, 1 if f == 'senior' else 'Yes')), len(d), 0))
        shares('loyalty', d, 'loyalty', LOYALTY)
        shares('payment', d, 'payment')
        shares('contracts', d, 'contract')
        counts('paperless', d, 'paperless')
        result['average-charges'] = [{'key': 'monthly', 'values': [avg(d, 'monthly')]}, {'key': 'total', 'values': [avg(d, 'total')]}]
        result['services'] = [{'key': f, 'values': [pct(len(eq(d, f, 'Yes')), len(d), 0)]} for f in ['phone', 'tv', 'movies', 'protection', 'backup', 'support', 'security']]
        counts('lines', d.loc[d.lines.isin(['Yes', 'No'])], 'lines')
        counts('internet', d, 'internet')
    elif report == 'retention':
        def risk(id, data, field, second, order=None):
            grouped(id, data, field, lambda g: [pct(len(eq(g, 'churn', 'Yes')), len(g), 0), len(g) if second == 'count' else float(g.monthly.sum())], order)
        risk('internet-risk', d, 'internet', 'count')
        grouped('tickets', d, 'churn', lambda g: [float(g.admin.sum()), float(g.tech.sum())])
        grouped('charges', d, 'churn', lambda g: [float(eq(g, 'internet', s).total.sum()) for s in ['DSL', 'Fiber optic', 'No']])
        risk('payment-risk', d, 'payment', 'monthly')
        for i, contract in enumerate(['Month-to-month', 'One year', 'Two year']):
            risk(f'tenure-{i}', eq(d, 'contract', contract), 'loyalty', 'monthly', LOYALTY)
    elif page == 1:
        grouped('hiring', d, 'level20', lambda g: [len(eq(g, 'gender', 'Female')), len(eq(g, 'gender', 'Male'))], LEVELS)
        grouped('promotions', eq(d, 'promoted21', 'Yes'), 'level21', lambda g: [len(eq(g, 'gender', 'Female')), len(eq(g, 'gender', 'Male')), pct(len(eq(g, 'gender', 'Female')), len(g))], LEVELS[:5])
        grouped('time-level', d, 'level20', lambda g: [avg(eq(g, 'gender', sex), 'yearsInLevel') for sex in ['Female', 'Male']], LEVELS)
        for i, sex in enumerate(['Female', 'Male']):
            grouped(f'turnover-rating-{i}', eq(d, 'gender', sex), 'level20', lambda g: [avg(eq(g, 'leaver', left), 'rating19') for left in ['No', 'Yes']], LEVELS)
    else:
        grouped('ratings', d.loc[d.rating20.isin([1, 2, 3, 4])], 'gender', lambda g: [len(eq(g, 'rating20', rating)) for rating in [1, 2, 3, 4]])
        counts('executive20', eq(d, 'level20', LEVELS[0]), 'gender', ['Female', 'Male'])
        counts('executive21', eq(d, 'level21', LEVELS[0]), 'gender', ['Female', 'Male'])
        counts('executive-hires', eq(eq(d, 'level20', LEVELS[0]), 'newHire', 'Y'), 'gender', ['Female', 'Male'])
        counts('executive-promotions', eq(eq(d, 'level20', LEVELS[0]), 'promoted20', 'Y'), 'gender', ['Female', 'Male'])
        grouped('ages', d.loc[d.leaverFY.isna()], 'age', lambda g: [len(eq(g, 'level21', level)) for level in LEVELS])
    return result
