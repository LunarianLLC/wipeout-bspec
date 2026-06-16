import * as THREE from "three";
import "./styles.css";

const canvas = document.querySelector("#game-canvas");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111820);
scene.fog = new THREE.Fog(0x111820, 150, 520);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.35));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 1100);
const clock = new THREE.Clock();

const TOTAL_LAPS = 3;
const TRACK_SAMPLES = 720;
const trackWidth = 18;
const commandNames = ["COOL", "BASE", "PUSH", "MAX"];
const paceProfiles = [
  { speed: 0.84, heat: -7.5, focus: 9, energy: 10, label: "Cool pace. Systems recovering." },
  { speed: 1, heat: -2.5, focus: 3, energy: 4, label: "Base pace. Holding rhythm." },
  { speed: 1.14, heat: 5.5, focus: -6, energy: -1, label: "Push pace. Driver leaning in." },
  { speed: 1.28, heat: 11, focus: -13, energy: -5, label: "Max pace. Watch heat and focus." },
];
const BASE_CAR_SPEC = {
  speed: 1,
  acceleration: 1,
  cornering: 1,
  cooldown: 1,
  cooling: 1,
  heatGain: 1,
  energyRecovery: 1,
  energyCost: 1,
  focusRecovery: 1,
  focusCost: 1,
  boostPower: 1,
  boostDuration: 1,
  boostCost: 1,
  lapCharge: 1,
  overtakePower: 1,
};
const carChoices = [
  {
    id: "teal",
    name: "Mako",
    role: "BALANCED",
    color: 0x2df7d0,
    accent: 0xffe25c,
    spec: { ...BASE_CAR_SPEC },
    ratings: { speed: 3, cooldown: 3, cornering: 3, boost: 3, control: 3 },
  },
  {
    id: "red",
    name: "Comet",
    role: "COOLDOWN",
    color: 0xff3d5e,
    accent: 0xffc857,
    spec: {
      ...BASE_CAR_SPEC,
      speed: 0.98,
      acceleration: 1.04,
      cooldown: 0.66,
      cooling: 1.18,
      heatGain: 0.96,
      boostCost: 1.04,
      boostPower: 1.06,
    },
    ratings: { speed: 3, cooldown: 5, cornering: 2, boost: 4, control: 3 },
  },
  {
    id: "green",
    name: "Viper",
    role: "TOP SPEED",
    color: 0x8dff61,
    accent: 0x263238,
    spec: {
      ...BASE_CAR_SPEC,
      speed: 1.08,
      acceleration: 0.96,
      cornering: 0.92,
      cooldown: 1.1,
      cooling: 0.94,
      heatGain: 1.08,
      boostPower: 0.95,
    },
    ratings: { speed: 5, cooldown: 2, cornering: 2, boost: 3, control: 2 },
  },
  {
    id: "orange",
    name: "Apex",
    role: "CORNERING",
    color: 0xff8a45,
    accent: 0xffffff,
    spec: {
      ...BASE_CAR_SPEC,
      speed: 0.99,
      acceleration: 1.03,
      cornering: 1.24,
      cooling: 1.05,
      heatGain: 0.98,
      focusCost: 0.86,
      overtakePower: 1.08,
    },
    ratings: { speed: 3, cooldown: 3, cornering: 5, boost: 3, control: 4 },
  },
  {
    id: "blue",
    name: "Pulse",
    role: "BOOST",
    color: 0x5a7dff,
    accent: 0xffe25c,
    spec: {
      ...BASE_CAR_SPEC,
      speed: 1.02,
      acceleration: 1.12,
      cooldown: 0.92,
      heatGain: 1.1,
      boostPower: 1.2,
      boostDuration: 0.9,
      boostCost: 1.1,
    },
    ratings: { speed: 4, cooldown: 3, cornering: 3, boost: 5, control: 2 },
  },
  {
    id: "violet",
    name: "Nova",
    role: "CONTROL",
    color: 0xd76bff,
    accent: 0x2df7d0,
    spec: {
      ...BASE_CAR_SPEC,
      speed: 0.97,
      cornering: 1.09,
      cooldown: 0.96,
      cooling: 1.1,
      energyCost: 0.88,
      focusRecovery: 1.18,
      focusCost: 0.9,
      lapCharge: 1.22,
    },
    ratings: { speed: 2, cooldown: 4, cornering: 4, boost: 2, control: 5 },
  },
];
const rivalCarIds = ["red", "green", "orange", "blue", "violet"];
let selectedCar = carChoices[0];
let gamePhase = "select";
let sceneTime = 0;

const controlPoints = [
  [-18, 0, 8],
  [44, 2, -26],
  [108, 13, -76],
  [177, 6, -38],
  [168, -12, 42],
  [112, -18, 90],
  [55, 2, 134],
  [-34, 9, 126],
  [-104, -5, 66],
  [-86, 8, -6],
];

const curve = new THREE.CatmullRomCurve3(
  controlPoints.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
  true,
  "catmullrom",
  0.5,
);
const trackLength = curve.getLength();

const trackData = buildTrackData();
const track = createTrackMesh();
scene.add(track.surface, track.leftWall, track.rightWall, track.centerMarks, track.startGate);

addWorld();

