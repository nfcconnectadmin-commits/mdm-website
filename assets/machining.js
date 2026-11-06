/* MDM 3D machining simulation. Runs G-code against a height map of the stock. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('view');
  function fail(msg) { canvas.parentElement.innerHTML = `<p class="stage-fail">${msg}</p>`; }
  if (!window.THREE || !window.MDM3D) return fail('The 3D library could not load. Check your connection and reload the page.');
  const view = MDM3D.createView(canvas);
  if (!view) return fail('This browser or device cannot show 3D graphics. Try turning on WebGL or using a different browser.');

  /* ---------- Setup ---------- */
  const STOCK = { x: 120, y: 80, top: 1, bottom: -30 };
  const CELL = 0.5;
  const RAPID = 6000;
  const TOOLS = {
    1: { d: 16, name: 'Ø16 flat end mill', color: [0.55, 0.62, 0.70], css: '#8C9EB3' },
    2: { d: 8, name: 'Ø8 flat end mill', color: [0.30, 0.48, 0.82], css: '#4D7AD1' },
    3: { d: 6.8, name: 'Ø6.8 drill', color: [0.80, 0.42, 0.16], css: '#CC6B29' },
  };
  const RAW = [0.36, 0.38, 0.42];
  const n = v => {
    const s = v.toFixed(3).replace(/0+$/, '').replace(/\.$/, '.');
    return s === '-0.' ? '0.' : s;
  };

  /* ---------- Example programs (sample G-code) ---------- */
  function program(lines) {
    return {
      out: lines,
      add(s) { this.out.push(s); },
      tool(t, s, title) {
        this.add(`(${title})`);
        this.add(`T${t} M6`);
        this.add(`S${s} M3`);
        this.add('G0 Z10.');
      },
      to(x, y) { this.add(`G0 X${n(x)} Y${n(y)}`); },
      faceTop(step) {
        const r = TOOLS[1].d / 2;
        let y = r - 3, dir = 1;
        this.to(-r - 4, y);
        this.add('G0 Z2.');
        this.add('G1 Z0. F400');
        let first = true;
        while (y < STOCK.y + r - step / 2) {
          if (!first) this.add(`G1 Y${n(y)} F900`);
          this.add(`G1 X${n(dir > 0 ? STOCK.x + r + 4 : -r - 4)} F900`);
          dir = -dir;
          first = false;
          y += step;
        }
        this.add('G0 Z10.');
      },
      rectPocket(x0, y0, x1, y1, depth, down, step) {
        const r = TOOLS[2].d / 2;
        const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
        const hw = (x1 - x0) / 2 - r, hh = (y1 - y0) / 2 - r;
        for (let z = -down; ; z -= down) {
          const zz = Math.max(z, -depth);
          this.to(cx, cy);
          this.add('G0 Z2.');
          this.add(`G1 Z${n(zz)} F200`);
          let k = step;
          while (true) {
            const a = Math.min(k, hw), b = Math.min(k, hh);
            this.add(`G1 X${n(cx - a)} Y${n(cy - b)} F700`);
            this.add(`G1 X${n(cx + a)}`);
            this.add(`G1 Y${n(cy + b)}`);
            this.add(`G1 X${n(cx - a)}`);
            this.add(`G1 Y${n(cy - b)}`);
            if (a >= hw && b >= hh) break;
            k += step;
          }
          this.add('G0 Z10.');
          if (zz <= -depth) break;
        }
      },
      circlePocket(cx, cy, dia, depth, down, step) {
        const rmax = dia / 2 - TOOLS[2].d / 2;
        for (let z = -down; ; z -= down) {
          const zz = Math.max(z, -depth);
          this.to(cx, cy);
          this.add('G0 Z2.');
          this.add(`G1 Z${n(zz)} F200`);
          for (let r = Math.min(step, rmax); ; r = Math.min(r + step, rmax)) {
            this.add(`G1 X${n(cx + r)} Y${n(cy)} F700`);
            this.add(`G3 X${n(cx + r)} Y${n(cy)} I${n(-r)} J0. F700`);
            if (r >= rmax) break;
          }
          this.add('G0 Z10.');
          if (zz <= -depth) break;
        }
      },
      boss(cx, cy, dia, depth, down) {
        const r = TOOLS[1].d / 2;
        const rin = dia / 2 + r;
        const rout = Math.hypot(STOCK.x / 2, STOCK.y / 2) + r;
        for (let z = -down; ; z -= down) {
          const zz = Math.max(z, -depth);
          this.to(cx + rout + 3, cy);
          this.add('G0 Z2.');
          this.add(`G1 Z${n(zz)} F300`);
          for (let c = rout; ; c = Math.max(c - 11, rin)) {
            this.add(`G1 X${n(cx + c)} Y${n(cy)} F800`);
            this.add(`G2 X${n(cx + c)} Y${n(cy)} I${n(-c)} J0. F800`);
            if (c <= rin) break;
          }
          this.add('G0 Z10.');
          if (zz <= -depth) break;
        }
      },
      drill(points, depth) {
        points.forEach(([x, y]) => {
          this.to(x, y);
          this.add('G0 Z2.');
          for (let z = -8; ; z -= 8) {
            const zz = Math.max(z, -depth);
            this.add(`G1 Z${n(zz)} F180`);
            this.add('G0 Z2.');
            if (zz <= -depth) break;
          }
          this.add('G0 Z10.');
        });
      },
    };
  }
  const JOBS = {
    plate: {
      name: 'Pocket plate',
      gcode() {
        const p = program(['(MDM SAMPLE: POCKET PLATE)', '(STOCK 120 X 80 X 31. Z0 = FINISHED TOP)', 'G21 G90 G17']);
        p.tool(1, 3000, 'OP10 FACE TOP');
        p.faceTop(12);
        p.tool(2, 6000, 'OP20 RECTANGULAR POCKET');
        p.rectPocket(12, 14, 62, 66, 9, 3, 5);
        p.add('(OP30 ROUND POCKET)');
        p.circlePocket(92, 40, 34, 12, 4, 4);
        p.tool(3, 3200, 'OP40 DRILL HOLES');
        p.drill([[92, 11], [92, 69], [37, 40]], 24);
        p.add('G0 Z30.');
        p.add('M30');
        return p.out.join('\n');
      },
    },
    boss: {
      name: 'Round boss',
      gcode() {
        const p = program(['(MDM SAMPLE: ROUND BOSS)', '(STOCK 120 X 80 X 31. Z0 = FINISHED TOP)', 'G21 G90 G17']);
        p.tool(1, 3000, 'OP10 FACE TOP');
        p.faceTop(12);
        p.add('(OP20 MACHINE ROUND BOSS)');
        p.boss(60, 40, 64, 10, 2.5);
        p.tool(2, 6000, 'OP30 BORE CENTRE');
        p.circlePocket(60, 40, 24, 14, 4, 3.5);
        p.tool(3, 3200, 'OP40 DRILL BOLT HOLES');
        const holes = [];
        for (let i = 0; i < 6; i++) {
          const a = Math.PI / 2 + i * Math.PI / 3;
          holes.push([60 + 22 * Math.cos(a), 40 + 22 * Math.sin(a)]);
        }
        p.drill(holes, 18);
        p.add('G0 Z30.');
        p.add('M30');
        return p.out.join('\n');
      },
    },
  };

  /* ---------- G-code reader ---------- */
  function parse(text) {
    const moves = [];
    const state = { x: 60, y: 40, z: 30, f: 0, g: 0, tool: 0, s: 0 };
    const lines = text.split(/\r?\n/);
    let label = '';
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const comment = raw.match(/\(([^)]*)\)/);
      if (comment && /^OP|^T\d/i.test(comment[1].trim())) label = comment[1].trim();
      const line = raw.replace(/\([^)]*\)/g, '').replace(/;.*$/, '').toUpperCase();
      if (!line.trim() || /^\s*%/.test(line)) continue;
      const words = {};
      const gs = [], ms = [];
      const re = /([A-Z])\s*([+-]?(?:\d+\.?\d*|\.\d+))/g;
      let m, seen = false;
      while ((m = re.exec(line))) {
        seen = true;
        if (m[1] === 'G') gs.push(parseFloat(m[2]));
        else if (m[1] === 'M') ms.push(parseFloat(m[2]));
        else words[m[1]] = parseFloat(m[2]);
      }
      if (!seen) throw new Error(`Line ${i + 1}: this line could not be read: ${raw.trim()}`);
      for (const g of gs) {
        if ([0, 1, 2, 3].includes(g)) state.g = g;
        else if (g === 20) throw new Error(`Line ${i + 1}: inch mode (G20) is not supported. Use millimetres (G21).`);
        else if (g === 91) throw new Error(`Line ${i + 1}: incremental mode (G91) is not supported. Use absolute (G90).`);
        else if (![17, 21, 40, 49, 54, 80, 90, 94].includes(g)) throw new Error(`Line ${i + 1}: G${g} is not supported. Use G0, G1, G2 or G3 moves.`);
      }
      if ('T' in words) {
        if (!TOOLS[words.T]) throw new Error(`Line ${i + 1}: T${words.T} is not in the tool list. Use T1, T2 or T3.`);
        state.tool = words.T;
      }
      if ('F' in words) state.f = words.F;
      if ('S' in words) state.s = words.S;
      if (ms.some(v => v === 30 || v === 2)) break;
      if (!('X' in words || 'Y' in words || 'Z' in words)) continue;
      if (!state.tool) throw new Error(`Line ${i + 1}: select a tool first, for example T1 M6.`);
      if (state.g !== 0 && !(state.f > 0)) throw new Error(`Line ${i + 1}: set a feed rate first, for example F500.`);
      const end = { x: 'X' in words ? words.X : state.x, y: 'Y' in words ? words.Y : state.y, z: 'Z' in words ? words.Z : state.z };
      const base = { rapid: state.g === 0, f: state.g === 0 ? RAPID : state.f, line: i, text: raw.trim(), tool: state.tool, s: state.s, label };
      if (state.g === 2 || state.g === 3) {
        if ('R' in words) throw new Error(`Line ${i + 1}: R-format arcs are not supported. Use I and J.`);
        if (!('I' in words || 'J' in words)) throw new Error(`Line ${i + 1}: an arc needs I and J values.`);
        const cx = state.x + (words.I || 0), cy = state.y + (words.J || 0);
        const r = Math.hypot(state.x - cx, state.y - cy);
        const a0 = Math.atan2(state.y - cy, state.x - cx);
        let a1 = Math.atan2(end.y - cy, end.x - cx);
        const cw = state.g === 2;
        let sweep = cw ? a0 - a1 : a1 - a0;
        while (sweep <= 1e-9) sweep += Math.PI * 2;
        const segs = Math.max(8, Math.ceil(sweep * r / 1));
        let px = state.x, py = state.y, pz = state.z;
        for (let k = 1; k <= segs; k++) {
          const t = k / segs;
          const ang = a0 + (cw ? -sweep : sweep) * t;
          const nx = k === segs ? end.x : cx + r * Math.cos(ang);
          const ny = k === segs ? end.y : cy + r * Math.sin(ang);
          const nz = state.z + (end.z - state.z) * t;
          moves.push({ ...base, a: [px, py, pz], b: [nx, ny, nz] });
          px = nx; py = ny; pz = nz;
        }
      } else {
        moves.push({ ...base, a: [state.x, state.y, state.z], b: [end.x, end.y, end.z] });
      }
      Object.assign(state, end);
      if (moves.length > 400000) throw new Error('This program is too long for the browser simulation.');
    }
    if (!moves.length) throw new Error('No moves found. Add G0 or G1 lines with X, Y or Z.');
    moves.forEach(mv => {
      mv.len = Math.hypot(mv.b[0] - mv.a[0], mv.b[1] - mv.a[1], mv.b[2] - mv.a[2]);
      mv.sec = mv.len / mv.f * 60;
    });
    return moves;
  }

  /* ---------- Stock mesh ---------- */
  const nx = Math.round(STOCK.x / CELL), ny = Math.round(STOCK.y / CELL);
  const stride = nx + 1;
  const topCount = stride * (ny + 1);
  const ringCount = 2 * (nx + ny);
  const heights = new Float32Array(topCount);
  const positions = new Float32Array((topCount + ringCount) * 3);
  const colors = new Float32Array((topCount + ringCount) * 3);

  const geo = new THREE.BufferGeometry();
  (function buildStock() {
    const index = [];
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const a = j * stride + i, b = a + 1, c = a + stride, d = c + 1;
        index.push(a, b, d, a, d, c);
      }
    }
    const ring = [];
    for (let i = 0; i < nx; i++) ring.push(i);
    for (let j = 0; j < ny; j++) ring.push(j * stride + nx);
    for (let i = nx; i > 0; i--) ring.push(ny * stride + i);
    for (let j = ny; j > 0; j--) ring.push(j * stride);
    ring.forEach((v, k) => {
      const o = topCount + k;
      positions[o * 3] = (v % stride) * CELL;
      positions[o * 3 + 1] = Math.floor(v / stride) * CELL;
      positions[o * 3 + 2] = STOCK.bottom;
      colors.set(RAW, o * 3);
      const w = ring[(k + 1) % ringCount], o2 = topCount + (k + 1) % ringCount;
      index.push(v, o, o2, v, o2, w);
    });
    for (let j = 0; j <= ny; j++) {
      for (let i = 0; i <= nx; i++) {
        const k = j * stride + i;
        positions[k * 3] = i * CELL;
        positions[k * 3 + 1] = j * CELL;
      }
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setIndex(index);
  })();
  const stockMesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    vertexColors: true, flatShading: true, metalness: 0.1, roughness: 0.6, side: THREE.DoubleSide,
  }));
  stockMesh.frustumCulled = false;
  view.scene.add(stockMesh);
  const bottom = new THREE.Mesh(new THREE.PlaneGeometry(STOCK.x, STOCK.y), new THREE.MeshStandardMaterial({ color: 0x5c6170, side: THREE.DoubleSide }));
  bottom.position.set(STOCK.x / 2, STOCK.y / 2, STOCK.bottom);
  view.scene.add(bottom);

  const toolGroup = new THREE.Group();
  const cutter = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 24), new THREE.MeshStandardMaterial({ color: 0xb5420a, metalness: 0.3, roughness: 0.4, flatShading: true }));
  cutter.rotation.x = Math.PI / 2;
  const holder = new THREE.Mesh(new THREE.CylinderGeometry(10, 13, 16, 32), new THREE.MeshStandardMaterial({ color: 0x3d4452, metalness: 0.4, roughness: 0.5 }));
  holder.rotation.x = Math.PI / 2;
  toolGroup.add(cutter, holder);
  view.scene.add(toolGroup);

  let pathLines = null;
  function drawPath(moves) {
    if (pathLines) {
      view.scene.remove(pathLines);
      pathLines.children.forEach(c => { c.geometry.dispose(); c.material.dispose(); });
    }
    pathLines = new THREE.Group();
    const feed = [], rapid = [];
    moves.forEach(m => (m.rapid ? rapid : feed).push(...m.a, ...m.b));
    const seg = (arr, color) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: color === 0x2a3cb8 ? 0.22 : 0.5 }));
    };
    pathLines.add(seg(feed, 0xb5420a), seg(rapid, 0x2a3cb8));
    pathLines.visible = $('show-path').checked;
    view.scene.add(pathLines);
  }

  /* ---------- Simulation ---------- */
  const sim = { moves: [], idx: 0, into: 0, playing: false, elapsed: 0, total: 0, removed: 0, crashes: new Set(), dirty: true, tip: [60, 40, 30], tool: 0, spin: 0 };

  function resetStock() {
    heights.fill(STOCK.top);
    for (let k = 0; k < topCount; k++) {
      positions[k * 3 + 2] = STOCK.top;
      colors.set(RAW, k * 3);
    }
    sim.dirty = true;
  }
  function setTool(t) {
    if (sim.tool === t) return;
    sim.tool = t;
    const d = TOOLS[t].d;
    cutter.scale.set(d / 2, 30, d / 2);
    cutter.position.z = 15;
    holder.position.z = 38;
  }
  function stamp(x, y, z, mv) {
    if (z >= STOCK.top) return false;
    const tool = TOOLS[mv.tool], r = tool.d / 2, rr = r * r;
    const i0 = Math.max(0, Math.ceil((x - r) / CELL)), i1 = Math.min(nx, Math.floor((x + r) / CELL));
    const j0 = Math.max(0, Math.ceil((y - r) / CELL)), j1 = Math.min(ny, Math.floor((y + r) / CELL));
    const floor = Math.max(z, STOCK.bottom);
    let cut = false;
    for (let j = j0; j <= j1; j++) {
      const dy = j * CELL - y, row = rr - dy * dy;
      if (row < 0) continue;
      const base = j * stride;
      for (let i = i0; i <= i1; i++) {
        const dx = i * CELL - x;
        if (dx * dx > row) continue;
        const k = base + i;
        if (heights[k] > floor + 1e-4) {
          sim.removed += (heights[k] - floor) * CELL * CELL;
          heights[k] = floor;
          positions[k * 3 + 2] = floor;
          colors[k * 3] = tool.color[0]; colors[k * 3 + 1] = tool.color[1]; colors[k * 3 + 2] = tool.color[2];
          cut = true;
        }
      }
    }
    if (cut) sim.dirty = true;
    return cut;
  }
  /* Advance by a number of machine seconds, cutting along the way. */
  function advance(seconds) {
    let left = seconds;
    while (left > 0 && sim.idx < sim.moves.length) {
      const mv = sim.moves[sim.idx];
      setTool(mv.tool);
      const remain = mv.sec - sim.into;
      const use = Math.min(left, remain);
      const t0 = mv.sec ? sim.into / mv.sec : 1;
      const t1 = mv.sec ? (sim.into + use) / mv.sec : 1;
      const stepCount = Math.max(1, Math.ceil(mv.len * (t1 - t0) / (CELL * 0.6)));
      let x = 0, y = 0, z = 0;
      for (let s = 1; s <= stepCount; s++) {
        const t = t0 + (t1 - t0) * s / stepCount;
        x = mv.a[0] + (mv.b[0] - mv.a[0]) * t;
        y = mv.a[1] + (mv.b[1] - mv.a[1]) * t;
        z = mv.a[2] + (mv.b[2] - mv.a[2]) * t;
        if (stamp(x, y, z, mv) && mv.rapid) sim.crashes.add(mv.line);
      }
      sim.tip = [x, y, z];
      sim.into += use;
      left -= use;
      sim.elapsed += use;
      if (sim.into >= mv.sec - 1e-9) { sim.idx++; sim.into = 0; }
    }
    if (sim.idx >= sim.moves.length) sim.playing = false;
  }

  /* ---------- Display ---------- */
  const time = s => {
    const m = Math.floor(s / 60), r = Math.floor(s % 60);
    return `${m}:${String(r).padStart(2, '0')}`;
  };
  function paint() {
    if (sim.dirty) {
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
      sim.dirty = false;
    }
    toolGroup.position.set(sim.tip[0], sim.tip[1], sim.tip[2]);
    toolGroup.visible = $('show-tool').checked && sim.idx < sim.moves.length;
    view.render();
  }
  function readouts() {
    const mv = sim.moves[Math.min(sim.idx, sim.moves.length - 1)];
    if (!mv) return;
    const done = sim.idx >= sim.moves.length;
    $('r-op').textContent = done ? 'Program finished' : (mv.label || 'Running');
    $('r-tool').textContent = TOOLS[mv.tool].name;
    $('r-feed').textContent = mv.rapid ? `Rapid, ${RAPID} mm/min` : `${mv.f} mm/min`;
    $('r-speed').textContent = mv.s ? `${mv.s.toLocaleString('en-US')} rpm` : 'Not set';
    $('r-pos').textContent = `X${sim.tip[0].toFixed(1)} Y${sim.tip[1].toFixed(1)} Z${sim.tip[2].toFixed(1)}`;
    $('r-time').textContent = `${time(sim.elapsed)} of ${time(sim.total)}`;
    const cm3 = sim.removed / 1000;
    const density = parseFloat($('material').value);
    $('r-vol').textContent = `${cm3.toFixed(1)} cm³`;
    $('r-mass').textContent = `${(cm3 * density / 1000).toFixed(2)} kg`;
    $('progress').style.width = `${sim.total ? 100 * sim.elapsed / sim.total : 0}%`;
    $('now').textContent = done ? 'End of program' : `Line ${mv.line + 1}: ${mv.text}`;
    const crash = sim.crashes.size;
    $('r-crash').textContent = crash ? `${crash} found` : 'None so far';
    $('r-crash').style.color = crash ? 'var(--bad)' : 'var(--ok)';
    $('crash-note').textContent = crash ? `Rapid move cut material on line ${[...sim.crashes].slice(0, 5).map(l => l + 1).join(', ')}. Check the Z height before this move.` : '';
    $('play').textContent = sim.playing ? 'Pause' : done ? 'Run again' : 'Play';
  }
  let last = 0, looping = false;
  function loop(now) {
    if (!sim.playing) { looping = false; last = 0; paint(); readouts(); return; }
    const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
    last = now;
    advance(dt * parseFloat($('speed').value));
    paint();
    readouts();
    requestAnimationFrame(loop);
  }
  function play() {
    if (sim.idx >= sim.moves.length) load(sim.moves);
    sim.playing = true;
    readouts();
    if (!looping) { looping = true; last = 0; requestAnimationFrame(loop); }
  }
  function pause() { sim.playing = false; readouts(); }
  function load(moves) {
    sim.moves = moves;
    sim.idx = 0; sim.into = 0; sim.elapsed = 0; sim.removed = 0;
    sim.crashes = new Set();
    sim.total = moves.reduce((t, m) => t + m.sec, 0);
    sim.tip = moves[0].a.slice();
    sim.tool = 0;
    setTool(moves[0].tool);
    resetStock();
    drawPath(moves);
    paint();
    readouts();
  }
  function runText(start) {
    let moves;
    try {
      moves = parse($('gcode').value);
    } catch (err) {
      $('gcode-problem').textContent = err.message;
      return false;
    }
    $('gcode-problem').textContent = '';
    sim.playing = false;
    load(moves);
    if (start) play();
    return true;
  }

  /* ---------- Controls ---------- */
  Object.entries(JOBS).forEach(([k, j]) => $('job').add(new Option(j.name, k)));
  $('job').addEventListener('change', () => {
    $('gcode').value = JOBS[$('job').value].gcode();
    runText(!reduced);
  });
  $('play').addEventListener('click', () => (sim.playing ? pause() : play()));
  $('restart').addEventListener('click', () => { runText(false); });
  $('finish').addEventListener('click', () => {
    sim.playing = false;
    advance(Infinity);
    paint();
    readouts();
  });
  $('run-code').addEventListener('click', () => runText(true));
  $('show-path').addEventListener('change', () => {
    if (pathLines) pathLines.visible = $('show-path').checked;
    view.invalidate();
    paint();
  });
  $('show-tool').addEventListener('change', () => { toolGroup.visible = $('show-tool').checked; paint(); });
  $('material').addEventListener('change', readouts);
  document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => view.setView(b.dataset.view)));
  $('legend').innerHTML = `<span><i style="background:#5C6170"></i>Uncut stock</span>` +
    Object.values(TOOLS).map(t => `<span><i style="background:${t.css}"></i>${t.name}</span>`).join('');
  $('tool-list').textContent = Object.entries(TOOLS).map(([k, t]) => `T${k} ${t.name}`).join(', ');

  const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  $('gcode').value = JOBS.plate.gcode();
  view.frame(new THREE.Box3(new THREE.Vector3(0, 0, STOCK.bottom), new THREE.Vector3(STOCK.x, STOCK.y, 15)));
  runText(false);
  if (!reduced) play();
  /* Rendering after an orbit drag while paused goes through the view itself. */
  window.mdmSim = { sim, advance, paint, readouts, parse, heights, CELL, stride, STOCK };
})();
