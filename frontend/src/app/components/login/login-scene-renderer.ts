import {
  BoxGeometry, BufferGeometry, CatmullRomCurve3, Color, CylinderGeometry,
  DirectionalLight, EdgesGeometry, Group, HemisphereLight, Line, LineBasicMaterial, LineSegments,
  Material, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, OrthographicCamera,
  RingGeometry, Scene, SphereGeometry, TorusGeometry, TubeGeometry, Vector3, WebGLRenderer
} from 'three';

export type LoginSceneController = (() => void) & {
  playExit: (onComplete: () => void) => void;
};

interface SceneVariant {
  id: string;
  subject: string;
  group: Group;
  update: (time: number, delta: number) => void;
}

const COLORS = {
  base: '#3c5a4d',
  baseBright: '#6e9780',
  blue: '#0098ff',
  mint: '#9fe3c5',
  gold: '#e9b96e',
  coral: '#ff8364',
  dark: '#10201d'
};

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const easeOut = (value: number) => 1 - Math.pow(1 - clamp(value), 3);

function standardMaterial(color: string, options: { opacity?: number; emissive?: string } = {}): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color,
    roughness: 0.78,
    metalness: 0.18,
    transparent: (options.opacity ?? 1) < 1,
    opacity: options.opacity ?? 1,
    emissive: options.emissive ?? COLORS.dark,
    emissiveIntensity: options.emissive ? 0.35 : 0.08
  });
}

function lineMaterial(color: string, opacity = 1): LineBasicMaterial {
  return new LineBasicMaterial({ color, transparent: opacity < 1, opacity });
}

function addLine(group: Group, points: Vector3[], color: string, opacity = 1): Line {
  const line = new Line(new BufferGeometry().setFromPoints(points), lineMaterial(color, opacity));
  group.add(line);
  return line;
}

function addBox(group: Group, size: [number, number, number], position: [number, number, number], color: string, options: { opacity?: number; emissive?: string } = {}): Mesh {
  const mesh = new Mesh(new BoxGeometry(...size), standardMaterial(color, options));
  mesh.position.set(...position);
  group.add(mesh);
  return mesh;
}

function addDot(group: Group, position: [number, number, number], color: string, radius = 0.07): Mesh {
  const mesh = new Mesh(new SphereGeometry(radius, 12, 8), new MeshBasicMaterial({ color }));
  mesh.position.set(...position);
  group.add(mesh);
  return mesh;
}

function addRing(group: Group, radius: number, tube: number, color: string, rotation: [number, number, number] = [Math.PI / 2, 0, 0], opacity = 1): Mesh {
  const ring = new Mesh(new TorusGeometry(radius, tube, 10, 48), new MeshBasicMaterial({ color, transparent: opacity < 1, opacity }));
  ring.rotation.set(...rotation);
  group.add(ring);
  return ring;
}

function addNode(group: Group, position: [number, number, number], color = COLORS.baseBright, size = 0.38): Mesh {
  const node = new Mesh(new BoxGeometry(size, size * 0.68, size), standardMaterial(color, { emissive: color }));
  node.position.set(...position);
  group.add(node);
  return node;
}

function createFocusConstellation(): SceneVariant {
  const group = new Group();
  const core = new Mesh(new CylinderGeometry(0.72, 0.72, 0.18, 12), standardMaterial(COLORS.baseBright, { emissive: COLORS.blue }));
  core.rotation.x = Math.PI / 2;
  group.add(core);
  const rings = [1.1, 1.55, 2.02].map((radius, index) => addRing(group, radius, 0.025, index === 1 ? COLORS.blue : COLORS.baseBright, [Math.PI / 2, index * 0.22, index * 0.12], index === 1 ? 0.9 : 0.46));
  const nodes: Mesh[] = [];
  for (let index = 0; index < 10; index++) {
    const angle = (index / 10) * Math.PI * 2;
    const radius = index % 2 ? 2.55 : 2.05;
    const node = addNode(group, [Math.cos(angle) * radius, Math.sin(angle) * radius * 0.7, (index % 3 - 1) * 0.17], index % 3 === 0 ? COLORS.mint : COLORS.baseBright, 0.3);
    nodes.push(node);
    addLine(group, [new Vector3(0, 0, 0), node.position.clone()], COLORS.blue, 0.22);
  }
  return {
    id: 'focus-constellation', subject: 'Focus constellation', group,
    update: time => {
      group.rotation.z = time * 0.00008;
      rings.forEach((ring, index) => { ring.rotation.z += (index + 1) * 0.00035; });
      core.scale.setScalar(1 + Math.sin(time * 0.0022) * 0.08);
      nodes.forEach((node, index) => { node.position.z = Math.sin(time * 0.0014 + index) * 0.2; });
    }
  };
}

