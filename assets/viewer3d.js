/* MDM 3D viewer: a Z-up orbit view and parametric part models, all in millimetres. */
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
      orbit.radius = span / (2 * fit) * 0.95;
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
  };

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
    const title = 'MDM part, millimetres';
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
