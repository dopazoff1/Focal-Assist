import {
  AdditiveBlending, AmbientLight, BoxGeometry, BufferGeometry, Color,
  DirectionalLight, DynamicDrawUsage, EdgesGeometry, Float32BufferAttribute,
  GridHelper, Group, IcosahedronGeometry, InstancedMesh, LineBasicMaterial,
  LineSegments, Matrix4, Material, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  Object3D, PerspectiveCamera, PointLight, Points, PointsMaterial, Scene,
  SphereGeometry, TorusGeometry, Vector3, WebGLRenderer
} from 'three';

export type LoginV2SceneController = (() => void) & {
  playExit: (onComplete: () => void) => void;
};

const COLORS = {
  ink: '#071512',
  forest: '#12392e',
  green: '#3c5a4d',
  sage: '#8ab6a0',
  mint: '#b7ead1',
  blue: '#0098ff',
  gold: '#e9b96e',
  coral: '#ff8364'
};

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const easeOut = (value: number) => 1 - Math.pow(1 - clamp(value), 3);

function material(color: string, options: { emissive?: string; metalness?: number; roughness?: number; opacity?: number } = {}): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color,
    emissive: options.emissive ?? COLORS.ink,
    emissiveIntensity: options.emissive ? 0.7 : 0.12,
    metalness: options.metalness ?? 0.36,
    roughness: options.roughness ?? 0.52,
    transparent: (options.opacity ?? 1) < 1,
    opacity: options.opacity ?? 1
  });
}

function addLine(group: Group, points: Vector3[], color: string, opacity = 1): LineSegments {
  const geometry = new BufferGeometry().setFromPoints(points);
  const line = new LineSegments(geometry, new LineBasicMaterial({ color, transparent: opacity < 1, opacity }));
  group.add(line);
  return line;
}

function disposeObject(root: Object3D): void {
  root.traverse(child => {
    const renderable = child as Mesh & { material?: Material | Material[]; geometry?: BufferGeometry };
    renderable.geometry?.dispose();
    const materials = Array.isArray(renderable.material) ? renderable.material : [renderable.material];
    materials.forEach(item => item?.dispose());
  });
}

function createParticles(group: Group): { points: Points; bases: Float32Array; seeds: Float32Array } {
  const count = 620;
  const positions = new Float32Array(count * 3);
  const bases = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let index = 0; index < count; index++) {
    const offset = index * 3;
    const radius = 3.4 + Math.random() * 5.6;
    const theta = Math.random() * Math.PI * 2;
    const y = (Math.random() - 0.5) * 5.8;
    const x = Math.cos(theta) * radius;
    const z = Math.sin(theta) * radius - 1.3;
    positions[offset] = bases[offset] = x;
    positions[offset + 1] = bases[offset + 1] = y;
    positions[offset + 2] = bases[offset + 2] = z;
    seeds[index] = Math.random() * Math.PI * 2;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  const points = new Points(geometry, new PointsMaterial({
    color: COLORS.sage,
    size: 0.035,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
    blending: AdditiveBlending
  }));
  group.add(points);
  return { points, bases, seeds };
}