function createLedger(): SceneVariant {
  const group = new Group();
  const sheet = addBox(group, [7.2, 0.08, 4.1], [0, -0.22, 0], COLORS.dark);
  sheet.rotation.x = -0.1;
  const bars: Mesh[] = [];
  const values = [0.58, 0.82, 0.46, 0.72, 0.64, 0.9, 0.52];
  values.forEach((value, index) => {
    const x = -2.9 + index * 0.95;
    addLine(group, [new Vector3(x, 0, -1.45), new Vector3(x, 0, 1.45)], COLORS.base, 0.3);
    bars.push(addBox(group, [0.46, value * 2.3, 0.28], [x, value * 1.15 - 0.15, 0], index === 5 ? COLORS.blue : COLORS.baseBright));
  });
  addLine(group, [new Vector3(-3.35, 0.08, 1.55), new Vector3(3.35, 0.08, 1.55)], COLORS.mint, 0.4);
  addLine(group, [
    new Vector3(-3.25, 0.1, -0.8), new Vector3(-2.1, 0.1, -0.3), new Vector3(-0.8, 0.1, 0.2),
    new Vector3(0.4, 0.1, -0.1), new Vector3(1.6, 0.1, 0.75), new Vector3(3.2, 0.1, 1.25)
  ], COLORS.gold, 0.9);
  for (let row = 0; row < 5; row++) addLine(group, [new Vector3(-3.4, 0.02, -1.15 + row * 0.55), new Vector3(3.4, 0.02, -1.15 + row * 0.55)], COLORS.base, 0.32);
  return {
    id: 'ledger-pulse', subject: 'Bank ledger', group,
    update: time => {
      group.rotation.y = Math.sin(time * 0.00035) * 0.07;
      bars.forEach((bar, index) => {
        const pulse = 0.92 + Math.sin(time * 0.0014 + index * 0.6) * 0.08;
        bar.scale.y = pulse;
        bar.position.y = (values[index] * 2.3 * pulse) / 2 - 0.15;
      });
    }
  };
}

function createTransactionRails(): SceneVariant {
  const group = new Group();
  const rails: Array<{ dots: Mesh[]; offset: number }> = [];
  for (let row = 0; row < 4; row++) {
    const z = -1.5 + row;
    addLine(group, [new Vector3(-3.6, 0, z), new Vector3(3.6, 0, z)], row === 1 ? COLORS.blue : COLORS.baseBright, row === 1 ? 0.9 : 0.38);
    addLine(group, [new Vector3(-3.6, 0, z), new Vector3(-3.6, 0.28, z)], COLORS.mint, 0.45);
    rails.push({ dots: [0, 1, 2].map(index => addDot(group, [-3.6 + index * 1.8, 0.06, z], index === 1 ? COLORS.gold : COLORS.mint, 0.1)), offset: row * 0.22 });
  }
  for (let index = 0; index < 7; index++) {
    const x = -2.7 + index * 0.9;
    addBox(group, [0.18, 0.45 + (index % 3) * 0.25, 0.18], [x, 0.24, 0.05], index === 3 ? COLORS.blue : COLORS.base);
  }
  return {
    id: 'transaction-rails', subject: 'Fintech transaction rails', group,
    update: time => rails.forEach((rail, row) => rail.dots.forEach((dot, index) => {
      const progress = ((time * 0.00016 + rail.offset + index * 0.28) % 1);
      dot.position.x = -3.6 + progress * 7.2;
      dot.position.y = 0.07 + Math.sin(time * 0.002 + row) * 0.035;
    }))
  };
}

