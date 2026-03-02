import { useState, useEffect } from 'react';
import api from '../services/api';

export default function useElevatorStatus(intervalMs = 1000) {
    const [status, setStatus] = useState({
        floor: '--',
        direction: '--',
        door: '--',
        people_count: '--',
        time: '--:--:--',
        overload: false,
    });

    useEffect(() => {
        let active = true;

        const poll = async () => {
            try {
                const s = await api.elevatorStatus();
                if (active) setStatus(s);
            } catch { }
        };

        poll();
        const id = setInterval(poll, intervalMs);
        return () => { active = false; clearInterval(id); };
    }, [intervalMs]);

    return status;
}
