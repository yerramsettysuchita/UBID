'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --ink:#18181B;
  --ink2:#52525B;
  --ink3:#A1A1AA;
  --bg:#FFFFFF;
  --bg2:#F9FAFB;
  --bg3:#F0F2FC;
  --indigo:#4F46E5;
  --indigo2:#6366F1;
  --indigo3:#818CF8;
  --indigo-lt:#EEF2FF;
  --emerald:#059669;
  --amber:#D97706;
  --red:#DC2626;
  --border:rgba(79,70,229,0.12);
  --border-gray:#E4E4E7;
  --shadow:0 1px 3px rgba(0,0,0,0.06),0 4px 16px rgba(79,70,229,0.06);
  --shadow-lg:0 8px 32px rgba(79,70,229,0.12),0 2px 8px rgba(0,0,0,0.05);
}
html{scroll-behavior:smooth;}
body{
  font-family:'Poppins',sans-serif;
  background:var(--bg);
  color:var(--ink);
  overflow-x:hidden;
  -webkit-font-smoothing:antialiased;
}
em{font-style:normal;}
a{text-decoration:none;color:inherit;}

/* NAV */
#lp-nav{
  position:fixed;top:0;left:0;right:0;z-index:200;
  height:64px;padding:0 56px;
  display:flex;align-items:center;justify-content:space-between;
  transition:background 0.3s,box-shadow 0.3s;
}
#lp-nav.stuck{
  background:rgba(255,255,255,0.94);
  backdrop-filter:blur(16px);
  box-shadow:0 1px 0 var(--border-gray);
}
.nav-logo{display:flex;align-items:center;gap:10px;}
.nav-logo-mark{
  width:34px;height:34px;border-radius:8px;
  background:linear-gradient(135deg,var(--indigo),var(--indigo3));
  display:flex;align-items:center;justify-content:center;
  font-weight:700;font-size:15px;color:#fff;
  box-shadow:0 3px 10px rgba(79,70,229,0.3);
}
.nav-logo-name{font-size:17px;font-weight:600;color:var(--ink);}
.nav-links{display:flex;gap:32px;}
.nav-links a{font-size:13px;font-weight:500;color:var(--ink2);transition:color 0.15s;}
.nav-links a:hover{color:var(--indigo);}
.nav-cta{
  background:var(--indigo);color:#fff;
  border-radius:100px;padding:9px 24px;
  font-size:13px;font-weight:600;
  box-shadow:0 3px 12px rgba(79,70,229,0.28);
  transition:all 0.2s;display:inline-block;
}
.nav-cta:hover{background:#4338CA;transform:translateY(-1px);box-shadow:0 6px 20px rgba(79,70,229,0.36);}

/* HERO */
#lp-hero{
  position:relative;min-height:100vh;
  display:flex;flex-direction:column;
  align-items:center;justify-content:center;
  text-align:center;padding:120px 56px 80px;
  overflow:hidden;background:var(--bg);
}
#lp-canvas{position:absolute;inset:0;pointer-events:none;z-index:1;}
.hero-blob{position:absolute;pointer-events:none;border-radius:50%;filter:blur(90px);}
.blob-a{width:560px;height:560px;background:rgba(99,102,241,0.10);top:-100px;right:-80px;animation:drift 14s ease-in-out infinite alternate;}
.blob-b{width:400px;height:400px;background:rgba(167,139,250,0.10);bottom:-80px;left:5%;animation:drift 10s ease-in-out infinite alternate-reverse;}
@keyframes drift{0%{transform:translate(0,0);}100%{transform:translate(24px,-18px);}}
.hero-inner{position:relative;z-index:2;max-width:780px;margin:0 auto;}
.hero-eyebrow{
  display:inline-flex;align-items:center;gap:8px;
  background:var(--indigo-lt);border:1px solid var(--border);
  border-radius:100px;padding:6px 18px;
  font-size:11px;font-weight:600;letter-spacing:0.08em;
  text-transform:uppercase;color:var(--indigo);
  margin-bottom:32px;
}
.eyebrow-dot{
  width:5px;height:5px;border-radius:50%;
  background:var(--indigo2);animation:blink 2s infinite;
}
@keyframes blink{0%,100%{opacity:1;}50%{opacity:0.3;}}
.hero-h1{
  font-size:clamp(44px,6vw,82px);
  font-weight:800;line-height:1.06;
  letter-spacing:-0.03em;color:var(--ink);
  margin-bottom:22px;
}
.hero-h1 .grad{
  background:linear-gradient(135deg,var(--indigo),var(--indigo3));
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;
  background-clip:text;
}
.hero-h1 .amber{color:var(--amber);}
.hero-sub{
  font-size:20px;font-weight:400;color:var(--ink2);
  line-height:1.75;max-width:600px;margin:0 auto 40px;
}
.hero-cta{
  display:inline-block;
  background:var(--indigo);color:#fff;
  border-radius:12px;padding:16px 44px;
  font-size:15px;font-weight:600;
  box-shadow:0 6px 24px rgba(79,70,229,0.32);
  transition:all 0.2s;
}
.hero-cta:hover{background:#4338CA;transform:translateY(-2px);box-shadow:0 10px 32px rgba(79,70,229,0.42);}

/* Stats strip */
.hero-stats{
  position:relative;z-index:2;
  display:flex;justify-content:center;
  margin-top:72px;width:100%;
  border-top:1px solid var(--border-gray);
  border-bottom:1px solid var(--border-gray);
  padding:28px 0;
}
.stat-item{
  flex:1;max-width:180px;text-align:center;
  padding:0 32px;border-right:1px solid var(--border-gray);
}
.stat-item:last-child{border-right:none;}
.stat-num{
  font-size:42px;font-weight:800;color:var(--ink);
  line-height:1;letter-spacing:-0.03em;margin-bottom:5px;
}
.stat-num span{color:var(--indigo2);}
.stat-lbl{font-size:11px;font-weight:500;color:var(--ink3);text-transform:uppercase;letter-spacing:0.07em;}

/* Scroll hint */
.scroll-hint{
  position:absolute;bottom:36px;left:50%;transform:translateX(-50%);
  z-index:2;display:flex;flex-direction:column;align-items:center;gap:8px;
  font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:var(--ink3);
  animation:bob 2.4s ease-in-out infinite;
}
@keyframes bob{0%,100%{transform:translateX(-50%) translateY(0);}50%{transform:translateX(-50%) translateY(-5px);}}
.scroll-line{width:1px;height:36px;background:linear-gradient(to bottom,var(--indigo2),transparent);}

/* SECTIONS */
.lp-section{padding:100px 0;}
.lp-container{max-width:1080px;margin:0 auto;padding:0 56px;}
.section-label{
  display:flex;align-items:center;gap:10px;
  font-size:10px;font-weight:700;letter-spacing:0.14em;
  text-transform:uppercase;color:var(--indigo);margin-bottom:18px;
}
.section-label::before{content:'';width:22px;height:1.5px;background:var(--indigo);border-radius:2px;}
.section-h2{
  font-size:clamp(32px,3.8vw,50px);font-weight:800;
  line-height:1.1;letter-spacing:-0.025em;
  color:var(--ink);margin-bottom:14px;
}
.section-h2 em{
  font-weight:800;font-style:normal;
  background:linear-gradient(135deg,var(--indigo),var(--indigo3));
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;
  background-clip:text;
}
.section-desc{
  font-size:18px;font-weight:400;color:var(--ink2);
  line-height:1.8;max-width:560px;
}
.glow-line{
  height:1px;
  background:linear-gradient(90deg,transparent,rgba(79,70,229,0.18),transparent);
}

/* PROBLEM */
#lp-problem{background:var(--bg2);}
.problem-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:56px;}
.problem-card{
  background:#fff;border-radius:16px;
  border:1px solid var(--border-gray);
  border-top:3px solid;
  padding:36px 30px;
  box-shadow:var(--shadow);
  transition:transform 0.22s,box-shadow 0.22s;
}
.problem-card:hover{transform:translateY(-4px);box-shadow:var(--shadow-lg);}
.problem-card:nth-child(1){border-top-color:var(--red);}
.problem-card:nth-child(2){border-top-color:var(--amber);}
.problem-card:nth-child(3){border-top-color:var(--indigo2);}
.problem-num{
  font-size:64px;font-weight:800;letter-spacing:-0.04em;
  line-height:1;margin-bottom:18px;
}
.problem-card:nth-child(1) .problem-num{
  background:linear-gradient(135deg,var(--red),#F87171);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
}
.problem-card:nth-child(2) .problem-num{
  background:linear-gradient(135deg,var(--amber),#FCD34D);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
}
.problem-card:nth-child(3) .problem-num{
  background:linear-gradient(135deg,var(--indigo),var(--indigo3));
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
}
.problem-title{font-size:16px;font-weight:700;color:var(--ink);margin-bottom:10px;}
.problem-body{font-size:13.5px;font-weight:400;color:var(--ink2);line-height:1.8;}

/* SOLUTION */
#lp-solution{background:var(--bg);}
.solution-grid{display:grid;grid-template-columns:1fr 1fr;gap:72px;align-items:start;margin-top:60px;}
.sol-features{display:flex;flex-direction:column;}
.sol-feature{
  display:flex;gap:18px;align-items:flex-start;
  padding:24px 0;border-bottom:1px solid var(--border-gray);
  transition:padding-left 0.25s;
}
.sol-feature:first-child{padding-top:0;}
.sol-feature:last-child{border-bottom:none;}
.sol-feature:hover{padding-left:6px;}
.sol-icon{
  width:40px;height:40px;border-radius:10px;flex-shrink:0;
  display:flex;align-items:center;justify-content:center;
  font-size:18px;border:1px solid var(--border-gray);
  background:var(--bg2);
}
.sol-title{font-size:14px;font-weight:700;color:var(--ink);margin-bottom:6px;}
.sol-body{font-size:15px;font-weight:400;color:var(--ink2);line-height:1.75;}

/* Pipeline card — light */
.pipeline-card{
  background:#fff;border-radius:16px;
  border:1px solid var(--border-gray);
  border-top:3px solid var(--indigo);
  box-shadow:var(--shadow);
  padding:28px;
  position:sticky;top:90px;
}
.pipeline-header{
  display:flex;align-items:center;justify-content:space-between;
  margin-bottom:22px;padding-bottom:16px;
  border-bottom:1px solid var(--border-gray);
}
.pipeline-header-title{font-size:12px;font-weight:700;color:var(--ink2);text-transform:uppercase;letter-spacing:0.08em;}
.pipeline-live{display:flex;align-items:center;gap:6px;font-size:10px;font-weight:600;color:var(--emerald);}
.live-dot{width:5px;height:5px;border-radius:50%;background:var(--emerald);animation:blink 1.5s infinite;}
.pip-steps{display:flex;flex-direction:column;}
.pip-step{
  display:flex;gap:13px;align-items:flex-start;
  padding:13px 0;border-bottom:1px solid var(--border-gray);
}
.pip-step:last-child{border-bottom:none;}
.pip-badge{
  width:10px;height:10px;border-radius:50%;flex-shrink:0;margin-top:5px;
  background:var(--border);border:1.5px solid var(--border);
}
.pip-step.active .pip-badge{
  background:var(--indigo);border-color:var(--indigo);
  box-shadow:0 0 8px rgba(79,70,229,0.4);
}
.pip-name{font-size:14px;font-weight:600;color:var(--ink);margin-bottom:4px;}
.pip-desc{font-size:13px;font-weight:400;color:var(--ink2);line-height:1.6;}
.pip-time{
  margin-left:auto;font-family:'JetBrains Mono',monospace;
  font-size:9.5px;color:var(--indigo);font-weight:600;
  white-space:nowrap;flex-shrink:0;
}
.thresh-wrap{
  margin-top:18px;padding:14px;
  background:var(--bg2);border:1px solid var(--border-gray);border-radius:10px;
}
.thresh-label{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--ink3);margin-bottom:10px;}
.thresh-track{height:6px;background:var(--bg3);border-radius:4px;overflow:visible;position:relative;}
.thresh-fill{
  position:absolute;inset:0;border-radius:4px;
  background:linear-gradient(90deg,var(--red),var(--amber) 50%,var(--emerald) 85%);
}
.thresh-pin{position:absolute;top:-3px;bottom:-3px;width:2px;background:#fff;border-radius:2px;box-shadow:0 0 4px rgba(0,0,0,0.12);}
.thresh-ticks{display:flex;justify-content:space-between;margin-top:8px;font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--ink3);}
.conf-badges{display:flex;gap:6px;margin-top:12px;flex-wrap:wrap;}
.conf-badge{font-size:10px;font-weight:600;padding:3px 10px;border-radius:100px;}

/* ROLES */
#lp-roles{background:var(--bg2);}
.roles-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-top:56px;}
.role-card{
  background:#fff;border-radius:14px;
  border:1px solid var(--border-gray);
  padding:24px 18px;
  box-shadow:var(--shadow);
  transition:transform 0.22s,box-shadow 0.22s;
  display:flex;flex-direction:column;
}
.role-card:hover{transform:translateY(-4px);box-shadow:var(--shadow-lg);}
.role-avatar{
  width:44px;height:44px;border-radius:11px;
  display:flex;align-items:center;justify-content:center;
  font-size:20px;margin-bottom:14px;
  background:var(--bg2);border:1px solid var(--border-gray);
}
.role-name{font-size:14px;font-weight:700;color:var(--ink);margin-bottom:8px;}
.role-desc{font-size:12px;font-weight:400;color:var(--ink2);line-height:1.7;}


