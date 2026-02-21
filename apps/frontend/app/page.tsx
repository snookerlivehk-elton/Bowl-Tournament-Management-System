'use client'
import { useEffect, useMemo, useState } from 'react'

type Option = { id: number; name: string; direction?: string }

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export default function Page() {
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [content, setContent] = useState('')
  const [amountE, setAmountE] = useState<number>(0)
  const [amountEStr, setAmountEStr] = useState('')
  const [amountI, setAmountI] = useState<number>(0)
  const [amountIStr, setAmountIStr] = useState('')
  const [noteE, setNoteE] = useState('')
  const [noteI, setNoteI] = useState('')
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
  const [toast, setToast] = useState('')
  const [items, setItems] = useState<any[]>([])
  const amountInvalidE = isNaN(amountE) || amountE <= 0
  const amountInvalidI = isNaN(amountI) || amountI <= 0
  const [flowTab, setFlowTab] = useState<'expense' | 'income'>('expense')
  const [isMobile, setIsMobile] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmFlow, setConfirmFlow] = useState<'expense' | 'income'>('expense')
  const [confirmCountdown, setConfirmCountdown] = useState(0)

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
    fetchRecent()
    const fn = () => setIsMobile(window.innerWidth < 900)
    fn()
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  useEffect(() => {
    if (confirmOpen) {
      setConfirmCountdown(3)
      const id = setInterval(() => setConfirmCountdown(v => (v > 0 ? v - 1 : 0)), 1000)
      return () => clearInterval(id)
    } else {
      setConfirmCountdown(0)
    }
  }, [confirmOpen])

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
      const amt = flow === 'expense' ? amountE : amountI
      const amtInvalid = flow === 'expense' ? amountInvalidE : amountInvalidI
      if (amtInvalid) throw new Error('金額不合法')
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
          amount: amt,
          note: flow === 'expense' ? noteE : noteI,
          flow,
        }),
      }).then(r => r.json())
      const failed: string[] = []
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
        if (!res.ok) {
          failed.push(f.name)
          continue
        }
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
      if (failed.length) setToast(`附件上傳失敗：${failed.join(', ')}`)
      setToast(flow === 'expense' ? '支出已儲存' : '收入已儲存')
      setTimeout(() => setToast(''), 3000)
      await fetchRecent()
      setContent('')
      setAmountE(0)
      setAmountEStr('')
      setAmountI(0)
      setAmountIStr('')
      setNoteE('')
      setNoteI('')
      setFiles([])
    } catch (e: any) {
      setMessage(e.message || '發生錯誤')
    } finally {
      setSaving(false)
      setConfirmOpen(false)
    }
  }
  async function fetchRecent() {
    const r = await fetch(`${API}/api/entries`).then(r => r.json())
    setItems(Array.isArray(r) ? r.slice(0, 20) : [])
  }
  function toTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function openConfirm(flow: 'expense' | 'income') {
    if (saving) return
    setConfirmFlow(flow)
    setConfirmOpen(true)
  }
  function closeConfirm() {
    if (saving) return
    setConfirmOpen(false)
  }

  return (
    <div className="container">
      <div className="tabs">
        <button className={flowTab === 'expense' ? 'tabActive tab' : 'tab'} onClick={() => setFlowTab('expense')}>支出</button>
        <button className={flowTab === 'income' ? 'tabActive tab' : 'tab'} onClick={() => setFlowTab('income')}>收入</button>
      </div>
      <div className="grid2">
        {(isMobile ? flowTab === 'expense' : true) && (
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
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
              type="text"
              inputMode="decimal"
              pattern="[0-9]*"
              placeholder="請輸入金額"
              value={amountEStr}
              onChange={e => {
                const raw = e.target.value.replace(/[^\d.\-]/g, '')
                setAmountEStr(raw)
                const n = Number(raw || 0)
                setAmountE(n)
              }}
            className={amountInvalidE && amountEStr ? 'invalid' : ''}
            />
            <div className="hint">預覽：${new Intl.NumberFormat('zh-HK',{maximumFractionDigits:2}).format(amountE || 0)}</div>
          </div>
          {amountInvalidE && amountEStr && <div className="error">請輸入大於 0 的金額</div>}
        </div>
        <div className="field">
          <label>備註（對換助手）</label>
          <ForexNote value={noteE} onChange={setNoteE} />
        </div>
        <div className="field">
          <label>單據上存（相片與PDF）</label>
          <input type="file" multiple onChange={e => setFiles(Array.from(e.target.files || []))} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="expenseBtn" onClick={() => openConfirm('expense')} disabled={saving || amountInvalidE}>提交支出</button>
          <div className="hint">{message}</div>
        </div>
        </div>
        )}
        {(isMobile ? flowTab === 'income' : true) && (
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
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="text"
              inputMode="decimal"
              pattern="[0-9]*"
              placeholder="請輸入金額"
              value={amountIStr}
              onChange={e => {
                const raw = e.target.value.replace(/[^\d.\-]/g, '')
                setAmountIStr(raw)
                const n = Number(raw || 0)
                setAmountI(n)
              }}
            className={amountInvalidI && amountIStr ? 'invalid' : ''}
            />
            <div className="hint">預覽：${new Intl.NumberFormat('zh-HK',{maximumFractionDigits:2}).format(amountI || 0)}</div>
          </div>
          {amountInvalidI && amountIStr && <div className="error">請輸入大於 0 的金額</div>}
        </div>
        <div className="field">
          <label>備註（對換助手）</label>
          <ForexNote value={noteI} onChange={setNoteI} />
        </div>
        <div className="field">
          <label>單據上存（相片與PDF）</label>
          <input type="file" multiple onChange={e => setFiles(Array.from(e.target.files || []))} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="incomeBtn" onClick={() => openConfirm('income')} disabled={saving || amountInvalidI}>提交收入</button>
          <div className="hint">{message}</div>
        </div>
        </div>
        )}
      </div>
      <div className="section">
        <div className="card">
          <h2 style={{ marginTop: 0 }}>最近流水</h2>
          <div className="list">
            {items.map(i => (
              <div className="itemCard" key={i.id}>
                <div>
                  <div>{i.content}</div>
                  <div className="badge">{new Date(i.date).toLocaleDateString('zh-HK')} · {i.category?.name || '-'} · {i.company?.name || '-'}</div>
                </div>
                <div className={Number(i.amount) >= 0 ? 'amtPos' : 'amtNeg'}>
                  ${new Intl.NumberFormat('zh-HK',{maximumFractionDigits:2}).format(Number(i.amount))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {toast && <div className="toast">{toast}</div>}
      <button className="topBtn" onClick={toTop}>返回頂部</button>
      {confirmOpen && (
        <div className="overlay">
          <div className="modal">
            <h3>{confirmFlow === 'expense' ? '確認提交支出' : '確認提交收入'}</h3>
            <div className="row"><div>日期</div><div>{date}</div></div>
            <div className="row"><div>分類</div><div>{categories.find(c=>c.id===categoryId)?.name || '-'}</div></div>
            <div className="row"><div>公司</div><div>{companies.find(c=>c.id===companyId)?.name || '-'}</div></div>
            <div className="row"><div>經手人</div><div>{handlers.find(c=>c.id===handlerId)?.name || '-'}</div></div>
            <div className="row"><div>資金源/去向</div><div>{funds.find(c=>c.id===fundId)?.name || '-'}</div></div>
            <div className="row"><div>內容</div><div>{content || '-'}</div></div>
            <div className="row"><div>金額</div><div>${new Intl.NumberFormat('zh-HK',{maximumFractionDigits:2}).format(confirmFlow==='expense'? (amountE||0) : (amountI||0))}</div></div>
            <div className="hint">此筆將依{confirmFlow==='expense'?'支出':'收入'}自動存為{confirmFlow==='expense'?'負':'正'}數</div>
            <div className="files">
              <div className="row"><div>附件</div><div>{files.length ? `${files.length} 件` : '無'}</div></div>
              {files.length>0 && (
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {files.map((f,i)=>(<li key={i}>{f.name} · {Math.round(f.size/1024)}KB</li>))}
                </ul>
              )}
            </div>
            <div className="modalActions">
              <button onClick={closeConfirm} disabled={saving}>取消</button>
              <button className={confirmFlow==='expense'?'expenseBtn':'incomeBtn'} onClick={() => onSubmit(confirmFlow)} disabled={saving || confirmCountdown>0}>
                確認提交{confirmCountdown>0 ? `（${confirmCountdown}s）` : ''}
              </button>
            </div>
          </div>
        </div>
      )}
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
          <button type="button" className="primary" onClick={() => input.trim() && onQuickCreate(input.trim())}>新增</button>
        </div>
      </div>
      <div className="hint">建議：先輸入再選擇；或直接新增後選擇</div>
    </div>
  )
}

function ForexNote({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [from, setFrom] = useState<'CNY' | 'HKD' | 'USD'>('HKD')
  const [to, setTo] = useState<'CNY' | 'HKD' | 'USD'>('CNY')
  const [amt, setAmt] = useState<string>('')
  const [rate, setRate] = useState<string>('')
  const [extra, setExtra] = useState<string>('')
  function compose(f = from, t = to, a = amt, r = rate, ex = extra) {
    const map: Record<string, string> = { CNY: '人民幣', HKD: '港幣', USD: '美金' }
    const parts: string[] = []
    parts.push(`${map[f]} 轉 ${map[t]}`)
    if (a) parts.push(`金額 ${a}`)
    if (r) parts.push(`匯率 ${r}`)
    if (ex) parts.push(ex)
    onChange(parts.join('；'))
  }
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <select value={from} onChange={e => { const v = e.target.value as any; setFrom(v); compose(v, to, amt, rate, extra) }}>
          <option value="CNY">人民幣</option>
          <option value="HKD">港幣</option>
          <option value="USD">美金</option>
        </select>
        <button type="button" onClick={() => { const f = to; const t = from; setFrom(f); setTo(t); compose(f, t, amt, rate, extra) }}>對換</button>
        <select value={to} onChange={e => { const v = e.target.value as any; setTo(v); compose(from, v, amt, rate, extra) }}>
          <option value="CNY">人民幣</option>
          <option value="HKD">港幣</option>
          <option value="USD">美金</option>
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <input placeholder="金額" inputMode="decimal" value={amt} onChange={e => { const v = e.target.value.replace(/[^\d.]/g, ''); setAmt(v); compose(from, to, v, rate, extra) }} />
        <input placeholder="匯率" inputMode="decimal" value={rate} onChange={e => { const v = e.target.value.replace(/[^\d.]/g, ''); setRate(v); compose(from, to, amt, v, extra) }} />
      </div>
      <input placeholder="補充說明（可選）" value={extra} onChange={e => { const v = e.target.value; setExtra(v); compose(from, to, amt, rate, v) }} />
      <div className="hint">將以文字備註儲存：{value || '（尚未輸入）'}</div>
    </div>
  )
}
