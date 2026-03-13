import React, { useState, useEffect, useRef } from 'react';
import { useToast } from '../components/Toast';
import api from '../services/api';
import './CallFloor.css';

const FLOORS = Array.from({ length: 15 }, (_, i) => i + 1);

export default function CallFloor() {
    const showToast = useToast();
    const [selectedFloors, setSelectedFloors] = useState([]);
    const [pressed, setPressed] = useState(null);
    const [showPinModal, setShowPinModal] = useState(false);
    const [authStep, setAuthStep] = useState('pin'); // 'select', 'pin', 'face'
    const [authOptions, setAuthOptions] = useState({ pin: true, face: false });
    const [pinTarget, setPinTarget] = useState(null);
    const [pin, setPin] = useState('');
    const [pinError, setPinError] = useState('');
    
    // Camera logic for FaceID
    const videoRef = useRef(null);
    const [cameraStream, setCameraStream] = useState(null);

    // Read locked floors from localStorage (shared with Maintenance)
    const getLockedFloors = () => {
        try {
            const saved = localStorage.getItem('locked_floors');
            return saved ? JSON.parse(saved) : [6, 9, 13];
        } catch { return [6, 9, 13]; }
    };

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            setCameraStream(stream);
            if (videoRef.current) videoRef.current.srcObject = stream;
        } catch (err) {
            console.error("Camera fail", err);
            setPinError("Không thể bật camera");
        }
    };

    const stopCamera = () => {
        if (cameraStream) {
            cameraStream.getTracks().forEach(t => t.stop());
            setCameraStream(null);
        }
    };

    // Cleanup camera when modal closes or step changes
    useEffect(() => {
        if (showPinModal && authStep === 'face') startCamera();
        else stopCamera();
        return () => stopCamera();
    }, [authStep, showPinModal]);

    const handleCall = async (floor) => {
        const locked = getLockedFloors();
        if (locked.includes(floor)) {
            // Read auth config for this floor
            let config = { pin: true, face: false };
            try {
                const savedCfg = JSON.parse(localStorage.getItem('floor_auth_config') || '{}');
                if (savedCfg[floor]) config = savedCfg[floor];
            } catch {}
            
            setAuthOptions(config);
            setPinTarget(floor);
            setPin('');
            setPinError('');
            
            if (config.pin && config.face) setAuthStep('select');
            else if (config.face) setAuthStep('face');
            else setAuthStep('pin');
            
            setShowPinModal(true);
            return;
        }
        doCall(floor);
    };

    const doCall = async (floor) => {
        // Multi-select: Toggle presence in array
        setSelectedFloors(prev => {
            if (prev.includes(floor)) return prev.filter(f => f !== floor);
            return [...prev, floor];
        });

        setPressed(floor);
        setTimeout(() => setPressed(null), 300);
        
        // Sync with elevator system (triggers useElevatorStatus simulation)
        localStorage.setItem('lift_target', floor);

        try {
            await api.callFloor(floor);
            showToast(`Đã gọi tầng ${floor}`);
        } catch {
            showToast('Không thể gọi tầng');
        }
    };

    const handleFaceScan = () => {
        // Simulate face scan success after delay
        setTimeout(() => {
            const currentLocked = getLockedFloors();
            const newLocked = currentLocked.filter(f => f !== pinTarget);
            localStorage.setItem('locked_floors', JSON.stringify(newLocked));
            showToast(`Xác thực FaceID thành công: Tầng ${pinTarget}`);
            setShowPinModal(false);
            doCall(pinTarget);
        }, 1500);
    };

    const handlePinSubmit = () => {
        if (pin.length !== 4) {
            setPinError('Mật khẩu phải đủ 4 số');
            return;
        }
        // Validate against PIN set by Maintenance
        let floorPins = {};
        try { floorPins = JSON.parse(localStorage.getItem('floor_pins') || '{}'); } catch { }
        const correctPin = floorPins[pinTarget];
        if (correctPin && pin !== correctPin) {
            setPinError('Sai mật khẩu. Vui lòng thử lại.');
            setPin('');
            return;
        }

        const currentLocked = getLockedFloors();
        const newLocked = currentLocked.filter(f => f !== pinTarget);
        localStorage.setItem('locked_floors', JSON.stringify(newLocked));
        showToast(`Đã mở khóa tầng ${pinTarget}`);

        setShowPinModal(false);
        doCall(pinTarget);
    };

    const handlePinDigit = (digit) => {
        if (pin.length < 4) setPin(prev => prev + digit);
    };

    const handlePinBackspace = () => {
        setPin(prev => prev.slice(0, -1));
        setPinError('');
    };

    const lockedFloors = getLockedFloors();

    return (
        <div>
            <div className="page-title">
                <h1>Màn hình gọi tầng</h1>
                <div className="meta">Chọn các tầng cần đến</div>
            </div>

            <div className="panel">
                <div className="call-grid">
                    {FLOORS.map((f) => {
                        const isLocked = lockedFloors.includes(f);
                        const isSelected = selectedFloors.includes(f);
                        const isPressed = pressed === f;
                        return (
                            <button
                                key={f}
                                className={[
                                    'floor-btn',
                                    isLocked ? 'locked' : '',
                                    isSelected ? 'selected' : '',
                                    isPressed ? 'pressing' : '',
                                ].join(' ')}
                                onClick={() => handleCall(f)}
                            >
                                <span className="floor-num">{f}</span>
                                {isLocked && <span className="lock-label">🔒 Khóa</span>}
                                {isSelected && !isLocked && <span className="selected-label">✓ Đã chọn</span>}
                            </button>
                        );
                    })}
                </div>

                <div className="auth-panel">
                    <div className="auth-card">
                        <h3>🔑 Xác thực mật khẩu 4 số</h3>
                        <div className="muted">Nhập mật khẩu 4 số để mở khóa tầng bị hạn chế.</div>
                    </div>
                    <div className="auth-card">
                        <h3>👤 Xác thực khuôn mặt</h3>
                        <div className="muted">Nhìn vào camera để xác thực FaceID.</div>
                    </div>
                </div>
            </div>

            {/* PIN Modal */}
            {showPinModal && (
                <div className="pin-overlay" onClick={() => setShowPinModal(false)}>
                    <div className="pin-modal" onClick={e => e.stopPropagation()}>
                        {authStep === 'select' && (
                            <>
                                <h3>Chọn phương thức xác thực</h3>
                                <div className="muted" style={{ marginBottom: 20 }}>Tầng {pinTarget} yêu cầu mở khóa.</div>
                                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                                    <button className="btn btn-primary" onClick={() => setAuthStep('pin')}>Mật khẩu</button>
                                    <button className="btn btn-primary" onClick={() => setAuthStep('face')}>FaceID</button>
                                </div>
                            </>
                        )}

                        {authStep === 'face' && (
                            <>
                                <h3>Xác thực khuôn mặt</h3>
                                <div className="muted">Giữ yên khuôn mặt...</div>
                                <div style={{ width: '100%', height: 200, background: '#000', margin: '10px 0', borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
                                    <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        onCanPlay={() => handleFaceScan()}
                                    />
                                </div>
                                <button className="btn btn-ghost" onClick={() => authOptions.pin ? setAuthStep('select') : setShowPinModal(false)}>Quay lại</button>
                            </>
                        )}

                        {authStep === 'pin' && (
                            <>
                        <h3>Nhập mật khẩu 4 số</h3>
                        <div className="muted">Tầng {pinTarget} bị khóa. Nhập PIN để mở.</div>
                        <div className="pin-dots">
                            {[0, 1, 2, 3].map(i => (
                                <div key={i} className={`pin-dot ${i < pin.length ? 'filled' : ''}`} />
                            ))}
                        </div>

                        {pinError && <div className="pin-error">{pinError}</div>}

                        <div className="pin-pad">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del'].map((d, i) => (
                                <button
                                    key={i}
                                    className={`pin-key ${d === null ? 'empty' : ''} ${d === 'del' ? 'del' : ''}`}
                                    onClick={() => {
                                        if (d === null) return;
                                        if (d === 'del') handlePinBackspace();
                                        else handlePinDigit(String(d));
                                    }}
                                    disabled={d === null}
                                >
                                    {d === 'del' ? '⌫' : d}
                                </button>
                            ))}
                        </div>

                        <div className="pin-actions">
                            <button className="btn btn-ghost" onClick={() => {
                                if (authOptions.face && authOptions.pin) setAuthStep('select');
                                else setShowPinModal(false);
                            }}>Quay lại</button>
                            <button className="btn btn-primary" onClick={handlePinSubmit}>Xác nhận</button>
                        </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