function createDecisionTree(): SceneVariant {
  const group = new Group();
  const positions: Array<[number, number, number]> = [[-2.8, 0, 0], [-1.0, 0.9, 0], [-1.0, -0.9, 0], [1.0, 1.45, 0], [1.0, 0.3, 0], [1.0, -0.55, 0], [1.0, -1.65, 0], [3, 1.45, 0], [3, 0.3, 0], [3, -0.55, 0], [3, -1.65, 0]];
  const nodes = positions.map((position, index) => addNode(group, position, index === 0 ? COLORS.blue : (index > 6 ? COLORS.mint : COLORS.baseBright), index === 0 ? 0.48 : 0.32));
  const edges: Line[] = [];
  [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [2, 6], [3, 7], [4, 8], [5, 9], [6, 10]].forEach(([from, to], index) => {
    edges.push(addLine(group, [nodes[from].position.clone(), nodes[to].position.clone()], index % 3 === 0 ? COLORS.blue : COLORS.baseBright, index % 3 === 0 ? 0.8 : 0.42));
  });
  return {
    id: 'decision-tree', subject: 'Decision tree', group,
    update: time => {
      const active = Math.floor(time * 0.0012) % edges.length;
      edges.forEach((edge, index) => { (edge.material as LineBasicMaterial).opacity = index === active ? 1 : 0.36; });
      group.rotation.y = Math.sin(time * 0.0003) * 0.06;
    }
  };
}

function createCreditOrbit(): SceneVariant {
  const group = new Group();
  const core = new Mesh(new CylinderGeometry(0.55, 0.55, 0.6, 8), standardMaterial(COLORS.blue, { emissive: COLORS.blue }));
  core.rotation.x = Math.PI / 2;
  group.add(core);
  const rings = [1.05, 1.6, 2.25].map((radius, index) => addRing(group, radius, 0.035, index === 1 ? COLORS.mint : COLORS.baseBright, [Math.PI / 2 + index * 0.28, index * 0.18, 0], index === 1 ? 0.85 : 0.52));
  const satellites = [0, 1, 2, 3, 4].map(index => addDot(group, [0, 0, 0], index === 2 ? COLORS.gold : COLORS.mint, 0.12));
  return {
    id: 'credit-orbit', subject: 'Credit orbit', group,
    update: time => {
      rings.forEach((ring, index) => { ring.rotation.x += 0.0004 * (index + 1); ring.rotation.y += 0.00025 * (index + 1); });
      satellites.forEach((satellite, index) => {
        const angle = time * 0.0007 * (index % 2 ? -1 : 1) + index * 1.25;
        const radius = 1.05 + (index % 2) * 0.8;
        satellite.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.54, Math.sin(angle * 1.6) * 0.35);
      });
      core.rotation.z = time * 0.00035;
    }
  };
}

function createSecureVault(): SceneVariant {
  const group = new Group();
  const plate = new Mesh(new CylinderGeometry(2.1, 2.1, 0.18, 8), standardMaterial(COLORS.base, { emissive: COLORS.dark }));
  plate.rotation.x = Math.PI / 2;
  group.add(plate);
  const outline = new LineSegments(new EdgesGeometry(plate.geometry), lineMaterial(COLORS.mint, 0.72));
  outline.rotation.copy(plate.rotation);
  group.add(outline);
  const lock = addBox(group, [0.62, 0.18, 0.9], [0, 0, 0], COLORS.blue, { emissive: COLORS.blue });
  const bars = [0, 1, 2, 3].map(index => {
    const bar = addBox(group, [0.12, 0.1, 2.8], [0, 0.12, 0], index === 1 ? COLORS.gold : COLORS.baseBright);
    bar.rotation.y = index * Math.PI / 4;
    return bar;
  });
  return {
    id: 'secure-vault', subject: 'Secure vault', group,
    update: time => {
      group.rotation.z = time * 0.00016;
      lock.scale.setScalar(0.96 + Math.sin(time * 0.002) * 0.06);
      bars.forEach((bar, index) => { bar.rotation.y = index * Math.PI / 4 + time * 0.0002 * (index % 2 ? -1 : 1); });
    }
  };
}

function createSignalNetwork(): SceneVariant {
  const group = new Group();
  const center = addDot(group, [0, 0, 0], COLORS.blue, 0.25);
  const satellites: Mesh[] = [];
  for (let index = 0; index < 12; index++) {
    const angle = (index / 12) * Math.PI * 2;
    const radius = index % 3 === 0 ? 2.7 : 2.1;
    const node = addDot(group, [Math.cos(angle) * radius, Math.sin(angle) * radius * 0.7, (index % 4 - 1.5) * 0.28], index % 3 === 0 ? COLORS.mint : COLORS.baseBright, index % 3 === 0 ? 0.13 : 0.08);
    satellites.push(node);
    addLine(group, [center.position.clone(), node.position.clone()], index % 4 === 0 ? COLORS.blue : COLORS.baseBright, index % 4 === 0 ? 0.82 : 0.24);
  }
  const pulse = addDot(group, [0, 0, 0], COLORS.gold, 0.09);
  return {
    id: 'signal-network', subject: 'Signal network', group,
    update: time => {
      group.rotation.z = Math.sin(time * 0.0004) * 0.08;
      const angle = time * 0.0015;
      pulse.position.set(Math.cos(angle) * 2.5, Math.sin(angle) * 1.75, 0.1);
      center.scale.setScalar(1 + Math.sin(time * 0.002) * 0.16);
      satellites.forEach((node, index) => { node.scale.setScalar(0.8 + (Math.sin(time * 0.0017 + index) + 1) * 0.12); });
    }
  };
}

