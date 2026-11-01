import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const { gsap, ScrollTrigger } = window;
gsap.registerPlugin(ScrollTrigger);

const COLORS = { blue: 0x0057b8, cyan: 0x00b6ff, sky: 0x55d4ff, white: 0xeaf6ff };
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
const MOBILE_Q = window.matchMedia('(max-width: 900px)');
renderer.setPixelRatio(Math.min(window.devicePixelRatio, MOBILE_Q.matches ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.toneMapping = THREE.NoToneMapping; // jaga warna latar terang tetap cerah (ACES membuatnya abu-abu)

const scene = new THREE.Scene();
const BG = 0xeef6ff; // tema terang
scene.fog = new THREE.FogExp2(BG, 0.03);
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 0, 10);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

scene.add(new THREE.AmbientLight(0xcfe3ff, 0.6));
const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(5, 6, 8); scene.add(key);
const rimA = new THREE.PointLight(COLORS.cyan, 40, 30); rimA.position.set(-6, 3, 4); scene.add(rimA);
const rimB = new THREE.PointLight(COLORS.blue, 50, 30); rimB.position.set(6, -4, 3); scene.add(rimB);

// ---------- helpers ----------
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (t) => t * t * (3 - 2 * t);
function dotTexture() {
  // titik biru lembut (terlihat di latar terang, tanpa additive blending)
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(0,87,184,1)'); grd.addColorStop(0.35, 'rgba(10,155,240,.75)'); grd.addColorStop(1, 'rgba(10,155,240,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
const DOT = dotTexture();

// ---------- DNA helix ----------
const helix = new THREE.Group();
{
  const N = 90, H = 15, R = 1.5, TURNS = 3.2;
  const sphereGeo = new THREE.SphereGeometry(0.17, 24, 16);
  const sphereMat = new THREE.MeshPhysicalMaterial({ roughness: 0.15, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.1, emissive: 0x003366, emissiveIntensity: 0.4 });
  const spheres = new THREE.InstancedMesh(sphereGeo, sphereMat, N * 2);
  const rungGeo = new THREE.CylinderGeometry(0.04, 0.04, 1, 8);
  const rungMat = new THREE.MeshStandardMaterial({ color: 0x7cc8f5, emissive: COLORS.cyan, emissiveIntensity: 0.35, transparent: true, opacity: 0.7 });
  const rungs = new THREE.InstancedMesh(rungGeo, rungMat, N);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const cA = new THREE.Color(COLORS.blue).multiplyScalar(1.4), cB = new THREE.Color(COLORS.sky);
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1), y = (t - 0.5) * H, a = t * Math.PI * 2 * TURNS;
    const A = new THREE.Vector3(Math.cos(a) * R, y, Math.sin(a) * R);
    const B = new THREE.Vector3(Math.cos(a + Math.PI) * R, y, Math.sin(a + Math.PI) * R);
    m.makeTranslation(A.x, A.y, A.z); spheres.setMatrixAt(i * 2, m); spheres.setColorAt(i * 2, cA);
    m.makeTranslation(B.x, B.y, B.z); spheres.setMatrixAt(i * 2 + 1, m); spheres.setColorAt(i * 2 + 1, cB);
    const dir = B.clone().sub(A); const len = dir.length();
    q.setFromUnitVectors(up, dir.normalize());
    m.compose(A.clone().add(B).multiplyScalar(0.5), q, new THREE.Vector3(1, len, 1));
    rungs.setMatrixAt(i, m);
  }
  helix.add(spheres, rungs);
}
scene.add(helix);

// ---------- Product ring (4 categories) ----------
const products = new THREE.Group();
const ring = new THREE.Group();
products.add(ring);
const glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.04, transmission: 1, thickness: 0.6, ior: 1.45, clearcoat: 1, transparent: true, opacity: 1 });
const brandGloss = new THREE.MeshPhysicalMaterial({ color: COLORS.blue, roughness: 0.18, metalness: 0.2, clearcoat: 1, emissive: 0x002255, emissiveIntensity: 0.6 });
const chrome = new THREE.MeshStandardMaterial({ color: 0xcfe6ff, metalness: 1, roughness: 0.22 });
const glow = new THREE.MeshStandardMaterial({ color: COLORS.sky, emissive: COLORS.cyan, emissiveIntensity: 1.6, roughness: 0.3 });

