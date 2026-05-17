
import axios from 'axios'
import { Chart, registerables } from 'chart.js'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import './DashboardPage.css'

Chart.register(...registerables)


type SensorLatest = {
  recorded_at: string
  air_temperature: number
  air_humidity: number
  soil_moisture: number
  light_level: number
}
type BadgeType = 'green' | 'amber'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api/v1'
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const TABS   = ['Today', '7 days', '30 days', '3 months']
const rnd = (base: number, v: number, n: number) =>
  Array.from({ length: n }, () => Math.round(base + (Math.random() - 0.5) * v * 2))


export default function DashboardPageV2() {
  const navigate = useNavigate()
  const [data, setData]               = useState<SensorLatest | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [error, setError]             = useState<string | null>(null)
  const [tab, setTab]                 = useState('Today')

  const donutRef  = useRef<HTMLCanvasElement>(null)
  const lineRef   = useRef<HTMLCanvasElement>(null)
  const donutInst = useRef<Chart | null>(null)
  const lineInst  = useRef<Chart | null>(null)


  useEffect(() => {
    let alive = true
    const fetchLatest = async () => {
      try {
        const res = await axios.get<SensorLatest>(`${API_BASE_URL}/sensors/latest`)
        if (!alive) return
        setData(res.data)
        setLastUpdated(new Date().toLocaleString())
        setError(null)
      } catch {
        if (!alive) return
        setError('Cannot fetch latest sensor data')
      }
    }
    void fetchLatest()
    const t = window.setInterval(() => void fetchLatest(), 5000)
    return () => { alive = false; window.clearInterval(t) }
  }, [])


  useEffect(() => {
    if (!donutRef.current || !lineRef.current) return
    donutInst.current = new Chart(donutRef.current, {
      type: 'doughnut',
      data: { datasets: [{ data: [80, 20], backgroundColor: ['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.15)'], borderWidth: 0 }] },
      options: { cutout: '78%', plugins: { legend: { display: false }, tooltip: { enabled: false } } },
    })
    lineInst.current = new Chart(lineRef.current, {
      type: 'line',
      data: {
        labels: MONTHS,
        datasets: [
          { label: 'Soil',    data: rnd(500,200,12), borderColor: '#86efac', backgroundColor: 'rgba(134,239,172,0.1)', borderWidth: 2, pointRadius: 0, tension: 0.4, fill: true },
          { label: 'Air',     data: rnd(300,150,12), borderColor: '#67e8f9', backgroundColor: 'transparent', borderWidth: 2, pointRadius: 0, tension: 0.4 },
          { label: 'Weather', data: rnd(200,120,12), borderColor: '#c4b5fd', backgroundColor: 'transparent', borderWidth: 2, pointRadius: 0, tension: 0.4 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(0,0,0,0.7)',
            titleColor: '#fff',
            bodyColor: 'rgba(255,255,255,0.8)',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            padding: 10,
            cornerRadius: 8,
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 }, color: 'rgba(255,255,255,0.6)' } },
          y: {
            min: 0, max: 1000,
            grid: { color: 'rgba(255,255,255,0.08)' },
            ticks: { stepSize: 200, font: { size: 11 }, color: 'rgba(255,255,255,0.6)' },
            border: { display: false },
          },
        },
      },
    })
    return () => { donutInst.current?.destroy(); lineInst.current?.destroy() }
  }, [])


  const temp     = data ? `${data.air_temperature.toFixed(1)}°C` : '--'
  const humidity = data ? `${data.air_humidity.toFixed(0)}%`     : '--'
  const moisture = data ? `${data.soil_moisture.toFixed(0)}%`    : '--'
  const light    = data ? `${data.light_level}`                  : '--'

  const moistureBadge: { text: string; type: BadgeType } =
    data && data.soil_moisture < 40 ? { text: 'Slightly dry', type: 'amber' } : { text: 'Optimal', type: 'green' }
  const aqiBadge: { text: string; type: BadgeType } =
    data && data.air_humidity > 80  ? { text: 'High', type: 'amber' } : { text: 'Clean', type: 'green' }


  return (
    <div style={s.page}>

      <div style={s.videoBg}>
        <div style={s.videoFallback} />
        <video
          autoPlay
          loop
          muted
          playsInline
          style={s.videoEl}
          onLoadedData={(e) => {
            const fallback = (e.currentTarget as HTMLVideoElement)
              .parentElement?.querySelector('.video-fallback') as HTMLElement | null
            if (fallback) fallback.style.opacity = '0'
          }}
        >
          <source src="/garden.mp4" type="video/mp4" />
        </video>
        <div style={s.videoOverlay} />
      </div>

      <div style={s.scrollContent}>

        <div style={s.header}>
          <div>
            <div style={s.headerTitle}>
              Morning, Everybody! 🌱
              <span style={{ fontSize: 13, background: 'rgba(255,255,255,0.15)', padding: '4px 10px', borderRadius: 12, marginLeft: 12, verticalAlign: 'middle', border: '1px solid rgba(255,255,255,0.2)' }}>TO103</span>
            </div>
            <div style={s.headerSub}>
              {error
                ? <span style={{ color: '#fca5a5' }}>{error}</span>
                : `Here's today's update from your smart garden${lastUpdated ? ` · ${lastUpdated}` : ''}`}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={s.btn}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              Contact support
            </button>
            <button style={{ ...s.btn, ...s.btnPrimary }} onClick={() => window.location.reload()}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10"/>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
              Sync latest data
            </button>
          </div>
        </div>

        <div style={s.statRow}>
          <div style={s.glassCard}>
            <div style={{ ...s.statIcon, background: 'rgba(134,239,172,0.2)' }}>🌡️</div>
            <div style={s.statLabel}>Field temperature</div>
            <div style={s.statValue}>{temp}</div>
            <div style={s.statSub}>Perfect for tomatoes and leafy greens.</div>
          </div>

          <div style={s.glassCard}>
            <div style={{ ...s.statIcon, background: 'rgba(196,181,253,0.2)' }}>💧</div>
            <div style={s.statLabel}>Air humidity</div>
            <div style={s.statValue}>{humidity}</div>
            <div style={s.statSub}>Within optimal range</div>
          </div>

          <div style={s.glassCard}>
            <div style={{ ...s.statIcon, background: 'rgba(253,224,71,0.2)' }}>🌱</div>
            <div style={s.statLabel}>Soil moisture</div>
            <div style={s.statValue}>{moisture}</div>
            <Badge text={moistureBadge.text} type={moistureBadge.type} />
          </div>

          <div style={s.glassCard}>
            <div style={{ ...s.statIcon, background: 'rgba(103,232,249,0.2)' }}>💨</div>
            <div style={s.statLabel}>Air quality index</div>
            <div style={s.statValue}>{light}</div>
            <Badge text={aqiBadge.text} type={aqiBadge.type} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 4 }}>
          <ResCard icon="💧" label="Water used"   val="72% limit" pct={72} color="#67e8f9" />
          <ResCard icon="☀️" label="Solar energy" val="65 kWh"              pct={65} color="#fde047" />
          <ResCard icon="🪣" label="Fertilizer stock" val="120kg avail" pct={60} color="#f9a8d4" />
          <ResCard icon="💰" label="Remaining budget" val="$200 avail"  pct={40} color="#fb923c" />
        </div>

        <div style={s.filterBar}>
          <div style={s.filterTabs}>
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{ ...s.filterTab, ...(tab === t ? s.filterTabActive : {}) }}>
                {t}
              </button>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <button style={s.filterBtn}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            Select dates
          </button>
          <button style={s.filterBtn}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/>
              <line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/>
              <line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/>
              <line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/>
              <line x1="17" y1="16" x2="23" y2="16"/>
            </svg>
            Adjust thresholds
          </button>
        </div>

        <div style={s.bottomRow}>
          <div style={{ ...s.glassCardWide, flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={s.cardTitle}>Sensor data trends</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ display: 'flex', gap: 12 }}>
                  {([['#86efac','Soil sensors'],['#67e8f9','Air quality'],['#c4b5fd','Weather']] as [string,string][]).map(([c,l])=>(
                    <div key={l} style={{ display:'flex',alignItems:'center',gap:4,fontSize:11,color:'rgba(255,255,255,0.6)' }}>
                      <div style={{ width:7,height:7,borderRadius:'50%',background:c }} />{l}
                    </div>
                  ))}
                </div>
                <span
                  onClick={() => navigate('/analytics')}
                  style={{ fontSize:11, color:'#86efac', fontWeight:500, cursor:'pointer', textDecoration:'underline', textUnderlineOffset: 2 }}
                >
                  Open detailed analytics →
                </span>
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 220, position: 'relative', marginTop: 16 }}>
              <canvas ref={lineRef} />
            </div>
          </div>

          <div style={{ ...s.glassCardWide, width: 280 }}>
            <div style={s.cardTitle}>Active devices</div>
            <div style={s.cardSub}>You're using 80% of your tracking capacity</div>
            <div style={s.donutWrap}>
              <canvas ref={donutRef} width={150} height={150} />
              <div style={s.donutCenter}>
                <div style={{ fontSize: 32, fontWeight: 700, color: '#fff' }}>320</div>
                <div style={{ fontSize: 12, color: '#86efac', fontWeight: 500 }}>↑ 10%</div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