function createFocusLens(): SceneVariant {
  const group = new Group();
  const lens = new Mesh(new RingGeometry(0.6, 1.3, 32), new MeshBasicMaterial({ color: COLORS.blue, transparent: true, opacity: 0.42, side: 2 }));
  lens.rotation.x = Math.PI / 2;
  group.add(lens);
  const rings = [1.55, 2.05, 2.52].map((radius, index) => addRing(group, radius, index === 2 ? 0.045 : 0.024, index === 1 ? COLORS.mint : COLORS.baseBright, [Math.PI / 2, index * 0.36, index * 0.15], index === 1 ? 0.75 : 0.42));
  const blades: Mesh[] = [];
  for (let index = 0; index < 6; index++) {
    const angle = index * Math.PI / 3;
    const blade = addBox(group, [0.12, 0.12, 1.9], [Math.cos(angle) * 0.72, Math.sin(angle) * 0.72, 0], index === 0 ? COLORS.gold : COLORS.base);
    blade.rotation.y = angle;
    blades.push(blade);
  }
  return {
    id: 'focus-lens', subject: 'Focus lens', group,
    update: time => {
      lens.rotation.z = time * 0.0005;
      rings.forEach((ring, index) => { ring.rotation.z += 0.00025 * (index + 1); });
      blades.forEach(blade => { blade.scale.z = 0.9 + Math.sin(time * 0.0012) * 0.12; });
    }
  };
}

function createMarketChart(): SceneVariant {
  const group = new Group();
  const candles: Mesh[] = [];
  const wickLines: Line[] = [];
  const data = [0.35, 0.58, 0.42, 0.72, 0.62, 0.86, 0.7, 1.02, 0.88, 1.18];
  data.forEach((value, index) => {
    const x = -3.15 + index * 0.7;
    candles.push(addBox(group, [0.28, 0.42 + (index % 3) * 0.11, 0.36], [x, value - 0.5, 0], index % 3 === 0 ? COLORS.coral : COLORS.mint));
    wickLines.push(addLine(group, [new Vector3(x, value - 0.9, 0), new Vector3(x, value + 0.35, 0)], COLORS.baseBright, 0.7));
  });
  const curve = new CatmullRomCurve3(data.map((value, index) => new Vector3(-3.15 + index * 0.7, value + 0.45, 0.24)));
  group.add(new Mesh(new TubeGeometry(curve, 48, 0.028, 6, false), new MeshBasicMaterial({ color: COLORS.blue })));
  for (let row = 0; row < 4; row++) addLine(group, [new Vector3(-3.6, -0.7 + row * 0.6, -0.2), new Vector3(3.6, -0.7 + row * 0.6, -0.2)], COLORS.base, 0.28);
  return {
    id: 'market-chart', subject: 'Fintech market chart', group,
    update: time => {
      group.rotation.y = Math.sin(time * 0.00028) * 0.06;
      candles.forEach((candle, index) => { candle.position.y = data[index] - 0.5 + Math.sin(time * 0.0011 + index * 0.5) * 0.035; });
      wickLines.forEach((line, index) => { line.position.y = Math.sin(time * 0.0011 + index * 0.5) * 0.035; });
    }
  };
}