function makeFlask() {
  const g = new THREE.Group();
  const pts = [[0, -1.1], [0.95, -1.1], [1.02, -1.0], [0.6, 0.1], [0.28, 0.45], [0.28, 1.15], [0.36, 1.22], [0.36, 1.3]].map(([x, y]) => new THREE.Vector2(x, y));
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 64), glass);
  const lpts = [[0, -1.02], [0.88, -1.02], [0.92, -0.95], [0.55, -0.1], [0, -0.1]].map(([x, y]) => new THREE.Vector2(x, y));
  const liquid = new THREE.Mesh(new THREE.LatheGeometry(lpts, 64), glow);
  g.add(body, liquid);
  return g;
}
function makeCapsule() {
  const geo = new THREE.CapsuleGeometry(0.45, 1.2, 12, 32);
  const pos = geo.attributes.position, colors = [];
  const cTop = new THREE.Color(COLORS.cyan), cBot = new THREE.Color(0xf4f9ff);
  for (let i = 0; i < pos.count; i++) { const c = pos.getY(i) > 0 ? cTop : cBot; colors.push(c.r, c.g, c.b); }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const mat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 });
  const g = new THREE.Group();
  const a = new THREE.Mesh(geo, mat); a.rotation.z = Math.PI / 4; a.position.set(-0.35, 0.2, 0);
  const b = new THREE.Mesh(geo, mat); b.rotation.z = -Math.PI / 5; b.rotation.x = 0.6; b.position.set(0.45, -0.25, 0.3); b.scale.setScalar(0.8);
  g.add(a, b);
  return g;
}
function makeShirt() {
  // Linen / apparel: a folded medical shirt silhouette
  const s = new THREE.Shape();
  s.moveTo(-0.35, 1); s.lineTo(-0.9, 0.85); s.lineTo(-1.35, 0.3); s.lineTo(-1.0, 0.0); s.lineTo(-0.75, 0.25);
  s.lineTo(-0.75, -1.05); s.lineTo(0.75, -1.05); s.lineTo(0.75, 0.25); s.lineTo(1.0, 0.0); s.lineTo(1.35, 0.3);
  s.lineTo(0.9, 0.85); s.lineTo(0.35, 1); s.quadraticCurveTo(0, 0.55, -0.35, 1);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.25, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 6, curveSegments: 24 });
  geo.center();
  const mat = new THREE.MeshPhysicalMaterial({ color: 0x2fb9ff, roughness: 0.55, sheen: 1, sheenColor: new THREE.Color(0xbfefff), sheenRoughness: 0.4 });
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, mat));
  // cross badge
  const cross = makeCrossGeo(0.14, 0.42, 0.06);
  const badge = new THREE.Mesh(cross, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.5 }));
  badge.position.set(0.38, 0.35, 0.22); g.add(badge);
  g.scale.setScalar(0.85);
  return g;
}
function makeCrossGeo(w, l, depth) {
  const s = new THREE.Shape();
  s.moveTo(-w, l); s.lineTo(w, l); s.lineTo(w, w); s.lineTo(l, w); s.lineTo(l, -w); s.lineTo(w, -w);
  s.lineTo(w, -l); s.lineTo(-w, -l); s.lineTo(-w, -w); s.lineTo(-l, -w); s.lineTo(-l, w); s.lineTo(-w, w); s.lineTo(-w, l);
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: depth * 0.4, bevelSize: w * 0.3, bevelSegments: 4 });
  geo.center();
  return geo;
}
function makeGear() {
  const teeth = 12, rO = 1.0, rI = 0.82, s = new THREE.Shape();
  for (let i = 0; i < teeth * 4; i++) {
    const a = (i / (teeth * 4)) * Math.PI * 2;
    const r = (i % 4 === 0 || i % 4 === 1) ? rO : rI;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    i === 0 ? s.moveTo(x, y) : s.lineTo(x, y);
  }
  const hole = new THREE.Path(); hole.absarc(0, 0, 0.32, 0, Math.PI * 2, true); s.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.04, bevelSegments: 3 });
  geo.center();
  const g = new THREE.Group();
  const big = new THREE.Mesh(geo, chrome);
  const small = new THREE.Mesh(geo, brandGloss); small.scale.setScalar(0.55); small.position.set(0.95, -0.75, 0.15);
  const cross = new THREE.Mesh(makeCrossGeo(0.1, 0.28, 0.1), glow); cross.position.z = 0.25;
  g.add(big, small, cross);
  g.userData.spin = [big, small];
  return g;
}
const items = [makeFlask(), makeCapsule(), makeShirt(), makeGear()];
const RING_R = 3.1;
items.forEach((it, k) => {
  const a = (k / items.length) * Math.PI * 2;
  const holder = new THREE.Group();
  holder.position.set(Math.sin(a) * RING_R, 0, Math.cos(a) * RING_R);
  holder.add(it);
  // glowing pedestal ring
  const halo = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.012, 8, 96), glow);
  halo.rotation.x = Math.PI / 2; halo.position.y = -1.45; holder.add(halo);
  holder.userData = { item: it, halo, scale: 1 };
  ring.add(holder);
});
products.visible = false;
scene.add(products);

