const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function readArrivalIds(search: string): string[] {
    return [...new Set((new URLSearchParams(search).get('arrive') || '').split(',').filter(id => UUID.test(id)))].slice(0, 10);
}
export function clearArrivalQuery() {
    const url = new URL(window.location.href);
    url.searchParams.delete('arrive');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
}