function createSignalArray(): {
  group: Group;
  update: (time: number, delta: number, pointerX: number, pointerY: number) => void;
} {
  const group = new Group();
  const world = new Group();
  world.position.set(0.45, -0.1, 0);
  group.add(world);

  const particles = createParticles(group);
  const grid = new GridHelper(15, 30, new Color('#3c5a4d'), new Color('#19362d'));
  grid.position.set(0, -2.28, -1.7);
  const gridMaterial = (grid.material as Material & { transparent?: boolean; opacity?: number });
  gridMaterial.transparent = true;
  gridMaterial.opacity = 0.38;
  world.add(grid);

  const core = new Group();
  core.position.set(0.15, 0.12, 0);
  world.add(core);
  const coreMesh = new Mesh(
    new IcosahedronGeometry(0.78, 3),
    material(COLORS.forest, { emissive: COLORS.blue, metalness: 0.74, roughness: 0.24 })
  );
  core.add(coreMesh);
  const coreShell = new Mesh(
    new IcosahedronGeometry(0.98, 2),
    new MeshBasicMaterial({ color: COLORS.mint, wireframe: true, transparent: true, opacity: 0.34 })
  );
  core.add(coreShell);
  const coreOutline = new LineSegments(
    new EdgesGeometry(new IcosahedronGeometry(1.16, 1)),
    new LineBasicMaterial({ color: COLORS.gold, transparent: true, opacity: 0.8 })
  );
  core.add(coreOutline);

  const rings: Mesh[] = [];
  [1.34, 1.68, 2.02].forEach((radius, index) => {
    const ring = new Mesh(
      new TorusGeometry(radius, index === 1 ? 0.022 : 0.012, 10, 64),
      new MeshBasicMaterial({
        color: index === 1 ? COLORS.blue : COLORS.sage,
        transparent: true,
        opacity: index === 1 ? 0.88 : 0.52,
        blending: AdditiveBlending
      })
    );
    ring.rotation.set(Math.PI / 2 + index * 0.25, index * 0.45, index * 0.12);
    rings.push(ring);
    core.add(ring);
  });

  const nodeGeometry = new BoxGeometry(0.12, 0.12, 0.12);
  const nodeMaterial = material(COLORS.sage, { emissive: COLORS.sage, metalness: 0.5, roughness: 0.38 });
  const nodeMesh = new InstancedMesh(nodeGeometry, nodeMaterial, 96);
  nodeMesh.instanceMatrix.setUsage(DynamicDrawUsage);
  world.add(nodeMesh);
  const nodePositions: Vector3[] = [];
  const dummy = new Object3D();
  const matrix = new Matrix4();
  const nodePalette = [COLORS.sage, COLORS.mint, COLORS.blue, COLORS.gold, COLORS.coral];
  for (let index = 0; index < 96; index++) {
    const layer = Math.floor(index / 24);
    const local = index % 24;
    const angle = local / 24 * Math.PI * 2 + layer * 0.4;
    const radius = 2.32 + layer * 0.38 + Math.sin(local * 1.7) * 0.08;
    const position = new Vector3(
      Math.cos(angle) * radius,
      Math.sin(local * 0.72 + layer) * 1.5 + (layer - 1.5) * 0.18,
      Math.sin(angle) * radius * 0.68 - 0.2
    );
    nodePositions.push(position);
    dummy.position.copy(position);
    dummy.rotation.set(angle * 0.35, angle, local * 0.08);
    dummy.scale.setScalar(index % 11 === 0 ? 1.65 : index % 5 === 0 ? 1.25 : 1);
    dummy.updateMatrix();
    nodeMesh.setMatrixAt(index, dummy.matrix);
    nodeMesh.setColorAt(index, new Color(nodePalette[index % nodePalette.length]));
  }
  nodeMesh.instanceMatrix.needsUpdate = true;
  if (nodeMesh.instanceColor) nodeMesh.instanceColor.needsUpdate = true;

  const edgeCount = 112;
  const edgePositions = new Float32Array(edgeCount * 2 * 3);
  const edgeGeometry = new BufferGeometry();
  const edgeAttribute = new Float32BufferAttribute(edgePositions, 3);
  edgeAttribute.setUsage(DynamicDrawUsage);
  edgeGeometry.setAttribute('position', edgeAttribute);
  const edges = new LineSegments(edgeGeometry, new LineBasicMaterial({ color: COLORS.green, transparent: true, opacity: 0.62 }));
  world.add(edges);

  const dataColumns: Mesh[] = [];
  for (let index = 0; index < 9; index++) {
    const height = 0.28 + (index % 5) * 0.21;
    const column = new Mesh(
      new BoxGeometry(0.24, height, 0.24),
      material(index % 4 === 0 ? COLORS.blue : COLORS.green, { emissive: index % 4 === 0 ? COLORS.blue : COLORS.green })
    );
    column.position.set(-3.3 + index * 0.83, -1.98 + height / 2, -2.35 + (index % 2) * 0.18);
    world.add(column);
    dataColumns.push(column);
  }

  const scanLine = new Mesh(
    new BoxGeometry(0.018, 4.25, 0.018),
    new MeshBasicMaterial({ color: COLORS.gold, transparent: true, opacity: 0.92, blending: AdditiveBlending })
  );
  scanLine.position.set(-3.65, 0, 0.2);
  world.add(scanLine);

  const relay = new Mesh(
    new SphereGeometry(0.1, 14, 10),
    new MeshBasicMaterial({ color: COLORS.coral, transparent: true, opacity: 0.95, blending: AdditiveBlending })
  );
  world.add(relay);

  const update = (time: number, delta: number, pointerX: number, pointerY: number) => {
    const seconds = time * 0.001;
    core.rotation.y += delta * 0.34;
    core.rotation.x = Math.sin(seconds * 0.44) * 0.1 + pointerY * 0.05;
    coreMesh.rotation.z = Math.sin(seconds * 0.7) * 0.16;
    coreShell.rotation.y -= delta * 0.55;
    coreOutline.rotation.x += delta * 0.22;
    rings.forEach((ring, index) => {
      ring.rotation.z += delta * (index % 2 === 0 ? 0.16 : -0.22);
      ring.rotation.x += delta * (index + 1) * 0.04;
    });

    const particleAttribute = particles.points.geometry.getAttribute('position') as Float32BufferAttribute;
    for (let index = 0; index < particles.seeds.length; index++) {
      const offset = index * 3;
      const seed = particles.seeds[index];
      particleAttribute.array[offset] = particles.bases[offset] + Math.sin(seconds * 0.17 + seed) * 0.08;
      particleAttribute.array[offset + 1] = particles.bases[offset + 1] + Math.cos(seconds * 0.21 + seed) * 0.06;
      particleAttribute.array[offset + 2] = particles.bases[offset + 2] + Math.sin(seconds * 0.13 + seed) * 0.1;
    }
    particleAttribute.needsUpdate = true;

    for (let index = 0; index < nodePositions.length; index++) {
      const position = nodePositions[index];
      const phase = seconds * 0.18 + index * 0.11;
      const animatedY = position.y + Math.sin(phase) * 0.07;
      dummy.position.set(position.x, animatedY, position.z);
      dummy.rotation.set(phase * 0.24, phase * 0.38, phase * 0.12);
      dummy.scale.setScalar(index % 11 === 0 ? 1.65 + Math.sin(phase) * 0.18 : index % 5 === 0 ? 1.25 : 1);
      dummy.updateMatrix();
      nodeMesh.setMatrixAt(index, dummy.matrix);
      const edgeOffset = (index % (edgeCount * 2)) * 3;
      if (edgeOffset + 2 < edgePositions.length) {
        edgePositions[edgeOffset] = position.x;
        edgePositions[edgeOffset + 1] = animatedY;
        edgePositions[edgeOffset + 2] = position.z;
      }
    }
    for (let edge = 0; edge < edgeCount; edge++) {
      const from = (edge * 7) % nodePositions.length;
      const to = (from + 1 + (edge % 6) * 4) % nodePositions.length;
      const fromPosition = nodePositions[from];
      const toPosition = nodePositions[to];
      const offset = edge * 6;
      edgePositions[offset] = fromPosition.x;
      edgePositions[offset + 1] = fromPosition.y + Math.sin(seconds * 0.18 + from) * 0.07;
      edgePositions[offset + 2] = fromPosition.z;
      edgePositions[offset + 3] = toPosition.x;
      edgePositions[offset + 4] = toPosition.y + Math.sin(seconds * 0.18 + to) * 0.07;
      edgePositions[offset + 5] = toPosition.z;
    }
    nodeMesh.instanceMatrix.needsUpdate = true;
    edgeAttribute.needsUpdate = true;

    dataColumns.forEach((column, index) => {
      const pulse = 0.82 + Math.sin(seconds * 1.5 + index * 0.7) * 0.17;
      column.scale.y = pulse;
      column.position.y = -1.98 + (column.geometry as BoxGeometry).parameters.height * pulse / 2;
    });
    scanLine.position.x = -3.65 + ((seconds * 0.48) % 1) * 7.3;
    scanLine.material.opacity = 0.5 + Math.sin(seconds * 4) * 0.25;
    relay.position.set(Math.sin(seconds * 0.8) * 2.55, Math.cos(seconds * 1.1) * 1.25, 0.8);
    relay.scale.setScalar(0.8 + (Math.sin(seconds * 3.4) + 1) * 0.28);
    world.rotation.y = Math.sin(seconds * 0.12) * 0.07 + pointerX * 0.08;
    world.rotation.x = pointerY * 0.055;
  };

  return { group, update };
}