// ---------- Molecule / shield network (Why) ----------
const network = new THREE.Group();
{
  const ico = new THREE.IcosahedronGeometry(2.4, 1);
  const lines = new THREE.LineSegments(new THREE.EdgesGeometry(ico), new THREE.LineBasicMaterial({ color: COLORS.blue, transparent: true, opacity: 0.45 }));
  const posAttr = ico.attributes.position, seen = new Map();
  for (let i = 0; i < posAttr.count; i++) {
    const k = `${posAttr.getX(i).toFixed(3)},${posAttr.getY(i).toFixed(3)},${posAttr.getZ(i).toFixed(3)}`;
    if (!seen.has(k)) seen.set(k, new THREE.Vector3(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i)));
  }
  const nodes = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 16, 12), glow, seen.size);
  const m = new THREE.Matrix4(); let i = 0;
  seen.forEach((v) => { m.makeTranslation(v.x, v.y, v.z); nodes.setMatrixAt(i++, m); });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 4), new THREE.MeshPhysicalMaterial({ color: COLORS.blue, roughness: 0.1, metalness: 0.3, clearcoat: 1, emissive: COLORS.blue, emissiveIntensity: 0.5 }));
  const coreCross = new THREE.Mesh(makeCrossGeo(0.22, 0.65, 0.2), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.2 }));
  coreCross.position.z = 1.15;
  const outer = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(3.4, 0)), new THREE.LineBasicMaterial({ color: COLORS.cyan, transparent: true, opacity: 0.4 }));
  network.add(lines, nodes, core, coreCross, outer);
  network.userData = { lines, outer, core, coreCross };
}
network.visible = false;
scene.add(network);

// ---------- Dotted globe (Partners) ----------
const globe = new THREE.Group();
{
  const count = 2600, pos = new Float32Array(count * 3), R = 3;
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2, r = Math.sqrt(1 - y * y), th = golden * i;
    pos.set([Math.cos(th) * r * R, y * R, Math.sin(th) * r * R], i * 3);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.075, map: DOT, transparent: true, opacity: 0.85, depthWrite: false, color: 0xffffff }));
  globe.add(pts);
  const orbits = [];
  for (let k = 0; k < 3; k++) {
    const o = new THREE.Group();
    const t = new THREE.Mesh(new THREE.TorusGeometry(3.6 + k * 0.45, 0.01, 8, 160), new THREE.MeshBasicMaterial({ color: k === 1 ? COLORS.cyan : COLORS.blue, transparent: true, opacity: 0.45 }));
    const sat = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), glow); sat.position.x = 3.6 + k * 0.45;
    o.add(t, sat); o.rotation.set(Math.PI / 2 + (k - 1) * 0.5, k * 0.7, 0);
    globe.add(o); orbits.push(o);
  }
  globe.userData.orbits = orbits;
}
globe.visible = false;
scene.add(globe);

// ---------- Light halo (Produk gallery floor) ----------
const halo = new THREE.Group();
{
  for (let k = 0; k < 3; k++) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(4.2 + k * 0.7, 0.015 + (k === 0 ? 0.01 : 0), 8, 200), new THREE.MeshBasicMaterial({ color: k === 0 ? COLORS.cyan : COLORS.blue, transparent: true, opacity: 0.75 - k * 0.2 }));
    t.rotation.x = Math.PI / 2; halo.add(t);
  }
  const disc = new THREE.Mesh(new THREE.CircleGeometry(4.2, 64), new THREE.MeshBasicMaterial({ color: COLORS.blue, transparent: true, opacity: 0.08, depthWrite: false }));
  disc.rotation.x = -Math.PI / 2; halo.add(disc);
}
halo.visible = false;
scene.add(halo);

