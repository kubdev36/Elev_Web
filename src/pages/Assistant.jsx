import React, { useState, useRef, useCallback } from 'react';
import BotOrb from '../components/BotOrb';
import { useToast } from '../components/Toast';
import { speak, cancelSpeech, voiceChatOnce } from '../services/speech';
import { fetchChatAbortable } from '../services/api';
import './Assistant.css';

export default function Assistant() {
    const showToast = useToast();
    const [messages, setMessages] = useState([
        { who: 'bot', text: 'Xin chào, tôi là Sunybot. Tôi có thể hỗ trợ gọi tầng, kiểm tra trạng thái và trả lời câu hỏi.' },
    ]);
    const [input, setInput] = useState('');
    const [busy, setBusy] = useState(false);
    const [botMode, setBotMode] = useState('idle');
    const [stateText, setStateText] = useState('Sẵn sàng giao tiếp.');
    const abortRef = useRef(null);
    const chatEndRef = useRef(null);

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };

    const addMessage = useCallback((text, who) => {
        setMessages((prev) => [...prev, { who, text }]);
        setTimeout(scrollToBottom, 50);
    }, []);

    const doSend = useCallback(async (text) => {
        if (!text) return;

        // cancel previous
        if (abortRef.current) {
            try { abortRef.current.abort(); } catch { }
            abortRef.current = null;
        }

        addMessage(text, 'user');
        setInput('');
        setBusy(true);
        setBotMode('speaking');
        setStateText('Đang trả lời...');

        const controller = new AbortController();
        abortRef.current = controller;

        try {
            const data = await fetchChatAbortable(text, controller.signal);
            const answer = data.answer || '...';
            addMessage(answer, 'bot');
            setStateText('Đã trả lời.');
            speak(answer);
        } catch (e) {
            if (e && (e.name === 'AbortError' || String(e).includes('AbortError'))) {
                setStateText('Đã hủy.');
            } else {
                addMessage('Sunybot hiện không thể trả lời.', 'bot');
                setStateText('Lỗi kết nối.');
            }
        } finally {
            abortRef.current = null;
            setBusy(false);
            setBotMode('idle');
        }
    }, [addMessage]);

    const handleStop = () => {
        cancelSpeech();
        if (abortRef.current) {
            try { abortRef.current.abort(); } catch { }
            abortRef.current = null;
        }
        setBusy(false);
        setBotMode('idle');
        setStateText('Đã hủy.');
    };

    const handleVoice = () => {
        setBotMode('listening');
        setStateText('Đang nghe câu hỏi...');
        voiceChatOnce(
            (text) => {
                addMessage(text, 'user');
                setInput(text);
                doSend(text);
            },
            null,
            () => {
                setBotMode('idle');
                setStateText('Sẵn sàng giao tiếp.');
            }
        );
    };

    const quickChips = [
        { label: 'Gọi tầng 7', text: 'Gọi tôi lên tầng 7' },
        { label: 'Tầng hiện tại', text: 'Thang đang ở tầng mấy?' },
        { label: 'Trạng thái cửa', text: 'Cửa đang mở hay đóng?' },
        { label: 'Kiểm tra tải', text: 'Tình trạng quá tải?' },
        { label: 'Thời tiết', text: 'Thời tiết hôm nay thế nào?' },
    ];

    return (
        <div>
            <div className="page-title">
                <h1>Trợ lý ảo</h1>
                <div className="meta">Chat bằng giọng nói hoặc bàn phím</div>
            </div>

            <div className="grid-2">
                <div className="panel">
                    <div className="chat-layout">
                        <div className="chat-box">
                            <div className="chat-messages">
                                {messages.map((m, i) => (
                                    <div key={i} className={`bubble ${m.who}`}>{m.text}</div>
                                ))}
                                <div ref={chatEndRef} />
                            </div>
                            <div className="chat-input">
                                <input
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && doSend(input.trim())}
                                    placeholder="Nhập câu hỏi..."
                                />
                                {!busy ? (
                                    <button className="btn btn-primary" onClick={() => doSend(input.trim())}>Gửi</button>
                                ) : (
                                    <button className="btn btn-stop" onClick={handleStop}>Dừng</button>
                                )}
                                <button className="btn btn-ghost" onClick={handleVoice}>Mic</button>
                            </div>
                        </div>

                        <div className="card">
                            <h3>Câu hỏi mẫu</h3>
                            <div className="chips">
                                {quickChips.map((c) => (
                                    <div key={c.label} className="chip" onClick={() => doSend(c.text)}>{c.label}</div>
                                ))}
                            </div>
                            <div style={{ marginTop: 12 }} className="muted">
                                Sunybot trả lời bằng giọng nói và hiển thị chữ cùng lúc.
                            </div>
                        </div>
                    </div>
                </div>

                <div className="panel suny">
                    <BotOrb mode={botMode} title="Avatar" stateText={stateText} />
                </div>
            </div>
        </div>
    );
}
