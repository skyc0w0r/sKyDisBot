function time(seconds: number): string {
    const s = seconds % 60;
    const m = Math.floor(seconds / 60) % 60;
    const h = Math.floor(seconds / 3600);

    const pad = (e: number) => e.toString().padStart(2, '0');
    if (h === 0) {
        return `${pad(m)}:${pad(s)}`;
    }
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function size(bytes: number): string {
    const postfixes = [ 'B', 'KB', 'MB', 'GB' ];
    let index = 0;
    while (bytes >= 1024 && index < postfixes.length) {
        bytes /= 1024;
        index += 1;
    }
    const prefix = bytes % 1 === 0 ? bytes.toString() : bytes.toFixed(2);
    return `${prefix} ${postfixes[index]}`;
}

function date(date: Date): string {
    const y = date.getFullYear();
    const m = (date.getMonth()+1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export default {
    time,
    size,
    date,
};
