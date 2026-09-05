#!/usr/bin/env node
/**
 * A minimal DevTools Protocol client: Node's built-in WebSocket and nothing
 * else.
 *
 * Shared by `shot.mjs` (screenshots and measurement) and `map-posters.mjs`
 * (the built-at-build-time map stills). It was written for the first and
 * copied into the second once, which is the moment to stop copying.
 */
export class CDP {
  #ws;
  #id = 0;
  #pending = new Map();
  #handlers = new Map();

  static async connect(wsUrl) {
    const cdp = new CDP();
    cdp.#ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => {
      cdp.#ws.addEventListener('open', res, { once: true });
      cdp.#ws.addEventListener('error', rej, { once: true });
    });
    cdp.#ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && cdp.#pending.has(msg.id)) {
        const { resolve, reject } = cdp.#pending.get(msg.id);
        cdp.#pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      } else if (msg.method) {
        // In flat mode the session is on the envelope, not in params. Merge it
        // in so handlers can tell which page an event came from.
        const params = { ...msg.params, sessionId: msg.sessionId };
        for (const fn of cdp.#handlers.get(msg.method) ?? []) fn(params);
      }
    });
    return cdp;
  }

  send(method, params = {}, sessionId) {
    const id = ++this.#id;
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      this.#ws.send(JSON.stringify({ id, method, params, sessionId }));
    });
  }

  on(method, fn) {
    if (!this.#handlers.has(method)) this.#handlers.set(method, []);
    this.#handlers.get(method).push(fn);
  }

  once(method, predicate = () => true) {
    return new Promise((resolve) => {
      this.on(method, (params) => predicate(params) && resolve(params));
    });
  }

  close() {
    this.#ws.close();
  }
}
