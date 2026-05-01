import { useState } from 'react'
import axios from 'axios'

const API = 'http://localhost:8000'

const DEFAULT = {
  customer_id: 'CUST-003', gender: 1, senior_citizen: 0,
  partner: 0, dependents: 0, tenure: 12,
  paperless_billing: 1, monthly_charges: 70,
  total_charges: 840, service_count: 3,
  contract_risk: 3, payment_risk: 2
}

export default function Predict() {
  const [form, setForm]     = useState(DEFAULT)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    setLoading(true); setError(null); setResult(null)
    try {
      const r = await axios.post(`${API}/predict`, {
        ...form,
        gender: +form.gender, senior_citizen: +form.senior_citizen,
        partner: +form.partner, dependents: +form.dependents,
        paperless_billing: +form.paperless_billing,
        tenure: +form.tenure, monthly_charges: +form.monthly_charges,
        total_charges: +form.total_charges, service_count: +form.service_count,
        contract_risk: +form.contract_risk, payment_risk: +form.payment_risk,
      })
      setResult(r.data)
    } catch(e) {
      setError(e.message)
    }
    setLoading(false)
  }

  const pct = result ? (result.churn_probability * 100).toFixed(1) : 0
  const color = result?.risk_level === 'high' ? '#d20f39' : result?.risk_level === 'medium' ? '#e49320' : '#40a02b'

  return (
    <>
      <div className="page-title">Predict churn</div>
      <div className="page-sub">Enter customer details to get a real-time prediction from the model</div>

      <div className="two-col">
        <div className="card">
          <div className="card-title">Customer input</div>
          <div className="form-grid">
            <div className="form-group">
              <label>Customer ID</label>
              <input value={form.customer_id} onChange={e => set('customer_id', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Tenure (months)</label>
              <input type="number" min="0" max="72" value={form.tenure} onChange={e => set('tenure', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Monthly charges ($)</label>
              <input type="number" value={form.monthly_charges} onChange={e => set('monthly_charges', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Total charges ($)</label>
              <input type="number" value={form.total_charges} onChange={e => set('total_charges', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Contract type</label>
              <select value={form.contract_risk} onChange={e => set('contract_risk', e.target.value)}>
                <option value={1}>Two year</option>
                <option value={2}>One year</option>
                <option value={3}>Month-to-month</option>
              </select>
            </div>
            <div className="form-group">
              <label>Payment method</label>
              <select value={form.payment_risk} onChange={e => set('payment_risk', e.target.value)}>
                <option value={1}>Auto pay</option>
                <option value={2}>Mailed check</option>
                <option value={3}>Electronic check</option>
              </select>
            </div>
            <div className="form-group">
              <label>Services subscribed (0–9)</label>
              <input type="number" min="0" max="9" value={form.service_count} onChange={e => set('service_count', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Paperless billing</label>
              <select value={form.paperless_billing} onChange={e => set('paperless_billing', e.target.value)}>
                <option value={1}>Yes</option>
                <option value={0}>No</option>
              </select>
            </div>
            <div className="form-group">
              <label>Partner</label>
              <select value={form.partner} onChange={e => set('partner', e.target.value)}>
                <option value={0}>No</option>
                <option value={1}>Yes</option>
              </select>
            </div>
            <div className="form-group">
              <label>Senior citizen</label>
              <select value={form.senior_citizen} onChange={e => set('senior_citizen', e.target.value)}>
                <option value={0}>No</option>
                <option value={1}>Yes</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: 20 }}>
            <button className="btn btn-primary" onClick={submit} disabled={loading}>
              {loading ? 'Predicting...' : 'Run prediction'}
            </button>
          </div>
          {error && <div style={{ color: '#d20f39', fontSize: 12, marginTop: 10 }}>{error}</div>}
        </div>

        <div className="card">
          <div className="card-title">Prediction result</div>
          {!result && (
            <div style={{ color: '#aaa', fontSize: 13, paddingTop: 8 }}>
              Fill in the form and click "Run prediction"
            </div>
          )}
          {result && (
            <>
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>Churn probability</div>
                <div style={{ fontSize: 52, fontWeight: 700, color }}>{pct}%</div>
                <span className={`badge badge-${result.risk_level}`} style={{ fontSize: 13, padding: '5px 16px', marginTop: 8, display: 'inline-block' }}>
                  {result.risk_level} risk
                </span>
              </div>

              <div className="risk-bar" style={{ height: 12, margin: '16px 0' }}>
                <div className="risk-fill" style={{ width: `${pct}%`, background: color }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
                {[
                  ['Customer', result.customer_id],
                  ['Prediction', result.churn_prediction === 1 ? 'Will churn' : 'Will stay'],
                  ['Probability', `${pct}%`],
                  ['Logged at', result.timestamp?.slice(11, 19)],
                ].map(([k, v]) => (
                  <div key={k} style={{ background: '#f8f8f8', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>{k}</div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{v}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}