// ---------- Ambient particles ----------
const particles = (() => {
  const count = MOBILE_Q.matches ? 800 : 1800, pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) pos.set([(Math.random() - 0.5) * 50, (Math.random() - 0.5) * 60, (Math.random() - 0.5) * 30 - 5], i * 3);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ size: 0.11, map: DOT, transparent: true, opacity: 0.35, depthWrite: false, color: 0xffffff }));
})();
scene.add(particles);

// ---------- Latar bermotif (shader) : bergerak, ikut scroll sampai bawah & mouse ----------
const bgUniforms = {
  uTime: { value: 0 }, uScroll: { value: 0 }, uSize: { value: new THREE.Vector2(innerWidth, innerHeight) },
  uMouse: { value: new THREE.Vector2(0, 0) },
  uC1: { value: new THREE.Color(0xfafdff) }, uC2: { value: new THREE.Color(0xd3e8ff) },
  uInk: { value: new THREE.Color(0x0a5fc4) }, uInk2: { value: new THREE.Color(0x1aa6ff) },
};
const bgMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
  uniforms: bgUniforms, depthTest: false, depthWrite: false, fog: false,
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }',
  fragmentShader: `
    precision highp float;
    varying vec2 vUv;
    uniform float uTime, uScroll; uniform vec2 uSize, uMouse;
    uniform vec3 uC1, uC2, uInk, uInk2;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float plusSdf(vec2 q, float w, float l){ vec2 a = abs(q); return min(max(a.x - l, a.y - w), max(a.y - l, a.x - w)); }
    mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
    void main(){
      vec2 pd = vec2(vUv.x, 1.0 - vUv.y) * uSize;       // piksel CSS, y ke bawah
      vec2 m = uMouse;                                   // -0.5 .. 0.5
      vec2 mp = (m + 0.5) * uSize;                       // posisi mouse (px)
      float S = uScroll;

      // dasar: gradasi bergelombang yang mengalir
      vec3 col = mix(uC1, uC2, 0.6); // dasar rata, tanpa bercak cahaya
      float glow = exp(-pow(length(pd - mp) / (0.32 * max(uSize.y, 500.0)), 2.0));
      col = mix(col, vec3(1.0), glow * 0.55);
      col += uInk2 * glow * 0.07;

      // tanda plus medis (lapisan tengah)
      {
        float cell = 68.0;
        vec2 pf = pd + vec2(uTime * 13.0, uTime * 8.0) + m * -190.0 + vec2(0.0, S * 0.28);
        vec2 id = floor(pf / cell);
        vec2 q = (fract(pf / cell) - 0.5) * cell;
        vec2 cpos = pd - q;
        float boost = exp(-pow(length(cpos - mp), 2.0) / (2.0 * 230.0 * 230.0));
        q = rot(boost * 1.6 + sin(uTime * 0.5 + id.x * 0.3) * 0.12) * q;
        float sz = (5.0 + 2.6 * sin(uTime * 1.3 + id.x * 0.7 + id.y * 1.3)) * (1.0 + boost * 1.9);
        float a = 1.0 - smoothstep(-1.0, 1.0, plusSdf(q, sz * 0.3, sz));
        col = mix(col, uInk, a * (0.16 + boost * 0.22));
      }

      // titik (lapisan dekat) -- paralaks paling ekstrem
      {
        float cell = 34.0;
        vec2 pf = pd + vec2(-uTime * 10.0, uTime * 6.0) + m * -380.0 + vec2(0.0, S * 0.55);
        vec2 id = floor(pf / cell);
        vec2 q = (fract(pf / cell) - 0.5) * cell;
        vec2 cpos = pd - q;
        float boost = exp(-pow(length(cpos - mp), 2.0) / (2.0 * 260.0 * 260.0));
        float keep = step(0.5, hash(id));
        float r = (1.5 + 1.2 * (0.5 + 0.5 * sin(uTime * 1.6 - length(id) * 0.4))) * (1.0 + boost * 2.6);
        float a = (1.0 - smoothstep(r - 1.0, r + 1.0, length(q))) * keep;
        col = mix(col, uInk2, a * (0.24 + boost * 0.3));
      }
      gl_FragColor = vec4(col, 1.0);
    }`,
}));
bgMesh.frustumCulled = false; bgMesh.renderOrder = -1000;
scene.add(bgMesh);