/* STACK */
#lp-stack{background:var(--bg);}
.stack-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:56px;}
.stack-col{
  background:#fff;border-radius:16px;
  border:1px solid var(--border-gray);
  padding:28px 24px;box-shadow:var(--shadow);
}
.stack-col-head{
  display:flex;align-items:center;gap:10px;
  margin-bottom:18px;padding-bottom:14px;
  border-bottom:1px solid var(--border-gray);
}
.stack-col-icon{
  width:32px;height:32px;border-radius:8px;
  background:var(--indigo-lt);border:1px solid var(--border);
  display:flex;align-items:center;justify-content:center;font-size:15px;
}
.stack-col-title{font-size:12.5px;font-weight:700;color:var(--ink);}
.stack-items{display:flex;flex-direction:column;gap:8px;}
.stack-item{
  display:flex;align-items:center;gap:10px;
  padding:9px 12px;border-radius:8px;
  background:var(--bg2);border:1px solid var(--border-gray);
  transition:all 0.15s;
}
.stack-item:hover{border-color:var(--border);background:var(--indigo-lt);}
.stack-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}
.stack-name{font-size:12px;font-weight:500;color:var(--ink2);}
.stack-role{font-size:10.5px;color:var(--ink3);margin-left:auto;font-family:'JetBrains Mono',monospace;}

