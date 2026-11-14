// Medic1905 API client
const Pages = {};
const api = {
  token: localStorage.getItem('m1905_token') || null,
  user: JSON.parse(localStorage.getItem('m1905_user') || 'null'),

  async request(method, path, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (this.token) opts.headers['Authorization'] = 'Bearer ' + this.token;
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch('/api/sim' + path, opts);
    if (res.status === 401) { this.logout(); throw new Error('Not authenticated'); }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  },
  get(path) { return this.request('GET', path); },
  post(path, body) { return this.request('POST', path, body); },
  put(path, body) { return this.request('PUT', path, body); },

  saveAuth(token, user) {
    this.token = token; this.user = user;
    localStorage.setItem('m1905_token', token);
    localStorage.setItem('m1905_user', JSON.stringify(user));
  },
  logout() {
    this.token = null; this.user = null;
    localStorage.removeItem('m1905_token');
    localStorage.removeItem('m1905_user');
  }
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
