import type * as Three from "three";
import {
  FIELD,
  type Car,
  type CarModel,
  type GameState,
  type Settings,
} from "./types.ts";
import { createCanvasRenderer } from "./renderer2d.ts";

/** Renderers only read simulation state. Call resize after layout changes and dispose before replacing the canvas. */
export interface GameRenderer {
  readonly kind: "3d" | "2d";
  render(
    state: GameState,
    settings: Settings,
    dt: number,
    showroom?: boolean,
  ): void;
  resize(): void;
  dispose(): void;
}

/** Three loads only when requested; Canvas remains usable without WebGL 2. */
export async function createRenderer(
  canvas: HTMLCanvasElement,
  settings: Settings,
): Promise<GameRenderer> {
  if (settings.quality === "2d") return createCanvasRenderer(canvas);
  let fallback: GameRenderer | null = null;
  let alternateCanvas: HTMLCanvasElement | null = null;
  const originalVisibility = canvas.style.visibility;
  function useFallback() {
    if (fallback) return fallback;
    // A canvas cannot switch context types after acquiring WebGL.
    alternateCanvas = document.createElement("canvas");
    alternateCanvas.tabIndex = -1;
    alternateCanvas.setAttribute(
      "aria-label",
      "Arena de futebol com carros em 2D",
    );
    alternateCanvas.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%;outline:none;";
    canvas.after(alternateCanvas);
    canvas.style.visibility = "hidden";
    fallback = createCanvasRenderer(alternateCanvas);
    return fallback;
  }
  let sceneRenderer: GameRenderer | null = null;
  try {
    const context = canvas.getContext("webgl2", {
      alpha: false,
      antialias: settings.quality === "high",
      powerPreference: "high-performance",
    });
    if (context) {
      const THREE = await import("./three-api.ts");
      sceneRenderer = createThreeRenderer(THREE, canvas, context, settings);
    } else useFallback();
  } catch (error) {
    console.warn("A arena mudou para Canvas 2D:", error);
    useFallback();
  }
  function onContextLost(event: Event) {
    event.preventDefault();
    useFallback();
  }
  canvas.addEventListener("webglcontextlost", onContextLost);
  return {
    get kind() {
      return fallback ? "2d" : "3d";
    },
    render(state, nextSettings, dt, showroom) {
      (fallback ?? sceneRenderer)?.render(state, nextSettings, dt, showroom);
    },
    resize() {
      (fallback ?? sceneRenderer)?.resize();
    },
    dispose() {
      canvas.removeEventListener("webglcontextlost", onContextLost);
      fallback?.dispose();
      sceneRenderer?.dispose();
      alternateCanvas?.remove();
      canvas.style.visibility = originalVisibility;
    },
  };
}

