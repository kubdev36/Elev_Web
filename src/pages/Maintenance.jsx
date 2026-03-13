import React, { useState, useEffect, useRef } from 'react';
import useElevatorStatus from '../hooks/useElevatorStatus';
import useClock from '../hooks/useClock';
import { useToast } from '../components/Toast';
import './Maintenance.css';

/* ── fake hourly people-density data (demo) ── */
const HOURLY_DATA = [
    { h: '06', v: 3 }, { h: '07', v: 12 }, { h: '08', v: 38 },
    { h: '09', v: 45 }, { h: '10', v: 22 }, { h: '11', v: 18 },
    { h: '12', v: 30 }, { h: '13', v: 28 }, { h: '14', v: 15 },
    { h: '15', v: 20 }, { h: '16', v: 25 }, { h: '17', v: 42 },
    { h: '18', v: 48 }, { h: '19', v: 30 }, { h: '20', v: 14 },
    { h: '21', v: 6 }, { h: '22', v: 2 },
];
const maxVal = Math.max(...HOURLY_DATA.map(d => d.v));

/* ── timeline demo events ── */
const EVENTS = [
    { time: '08:14', event: 'Phát hiện người lạ', conf: 0.86, loc: '#A / Tầng 6', type: 'warn' },
    { time: '09:02', event: 'Quá tải', conf: 0.92, loc: '#A / Tầng 1', type: 'error' },
    { time: '10:20', event: 'Cửa kẹt', conf: 0.78, loc: '#A / Tầng 3', type: 'error' },
    { time: '11:45', event: 'Bảo trì định kỳ hoàn tất', conf: 1.0, loc: '#A / Hệ thống', type: 'info' },
    { time: '14:30', event: 'Cảm biến tải lỗi nhẹ', conf: 0.65, loc: '#A / Tầng 1', type: 'warn' },
    { time: '16:10', event: 'Mất kết nối camera 2s', conf: 0.88, loc: '#A / Tầng 8', type: 'error' },
];

/* ── employee lookup demo ── */
const EMPLOYEES = [
    { id: 'NV001', name: 'Nguyễn Văn A', dept: 'Kỹ thuật', lastAccess: '08:12' },
    { id: 'NV002', name: 'Trần Thị B', dept: 'Quản lý', lastAccess: '09:30' },
    { id: 'NV003', name: 'Lê Minh C', dept: 'Bảo vệ', lastAccess: '07:55' },
    { id: 'NV004', name: 'Phạm Hoàng D', dept: 'Kỹ thuật', lastAccess: '10:15' },
];

/* ── user chatbot questions demo ── */
const USER_QUESTIONS = [
    { time: '08:20', question: 'Thang máy có quá tải không?', answer: 'Hiện tại thang máy không quá tải.' },
    { time: '09:15', question: 'Gọi tôi lên tầng 7', answer: 'Đã gửi lệnh gọi tầng 7.' },
    { time: '10:00', question: 'Tốc độ thang máy là bao nhiêu?', answer: 'Tốc độ hiện tại: 1.5 m/s.' },
    { time: '11:30', question: 'Cửa đang mở hay đóng?', answer: 'Cửa thang máy đang đóng.' },
];

/* ── all 15 floors for lock management ── */
const ALL_FLOORS = Array.from({ length: 15 }, (_, i) => i + 1);