// ---------- Post-processing ----------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.18, 0.5, 0.92);
composer.addPass(bloom);
bloom.enabled = false; // tanpa halo cahaya
composer.addPass(new OutputPass());

// ---------- Scroll-driven keyframes ----------
// One keyframe per section. Values are interpolated by scroll position.
const KF = [
  /* 0 hero      */ { cam: [0, 0, 10], helix: [3.4, 0, 0, 0.28, 1], prod: [6, 0, 0], net: [0, 0, 0], globe: [0, -4, 0], halo: [0, -6, 0] },
  /* 1 stats     */ { cam: [0, 0, 11], helix: [-3.8, 0, 0, -0.4, 0.9], prod: [6, 0, 0], net: [0, 0, 0], globe: [0, -4, 0], halo: [0, -6, 0] },
  /* 2 layanan   */ { cam: [0, 0.6, 10], helix: [-8, 0, -3, -0.8, 0], prod: [3.2, -0.2, 1], net: [3, 0, 0], globe: [0, -4, 0], halo: [0, -6, 0] },
  /* 3 produk    */ { cam: [0, 1.2, 11], helix: [-8, 0, -6, 0, 0], prod: [7, 0, 0], net: [0, 0, 0], globe: [0, -4, 0], halo: [0, -2.9, 1] },
  /* 4 why       */ { cam: [0, 0, 11], helix: [-8, 0, -3, 0, 0], prod: [7, 0, 0], net: [0, 0, 1], globe: [0, -4, 0], halo: [0, -6, 0] },
  /* 5 partners  */ { cam: [0, 0, 11], helix: [0, -10, 0, 0, 0], prod: [7, 0, 0], net: [0, 4, 0], globe: [0, -0.8, 1], halo: [0, -6, 0] },
  /* 6 cta       */ { cam: [0, 0, 11], helix: [0, 0, -4, Math.PI / 2, 1.05], prod: [7, 0, 0], net: [0, 4, 0], globe: [0, 4, 0], halo: [0, -6, 0] },
  /* 7 footer    */ { cam: [0, 0.4, 12], helix: [0, 2.2, -3, Math.PI / 2, 1.1], prod: [7, 0, 0], net: [0, 4, 0], globe: [0, 4, 0], halo: [0, -6, 0] },
];
const flat = (k) => [...k.cam, ...k.helix, ...k.prod, ...k.net, ...k.globe, ...k.halo];
const KF_FLAT = KF.map(flat);
const sections = [...document.querySelectorAll('[data-scene]')];
let stops = []; // [{y, i}]
const ranges = {};

function computeStops() {
  const vh = window.innerHeight, max = document.documentElement.scrollHeight - vh;
  stops = [];
  sections.forEach((el) => {
    const i = +el.dataset.scene, top = el.offsetTop, h = el.offsetHeight;
    if (el.hasAttribute('data-sticky')) {
      stops.push({ y: top, i }, { y: top + h - vh, i });
      ranges[el.id] = [top, top + h - vh];
    } else {
      stops.push({ y: clamp(top + (h - vh) / 2, 0, max), i });
    }
  });
  stops.sort((a, b) => a.y - b.y);
}

function targetFromScroll(y) {
  if (y <= stops[0].y) return KF_FLAT[stops[0].i].slice();
  for (let s = 0; s < stops.length - 1; s++) {
    const a = stops[s], b = stops[s + 1];
    if (y <= b.y) {
      const t = b.y === a.y ? 1 : smooth(clamp((y - a.y) / (b.y - a.y)));
      return KF_FLAT[a.i].map((v, k) => lerp(v, KF_FLAT[b.i][k], t));
    }
  }
  return KF_FLAT[stops[stops.length - 1].i].slice();
}

