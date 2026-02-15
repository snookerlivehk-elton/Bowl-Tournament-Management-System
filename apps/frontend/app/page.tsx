'use client'
import { useEffect, useMemo, useState } from 'react'

type Option = { id: number; name: string; direction?: string }

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export default function Page() {
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [content, setContent] = useState('')
  const [amount, setAmount] = useState<number>(0)
  const [note, setNote] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [companyId, setCompanyId] = useState<number | null>(null)
  const [handlerId, setHandlerId] = useState<number | null>(null)
  const [fundId, setFundId] = useState<number | null>(null)
  const [categories, setCategories] = useState<Option[]>([])
  const [companies, setCompanies] = useState<Option[]>([])
  const [handlers, setHandlers] = useState<Option[]>([])
  const [funds, setFunds] = useState<Option[]>([])
  const [files, setFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  async function fetchOptions() {
    const [cs, cos, hs, fs] = await Promise.all([
      fetch(`${API}/api/categories`).then(r => r.json()),
      fetch(`${API}/api/companies`).then(r => r.json()),
      fetch(`${API}/api/handlers`).then(r => r.json()),
      fetch(`${API}/api/funds`).then(r => r.json()),
    ])
    setCategories(cs)
    setCompanies(cos)
    setHandlers(hs)
    setFunds(fs)
  }

  useEffect(() => {
    fetchOptions()
  }, [])

  async function quickCreate(path: string, name: string, payload: any = {}) {
    const r = await fetch(`${API}/api/${path}/quick-create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, ...payload }),
    })
    return r.json()
  }

  async function onSubmit(flow: 'expense' | 'income') {
    setSaving(true)
    setMessage('')
    try {
      const entry = await fetch(`${API}/api/entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          categoryId,
          companyId,
          handlerId,
          fundId,
          content,
          amount,
          note,
          flow,
        }),
      }).then(r => r.json())
      for (const f of files) {
        const sign = await fetch(`${API}/api/uploads/sign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mime: f.type, size: f.size }),
        }).then(r => r.json())
        const form = new FormData()
        Object.entries(sign.fields).forEach(([k, v]) => form.append(k, String(v)))
        form.append('Content-Type', f.type)
        form.append('file', f)
        const res = await fetch(sign.url, { method: 'POST', body: form })
        if (!res.ok) throw new Error('上傳失敗')
        await fetch(`${API}/api/uploads/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entryId: entry.id,
            key: sign.key,
            filename: f.name,
            mime: f.type,
            size: f.size,
          }),
        })
      }
      setMessage('已儲存')
      setContent('')
      setAmount(0)
      setNote('')
      setFiles([])
    } catch (e: any) {
      setMessage(e.message || '發生錯誤')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="container">
      <div className="grid2">
        <div className="card cardExpense">
          <h1 style={{ marginTop: 0 }}>支出</h1>
        <div className="field">
          <label>日期</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
      <FieldWithQuickCreate
        label="分類"
        options={categories}
        value={categoryId}
        onChange={setCategoryId}
        onQuickCreate={async name => {
          const r = await quickCreate('categories', name)
          await fetchOptions()
          setCategoryId(r.id)
        }}
      />
      <FieldWithQuickCreate
        label="公司名稱"
        options={companies}
        value={companyId}
        onChange={setCompanyId}
        onQuickCreate={async name => {
          const r = await quickCreate('companies', name)
          await fetchOptions()
          setCompanyId(r.id)
        }}
      />
      <FieldWithQuickCreate
        label="經手人"
        options={handlers}
        value={handlerId}
        onChange={setHandlerId}
        onQuickCreate={async name => {
          const r = await quickCreate('handlers', name)
          await fetchOptions()
          setHandlerId(r.id)
        }}
      />
      <FieldWithQuickCreate
        label="資金源/去向"
        options={funds}
        value={fundId}
        onChange={setFundId}
        onQuickCreate={async name => {
          const r = await quickCreate('funds', name, { direction: 'neutral' })
          await fetchOptions()
          setFundId(r.id)
        }}
      />
        <div className="field">
          <label>內容</label>
          <input value={content} onChange={e => setContent(e.target.value)} placeholder="敘述" />
        </div>
        <div className="field">
          <label>金額</label>
          <input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} />
        </div>
        <div className="field">
          <label>備註</label>
          <input value={note} onChange={e => setNote(e.target.value)} />
        </div>
        <div className="field">
          <label>單據上存（相片與PDF）</label>
          <input type="file" multiple onChange={e => setFiles(Array.from(e.target.files || []))} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="expenseBtn" onClick={() => onSubmit('expense')} disabled={saving}>提交支出</button>
          <div className="hint">{message}</div>
        </div>
        </div>
        <div className="card cardIncome">
          <h1 style={{ marginTop: 0 }}>收入</h1>
        <div className="field">
          <label>日期</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <FieldWithQuickCreate
          label="分類"
          options={categories}
          value={categoryId}
          onChange={setCategoryId}
          onQuickCreate={async name => {
            const r = await quickCreate('categories', name)
            await fetchOptions()
            setCategoryId(r.id)
          }}
        />
        <FieldWithQuickCreate
          label="公司名稱"
          options={companies}
          value={companyId}
          onChange={setCompanyId}
          onQuickCreate={async name => {
            const r = await quickCreate('companies', name)
            await fetchOptions()
            setCompanyId(r.id)
          }}
        />
        <FieldWithQuickCreate
          label="經手人"
          options={handlers}
          value={handlerId}
          onChange={setHandlerId}
          onQuickCreate={async name => {
            const r = await quickCreate('handlers', name)
            await fetchOptions()
            setHandlerId(r.id)
          }}
        />
        <FieldWithQuickCreate
          label="資金源/去向"
          options={funds}
          value={fundId}
          onChange={setFundId}
          onQuickCreate={async name => {
            const r = await quickCreate('funds', name, { direction: 'neutral' })
            await fetchOptions()
            setFundId(r.id)
          }}
        />
        <div className="field">
          <label>內容</label>
          <input value={content} onChange={e => setContent(e.target.value)} placeholder="敘述" />
        </div>
        <div className="field">
          <label>金額</label>
          <input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} />
        </div>
        <div className="field">
          <label>備註</label>
          <input value={note} onChange={e => setNote(e.target.value)} />
        </div>
        <div className="field">
          <label>單據上存（相片與PDF）</label>
          <input type="file" multiple onChange={e => setFiles(Array.from(e.target.files || []))} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="incomeBtn" onClick={() => onSubmit('income')} disabled={saving}>提交收入</button>
          <div className="hint">{message}</div>
        </div>
        </div>
      </div>
    </div>
  )
}

function FieldWithQuickCreate({
  label,
  options,
  value,
  onChange,
  onQuickCreate,
}: {
  label: string
  options: Option[]
  value: number | null
  onChange: (v: number | null) => void
  onQuickCreate: (name: string) => Promise<void>
}) {
  const [input, setInput] = useState('')
  const matched = useMemo(() => options.filter(o => o.name.toLowerCase().includes(input.toLowerCase())), [options, input])
  return (
    <div className="section">
      <div className="field">
        <label>{label}</label>
        <select value={value ?? ''} onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}>
          <option value="">未選擇</option>
          {options.map(o => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>快速新增</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={input} onChange={e => setInput(e.target.value)} placeholder="輸入新增" />
          <button type="button" className="primary" onClick={() => onQuickCreate(input)}>新增</button>
        </div>
      </div>
      <div className="hint">建議：先輸入再選擇；或直接新增後選擇</div>
    </div>
  )
}