const player = createRacer({
  name: "YOU",
  color: selectedCar.color,
  accent: selectedCar.accent,
  spec: selectedCar.spec,
  car: selectedCar,
  lane: -0.14,
  skill: 1.02,
  isPlayer: true,
  progress: 5,
});

const rivalCars = rivalCarIds.map((id) => getCarChoice(id));
const racers = [
  player,
  createRacer({ name: "KIRA", car: rivalCars[0], color: rivalCars[0].color, accent: rivalCars[0].accent, spec: rivalCars[0].spec, lane: 0.18, skill: 1.01, progress: -10 }),
  createRacer({ name: "MARA", car: rivalCars[1], color: rivalCars[1].color, accent: rivalCars[1].accent, spec: rivalCars[1].spec, lane: -0.32, skill: 0.995, progress: -25 }),
  createRacer({ name: "SOL", car: rivalCars[2], color: rivalCars[2].color, accent: rivalCars[2].accent, spec: rivalCars[2].spec, lane: 0.34, skill: 0.985, progress: -40 }),
  createRacer({ name: "AXEL", car: rivalCars[3], color: rivalCars[3].color, accent: rivalCars[3].accent, spec: rivalCars[3].spec, lane: -0.06, skill: 1.008, progress: -55 }),
  createRacer({ name: "NOVA", car: rivalCars[4], color: rivalCars[4].color, accent: rivalCars[4].accent, spec: rivalCars[4].spec, lane: 0.03, skill: 0.978, progress: -70 }),
];
racers.forEach((racer) => scene.add(racer.group));

const race = {
  pace: 1,
  overtake: false,
  boostTime: 0,
  boostCooldown: 0,
  elapsed: 0,
  finished: false,
  radioTimer: 0,
  lastLap: 1,
  finishOrder: [],
};

const ui = {
  carSelectScreen: document.querySelector("#car-select-screen"),
  carGrid: document.querySelector("#car-grid"),
  selectedCarName: document.querySelector("#selected-car-name"),
  selectedCarRole: document.querySelector("#selected-car-role"),
  selectedCarSwatch: document.querySelector("#selected-car-swatch"),
  startRaceButton: document.querySelector("#start-race-button"),
  hudLeft: document.querySelector(".hud-left"),
  hudRight: document.querySelector(".hud-right"),
  paceButtons: Array.from(document.querySelectorAll("[data-pace]")),
  overtakeButton: document.querySelector("#overtake-button"),
  overtakeState: document.querySelector("#overtake-state"),
  boostButton: document.querySelector("#boost-button"),
  boostState: document.querySelector("#boost-state"),
  raceState: document.querySelector("#race-state"),
  energyMeter: document.querySelector("#energy-meter"),
  heatMeter: document.querySelector("#heat-meter"),
  focusMeter: document.querySelector("#focus-meter"),
  energyValue: document.querySelector("#energy-value"),
  heatValue: document.querySelector("#heat-value"),
  focusValue: document.querySelector("#focus-value"),
  positionValue: document.querySelector("#position-value"),
  lapValue: document.querySelector("#lap-value"),
  speedValue: document.querySelector("#speed-value"),
  gapValue: document.querySelector("#gap-value"),
  standingsList: document.querySelector("#standings-list"),
  raceMessage: document.querySelector("#race-message"),
  radioMessage: document.querySelector("#radio-message"),
  garageButton: document.querySelector("#garage-button"),
  restartButton: document.querySelector("#restart-button"),
};

wireControls();
renderCarSelect();
selectCar(selectedCar.id, { announce: false });
syncScreenState();
resize();
window.addEventListener("resize", resize);
requestAnimationFrame(loop);

function buildTrackData() {
  const points = [];
  const tangents = [];
  const laterals = [];
  const curvature = [];

  for (let i = 0; i <= TRACK_SAMPLES; i += 1) {
    const t = i / TRACK_SAMPLES;
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const lateral = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    points.push(point);
    tangents.push(tangent);
    laterals.push(lateral);
  }

  for (let i = 0; i <= TRACK_SAMPLES; i += 1) {
    const prev = tangents[(i + TRACK_SAMPLES - 4) % TRACK_SAMPLES];
    const next = tangents[(i + 4) % TRACK_SAMPLES];
    curvature.push(THREE.MathUtils.clamp(prev.angleTo(next) * 5.8, 0, 1));
  }

  return { points, tangents, laterals, curvature };
}

