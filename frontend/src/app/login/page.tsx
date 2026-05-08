"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import * as THREE from "three";

const CSS = `
  .login-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    position: relative;
    overflow: hidden;
    background: #F5F6FF;
    font-family: 'Poppins', sans-serif;
  }
  .login-bg-blob {
    position: absolute;
    border-radius: 50%;
    filter: blur(100px);
    pointer-events: none;
  }
  .login-blob-1 { width: 600px; height: 600px; background: rgba(99,102,241,0.12); top: -150px; right: -120px; }
  .login-blob-2 { width: 450px; height: 450px; background: rgba(167,139,250,0.10); bottom: -100px; left: -80px; }
  .login-blob-3 { width: 300px; height: 300px; background: rgba(79,70,229,0.07); top: 40%; left: 40%; }
  #login-three { position: absolute; inset: 0; pointer-events: none; z-index: 0; }

  .login-card {
    position: relative;
    z-index: 1;
    background: #fff;
    border-radius: 22px;
    box-shadow: 0 4px 24px rgba(79,70,229,0.10), 0 20px 60px rgba(79,70,229,0.08), 0 1px 3px rgba(0,0,0,0.05);
    border: 1px solid rgba(79,70,229,0.10);
    width: 100%;
    max-width: 420px;
    overflow: hidden;
  }

  .login-card-vis {
    height: 160px;
    background: linear-gradient(135deg, #1A1A2E 0%, #16213E 60%, #0F3460 100%);
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  #vis-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .login-card-vis-content {
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }
  .login-logo-mark {
    width: 52px;
    height: 52px;
    border-radius: 14px;
    background: linear-gradient(135deg, #4F46E5 0%, #818CF8 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    font-weight: 800;
    color: #fff;
    box-shadow: 0 6px 20px rgba(79,70,229,0.45);
    font-family: 'Poppins', sans-serif;
  }
  .login-logo-name {
    font-family: 'Poppins', sans-serif;
    font-size: 18px;
    font-weight: 700;
    color: #fff;
    letter-spacing: -0.01em;
  }
  .login-logo-sub {
    font-family: 'Poppins', sans-serif;
    font-size: 10px;
    font-weight: 500;
    color: rgba(199,210,254,0.55);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-top: -6px;
  }

  .login-form-wrap {
    padding: 32px 36px 36px;
  }
  .login-heading {
    font-family: 'Poppins', sans-serif;
    font-size: 22px;
    font-weight: 700;
    color: #18181B;
    margin-bottom: 4px;
    letter-spacing: -0.02em;
  }
  .login-sub {
    font-family: 'Poppins', sans-serif;
    font-size: 13px;
    font-weight: 400;
    color: #71717A;
    margin-bottom: 28px;
  }
  .login-field {
    margin-bottom: 16px;
  }
  .login-label {
    display: block;
    font-family: 'Poppins', sans-serif;
    font-size: 12px;
    font-weight: 600;
    color: #3F3F46;
    margin-bottom: 6px;
    letter-spacing: 0.01em;
  }
  .login-input {
    width: 100%;
    border: 1.5px solid #E4E4E7;
    border-radius: 10px;
    background: #FAFAFA;
    padding: 12px 14px;
    font-size: 14px;
    font-family: 'Poppins', sans-serif;
    font-weight: 400;
    color: #18181B;
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
    box-sizing: border-box;
  }
  .login-input:focus {
    border-color: #4F46E5;
    background: #fff;
    box-shadow: 0 0 0 3px rgba(79,70,229,0.10);
  }
  .login-input::placeholder { color: #A1A1AA; }
  .login-error {
    background: #FEF2F2;
    border: 1px solid rgba(220,38,38,0.20);
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 12.5px;
    font-family: 'Poppins', sans-serif;
    color: #DC2626;
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 7px;
  }
  .login-btn {
    width: 100%;
    background: #4F46E5;
    color: #fff;
    border: none;
    border-radius: 10px;
    padding: 14px;
    font-size: 14px;
    font-weight: 600;
    font-family: 'Poppins', sans-serif;
    cursor: pointer;
    transition: background 0.2s, box-shadow 0.2s, transform 0.15s;
    box-shadow: 0 4px 16px rgba(79,70,229,0.28);
    margin-top: 4px;
  }
  .login-btn:hover:not(:disabled) {
    background: #4338CA;
    box-shadow: 0 6px 22px rgba(79,70,229,0.38);
    transform: translateY(-1px);
  }
  .login-btn:disabled { opacity: 0.65; cursor: not-allowed; }
  .login-spinner {
    width: 14px; height: 14px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    display: inline-block;
    flex-shrink: 0;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .login-btn-inner {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  .login-footer {
    text-align: center;
    margin-top: 24px;
    font-size: 11px;
    font-family: 'Poppins', sans-serif;
    font-weight: 500;
    color: #D4D4D8;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
`;

