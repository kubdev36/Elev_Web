import { useState, useEffect } from 'react';
import api from '../services/api';

export default function useWeather(intervalMs = 600000) {
    const [weather, setWeather] = useState('--');

    useEffect(() => {
        let active = true;

        const poll = async () => {
            try {
                const w = await api.weather();
                if (active) setWeather(`${w.text} ${w.temp}°C`);
            } catch {
                if (active) setWeather('--');
            }
        };

        poll();
        const id = setInterval(poll, intervalMs);
        return () => { active = false; clearInterval(id); };
    }, [intervalMs]);

    return weather;
}