function createTrackMesh() {
  const vertices = [];
  const colors = [];
  const indices = [];
  const leftWallVertices = [];
  const rightWallVertices = [];
  const wallIndices = [];
  const wallColors = [];
  const markVertices = [];
  const markIndices = [];
  const markColors = [];
  const trackColorA = new THREE.Color(0x2a2f38);
  const trackColorB = new THREE.Color(0x3b3142);
  const edgeColor = new THREE.Color(0xffe25c);
  const railColor = new THREE.Color(0xff3d5e);
  const markColor = new THREE.Color(0x2df7d0);

  for (let i = 0; i <= TRACK_SAMPLES; i += 1) {
    const p = trackData.points[i];
    const l = trackData.laterals[i];
    const pulse = Math.sin((i / TRACK_SAMPLES) * Math.PI * 12);
    const width = trackWidth + pulse * 1.6;
    const crown = Math.sin((i / TRACK_SAMPLES) * Math.PI * 20) * 0.25;
    const color = trackColorA.clone().lerp(trackColorB, (pulse + 1) * 0.5);

    const left = p.clone().addScaledVector(l, -width * 0.5);
    const right = p.clone().addScaledVector(l, width * 0.5);
    vertices.push(left.x, left.y + crown, left.z, right.x, right.y + crown, right.z);
    colors.push(color.r, color.g, color.b, color.r, color.g, color.b);

    const wallHeight = 2.6 + trackData.curvature[i] * 1.4;
    const wallInset = 0.8;
    const leftBase = p.clone().addScaledVector(l, -width * 0.5 - wallInset);
    const leftTop = leftBase.clone();
    leftTop.y += wallHeight;
    const rightBase = p.clone().addScaledVector(l, width * 0.5 + wallInset);
    const rightTop = rightBase.clone();
    rightTop.y += wallHeight;
    leftWallVertices.push(leftBase.x, leftBase.y, leftBase.z, leftTop.x, leftTop.y, leftTop.z);
    rightWallVertices.push(rightBase.x, rightBase.y, rightBase.z, rightTop.x, rightTop.y, rightTop.z);

    const wallTint = i % 18 < 9 ? edgeColor : railColor;
    wallColors.push(wallTint.r, wallTint.g, wallTint.b, wallTint.r, wallTint.g, wallTint.b);
    wallColors.push(wallTint.r, wallTint.g, wallTint.b, wallTint.r, wallTint.g, wallTint.b);

    if (i % 18 === 0) {
      const markWidth = 1.2;
      const markHalf = width * 0.16;
      const markA = p.clone().addScaledVector(l, -markHalf);
      const markB = p.clone().addScaledVector(l, markHalf);
      const forward = trackData.tangents[i].clone().multiplyScalar(markWidth);
      const baseIndex = markVertices.length / 3;
      const a1 = markA.clone().add(forward);
      const a2 = markA.clone().sub(forward);
      const b1 = markB.clone().add(forward);
      const b2 = markB.clone().sub(forward);
      [a1, b1, a2, b2].forEach((v) => {
        markVertices.push(v.x, v.y + 0.09, v.z);
        markColors.push(markColor.r, markColor.g, markColor.b);
      });
      markIndices.push(baseIndex, baseIndex + 2, baseIndex + 1, baseIndex + 1, baseIndex + 2, baseIndex + 3);
    }
  }

  for (let i = 0; i < TRACK_SAMPLES; i += 1) {
    const a = i * 2;
    const b = (i + 1) * 2;
    indices.push(a, b, a + 1, a + 1, b, b + 1);
    wallIndices.push(a, a + 1, b, a + 1, b + 1, b);
  }

  const surfaceGeometry = new THREE.BufferGeometry();
  surfaceGeometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  surfaceGeometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  surfaceGeometry.setIndex(indices);
  surfaceGeometry.computeVertexNormals();

  const wallGeometryLeft = new THREE.BufferGeometry();
  wallGeometryLeft.setAttribute("position", new THREE.Float32BufferAttribute(leftWallVertices, 3));
  wallGeometryLeft.setAttribute("color", new THREE.Float32BufferAttribute(wallColors, 3));
  wallGeometryLeft.setIndex(wallIndices);
  wallGeometryLeft.computeVertexNormals();

  const wallGeometryRight = new THREE.BufferGeometry();
  wallGeometryRight.setAttribute("position", new THREE.Float32BufferAttribute(rightWallVertices, 3));
  wallGeometryRight.setAttribute("color", new THREE.Float32BufferAttribute(wallColors, 3));
  wallGeometryRight.setIndex(wallIndices);
  wallGeometryRight.computeVertexNormals();

  const markGeometry = new THREE.BufferGeometry();
  markGeometry.setAttribute("position", new THREE.Float32BufferAttribute(markVertices, 3));
  markGeometry.setAttribute("color", new THREE.Float32BufferAttribute(markColors, 3));
  markGeometry.setIndex(markIndices);
  markGeometry.computeVertexNormals();

  const surfaceMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const wallMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const markMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });
  const surface = new THREE.Mesh(surfaceGeometry, surfaceMaterial);
  const leftWall = new THREE.Mesh(wallGeometryLeft, wallMaterial);
  const rightWall = new THREE.Mesh(wallGeometryRight, wallMaterial);
  const centerMarks = new THREE.Mesh(markGeometry, markMaterial);

  surface.receiveShadow = true;
  leftWall.castShadow = true;
  rightWall.castShadow = true;

  return {
    surface,
    leftWall,
    rightWall,
    centerMarks,
    startGate: createStartGate(),
  };
}

function createStartGate() {
  const group = new THREE.Group();
  const p = curve.getPointAt(0);
  const tangent = curve.getTangentAt(0).normalize();
  const lateral = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
  const angle = Math.atan2(tangent.x, tangent.z);

  const gateMat = new THREE.MeshStandardMaterial({
    color: 0xf3f7ef,
    emissive: 0x1b352f,
    metalness: 0.15,
    roughness: 0.7,
    flatShading: true,
  });
  const top = new THREE.Mesh(new THREE.BoxGeometry(trackWidth + 9, 2, 2), gateMat);
  top.position.copy(p).add(new THREE.Vector3(0, 10.5, 0));
  top.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle + Math.PI * 0.5);
  group.add(top);

  [-1, 1].forEach((side) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(2, 10, 2), gateMat);
    post.position.copy(p).addScaledVector(lateral, side * (trackWidth * 0.5 + 3.5));
    post.position.y += 5;
    post.quaternion.copy(top.quaternion);
    group.add(post);
  });

  return group;
}