let current = KF_FLAT[0].slice();
const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
let lastPointer = -1e9;
const COARSE = window.matchMedia('(pointer: coarse)'); // layar sentuh: boleh melayang sendiri; mouse: cahaya selalu menempel di kursor
window.addEventListener('pointermove', (e) => { mouse.tx = (e.clientX / window.innerWidth - 0.5); mouse.ty = (e.clientY / window.innerHeight - 0.5); lastPointer = performance.now(); });
document.addEventListener('pointerleave', () => { mouse.tx = 0; mouse.ty = 0; });

// Parallax DOM: elemen bergeser berlawanan dengan mouse (pakai properti `translate`, tidak bentrok dengan GSAP)
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const PARALLAX = [
  ['.hero .eyebrow', 36], ['.hero-title', 28], ['.hero-sub', 22], ['.hero-cta', 16],
  ['.eyebrow:not(.hero .eyebrow)', 30], ['h2', 26], ['.stat', 40], ['.layanan-copy .muted', 18], ['.cat-list', 14],
  ['.layanan-counter', 54], 
  ['.why-card', 38], ['.mitra-card', 34], ['.cta-card', 24], ['.footer-grid > div', 14],
].flatMap(([sel, d]) => [...document.querySelectorAll(sel)].map((el) => ({ el, d })));

// Layanan UI
const cats = [...document.querySelectorAll('.cat')];
const catIndex = document.getElementById('catIndex');
const catProgress = document.getElementById('catProgress');
let activeCat = 0, ringRot = 0, bgScroll = 0;
const gStage = document.querySelector('.gallery-stage');
function updateLayanan(y) {
  const p = clamp((y - ranges.layanan[0]) / (ranges.layanan[1] - ranges.layanan[0]));
  const r = clamp(p * 4 - 0.5, 0, 3);
  const base = Math.floor(r), f = r - base;
  const eased = base + smooth(clamp((f - 0.3) / 0.4));
  const idx = Math.min(3, Math.round(eased));
  if (idx !== activeCat) {
    activeCat = idx;
    cats.forEach((c, k) => c.classList.toggle('active', k === idx));
    catIndex.textContent = String(idx + 1).padStart(2, '0');
  }
  catProgress.style.width = `${p * 100}%`;
  return eased;
}

// Produk 3D gallery (CSS 3D ring driven by scroll)
const gRing = document.getElementById('galleryRing');
const gCards = [...gRing.children];
const gIndex = document.getElementById('gIndex'), gName = document.getElementById('gName'), gProgress = document.getElementById('gProgress');
const STEP = 360 / gCards.length;
let gRadius = 600, gRot = 0, gActive = -1;
function measureGallery() { gRadius = (gCards[0].offsetWidth / 2) / Math.tan(Math.PI / gCards.length) * 1.12; }
function updateGallery(y, dt) {
  const [a, b] = ranges.produk;
  const p = clamp((y - a) / (b - a));
  const r = clamp(p * gCards.length - 0.5, 0, gCards.length - 1);
  const base = Math.floor(r), eased = base + smooth(clamp((r - base - 0.25) / 0.5));
  gRot = lerp(gRot, -eased * STEP, 1 - Math.pow(0.0008, dt));
  gRing.style.transform = `translateZ(${-gRadius}px) rotateY(${gRot.toFixed(2)}deg)`;
  gCards.forEach((c, i) => {
    let rel = ((i * STEP + gRot) % 360 + 540) % 360 - 180;
    const d = Math.abs(rel), front = Math.max(0, 1 - d / STEP);
    c.style.transform = `rotateY(${i * STEP}deg) translateZ(${gRadius + front * 90}px)`;
    c.style.opacity = clamp(1.15 - d / 100).toFixed(3);
    c.style.filter = `brightness(${(0.78 + 0.22 * Math.max(front, 1 - d / 60 * 0.5)).toFixed(3)}) saturate(${(0.7 + 0.3 * front).toFixed(3)})`;
  });
  const idx = Math.min(gCards.length - 1, Math.round(eased));
  if (idx !== gActive) {
    gActive = idx;
    gIndex.textContent = String(idx + 1).padStart(2, '0');
    gName.textContent = gCards[idx].dataset.name;
  }
  gProgress.style.width = `${p * 100}%`;
}

const progressBar = document.getElementById('progressBar');
const clock = new THREE.Clock();
const isMobile = () => window.innerWidth < 900;

