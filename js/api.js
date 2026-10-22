/* SciCoproof backend API client.
   All authenticated calls attach the JWT as a Bearer token.
   SSE is consumed via fetch + a streaming reader (not EventSource) so the
   Authorization header can be sent — EventSource doesn't support custom headers.
   Exposes window.SciCoProofAPI. */
(function () {
  const cfg = window.SCICOPROOF_CONFIG || {};
  const BASE = (cfg.API_BASE || "").replace(/\/$/, "");

  async function headers() {
    const token = window.SciCoProofAuth ? await window.SciCoProofAuth.getToken() : null;
    const h = {};
    if (token) h["Authorization"] = "Bearer " + token;
    return h;
  }

  function _parseOrThrow(res, data, jsonErr) {
    if (res.status === 401) throw { code: 401, message: "Please sign in." };
    if (!res.ok) {
      const detail = (data && data.detail) ? data.detail : { error: "request_failed" };
      throw { code: res.status, detail, message: (typeof detail === "string" ? detail : (detail.error || res.statusText)) };
    }
    // Server returned 2xx but body wasn't valid JSON — likely a cold-start HTML page.
    if (data === null && jsonErr) {
      throw { code: 0, message: "The service may be starting up — please wait a moment and try again." };
    }
    return data;
  }

  async function req(method, path, body) {
    const opts = { method, headers: await headers() };
    if (body) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(BASE + path, opts);
    let data = null, jsonErr = null;
    try { data = await res.json(); } catch (e) { jsonErr = e; }
    return _parseOrThrow(res, data, jsonErr);
  }

  async function upload(path, file) {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(BASE + path, { method: "POST", headers: await headers(), body: form });
    let data = null, jsonErr = null;
    try { data = await res.json(); } catch (e) { jsonErr = e; }
    return _parseOrThrow(res, data, jsonErr);
  }

  // XHR-based upload so we get real byte-level progress events.
  async function uploadWithProgress(path, file, onProgress) {
    const hdrs = await headers();
    return new Promise((resolve, reject) => {
      const form = new FormData();
      form.append("file", file);
      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = e => {
        if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
      };
      xhr.onload = () => {
        let data = null, jsonErr = null;
        try { data = JSON.parse(xhr.responseText); } catch (e) { jsonErr = e; }
        const res = { ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status };
        try { resolve(_parseOrThrow(res, data, jsonErr)); } catch (e) { reject(e); }
      };
      xhr.onerror = () => reject({ code: 0, message: "Network error" });
      xhr.open("POST", BASE + path);
      Object.entries(hdrs).forEach(([k, v]) => xhr.setRequestHeader(k, v));
      xhr.send(form);
    });
  }

  async function download(path) {
    const res = await fetch(BASE + path, { headers: await headers() });
    if (!res.ok) throw { code: res.status, message: res.statusText };
    return res.blob();
  }

  window.SciCoProofAPI = {
    me() { return req("GET", "/me"); },

    /** POST /billing/checkout — start a subscription. body: {tier:'pro'|'max', period, currency}.
     *  Returns {provider:'razorpay', subscription_id, key_id} or {provider:'dodo', checkout_url}. */
    checkout(body) { return req("POST", "/billing/checkout", body); },

    /** POST /billing/cancel — cancel the current subscription (access lasts until period end). */
    cancelSub() { return req("POST", "/billing/cancel", {}); },

    /** POST /analyze — uploads file once, returns review metadata + file_id. */
    analyze(file, onProgress) { return uploadWithProgress("/analyze", file, onProgress); },

    /** POST /run — starts the pipeline using the cached file_id, returns {job_id, tier}.
     *  `tier` (optional) is an admin-only override ('free'/'pro'); ignored for non-admins. */
    run(fileId, tier) {
      const body = { file_id: fileId };
      if (tier) body.tier = tier;
      return req("POST", "/run", body);
    },

    /** Free run from an outreach email (A/B test). link = {paper, v, t}.
     *  trialEvent: funnel counting ('open' needs no sign-in; 'signed_in' / 'done' do).
     *  trialAnalyze: loads the paper from arXiv, returns the same shape as analyze() + trial:true.
     *  trialRun: starts the one free Pro run (doesn't use the monthly words). */
    trialEvent(link) { return req("POST", "/trial/event", link); },
    trialAnalyze(link) { return req("POST", "/trial/analyze", { paper: link.paper, v: link.v, t: link.t }); },
    trialRun(fileId) { return req("POST", "/trial/run", { file_id: fileId }); },

    /** Download a finished job result.
     * kind: "result" (nested package ZIP) | "clean" | "tracked" | "bundle" (flat two-file ZIP) */
    downloadResult(jobId, kind) {
      kind = kind || "result";
      return download(`/jobs/${encodeURIComponent(jobId)}/${kind}`);
    },

    /** GET /jobs/{id}/pdf — the commented PDF (Pro LaTeX runs). Returns {status:'building'} while it's
     *  being built, {status:'ready', blob, comments}, or throws (404 none, 422 couldn't compile). */
    async jobPdf(jobId) {
      const res = await fetch(BASE + `/jobs/${encodeURIComponent(jobId)}/pdf`, { headers: await headers() });
      if (res.status === 202) return { status: "building" };
      if (!res.ok) {
        let data = null;
        try { data = await res.json(); } catch (_) {}
        const d = data && data.detail;
        throw { code: res.status, message: (d && (d.error || d)) || res.statusText };
      }
      return { status: "ready", blob: await res.blob(), comments: +(res.headers.get("X-Benjamin-Comments") || 0) };
    },

    /** POST /feedback */
    feedback(stars, comment) { return req("POST", "/feedback", { stars, comment }); },

    /**
     * Stream SSE events from /jobs/{jobId}/stream.
     * handlers: { onEvent(type, data), onError(err) }
     */
    async streamJob(jobId, handlers) {
      handlers = handlers || {};
      const res = await fetch(BASE + `/jobs/${encodeURIComponent(jobId)}/stream`, {
        headers: await headers(),
      });
      if (!res.ok || !res.body) {
        if (handlers.onError) handlers.onError({ code: res.status });
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const frames = buf.split("\n\n");
        buf = frames.pop();
        for (const frame of frames) {
          let evt = "message", payload = "";
          for (const line of frame.split("\n")) {
            if (line.startsWith("event:")) evt = line.slice(6).trim();
            else if (line.startsWith("data:")) payload += line.slice(5).trim();
          }
          if (!payload || evt === "keepalive") continue;
          let data = {};
          try { data = JSON.parse(payload); } catch (_) {}
          if (handlers.onEvent) handlers.onEvent(evt, data);
          if (evt === "done" || evt === "error") return;
        }
      }
    },
  };
})();
