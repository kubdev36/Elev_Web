import React, { useState } from 'react';
import { useToast } from '../components/Toast';
import api from '../services/api';
import './CallFloor.css';

const FLOORS = Array.from({ length: 15 }, (_, i) => i + 1);

export default function CallFloor() {
    const showToast = useToast();
    const [selected, setSelected] = useState(null);
    const [pressed, setPressed] = useState(null);
    const [showPinModal, setShowPinModal] = useState(false);
    const [pinTarget, setPinTarget] = useState(null);
    const [pin, setPin] = useState('');
    const [pinError, setPinError] = useState('');

    // Read locked floors from localStorage (shared with Maintenance)
    const getLockedFloors = () => {
        try {
            const saved = localStorage.getItem('locked_floors');
            return saved ? JSON.parse(saved) : [6, 9, 13];
        } catch { return [6, 9, 13]; }
    };

    const handleCall = async (floor) => {
        const locked = getLockedFloors();
        if (locked.includes(floor)) {
            setPinTarget(floor);
            setPin('');
            setPinError('');
            setShowPinModal(true);
            return;
        }
        doCall(floor);
    };

    const doCall = async (floor) => {
        setSelected(prev => prev === floor ? null : floor);
        setPressed(floor);
        setTimeout(() => setPressed(null), 300);
        try {
            await api.callFloor(floor);
            showToast(`Đã gọi tầng ${floor}`);
        } catch {
            showToast('Không thể gọi tầng');
        }
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
                <div className="meta">Chọn tầng cần đến</div>
            </div>

            <div className="panel">
                <div className="call-grid">
                    {FLOORS.map((f) => {
                        const isLocked = lockedFloors.includes(f);
                        const isSelected = selected === f;
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
                            <button className="btn btn-ghost" onClick={() => setShowPinModal(false)}>Hủy</button>
                            <button className="btn btn-primary" onClick={handlePinSubmit}>Xác nhận</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