function VisCanvas({ canvasRef }: { canvasRef: React.RefObject<HTMLCanvasElement | null> }) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const w = canvas.clientWidth || 420;
    const h = canvas.clientHeight || 160;
    renderer.setSize(w, h);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 200);
    camera.position.z = 14;

    const group = new THREE.Group();
    scene.add(group);

    const cols = [0x4F46E5, 0x6366F1, 0x818CF8, 0xA78BFA, 0xC4B5FD];
    const nodes: THREE.Mesh[] = [];

    for (let i = 0; i < 32; i++) {
      const geo = new THREE.SphereGeometry(Math.random() * 0.18 + 0.05, 8, 8);
      const mat = new THREE.MeshBasicMaterial({
        color: cols[Math.floor(Math.random() * cols.length)],
        transparent: true,
        opacity: Math.random() * 0.5 + 0.15,
        wireframe: Math.random() > 0.5,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 6);
      mesh.userData['vx'] = (Math.random() - 0.5) * 0.012;
      mesh.userData['vy'] = (Math.random() - 0.5) * 0.008;
      mesh.userData['base'] = mat.opacity;
      group.add(mesh);
      nodes.push(mesh);
    }

    for (let i = 0; i < 18; i++) {
      const a = nodes[Math.floor(Math.random() * nodes.length)];
      const b = nodes[Math.floor(Math.random() * nodes.length)];
      const geo = new THREE.BufferGeometry().setFromPoints([a.position.clone(), b.position.clone()]);
      const mat = new THREE.LineBasicMaterial({ color: 0x818CF8, transparent: true, opacity: 0.12 });
      const line = new THREE.Line(geo, mat);
      line.userData['a'] = a;
      line.userData['b'] = b;
      group.add(line);
    }

    let t = 0;
    let animId: number;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      t += 0.006;
      nodes.forEach(n => {
        n.position.x += n.userData['vx'];
        n.position.y += n.userData['vy'];
        if (Math.abs(n.position.x) > 11) n.userData['vx'] *= -1;
        if (Math.abs(n.position.y) > 5)  n.userData['vy'] *= -1;
        (n.material as THREE.MeshBasicMaterial).opacity =
          n.userData['base'] + Math.sin(t + n.position.x) * 0.08;
      });
      group.rotation.y = t * 0.025;
      renderer.render(scene, camera);
    };
    animate();

    return () => { cancelAnimationFrame(animId); renderer.dispose(); };
  }, [canvasRef]);

  return null;
}

