import { useState, useEffect } from 'react';

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

        // Initialize defaults if not present
        if (!localStorage.getItem('lift_current')) localStorage.setItem('lift_current', '1');
        if (!localStorage.getItem('lift_target')) localStorage.setItem('lift_target', '1');

        const simulate = () => {
            if (!active) return;

            // Read shared state
            let current = parseInt(localStorage.getItem('lift_current') || '1');
            let target = parseInt(localStorage.getItem('lift_target') || '1');
            const lastMove = parseInt(localStorage.getItem('lift_last_move') || '0');
            const now = Date.now();
            
            let direction = 'STOP';
            if (target > current) direction = 'UP';
            else if (target < current) direction = 'DOWN';

            // Move logic: 1 floor every 2 seconds
            if (direction !== 'STOP' && (now - lastMove > 2000)) {
                if (direction === 'UP') current++;
                else current--;
                
                localStorage.setItem('lift_current', current);
                localStorage.setItem('lift_last_move', now);
            }

            setStatus({
                floor: current,
                direction: direction,
                door: direction === 'STOP' ? 'OPEN' : 'CLOSED',
                people_count: Math.floor(Math.random() * 8), // Simulated
                time: new Date().toLocaleTimeString('vi-VN'),
                overload: false,
            });
        };

        simulate();
        const id = setInterval(simulate, 500); // Check fast for smooth UI updates
        return () => { active = false; clearInterval(id); };
    }, []);

    return status;
}