export default function Maintenance() {
    const showToast = useToast();
    const status = useElevatorStatus();
    const clock = useClock();

    const [authed, setAuthed] = useState(() => localStorage.getItem('maint_authed') === '1');
    const [empCode, setEmpCode] = useState('');
    const [mssv, setMssv] = useState('');
    const [sqlQuery, setSqlQuery] = useState('SELECT * FROM maintenance_logs LIMIT 10;');
    const [sqlResult, setSqlResult] = useState(null);
    const [llmInput, setLlmInput] = useState('');
    const [llmOutput, setLlmOutput] = useState('Kết quả sẽ hiển thị ở đây.');
    const [lookupTab, setLookupTab] = useState('employees');
    const [cameraOn, setCameraOn] = useState(false);
    const [cameraError, setCameraError] = useState('');
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const [lockedFloors, setLockedFloors] = useState(() => {
        const saved = localStorage.getItem('locked_floors');
        return saved ? JSON.parse(saved) : [6, 9, 13];
    });
    const [floorPins, setFloorPins] = useState(() => {
        try { return JSON.parse(localStorage.getItem('floor_pins') || '{}'); } catch { return {}; }
    });
    const [floorAuthConfig, setFloorAuthConfig] = useState(() => {
        try { return JSON.parse(localStorage.getItem('floor_auth_config') || '{}'); } catch { return {}; }
    });
    const [editingPin, setEditingPin] = useState(null);
    const [pinInput, setPinInput] = useState('');

    /* ── Real webcam ── */
    const startCamera = async () => {
        try {
            setCameraError('');
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 360, facingMode: 'environment' },
                audio: false,
            });
            streamRef.current = stream;
            setCameraOn(true);  // render <video> first
        } catch (err) {
            setCameraError('Không thể truy cập camera: ' + (err.message || err));
            setCameraOn(false);
        }
    };

    // Attach stream to <video> AFTER it renders
    useEffect(() => {
        if (cameraOn && videoRef.current && streamRef.current) {
            videoRef.current.srcObject = streamRef.current;
        }
    }, [cameraOn]);

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        if (videoRef.current) videoRef.current.srcObject = null;
        setCameraOn(false);
    };

    useEffect(() => {
        return () => {
            // cleanup camera on unmount
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
            }
        };
    }, []);

    const handleLogin = () => {
        if (!empCode.trim() || !mssv.trim()) {
            showToast('Vui lòng nhập mã NV và MSSV');
            return;
        }
        localStorage.setItem('maint_authed', '1');
        setAuthed(true);
    };

    const handleLogout = () => {
        localStorage.removeItem('maint_authed');
        setAuthed(false);
    };

    const fillDemo = () => {
        setEmpCode('NV001');
        setMssv('22110000');
    };

    const runLLMQuery = () => {
        if (!llmInput.trim()) { setLlmOutput('Nhập câu hỏi để truy vấn.'); return; }
        setLlmOutput('Đang truy vấn...');
        setTimeout(() => {
            setLlmOutput('Kết quả mẫu: Lỗi cửa kẹt xuất hiện nhiều nhất lúc 08:00-09:00. Nguyên nhân phổ biến: vật cản cửa hoặc cảm biến hư.');
        }, 700);
    };

    const runSqlQuery = () => {
        setSqlResult('Đang thực thi...');
        setTimeout(() => {
            setSqlResult('Query OK. 10 rows returned (0.04 sec). [Mô phỏng dữ liệu]');
        }, 600);
    };

    const toggleFloorLock = (floor) => {
        setLockedFloors(prev => {
            const next = prev.includes(floor) ? prev.filter(f => f !== floor) : [...prev, floor];
            localStorage.setItem('locked_floors', JSON.stringify(next));
            showToast(next.includes(floor) ? `Đã khóa tầng ${floor}` : `Đã mở khóa tầng ${floor}`);
            return next;
        });
    };

    const savePin = (floor) => {
        if (pinInput.length !== 4 || !/^\d{4}$/.test(pinInput)) {
            showToast('PIN phải đủ 4 chữ số');
            return;
        }
        const next = { ...floorPins, [floor]: pinInput };
        setFloorPins(next);
        localStorage.setItem('floor_pins', JSON.stringify(next));
        showToast(`Đã đặt PIN cho tầng ${floor}`);
        setEditingPin(null);
        setPinInput('');
    };

    const removePin = (floor) => {
        const next = { ...floorPins };
        delete next[floor];
        setFloorPins(next);
        localStorage.setItem('floor_pins', JSON.stringify(next));
        showToast(`Đã xóa PIN tầng ${floor}`);
    };

    const toggleAuthType = (floor, type) => {
        setFloorAuthConfig(prev => {
            const floorCfg = prev[floor] || { pin: true, face: false };
            const newFloorCfg = { ...floorCfg, [type]: !floorCfg[type] };
            // Ensure at least one is selected if locked
            if (!newFloorCfg.pin && !newFloorCfg.face) return prev;
            const next = { ...prev, [floor]: newFloorCfg };
            localStorage.setItem('floor_auth_config', JSON.stringify(next));
            return next;
        });
    };

    const dir = status.direction || '--';

    /* ── LOGIN SCREEN ── */
    if (!authed) {
        return (
            <div>
                <div className="page-title">
                    <h1>Trung tâm bảo trì</h1>
                    <div className="meta">Chỉ dành cho kỹ thuật</div>
                </div>
                <div className="login-box">
                    <h3 style={{ margin: '0 0 6px' }}>Đăng nhập bảo trì</h3>
                    <div className="muted">Nhập mã nhân viên và MSSV để truy cập dashboard.</div>
                    <input value={empCode} onChange={e => setEmpCode(e.target.value)} placeholder="Mã NV (VD: NV001)" />
                    <input value={mssv} onChange={e => setMssv(e.target.value)} type="password" placeholder="MSSV (VD: 22110000)" />
                    <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button className="btn btn-primary" onClick={handleLogin}>Đăng nhập</button>
                        <button className="btn btn-ghost" onClick={fillDemo}>Demo nhanh</button>
                    </div>
                </div>
            </div>
        );
    }

    /* ── DASHBOARD ── */
    return (
        <div>
            <div className="page-title">
                <h1>Trung tâm bảo trì</h1>
                <div className="meta">Xin chào, {empCode || 'Kỹ thuật viên'} · {clock}</div>
            </div>

            {/* Row 1: Status + Live Camera + Density Chart */}
            <div className="maint-grid">
                <div className="card">
                    <h3>Trạng thái thang</h3>
                    <div className="inline">
                        <span className="pill">Tầng: <b>{status.floor ?? '--'}</b></span>
                        <span className="pill">Hướng: <b>{dir}</b></span>
                        <span className="pill">Cửa: <b>{status.door ?? '--'}</b></span>
                        <span className="pill">Người: <b>{status.people_count ?? '--'}</b></span>
                    </div>
                    <div style={{ marginTop: 10 }} className="muted">Cập nhật lúc {clock}</div>
                </div>

                <div className="card">
                    <h3>Live Camera &amp; CV Events</h3>
                    <div className="camera-feed">
                        {cameraOn ? (
                            <video ref={videoRef} autoPlay playsInline muted className="camera-video" />
                        ) : (
                            <div className="camera-placeholder">
                                <div className="camera-icon">📹</div>
                                <span>Camera Elevator #A</span>
                                {cameraError && <span className="camera-err">{cameraError}</span>}
                            </div>
                        )}
                    </div>
                    <div className="inline" style={{ marginTop: 8 }}>
                        {!cameraOn ? (
                            <button className="btn btn-primary btn-sm" onClick={startCamera}>Bật Camera</button>
                        ) : (
                            <button className="btn btn-stop btn-sm" onClick={stopCamera}>Tắt Camera</button>
                        )}
                        {cameraOn && <span className="camera-live-dot">● LIVE</span>}
                        <span className="tag">Person tracking</span>
                        <span className="tag">Object detection</span>
                        <span className="tag">Face recognition</span>
                    </div>
                </div>

                <div className="card">
                    <h3>Mật độ người / ngày</h3>
                    <div className="density-chart">
                        {HOURLY_DATA.map(d => (
                            <div key={d.h} className="bar-col">
                                <div className="bar" style={{ height: `${(d.v / maxVal) * 100}%` }}>
                                    <span className="bar-val">{d.v}</span>
                                </div>
                                <span className="bar-label">{d.h}h</span>
                            </div>
                        ))}
                    </div>
                    <div className="inline" style={{ marginTop: 8 }}>
                        <span className="pill">Cao điểm: 08h, 17h-18h</span>
                        <span className="pill">Tổng: {HOURLY_DATA.reduce((s, d) => s + d.v, 0)} lượt</span>
                    </div>
                </div>
            </div>

            {/* Timeline */}
            <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="card">
                    <h3>Timeline sự kiện</h3>
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Giờ</th>
                                <th>Sự kiện</th>
                                <th>Mức độ</th>
                                <th>Vị trí</th>
                            </tr>
                        </thead>
                        <tbody>
                            {EVENTS.map((e, i) => (
                                <tr key={i}>
                                    <td>{e.time}</td>
                                    <td>{e.event}</td>
                                    <td><span className={`event-badge ${e.type}`}>{e.type === 'error' ? 'LỖI' : e.type === 'warn' ? 'WARN' : 'INFO'}</span></td>
                                    <td>{e.loc.split('/')[1]}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* LLM Console moved here */}
                <div className="card">
                    <h3>Trợ lý bảo trì (LLM)</h3>
                    <div className="muted" style={{ marginBottom: 8 }}>Hỏi hệ thống AI về dữ liệu bảo trì và phân tích.</div>
                    <div style={{ background: '#f5f5f5', padding: 10, borderRadius: 4, minHeight: 120, marginBottom: 10, fontSize: 13, whiteSpace: 'pre-wrap' }}>
                        {llmOutput}
                    </div>
                    <div className="inline">
                        <input style={{ flex: 1 }} value={llmInput} onChange={e => setLlmInput(e.target.value)} placeholder="VD: Lỗi nào nhiều nhất?" onKeyDown={e => e.key === 'Enter' && runLLMQuery()} />
                        <button className="btn btn-primary" onClick={runLLMQuery}>Gửi</button>
                    </div>
                </div>
            </div>

            {/* Row 2: Lookup + LLM + Lock */}
            <div className="maint-grid" style={{ marginTop: 14 }}>
                {/* Data Lookup */}
                <div className="card card-tall">
                    <h3>Tra cứu dữ liệu</h3>
                    <div className="lookup-tabs">
                        {[
                            { key: 'employees', label: 'Nhân viên' },
                            { key: 'faces', label: 'Khuôn mặt' },
                            { key: 'logs', label: 'Nhật ký ra/vào' },
                            { key: 'questions', label: 'Câu hỏi user' },
                        ].map(t => (
                            <button key={t.key} className={`lookup-tab ${lookupTab === t.key ? 'active' : ''}`} onClick={() => setLookupTab(t.key)}>
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {lookupTab === 'employees' && (
                        <table className="table table-sm">
                            <thead><tr><th>Mã NV</th><th>Họ tên</th><th>Phòng ban</th><th>Truy cập gần nhất</th></tr></thead>
                            <tbody>
                                {EMPLOYEES.map(e => (
                                    <tr key={e.id}><td>{e.id}</td><td>{e.name}</td><td>{e.dept}</td><td>{e.lastAccess}</td></tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    {lookupTab === 'faces' && (
                        <div className="face-grid">
                            {EMPLOYEES.map(e => (
                                <div key={e.id} className="face-item">
                                    <div className="face-avatar">{e.name[0]}</div>
                                    <div><b>{e.name}</b><br /><span className="muted">{e.id}</span></div>
                                </div>
                            ))}
                        </div>
                    )}

                    {lookupTab === 'logs' && (
                        <table className="table table-sm">
                            <thead><tr><th>Thời gian</th><th>Mã NV</th><th>Loại</th><th>Tầng</th></tr></thead>
                            <tbody>
                                <tr><td>07:55</td><td>NV003</td><td>Vào</td><td>1</td></tr>
                                <tr><td>08:12</td><td>NV001</td><td>Vào</td><td>1</td></tr>
                                <tr><td>09:30</td><td>NV002</td><td>Vào</td><td>3</td></tr>
                                <tr><td>12:00</td><td>NV001</td><td>Ra</td><td>1</td></tr>
                            </tbody>
                        </table>
                    )}

                    {lookupTab === 'questions' && (
                        <table className="table table-sm">
                            <thead><tr><th>Thời gian</th><th>Câu hỏi</th><th>Trả lời</th></tr></thead>
                            <tbody>
                                {USER_QUESTIONS.map((q, i) => (
                                    <tr key={i}><td>{q.time}</td><td>{q.question}</td><td className="muted">{q.answer}</td></tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    <div className="inline" style={{ marginTop: 10 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => showToast('Xuất CSV (demo)')}>📄 Xuất CSV</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => showToast('Xuất PDF (demo)')}>📑 Xuất PDF</button>
                    </div>
                </div>

                {/* MySQL Manager replacing old LLM Console */}
                <div className="card">
                    <h3>Quản lý Database (MySQL)</h3>
                    <div className="muted" style={{ marginBottom: 8 }}>Truy vấn trực tiếp CSDL hệ thống.</div>
                    <textarea 
                        style={{ width: '100%', height: 80, fontFamily: 'monospace', padding: 8, marginBottom: 8 }} 
                        value={sqlQuery} onChange={e => setSqlQuery(e.target.value)} 
                    />
                    <button className="btn btn-primary" style={{ width: '100%' }} onClick={runSqlQuery}>Execute SQL</button>
                    {sqlResult && <div className="llm-output" style={{ marginTop: 8, fontFamily: 'monospace' }}>{sqlResult}</div>}
                </div>

                {/* System Config */}
                <div className="card">
                    <h3>Cấu hình hệ thống</h3>
                    <div className="config-grid">
                        <div className="config-item"><span className="config-dot green"></span> Camera: ON</div>
                        <div className="config-item"><span className="config-dot green"></span> Database: OK</div>
                        <div className="config-item"><span className="config-dot green"></span> AI Model: OK</div>
                        <div className="config-item"><span className="config-dot yellow"></span> Storage: 72%</div>
                        <div className="config-item"><span className="config-dot green"></span> SIM Module: Active</div>
                        <div className="config-item"><span className="config-dot green"></span> Network: OK</div>
                    </div>
                    <div className="inline" style={{ marginTop: 10 }}>
                        <button className="btn btn-ghost btn-sm">Ngưỡng cảnh báo</button>
                        <button className="btn btn-ghost btn-sm">Đối tượng theo dõi</button>
                    </div>
                </div>
            </div>

            {/* Elevator Lock Management */}
            <div className="card" style={{ marginTop: 14 }}>
                <h3>Quản lý khóa tầng</h3>
                <div className="muted" style={{ marginBottom: 10 }}>Bấm để khóa/mở khóa. Cài đặt phương thức xác thực (PIN, FaceID).</div>
                <div className="lock-grid">
                    {ALL_FLOORS.map(f => (
                        <div key={f} className="lock-item">
                            <button
                                className={`lock-btn ${lockedFloors.includes(f) ? 'locked' : 'unlocked'}`}
                                onClick={() => toggleFloorLock(f)}
                            >
                                <span className="lock-floor">T{f}</span>
                                <span className="lock-icon">{lockedFloors.includes(f) ? '🔒' : '🔓'}</span>
                            </button>
                            {lockedFloors.includes(f) && (
                                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <div className="inline" style={{ fontSize: 11 }}>
                                        <label><input type="checkbox" checked={floorAuthConfig[f]?.pin ?? true} onChange={() => toggleAuthType(f, 'pin')} /> PIN</label>
                                        <label><input type="checkbox" checked={floorAuthConfig[f]?.face ?? false} onChange={() => toggleAuthType(f, 'face')} /> Face</label>
                                    </div>
                                    
                                    {(floorAuthConfig[f]?.pin ?? true) && (
                                    <div className="pin-set">
                                    {editingPin === f ? (
                                        <div className="pin-edit-row">
                                            <input
                                                className="pin-inp"
                                                value={pinInput}
                                                onChange={e => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                                placeholder="4 số"
                                                maxLength={4}
                                            />
                                            <button className="btn btn-primary btn-xs" onClick={() => savePin(f)}>✓</button>
                                            <button className="btn btn-ghost btn-xs" onClick={() => { setEditingPin(null); setPinInput(''); }}>✕</button>
                                        </div>
                                    ) : (
                                        <div className="pin-display">
                                            {floorPins[f] ? (
                                                <>
                                                    <span className="pin-val">PIN: ****</span>
                                                    <button className="btn btn-ghost btn-xs" onClick={() => { setEditingPin(f); setPinInput(floorPins[f]); }}>Sửa</button>
                                                    <button className="btn btn-ghost btn-xs" onClick={() => removePin(f)}>Xóa</button>
                                                </>
                                            ) : (
                                                <button className="btn btn-ghost btn-xs" onClick={() => { setEditingPin(f); setPinInput(''); }}>Đặt PIN</button>
                                            )}
                                        </div>
                                    )}
                                    </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button className="btn btn-ghost" onClick={handleLogout}>Đăng xuất</button>
            </div>
        </div>
    );
}