function Badge({ text, type }: { text: string; type: BadgeType }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 500, marginTop: 4,
      ...(type === 'green'
        ? { background: 'rgba(134,239,172,0.2)', color: '#86efac' }
        : { background: 'rgba(253,224,71,0.2)',  color: '#fde047' })
    }}>
      <span style={{ width:5,height:5,borderRadius:'50%',background:'currentColor',display:'inline-block' }} />
      {text}
    </span>
  )
}

function ResCard({ icon, label, val, pct, color }: {
  icon: string; label: string; val: string; pct: number; color: string
}) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.08)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 14, padding: '10px 14px',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, fontWeight:500, color:'rgba(255,255,255,0.85)' }}>
          <span style={{ fontSize: 14 }}>{icon}</span>
          {label}
        </div>
        <div style={{ fontSize:12, fontWeight:600, color:'#fff' }}>{val}</div>
      </div>
      <div style={{ height:3, borderRadius:2, background:'rgba(255,255,255,0.12)', overflow:'hidden', marginTop:2 }}>
        <div style={{ height:'100%', borderRadius:2, width:`${pct}%`, background:color, transition:'width 1s ease' }} />
      </div>
    </div>
  )
}

const s: Record<string, CSSProperties> = {
  page: {
    position: 'relative',
    minHeight: '100vh',
    fontFamily: "'DM Sans', sans-serif",
    color: '#fff',
    overflowY: 'auto',
  },

  videoBg: {
    position: 'fixed',
    inset: 0,
    zIndex: 0,
    overflow: 'hidden',
  },
  videoFallback: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(135deg, #0a2e0a 0%, #1a4a1a 40%, #0d3b1f 70%, #0a2e0a 100%)',
    transition: 'opacity 0.8s ease',
    zIndex: 1,
  },
  videoEl: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    zIndex: 2,
  },
  videoOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0.5) 100%)',
    zIndex: 3,
  },

  scrollContent: {
    position: 'relative',
    zIndex: 10,
    padding: '24px 24px 32px',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    minHeight: '100vh',
  },

  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: 700,
    lineHeight: 1.2,
    textShadow: '0 2px 8px rgba(0,0,0,0.4)',
  },
  headerSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 4,
  },
  btn: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '7px 14px', borderRadius: 20,
    fontFamily: 'inherit', fontSize: 13, fontWeight: 500, cursor: 'pointer',
    border: '1px solid rgba(255,255,255,0.25)',
    background: 'rgba(255,255,255,0.12)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    color: '#fff',
  },
  btnPrimary: {
    background: 'rgba(46,139,46,0.75)',
    borderColor: 'rgba(46,139,46,0.6)',
  },

  sensorBadgeRow: {
    display: 'flex',
  },
  sensorBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 10,
    background: 'rgba(255,255,255,0.1)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.18)',
    borderRadius: 30,
    padding: '8px 16px',
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  sep: {
    color: 'rgba(255,255,255,0.3)',
  },
  badgeItem: {
    color: 'rgba(255,255,255,0.75)',
  },

  filterBar: {
    display: 'flex', alignItems: 'center', gap: 8,
  },
  filterTabs: {
    display: 'flex', gap: 2,
    borderRadius: 20, padding: 3,
    background: 'rgba(255,255,255,0.1)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    border: '1px solid rgba(255,255,255,0.15)',
  },
  filterTab: {
    padding: '5px 14px', borderRadius: 16,
    fontSize: 12, fontWeight: 500, cursor: 'pointer',
    border: 'none', background: 'transparent',
    color: 'rgba(255,255,255,0.6)', fontFamily: 'inherit',
  },
  filterTabActive: {
    background: 'rgba(255,255,255,0.18)',
    color: '#fff',
    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
  },
  filterBtn: {
    display: 'flex', alignItems: 'center', gap: 5,
    padding: '6px 12px', borderRadius: 16,
    fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
    border: '1px solid rgba(255,255,255,0.2)',
    background: 'rgba(255,255,255,0.1)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    color: 'rgba(255,255,255,0.8)',
  },

  statRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 12,
  },

  glassCard: {
    background: 'rgba(255,255,255,0.08)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.14)',
    borderRadius: 18,
    padding: '16px 18px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  glassCardWide: {
    background: 'rgba(255,255,255,0.08)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.14)',
    borderRadius: 18,
    padding: 18,
    boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },

  statIcon: {
    width: 36, height: 36, borderRadius: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: 10, fontSize: 16,
  },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.55)', marginBottom: 4 },
  statValue: { fontSize: 22, fontWeight: 700, lineHeight: 1.1 },
  statSub:   { fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 4 },

  bottomRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 280px',
    gap: 12,
    marginTop: 8,
  },
  donutWrap:   { display:'flex', alignItems:'center', justifyContent:'center', flex:1, position:'relative', height:130 },
  donutCenter: { position:'absolute', textAlign:'center' },
  cardTitle:   { fontSize: 14, fontWeight: 600, color: '#fff' },
  cardSub:     { fontSize: 11, color: 'rgba(255,255,255,0.5)' },
}