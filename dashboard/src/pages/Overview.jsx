import { useEffect, useState } from 'react'
import axios from 'axios'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts'

const API = 'http://localhost:8000'

export default function Overview() {
  const [metrics, setMetrics] = useState(null)

  useEffect(() => {
    axios.get(`${API}/metrics`).then(r => setMetrics(r.data))
  }, [])

  const recent = metrics?.recent_predictions || []

  const riskDist = [
    { name: 'High',   value: recent.filter(p => p.churn_probability >= 0.7).length, color: '#d20f39' },
    { name: 'Medium', value: recent.filter(p => p.churn_probability >= 0.4 && p.churn_probability < 0.7).length, color: '#e49320' },
    { name: 'Low',    value: recent.filter(p => p.churn_probability < 0.4).length, color: '#40a02b' },
  ]

  const trendData = recent.map((p, i) => ({
    name: `#${i + 1}`,
    prob: parseFloat((p.churn_probability * 100).toFixed(1))
  }))

  return (
    <>
      <div className="page-title">Overview</div>
      <div className="page-sub">Live prediction metrics from your feature store API</div>

      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">Total predictions</div>
          <div className="metric-value purple">{metrics?.total_predictions ?? '—'}</div>
          <div className="metric-sub">all time</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Avg churn probability</div>
          <div className="metric-value">
            {metrics ? `${(metrics.avg_probability * 100).toFixed(1)}%` : '—'}
          </div>
          <div className="metric-sub">across all requests</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Churn rate</div>
          <div className={`metric-value ${metrics?.churn_rate > 0.3 ? 'red' : 'green'}`}>
            {metrics ? `${(metrics.churn_rate * 100).toFixed(1)}%` : '—'}
          </div>
          <div className="metric-sub">predicted positives</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">High risk customers</div>
          <div className="metric-value red">{metrics?.high_risk_count ?? '—'}</div>
          <div className="metric-sub">prob ≥ 70%</div>
        </div>
      </div>

      <div className="two-col">
        <div className="card">
          <div className="card-title">Churn probability trend</div>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={trendData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <Tooltip formatter={v => `${v}%`} />
                <Line type="monotone" dataKey="prob" stroke="#8839ef" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <div style={{ color: '#aaa', fontSize: 13, paddingTop: 12 }}>No predictions yet — use the Predict tab</div>}
        </div>

        <div className="card">
          <div className="card-title">Risk distribution</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={riskDist}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {riskDist.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Recent predictions</div>
        {recent.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Customer ID</th>
                <th>Churn probability</th>
                <th>Risk level</th>
                <th>Risk bar</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((p, i) => (
                <tr key={i}>
                  <td style={{ fontFamily: 'monospace' }}>{p.customer_id}</td>
                  <td>{(p.churn_probability * 100).toFixed(1)}%</td>
                  <td>
                    <span className={`badge badge-${p.churn_probability >= 0.7 ? 'high' : p.churn_probability >= 0.4 ? 'medium' : 'low'}`}>
                      {p.churn_probability >= 0.7 ? 'high' : p.churn_probability >= 0.4 ? 'medium' : 'low'}
                    </span>
                  </td>
                  <td style={{ width: 120 }}>
                    <div className="risk-bar">
                      <div className="risk-fill" style={{
                        width: `${p.churn_probability * 100}%`,
                        background: p.churn_probability >= 0.7 ? '#d20f39' : p.churn_probability >= 0.4 ? '#e49320' : '#40a02b'
                      }} />
                    </div>
                  </td>
                  <td style={{ color: '#888' }}>{p.timestamp?.slice(0, 19).replace('T', ' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div style={{ color: '#aaa', fontSize: 13 }}>No predictions yet — use the Predict tab to generate some</div>}
      </div>
    </>
  )
}