function addWorld() {
  const hemi = new THREE.HemisphereLight(0x9fd9ff, 0x61412e, 1.9);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff0c7, 2.7);
  sun.position.set(-80, 160, 70);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 20;
  sun.shadow.camera.far = 430;
  sun.shadow.camera.left = -220;
  sun.shadow.camera.right = 220;
  sun.shadow.camera.top = 220;
  sun.shadow.camera.bottom = -220;
  scene.add(sun);

  const terrainGeometry = new THREE.PlaneGeometry(820, 820, 16, 16);
  const terrainPositions = terrainGeometry.attributes.position;
  for (let i = 0; i < terrainPositions.count; i += 1) {
    const x = terrainPositions.getX(i);
    const y = terrainPositions.getY(i);
    const ripple = Math.sin(x * 0.025) * Math.cos(y * 0.018) * 4;
    terrainPositions.setZ(i, ripple - 24);
  }
  terrainGeometry.computeVertexNormals();
  const terrain = new THREE.Mesh(
    terrainGeometry,
    new THREE.MeshLambertMaterial({ color: 0x6f4a3b, flatShading: true }),
  );
  terrain.rotation.x = -Math.PI * 0.5;
  terrain.receiveShadow = true;
  scene.add(terrain);

  const rng = mulberry32(42);
  const mountainMats = [
    new THREE.MeshLambertMaterial({ color: 0x263b3f, flatShading: true }),
    new THREE.MeshLambertMaterial({ color: 0x5d3e4b, flatShading: true }),
    new THREE.MeshLambertMaterial({ color: 0x39503f, flatShading: true }),
  ];

  for (let i = 0; i < 46; i += 1) {
    const ring = 250 + rng() * 150;
    const angle = rng() * Math.PI * 2;
    const radius = 18 + rng() * 38;
    const height = 36 + rng() * 92;
    const segments = 4 + Math.floor(rng() * 3);
    const mountain = new THREE.Mesh(
      new THREE.ConeGeometry(radius, height, segments),
      mountainMats[i % mountainMats.length],
    );
    mountain.position.set(Math.cos(angle) * ring, height * 0.5 - 25, Math.sin(angle) * ring);
    mountain.rotation.y = rng() * Math.PI;
    mountain.castShadow = true;
    mountain.receiveShadow = true;
    scene.add(mountain);
  }

  const pylonMat = new THREE.MeshLambertMaterial({ color: 0xff8a45, flatShading: true });
  for (let i = 0; i < TRACK_SAMPLES; i += 60) {
    const p = trackData.points[i];
    const l = trackData.laterals[i];
    [-1, 1].forEach((side) => {
      const pylon = new THREE.Mesh(new THREE.ConeGeometry(2.2, 7, 4), pylonMat);
      pylon.position.copy(p).addScaledVector(l, side * (trackWidth * 0.5 + 7));
      pylon.position.y += 3;
      pylon.rotation.y = Math.PI * 0.25;
      scene.add(pylon);
    });
  }
}

function createRacer({ name, color, accent, lane, skill, spec = BASE_CAR_SPEC, car = null, isPlayer = false, progress = 0 }) {
  const group = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: isPlayer ? 0.16 : 0.08,
    metalness: 0.25,
    roughness: 0.55,
    flatShading: true,
  });
  const accentMaterial = new THREE.MeshStandardMaterial({
    color: accent,
    emissive: accent,
    emissiveIntensity: 0.16,
    metalness: 0.15,
    roughness: 0.65,
    flatShading: true,
  });
  const darkMaterial = new THREE.MeshStandardMaterial({
    color: 0x11151b,
    metalness: 0.1,
    roughness: 0.8,
    flatShading: true,
  });

  const body = new THREE.Mesh(createShipGeometry(), bodyMaterial);
  body.scale.set(isPlayer ? 1.16 : 1.02, isPlayer ? 1.16 : 1.02, isPlayer ? 1.16 : 1.02);
  body.castShadow = true;
  group.add(body);

  const leftWing = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.18, 3.8), accentMaterial);
  leftWing.position.set(-2.2, -0.08, 0.65);
  leftWing.rotation.z = 0.13;
  leftWing.castShadow = true;
  group.add(leftWing);

  const rightWing = leftWing.clone();
  rightWing.position.x *= -1;
  rightWing.rotation.z *= -1;
  group.add(rightWing);

  const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.42, 1.25), darkMaterial);
  canopy.position.set(0, 0.42, -0.38);
  canopy.castShadow = true;
  group.add(canopy);

  const flameMaterial = new THREE.MeshBasicMaterial({ color: 0x2df7d0 });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.45, 2.2, 4), flameMaterial);
  flame.position.set(0, -0.1, 2.9);
  flame.rotation.x = Math.PI * 0.5;
  group.add(flame);

  return {
    name,
    group,
    flame,
    bodyMaterial,
    accentMaterial,
    flameMaterial,
    color,
    accent,
    car,
    spec,
    lane,
    targetLane: lane,
    laneVelocity: 0,
    skill,
    isPlayer,
    progress,
    speed: 72 + Math.random() * 4,
    energy: isPlayer ? 100 : 70,
    heat: 4,
    focus: isPlayer ? 100 : 78,
    boost: 0,
    wobble: 0,
    finished: false,
    finishTime: null,
    lastOvertakeTry: 0,
    aiMood: Math.random() * 20,
  };
}

