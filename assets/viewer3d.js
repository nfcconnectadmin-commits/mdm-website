/* ME 3D viewer: a Z-up orbit view and parametric part models, all in millimetres. */
(function () {
  'use strict';
  const TAU = Math.PI * 2;

  /* ---------- View ---------- */
  function createView(canvas) {
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    } catch (err) {
      return null;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0xffffff);
    renderer.localClippingEnabled = true;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 1, 20000);
    camera.up.set(0, 0, 1);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8d96a8, 0.8));
    const key = new THREE.DirectionalLight(0xffffff, 0.75);
    key.position.set(1, -1.4, 2);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.3);
    fill.position.set(-2, 1, 0.6);
    scene.add(fill);

    const orbit = { theta: -0.85, phi: 1.05, radius: 400, target: new THREE.Vector3() };
    let queued = false;

    function place() {
      const s = Math.sin(orbit.phi);
      camera.position.set(
        orbit.target.x + orbit.radius * s * Math.cos(orbit.theta),
        orbit.target.y + orbit.radius * s * Math.sin(orbit.theta),
        orbit.target.z + orbit.radius * Math.cos(orbit.phi)
      );
      camera.lookAt(orbit.target);
    }
    function render() {
      place();
      renderer.render(scene, camera);
    }
    function invalidate() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; render(); });
    }
    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      render();
    }
    function frame(box) {
      const size = new THREE.Vector3(), mid = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(mid);
      orbit.target.copy(mid);
      const span = Math.max(size.length(), 1);
      const fit = Math.tan(camera.fov * Math.PI / 360) * Math.min(camera.aspect, 1);
      orbit.radius = span / (2 * fit) * 1.1;
      invalidate();
    }
    function setView(name) {
      const v = { iso: [-0.85, 1.05], front: [-Math.PI / 2, Math.PI / 2], right: [0, Math.PI / 2], top: [-Math.PI / 2, 0.001] }[name];
      orbit.theta = v[0];
      orbit.phi = v[1];
      invalidate();
    }

    /* Drag to rotate, right-drag or Shift-drag to pan, wheel or pinch to zoom. */
    const points = new Map();
    let pinch = 0;
    function pan(dx, dy) {
      const scale = 2 * orbit.radius * Math.tan(camera.fov * Math.PI / 360) / canvas.clientHeight;
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
      orbit.target.addScaledVector(right, -dx * scale).addScaledVector(up, dy * scale);
    }
    canvas.addEventListener('pointerdown', e => {
      canvas.setPointerCapture(e.pointerId);
      points.set(e.pointerId, { x: e.clientX, y: e.clientY, pan: e.button === 2 || e.shiftKey });
      pinch = 0;
    });
    canvas.addEventListener('pointermove', e => {
      const p = points.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (points.size === 2) {
        const [a, b] = [...points.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) orbit.radius = Math.max(5, orbit.radius * pinch / dist);
        pinch = dist;
        pan(dx / 2, dy / 2);
      } else if (p.pan) {
        pan(dx, dy);
      } else {
        orbit.theta -= dx * 0.008;
        orbit.phi = Math.min(Math.PI - 0.01, Math.max(0.001, orbit.phi - dy * 0.008));
      }
      invalidate();
    });
    const release = e => { points.delete(e.pointerId); pinch = 0; };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      orbit.radius = Math.max(5, orbit.radius * Math.exp(e.deltaY * 0.001));
      invalidate();
    }, { passive: false });

    if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
    window.addEventListener('resize', resize);
    resize();
    return { scene, camera, renderer, orbit, render, invalidate, frame, setView, resize };
  }

  /* ---------- Geometry helpers ---------- */
  function signedVolume(geo) {
    const pos = geo.attributes.position, idx = geo.index;
    const count = idx ? idx.count : pos.count;
    const get = i => (idx ? idx.getX(i) : i);
    let sum = 0;
    for (let i = 0; i < count; i += 3) {
      const a = get(i), b = get(i + 1), c = get(i + 2);
      const ax = pos.getX(a), ay = pos.getY(a), az = pos.getZ(a);
      const bx = pos.getX(b), by = pos.getY(b), bz = pos.getZ(b);
      const cx = pos.getX(c), cy = pos.getY(c), cz = pos.getZ(c);
      sum += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
    }
    return sum / 6;
  }
  function outward(geo) {
    if (signedVolume(geo) >= 0) return geo;
    if (geo.index) {
      const a = geo.index.array;
      for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; }
    } else {
      const a = geo.attributes.position.array;
      for (let i = 0; i < a.length; i += 9) {
        for (let k = 0; k < 3; k++) { const t = a[i + 3 + k]; a[i + 3 + k] = a[i + 6 + k]; a[i + 6 + k] = t; }
      }
    }
    geo.computeVertexNormals();
    return geo;
  }
  function hole(x, y, r) {
    const p = new THREE.Path();
    p.absarc(x, y, r, 0, TAU, true);
    return p;
  }
  function disc(r) {
    const s = new THREE.Shape();
    s.absarc(0, 0, r, 0, TAU, false);
    return s;
  }
  function extrude(shape, depth, segments) {
    return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: segments || 72 });
  }
  function lathe(points) {
    const geo = new THREE.LatheGeometry(points.map(p => new THREE.Vector2(p[0], p[1])), 96);
    geo.rotateX(Math.PI / 2);
    return outward(geo);
  }

  /* ---------- Part models ---------- */
  const PARTS = {
    flange: {
      name: 'Flange',
      blurb: 'The same flange as the drawing on the home page.',
      params: [
        { key: 'od', label: 'Outside diameter', min: 60, max: 240, step: 1, val: 120 },
        { key: 'bore', label: 'Bore diameter', min: 10, max: 120, step: 1, val: 40 },
        { key: 'hub', label: 'Hub diameter', min: 20, max: 160, step: 1, val: 60 },
        { key: 'thick', label: 'Flange thickness', min: 6, max: 40, step: 1, val: 18 },
        { key: 'len', label: 'Overall length', min: 12, max: 120, step: 1, val: 45 },
        { key: 'pcd', label: 'Bolt circle diameter', min: 40, max: 220, step: 1, val: 90 },
        { key: 'holes', label: 'Bolt holes', min: 3, max: 16, step: 1, val: 6 },
        { key: 'hd', label: 'Bolt hole diameter', min: 4, max: 26, step: 0.5, val: 11 },
      ],
      build(p) {
        if (p.bore >= p.hub) throw new Error('Make the bore smaller than the hub.');
        if (p.hub + p.hd >= p.pcd) throw new Error('The bolt holes run into the hub. Increase the bolt circle or reduce the hub.');
        if (p.pcd + p.hd >= p.od) throw new Error('The bolt holes break through the outside edge. Reduce the bolt circle or increase the outside diameter.');
        if (p.len <= p.thick) throw new Error('Overall length must be more than the flange thickness.');
        if (Math.PI * p.pcd / p.holes <= p.hd * 1.15) throw new Error('The bolt holes overlap. Use fewer or smaller holes.');
        const plate = disc(p.od / 2);
        plate.holes.push(hole(0, 0, p.bore / 2));
        for (let i = 0; i < p.holes; i++) {
          const a = Math.PI / 2 + i * TAU / p.holes;
          plate.holes.push(hole(p.pcd / 2 * Math.cos(a), p.pcd / 2 * Math.sin(a), p.hd / 2));
        }
        const hubShape = disc(p.hub / 2);
        hubShape.holes.push(hole(0, 0, p.bore / 2));
        const hub = extrude(hubShape, p.len - p.thick);
        hub.translate(0, 0, p.thick);
        return [extrude(plate, p.thick), hub];
      },
    },
    shaft: {
      name: 'Stepped shaft',
      blurb: 'A turned shaft with two bearing journals and chamfered ends.',
      params: [
        { key: 'len', label: 'Overall length', min: 60, max: 400, step: 1, val: 180 },
        { key: 'd1', label: 'Journal diameter', min: 8, max: 60, step: 1, val: 25 },
        { key: 'd2', label: 'Body diameter', min: 10, max: 90, step: 1, val: 40 },
        { key: 'j', label: 'Journal length', min: 10, max: 120, step: 1, val: 40 },
        { key: 'c', label: 'Chamfer', min: 0, max: 4, step: 0.5, val: 1.5 },
      ],
      build(p) {
        if (p.d2 <= p.d1) throw new Error('Make the body larger than the journals.');
        if (p.j * 2 >= p.len - 5) throw new Error('The journals are too long for this overall length.');
        const r1 = p.d1 / 2, r2 = p.d2 / 2, c = Math.min(p.c, r1 - 1);
        return [lathe([
          [0, 0], [r1 - c, 0], [r1, c], [r1, p.j], [r2, p.j],
          [r2, p.len - p.j], [r1, p.len - p.j], [r1, p.len - c], [r1 - c, p.len], [0, p.len],
        ])];
      },
    },
    gear: {
      name: 'Spur gear',
      blurb: 'A 20 degree involute gear, generated from its module and tooth count.',
      params: [
        { key: 'm', label: 'Module', min: 1, max: 8, step: 0.5, val: 3 },
        { key: 'z', label: 'Teeth', min: 12, max: 80, step: 1, val: 24 },
        { key: 'width', label: 'Face width', min: 5, max: 60, step: 1, val: 20 },
        { key: 'bore', label: 'Bore diameter', min: 5, max: 120, step: 1, val: 20 },
      ],
      build(p) {
        const pitchR = p.m * p.z / 2;
        const baseR = pitchR * Math.cos(20 * Math.PI / 180);
        const tipR = pitchR + p.m;
        const rootR = pitchR - 1.25 * p.m;
        if (p.bore / 2 >= rootR - p.m) throw new Error('The bore is too large for this gear. Reduce it or add teeth.');
        const inv = a => Math.tan(a) - a;
        const pressure = 20 * Math.PI / 180;
        const halfTooth = Math.PI / (2 * p.z) + inv(pressure);
        const flankAngle = r => halfTooth - (r > baseR ? inv(Math.acos(baseR / r)) : 0);
        const start = Math.max(rootR, baseR);
        const radii = [];
        const steps = 7;
        if (rootR < baseR) radii.push(rootR);
        for (let i = 0; i <= steps; i++) radii.push(start + (tipR - start) * i / steps);
        const s = new THREE.Shape();
        let first = true;
        const put = (r, a) => {
          const x = r * Math.cos(a), y = r * Math.sin(a);
          if (first) { s.moveTo(x, y); first = false; } else s.lineTo(x, y);
        };
        for (let t = 0; t < p.z; t++) {
          const mid = t * TAU / p.z;
          radii.forEach(r => put(r, mid - flankAngle(r)));
          radii.slice().reverse().forEach(r => put(r, mid + flankAngle(r)));
          const next = (t + 1) * TAU / p.z - flankAngle(rootR);
          const from = mid + flankAngle(rootR);
          for (let k = 1; k < 3; k++) put(rootR, from + (next - from) * k / 3);
        }
        s.closePath();
        s.holes.push(hole(0, 0, p.bore / 2));
        return [outward(extrude(s, p.width, 48))];
      },
    },
    bracket: {
      name: 'L-bracket',
      blurb: 'A plate bracket with mounting holes in both legs.',
      params: [
        { key: 'w', label: 'Width', min: 30, max: 200, step: 1, val: 80 },
        { key: 'd', label: 'Base depth', min: 20, max: 150, step: 1, val: 60 },
        { key: 'h', label: 'Height', min: 20, max: 150, step: 1, val: 70 },
        { key: 't', label: 'Plate thickness', min: 2, max: 20, step: 0.5, val: 6 },
        { key: 'hd', label: 'Hole diameter', min: 3, max: 20, step: 0.5, val: 9 },
      ],
      build(p) {
        if (p.hd >= p.w / 3 - 2) throw new Error('The holes are too large for this width.');
        if (p.hd >= p.d - p.t - 4 || p.hd >= p.h - p.t - 4) throw new Error('The holes are too large for these legs.');
        const hx = p.w / 4;
        const rect = (x0, y0, x1, y1) => {
          const s = new THREE.Shape();
          s.moveTo(x0, y0); s.lineTo(x1, y0); s.lineTo(x1, y1); s.lineTo(x0, y1); s.closePath();
          return s;
        };
        const baseShape = rect(-p.w / 2, -p.t, p.w / 2, p.d);
        baseShape.holes.push(hole(-hx, p.d * 0.55, p.hd / 2), hole(hx, p.d * 0.55, p.hd / 2));
        const uprightShape = rect(-p.w / 2, p.t, p.w / 2, p.h);
        const hz = p.t + (p.h - p.t) * 0.6;
        uprightShape.holes.push(hole(-hx, hz, p.hd / 2), hole(hx, hz, p.hd / 2));
        const upright = extrude(uprightShape, p.t, 48);
        upright.rotateX(Math.PI / 2);
        return [extrude(baseShape, p.t, 48), outward(upright)];
      },
    },
    impeller: {
      name: 'Pump impeller',
      blurb: 'A semi-open centrifugal pump impeller with backward-curved blades.',
      params: [
        { key: 'd', label: 'Outside diameter', min: 80, max: 300, step: 1, val: 160 },
        { key: 'hub', label: 'Hub diameter', min: 20, max: 100, step: 1, val: 45 },
        { key: 'bore', label: 'Bore diameter', min: 8, max: 60, step: 1, val: 16 },
        { key: 'hubLen', label: 'Hub length', min: 15, max: 100, step: 1, val: 34 },
        { key: 'blades', label: 'Blades', min: 3, max: 12, step: 1, val: 6, unit: '' },
        { key: 'bh', label: 'Blade height', min: 5, max: 60, step: 1, val: 18 },
        { key: 'bt', label: 'Blade thickness', min: 2, max: 10, step: 0.5, val: 4 },
        { key: 'sweep', label: 'Blade wrap angle', min: 0, max: 120, step: 5, val: 60, unit: '°' },
        { key: 'tb', label: 'Back plate thickness', min: 3, max: 20, step: 0.5, val: 6 },
      ],
      build(p) {
        if (p.bore >= p.hub - 6) throw new Error('Make the bore smaller than the hub.');
        if (p.hub >= p.d * 0.6) throw new Error('The hub is too large for this impeller diameter.');
        if (p.hubLen <= p.tb) throw new Error('The hub must be longer than the back plate is thick.');
        if (p.blades * p.bt * 1.6 >= Math.PI * p.hub) throw new Error('The blades crowd the hub. Use fewer or thinner blades.');
        const plate = disc(p.d / 2);
        plate.holes.push(hole(0, 0, p.bore / 2));
        const hubShape = disc(p.hub / 2);
        hubShape.holes.push(hole(0, 0, p.bore / 2));
        const hub = extrude(hubShape, p.hubLen - p.tb);
        hub.translate(0, 0, p.tb);
        const parts = [extrude(plate, p.tb), hub];
        const r1 = p.hub / 2 - 0.4, r2 = p.d / 2 - 0.5, wrap = p.sweep * Math.PI / 180;
        const steps = 24;
        for (let b = 0; b < p.blades; b++) {
          const base = b * TAU / p.blades;
          const centre = r => base - wrap * Math.pow((r - r1) / (r2 - r1), 1.2);
          const s = new THREE.Shape();
          const pts = [];
          for (let k = 0; k <= steps; k++) {
            const r = r1 + (r2 - r1) * k / steps, d = p.bt / (2 * r);
            pts.push([r, centre(r) + d]);
          }
          for (let k = steps; k >= 0; k--) {
            const r = r1 + (r2 - r1) * k / steps, d = p.bt / (2 * r);
            pts.push([r, centre(r) - d]);
          }
          pts.forEach(([r, a], i) => (i ? s.lineTo(r * Math.cos(a), r * Math.sin(a)) : s.moveTo(r * Math.cos(a), r * Math.sin(a))));
          s.closePath();
          const blade = extrude(s, p.bh, 12);
          blade.translate(0, 0, p.tb);
          parts.push(outward(blade));
        }
        return parts;
      },
    },
    pipeflange: {
      name: 'Slip-on pipe flange',
      blurb: 'A slip-on pipe flange with a raised face and a hub. Check sizes against your flange standard.',
      params: [
        { key: 'pipe', label: 'Pipe outside diameter', min: 20, max: 220, step: 0.1, val: 60.3 },
        { key: 'od', label: 'Flange diameter', min: 60, max: 400, step: 1, val: 165 },
        { key: 't', label: 'Flange thickness', min: 8, max: 50, step: 1, val: 18 },
        { key: 'rf', label: 'Raised face diameter', min: 30, max: 300, step: 1, val: 102 },
        { key: 'hub', label: 'Hub diameter', min: 25, max: 260, step: 1, val: 76 },
        { key: 'hubLen', label: 'Hub length', min: 0, max: 80, step: 1, val: 26 },
        { key: 'pcd', label: 'Bolt circle diameter', min: 40, max: 360, step: 1, val: 125 },
        { key: 'holes', label: 'Bolt holes', min: 4, max: 24, step: 4, val: 4, unit: '' },
        { key: 'hd', label: 'Bolt hole diameter', min: 8, max: 40, step: 0.5, val: 18 },
      ],
      build(p) {
        const bore = p.pipe + 1;
        if (p.hub <= bore + 4) throw new Error('Make the hub larger than the pipe.');
        if (p.rf <= bore + 4) throw new Error('Make the raised face larger than the pipe.');
        if (p.rf + p.hd >= p.pcd || p.hub + p.hd >= p.pcd) throw new Error('The bolt holes run into the raised face or hub. Increase the bolt circle.');
        if (p.pcd + p.hd >= p.od) throw new Error('The bolt holes break through the outside edge. Reduce the bolt circle or enlarge the flange.');
        if (Math.PI * p.pcd / p.holes <= p.hd * 1.15) throw new Error('The bolt holes overlap. Use fewer or smaller holes.');
        const plate = disc(p.od / 2);
        plate.holes.push(hole(0, 0, bore / 2));
        for (let i = 0; i < p.holes; i++) {
          const a = Math.PI / p.holes + i * TAU / p.holes;
          plate.holes.push(hole(p.pcd / 2 * Math.cos(a), p.pcd / 2 * Math.sin(a), p.hd / 2));
        }
        const parts = [];
        const body = extrude(plate, p.t);
        body.translate(0, 0, p.hubLen);
        parts.push(body);
        const face = disc(p.rf / 2);
        face.holes.push(hole(0, 0, bore / 2));
        const raised = extrude(face, 2);
        raised.translate(0, 0, p.hubLen + p.t);
        parts.push(raised);
        if (p.hubLen > 0) {
          const hubShape = disc(p.hub / 2);
          hubShape.holes.push(hole(0, 0, bore / 2));
          parts.push(extrude(hubShape, p.hubLen));
        }
        return parts;
      },
    },
    pillow: {
      name: 'Bearing housing',
      blurb: 'A pillow-block style bearing housing with a two-bolt base.',
      params: [
        { key: 'bore', label: 'Bearing seat diameter', min: 20, max: 120, step: 1, val: 47 },
        { key: 'od', label: 'Housing diameter', min: 30, max: 160, step: 1, val: 80 },
        { key: 'w', label: 'Housing width', min: 15, max: 100, step: 1, val: 40 },
        { key: 'ch', label: 'Centre height', min: 25, max: 120, step: 1, val: 50 },
        { key: 'len', label: 'Base length', min: 80, max: 320, step: 1, val: 165 },
        { key: 'hb', label: 'Base thickness', min: 6, max: 40, step: 1, val: 16 },
        { key: 'pitch', label: 'Bolt spacing', min: 50, max: 300, step: 1, val: 125 },
        { key: 'hd', label: 'Bolt hole diameter', min: 6, max: 30, step: 0.5, val: 14 },
      ],
      build(p) {
        const R = p.od / 2, rb = p.bore / 2;
        if (p.bore >= p.od - 10) throw new Error('Leave at least 5 mm of wall around the bearing seat.');
        if (p.ch - rb < p.hb + 3) throw new Error('The bearing seat cuts into the base. Raise the centre height.');
        if (p.pitch / 2 - p.hd / 2 < R + 2) throw new Error('The bolt holes run into the housing. Increase the bolt spacing.');
        if (p.pitch / 2 + p.hd / 2 > p.len / 2 - 3) throw new Error('The bolt holes break through the base ends. Lengthen the base.');
        if (p.hd >= p.w - 4) throw new Error('The bolt holes are wider than the base.');
        const s = new THREE.Shape();
        s.moveTo(-R, p.hb);
        s.lineTo(R, p.hb);
        s.lineTo(R, p.ch);
        s.absarc(0, p.ch, R, 0, Math.PI, false);
        s.closePath();
        s.holes.push(hole(0, p.ch, rb));
        const housing = extrude(s, p.w);
        housing.rotateX(Math.PI / 2);
        housing.translate(0, p.w / 2, 0);
        const base = new THREE.Shape();
        base.moveTo(-p.len / 2, -p.w / 2); base.lineTo(p.len / 2, -p.w / 2); base.lineTo(p.len / 2, p.w / 2); base.lineTo(-p.len / 2, p.w / 2); base.closePath();
        base.holes.push(hole(-p.pitch / 2, 0, p.hd / 2), hole(p.pitch / 2, 0, p.hd / 2));
        return [extrude(base, p.hb, 48), outward(housing)];
      },
    },
    coupling: {
      name: 'Sleeve coupling',
      blurb: 'A rigid sleeve coupling with a through keyway.',
      params: [
        { key: 'od', label: 'Outside diameter', min: 20, max: 160, step: 1, val: 50 },
        { key: 'bore', label: 'Bore diameter', min: 6, max: 110, step: 1, val: 25 },
        { key: 'len', label: 'Length', min: 20, max: 250, step: 1, val: 80 },
        { key: 'kw', label: 'Keyway width', min: 0, max: 28, step: 1, val: 8 },
        { key: 'kd', label: 'Keyway depth in hub', min: 0, max: 10, step: 0.1, val: 3.3 },
      ],
      build(p) {
        const R = p.od / 2, rb = p.bore / 2;
        if (rb + p.kd >= R - 3) throw new Error('Leave at least 3 mm of wall outside the keyway and bore.');
        if (p.kw >= p.bore * 0.6) throw new Error('The keyway is too wide for this bore.');
        const s = disc(R);
        const path = new THREE.Path();
        if (p.kw > 0 && p.kd > 0) {
          const a = Math.asin(p.kw / 2 / rb);
          path.moveTo(p.kw / 2, rb * Math.cos(a));
          path.lineTo(p.kw / 2, rb + p.kd);
          path.lineTo(-p.kw / 2, rb + p.kd);
          path.lineTo(-p.kw / 2, rb * Math.cos(a));
          path.absarc(0, 0, rb, Math.PI / 2 + a, Math.PI / 2 - a + TAU, false);
        } else {
          path.absarc(0, 0, rb, 0, TAU, true);
        }
        s.holes.push(path);
        return [outward(extrude(s, p.len, 72))];
      },
    },
    nut: {
      name: 'Hex nut',
      blurb: 'An ISO 4032 style hex nut. The thread is not modelled, and the hole is shown at tap drill size.',
      params: [
        { key: 'size', label: 'Thread size', min: 0, max: 9, step: 1, val: 4, fmt: v => NUTS[v][0] },
      ],
      build(p) {
        const [, d, pitch, s, m] = NUTS[p.size];
        const hex = new THREE.Shape();
        const r = s / Math.sqrt(3);
        for (let i = 0; i < 6; i++) {
          const a = i * Math.PI / 3;
          if (i) hex.lineTo(r * Math.cos(a), r * Math.sin(a)); else hex.moveTo(r * Math.cos(a), r * Math.sin(a));
        }
        hex.closePath();
        hex.holes.push(hole(0, 0, (d - pitch) / 2));
        return [outward(extrude(hex, m, 48))];
      },
    },
    pulley: {
      name: 'V-belt pulley',
      blurb: 'A multi-groove V-belt pulley with a 38 degree groove angle.',
      params: [
        { key: 'od', label: 'Outside diameter', min: 50, max: 400, step: 1, val: 120 },
        { key: 'bore', label: 'Bore diameter', min: 8, max: 100, step: 1, val: 24 },
        { key: 'n', label: 'Grooves', min: 1, max: 6, step: 1, val: 2, unit: '' },
        { key: 'pitch', label: 'Groove spacing', min: 10, max: 30, step: 0.5, val: 15 },
        { key: 'top', label: 'Groove top width', min: 6, max: 22, step: 0.5, val: 11 },
        { key: 'depth', label: 'Groove depth', min: 5, max: 20, step: 0.5, val: 11 },
        { key: 'edge', label: 'Rim edge width', min: 3, max: 25, step: 0.5, val: 10 },
      ],
      build(p) {
        const Ro = p.od / 2, rb = p.bore / 2;
        const bw = p.top / 2, bb = bw - p.depth * Math.tan(19 * Math.PI / 180);
        if (bb <= 0.5) throw new Error('The grooves are too deep for their width. Make them shallower or wider.');
        if (p.top >= p.pitch) throw new Error('The grooves overlap. Increase the groove spacing.');
        if (Ro - p.depth <= rb + 6) throw new Error('The grooves cut too close to the bore. Reduce the bore or groove depth.');
        const width = 2 * p.edge + p.n * p.pitch;
        const pts = [[rb, 0], [Ro, 0]];
        for (let i = 0; i < p.n; i++) {
          const zc = p.edge + p.pitch * (i + 0.5);
          pts.push([Ro, zc - bw], [Ro - p.depth, zc - bb], [Ro - p.depth, zc + bb], [Ro, zc + bw]);
        }
        pts.push([Ro, width], [rb, width], [rb, 0]);
        return [lathe(pts)];
      },
    },
    elbow: {
      name: '90° pipe elbow',
      blurb: 'A 90 degree pipe bend with straight tangent ends.',
      params: [
        { key: 'od', label: 'Pipe outside diameter', min: 10, max: 220, step: 0.1, val: 60.3 },
        { key: 'wall', label: 'Wall thickness', min: 1, max: 20, step: 0.1, val: 3.9 },
        { key: 'rb', label: 'Bend radius', min: 15, max: 400, step: 1, val: 76 },
        { key: 'tan', label: 'Straight ends', min: 0, max: 150, step: 1, val: 20 },
      ],
      build(p) {
        const ro = p.od / 2, ri = ro - p.wall;
        if (ri <= 1) throw new Error('The wall is too thick for this pipe size.');
        if (p.rb <= ro * 1.05) throw new Error('The bend radius is too tight for this pipe. Increase it.');
        return [elbowGeometry(ro, ri, p.rb, p.tan)];
      },
    },
  };

  /* ISO metric coarse: size, nominal, pitch, across flats, nut height (ISO 4032) */
  const NUTS = [
    ['M3', 3, 0.5, 5.5, 2.4], ['M4', 4, 0.7, 7, 3.2], ['M5', 5, 0.8, 8, 4.7], ['M6', 6, 1, 10, 5.2],
    ['M8', 8, 1.25, 13, 6.8], ['M10', 10, 1.5, 16, 8.4], ['M12', 12, 1.75, 18, 10.8], ['M16', 16, 2, 24, 14.8],
    ['M20', 20, 2.5, 30, 18], ['M24', 24, 3, 36, 21.5],
  ];

  /* A swept tube: straight, 90 degree bend, straight. Built as one closed mesh. */
  function elbowGeometry(ro, ri, R, L) {
    const frames = [];
    const add = (P, N1) => frames.push({ P, N1 });
    if (L > 0) add(new THREE.Vector3(0, 0, -L), new THREE.Vector3(1, 0, 0));
    const steps = 40;
    for (let k = 0; k <= steps; k++) {
      const u = k / steps * Math.PI / 2;
      add(new THREE.Vector3(R * (1 - Math.cos(u)), 0, R * Math.sin(u)), new THREE.Vector3(Math.cos(u), 0, -Math.sin(u)));
    }
    if (L > 0) add(new THREE.Vector3(R + L, 0, R), new THREE.Vector3(0, 0, -1));
    const S = 48, N2 = new THREE.Vector3(0, 1, 0);
    const pos = [];
    frames.forEach(f => {
      [ro, ri].forEach(r => {
        for (let j = 0; j < S; j++) {
          const v = j / S * TAU;
          const e = f.N1.clone().multiplyScalar(Math.cos(v)).addScaledVector(N2, Math.sin(v));
          pos.push(f.P.x + r * e.x, f.P.y + r * e.y, f.P.z + r * e.z);
        }
      });
    });
    const o = (f, j) => f * 2 * S + (j % S);
    const i = (f, j) => f * 2 * S + S + (j % S);
    const idx = [];
    for (let f = 0; f < frames.length - 1; f++) {
      for (let j = 0; j < S; j++) {
        const a = o(f, j), b = o(f + 1, j), c = o(f + 1, j + 1), d = o(f, j + 1);
        idx.push(a, c, b, a, d, c);
        const ai = i(f, j), bi = i(f + 1, j), ci = i(f + 1, j + 1), di = i(f, j + 1);
        idx.push(ai, bi, ci, ai, ci, di);
      }
    }
    const last = frames.length - 1;
    for (let j = 0; j < S; j++) {
      idx.push(o(0, j), i(0, j + 1), o(0, j + 1), o(0, j), i(0, j), i(0, j + 1));
      idx.push(o(last, j), o(last, j + 1), i(last, j + 1), o(last, j), i(last, j + 1), i(last, j));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeBoundingBox();
    geo.translate(0, 0, -geo.boundingBox.min.z);
    geo.computeVertexNormals();
    return outward(geo);
  }

  /* ---------- Display and export ---------- */
  const METAL = 0xb4bcc7;
  const CUT = 0xb5420a;
  function partGroup(geometries, clip) {
    const group = new THREE.Group();
    const planes = clip ? [clip] : [];
    const front = new THREE.MeshStandardMaterial({ color: METAL, metalness: 0.2, roughness: 0.5, clippingPlanes: planes });
    const back = new THREE.MeshBasicMaterial({ color: CUT, side: THREE.BackSide, clippingPlanes: planes });
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x12161f, clippingPlanes: planes });
    geometries.forEach(g => {
      group.add(new THREE.Mesh(g, front));
      group.add(new THREE.Mesh(g, back));
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(g, 25), edgeMat);
      e.userData.edges = true;
      group.add(e);
    });
    return group;
  }
  function disposeGroup(group) {
    group.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  }
  function boxOf(geometries) {
    const box = new THREE.Box3();
    geometries.forEach(g => {
      g.computeBoundingBox();
      box.union(g.boundingBox);
    });
    return box;
  }
  function volumeOf(geometries) {
    return geometries.reduce((sum, g) => sum + Math.abs(signedVolume(g)), 0);
  }
  /* Binary STL, in millimetres. */
  function toSTL(geometries) {
    const tris = geometries.reduce((n, g) => n + (g.index ? g.index.count : g.attributes.position.count) / 3, 0);
    const buf = new ArrayBuffer(84 + tris * 50);
    const view = new DataView(buf);
    const title = 'ME part, millimetres';
    for (let i = 0; i < title.length; i++) view.setUint8(i, title.charCodeAt(i));
    view.setUint32(80, tris, true);
    let at = 84;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), e = new THREE.Vector3();
    geometries.forEach(g => {
      const pos = g.attributes.position, idx = g.index;
      const count = idx ? idx.count : pos.count;
      for (let i = 0; i < count; i += 3) {
        a.fromBufferAttribute(pos, idx ? idx.getX(i) : i);
        b.fromBufferAttribute(pos, idx ? idx.getX(i + 1) : i + 1);
        c.fromBufferAttribute(pos, idx ? idx.getX(i + 2) : i + 2);
        n.subVectors(b, a).cross(e.subVectors(c, a)).normalize();
        [n, a, b, c].forEach(v => {
          view.setFloat32(at, v.x || 0, true);
          view.setFloat32(at + 4, v.y || 0, true);
          view.setFloat32(at + 8, v.z || 0, true);
          at += 12;
        });
        at += 2;
      }
    });
    return buf;
  }

  window.MDM3D = { createView, PARTS, partGroup, disposeGroup, boxOf, volumeOf, toSTL, signedVolume };
})();
