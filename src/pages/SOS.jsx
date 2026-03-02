import React, { useState, useEffect, useRef, useCallback } from 'react';
import useElevatorStatus from '../hooks/useElevatorStatus';
import { useToast } from '../components/Toast';
import api from '../services/api';
import './SOS.css';

export default function SOS() {
    const showToast = useToast();
    const status = useElevatorStatus();
    const [sosTime, setSosTime] = useState('--:--');
    const [slideProgress, setSlideProgress] = useState(0);
    const [isCalling, setIsCalling] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState('');
    const [simInfo, setSimInfo] = useState({ signal: 4, carrier: 'Viettel', number: '0900-XXX-XXX' });
    const sliderRef = useRef(null);
    const isDragging = useRef(false);

    useEffect(() => {
        const tick = () => setSosTime(new Date().toLocaleTimeString('vi-VN'));
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, []);

    const handleSlideStart = (e) => {
        if (isCalling) return;
        isDragging.current = true;
        e.preventDefault();
    };

    const handleSlideMove = useCallback((e) => {
        if (!isDragging.current || !sliderRef.current) return;
        const rect = sliderRef.current.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const progress = Math.max(0, Math.min(1, (clientX - rect.left - 28) / (rect.width - 56)));
        setSlideProgress(progress);
    }, []);

    const handleSlideEnd = useCallback(async () => {
        if (!isDragging.current) return;
        isDragging.current = false;

        if (slideProgress > 0.85) {
            // Triggered!
            setSlideProgress(1);
            setIsCalling(true);
            setConnectionStatus('Đang kết nối với đội ngũ bảo trì...');

            try {
                await api.sos({
                    elevator: 'A',
                    time: new Date().toISOString(),
                    floor: status.floor ?? '--',
                    status: status.door ?? '--',
                });
            } catch { }

            // Simulate connection phases
            setTimeout(() => setConnectionStatus('Đang gọi điện qua SIM module...'), 1500);
            setTimeout(() => setConnectionStatus('Đã kết nối! Đội bảo trì đang trên đường đến.'), 3500);
        } else {
            setSlideProgress(0);
        }
    }, [slideProgress, status]);

    useEffect(() => {
        window.addEventListener('mousemove', handleSlideMove);
        window.addEventListener('mouseup', handleSlideEnd);
        window.addEventListener('touchmove', handleSlideMove);
        window.addEventListener('touchend', handleSlideEnd);
        return () => {
            window.removeEventListener('mousemove', handleSlideMove);
            window.removeEventListener('mouseup', handleSlideEnd);
            window.removeEventListener('touchmove', handleSlideMove);
            window.removeEventListener('touchend', handleSlideEnd);
        };
    }, [handleSlideMove, handleSlideEnd]);

    const resetSOS = () => {
        setIsCalling(false);
        setSlideProgress(0);
        setConnectionStatus('');
    };

    return (
        <div>
            <div className="page-title">
                <h1>SOS</h1>
                <div className="meta">Gửi tín hiệu khẩn cấp</div>
            </div>

            <div className="sos-wrap">
                <div className="panel">
                    {!isCalling ? (
                        <div className="slide-container">
                            <div className="slide-label">Trượt để gọi kỹ thuật →</div>
                            <div className="slide-track" ref={sliderRef}>
                                <div className="slide-fill" style={{ width: `${slideProgress * 100}%` }}></div>
                                <div
                                    className="slide-thumb"
                                    style={{ left: `calc(${slideProgress * 100}% - ${slideProgress * 56}px)` }}
                                    onMouseDown={handleSlideStart}
                                    onTouchStart={handleSlideStart}
                                >
                                    🚨
                                </div>
                            </div>
                            <div className="muted" style={{ marginTop: 10, textAlign: 'center', fontSize: 12 }}>
                                Kéo thanh trượt sang phải để xác nhận gọi kỹ thuật
                            </div>
                        </div>
                    ) : (
                        <div className="sos-calling">
                            <div className="sos-calling-icon">📡</div>
                            <div className="sos-calling-status">{connectionStatus}</div>
                            <div className="sos-pulse-ring"></div>
                            <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={resetSOS}>
                                Hủy cuộc gọi
                            </button>
                        </div>
                    )}
                </div>

                <div className="panel">
                    <h3 style={{ margin: '0 0 8px' }}>Thông tin gửi đi</h3>
                    <div className="inline">
                        <span className="pill">Elevator #A</span>
                        <span className="pill">{sosTime}</span>
                        <span className="pill">Trạng thái: {status.door ?? '--'}</span>
                    </div>
                    <div style={{ marginTop: 12 }} className="muted">
                        Bao gồm vị trí, thời gian, trạng thái, tầng hiện tại.
                    </div>

                    {/* SIM Module */}
                    <div className="sim-module">
                        <h3 style={{ margin: '12px 0 8px' }}>SIM Module</h3>
                        <div className="sim-info">
                            <div className="sim-signal">
                                {Array.from({ length: 5 }, (_, i) => (
                                    <div key={i} className={`signal-bar ${i < simInfo.signal ? 'active' : ''}`}
                                        style={{ height: `${8 + i * 4}px` }} />
                                ))}
                            </div>
                            <div>
                                <div className="sim-carrier">{simInfo.carrier}</div>
                                <div className="muted" style={{ fontSize: 11 }}>{simInfo.number}</div>
                            </div>
                        </div>
                        <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
                            Kết nối GSM hoạt động — sẵn sàng gọi khẩn cấp.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