function createBlueprintGrid(): SceneVariant {
  const group = new Group();
  const blocks: Mesh[] = [];
  const blockBases: number[] = [];
  for (let row = 0; row < 4; row++) {
    for (let column = 0; column < 7; column++) {
      const height = 0.18 + ((row * 3 + column * 5) % 5) * 0.12;
      const block = addBox(group, [0.58, height, 0.58], [-2.1 + column * 0.7, height / 2 - 0.65, -1.15 + row * 0.76], (row + column) % 5 === 0 ? COLORS.blue : COLORS.base);
      blocks.push(block);
      blockBases.push(block.position.y);
      addLine(group, [new Vector3(block.position.x - 0.29, -0.67, block.position.z), new Vector3(block.position.x + 0.29, -0.67, block.position.z)], COLORS.baseBright, 0.34);
    }
  }
  const scanner = addBox(group, [0.035, 0.04, 3.5], [-2.45, 0.22, 0], COLORS.gold, { emissive: COLORS.gold });
  addLine(group, [new Vector3(-2.5, -0.68, -1.5), new Vector3(2.5, -0.68, -1.5), new Vector3(2.5, -0.68, 1.5), new Vector3(-2.5, -0.68, 1.5), new Vector3(-2.5, -0.68, -1.5)], COLORS.mint, 0.5);
  return {
    id: 'blueprint-grid', subject: 'Operations blueprint', group,
    update: time => {
      scanner.position.x = -2.45 + ((time * 0.00055) % 1) * 5;
      blocks.forEach((block, index) => { block.position.y = blockBases[index] + Math.sin(time * 0.001 + index) * 0.025; });
      group.rotation.y = Math.sin(time * 0.00025) * 0.07;
    }
  };
}

const VARIANT_BUILDERS = [
  createFocusConstellation, createLedger, createTransactionRails, createDecisionTree,
  createCreditOrbit, createSecureVault, createSignalNetwork, createFocusLens,
  createMarketChart, createBlueprintGrid
];

function disposeObject(root: Object3D): void {
  root.traverse(child => {
    const renderable = child as Mesh & { material?: Material | Material[]; geometry?: BufferGeometry };
    renderable.geometry?.dispose();
    const materials = Array.isArray(renderable.material) ? renderable.material : [renderable.material];
    materials.forEach(material => material?.dispose());
  });
}

