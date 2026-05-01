import { useEffect, useState } from 'react'
import axios from 'axios'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const API = 'http://localhost:8000'

export default function Models() {
  const [info, setInfo] = useState(null)

  useEffect(() => {
    axios.get(`${API}/models`).then(r => setInfo(r.data))
  }, [])

  const experiments = [
    { name: 'baseline',    auc: 0.8342, f1: 0.5931, active: true  },
    { name: 'regularized', auc: 0.8306, f1: 0.5625, active: false },
    { name: 'deeper',      auc: 0.8274, f1: 0.5710, active: false },
  ]

  const shap = [
    { feature: 'contract_risk',            importance: 0.962 },
    { feature: 'monthly_to_total_ratio',   importance: 0.361 },
    { feature: 'internetservice_Fiber',    importance: 0.260 },
    { feature: 'monthlycharges',           importance: 0.208 },
    { feature: 'avg_monthly_spend',        importance: 0.175 },
  ]

  return (
    <>
      <div className="page-title">Model registry</div>
      <div className="page-sub">Tracked experiments and active model performance</div>

      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        {[
          ['Active model',  info?.active_model ?? '—',                   'purple'],
          ['ROC-AUC',       info ? info.auc : '—',                        ''],
          ['CV AUC',        info?.cv_auc ?? '—',                          'green'],
        ].map(([label, val, cls]) => (
          <div className="metric-card" key={label}>
            <div className="metric-label">{label}</div>
            <div className={`metric-value ${cls}`} style={{ fontSize: 20 }}>{val}</div>
          </div>
        ))}
      </div>

      <div className="two-col">
        <div className="card">
          <div className="card-title">MLflow experiments</div>
          <table>
            <thead>
              <tr><th>Run name</th><th>AUC</th><th>F1</th><th>Status</th></tr>
            </thead>
            <tbody>
              {experiments.map(e => (
                <tr key={e.name}>
                  <td style={{ fontFamily: 'monospace' }}>{e.name}</td>
                  <td>{e.auc}</td>
                  <td>{e.f1}</td>
                  <td>
                    {e.active
                      ? <span className="badge" style={{ background: '#d3f9d8', color: '#2f9e44' }}>● active</span>
                      : <span className="badge" style={{ background: '#f0f0f0', color: '#888' }}>archived</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-title">SHAP feature importance</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={shap} layout="vertical" margin={{ left: 20 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="feature" tick={{ fontSize: 10 }} width={160} />
              <Tooltip formatter={v => v.toFixed(3)} />
              <Bar dataKey="importance" radius={[0, 4, 4, 0]}>
                {shap.map((_, i) => (
                  <Cell key={i} fill={`hsl(${260 - i * 18}, 70%, ${55 + i * 5}%)`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Model details</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          {[
            ['Algorithm',    'XGBoost (sklearn API)'],
            ['Training data','Telco churn · 7,043 rows'],
            ['Features',     `${info?.features ?? 33} engineered features`],
            ['CV strategy',  '5-fold StratifiedKFold'],
            ['Tracking',     'MLflow 3.1.1'],
            ['Serving',      'FastAPI · Docker · Azure'],
          ].map(([k, v]) => (
            <div key={k} style={{ background: '#f8f8f8', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>{k}</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}