export default function LoginPage() {
  const router      = useRouter();
  const { setAuth, user, token } = useAuthStore();

  // Already logged in — skip login page entirely
  useEffect(() => {
    if (user && token) router.replace("/search");
  }, [user, token, router]);

  const [email,      setEmail]      = useState("");
  const [password,   setPassword]   = useState("");
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [serverReady, setServerReady] = useState<"pinging"|"ready"|"slow">("pinging");

  const bgCanvasRef  = useRef<HTMLCanvasElement>(null);
  const visCanvasRef = useRef<HTMLCanvasElement>(null);

  // Wake the backend immediately on page load so it is warm by the time the user clicks Sign In
  useEffect(() => {
    const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
    const base = API.replace("/api/v1", "");
    let cancelled = false;

    const ping = async () => {
      for (let i = 0; i < 20; i++) {
        if (cancelled) return;
        try {
          const res = await fetch(`${base}/health`, { method: "GET", signal: AbortSignal.timeout(4000) });
          if (res.ok) {
            if (!cancelled) setServerReady("ready");
            return;
          }
        } catch {
          // still waking up — keep trying
        }
        await new Promise(r => setTimeout(r, 2000));
      }
      if (!cancelled) setServerReady("slow");
    };

    ping();
    return () => { cancelled = true; };
  }, []);

  // Full-page background Three.js (very subtle)
  useEffect(() => {
    const canvas = bgCanvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    renderer.setPixelRatio(1);
    renderer.setSize(window.innerWidth, window.innerHeight);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);
    camera.position.z = 30;

    const group = new THREE.Group();
    scene.add(group);

    for (let i = 0; i < 40; i++) {
      const geo = new THREE.SphereGeometry(Math.random() * 0.12 + 0.03, 6, 6);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x6366F1,
        transparent: true,
        opacity: Math.random() * 0.06 + 0.02,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set((Math.random() - 0.5) * 60, (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 20);
      mesh.userData['vy'] = (Math.random() - 0.5) * 0.006;
      group.add(mesh);
    }

    const onResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);

    let t = 0, animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      t += 0.003;
      group.rotation.y = t * 0.015;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(animId);
      renderer.dispose();
    };
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const MAX_RETRIES = 15;
    const RETRY_DELAY = 2000;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await login(email, password);
        setAuth(res.data.user, res.data.access_token);
        router.replace("/search");
        return;
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;

        if (status === 401 || status === 400) {
          setError("Incorrect email or password. Please try again.");
          setLoading(false);
          return;
        }

        // Server cold start — keep retrying with countdown
        if (attempt < MAX_RETRIES) {
          const secsLeft = Math.round(((MAX_RETRIES - attempt) * RETRY_DELAY) / 1000);
          setError(`__warming__${secsLeft}`);
          await new Promise(r => setTimeout(r, RETRY_DELAY));
        } else {
          setError("Could not reach the server. Please check your connection and try again.");
          setLoading(false);
        }
      }
    }
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="login-page">
        {/* Blobs */}
        <div className="login-bg-blob login-blob-1" />
        <div className="login-bg-blob login-blob-2" />
        <div className="login-bg-blob login-blob-3" />

        {/* Background Three.js */}
        <canvas ref={bgCanvasRef} id="login-three" />

        {/* Card */}
        <div className="login-card">

          {/* Top visual panel */}
          <div className="login-card-vis">
            <canvas ref={visCanvasRef} id="vis-canvas" />
            <VisCanvas canvasRef={visCanvasRef} />
            <div className="login-card-vis-content">
              <div className="login-logo-mark">U</div>
              <div className="login-logo-name">UBID Platform</div>
              <div className="login-logo-sub">Karnataka Business Intelligence</div>
            </div>
          </div>

          {/* Form */}
          <div className="login-form-wrap">
            <div className="login-heading">Welcome back</div>
            <div className="login-sub">Sign in to access the platform</div>

            <form onSubmit={handleLogin}>
              <div className="login-field">
                <label className="login-label">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="login-input"
                />
              </div>

              <div className="login-field">
                <label className="login-label">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="login-input"
                />
              </div>

              {error && !error.startsWith("__warming__") && (
                <div className="login-error">
                  <span>⚠</span> {error}
                </div>
              )}
              {error.startsWith("__warming__") && (
                <div style={{
                  background: "#EFF6FF",
                  border: "1px solid rgba(79,70,229,0.20)",
                  borderLeft: "3px solid #4F46E5",
                  borderRadius: 8, padding: "12px 14px",
                  marginBottom: 16,
                  display: "flex", alignItems: "center", gap: 10,
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: 13, color: "#3730A3",
                }}>
                  <span style={{
                    width: 16, height: 16,
                    border: "2px solid #A5B4FC",
                    borderTopColor: "#4F46E5",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                    display: "inline-block", flexShrink: 0,
                  }} />
                  <span>
                    <strong style={{ fontWeight: 700 }}>Server is warming up</strong> — retrying automatically, please wait…
                  </span>
                </div>
              )}

              <button type="submit" disabled={loading} className="login-btn">
                <div className="login-btn-inner">
                  {loading && <span className="login-spinner" />}
                  {loading ? "Signing in" : "Sign In"}
                </div>
              </button>
            </form>

            {/* Server status indicator */}
            <div style={{
              marginTop: 20,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              fontSize: 11.5, fontFamily: "'Poppins', sans-serif",
            }}>
              {serverReady === "pinging" && (
                <>
                  <span style={{
                    width: 8, height: 8, borderRadius: "50%",
                    border: "2px solid #D4D4D8", borderTopColor: "#4F46E5",
                    animation: "spin 0.8s linear infinite", display: "inline-block",
                  }} />
                  <span style={{ color: "#A1A1AA" }}>Connecting to server…</span>
                </>
              )}
              {serverReady === "ready" && (
                <>
                  <span style={{ color: "#059669", fontSize: 13 }}>●</span>
                  <span style={{ color: "#059669", fontWeight: 600 }}>Server ready</span>
                </>
              )}
              {serverReady === "slow" && (
                <>
                  <span style={{ color: "#D97706", fontSize: 13 }}>●</span>
                  <span style={{ color: "#D97706" }}>Server is slow — sign in anyway</span>
                </>
              )}
            </div>

            <div className="login-footer" style={{ marginTop: 10 }}>
              AI for Bharat · 2026 · Theme 1
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