/* CTA */
#lp-cta{
  padding:110px 56px;background:var(--bg2);
  text-align:center;position:relative;overflow:hidden;
}
.cta-blob-a{position:absolute;pointer-events:none;border-radius:50%;filter:blur(100px);width:500px;height:500px;background:rgba(99,102,241,0.09);top:-100px;left:-80px;}
.cta-blob-b{position:absolute;pointer-events:none;border-radius:50%;filter:blur(100px);width:400px;height:400px;background:rgba(167,139,250,0.07);bottom:-80px;right:-60px;}
.cta-h2{
  font-size:clamp(36px,4.5vw,62px);font-weight:800;
  letter-spacing:-0.03em;line-height:1.08;color:var(--ink);
  margin-bottom:16px;position:relative;z-index:1;
}
.cta-h2 em{
  font-style:normal;
  background:linear-gradient(135deg,var(--indigo),var(--indigo3));
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
}
.cta-sub{
  font-size:16px;font-weight:400;color:var(--ink2);
  line-height:1.8;max-width:460px;
  margin:0 auto 36px;position:relative;z-index:1;
}
.cta-btn{
  display:inline-block;position:relative;z-index:1;
  background:var(--indigo);color:#fff;
  border-radius:12px;padding:16px 44px;
  font-size:15px;font-weight:600;
  box-shadow:0 6px 24px rgba(79,70,229,0.30);
  transition:all 0.2s;
}
.cta-btn:hover{background:#4338CA;transform:translateY(-2px);box-shadow:0 10px 32px rgba(79,70,229,0.40);}

/* FOOTER */
#lp-footer{
  background:#0D0D1A;
  border-top:1px solid rgba(255,255,255,0.06);
  padding:36px 56px;
  display:flex;align-items:center;justify-content:space-between;
}
.footer-logo-wrap{display:flex;align-items:center;gap:11px;}
.footer-logo-name{font-size:16px;font-weight:600;color:#fff;}
.footer-tagline{font-size:11px;color:rgba(255,255,255,0.3);font-weight:400;margin-top:2px;}
.footer-links{display:flex;gap:24px;align-items:center;}
.footer-link{font-size:12px;color:rgba(255,255,255,0.35);transition:color 0.15s;font-family:'JetBrains Mono',monospace;}
.footer-link:hover{color:var(--indigo3);}

/* REVEAL */
.reveal{opacity:0;transform:translateY(22px);transition:opacity 0.6s cubic-bezier(0.16,1,0.3,1),transform 0.6s cubic-bezier(0.16,1,0.3,1);}
.reveal.visible{opacity:1;transform:none;}
.d1{transition-delay:0.08s;}.d2{transition-delay:0.16s;}.d3{transition-delay:0.24s;}.d4{transition-delay:0.32s;}.d5{transition-delay:0.40s;}

/* RESPONSIVE */
@media(max-width:900px){
  #lp-nav{padding:0 24px;}
  .lp-container{padding:0 24px;}
  .hero-h1{font-size:40px;}
  .problem-grid{grid-template-columns:1fr;}
  .solution-grid{grid-template-columns:1fr;}
  .roles-grid{grid-template-columns:1fr 1fr;}
  .stats-row{grid-template-columns:1fr 1fr;}
  .stat-block{border-right:none;border-bottom:1px solid rgba(255,255,255,0.08);padding:20px 0;}
  .stack-grid{grid-template-columns:1fr;}
  #lp-footer{flex-direction:column;gap:18px;text-align:center;}
  .hero-stats{flex-wrap:wrap;}
  .stat-item{border-right:none;border-bottom:1px solid var(--border-gray);}
}
`;

export default function LandingPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Cursor body style
    document.body.style.cursor = 'default';

    // Nav scroll
    const nav = document.getElementById('lp-nav');
    const onScroll = () => nav?.classList.toggle('stuck', window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });

    // Counters
    function countUp(id: string, target: number, ms = 1800) {
      const el = document.getElementById(id);
      if (!el) return;
      let start: number | null = null;
      const tick = (ts: number) => {
        if (!start) start = ts;
        const p = Math.min((ts - start) / ms, 1);
        const ease = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(ease * target).toString();
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
    const t = setTimeout(() => {
      countUp('c-depts', 40, 1600);
      countUp('c-ubids', 344, 2000);
      countUp('c-prec', 95, 1500);
      countUp('c-time', 30, 1200);
    }, 500);

    // Scroll reveal
    const obs = new IntersectionObserver(
      (entries) => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }),
      { threshold: 0.10 }
    );
    document.querySelectorAll('.reveal').forEach(el => obs.observe(el));

    // Three.js subtle background
    const canvas = canvasRef.current;
    let animId: number;
    if (canvas) {
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
      camera.position.z = 26;

      const onResize = () => {
        renderer.setSize(window.innerWidth, window.innerHeight);
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
      };
      onResize();
      window.addEventListener('resize', onResize);

      const group = new THREE.Group();
      scene.add(group);
      const colors = [0x4F46E5, 0x6366F1, 0x818CF8, 0xA78BFA];
      const nodes: THREE.Mesh[] = [];

      for (let i = 0; i < 50; i++) {
        const geo = new THREE.SphereGeometry(Math.random() * 0.14 + 0.04, 8, 8);
        const mat = new THREE.MeshBasicMaterial({
          color: colors[Math.floor(Math.random() * colors.length)],
          transparent: true,
          opacity: Math.random() * 0.14 + 0.04,
          wireframe: Math.random() > 0.55,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set((Math.random() - 0.5) * 46, (Math.random() - 0.5) * 28, (Math.random() - 0.5) * 18);
        mesh.userData['vx'] = (Math.random() - 0.5) * 0.009;
        mesh.userData['vy'] = (Math.random() - 0.5) * 0.007;
        mesh.userData['base'] = mat.opacity;
        group.add(mesh);
        nodes.push(mesh);
      }

      for (let i = 0; i < 25; i++) {
        const a = nodes[Math.floor(Math.random() * nodes.length)];
        const b = nodes[Math.floor(Math.random() * nodes.length)];
        const geo = new THREE.BufferGeometry().setFromPoints([a.position.clone(), b.position.clone()]);
        const mat = new THREE.LineBasicMaterial({ color: 0x6366F1, transparent: true, opacity: 0.04 });
        const line = new THREE.Line(geo, mat);
        line.userData['a'] = a; line.userData['b'] = b;
        group.add(line);
      }

      let mx = 0, my = 0, tick = 0;
      const onMouse = (e: MouseEvent) => {
        mx = (e.clientX / window.innerWidth - 0.5) * 1.5;
        my = -(e.clientY / window.innerHeight - 0.5) * 1.5;
      };
      document.addEventListener('mousemove', onMouse);

      const animate = () => {
        animId = requestAnimationFrame(animate);
        tick += 0.004;
        nodes.forEach(n => {
          n.position.x += n.userData['vx'];
          n.position.y += n.userData['vy'];
          if (Math.abs(n.position.x) > 24) n.userData['vx'] *= -1;
          if (Math.abs(n.position.y) > 15) n.userData['vy'] *= -1;
          (n.material as THREE.MeshBasicMaterial).opacity =
            n.userData['base'] + Math.sin(tick + n.position.x) * 0.025;
        });
        camera.position.x += (mx - camera.position.x) * 0.025;
        camera.position.y += (my - camera.position.y) * 0.025;
        group.rotation.y = tick * 0.018;
        renderer.render(scene, camera);
      };
      animate();

      return () => {
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onResize);
        document.removeEventListener('mousemove', onMouse);
        clearTimeout(t);
        obs.disconnect();
        cancelAnimationFrame(animId);
        renderer.dispose();
      };
    }

    return () => {
      window.removeEventListener('scroll', onScroll);
      clearTimeout(t);
      obs.disconnect();
    };
  }, []);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* NAV */}
      <nav id="lp-nav">
        <div className="nav-logo">
          <div className="nav-logo-mark">U</div>
          <span className="nav-logo-name">UBID Platform</span>
        </div>
        <div className="nav-links">
          <a href="#lp-problem">Problem</a>
          <a href="#lp-solution">How It Works</a>
          <a href="#lp-roles">Roles</a>
          <a href="#lp-stack">Stack</a>
        </div>
        <a href="/login" className="nav-cta">Open Platform</a>
      </nav>

      {/* HERO */}
      <section id="lp-hero">
        <canvas ref={canvasRef} id="lp-canvas" />
        <div className="hero-blob blob-a" />
        <div className="hero-blob blob-b" />

        <div className="hero-inner">
          <div className="hero-eyebrow">
            <span className="eyebrow-dot" />
            AI for Bharat · Hackathon 2026 · Theme 1
          </div>

          <h1 className="hero-h1">
            Know every<br />
            <span className="grad">business.</span><br />
            Know if it is<br />
            <span className="amber">still alive.</span>
          </h1>

          <p className="hero-sub">
            Karnataka has 40 government departments each keeping their own separate list of businesses. UBID connects them all into one place so you can find any business in seconds and know if it is still open.
          </p>

          <a href="/login" className="hero-cta">Open the Platform</a>
        </div>

        <div className="hero-stats">
          <div className="stat-item">
            <div className="stat-num"><span id="c-depts">0</span><span style={{ color: 'var(--indigo2)' }}>+</span></div>
            <div className="stat-lbl">Departments Unified</div>
          </div>
          <div className="stat-item">
            <div className="stat-num"><span id="c-ubids">0</span></div>
            <div className="stat-lbl">Businesses Resolved</div>
          </div>
          <div className="stat-item">
            <div className="stat-num"><span id="c-prec">0</span><span style={{ color: 'var(--indigo2)' }}>%</span></div>
            <div className="stat-lbl">AI Precision</div>
          </div>
          <div className="stat-item">
            <div className="stat-num"><span id="c-time">0</span><span style={{ color: 'var(--amber)', fontSize: 26 }}>s</span></div>
            <div className="stat-lbl">Full Resolution</div>
          </div>
        </div>

        <div className="scroll-hint">
          <div className="scroll-line" />
          Scroll to explore
        </div>
      </section>

      <div className="glow-line" />

      {/* PROBLEM */}
      <section id="lp-problem" className="lp-section">
        <div className="lp-container">
          <div className="reveal">
            <div className="section-label">The Problem</div>
            <h2 className="section-h2">Karnataka&apos;s government<br />is flying <em>blind.</em></h2>
            <p className="section-desc">
              The same business can appear as four different records across four departments with no way to tell which one is real or whether it is still operating.
            </p>
          </div>

          <div className="problem-grid">
            {[
              {
                num: '40+',
                title: 'Departments with No Shared ID',
                body: 'Officers have to log into 40 separate systems before issuing a single new license. Duplicates slip through every day and nobody even notices.',
              },
              {
                num: '0',
                title: 'Cross Department Activity Checks',
                body: 'Businesses closed years ago still show as Active because no one compared the registration data against electricity readings showing zero usage.',
              },
              {
                num: '₹??',
                title: 'Annual Fraud Left Undetected',
                body: 'A business marked dormant but still paying electricity bills every month is a clear fraud signal. It stays invisible because the data never gets combined.',
              },
            ].map((c, i) => (
              <div key={i} className={`problem-card reveal d${i + 1}`}>
                <div className="problem-num">{c.num}</div>
                <div className="problem-title">{c.title}</div>
                <div className="problem-body">{c.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="glow-line" />

      {/* SOLUTION */}
      <section id="lp-solution" className="lp-section">
        <div className="lp-container">
          <div className="reveal">
            <div className="section-label">The Solution</div>
            <h2 className="section-h2">One identifier.<br /><em>Every</em> business.</h2>
            <p className="section-desc">
              UBID sits on top of all existing Karnataka systems without replacing them. It links records, assigns a single ID and keeps the status current.
            </p>
          </div>

          <div className="solution-grid">
            <div className="sol-features reveal">
              {[
                {
                  icon: '⊛', bg: 'rgba(79,70,229,0.07)', border: 'rgba(79,70,229,0.15)',
                  title: 'Unified Business Identifier',
                  body: 'Every real Karnataka business gets one UBID no matter how many different names it has across 40 registries.',
                },
                {
                  icon: '⊕', bg: 'rgba(5,150,105,0.07)', border: 'rgba(5,150,105,0.15)',
                  title: 'Live Activity Status',
                  body: 'Active, Dormant or Closed status comes from real signals like electricity meter readings and inspection dates rather than manual self declaration.',
                },
                {
                  icon: '◈', bg: 'rgba(220,38,38,0.07)', border: 'rgba(220,38,38,0.15)',
                  title: 'Automatic Fraud Detection',
                  body: 'Dormant businesses with active electricity consumption and shared PAN numbers across entities are flagged automatically on every business file.',
                },
                {
                  icon: '◧', bg: 'rgba(217,119,6,0.07)', border: 'rgba(217,119,6,0.15)',
                  title: 'Human Review for Borderline Cases',
                  body: 'When the AI is not sure it sends the case to a human reviewer with a deadline. Every decision is recorded and auditable.',
                },
              ].map((f) => (
                <div key={f.title} className="sol-feature">
                  <div className="sol-icon" style={{ background: f.bg, borderColor: f.border }}>{f.icon}</div>
                  <div>
                    <div className="sol-title">{f.title}</div>
                    <div className="sol-body">{f.body}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="pipeline-card reveal d2">
              <div className="pipeline-header">
                <div className="pipeline-header-title">Entity Resolution Pipeline</div>
                <div className="pipeline-live"><span className="live-dot" />Running</div>
              </div>
              <div className="pip-steps">
                {[
                  { n: '1', name: 'Ingest', desc: 'Records from all departments are normalised into one common format.', time: 'under 1s', active: false },
                  { n: '2', name: 'Block', desc: 'Records are grouped by PAN, GSTIN and pincode to avoid comparing every record with every other.', time: 'under 1s', active: false },
                  { n: '3', name: 'Score', desc: 'Each pair of records gets a similarity score based on name, address and shared identifiers.', time: 'under 2s', active: true },
                  { n: '4', name: 'ML Refine', desc: 'A machine learning model reviews uncertain pairs and reaches 95% accuracy at the 0.85 threshold.', time: 'under 1s', active: false },
                  { n: '5', name: 'Link or Review', desc: 'High confidence pairs are linked automatically. Borderline ones go to a human reviewer.', time: 'instant', active: false },
                  { n: '6', name: 'Classify', desc: 'Each business gets an Active, Dormant or Closed status based on real department signals.', time: 'instant', active: false },
                ].map(s => (
                  <div key={s.n} className={`pip-step${s.active ? ' active' : ''}`}>
                    <div className="pip-badge" />
                    <div style={{ flex: 1 }}>
                      <div className="pip-name">{s.name}</div>
                      <div className="pip-desc">{s.desc}</div>
                    </div>
                    <div className="pip-time">{s.time}</div>
                  </div>
                ))}
              </div>
              <div className="thresh-wrap">
                <div className="thresh-label">Confidence Thresholds</div>
                <div className="thresh-track">
                  <div className="thresh-fill" />
                  <div className="thresh-pin" style={{ left: '50%' }} />
                  <div className="thresh-pin" style={{ left: '85%' }} />
                </div>
                <div className="thresh-ticks"><span>0.0</span><span>0.50</span><span>0.85</span><span>1.0</span></div>
                <div className="conf-badges">
                  <span className="conf-badge" style={{ background: '#FEF2F2', color: '#DC2626' }}>Below 0.50 Discard</span>
                  <span className="conf-badge" style={{ background: '#FFFBEB', color: '#92400E' }}>0.50 to 0.84 Human Review</span>
                  <span className="conf-badge" style={{ background: '#ECFDF5', color: '#059669' }}>0.85 and above Auto Link</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="glow-line" />

      {/* ROLES */}
      <section id="lp-roles" className="lp-section">
        <div className="lp-container">
          <div className="reveal">
            <div className="section-label">User Roles</div>
            <h2 className="section-h2">Five roles.<br /><em>One</em> platform.</h2>
            <p className="section-desc">
              Each person sees exactly what they need for their job. No more logging into 40 different government systems.
            </p>
          </div>

          <div className="roles-grid">
            {[
              { emoji: '🏛️', bg: '#EEF2FF', name: 'Field Officer', desc: 'Checks whether a business already exists before creating a new registration and gets an instant verdict.' },
              { emoji: '🔍', bg: '#F5F3FF', name: 'Reviewer', desc: 'Reviews the cases the AI flagged for human judgment. Sees both records side by side and decides if they are the same business.' },
              { emoji: '📊', bg: '#FFFBEB', name: 'Supervisor', desc: 'Monitors the whole registry in real time. Sees which districts have backlogs and gets alerted when review deadlines are missed.' },
              { emoji: '⚙️', bg: '#ECFDF5', name: 'Administrator', desc: 'Runs the AI engine, manages users and monitors system health. Has access to the full audit trail of every decision made.' },
              { emoji: '📋', bg: '#F8FAFC', name: 'Auditor', desc: 'Read only access to all reports and analytics. Can export compliance reports in formats that regulators accept.' },
            ].map((r, i) => (
              <div key={r.name} className={`role-card reveal d${i + 1}`}>
                <div className="role-avatar" style={{ background: r.bg }}>{r.emoji}</div>
                <div className="role-name">{r.name}</div>
                <div className="role-desc">{r.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* STACK */}
      <section id="lp-stack" className="lp-section">
        <div className="lp-container">
          <div className="reveal">
            <div className="section-label">Tech Stack</div>
            <h2 className="section-h2">Production grade.<br /><em>Zero</em> hand-wavy parts.</h2>
          </div>
          <div className="stack-grid reveal">
            {[
              {
                icon: '⚡', title: 'Frontend',
                items: [
                  { color: '#61DAFB', name: 'Next.js 14', role: 'App Router' },
                  { color: '#3178C6', name: 'TypeScript', role: 'strict mode' },
                  { color: '#6366F1', name: 'Three.js', role: '3D graphs' },
                  { color: '#22C55E', name: 'Recharts', role: 'dashboards' },
                  { color: '#F59E0B', name: 'TanStack Query', role: 'server state' },
                  { color: '#A78BFA', name: 'Zustand', role: 'auth state' },
                ],
              },
              {
                icon: '🗄️', title: 'Backend',
                items: [
                  { color: '#009688', name: 'FastAPI', role: 'Python 3.11' },
                  { color: '#336791', name: 'PostgreSQL 15', role: 'Neon Cloud' },
                  { color: '#DD0031', name: 'Redis 7', role: '60s cache' },
                  { color: '#F59E0B', name: 'SQLAlchemy 2.0', role: 'async ORM' },
                  { color: '#6366F1', name: 'JWT HS256', role: '5 role RBAC' },
                  { color: '#10B981', name: 'APScheduler', role: '6hr ingestion' },
                ],
              },
              {
                icon: '🧠', title: 'AI and ML',
                items: [
                  { color: '#FF6B6B', name: 'Jaro-Winkler', role: 'name similarity' },
                  { color: '#F59E0B', name: 'Jaccard', role: 'address overlap' },
                  { color: '#6366F1', name: 'GradientBoosting', role: 'ER classifier' },
                  { color: '#A78BFA', name: 'GradientBoosting', role: 'dormancy model' },
                  { color: '#10B981', name: 'Union Find', role: 'UBID clusters' },
                  { color: '#22C55E', name: 'pg trgm', role: 'fuzzy search' },
                ],
              },
            ].map((col) => (
              <div key={col.title} className="stack-col">
                <div className="stack-col-head">
                  <div className="stack-col-icon">{col.icon}</div>
                  <div className="stack-col-title">{col.title}</div>
                </div>
                <div className="stack-items">
                  {col.items.map((s, i) => (
                    <div key={i} className="stack-item">
                      <div className="stack-dot" style={{ background: s.color }} />
                      <div className="stack-name">{s.name}</div>
                      <div className="stack-role">{s.role}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="glow-line" />

      {/* CTA */}
      <section id="lp-cta">
        <div className="cta-blob-a" />
        <div className="cta-blob-b" />
        <h2 className="cta-h2 reveal">The registry is broken.<br /><em>We fixed it.</em></h2>
        <p className="cta-sub reveal d1">
          One search. One ID. Live status. Built entirely from data the Karnataka government already has.
        </p>
        <a href="/login" className="cta-btn reveal d2">Open the Platform</a>
      </section>

      {/* FOOTER */}
      <footer id="lp-footer">
        <div className="footer-logo-wrap">
          <div className="nav-logo-mark" style={{ width: 28, height: 28, fontSize: 13 }}>U</div>
          <div>
            <div className="footer-logo-name">UBID Platform</div>
            <div className="footer-tagline">Karnataka Commerce and Industry · AI for Bharat 2026 · Theme 1</div>
          </div>
        </div>
        <div className="footer-links">
          <a href="/login" className="footer-link">Live Demo</a>
          <a href="https://github.com/yerramsettysuchita/UBID" className="footer-link" target="_blank" rel="noopener noreferrer">GitHub</a>
          <a href="mailto:suchitayerramsetty999@gmail.com" className="footer-link">Contact</a>
          <span style={{ color: 'rgba(255,255,255,0.14)', fontSize: 11 }}>2026 UBID Team</span>
        </div>
      </footer>
    </>
  );
}
