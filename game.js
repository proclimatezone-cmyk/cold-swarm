import * as THREE from 'three';

// ---------- config ----------
const Q = new URLSearchParams(location.search);
const P1 = Q.get('p1') || 'Отец', P2 = Q.get('p2') || 'Сын';
const TOUCH = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const CS = 4, H = 3.6, N = 13, W = N * 2 + 1;
const $ = id => document.getElementById(id);

$('ded').textContent = `Посвящается ${P1} и ${P2} — тем, кто когда-то проходил это вместе.`;
$('keys').textContent = TOUCH
  ? 'Левая половина экрана — движение · правая — обзор · кнопки справа'
  : 'WASD — движение · Мышь — обзор · ЛКМ — огонь · Q / ПКМ — сонар · E — действие · R — перезарядка · Shift — бег · геймпад поддерживается';

// ---------- renderer ----------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !TOUCH, powerPreference: 'high-performance' });
let PR = Math.min(devicePixelRatio, TOUCH ? 1.5 : 2);
renderer.setPixelRatio(PR);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x04070b);
scene.fog = new THREE.FogExp2(0x04070b, 0.075);
const camera = new THREE.PerspectiveCamera(72, 1, 0.05, 80);
scene.add(camera);
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

// ---------- procedural textures ----------
function rng(s) { return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function metalTex(base, seed, plates = 2, rust = 0.4) {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d'); const r = rng(seed);
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  const img = g.getImageData(0, 0, 512, 512), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (r() - .5) * 26; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(img, 0, 0);
  const s = 512 / plates;
  for (let y = 0; y < plates; y++) for (let x = 0; x < plates; x++) {
    g.strokeStyle = 'rgba(0,0,0,.65)'; g.lineWidth = 4; g.strokeRect(x * s + 2, y * s + 2, s - 4, s - 4);
    g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 2; g.strokeRect(x * s + 6, y * s + 6, s - 12, s - 12);
    g.fillStyle = 'rgba(0,0,0,.5)';
    for (const [a, b] of [[14, 14], [s - 14, 14], [14, s - 14], [s - 14, s - 14]]) { g.beginPath(); g.arc(x * s + a, y * s + b, 4, 0, 7); g.fill(); }
  }
  for (let i = 0; i < 18 * rust; i++) {
    const x = r() * 512, y = r() * 512, rad = 20 + r() * 70;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, 'rgba(70,40,20,.35)'); gr.addColorStop(1, 'rgba(70,40,20,0)'); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(0,0,0,${.15 + r() * .2})`; g.lineWidth = 1; const x = r() * 512; g.beginPath(); g.moveTo(x, r() * 512); g.lineTo(x + (r() - .5) * 6, r() * 512); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return t;
}
function plateTex(lines) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#1b2228'; g.fillRect(0, 0, 512, 256); g.strokeStyle = '#7d8a90'; g.lineWidth = 6; g.strokeRect(10, 10, 492, 236);
  g.fillStyle = '#c9d6db'; g.textAlign = 'center';
  lines.forEach((l, i) => { g.font = i ? '28px sans-serif' : 'bold 40px sans-serif'; g.fillText(l, 256, 80 + i * 52); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------- maze ----------
let grid, dead = [], startC, exitC, genCells;
function buildMaze() {
  grid = new Uint8Array(W * W).fill(1); const r = Math.random;
  const st = [[1, 1]]; grid[W + 1] = 0;
  while (st.length) {
    const [x, y] = st[st.length - 1];
    const nb = [[2, 0], [-2, 0], [0, 2], [0, -2]].map(([a, b]) => [x + a, y + b, x + a / 2, y + b / 2])
      .filter(([a, b]) => a > 0 && b > 0 && a < W - 1 && b < W - 1 && grid[b * W + a]);
    if (!nb.length) { st.pop(); continue; }
    const [a, b, mx, my] = nb[(r() * nb.length) | 0]; grid[my * W + mx] = 0; grid[b * W + a] = 0; st.push([a, b]);
  }
  // loops so you can flank / escape
  for (let i = 0; i < N * 3; i++) {
    const x = 1 + ((r() * (W - 2)) | 0), y = 1 + ((r() * (W - 2)) | 0);
    if (grid[y * W + x] && ((x % 2 === 1) !== (y % 2 === 1))) {
      if ((!grid[y * W + x - 1] && !grid[y * W + x + 1]) || (!grid[(y - 1) * W + x] && !grid[(y + 1) * W + x])) grid[y * W + x] = 0;
    }
  }
  startC = [1, 1];
  const df = bfs(1, 1);
  dead = [];
  let far = 0;
  for (let y = 1; y < W - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (grid[y * W + x]) continue;
    const open = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([a, b]) => !grid[(y + b) * W + x + a]).length;
    if (open === 1 && df[y * W + x] > 6) dead.push([x, y, df[y * W + x]]);
    if (df[y * W + x] > far) { far = df[y * W + x]; exitC = [x, y]; }
  }
  dead = dead.filter(([x, y]) => !(x === exitC[0] && y === exitC[1])).sort((a, b) => b[2] - a[2]);
  genCells = [];
  for (const d of dead) {
    if (genCells.every(g => Math.abs(g[0] - d[0]) + Math.abs(g[1] - d[1]) > W * 0.6)) genCells.push(d);
    if (genCells.length === 3) break;
  }
  for (const d of dead) { if (genCells.length >= 3) break; if (!genCells.includes(d)) genCells.push(d); }
}
function bfs(sx, sy) {
  const D = new Int16Array(W * W).fill(-1); const q = [sy * W + sx]; D[q[0]] = 0;
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % W, y = (i / W) | 0;
    for (const j of [i + 1, i - 1, i + W, i - W]) if (!grid[j] && D[j] < 0) { D[j] = D[i] + 1; q.push(j); }
  }
  return D;
}
const cellOf = v => Math.round(v / CS);
const isWall = (wx, wz) => { const x = cellOf(wx), z = cellOf(wz); return x < 0 || z < 0 || x >= W || z >= W || grid[z * W + x] === 1; };
function collide(pos, dx, dz, r) {
  const nx = pos.x + dx;
  if (!isWall(nx + Math.sign(dx) * r, pos.z - r * .7) && !isWall(nx + Math.sign(dx) * r, pos.z + r * .7)) pos.x = nx;
  const nz = pos.z + dz;
  if (!isWall(pos.x - r * .7, nz + Math.sign(dz) * r) && !isWall(pos.x + r * .7, nz + Math.sign(dz) * r)) pos.z = nz;
}

// ---------- world build ----------
const world = new THREE.Group(); scene.add(world);
const wallTex = metalTex('#3a4449', 7, 2, 0.6), floorTex = metalTex('#262b2e', 11, 4, 0.3), ceilTex = metalTex('#1c2125', 3, 2, 0.2);
const wallMat = new THREE.MeshLambertMaterial({ map: wallTex });
const floorMat = new THREE.MeshLambertMaterial({ map: floorTex });
const ceilMat = new THREE.MeshLambertMaterial({ map: ceilTex });
const stripRed = new THREE.MeshBasicMaterial({ color: 0xff3a1a });
const stripAmber = new THREE.MeshBasicMaterial({ color: 0xffa040 });
const generators = []; let exitMesh, exitLight;
const hemi = new THREE.HemisphereLight(0x2a3d52, 0x0a0806, 0.55); scene.add(hemi);

function buildWorld() {
  world.clear(); generators.length = 0;
  let cnt = 0; for (let i = 0; i < grid.length; i++) cnt += grid[i];
  const walls = new THREE.InstancedMesh(new THREE.BoxGeometry(CS, H, CS), wallMat, cnt);
  const m = new THREE.Matrix4(); let k = 0;
  const strips = [];
  for (let z = 0; z < W; z++) for (let x = 0; x < W; x++) if (grid[z * W + x]) {
    m.makeTranslation(x * CS, H / 2, z * CS); walls.setMatrixAt(k++, m);
    // emergency strips on wall faces that border corridors
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + a, nz = z + b;
      if (nx > 0 && nz > 0 && nx < W - 1 && nz < W - 1 && !grid[nz * W + nx] && ((x * 7 + z * 13 + a * 3) % 5 === 0)) strips.push([x, z, a, b]);
    }
  }
  world.add(walls);
  const sg = new THREE.BoxGeometry(1, 1, 1);
  const sR = new THREE.InstancedMesh(sg, stripRed, strips.length), sA = new THREE.InstancedMesh(sg, stripAmber, strips.length);
  let ra = 0, aa = 0;
  strips.forEach(([x, z, a, b], i) => {
    const px = x * CS + a * (CS / 2 + .02), pz = z * CS + b * (CS / 2 + .02);
    const sx = a ? .04 : 1.6, sz = b ? .04 : 1.6;
    const mm = new THREE.Matrix4().compose(new THREE.Vector3(px, i % 2 ? 0.25 : H - 0.3, pz), new THREE.Quaternion(), new THREE.Vector3(sx, .07, sz));
    if (i % 3) sR.setMatrixAt(ra++, mm); else sA.setMatrixAt(aa++, mm);
  });
  sR.count = ra; sA.count = aa; world.add(sR, sA);
  floorTex.repeat.set(W, W); ceilTex.repeat.set(W, W);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(W * CS, W * CS), floorMat); fl.rotation.x = -Math.PI / 2; fl.position.set((W - 1) * CS / 2, 0, (W - 1) * CS / 2);
  const ce = new THREE.Mesh(new THREE.PlaneGeometry(W * CS, W * CS), ceilMat); ce.rotation.x = Math.PI / 2; ce.position.set((W - 1) * CS / 2, H, (W - 1) * CS / 2);
  world.add(fl, ce);
  // pipes along ceiling
  const pipeG = new THREE.CylinderGeometry(.09, .09, CS, 8); const pipeM = new THREE.MeshLambertMaterial({ color: 0x4a5258 });
  let pc = 0; for (let i = 0; i < grid.length; i++) if (!grid[i]) pc++;
  const pipes = new THREE.InstancedMesh(pipeG, pipeM, pc); let pk = 0;
  for (let z = 1; z < W - 1; z++) for (let x = 1; x < W - 1; x++) if (!grid[z * W + x]) {
    const horiz = !grid[z * W + x - 1] || !grid[z * W + x + 1];
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(horiz ? 0 : Math.PI / 2, 0, horiz ? Math.PI / 2 : 0));
    pipes.setMatrixAt(pk++, new THREE.Matrix4().compose(new THREE.Vector3(x * CS + (horiz ? 0 : 1.3), H - .25, z * CS + (horiz ? 1.3 : 0)), q, new THREE.Vector3(1, 1, 1)));
  }
  pipes.count = pk; world.add(pipes);
  // dedication plate near start
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.6, .8), new THREE.MeshLambertMaterial({ map: plateTex(['ГЕЛИОС-7 · СЕКТОР А', `Смена: ${P1}`, `и ${P2}`]) }));
  placeOnWall(plate, startC[0], startC[1], 1.7); world.add(plate);
  // generators
  genCells.forEach(([x, z], i) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, .8), new THREE.MeshLambertMaterial({ color: 0x3b4650 }));
    body.position.y = .8;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(.8, .4), new THREE.MeshBasicMaterial({ color: 0xff3020 }));
    screen.position.set(0, 1.2, .41);
    const coil = new THREE.Mesh(new THREE.CylinderGeometry(.25, .25, 1.2, 12), new THREE.MeshBasicMaterial({ color: 0x401010 }));
    coil.position.set(.75, .6, 0);
    g.add(body, screen, coil);
    const light = new THREE.PointLight(0xff3020, 6, 9, 1.6); light.position.set(0, 2, .8); g.add(light);
    const [ox, oz] = openDir(x, z);
    g.position.set(x * CS - ox * 1.2, 0, z * CS - oz * 1.2); g.lookAt(x * CS + ox * 5, 0, z * CS + oz * 5);
    world.add(g); generators.push({ g, screen, coil, light, on: false, prog: 0, i });
  });
  // exit gate
  exitMesh = new THREE.Mesh(new THREE.TorusGeometry(1.2, .12, 8, 32), new THREE.MeshBasicMaterial({ color: 0x302020 }));
  exitMesh.position.set(exitC[0] * CS, 1.5, exitC[1] * CS);
  const [ex, ez] = openDir(exitC[0], exitC[1]); exitMesh.lookAt(exitMesh.position.x + ex, 1.5, exitMesh.position.z + ez);
  exitLight = new THREE.PointLight(0x40ff90, 0, 10, 1.5); exitLight.position.copy(exitMesh.position);
  world.add(exitMesh, exitLight);
}
function openDir(x, z) { for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!grid[(z + b) * W + x + a]) return [a, b]; return [1, 0]; }
function placeOnWall(mesh, x, z, y) {
  for (const [a, b] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) if (grid[(z + b) * W + x + a]) {
    mesh.position.set(x * CS + a * (CS / 2 - .02), y, z * CS + b * (CS / 2 - .02)); mesh.lookAt(x * CS, y, z * CS); return;
  }
}

// ---------- player ----------
const player = { pos: new THREE.Vector3(), yaw: 0, pitch: 0, hp: 100, lastHit: -9, ammo: 40, reloading: 0, fireCd: 0, bob: 0 };
const flash = new THREE.SpotLight(0xe6f0ff, 90, 30, Math.PI / 5.5, 0.5, 1.3);
flash.position.set(.2, -.1, 0); camera.add(flash); const ft = new THREE.Object3D(); ft.position.set(0, -.05, -1); camera.add(ft); flash.target = ft;
const muzzle = new THREE.PointLight(0xffc070, 0, 8, 1.5); muzzle.position.set(.3, -.2, -.9); camera.add(muzzle);
// gun model
const gun = new THREE.Group();
const gm = new THREE.MeshBasicMaterial({ color: 0x15191c }), gm2 = new THREE.MeshBasicMaterial({ color: 0x2a3136 });
const gb = new THREE.Mesh(new THREE.BoxGeometry(.09, .11, .55), gm); gb.position.z = -.1;
const gbar = new THREE.Mesh(new THREE.CylinderGeometry(.02, .025, .35, 8), gm2); gbar.rotation.x = Math.PI / 2; gbar.position.set(0, .02, -.5);
const gmag = new THREE.Mesh(new THREE.BoxGeometry(.06, .16, .1), gm2); gmag.position.set(0, -.11, -.05);
const glamp = new THREE.Mesh(new THREE.BoxGeometry(.035, .035, .03), new THREE.MeshBasicMaterial({ color: 0x9fe8ff })); glamp.position.set(.06, .04, -.37);
gun.add(gb, gbar, gmag, glamp); gun.position.set(.24, -.24, -.45); camera.add(gun);

// ---------- creatures: crystalline swarm ----------
const coreG = new THREE.OctahedronGeometry(.32, 0), shardG = new THREE.ConeGeometry(.08, .55, 4), legG = new THREE.ConeGeometry(.035, .8, 4);
const shellMat = new THREE.MeshLambertMaterial({ color: 0x1a2a33, emissive: 0x0a3040 });
const coreMat = new THREE.MeshBasicMaterial({ color: 0x5ff0ff });
const enemies = [];
function makeCreature() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const core = new THREE.Mesh(coreG, coreMat); core.scale.set(1, .7, 1.3); body.add(core);
  for (let i = 0; i < 9; i++) {
    const s = new THREE.Mesh(shardG, shellMat);
    const a = (i / 9) * Math.PI * 2; s.position.set(Math.cos(a) * .22, .12 + (i % 3) * .05, Math.sin(a) * .28);
    s.rotation.set(Math.sin(a) * .9, 0, -Math.cos(a) * .9 - .3); s.scale.setScalar(.8 + (i % 3) * .3); body.add(s);
  }
  const legs = [];
  for (let i = 0; i < 6; i++) {
    const l = new THREE.Mesh(legG, shellMat); const side = i < 3 ? 1 : -1, row = (i % 3) - 1;
    l.position.set(side * .3, -.15, row * .28); l.rotation.set(0, 0, side * 2.2); body.add(l); legs.push(l);
  }
  return { g, body, legs };
}
function spawn(minD = 12) {
  const D = bfs(cellOf(player.pos.x), cellOf(player.pos.z)); const c = [];
  for (let i = 0; i < D.length; i++) if (D[i] >= minD) c.push(i);
  if (!c.length) return; const i = c[(Math.random() * c.length) | 0];
  const cr = makeCreature(); cr.g.position.set((i % W) * CS, H - .35, ((i / W) | 0) * CS); scene.add(cr.g);
  enemies.push({ ...cr, hp: 4, alert: false, cd: 0, speed: 3 + Math.random() * 1.3, ceil: Math.random() < .65, t: Math.random() * 9, hurt: 0, wander: null, screamed: false });
}

// ---------- audio (synthesized, no files) ----------
let AC, master, nbuf;
function initAudio() {
  if (AC) { AC.resume(); return; }
  AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.gain.value = .7; master.connect(AC.destination);
  nbuf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate); const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180; const dg = AC.createGain(); dg.gain.value = .09; lp.connect(dg).connect(master);
  for (const f of [41, 41.6, 61.8]) { const o = AC.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start(); }
  const n = AC.createBufferSource(); n.buffer = nbuf; n.loop = true; const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = .6;
  const ng = AC.createGain(); ng.gain.value = .025; n.connect(bp).connect(ng).connect(master); n.start();
}
function env(node, t, a, peak, dec) { node.gain.setValueAtTime(0, t); node.gain.linearRampToValueAtTime(peak, t + a); node.gain.exponentialRampToValueAtTime(.0001, t + a + dec); }
function noise(dur, type, f, peak, dec, sweep) {
  if (!AC) return; const t = AC.currentTime; const s = AC.createBufferSource(); s.buffer = nbuf; s.playbackRate.value = .8 + Math.random() * .4;
  const fi = AC.createBiquadFilter(); fi.type = type; fi.frequency.setValueAtTime(f, t); if (sweep) fi.frequency.exponentialRampToValueAtTime(sweep, t + dur); fi.Q.value = 3;
  const g = AC.createGain(); env(g, t, .005, peak, dec); s.connect(fi).connect(g).connect(master); s.start(t, Math.random()); s.stop(t + dur + .1);
}
function tone(type, f1, f2, dur, peak) {
  if (!AC) return; const t = AC.currentTime; const o = AC.createOscillator(); o.type = type; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = AC.createGain(); env(g, t, .005, peak, dur); o.connect(g).connect(master); o.start(t); o.stop(t + dur + .05);
}
const sfx = {
  shot() { noise(.12, 'bandpass', 1800, .5, .1, 400); tone('square', 140, 50, .09, .25); },
  ping() { tone('sine', 1500, 800, .9, .25); setTimeout(() => tone('sine', 1500, 800, .6, .08), 220); },
  screech(v) { noise(.7, 'bandpass', 3500, .35 * v, .6, 700); tone('sawtooth', 520, 160, .6, .08 * v); },
  hit() { noise(.08, 'highpass', 3000, .25, .07); tone('triangle', 900, 300, .08, .12); },
  hurt() { tone('sine', 120, 40, .35, .6); noise(.2, 'lowpass', 600, .3, .2); },
  die() { noise(.5, 'bandpass', 5000, .3, .45, 1500); tone('sine', 2000, 200, .4, .1); },
  click() { tone('square', 800, 600, .04, .1); },
  power() { tone('sawtooth', 60, 240, 1.2, .2); tone('sine', 400, 1200, 1, .15); },
  step(v) { noise(.06, 'lowpass', 300, .12 * v, .05); },
};

// ---------- input ----------
const keys = {}; let mouseDown = false; const look = { x: 0, y: 0 };
const tin = { mx: 0, mz: 0, fire: false, use: false };
addEventListener('keydown', e => { keys[e.code] = true; if (e.code === 'KeyQ') doSonar(); if (e.code === 'KeyR') reload(); });
addEventListener('keyup', e => keys[e.code] = false);
addEventListener('mousedown', e => { if (state !== 'play') return; if (e.button === 0) mouseDown = true; if (e.button === 2) doSonar(); });
addEventListener('mouseup', e => { if (e.button === 0) mouseDown = false; });
addEventListener('contextmenu', e => e.preventDefault());
addEventListener('mousemove', e => { if (document.pointerLockElement === canvas) { look.x += e.movementX * .0022; look.y += e.movementY * .0022; } });
document.addEventListener('pointerlockchange', () => { if (!TOUCH && state === 'play' && document.pointerLockElement !== canvas) setPause(true); });

if (TOUCH) {
  const joy = $('joy'), base = $('joyBase'), knob = $('joyKnob'); let jid = null, jx = 0, jy = 0, lid = null, lx = 0, ly = 0;
  joy.addEventListener('touchstart', e => { const t = e.changedTouches[0]; jid = t.identifier; jx = t.clientX; jy = t.clientY; base.style.display = 'block'; base.style.left = jx - 60 + 'px'; base.style.top = jy - 60 + 'px'; e.preventDefault(); }, { passive: false });
  $('touch').addEventListener('touchstart', e => { for (const t of e.changedTouches) if (t.target === $('touch') && t.clientX > innerWidth / 2 && lid === null) { lid = t.identifier; lx = t.clientX; ly = t.clientY; } }, { passive: true });
  addEventListener('touchmove', e => {
    for (const t of e.changedTouches) {
      if (t.identifier === jid) { let dx = t.clientX - jx, dy = t.clientY - jy; const l = Math.hypot(dx, dy), mx = 50; if (l > mx) { dx *= mx / l; dy *= mx / l; } knob.style.left = 34 + dx + 'px'; knob.style.top = 34 + dy + 'px'; tin.mx = dx / mx; tin.mz = dy / mx; }
      if (t.identifier === lid) { look.x += (t.clientX - lx) * .0055; look.y += (t.clientY - ly) * .0055; lx = t.clientX; ly = t.clientY; }
    }
    e.preventDefault();
  }, { passive: false });
  const end = e => { for (const t of e.changedTouches) { if (t.identifier === jid) { jid = null; tin.mx = tin.mz = 0; base.style.display = 'none'; knob.style.left = knob.style.top = '34px'; } if (t.identifier === lid) lid = null; } };
  addEventListener('touchend', end); addEventListener('touchcancel', end);
  const btn = (id, down, up) => { const b = $(id); b.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); down(); }, { passive: false }); b.addEventListener('touchend', e => { e.preventDefault(); up && up(); }, { passive: false }); };
  btn('bFire', () => tin.fire = true, () => tin.fire = false);
  btn('bUse', () => tin.use = true, () => tin.use = false);
  btn('bSonar', doSonar); btn('bReload', reload);
}
let padPrev = {};
function readPad(dt) {
  const p = navigator.getGamepads ? [...navigator.getGamepads()].find(Boolean) : null; if (!p) return { mx: 0, mz: 0, fire: false, use: false, sprint: false };
  const dz = v => Math.abs(v) < .15 ? 0 : v;
  look.x += dz(p.axes[2] || 0) * 2.6 * dt; look.y += dz(p.axes[3] || 0) * 2.0 * dt;
  const b = i => p.buttons[i] && p.buttons[i].pressed;
  if (b(3) && !padPrev[3]) doSonar(); if (b(4) && !padPrev[4]) doSonar(); if (b(2) && !padPrev[2]) reload();
  if (b(9) && !padPrev[9]) setPause(state === 'play');
  padPrev = { 2: b(2), 3: b(3), 4: b(4), 9: b(9) };
  return { mx: dz(p.axes[0]), mz: dz(p.axes[1]), fire: b(7) || b(5), use: b(0), sprint: b(10) };
}

// ---------- actions ----------
let sonarT = -99, sonarCd = 0, blips = [];
const ring = new THREE.Mesh(new THREE.RingGeometry(.9, 1, 64), new THREE.MeshBasicMaterial({ color: 0x5fe0ff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
ring.rotation.x = -Math.PI / 2; scene.add(ring);
function doSonar() {
  if (state !== 'play' || sonarCd > 0) return; sonarCd = 3.5; sonarT = clock; sfx.ping();
  ring.position.set(player.pos.x, .05, player.pos.z);
  blips = enemies.map(e => ({ x: e.g.position.x, z: e.g.position.z }));
  makeNoise(14);
}
function reload() { if (state !== 'play' || player.reloading > 0 || player.ammo === 40) return; player.reloading = 1.5; sfx.click(); toast('ПЕРЕЗАРЯДКА'); }
function makeNoise(cells) {
  const D = distField; for (const e of enemies) { const i = cellOf(e.g.position.z) * W + cellOf(e.g.position.x); if (D && D[i] >= 0 && D[i] <= cells) alertE(e); }
}
function alertE(e) { if (!e.alert) { e.alert = true; if (!e.screamed) { e.screamed = true; const d = e.g.position.distanceTo(player.pos); sfx.screech(Math.max(.15, 1 - d / 30)); } } }
const ray = new THREE.Raycaster(); const tracerMat = new THREE.LineBasicMaterial({ color: 0xffd090, transparent: true });
const tracerGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]); const tracer = new THREE.Line(tracerGeo, tracerMat); tracer.frustumCulled = false; scene.add(tracer);
let tracerT = 0, recoil = 0;
function fire() {
  if (player.reloading > 0) return; if (player.ammo <= 0) { reload(); return; }
  player.ammo--; player.fireCd = .1; sfx.shot(); muzzle.intensity = 25; recoil = 1;
  const spread = .012; ray.setFromCamera(new THREE.Vector2((Math.random() - .5) * spread, (Math.random() - .5) * spread), camera); ray.far = 40;
  let wallD = 40; const dir = ray.ray.direction, o = ray.ray.origin;
  for (let t = 0; t < 40; t += .15) { const x = o.x + dir.x * t, y = o.y + dir.y * t, z = o.z + dir.z * t; if (y < 0 || y > H || isWall(x, z)) { wallD = t; break; } }
  const hits = ray.intersectObjects(enemies.map(e => e.g), true);
  let end = o.clone().addScaledVector(dir, wallD);
  if (hits.length && hits[0].distance < wallD) {
    end = hits[0].point; const e = enemies.find(en => { let p = hits[0].object; while (p) { if (p === en.g) return true; p = p.parent; } });
    if (e) { e.hp--; e.hurt = .12; alertE(e); sfx.hit(); if (e.hp <= 0) kill(e); }
  }
  const gp = new THREE.Vector3(.24, -.2, -.8).applyMatrix4(camera.matrixWorld);
  tracerGeo.attributes.position.setXYZ(0, gp.x, gp.y, gp.z); tracerGeo.attributes.position.setXYZ(1, end.x, end.y, end.z); tracerGeo.attributes.position.needsUpdate = true; tracerT = .05;
  makeNoise(9);
}
let kills = 0;
function kill(e) { sfx.die(); scene.remove(e.g); enemies.splice(enemies.indexOf(e), 1); kills++; spawnShards(e.g.position); }
const shardBits = []; const bitG = new THREE.TetrahedronGeometry(.07);
function spawnShards(p) { for (let i = 0; i < 10; i++) { const m = new THREE.Mesh(bitG, coreMat); m.position.copy(p); scene.add(m); shardBits.push({ m, v: new THREE.Vector3((Math.random() - .5) * 5, Math.random() * 4, (Math.random() - .5) * 5), t: .9 }); } }

// ---------- HUD ----------
const rc = $('radar').getContext('2d');
function drawRadar() {
  const R = 130; rc.clearRect(0, 0, 260, 260);
  rc.fillStyle = 'rgba(5,20,28,.55)'; rc.beginPath(); rc.arc(R, R, R - 4, 0, 7); rc.fill();
  rc.strokeStyle = 'rgba(95,224,255,.35)'; rc.lineWidth = 2; for (const r of [40, 80, 122]) { rc.beginPath(); rc.arc(R, R, r, 0, 7); rc.stroke(); }
  const age = clock - sonarT;
  if (age < 1.2) { rc.strokeStyle = `rgba(95,224,255,${1 - age / 1.2})`; rc.lineWidth = 4; rc.beginPath(); rc.arc(R, R, age / 1.2 * 122, 0, 7); rc.stroke(); }
  rc.fillStyle = '#9ff4ff'; rc.beginPath(); rc.moveTo(R, R - 9); rc.lineTo(R - 6, R + 6); rc.lineTo(R + 6, R + 6); rc.fill();
  if (age < 3.5) {
    const a = Math.max(0, 1 - age / 3.5), s = Math.sin(player.yaw), c = Math.cos(player.yaw);
    for (const b of blips) {
      const dx = b.x - player.pos.x, dz = b.z - player.pos.z;
      const rx = dx * c - dz * s, rz = dx * s + dz * c; const sc = 122 / 24; const px = R + rx * sc, py = R + rz * sc;
      if (Math.hypot(px - R, py - R) > 124) continue;
      rc.fillStyle = `rgba(255,90,70,${a})`; rc.beginPath(); rc.arc(px, py, 7, 0, 7); rc.fill();
    }
  }
}
let toastT = 0; function toast(t, d = 2) { $('toast').textContent = t; $('toast').style.opacity = 1; toastT = d; }
function objText() {
  const on = generators.filter(g => g.on).length;
  return on < 3 ? `<b>ЗАДАЧА:</b> запустить генераторы — ${on}/3<br><small>Ищите красные огни в тупиках</small>` : `<b>ЗАДАЧА:</b> добраться до шлюза эвакуации<br><small>Зелёный свет — выход</small>`;
}

// ---------- game state ----------
let state = 'menu', clock = 0, distField = null, distT = 0, spawnT = 0, startTime = 0, stepT = 0;
function newGame() {
  buildMaze(); buildWorld();
  enemies.forEach(e => scene.remove(e.g)); enemies.length = 0; shardBits.forEach(b => scene.remove(b.m)); shardBits.length = 0;
  Object.assign(player, { hp: 100, ammo: 40, reloading: 0, fireCd: 0, lastHit: -9 });
  player.pos.set(startC[0] * CS, 1.6, startC[1] * CS);
  const [ox, oz] = openDir(startC[0], startC[1]); player.yaw = Math.atan2(-ox, -oz); player.pitch = 0;
  distField = bfs(startC[0], startC[1]);
  for (let i = 0; i < 6; i++) spawn(10);
  kills = 0; spawnT = 22; startTime = clock; sonarCd = 0;
  $('obj').innerHTML = objText(); toast('Фонарь включён. Рой где-то рядом.', 3);
}
function start() {
  initAudio(); $('menu').classList.add('hidden'); $('end').classList.add('hidden'); $('hudWrap').classList.remove('hidden');
  if (TOUCH) { $('touch').style.display = 'block'; document.documentElement.requestFullscreen?.().catch(() => { }); }
  else canvas.requestPointerLock?.();
  newGame(); state = 'play';
}
function setPause(p) {
  if (p && state === 'play') { state = 'pause'; $('pause').classList.remove('hidden'); }
  else if (!p && state === 'pause') { state = 'play'; $('pause').classList.add('hidden'); if (!TOUCH) canvas.requestPointerLock?.(); }
}
function endGame(win) {
  state = 'end'; document.exitPointerLock?.(); $('touch').style.display = 'none'; $('hudWrap').classList.add('hidden');
  const t = Math.round(clock - startTime);
  $('endT').textContent = win ? 'ЭВАКУАЦИЯ' : 'СИГНАЛ ПОТЕРЯН';
  $('endP').innerHTML = win ? `Станция покинута за ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}. Уничтожено существ: ${kills}.<br><br>${P1} и ${P2} — смена окончена.` : `Рой оказался быстрее. Уничтожено существ: ${kills}.<br>Совет: используйте сонар и не стойте на месте.`;
  $('end').classList.remove('hidden');
}
$('startBtn').onclick = start; $('againBtn').onclick = start; $('resumeBtn').onclick = () => setPause(false);

// ---------- loop ----------
const tmp = new THREE.Vector3(); let last = performance.now(), fpsAcc = 0, fpsN = 0;
function update(dt) {
  const pad = readPad(dt);
  // look
  player.yaw -= look.x; player.pitch = Math.max(-1.35, Math.min(1.35, player.pitch - look.y)); look.x = look.y = 0;
  // move
  let mx = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + tin.mx + pad.mx, mz = (keys.KeyS ? 1 : 0) - (keys.KeyW ? 1 : 0) + tin.mz + pad.mz;
  const ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
  const sprint = keys.ShiftLeft || pad.sprint || (TOUCH && Math.hypot(tin.mx, tin.mz) > .95);
  const sp = (sprint ? 6.2 : 4) * dt; const s = Math.sin(player.yaw), c = Math.cos(player.yaw);
  const dx = (mx * c + mz * s) * sp, dz = (-mx * s + mz * c) * sp;
  collide(player.pos, dx, dz, .4);
  const moving = ml > .1; player.bob += moving ? dt * (sprint ? 11 : 8) : 0;
  stepT -= moving ? dt : 0; if (stepT < 0) { stepT = sprint ? .32 : .45; sfx.step(1); if (sprint) makeNoise(4); }
  camera.position.set(player.pos.x, 1.6 + (moving ? Math.sin(player.bob) * .045 : 0), player.pos.z);
  camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
  recoil = Math.max(0, recoil - dt * 10);
  gun.position.set(.24 + Math.cos(player.bob * .5) * .012, -.24 + Math.abs(Math.sin(player.bob * .5)) * .012 - (player.reloading > 0 ? .15 : 0), -.45 + recoil * .05);
  gun.rotation.x = recoil * .06 + (player.reloading > 0 ? -.5 : 0);
  // fire
  player.fireCd -= dt; if ((mouseDown || tin.fire || pad.fire) && player.fireCd <= 0) fire();
  if (player.reloading > 0) { player.reloading -= dt; if (player.reloading <= 0) { player.ammo = 40; sfx.click(); } }
  muzzle.intensity *= Math.pow(.0001, dt * 6); tracerT -= dt; tracer.visible = tracerT > 0;
  sonarCd -= dt;
  const age = clock - sonarT; ring.material.opacity = age < 1.4 ? .8 * (1 - age / 1.4) : 0; ring.scale.setScalar(1 + age * 22);
  // regen
  if (clock - player.lastHit > 4 && player.hp < 100) player.hp = Math.min(100, player.hp + 4 * dt);
  // distance field
  distT -= dt; if (distT < 0) { distT = .25; distField = bfs(cellOf(player.pos.x), cellOf(player.pos.z)); }
  // enemies
  for (const e of enemies) {
    e.t += dt; const p = e.g.position; const ci = cellOf(p.z) * W + cellOf(p.x), d = distField[ci];
    const pd = Math.hypot(p.x - player.pos.x, p.z - player.pos.z);
    // sees flashlight cone / proximity
    if (!e.alert && (d >= 0 && d <= 3 || pd < 6)) alertE(e);
    let tx, tz, spd;
    if (e.alert) {
      spd = e.speed * (pd < 6 ? 1.25 : 1);
      if (d <= 1) { tx = player.pos.x; tz = player.pos.z; }
      else {
        let best = ci; for (const j of [ci + 1, ci - 1, ci + W, ci - W]) if (distField[j] >= 0 && distField[j] < distField[best]) best = j;
        tx = (best % W) * CS; tz = ((best / W) | 0) * CS;
      }
    } else {
      spd = 1.1;
      if (!e.wander || Math.hypot(p.x - e.wander[0], p.z - e.wander[1]) < .3) { const nb = [ci + 1, ci - 1, ci + W, ci - W].filter(j => !grid[j]); const j = nb[(Math.random() * nb.length) | 0] ?? ci; e.wander = [(j % W) * CS, ((j / W) | 0) * CS]; }
      [tx, tz] = e.wander;
    }
    const vx = tx - p.x, vz = tz - p.z, vl = Math.hypot(vx, vz) || 1;
    if (pd > 1.1 || !e.alert) collide(p, vx / vl * Math.min(spd * dt, vl), vz / vl * Math.min(spd * dt, vl), .3);
    // separation
    for (const o of enemies) if (o !== e) { const ox = p.x - o.g.position.x, oz = p.z - o.g.position.z, ol = Math.hypot(ox, oz); if (ol < .7 && ol > 0) collide(p, ox / ol * dt * 1.5, oz / ol * dt * 1.5, .3); }
    // crawl on ceiling while far, drop when close
    const onCeil = e.ceil && pd > 5;
    const ty = onCeil ? H - .35 : .45; p.y += (ty - p.y) * Math.min(1, dt * 5);
    const tr = onCeil ? Math.PI : 0; e.body.rotation.z += (tr - e.body.rotation.z) * Math.min(1, dt * 6);
    e.g.rotation.y = Math.atan2(vx, vz);
    e.legs.forEach((l, i) => l.rotation.x = Math.sin(e.t * (e.alert ? 18 : 6) + i * 1.7) * .4);
    e.body.position.y = Math.sin(e.t * 9) * .03;
    e.g.scale.setScalar(e.hurt > 0 ? 1.15 : 1); e.hurt -= dt;
    // attack
    e.cd -= dt;
    if (e.alert && pd < 1.4 && Math.abs(p.y - .45) < .5 && e.cd <= 0) {
      e.cd = 1; player.hp -= 12; player.lastHit = clock; sfx.hurt(); $('dmg').style.opacity = .9; setTimeout(() => $('dmg').style.opacity = 0, 180);
      if (player.hp <= 0) { endGame(false); return; }
    }
  }
  for (let i = shardBits.length - 1; i >= 0; i--) { const b = shardBits[i]; b.t -= dt; b.v.y -= 9 * dt; b.m.position.addScaledVector(b.v, dt); if (b.m.position.y < .03) { b.m.position.y = .03; b.v.multiplyScalar(.5); } if (b.t < 0) { scene.remove(b.m); shardBits.splice(i, 1); } }
  // spawning pressure
  spawnT -= dt; if (spawnT < 0) { spawnT = Math.max(10, 22 - generators.filter(g => g.on).length * 4); if (enemies.length < 14) spawn(9); }
  // generators
  let near = null;
  for (const g of generators) {
    g.coil.rotation.y += dt * (g.on ? 6 : .2);
    if (!g.on && g.g.position.distanceTo(tmp.set(player.pos.x, 0, player.pos.z)) < 2.2) near = g;
  }
  const using = keys.KeyE || tin.use || pad.use;
  if (near) {
    $('use').style.display = 'block'; $('useTxt').textContent = using ? 'ЗАПУСК…' : (TOUCH ? 'УДЕРЖИВАЙТЕ «ДЕЙСТВ.»' : 'УДЕРЖИВАЙТЕ E');
    if (using) { near.prog += dt / 2.5; if (Math.random() < dt * 3) makeNoise(8); } else near.prog = Math.max(0, near.prog - dt);
    $('usefill').style.width = near.prog * 100 + '%';
    if (near.prog >= 1) {
      near.on = true; near.screen.material.color.set(0x40ff90); near.coil.material.color.set(0x40ff90); near.light.color.set(0x40ff90);
      sfx.power(); spawn(8); spawn(8); $('obj').innerHTML = objText();
      const on = generators.filter(g => g.on).length;
      toast(on < 3 ? `Генератор ${on}/3 запущен. Рой услышал.` : 'Питание восстановлено. Шлюз открыт!', 3);
      if (on === 3) { exitMesh.material.color.set(0x40ff90); exitLight.intensity = 12; }
    }
  } else $('use').style.display = 'none';
  // exit
  if (generators.every(g => g.on) && Math.hypot(player.pos.x - exitMesh.position.x, player.pos.z - exitMesh.position.z) < 1.8) endGame(true);
  if (exitLight.intensity > 0) exitMesh.rotation.z += dt;
  // hud
  $('hpfill').style.width = Math.max(0, player.hp) + '%';
  $('ammoN').textContent = player.reloading > 0 ? '—' : player.ammo;
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').style.opacity = 0; }
  drawRadar();
  // flashlight flicker
  flash.intensity = 90 * (Math.random() < .004 ? .2 : 1);
}
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(.05, (now - last) / 1000); last = now; clock += dt;
  if (state === 'play') update(dt);
  else if (state === 'menu') { camera.position.set((W - 1) * CS / 2 + Math.sin(clock * .1) * 10, 1.6, (W - 1) * CS / 2); camera.rotation.set(0, clock * .1, 0); }
  renderer.render(scene, camera);
  // adaptive resolution
  fpsAcc += dt; fpsN++;
  if (fpsAcc > 2) { const fps = fpsN / fpsAcc; if (fps < 42 && PR > .75) { PR -= .25; renderer.setPixelRatio(PR); resize(); } else if (fps > 58 && PR < Math.min(devicePixelRatio, TOUCH ? 1.5 : 2)) { PR += .25; renderer.setPixelRatio(PR); resize(); } fpsAcc = fpsN = 0; }
}
// menu background
buildMaze(); buildWorld();
requestAnimationFrame(loop);
window.__game = { start, get state() { return state; }, player, enemies };