function applyVisibility(obj, s) { obj.visible = s > 0.01; obj.scale.setScalar(Math.max(s, 0.0001)); }

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  const idle = performance.now() - lastPointer > 2500;
  if (idle && (COARSE.matches || lastPointer < 0)) { mouse.tx = Math.sin(t * 0.45) * 0.28; mouse.ty = Math.cos(t * 0.37) * 0.2; } // melayang pelan saat tidak ada input (hanya sentuh)
  const y = window.scrollY, max = document.documentElement.scrollHeight - window.innerHeight;
  progressBar.style.width = `${(y / max) * 100}%`;

  const target = targetFromScroll(y);
  const k = 1 - Math.pow(0.0015, dt); // frame-rate independent smoothing
  current = current.map((v, i) => lerp(v, target[i], k));
  const [cx, cy, cz, hx, hy, hz, hrz, hs, px, py, ps, nx, ny, ns, gx, gy, gs, ax, ay, as] = current;
  const mob = isMobile(), xf = mob ? 0.12 : 1, zAdd = mob ? 5 : 0, ms = mob ? 0.6 : 1;

  // camera
  const mk = 1 - Math.pow(0.02, dt); mouse.x = lerp(mouse.x, mouse.tx, mk); mouse.y = lerp(mouse.y, mouse.ty, mk);
  const amp = mob ? 0.6 : 1;
  // kamera ikut mouse 3x; dimatikan saat objek 3D Layanan / ring Produk tampil (agar tidak pusing)
  const camW = 1 - clamp(Math.max(ps, as));
  camera.position.set(cx + mouse.x * 2.4 * amp * camW, cy - mouse.y * 1.8 * amp * camW, cz + zAdd);
  camera.lookAt(cx * 0.3, cy * 0.5, 0);

  // helix
  applyVisibility(helix, hs * ms);
  helix.position.set(hx * xf, hy + (mob ? 4 : 0), hz);
  helix.position.x += mouse.x * 3.2 * amp; helix.position.y -= mouse.y * 2.2 * amp;
  helix.rotation.z = hrz + mouse.x * 0.5;
  helix.rotation.x = mouse.y * 1.1 * amp;
  helix.rotation.y = t * 0.35 + y * 0.0015 + mouse.x * 2.2 * amp;

  // products ring
  const eased = updateLayanan(y);
  ringRot = lerp(ringRot, -eased * Math.PI / 2, 1 - Math.pow(0.0005, dt));
  applyVisibility(products, ps * (mob ? 0.95 : 1));
  products.position.set(px * xf, py + (mob ? 3.3 : 0), -1.2);
  products.rotation.x = 0.12;
  ring.rotation.y = ringRot;
  ring.children.forEach((h, idx) => {
    const isActive = idx === activeCat;
    h.userData.scale = lerp(h.userData.scale, isActive ? 1.1 : 0.42, 1 - Math.pow(0.002, dt));
    h.scale.setScalar(h.userData.scale);
    h.rotation.y = -ringRot; // keep facing camera
    const it = h.userData.item;
    it.rotation.y = t * (isActive ? 0.7 : 0.3);
    it.position.y = Math.sin(t * 1.4 + idx) * 0.12;
    if (it.userData.spin) { it.userData.spin[0].rotation.z = t * 0.6; it.userData.spin[1].rotation.z = -t * 1.1; }
  });

  // network
  applyVisibility(network, ns * ms);
  network.position.set(nx * xf, ny, -1);
  network.position.x += mouse.x * 2.6 * amp; network.position.y -= mouse.y * 1.8 * amp;
  network.rotation.y = t * 0.2 + y * 0.0008 + mouse.x * 2.6 * amp;
  network.rotation.x = Math.sin(t * 0.3) * 0.2 + mouse.y * 1.4 * amp;
  network.userData.outer.rotation.y = -t * 0.35;
  network.userData.coreCross.rotation.y = -network.rotation.y; // keep cross facing front
  network.userData.core.scale.setScalar(1 + Math.sin(t * 2) * 0.04);

  // globe
  applyVisibility(globe, gs * (mob ? 0.75 : 1));
  globe.position.set(gx * xf, gy, -1.5);
  globe.position.x += mouse.x * 2.2 * amp; globe.position.y -= mouse.y * 1.6 * amp;
  globe.rotation.y = t * 0.12 + y * 0.0006 + mouse.x * 2.4 * amp;
  globe.rotation.x = mouse.y * 1.1 * amp;
  globe.userData.orbits.forEach((o, i) => { o.rotation.z = t * (0.3 + i * 0.15); });

  // halo + gallery
  applyVisibility(halo, as * (mob ? 0.55 : 1));
  halo.position.set(ax, ay + (mob ? 0.8 : 0), -3);
  halo.rotation.y = t * 0.1;
  updateGallery(y, dt);

  // particles parallax
  particles.position.set(-mouse.x * 12 * amp, y * 0.004 + mouse.y * 8 * amp, 0);
  particles.rotation.y = t * 0.02 + mouse.x * 0.8 * amp;
  particles.rotation.x = mouse.y * 0.4 * amp;

  // latar bermotif
  bgScroll = lerp(bgScroll, y, 1 - Math.pow(0.004, dt));
  bgUniforms.uTime.value = t; bgUniforms.uScroll.value = bgScroll;
  bgUniforms.uSize.value.set(window.innerWidth, window.innerHeight);
  bgUniforms.uMouse.value.set(mouse.x, mouse.y);

  // parallax elemen halaman
  if (!REDUCED) {
    const k = mob ? 0.35 : 1;
    for (const p of PARALLAX) p.el.style.translate = `${(-mouse.x * p.d * 2 * k).toFixed(1)}px ${(-mouse.y * p.d * 2 * k).toFixed(1)}px`;
  }

  composer.render();
  requestAnimationFrame(tick);
}

