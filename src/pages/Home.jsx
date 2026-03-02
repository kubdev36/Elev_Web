import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useElevatorStatus from '../hooks/useElevatorStatus';
import BotOrb from '../components/BotOrb';
import { useToast } from '../components/Toast';
import api from '../services/api';
import { speak, startWakeWordListener } from '../services/speech';
import './Home.css';

export default function Home() {
    const status = useElevatorStatus();
    const showToast = useToast();
    const navigate = useNavigate();

    const [botMode, setBotMode] = useState('idle');
    const [stateText, setStateText] = useState('Đang chờ wake word…');

    // Wake word listener
    useEffect(() => {
        const cleanup = startWakeWordListener({
            onModeChange: setBotMode,
            onStateText: setStateText,
            onWakeOnly: () => setStateText('Đã kích hoạt. Hãy nói câu lệnh...'),
            onWakeCommand: async (text) => {
                setStateText('Đang xử lý: ' + text);
                setBotMode('speaking');
                try {
                    const data = await api.chat(text);
                    const answer = data.answer || '...';
                    setStateText('Sunybot: ' + answer);
                    speak(answer);
                } catch {
                    setStateText('Sunybot hiện không thể trả lời.');
                } finally {
                    setBotMode('listening');
                }
            },
        });
        return cleanup;
    }, []);

    const directionText = (dir) => {
        if (dir === 'UP') return '↑ Lên';
        if (dir === 'DOWN') return '↓ Xuống';
        return 'Đứng';
    };

    return (
        <div>
            <div className="page-title">
                <h1>Trạng thái thang máy</h1>
                <div className="meta">Elevator #A · Khu chính</div>
            </div>

            <div className="grid-2">
                <div className="panel">
                    <div className="status-grid">
                        <div className="floor-card">
                            <div className="label">Tầng hiện tại</div>
                            <div className="floor-display">
                                <div className="floorNum">{status.floor ?? '--'}</div>
                                <div className={`badge ${status.overload ? 'err' : 'ok'}`}>
                                    {status.overload ? 'QUÁ TẢI' : 'Bình thường'}
                                </div>
                            </div>
                            <div className="inline">
                                <span className="pill">Wake word: <b>hey sunybot</b></span>
                                <span className="pill">Chạm 1 lần để xác nhận</span>
                            </div>
                        </div>

                        <div className="tiles">
                            <div className="tile">
                                <div className="k">Chiều đi</div>
                                <div className="v">{directionText(status.direction)}</div>
                            </div>
                            <div className="tile">
                                <div className="k">Cửa</div>
                                <div className="v">{status.door ?? '--'}</div>
                            </div>
                            <div className="tile">
                                <div className="k">Số người</div>
                                <div className="v">{status.people_count ?? '--'}</div>
                            </div>
                            <div className="tile">
                                <div className="k">Thời gian</div>
                                <div className="v">{status.time ?? '--:--:--'}</div>
                            </div>
                            <div className="tile">
                                <div className="k">Thời tiết</div>
                                <div className="v">{status.weather ?? '--'}</div>
                            </div>
                            <button className="btn btn-primary" onClick={() => navigate('/call')}>
                                Gọi tầng
                            </button>
                        </div>
                    </div>
                </div>

                <div className="panel suny">
                    <BotOrb mode={botMode} stateText={stateText} />
                    <div className="inline">
                        <button className="btn btn-ghost" onClick={() => setBotMode('idle')}>Bình thường</button>
                        <button className="btn btn-ghost" onClick={() => setBotMode('listening')}>Đang nghe</button>
                        <button className="btn btn-ghost" onClick={() => setBotMode('speaking')}>Đang trả lời</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
