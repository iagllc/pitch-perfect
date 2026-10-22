/* WebSocket client for online rooms. */
(function () {
  'use strict';
  class Net {
    constructor() { this.handlers = {}; this.ws = null; this.id = null; }
    static available() { return location.protocol === 'http:' || location.protocol === 'https:'; }
    connect() {
      return new Promise((resolve, reject) => {
        const url = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
        const ws = new WebSocket(url); this.ws = ws; const to = setTimeout(() => { reject(new Error('timeout')); try { ws.close(); } catch (e) {} }, 6000);
        ws.onopen = () => { clearTimeout(to); resolve(); };
        ws.onerror = () => { clearTimeout(to); reject(new Error('cannot reach server')); };
        ws.onclose = () => this.emit('close', {});
        ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } if (m.t === 'joined') this.id = m.id; this.emit(m.t, m); };
      });
    }
    on(t, fn) { (this.handlers[t] = this.handlers[t] || []).push(fn); }
    off(t) { delete this.handlers[t]; }
    emit(t, m) { (this.handlers[t] || []).forEach(fn => fn(m)); }
    send(o) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); }
    close() { try { this.ws && this.ws.close(); } catch (e) {} }
  }
  window.Net = Net;
})();
