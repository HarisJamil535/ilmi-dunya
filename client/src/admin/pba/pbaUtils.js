export const moved = (list, from, to) => { const next = [...list]; const [item] = next.splice(from, 1); next.splice(to, 0, item); return next; };
export const messageOf = (error, fallback) => error?.response?.data?.message || fallback;