export function createLoginV2Scene(canvas: HTMLCanvasElement): LoginV2SceneController {
  const fallback = () => {
    const controller = (() => {}) as LoginV2SceneController;
    controller.playExit = onComplete => onComplete();
    return controller;
  };
  const parent = canvas.parentElement?.parentElement;
  if (!parent) return fallback();

  let renderer: WebGLRenderer;
  try {
    if (!canvas.getContext('webgl2', { alpha: false, antialias: true })) return fallback();
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch {
    return fallback();
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setClearColor(COLORS.ink);

  const scene = new Scene();
  scene.background = new Color(COLORS.ink);
  const camera = new PerspectiveCamera(38, 1, 0.1, 80);
  camera.position.set(0.2, 1.9, 10.8);
  camera.lookAt(0.7, 0, 0);
  scene.add(new AmbientLight('#9dbcae', 1.25));
  const keyLight = new DirectionalLight('#ecfff6', 3.2);
  keyLight.position.set(-4, 6, 6);
  scene.add(keyLight);
  const cursorLight = new PointLight(COLORS.blue, 4.5, 11);
  cursorLight.position.set(1, 2, 4);
  scene.add(cursorLight);

  const root = new Group();
  scene.add(root);
  const array = createSignalArray();
  root.add(array.group);

  let disposed = false;
  let intersecting = false;
  let contextLost = false;
  let frame = 0;
  let width = 0;
  let height = 0;
  let lastTime = 0;
  let targetX = 0;
  let targetY = 0;
  let introStarted = false;
  let introStart = 0;
  let exitRequested = false;
  let exitStart = 0;
  let exitCallback: (() => void) | undefined;
  let exitTimer: number | undefined;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = window.matchMedia('(pointer: coarse)');
  const introDuration = 1450;
  const exitDuration = 760;
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
    if (exitTimer !== undefined) window.clearTimeout(exitTimer);
    exitTimer = undefined;
    stop();
    callback();
  };
  const resize = new ResizeObserver(entries => {
    const rect = entries[0]?.contentRect;
    if (!rect) return;
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (!frame && canRender()) resume();
  });
  const updateIntro = (now: number) => {
    if (!introStarted) return false;
    const progress = clamp((now - introStart) / introDuration);
    const eased = easeOut(progress);
    root.position.x = (1 - eased) * 0.6;
    root.position.z = (1 - eased) * 1.2;
    root.rotation.z = (1 - eased) * 0.025;
    root.scale.setScalar(0.86 + eased * 0.14);
    return progress < 1;
  };
  const updateExit = (now: number) => {
    if (!exitRequested) return false;
    const progress = clamp((now - exitStart) / exitDuration);
    const eased = easeOut(progress);
    root.position.z = eased * 1.25;
    root.rotation.z = eased * 0.055;
    root.scale.setScalar(1 + eased * 0.12);
    return progress < 1;
  };
  const tick = (now: number) => {
    frame = 0;
    if (!canRender()) { stop(); return; }
    const delta = Math.min((now - lastTime) / 1000 || 0, 0.05);
    lastTime = now;
    const blend = 1 - Math.exp(-7 * delta);
    const pointerX = coarse.matches || reduced.matches ? 0 : targetX;
    const pointerY = coarse.matches || reduced.matches ? 0 : targetY;
    camera.position.x += (0.2 + pointerX * 0.92 - camera.position.x) * blend;
    camera.position.y += (1.9 - pointerY * 0.72 - camera.position.y) * blend;
    camera.lookAt(0.7 + pointerX * 0.18, pointerY * 0.12, 0);
    cursorLight.position.set(pointerX * 4.5, 2.2 - pointerY * 2.2, 4.2);
    array.update(now, delta, pointerX, pointerY);
    const introRunning = updateIntro(now);
    const exitRunning = updateExit(now);
    draw();
    if (exitRequested && !exitRunning) { completeExit(); return; }
    if (introRunning || exitRunning || !reduced.matches) frame = requestAnimationFrame(tick);
  };
  const resume = () => {
    stop();
    if (!canRender()) return;
    if (reduced.matches) {
      root.position.set(0, 0, 0);
      root.rotation.set(0, 0, 0);
      root.scale.setScalar(1);
      array.update(0, 0, 0, 0);
      draw();
      return;
    }
    if (!introStarted) { introStarted = true; introStart = performance.now(); }
    lastTime = performance.now();
    setActive(true);
    frame = requestAnimationFrame(tick);
  };
  const pointer = (event: PointerEvent) => {
    if (coarse.matches || reduced.matches || !canRender()) return;
    const rect = parent.getBoundingClientRect();
    targetX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    targetY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    if (!frame) resume();
  };
  const resetPointer = () => { targetX = 0; targetY = 0; if (!frame) resume(); };
  const onVisibility = () => { if (document.hidden) stop(); else resume(); };
  const onContextLost = (event: Event) => { event.preventDefault(); contextLost = true; stop(); };
  const onContextRestored = () => { contextLost = false; resume(); };
  const intersection = new IntersectionObserver(entries => {
    intersecting = entries[0]?.isIntersecting ?? false;
    if (intersecting) resume(); else stop();
  }, { threshold: 0.01 });

  resize.observe(parent);
  intersection.observe(parent);
  parent.addEventListener('pointermove', pointer);
  parent.addEventListener('pointerleave', resetPointer);
  document.addEventListener('visibilitychange', onVisibility);
  canvas.addEventListener('webglcontextlost', onContextLost);
  canvas.addEventListener('webglcontextrestored', onContextRestored);
  const playExit = (onComplete: () => void) => {
    if (disposed || reduced.matches) { onComplete(); return; }
    exitCallback = onComplete;
    exitRequested = true;
    exitStart = performance.now();
    if (!frame) resume();
    exitTimer = window.setTimeout(completeExit, exitDuration + 220);
  };
  const cleanup = (() => {
    disposed = true;
    stop();
    resize.disconnect();
    intersection.disconnect();
    parent.removeEventListener('pointermove', pointer);
    parent.removeEventListener('pointerleave', resetPointer);
    document.removeEventListener('visibilitychange', onVisibility);
    canvas.removeEventListener('webglcontextlost', onContextLost);
    canvas.removeEventListener('webglcontextrestored', onContextRestored);
    if (exitTimer !== undefined) window.clearTimeout(exitTimer);
    disposeObject(scene);
    renderer.dispose();
  }) as LoginV2SceneController;
  cleanup.playExit = playExit;
  return cleanup;
}
