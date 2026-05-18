import axios from 'axios'
import { Chart, registerables } from 'chart.js'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'

Chart.register(...registerables)

type SensorRow = {
    recorded_at: string
    air_temperature: number
    air_humidity: number
    soil_moisture: number
    light_level: number
}

type SensorLatest = {
    recorded_at: string
    air_temperature: number
    air_humidity: number
    soil_moisture: number
    light_level: number
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api/v1'
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const rnd = (base: number, v: number, n: number) =>
    Array.from({ length: n }, () => +((base + (Math.random() - 0.5) * v * 2).toFixed(1)))

const TABS = ['24h', '7 days', '30 days', '3 months', '1 year']

export default function AnalyticsPage() {
    const navigate = useNavigate()
    const [latest, setLatest] = useState<SensorLatest | null>(null)
    const [history, setHistory] = useState<SensorRow[]>([])
    const [activeTab, setActiveTab] = useState('7 days')
    const [error, setError] = useState<string | null>(null)

    const tempRef = useRef<HTMLCanvasElement>(null)
    const humRef = useRef<HTMLCanvasElement>(null)
    const soilRef = useRef<HTMLCanvasElement>(null)
    const lightRef = useRef<HTMLCanvasElement>(null)
    const overviewRef = useRef<HTMLCanvasElement>(null)

    const tempInst = useRef<Chart | null>(null)
    const humInst = useRef<Chart | null>(null)
    const soilInst = useRef<Chart | null>(null)
    const lightInst = useRef<Chart | null>(null)
    const overviewInst = useRef<Chart | null>(null)

    useEffect(() => {
        let alive = true
        const load = async () => {
            try {
                const [latestRes, histRes] = await Promise.all([
                    axios.get<SensorLatest>(`${API_BASE_URL}/sensors/latest`),
                    axios.get<SensorRow[]>(`${API_BASE_URL}/sensors/history?limit=50`),
                ])
                if (!alive) return
                setLatest(latestRes.data)
                setHistory(histRes.data)
                setError(null)
            } catch {
                if (!alive) return
                setError('Cannot fetch sensor data — showing demo data')
            }
        }
        void load()
        const t = window.setInterval(() => void load(), 10000)
        return () => { alive = false; window.clearInterval(t) }
    }, [])

    useEffect(() => {
        const labels = MONTHS
        const mkLine = (
            ref: React.RefObject<HTMLCanvasElement | null>,
            inst: React.MutableRefObject<Chart | null>,
            label: string,
            data: number[],
            color: string,
            fillColor: string,
        ) => {
            if (!ref.current) return
            inst.current?.destroy()
            inst.current = new Chart(ref.current, {
                type: 'line',
                data: {
                    labels,
                    datasets: [{
                        label,
                        data,
                        borderColor: color,
                        backgroundColor: fillColor,
                        borderWidth: 2,
                        pointRadius: 3,
                        pointBackgroundColor: color,
                        pointBorderColor: 'transparent',
                        tension: 0.4,
                        fill: true,
                    }],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: 'rgba(0,0,0,0.75)',
                            titleColor: '#fff',
                            bodyColor: 'rgba(255,255,255,0.75)',
                            borderColor: 'rgba(255,255,255,0.1)',
                            borderWidth: 1,
                            padding: 10,
                            cornerRadius: 8,
                        },
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: { color: 'rgba(255,255,255,0.5)', font: { size: 11 } },
                        },
                        y: {
                            grid: { color: 'rgba(255,255,255,0.07)' },
                            ticks: { color: 'rgba(255,255,255,0.5)', font: { size: 11 } },
                            border: { display: false },
                        },
                    },
                },
            })
        }

        mkLine(tempRef, tempInst, 'Temperature (°C)', rnd(28, 6, 12), '#fb923c', 'rgba(251,146,60,0.12)')
        mkLine(humRef, humInst, 'Air Humidity (%)', rnd(62, 15, 12), '#67e8f9', 'rgba(103,232,249,0.12)')
        mkLine(soilRef, soilInst, 'Soil Moisture (%)', rnd(48, 18, 12), '#86efac', 'rgba(134,239,172,0.12)')
        mkLine(lightRef, lightInst, 'Light Level (lux)', rnd(520, 200, 12), '#fde047', 'rgba(253,224,71,0.12)')

        if (overviewRef.current) {
            overviewInst.current?.destroy()
            overviewInst.current = new Chart(overviewRef.current, {
                type: 'line',
                data: {
                    labels,
                    datasets: [
                        { label: 'Temperature', data: rnd(28, 6, 12), borderColor: '#fb923c', backgroundColor: 'transparent', borderWidth: 2, pointRadius: 0, tension: 0.4 },
                        { label: 'Humidity', data: rnd(62, 15, 12), borderColor: '#67e8f9', backgroundColor: 'transparent', borderWidth: 2, pointRadius: 0, tension: 0.4 },
                        { label: 'Soil', data: rnd(48, 18, 12), borderColor: '#86efac', backgroundColor: 'rgba(134,239,172,0.1)', borderWidth: 2, pointRadius: 0, tension: 0.4, fill: true },
                        { label: 'Light/10', data: rnd(52, 20, 12), borderColor: '#fde047', backgroundColor: 'transparent', borderWidth: 2, pointRadius: 0, tension: 0.4 },
                    ],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        legend: {
                            display: true,
                            labels: { color: 'rgba(255,255,255,0.65)', font: { size: 11 }, boxWidth: 10, padding: 16 },
                        },
                        tooltip: {
                            backgroundColor: 'rgba(0,0,0,0.75)',
                            titleColor: '#fff',
                            bodyColor: 'rgba(255,255,255,0.75)',
                            borderColor: 'rgba(255,255,255,0.1)',
                            borderWidth: 1,
                            padding: 10,
                            cornerRadius: 8,
                        },
                    },
                    scales: {
                        x: { grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.5)', font: { size: 11 } } },
                        y: { grid: { color: 'rgba(255,255,255,0.07)' }, ticks: { color: 'rgba(255,255,255,0.5)', font: { size: 11 } }, border: { display: false } },
                    },
                },
            })
        }

        return () => {
            tempInst.current?.destroy()
            humInst.current?.destroy()
            soilInst.current?.destroy()
            lightInst.current?.destroy()
            overviewInst.current?.destroy()
        }
    }, [activeTab])

    const v = (n: number | undefined, unit = '') => n != null ? `${n.toFixed(1)}${unit}` : '--'

    const statCards = [
        { icon: '🌡️', label: 'Temperature', value: v(latest?.air_temperature, '°C'), sub: 'Air sensor avg', color: '#fb923c', bg: 'rgba(251,146,60,0.15)' },
        { icon: '💧', label: 'Air Humidity', value: v(latest?.air_humidity, '%'), sub: 'Relative humidity', color: '#67e8f9', bg: 'rgba(103,232,249,0.15)' },
        { icon: '🌱', label: 'Soil Moisture', value: v(latest?.soil_moisture, '%'), sub: 'Topsoil layer', color: '#86efac', bg: 'rgba(134,239,172,0.15)' },
        { icon: '☀️', label: 'Light Level', value: latest?.light_level != null ? `${latest.light_level} lux` : '--', sub: 'PAR sensor', color: '#fde047', bg: 'rgba(253,224,71,0.15)' },
    ]

    const miniCharts = [
        { ref: tempRef, label: 'Temperature (°C)', color: '#fb923c' },
        { ref: humRef, label: 'Air Humidity (%)', color: '#67e8f9' },
        { ref: soilRef, label: 'Soil Moisture (%)', color: '#86efac' },
        { ref: lightRef, label: 'Light Level (lux)', color: '#fde047' },
    ]

    return (
        <div style={s.page}>
            <div style={s.videoBg}>
                <div style={s.videoFallback} />
                <video autoPlay loop muted playsInline style={s.videoEl}>
                    <source src="/garden.mp4" type="video/mp4" />
                </video>
                <div style={s.videoOverlay} />
            </div>

            <div style={s.content}>

                <div style={s.topBar}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <button style={s.backBtn} onClick={() => navigate(-1)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polyline points="15 18 9 12 15 6" />
                            </svg>
                            Back
                        </button>
                        <div>
                            <div style={s.pageTitle}>Detailed Analytics</div>
                            <div style={s.pageSub}>
                                {error
                                    ? <span style={{ color: '#fca5a5' }}>{error}</span>
                                    : 'Real-time sensor trends from your smart garden'}
                            </div>
                        </div>
                    </div>

                    <div style={s.tabGroup}>
                        {TABS.map(t => (
                            <button
                                key={t}
                                style={{ ...s.tab, ...(activeTab === t ? s.tabActive : {}) }}
                                onClick={() => setActiveTab(t)}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                </div>

                <div style={s.statRow}>
                    {statCards.map(c => (
                        <div key={c.label} style={s.statCard}>
                            <div style={{ ...s.statIconWrap, background: c.bg }}>
                                <span style={{ fontSize: 18 }}>{c.icon}</span>
                            </div>
                            <div style={s.statLabel}>{c.label}</div>
                            <div style={{ ...s.statValue, color: c.color }}>{c.value}</div>
                            <div style={s.statSub}>{c.sub}</div>
                            <div style={{ ...s.statBar, background: 'rgba(255,255,255,0.1)' }}>
                                <div style={{ ...s.statBarFill, background: c.color, width: '60%' }} />
                            </div>
                        </div>
                    ))}
                </div>

                <div style={s.overviewCard}>
                    <div style={s.cardHeader}>
                        <div>
                            <div style={s.cardTitle}>All sensors overview</div>
                            <div style={s.cardSub}>Combined trend for {activeTab}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <div style={{ ...s.liveChip, background: 'rgba(134,239,172,0.2)', color: '#86efac' }}>
                                <span style={s.liveDot} />
                                Live
                            </div>
                        </div>
                    </div>
                    <div style={{ height: 220, position: 'relative' }}>
                        <canvas ref={overviewRef} />
                    </div>
                </div>

                <div style={s.gridCharts}>
                    {miniCharts.map(ch => (
                        <div key={ch.label} style={s.miniCard}>
                            <div style={s.cardHeader}>
                                <div style={s.cardTitle}>{ch.label}</div>
                                <div style={{ ...s.colorDot, background: ch.color }} />
                            </div>
                            <div style={{ height: 130, position: 'relative' }}>
                                <canvas ref={ch.ref} />
                            </div>
                        </div>
                    ))}
                </div>

                {history.length > 0 && (
                    <div style={s.tableCard}>
                        <div style={s.cardHeader}>
                            <div>
                                <div style={s.cardTitle}>Raw sensor log</div>
                                <div style={s.cardSub}>Last {history.length} records from API</div>
                            </div>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={s.table}>
                                <thead>
                                    <tr>
                                        {['Time', 'Temp (°C)', 'Humidity (%)', 'Soil (%)', 'Light (lux)'].map(h => (
                                            <th key={h} style={s.th}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.slice(0, 20).map((r, i) => (
                                        <tr key={i} style={i % 2 === 0 ? s.trEven : {}}>
                                            <td style={s.td}>{new Date(r.recorded_at).toLocaleString()}</td>
                                            <td style={{ ...s.td, color: '#fb923c' }}>{r.air_temperature.toFixed(1)}</td>
                                            <td style={{ ...s.td, color: '#67e8f9' }}>{r.air_humidity.toFixed(0)}</td>
                                            <td style={{ ...s.td, color: '#86efac' }}>{r.soil_moisture.toFixed(0)}</td>
                                            <td style={{ ...s.td, color: '#fde047' }}>{r.light_level}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

            </div>
        </div>
    )
}

const glass: CSSProperties = {
    background: 'rgba(255,255,255,0.07)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 18,
    boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
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
        background: 'linear-gradient(135deg, #071a07 0%, #0f2d0f 40%, #071a12 100%)',
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
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.35) 50%, rgba(0,0,0,0.6) 100%)',
        zIndex: 3,
    },
    content: {
        position: 'relative',
        zIndex: 10,
        padding: '24px 24px 40px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        minHeight: '100vh',
    },
    topBar: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
    },
    backBtn: {
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '7px 14px', borderRadius: 20,
        fontFamily: 'inherit', fontSize: 13, fontWeight: 500, cursor: 'pointer',
        border: '1px solid rgba(255,255,255,0.2)',
        background: 'rgba(255,255,255,0.1)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        color: '#fff',
    },
    pageTitle: { fontSize: 22, fontWeight: 700, textShadow: '0 2px 8px rgba(0,0,0,0.4)' },
    pageSub: { fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
    tabGroup: {
        display: 'flex', gap: 2,
        background: 'rgba(255,255,255,0.08)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 22, padding: 3,
    },
    tab: {
        padding: '5px 14px', borderRadius: 18,
        fontSize: 12, fontWeight: 500, cursor: 'pointer',
        border: 'none', background: 'transparent',
        color: 'rgba(255,255,255,0.55)', fontFamily: 'inherit',
        transition: 'all 0.15s',
    },
    tabActive: {
        background: 'rgba(255,255,255,0.18)',
        color: '#fff',
        boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
    },
    statRow: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 12,
    },
    statCard: {
        ...glass,
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
    },
    statIconWrap: {
        width: 40, height: 40, borderRadius: 12,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 8,
    },
    statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.5)' },
    statValue: { fontSize: 26, fontWeight: 700, lineHeight: 1.1 },
    statSub: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 8 },
    statBar: { height: 3, borderRadius: 2, overflow: 'hidden' },
    statBarFill: { height: '100%', borderRadius: 2, transition: 'width 1s ease' },
    overviewCard: {
        ...glass,
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
    },
    gridCharts: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 12,
    },
    miniCard: {
        ...glass,
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
    },
    cardHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    cardTitle: { fontSize: 14, fontWeight: 600, color: '#fff' },
    cardSub: { fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
    colorDot: {
        width: 8, height: 8, borderRadius: '50%',
    },
    liveChip: {
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 10px', borderRadius: 20,
        fontSize: 11, fontWeight: 500,
    },
    liveDot: {
        width: 6, height: 6, borderRadius: '50%',
        background: '#86efac',
        boxShadow: '0 0 6px #86efac',
        display: 'inline-block',
        animation: 'pulse 2s infinite',
    },
    tableCard: {
        ...glass,
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: 12,
    },
    th: {
        textAlign: 'left',
        padding: '8px 12px',
        color: 'rgba(255,255,255,0.45)',
        fontWeight: 500,
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        whiteSpace: 'nowrap',
    },
    td: {
        padding: '8px 12px',
        color: 'rgba(255,255,255,0.8)',
        whiteSpace: 'nowrap',
    },
    trEven: {
        background: 'rgba(255,255,255,0.03)',
    },
}