function createShipGeometry() {
  const vertices = new Float32Array([
    0, 0.18, -3.2,
    -1.4, 0.28, -0.8,
    1.4, 0.28, -0.8,
    -1.15, -0.22, 1.9,
    1.15, -0.22, 1.9,
    0, 0.18, 2.85,
    0, 0.68, -0.65,
    0, -0.38, -0.45,
  ]);
  const indices = [
    0, 1, 6,
    0, 6, 2,
    1, 3, 7,
    1, 7, 0,
    2, 0, 7,
    2, 7, 4,
    1, 5, 3,
    1, 2, 5,
    2, 4, 5,
    3, 5, 7,
    4, 7, 5,
    0, 7, 6,
    6, 7, 5,
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function wireControls() {
  ui.startRaceButton.addEventListener("click", startRace);
  ui.garageButton.addEventListener("click", openGarage);

  ui.paceButtons.forEach((button) => {
    button.addEventListener("click", () => setPace(Number(button.dataset.pace)));
  });

  ui.overtakeButton.addEventListener("click", () => {
    if (gamePhase !== "race") return;
    race.overtake = !race.overtake;
    setRadio(race.overtake ? "Overtake armed. Driver will spend focus in traffic." : "Overtake cancelled. Holding line.");
    updateButtonState();
  });

  ui.boostButton.addEventListener("click", deployBoost);
  ui.restartButton.addEventListener("click", () => resetRace(`${selectedCar.name} restarted. Pace target confirmed.`));

  window.addEventListener("keydown", (event) => {
    if (gamePhase === "select") {
      if (event.key >= "1" && event.key <= String(carChoices.length)) {
        selectCar(carChoices[Number(event.key) - 1].id);
      }
      if (event.key === "Enter") startRace();
      return;
    }

    if (event.key >= "1" && event.key <= "4") setPace(Number(event.key) - 1);
    if (event.key.toLowerCase() === "o") {
      race.overtake = !race.overtake;
      updateButtonState();
    }
    if (event.key.toLowerCase() === "b" || event.code === "Space") {
      event.preventDefault();
      deployBoost();
    }
  });
}

function renderCarSelect() {
  ui.carGrid.replaceChildren(
    ...carChoices.map((car, index) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "car-card";
      card.dataset.carId = car.id;
      card.setAttribute("aria-pressed", String(car.id === selectedCar.id));
      card.style.setProperty("--car-color", toCssColor(car.color));
      card.style.setProperty("--accent-color", toCssColor(car.accent));
      card.addEventListener("click", () => selectCar(car.id));

      const swatch = document.createElement("span");
      swatch.className = "car-swatch";

      const label = document.createElement("span");
      label.className = "car-label";

      const number = document.createElement("span");
      number.className = "car-number";
      number.textContent = `0${index + 1}`;

      const name = document.createElement("strong");
      name.textContent = car.name;

      const role = document.createElement("small");
      role.textContent = car.role;

      const stats = document.createElement("span");
      stats.className = "spec-list";
      [
        ["SPD", car.ratings.speed],
        ["COOL", car.ratings.cooldown],
        ["TURN", car.ratings.cornering],
        ["BST", car.ratings.boost],
        ["CTRL", car.ratings.control],
      ].forEach(([stat, rating]) => {
        const row = document.createElement("span");
        row.className = "spec-row";

        const statLabel = document.createElement("span");
        statLabel.textContent = stat;

        const bar = document.createElement("span");
        bar.className = "spec-bar";
        bar.style.setProperty("--rating", rating);
        const fill = document.createElement("i");
        bar.append(fill);

        const value = document.createElement("b");
        value.textContent = rating;

        row.append(statLabel, bar, value);
        stats.append(row);
      });

      label.append(number, name, role);
      card.append(swatch, label, stats);
      return card;
    }),
  );
}

function selectCar(id, { announce = true } = {}) {
  selectedCar = getCarChoice(id);
  applyCarChoice(player, selectedCar);
  updateSelectedCarUi();
  if (announce) setRadio(`${selectedCar.name} selected.`);
}

function applyCarChoice(racer, car) {
  racer.car = car;
  racer.spec = car.spec;
  racer.color = car.color;
  racer.accent = car.accent;
  racer.bodyMaterial.color.setHex(car.color);
  racer.bodyMaterial.emissive.setHex(car.color);
  racer.accentMaterial.color.setHex(car.accent);
  racer.accentMaterial.emissive.setHex(car.accent);
  racer.flameMaterial.color.setHex(car.accent);
}

function updateSelectedCarUi() {
  ui.selectedCarName.textContent = selectedCar.name;
  ui.selectedCarRole.textContent = selectedCar.role;
  ui.selectedCarSwatch.style.setProperty("--car-color", toCssColor(selectedCar.color));
  ui.selectedCarSwatch.style.setProperty("--accent-color", toCssColor(selectedCar.accent));

  ui.carGrid.querySelectorAll(".car-card").forEach((card) => {
    const active = card.dataset.carId === selectedCar.id;
    card.classList.toggle("is-selected", active);
    card.setAttribute("aria-pressed", String(active));
  });
}

function startRace() {
  gamePhase = "race";
  resetRace(`${selectedCar.name} staged. Pace target confirmed.`);
  syncScreenState();
}

function openGarage() {
  gamePhase = "select";
  resetRace(`${selectedCar.name} ready in garage.`);
  syncScreenState();
}

function syncScreenState() {
  const selecting = gamePhase === "select";
  ui.carSelectScreen.classList.toggle("is-hidden", !selecting);
  ui.hudLeft.classList.toggle("is-hidden", selecting);
  ui.hudRight.classList.toggle("is-hidden", selecting);
  ui.raceMessage.classList.toggle("is-hidden", selecting);
}

function setPace(index) {
  if (gamePhase !== "race") return;
  race.pace = THREE.MathUtils.clamp(index, 0, paceProfiles.length - 1);
  setRadio(paceProfiles[race.pace].label);
  updateButtonState();
}

function deployBoost() {
  if (gamePhase !== "race") return;
  const boostEnergyCost = 30 * player.spec.boostCost;
  if (race.finished || race.boostCooldown > 0 || race.boostTime > 0 || player.energy < boostEnergyCost || player.heat > 92) {
    setRadio(player.energy < boostEnergyCost ? "Boost denied. Energy reserve too low." : "Boost locked out. Cool the craft.");
    return;
  }
  race.boostTime = 2.45 * player.spec.boostDuration;
  race.boostCooldown = 7.5 * player.spec.cooldown;
  player.energy = clampStat(player.energy - boostEnergyCost);
  player.heat = clampStat(player.heat + 13 * player.spec.heatGain);
  setRadio("Boost deployed. Driver committed.");
  updateButtonState();
}

function resetRace(message = "Driver settled. Pace target confirmed.") {
  race.pace = 1;
  race.overtake = false;
  race.boostTime = 0;
  race.boostCooldown = 0;
  race.elapsed = 0;
  race.finished = false;
  race.radioTimer = 0;
  race.lastLap = 1;
  race.finishOrder = [];

  const starts = [5, -10, -25, -40, -55, -70];
  racers.forEach((racer, index) => {
    racer.progress = starts[index];
    racer.speed = 72 + index * 0.8;
    racer.energy = racer.isPlayer ? 100 : 70;
    racer.heat = 4;
    racer.focus = racer.isPlayer ? 100 : 78;
    racer.boost = 0;
    racer.wobble = 0;
    racer.finished = false;
    racer.finishTime = null;
    racer.targetLane = racer.lane;
  });
  setRadio(message);
  updateButtonState();
}

function loop() {
  const dt = Math.min(clock.getDelta(), 0.045);
  update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

function update(dt) {
  sceneTime += dt;
  if (gamePhase === "select") {
    updateGaragePreview(dt);
    return;
  }

  if (!race.finished) race.elapsed += dt;
  race.boostTime = Math.max(0, race.boostTime - dt);
  race.boostCooldown = Math.max(0, race.boostCooldown - dt);
  race.radioTimer = Math.max(0, race.radioTimer - dt);

  updateRacers(dt);
  updateCamera(dt);
  updateHud();
}

function updateGaragePreview(dt) {
  racers.forEach((racer) => updateRacerTransform(racer, dt));
  updateCamera(dt);
}

function updateRacers(dt) {
  const order = sortedRacers();
  const playerIndex = order.findIndex((racer) => racer.isPlayer);
  const rivalAhead = order[playerIndex - 1] || null;

  racers.forEach((racer) => {
    if (racer.finished) {
      updateRacerTransform(racer, dt);
      return;
    }

    const lapProgress = positiveModulo(racer.progress, trackLength) / trackLength;
    const sampleIndex = Math.round(lapProgress * TRACK_SAMPLES) % TRACK_SAMPLES;
    const curvePenalty = trackData.curvature[sampleIndex];
    const downhill = THREE.MathUtils.clamp(-trackData.tangents[sampleIndex].y * 0.9, -0.16, 0.22);
    const spec = racer.spec ?? BASE_CAR_SPEC;
    const cornerHeat = Math.max(0.72, 1 / spec.cornering);
    const turnLimit = 1 - (curvePenalty * 0.27) / spec.cornering;
    const baseTarget = (112 + downhill * 28) * turnLimit * racer.skill * spec.speed;
    let targetSpeed = baseTarget;

    if (racer.isPlayer) {
      const pace = paceProfiles[race.pace];
      const inTraffic = rivalAhead && rivalAhead.progress - racer.progress < 35 && rivalAhead.progress > racer.progress;
      targetSpeed *= pace.speed;
      racer.energy = clampStat(
        racer.energy +
          scaleStatRate(pace.energy, spec.energyRecovery, spec.energyCost) * dt +
          (curvePenalty > 0.72 ? 2.2 * spec.energyRecovery * dt : 0),
      );
      racer.heat = clampStat(
        racer.heat +
          scaleStatRate(pace.heat, spec.heatGain, spec.cooling) * dt +
          curvePenalty * 2.4 * spec.heatGain * cornerHeat * dt,
      );
      racer.focus = clampStat(
        racer.focus +
          scaleStatRate(pace.focus, spec.focusRecovery, spec.focusCost) * dt -
          Math.max(0, racer.heat - 78) * 0.08 * spec.focusCost * dt,
      );

      if (race.overtake && inTraffic) {
        targetSpeed += 18 * spec.overtakePower;
        racer.energy = clampStat(racer.energy - 7 * spec.energyCost * dt);
        racer.focus = clampStat(racer.focus - 12 * spec.focusCost * dt);
        racer.heat = clampStat(racer.heat + 4.6 * spec.heatGain * dt);
        racer.targetLane = rivalAhead.lane > 0 ? -0.32 : 0.32;
        if (race.elapsed - racer.lastOvertakeTry > 3.2) {
          racer.lastOvertakeTry = race.elapsed;
          const risk =
            (Math.max(0, racer.heat - 76) * 0.012 + Math.max(0, 38 - racer.focus) * 0.018) / spec.cornering;
          if (Math.random() < risk) {
            racer.wobble = 1.25;
            racer.speed *= 0.84;
            setRadio("Driver lost composure on the pass.");
          } else {
            setRadio("Overtake pressure applied.");
          }
        }
      } else {
        racer.targetLane = THREE.MathUtils.lerp(racer.targetLane, racer.lane, 0.02);
      }

      if (race.boostTime > 0) {
        targetSpeed += 45 * spec.boostPower;
        racer.heat = clampStat(racer.heat + 8 * spec.heatGain * dt);
      }
    } else {
      racer.aiMood += dt;
      const leaderGap = order[0].progress - racer.progress;
      targetSpeed *= 0.97 + Math.sin(racer.aiMood * 0.35) * 0.035;
      if (leaderGap > 40 && racer.energy > 20 && Math.sin(racer.aiMood) > 0.965) {
        racer.boost = 1.7 * spec.boostDuration;
        racer.energy -= 18 * spec.boostCost;
      }
      if (racer.boost > 0) {
        racer.boost -= dt;
        targetSpeed += 30 * spec.boostPower;
      }
      racer.energy = clampStat(racer.energy + 1.5 * spec.energyRecovery * dt);
      racer.heat = clampStat(racer.heat - 1.6 * spec.cooling * dt + curvePenalty * 2.5 * spec.heatGain * cornerHeat * dt);
      racer.focus = clampStat(racer.focus + 1.3 * spec.focusRecovery * dt);
      racer.targetLane = racer.lane + Math.sin(racer.aiMood * 0.4) * 0.08;
    }

    if (racer.wobble > 0) {
      racer.wobble = Math.max(0, racer.wobble - dt);
      targetSpeed *= 0.82;
    }

    const overheated = racer.heat > 88 ? (racer.heat - 88) * 1.2 : 0;
    const tired = racer.focus < 25 ? (25 - racer.focus) * 0.8 : 0;
    targetSpeed -= overheated + tired;
    targetSpeed = Math.max(54, targetSpeed);
    racer.speed += (targetSpeed - racer.speed) * (1 - Math.pow(0.022, dt * spec.acceleration));
    racer.progress += racer.speed * dt;

    if (racer.progress >= trackLength * TOTAL_LAPS) {
      racer.finished = true;
      racer.finishTime = race.elapsed;
      racer.speed *= 0.7;
      race.finishOrder.push(racer);
      if (racer.isPlayer) {
        race.finished = true;
        race.overtake = false;
        setRadio(`Race complete. Finished P${race.finishOrder.length}.`);
      }
    }

    updateRacerTransform(racer, dt);
  });

  const playerLap = Math.min(TOTAL_LAPS, Math.floor(player.progress / trackLength) + 1);
  if (playerLap > race.lastLap) {
    race.lastLap = playerLap;
    player.energy = clampStat(player.energy + 18 * player.spec.lapCharge);
    player.focus = clampStat(player.focus + 9 * player.spec.focusRecovery);
    setRadio(`Lap ${playerLap}. Energy reserve topped up.`);
  }
}

function updateRacerTransform(racer, dt) {
  const t = positiveModulo(racer.progress, trackLength) / trackLength;
  const point = curve.getPointAt(t);
  const tangent = curve.getTangentAt(t).normalize();
  const lateral = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
  racer.laneVelocity += (racer.targetLane - racer.lane) * 7.5 * dt;
  racer.laneVelocity *= Math.pow(0.12, dt);
  racer.lane += racer.laneVelocity * dt;

  const hover = 2.3 + Math.sin(sceneTime * 5.4 + racer.progress * 0.02) * 0.32;
  const wobble = racer.wobble > 0 ? Math.sin(sceneTime * 28) * racer.wobble * 0.55 : 0;
  const position = point.clone().addScaledVector(lateral, racer.lane * trackWidth);
  position.y += hover;
  racer.group.position.lerp(position, 1 - Math.pow(0.001, dt));

  const yaw = Math.atan2(tangent.x, tangent.z);
  const bank = -racer.laneVelocity * 0.8 - trackData.curvature[Math.round(t * TRACK_SAMPLES) % TRACK_SAMPLES] * 0.42 + wobble;
  const pitch = -tangent.y * 0.85;
  racer.group.rotation.set(pitch, yaw, bank, "YXZ");

  const flameScale = racer.isPlayer && race.boostTime > 0 ? 1.8 : racer.boost > 0 ? 1.55 : 0.9 + racer.speed / 170;
  racer.flame.scale.set(1, flameScale, 1);
  racer.flame.visible = racer.speed > 68;
}

function updateCamera(dt) {
  const t = positiveModulo(player.progress, trackLength) / trackLength;
  const point = curve.getPointAt(t);
  const tangent = curve.getTangentAt(t).normalize();
  const lateral = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
  const playerPosition = point.clone().addScaledVector(lateral, player.lane * trackWidth);
  playerPosition.y += 2.5;

  const speedFactor = THREE.MathUtils.clamp(player.speed / 170, 0, 1);
  const cameraTarget = playerPosition
    .clone()
    .addScaledVector(tangent, -24 - speedFactor * 10)
    .addScaledVector(lateral, -player.lane * 4)
    .add(new THREE.Vector3(0, 13 + speedFactor * 4, 0));
  camera.position.lerp(cameraTarget, 1 - Math.pow(0.006, dt));

  const lookAhead = playerPosition.clone().addScaledVector(tangent, 30 + speedFactor * 28);
  lookAhead.y += 3;
  camera.lookAt(lookAhead);
}

function updateHud() {
  const order = sortedRacers();
  const playerPosition = order.findIndex((racer) => racer.isPlayer) + 1;
  const lap = Math.min(TOTAL_LAPS, Math.max(1, Math.floor(player.progress / trackLength) + 1));
  const ahead = order[playerPosition - 2];
  const gap = ahead ? `${Math.max(0, ahead.progress - player.progress).toFixed(0)}m` : "LEAD";

  ui.energyMeter.style.width = `${player.energy}%`;
  ui.heatMeter.style.width = `${player.heat}%`;
  ui.focusMeter.style.width = `${player.focus}%`;
  ui.energyValue.textContent = `${Math.round(player.energy)}`;
  ui.heatValue.textContent = `${Math.round(player.heat)}`;
  ui.focusValue.textContent = `${Math.round(player.focus)}`;
  ui.positionValue.textContent = `${playerPosition}/${racers.length}`;
  ui.lapValue.textContent = `${lap}/${TOTAL_LAPS}`;
  ui.speedValue.textContent = `${Math.max(0, Math.round(player.speed)).toString().padStart(3, "0")}`;
  ui.gapValue.textContent = gap;
  ui.raceState.textContent = race.finished ? "DONE" : race.boostTime > 0 ? "BOOST" : "LIVE";

  ui.boostButton.disabled = race.finished || race.boostCooldown > 0 || player.energy < 30 * player.spec.boostCost || player.heat > 92;
  ui.boostState.textContent = race.boostTime > 0 ? "BURN" : race.boostCooldown > 0 ? `${Math.ceil(race.boostCooldown)}` : "READY";
  updateButtonState();
  renderStandings(order);

  if (race.radioTimer <= 0 && !race.finished) {
    const context = player.heat > 84 ? "Heat critical. Back off soon." : player.focus < 28 ? "Driver focus fading." : "Telemetry nominal.";
    ui.radioMessage.textContent = context;
    race.radioTimer = 3.6;
  }
}

function updateButtonState() {
  ui.paceButtons.forEach((button) => {
    button.classList.toggle("is-active", Number(button.dataset.pace) === race.pace);
  });
  ui.overtakeButton.classList.toggle("is-active", race.overtake);
  ui.overtakeButton.setAttribute("aria-pressed", String(race.overtake));
  ui.overtakeState.textContent = race.overtake ? "ON" : "ARM";
  ui.boostButton.classList.toggle("is-active", race.boostTime > 0);
}

function renderStandings(order) {
  ui.standingsList.replaceChildren(
    ...order.map((racer, index) => {
      const item = document.createElement("li");
      item.classList.toggle("is-player", racer.isPlayer);
      item.style.borderColor = `#${racer.group.children[0].material.color.getHexString()}`;

      const pos = document.createElement("span");
      pos.textContent = `P${index + 1}`;
      const name = document.createElement("strong");
      name.textContent = racer.name;
      const delta = document.createElement("b");
      delta.textContent = index === 0 ? "0m" : `${Math.max(0, order[0].progress - racer.progress).toFixed(0)}m`;

      item.append(pos, name, delta);
      return item;
    }),
  );
}

function sortedRacers() {
  return [...racers].sort((a, b) => {
    if (a.finished && b.finished) return a.finishTime - b.finishTime;
    if (a.finished) return -1;
    if (b.finished) return 1;
    return b.progress - a.progress;
  });
}

function setRadio(message) {
  ui.radioMessage.textContent = message;
  race.radioTimer = 3.4;
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function getCarChoice(id) {
  return carChoices.find((car) => car.id === id) ?? carChoices[0];
}

function scaleStatRate(rate, positiveMultiplier, negativeMultiplier) {
  return rate >= 0 ? rate * positiveMultiplier : rate * negativeMultiplier;
}

function toCssColor(hex) {
  return `#${hex.toString(16).padStart(6, "0")}`;
}

function positiveModulo(value, modulo) {
  return ((value % modulo) + modulo) % modulo;
}

function clampStat(value) {
  return THREE.MathUtils.clamp(value, 0, 100);
}

function mulberry32(seed) {
  return function random() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