function createThreeRenderer(
  THREE: typeof import("./three-api.ts"),
  canvas: HTMLCanvasElement,
  context: WebGL2RenderingContext,
  initialSettings: Settings,
): GameRenderer {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    context,
    alpha: false,
    antialias: initialSettings.quality === "high",
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#8caba2");
  scene.fog = new THREE.Fog("#8caba2", 100, 235);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.15, 290);
  scene.add(new THREE.HemisphereLight("#e5efce", "#263c39", 2.7));
  const sunlight = new THREE.DirectionalLight("#ffe0ae", 3.2);
  sunlight.position.set(-45, 65, -40);
  scene.add(sunlight);
  const fill = new THREE.DirectionalLight("#aacde6", 1.1);
  fill.position.set(40, 25, 40);
  scene.add(fill);

  const geometries = new Set<Three.BufferGeometry>();
  const materials = new Set<Three.Material>();
  function geometry<T extends Three.BufferGeometry>(value: T): T {
    geometries.add(value);
    return value;
  }
  function material(
    color: string,
    emissive = false,
  ): Three.MeshStandardMaterial {
    const result = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.86,
      metalness: 0.05,
      ...(emissive ? { emissive: color, emissiveIntensity: 0.65 } : {}),
    });
    materials.add(result);
    return result;
  }
  const unitBox = geometry(new THREE.BoxGeometry(1, 1, 1));
  const unitPlane = geometry(new THREE.PlaneGeometry(1, 1));
  const disk = geometry(new THREE.CircleGeometry(1, 24));
  const turf = material("#224d3e");
  const stripe = material("#285745");
  const chalk = material("#b8cbae");
  const concrete = material("#839181");
  const dark = material("#1b3035");
  const rubber = material("#101e25");
  const metal = material("#718985");
  const lime = material("#d7fb55", true);
  const coral = material("#fc927c", true);
  const amber = material("#ffc56a", true);
  const padOff = material("#4d5f3e");
  const windowMaterial = material("#253e4b");
  windowMaterial.metalness = 0.55;
  windowMaterial.roughness = 0.26;
  const headlight = material("#fff1c8", true);
  const taillight = material("#fa644f", true);
  const playerPaint = material(initialSettings.color);
  playerPaint.roughness = 0.4;
  playerPaint.metalness = 0.22;
  const opponentPaint = material("#ef8b70");

  function box(
    parent: Three.Object3D,
    mat: Three.Material,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
  ) {
    const mesh = new THREE.Mesh(unitBox, mat);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    parent.add(mesh);
    return mesh;
  }
  function plane(
    parent: Three.Object3D,
    mat: Three.Material,
    x: number,
    y: number,
    z: number,
    sx: number,
    sz: number,
  ) {
    const mesh = new THREE.Mesh(unitPlane, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sz, 1);
    parent.add(mesh);
    return mesh;
  }
  function ring(
    radius: number,
    thickness: number,
    mat: Three.Material,
    x: number,
    z: number,
  ) {
    const mesh = new THREE.Mesh(
      geometry(new THREE.RingGeometry(radius - thickness, radius, 56)),
      mat,
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.027, z);
    scene.add(mesh);
    return mesh;
  }

  const {
    halfWidth: w,
    halfLength: l,
    goalHalfWidth: g,
    goalHeight: gh,
  } = FIELD;
  plane(scene, material("#526c5e"), 0, -0.4, 0, 400, 400);
  box(scene, dark, 0, -0.29, 0, w * 2 + 12, 0.45, l * 2 + 17);
  plane(scene, turf, 0, 0, 0, w * 2, l * 2);
  for (let i = 0; i < 12; i += 2)
    plane(scene, stripe, 0, 0.004, -l + 3 + i * 6, w * 2, 6);
  for (const x of [-w + 0.85, w - 0.85])
    plane(scene, chalk, x, 0.025, 0, 0.12, l * 2 - 1.7);
  for (const z of [-l + 0.85, 0, l - 0.85])
    plane(scene, chalk, 0, 0.025, z, w * 2 - 1.7, 0.12);
  ring(7.8, 0.13, chalk, 0, 0);
  const centerDot = new THREE.Mesh(disk, chalk);
  centerDot.rotation.x = -Math.PI / 2;
  centerDot.position.y = 0.029;
  centerDot.scale.setScalar(0.2);
  scene.add(centerDot);

  const netPoints: number[] = [];
  const line = (
    x1: number,
    y1: number,
    z1: number,
    x2: number,
    y2: number,
    z2: number,
  ) => netPoints.push(x1, y1, z1, x2, y2, z2);
  for (const side of [-1, 1]) {
    const teamColor = side < 0 ? coral : lime;
    const z = side * l;
    plane(scene, dark, 0, 0.01, side * (l + 2), g * 2, 4);
    for (const x of [-g, g]) {
      box(scene, teamColor, x, gh / 2, z, 0.24, gh, 0.24);
      box(scene, dark, x, gh / 2, side * (l + 4), 0.15, gh, 0.15);
      box(scene, teamColor, x, gh, side * (l + 2), 0.15, 0.15, 4);
    }
    box(scene, teamColor, 0, gh, z, g * 2 + 0.25, 0.24, 0.24);
    box(scene, dark, 0, gh, side * (l + 4), g * 2, 0.15, 0.15);
    for (let x = -g; x <= g; x += 1) {
      line(x, 0, side * (l + 4), x, gh, side * (l + 4));
      line(x, gh, z, x, gh, side * (l + 4));
    }
    for (let y = 0; y <= gh; y += 1) {
      line(-g, y, side * (l + 4), g, y, side * (l + 4));
      for (const x of [-g, g]) line(x, y, z, x, y, side * (l + 4));
    }
    for (const x of [-(w + g) / 2, (w + g) / 2]) {
      box(scene, dark, x, 0.7, z + side * 0.25, w - g, 1.4, 0.5);
      box(scene, teamColor, x, 1.42, z + side * 0.25, w - g, 0.05, 0.56);
    }
    for (const x of [-g - 5, g + 5])
      plane(scene, chalk, x, 0.025, side * (l - 5), 0.12, 10);
    plane(scene, chalk, 0, 0.025, side * (l - 10), g * 2 + 10, 0.12);
    for (let row = 0; row < 4; row++) {
      const rz = side * (l + 7 + row * 1.7);
      box(
        scene,
        row % 2 === 0 ? concrete : metal,
        0,
        0.45 + row * 0.72,
        rz,
        w * 2 + 13,
        0.9 + row * 1.44,
        1.6,
      );
      box(
        scene,
        row % 2 === 0 ? teamColor : dark,
        0,
        0.96 + row * 1.44,
        rz - side * 0.35,
        w * 2 + 11,
        0.12,
        0.38,
      );
    }
  }
  for (const side of [-1, 1]) {
    box(scene, dark, side * (w + 0.25), 0.7, 0, 0.5, 1.4, l * 2);
    for (const zSide of [-1, 1])
      box(
        scene,
        zSide < 0 ? coral : lime,
        side * (w + 0.25),
        1.42,
        (zSide * l) / 2,
        0.56,
        0.05,
        l,
      );
    for (let row = 0; row < 4; row++) {
      const rx = side * (w + 3 + row * 1.7);
      box(
        scene,
        row % 2 === 0 ? concrete : metal,
        rx,
        0.45 + row * 0.72,
        0,
        1.6,
        0.9 + row * 1.44,
        l * 2 - 2,
      );
      box(
        scene,
        row % 2 === 0 ? lime : dark,
        rx - side * 0.35,
        0.96 + row * 1.44,
        0,
        0.38,
        0.12,
        l * 2 - 5,
      );
    }
  }
  const netGeometry = geometry(new THREE.BufferGeometry());
  netGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(netPoints, 3),
  );
  const netMaterial = new THREE.LineBasicMaterial({
    color: "#bad0b5",
    transparent: true,
    opacity: 0.33,
  });
  materials.add(netMaterial);
  scene.add(new THREE.LineSegments(netGeometry, netMaterial));
  // Perimeter rails show the physical wall height without blocking the chase camera.
  for (const x of [-w, w])
    box(scene, metal, x, FIELD.wallHeight, 0, 0.04, 0.04, l * 2);
  for (const z of [-l, l])
    box(scene, metal, 0, FIELD.wallHeight, z, w * 2, 0.04, 0.04);

  for (const x of [-w - 11, w + 11])
    for (const z of [-l + 7, l - 7]) {
      box(scene, dark, x, 8, z, 0.32, 16, 0.32);
      const rack = box(scene, dark, x, 16, z, 4.5, 1.4, 0.6);
      rack.rotation.y = x < 0 ? -0.32 : 0.32;
      for (let bulb = 0; bulb < 4; bulb++)
        box(
          scene,
          headlight,
          x - 1.6 + bulb * 1.07,
          16.1,
          z + (z < 0 ? 0.34 : -0.34),
          0.78,
          0.8,
          0.08,
        );
    }
  const hillGeometry = geometry(new THREE.ConeGeometry(1, 1, 5, 1));
  const hillMaterial = material("#718b79");
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2;
    const hill = new THREE.Mesh(hillGeometry, hillMaterial);
    const tall = 17 + ((i * 13) % 21);
    hill.position.set(
      Math.sin(angle) * 135,
      tall / 2 - 3,
      Math.cos(angle) * 135,
    );
    hill.scale.set(26 + (i % 3) * 7, tall, 25);
    hill.rotation.y = angle;
    scene.add(hill);
  }
  const sun = new THREE.Mesh(
    geometry(new THREE.SphereGeometry(9, 16, 12)),
    material("#ffe2a7", true),
  );
  sun.position.set(-87, 32, -133);
  scene.add(sun);

  const wheelGeometry = geometry(
    new THREE.CylinderGeometry(0.44, 0.44, 0.38, 10),
  );
  const hubGeometry = geometry(
    new THREE.CylinderGeometry(0.23, 0.23, 0.395, 8),
  );
  const flameGeometry = geometry(new THREE.ConeGeometry(0.36, 2, 7));
  const bodyGeometries = new Map<CarModel, Three.BufferGeometry>();
  function bodyGeometry(model: CarModel) {
    let existing = bodyGeometries.get(model);
    if (existing) return existing;
    const front = model === "vector" ? 0.7 : model === "rally" ? 0.98 : 0.86;
    const frontTop = model === "vector" ? -0.04 : 0.16;
    const vertices = [
      -front,
      -0.25,
      -1.85,
      front,
      -0.25,
      -1.85,
      1.06,
      -0.25,
      1.8,
      -1.06,
      -0.25,
      1.8,
      -front,
      frontTop,
      -1.85,
      front,
      frontTop,
      -1.85,
      1.06,
      0.29,
      1.8,
      -1.06,
      0.29,
      1.8,
    ];
    existing = geometry(new THREE.BufferGeometry());
    existing.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertices, 3),
    );
    existing.setIndex([
      0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2,
      3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7,
    ]);
    existing.computeVertexNormals();
    bodyGeometries.set(model, existing);
    return existing;
  }
  function makeCar(model: CarModel, paint: Three.Material) {
    const root = new THREE.Group();
    root.add(new THREE.Mesh(bodyGeometry(model), paint));
    box(root, rubber, 0, -0.22, 0, 1.95, 0.25, 3.35);
    const rally = model === "rally",
      vector = model === "vector";
    const roof = box(
      root,
      windowMaterial,
      0,
      rally ? 0.67 : 0.48,
      vector ? 0.38 : 0.08,
      rally ? 1.7 : 1.52,
      rally ? 0.85 : 0.55,
      rally ? 1.8 : 1.65,
    );
    roof.rotation.x = vector ? -0.1 : -0.04;
    box(
      root,
      paint,
      0,
      rally ? 1.11 : 0.79,
      vector ? 0.49 : 0.2,
      rally ? 1.76 : 1.46,
      0.12,
      rally ? 1.35 : 1.02,
    );
    box(root, dark, 0, 0.29, -1.27, 0.13, 0.02, 0.75);
    for (const x of [-0.64, 0.64]) {
      box(root, headlight, x, 0.01, -1.88, 0.46, 0.14, 0.06);
      box(root, taillight, x, 0.03, 1.82, 0.48, 0.13, 0.05);
      box(root, metal, x, -0.15, 1.86, 0.24, 0.19, 0.3);
    }
    const wingY = vector ? 0.85 : rally ? 1.13 : 0.55;
    for (const x of [-0.67, 0.67])
      box(root, dark, x, wingY / 2 + 0.14, 1.48, 0.12, wingY - 0.12, 0.18);
    box(
      root,
      vector ? paint : dark,
      0,
      wingY,
      1.52,
      vector ? 2.68 : 2.32,
      0.12,
      0.48,
    );
    if (rally) {
      box(root, dark, 0, 1.23, 0.22, 1.92, 0.11, 0.18);
      for (const x of [-0.59, 0, 0.59])
        box(root, headlight, x, 1.35, 0.17, 0.33, 0.22, 0.2);
    }
    const wheels: Three.Mesh[] = [];
    for (const x of [-1.09, 1.09])
      for (const z of [-1.15, 1.1]) {
        const wheel = new THREE.Mesh(wheelGeometry, rubber);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(x, -0.29, z);
        const hub = new THREE.Mesh(hubGeometry, metal);
        wheel.add(hub);
        root.add(wheel);
        wheels.push(wheel);
      }
    const exhaust = new THREE.Group();
    for (const x of [-0.64, 0.64]) {
      const flame = new THREE.Mesh(flameGeometry, amber);
      flame.rotation.x = Math.PI / 2;
      flame.position.set(x, -0.1, 2.7);
      exhaust.add(flame);
    }
    root.add(exhaust);
    scene.add(root);
    return { root, wheels, exhaust };
  }
  const playerCars = {
    pulse: makeCar("pulse", playerPaint),
    rally: makeCar("rally", playerPaint),
    vector: makeCar("vector", playerPaint),
  };
  const opponent = makeCar("rally", opponentPaint);
  const shadowMaterial = new THREE.MeshBasicMaterial({
    color: "#0a201f",
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });
  materials.add(shadowMaterial);
  function shadow(sx: number, sz: number) {
    const mesh = new THREE.Mesh(disk, shadowMaterial);
    mesh.rotation.x = -Math.PI / 2;
    mesh.scale.set(sx, sz, 1);
    mesh.position.y = 0.04;
    scene.add(mesh);
    return mesh;
  }
  const playerShadow = shadow(1.5, 2.3),
    opponentShadow = shadow(1.5, 2.3),
    ballShadow = shadow(1.15, 1.15);
  const ballGeometry = geometry(
    new THREE.IcosahedronGeometry(FIELD.ballRadius, 1),
  );
  const ballColor = new THREE.Color(),
    colors: number[] = [];
  const ballPosition = ballGeometry.getAttribute("position");
  for (let i = 0; i < ballPosition.count; i++) {
    ballColor.set(Math.floor(i / 3) % 5 === 0 ? "#38505a" : "#f4edd5");
    colors.push(ballColor.r, ballColor.g, ballColor.b);
  }
  ballGeometry.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(colors, 3),
  );
  const ballMaterial = material("#ffffff");
  ballMaterial.vertexColors = true;
  ballMaterial.flatShading = true;
  const ball = new THREE.Mesh(ballGeometry, ballMaterial);
  scene.add(ball);
  const ballOutlineMaterial = new THREE.LineBasicMaterial({
    color: "#3a5354",
    transparent: true,
    opacity: 0.25,
  });
  materials.add(ballOutlineMaterial);
  ball.add(
    new THREE.LineSegments(
      geometry(new THREE.WireframeGeometry(ballGeometry)),
      ballOutlineMaterial,
    ),
  );
  const padGeometry = geometry(
    new THREE.CylinderGeometry(0.93, 0.93, 0.06, 12),
  );
  const padCoreGeometry = geometry(new THREE.OctahedronGeometry(0.38));
  const pads: { base: Three.Mesh; core: Three.Mesh }[] = [];

  // Agrupar a arquitetura estática reduz chamadas de desenho sem alterar a arte.
  const batches = new Map<string, Three.Mesh[]>();
  for (const child of [...scene.children]) {
    if (
      !(child instanceof THREE.Mesh) ||
      ![unitBox, unitPlane, hillGeometry].includes(child.geometry)
    )
      continue;
    const key = `${child.geometry.uuid}:${(child.material as Three.Material).uuid}`;
    const group = batches.get(key) ?? [];
    child.updateMatrix();
    group.push(child);
    batches.set(key, group);
    scene.remove(child);
  }
  const instances: Three.InstancedMesh[] = [];
  for (const meshes of batches.values()) {
    const first = meshes[0];
    const batch = new THREE.InstancedMesh(
      first.geometry,
      first.material,
      meshes.length,
    );
    meshes.forEach((mesh, index) => batch.setMatrixAt(index, mesh.matrix));
    batch.computeBoundingSphere();
    instances.push(batch);
    scene.add(batch);
  }

  let quality = initialSettings.quality;
  let adaptiveRatio = 1.25;
  let slowSeconds = 0;
  let averageFrame = 1 / 60;
  let lastShowroom: boolean | undefined;
  let lastCamera = initialSettings.camera;
  let lastColor = initialSettings.color;
  let width = 1,
    height = 1;
  const targetPosition = new THREE.Vector3();
  const targetLook = new THREE.Vector3();
  const smoothLook = new THREE.Vector3();
  function resize() {
    width = Math.max(1, canvas.clientWidth || window.innerWidth);
    height = Math.max(1, canvas.clientHeight || window.innerHeight);
    const limit =
      quality === "high" ? 1.75 : quality === "low" ? 1 : adaptiveRatio;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, limit));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  resize();
  function updateCar(
    view: ReturnType<typeof makeCar>,
    car: Car,
    time: number,
    motion: boolean,
  ) {
    view.root.position.set(car.position.x, car.position.y, car.position.z);
    view.root.rotation.set(0, -car.heading, 0);
    view.exhaust.visible = car.boosting;
    view.exhaust.scale.z = motion ? 1 + Math.sin(time * 43) * 0.14 : 1;
    const wheelAngle =
      (Math.hypot(car.velocity.x, car.velocity.z) * time) / 0.44;
    for (const wheel of view.wheels) wheel.rotation.y = motion ? wheelAngle : 0;
  }
  function render(
    state: GameState,
    settings: Settings,
    dt: number,
    showroom = false,
  ) {
    if (settings.quality !== quality) {
      quality = settings.quality;
      adaptiveRatio = 1.25;
      slowSeconds = 0;
      resize();
    }
    if (quality === "auto" && dt > 0 && dt < 0.2) {
      averageFrame += (dt - averageFrame) * 0.04;
      slowSeconds =
        averageFrame > 1 / 43
          ? slowSeconds + dt
          : Math.max(0, slowSeconds - dt);
      if (slowSeconds > 3 && adaptiveRatio > 0.7) {
        adaptiveRatio = Math.max(0.7, adaptiveRatio - 0.2);
        slowSeconds = 0;
        resize();
      }
    }
    if (settings.color !== lastColor) {
      playerPaint.color.set(settings.color);
      lastColor = settings.color;
    }
    for (const [model, view] of Object.entries(playerCars))
      view.root.visible = model === settings.model;
    const player = playerCars[settings.model];
    updateCar(player, state.player, state.elapsed, !settings.reducedMotion);
    opponent.root.visible = state.mode === "duel";
    updateCar(opponent, state.opponent, state.elapsed, !settings.reducedMotion);
    playerShadow.position.set(
      state.player.position.x,
      0.04,
      state.player.position.z,
    );
    playerShadow.rotation.z = state.player.heading;
    opponentShadow.visible = state.mode === "duel";
    opponentShadow.position.set(
      state.opponent.position.x,
      0.04,
      state.opponent.position.z,
    );
    opponentShadow.rotation.z = state.opponent.heading;
    ball.position.set(
      state.ball.position.x,
      state.ball.position.y,
      state.ball.position.z,
    );
    if (!settings.reducedMotion) {
      ball.rotation.x += (state.ball.velocity.z * dt) / FIELD.ballRadius;
      ball.rotation.z -= (state.ball.velocity.x * dt) / FIELD.ballRadius;
    }
    ballShadow.position.set(
      state.ball.position.x,
      0.041,
      state.ball.position.z,
    );
    const ballShadeScale =
      1 + Math.max(0, state.ball.position.y - FIELD.ballRadius) * 0.018;
    ballShadow.scale.set(1.15 * ballShadeScale, 1.15 * ballShadeScale, 1);
    while (pads.length < state.pads.length) {
      const base = new THREE.Mesh(padGeometry, amber);
      const core = new THREE.Mesh(padCoreGeometry, amber);
      scene.add(base, core);
      pads.push({ base, core });
    }
    for (let i = 0; i < pads.length; i++) {
      const pad = state.pads[i],
        view = pads[i];
      view.base.visible = Boolean(pad);
      view.core.visible = Boolean(pad && pad.cooldown <= 0);
      if (!pad) continue;
      view.base.position.set(pad.x, 0.04, pad.z);
      view.base.material = pad.cooldown > 0 ? padOff : amber;
      view.core.position.set(pad.x, 0.55, pad.z);
      view.core.rotation.y = settings.reducedMotion ? 0.4 : state.elapsed;
    }
    const position = state.player.position;
    if (showroom) {
      const angle = settings.reducedMotion
        ? 0.66
        : 0.66 + Math.sin(state.elapsed * 0.08) * 0.1;
      const distance = width < 760 ? 92 : 79;
      targetPosition.set(
        Math.sin(angle) * distance,
        46,
        Math.cos(angle) * distance,
      );
      // Aim left of the pitch, placing the stadium beside the lobby copy.
      targetLook.set(width > 1000 ? -18 : 0, 0, 0);
      camera.fov = 51;
    } else if (settings.camera === "overview") {
      targetPosition.set(36, width < 760 ? 91 : 69, 61);
      targetLook.set(0, 0, 0);
      camera.fov = width < 760 ? 65 : 57;
    } else {
      let forwardX = Math.sin(state.player.heading),
        forwardZ = -Math.cos(state.player.heading);
      if (settings.camera === "ball") {
        const bx = state.ball.position.x - position.x,
          bz = state.ball.position.z - position.z;
        const distance = Math.hypot(bx, bz);
        if (distance > 2) {
          forwardX = bx / distance;
          forwardZ = bz / distance;
        }
      }
      targetPosition.set(
        position.x - forwardX * 16,
        Math.max(0.72, position.y) + 10,
        position.z - forwardZ * 16,
      );
      if (settings.camera === "ball") {
        targetLook.set(
          position.x + forwardX * 9,
          Math.max(1.8, Math.min(state.ball.position.y, position.y + 8)),
          position.z + forwardZ * 9,
        );
      } else
        targetLook.set(
          position.x + forwardX * 9,
          position.y + 1.4,
          position.z + forwardZ * 9,
        );
      camera.fov = state.player.boosting && !settings.reducedMotion ? 67 : 62;
    }
    const cut = lastShowroom !== showroom || lastCamera !== settings.camera;
    const smoothing =
      cut || settings.reducedMotion ? 1 : 1 - Math.exp(-Math.max(dt, 0) * 6);
    camera.position.lerp(targetPosition, smoothing);
    smoothLook.lerp(targetLook, smoothing);
    camera.lookAt(smoothLook);
    camera.updateProjectionMatrix();
    lastShowroom = showroom;
    lastCamera = settings.camera;
    renderer.render(scene, camera);
  }
  return {
    kind: "3d",
    render,
    resize,
    dispose() {
      for (const batch of instances) batch.dispose();
      for (const resource of geometries) resource.dispose();
      for (const resource of materials) resource.dispose();
      scene.clear();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