let lastW = 0, lastH = 0;
function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  // abaikan perubahan tinggi kecil (address bar mobile naik/turun) agar tidak patah-patah
  if (lastW === w && Math.abs(lastH - h) < 140 && lastH) return;
  lastW = w; lastH = h;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MOBILE_Q.matches ? 1.5 : 2));
  camera.aspect = w / h;
  camera.fov = w < 900 ? 55 : 45;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  bloom.setSize(w, h);
  computeStops();
  measureGallery();
}
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', () => setTimeout(() => { lastH = 0; onResize(); }, 250));
onResize();
tick();

// ---------- Menu mobile ----------
const nav = document.querySelector('.nav');
const navToggle = document.querySelector('.nav-toggle');
function setNav(open) {
  nav.classList.toggle('open', open);
  navToggle.setAttribute('aria-expanded', open);
  navToggle.setAttribute('aria-label', open ? 'Tutup menu' : 'Buka menu');
}
navToggle.addEventListener('click', () => setNav(!nav.classList.contains('open')));
nav.querySelectorAll('nav a').forEach((a) => a.addEventListener('click', () => setNav(false)));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setNav(false); });
MOBILE_Q.addEventListener('change', () => setNav(false));

// ---------- DOM animations ----------
document.getElementById('year').textContent = new Date().getFullYear();
window.addEventListener('load', () => {
  computeStops();
  ScrollTrigger.refresh();
  document.getElementById('loader').classList.add('done');
  gsap.to('.hero-title .line > span', { y: 0, duration: 1.2, ease: 'power4.out', stagger: 0.1, delay: 0.3 });
  gsap.from('.hero .eyebrow, .hero-sub, .hero-cta', { opacity: 0, y: 30, duration: 1, ease: 'power3.out', stagger: 0.12, delay: 0.7 });
  gsap.from('.nav', { opacity: 0, y: -30, duration: 1, ease: 'power3.out', delay: 0.2 });
});

gsap.utils.toArray('[data-reveal]').forEach((el) => {
  gsap.to(el, {
    opacity: 1, y: 0, duration: 1, ease: 'power3.out',
    scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none reverse' },
  });
});

gsap.utils.toArray('[data-count]').forEach((el) => {
  const end = +el.dataset.count, suffix = el.dataset.suffix || '', obj = { v: 0 };
  gsap.to(obj, {
    v: end, duration: 2, ease: 'power2.out',
    scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none none' },
    onUpdate: () => { el.textContent = Math.round(obj.v) + suffix; },
  });
});

// Hero text drifts away as you scroll
gsap.to('.hero-copy', { y: -120, opacity: 0, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
