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

  async function download(path) {
    const res = await fetch(BASE + path, { headers: await headers() });
    if (!res.ok) throw { code: res.status, message: res.statusText };
    return res.blob();
  }

  window.SciCoProofAPI = {
    me() { return req("GET", "/me"); },

    /** POST /analyze — returns review metadata without starting proofreading. */
    analyze(file) { return upload("/analyze", file); },

    /** POST /run — starts the pipeline, returns {job_id}. */
    run(file) { return upload("/run", file); },

    /** Download a finished job result. kind: "result"|"clean"|"tracked" */
    downloadResult(jobId, kind) {
      kind = kind || "result";
      return download(`/jobs/${encodeURIComponent(jobId)}/${kind}`);
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
