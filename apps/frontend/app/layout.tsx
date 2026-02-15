export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <head>
        <title>J18 - finance</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="manifest" href="/manifest.json" />
        <style>{`
          :root {
            --bg: #0f172a;
            --panel: #111827;
            --card: #1f2937;
            --muted: #9ca3af;
            --text: #f9fafb;
            --brand: #60a5fa;
            --accent: #34d399;
          }
          * { box-sizing: border-box }
          html, body { height: 100% }
          body {
            margin: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', 'PingFang TC', 'Microsoft JhengHei', sans-serif;
            background: linear-gradient(180deg, var(--bg), #0b1220);
            color: var(--text);
          }
          a { color: var(--text); text-decoration: none }
          .nav {
            display: flex; align-items: center; justify-content: space-between;
            padding: 14px 20px; background: var(--panel); border-bottom: 1px solid #1f2937;
            position: sticky; top: 0; z-index: 10;
          }
          .brand { font-weight: 700; letter-spacing: .5px }
          .brand span { color: var(--brand) }
          .nav-links a { margin-left: 14px; padding: 6px 10px; border-radius: 6px }
          .nav-links a:hover { background: #1f2937 }
          .container { max-width: 880px; margin: 0 auto; padding: 20px }
          .card { background: var(--card); border: 1px solid #253043; border-radius: 12px; padding: 18px; box-shadow: 0 6px 24px rgba(0,0,0,.25) }
          .section { margin-top: 16px }
          .field { margin: 12px 0; display: grid; grid-template-columns: 140px 1fr; gap: 10px; align-items: center }
          .field label { color: var(--muted) }
          input, select {
            width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid #334155;
            background: #0b1220; color: var(--text);
          }
          input::placeholder { color: #6b7280 }
          button {
            padding: 10px 14px; border-radius: 8px; border: 1px solid #1e293b; cursor: pointer;
            background: #0b1220; color: var(--text);
          }
          .primary { background: var(--brand); border-color: var(--brand); color: #0b1220; font-weight: 600 }
          .primary:hover { filter: brightness(1.05) }
          .incomeBtn { background: var(--accent); border-color: var(--accent); color: #062016; font-weight: 600 }
          .incomeBtn:hover { filter: brightness(1.05) }
          .expenseBtn { background: #f87171; border-color: #f87171; color: #250808; font-weight: 600 }
          .expenseBtn:hover { filter: brightness(1.05) }
          .grid2 { display: grid; grid-template-columns: 1fr; gap: 16px }
          @media (min-width: 900px) { .grid2 { grid-template-columns: 1fr 1fr } }
          .cardIncome { border-color: #155e59 }
          .cardExpense { border-color: #5b1a1a }
          .hint { font-size: 12px; color: var(--muted); margin-top: 6px }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 8px 10px; border-bottom: 1px solid #263245 }
          th { color: var(--muted); font-weight: 500 }
        `}</style>
      </head>
      <body>
        <div className="nav">
          <div className="brand">J18 - <span>finance</span></div>
          <div className="nav-links">
            <a href="/">首頁</a>
            <a href="/dictionary">字典管理</a>
          </div>
        </div>
        {children}
      </body>
    </html>
  )
}