// One renderer, ten authored subjects. The lifecycle is shared so route changes stay clean.
export function createLoginScene(canvas: HTMLCanvasElement): LoginSceneController {
  const fallback = () => {
    const controller = (() => {}) as LoginSceneController;
    controller.playExit = onComplete => onComplete();
    return controller;
  };
  const parent = canvas.parentElement?.parentElement;
  if (!parent) return fallback();
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = window.matchMedia('(pointer: coarse)');
  let renderer: WebGLRenderer;
  try {
    if (!canvas.getContext('webgl2', { alpha: false, antialias: true })) return fallback();
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power' });
  } catch { return fallback(); }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setClearColor('#192724');
  const scene = new Scene();
  scene.background = new Color('#192724');
  const camera = new OrthographicCamera(-5, 5, 5, -5, 0.1, 80);
  camera.position.set(9, 10, 13);
  camera.lookAt(0, 0, 0);
  const system = new Group();
  scene.add(system);
  scene.add(new HemisphereLight('#f0f6f4', '#233c33', 2.4));
  const light = new DirectionalLight('#ffffff', 3);
  light.position.set(-4, 9, 5);
  scene.add(light);

  const variant = VARIANT_BUILDERS[Math.floor(Math.random() * VARIANT_BUILDERS.length)]();
  system.add(variant.group);
  canvas.dataset['animationVariant'] = variant.id;
  canvas.dataset['animationSubject'] = variant.subject;

  let disposed = false;
  let intersecting = false;
  let contextLost = false;
  let width = 0;
  let height = 0;
  let frame = 0;
  let lastTime = 0;
  let targetX = 0;
  let targetY = -0.1;
  let introStarted = false;
  let introStart = 0;
  let exitRequested = false;
  let exitStart = 0;
  let exitCallback: (() => void) | undefined;
  let exitTimer: number | undefined;
  const introDuration = 1500;
  const exitDuration = 820;
  const setActive = (active: boolean) => { canvas.dataset['animationActive'] = String(active); };
  const stop = () => { if (frame) cancelAnimationFrame(frame); frame = 0; setActive(false); };
  const canRender = () => !disposed && !contextLost && intersecting && !document.hidden && width > 0 && height > 0;
  const draw = () => {
    renderer.render(scene, camera);
    canvas.dataset['ready'] = 'true';
    canvas.dataset['drawCalls'] = String(renderer.info.render.calls);
  };
  const completeExit = () => {
    const callback = exitCallback;
    if (!callback) return;
    exitCallback = undefined;
    exitRequested = false;
    if (exitTimer !== undefined) {
      window.clearTimeout(exitTimer);
      exitTimer = undefined;
    }
    stop();
    callback();
  };
  const updateIntro = (now: number): boolean => {
    if (!introStarted) return false;
    const progress = clamp((now - introStart) / introDuration);
    const eased = easeOut(progress);
    system.position.y = Math.sin(progress * Math.PI) * 0.05;
    system.rotation.z = (1 - eased) * 0.018;
    system.scale.setScalar(0.9 + eased * 0.1);
    return progress < 1;
  };
  const updateExit = (now: number): boolean => {
    if (!exitRequested) return false;
    const progress = clamp((now - exitStart) / exitDuration);
    const eased = easeOut(progress);
    system.position.y = eased * 0.12;
    system.rotation.z = eased * 0.045;
    system.scale.setScalar(1 + eased * 0.08);
    return progress < 1;
  };
  const tick = (now: number) => {
    frame = 0;
    if (!canRender()) { stop(); return; }
    const delta = Math.min((now - lastTime) / 1000 || 0, 0.05);
    lastTime = now;
    const blend = 1 - Math.exp(-10 * delta);
    system.rotation.x += (targetX - system.rotation.x) * blend;
    system.rotation.y += (targetY - system.rotation.y) * blend;
    variant.update(now, delta);
    const introRunning = updateIntro(now);
    const exitRunning = updateExit(now);
    draw();
    if (exitRequested && !exitRunning) {
      completeExit();
      return;
    }
    if (introRunning || exitRunning || !reduced.matches) frame = requestAnimationFrame(tick);
  };
  const resume = () => {
    stop();
    if (!canRender()) return;
    if (reduced.matches) {
      system.position.set(0, 0, 0);
      system.rotation.set(0, -0.1, 0);
      system.scale.setScalar(1);
      variant.update(0, 0);
      draw();
      return;
    }
    if (!introStarted) {
      introStarted = true;
      introStart = performance.now();
    }
    lastTime = performance.now();
    setActive(true);
    frame = requestAnimationFrame(tick);
  };
  const pointer = (event: PointerEvent) => {
    if (coarse.matches || reduced.matches || !canRender()) return;
    const bounds = parent.getBoundingClientRect();
    targetX = ((event.clientY - bounds.top) / bounds.height - 0.5) * 0.035;
    targetY = -0.1 + ((event.clientX - bounds.left) / bounds.width - 0.5) * 0.065;
    if (!frame) resume();
  };
  const resetPointer = () => { targetX = 0; targetY = -0.1; if (!frame) resume(); };
  const resize = new ResizeObserver(entries => {
    const size = entries[0].contentRect;
    width = size.width;
    height = size.height;
    if (!width || !height) { stop(); return; }
    const aspect = width / height;
    const vertical = Math.max(5, 4.7 / aspect);
    camera.left = -vertical * aspect;
    camera.right = vertical * aspect;
    camera.top = vertical;
    camera.bottom = -vertical;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    resume();
  });
  const intersection = new IntersectionObserver(entries => {
    intersecting = entries[0].isIntersecting;
    resume();
  });
  const lost = (event: Event) => { event.preventDefault(); contextLost = true; stop(); delete canvas.dataset['ready']; };
  const restored = () => { contextLost = false; resume(); };
  const controller = (() => {
    disposed = true;
    stop();
    resize.disconnect();
    intersection.disconnect();
    if (exitTimer !== undefined) window.clearTimeout(exitTimer);
    exitCallback = undefined;
    parent.removeEventListener('pointermove', pointer);
    parent.removeEventListener('pointerleave', resetPointer);
    document.removeEventListener('visibilitychange', resume);
    window.removeEventListener('blur', resetPointer);
    reduced.removeEventListener('change', resume);
    canvas.removeEventListener('webglcontextlost', lost);
    canvas.removeEventListener('webglcontextrestored', restored);
    disposeObject(system);
    scene.clear();
    renderer.dispose();
    renderer.forceContextLoss();
    delete canvas.dataset['ready'];
  }) as LoginSceneController;
  controller.playExit = (onComplete: () => void) => {
    if (disposed || reduced.matches) { onComplete(); return; }
    exitCallback = onComplete;
    exitRequested = true;
    exitStart = performance.now();
    exitTimer = window.setTimeout(completeExit, exitDuration + 140);
    targetX = 0;
    targetY = -0.1;
    if (!frame) resume();
  };
  resize.observe(canvas.parentElement!);
  intersection.observe(canvas);
  parent.addEventListener('pointermove', pointer, { passive: true });
  parent.addEventListener('pointerleave', resetPointer);
  document.addEventListener('visibilitychange', resume);
  window.addEventListener('blur', resetPointer);
  reduced.addEventListener('change', resume);
  canvas.addEventListener('webglcontextlost', lost);
  canvas.addEventListener('webglcontextrestored', restored);
  return controller;
}
