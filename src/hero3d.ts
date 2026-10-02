/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';

/** Kinematic state published by CharacterRenderer each frame. */
export interface HeroPose {
  visible: boolean;
  viewScale: number;
  flightPose: number; // 0 = hero stance, 1 = flying
  bodyYaw: number;
  bankAngle: number;
  pitchAngle: number;
  barrelRollAngle: number;
  collisionWobble: number;
  hoverBob: number;
  altitudeBoost: number;
  turnCentrifugal: number;
  flightPhase: number;
  capePhase: number;
  isMoving: boolean;
  speedKmh: number;
}

const HERO_HEIGHT = 1.8;
const HERO_MODEL_URL = '/models/hero.glb';
const HERO_SPLIT_X = 0.013; // gap between the two figures in the Tripo export
const HERO_MODEL_YAW = Math.PI / 2;
const CAPE_COLS = 14;
const CAPE_ROWS = 22;

/**
 * Real-time 3D superhero (Three.js): PBR suit, sculpted body, flowing cloth cape,
 * image-based lighting and soft shadows. Drawn on its own transparent WebGL canvas
 * that sits over the 3D map and under the 2D FX layer.
 */
export class Hero3D {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(15, 1, 0.1, 80);

  private yawGroup = new THREE.Group();
  private rollGroup = new THREE.Group();
  private pitchGroup = new THREE.Group();
  private body = new THREE.Group();

  private pelvis = new THREE.Group();
  private chest = new THREE.Group();
  private head = new THREE.Group();
  private armL = this.makeLimb();
  private armR = this.makeLimb();
  private legL = this.makeLimb();
  private legR = this.makeLimb();

  private modelRoot?: THREE.Group;
  private cape!: THREE.Mesh;
  private capeGeo!: THREE.PlaneGeometry;
  private capeBase!: Float32Array;

  private width = 1;
  private height = 1;
  private visibleState = true;

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({canvas, alpha: true, antialias: true, powerPreference: 'high-performance'});
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.9;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Image based lighting for believable reflections on suit and cape
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.7;

    // Sun + sky fill + warm rim
    const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
    sun.position.set(2.5, 4, 2.2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -2;
    sun.shadow.camera.right = 2;
    sun.shadow.camera.top = 2;
    sun.shadow.camera.bottom = -2;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun);
    this.scene.add(new THREE.HemisphereLight(0xaed4ff, 0x4a3b30, 0.7));
    const rim = new THREE.DirectionalLight(0x9cc8ff, 1.4);
    rim.position.set(-3, 1.5, -2.5);
    this.scene.add(rim);

    this.camera.position.set(0, 4.6, 7.4);
    this.camera.lookAt(0, 0, 0);

    this.buildHero();

    this.rollGroup.add(this.pitchGroup);
    this.pitchGroup.add(this.body);
    this.yawGroup.add(this.rollGroup);
    this.scene.add(this.yawGroup);

    this.loadModel(HERO_MODEL_URL);
  }

  /**
   * Loads the sculpted hero (public/models/hero.glb, exported from Tripo).
   * The file holds two figures in one mesh; the caped hero sits at x < 0, so only
   * triangles on that side of the gap are kept. If the file is missing the procedural
   * hero stays in place.
   */
  private async loadModel(url: string) {
    try {
      const head = await fetch(url, {method: 'HEAD'});
      if (!head.ok || (head.headers.get('content-type') || '').includes('text/html')) return;
      const gltf = await new GLTFLoader().loadAsync(url);
      let src: THREE.Mesh | undefined;
      gltf.scene.traverse((o) => {
        if ((o as THREE.Mesh).isMesh && !src) src = o as THREE.Mesh;
      });
      if (!src) return;

      const geo = src.geometry as THREE.BufferGeometry;
      const pos = geo.attributes.position as THREE.BufferAttribute;
      const idx = geo.index ? (geo.index.array as ArrayLike<number>) : undefined;
      if (!idx) return;
      const keep: number[] = [];
      const min = new THREE.Vector3(Infinity, Infinity, Infinity);
      const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
      for (let t = 0; t < idx.length; t += 3) {
        const a = idx[t], b = idx[t + 1], c = idx[t + 2];
        const cx = (pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3;
        if (cx >= HERO_SPLIT_X) continue;
        keep.push(a, b, c);
        for (const i of [a, b, c]) {
          min.x = Math.min(min.x, pos.getX(i)); max.x = Math.max(max.x, pos.getX(i));
          min.y = Math.min(min.y, pos.getY(i)); max.y = Math.max(max.y, pos.getY(i));
          min.z = Math.min(min.z, pos.getZ(i)); max.z = Math.max(max.z, pos.getZ(i));
        }
      }
      if (!keep.length) return;
      geo.setIndex(keep);

      const old = src.material as THREE.MeshStandardMaterial;
      const mat = new THREE.MeshStandardMaterial({
        map: old.map || null,
        roughness: 0.62,
        metalness: 0.0,
        emissive: new THREE.Color(0xffffff),
        emissiveMap: old.map || null,
        emissiveIntensity: 0.1,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;

      // Normalise: pivot at the bbox centre, longest side = 2 units
      const size = max.clone().sub(min);
      const center = min.clone().add(max).multiplyScalar(0.5);
      const k = 2 / Math.max(size.x, size.y, size.z);
      mesh.position.copy(center).multiplyScalar(-k);
      mesh.scale.setScalar(k);

      const root = new THREE.Group();
      root.add(mesh);
      root.rotation.y = HERO_MODEL_YAW; // the model faces +X; the game faces -Z
      this.modelRoot = root;
      this.body.add(root);
      this.pelvis.visible = false; // hide the procedural hero
    } catch (err) {
      console.warn('Hero model not loaded, using procedural hero', err);
    }
  }

  // ------------------------------------------------------------------
  // Construction
  // ------------------------------------------------------------------
  private makeLimb() {
    return {root: new THREE.Group(), mid: new THREE.Group(), end: new THREE.Group()};
  }

  private fabricTexture(): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    g.fillStyle = '#808080';
    g.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 2) {
      for (let x = 0; x < 128; x += 2) {
        const v = 110 + ((x / 2 + y / 2) % 2) * 40 + Math.random() * 20;
        g.fillStyle = `rgb(${v},${v},${v})`;
        g.fillRect(x, y, 2, 2);
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(6, 6);
    return t;
  }

  private emblemTexture(): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, 256, 256);
    const shield = new Path2D('M128 14 L232 54 C232 150 190 214 128 244 C66 214 24 150 24 54 Z');
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#ffdf6b');
    grad.addColorStop(1, '#e8a317');
    g.fillStyle = grad;
    g.fill(shield);
    g.save();
    g.translate(128, 130);
    g.scale(0.82, 0.82);
    g.translate(-128, -130);
    g.fillStyle = '#c1121f';
    g.fill(shield);
    g.restore();
    g.fillStyle = '#ffd23f';
    g.beginPath(); // lightning bolt
    g.moveTo(142, 48); g.lineTo(88, 142); g.lineTo(124, 142);
    g.lineTo(108, 214); g.lineTo(170, 114); g.lineTo(132, 114); g.closePath();
    g.fill();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }

  private buildHero() {
    const fabric = this.fabricTexture();
    const suit = new THREE.MeshPhysicalMaterial({
      color: 0x1b4fd6, roughness: 0.46, metalness: 0.04, clearcoat: 0.35, clearcoatRoughness: 0.4,
      sheen: 0.6, sheenColor: new THREE.Color(0x8fb4ff), sheenRoughness: 0.5, bumpMap: fabric, bumpScale: 0.35,
    });
    const red = new THREE.MeshPhysicalMaterial({
      color: 0xc1121f, roughness: 0.38, metalness: 0.05, clearcoat: 0.6, clearcoatRoughness: 0.25, bumpMap: fabric, bumpScale: 0.25,
    });
    const gold = new THREE.MeshStandardMaterial({color: 0xf2b630, roughness: 0.28, metalness: 0.9});
    const skin = new THREE.MeshPhysicalMaterial({
      color: 0xe0ac8a, roughness: 0.55, metalness: 0, sheen: 0.4, sheenColor: new THREE.Color(0xffc7a8), clearcoat: 0.05,
    });
    const hair = new THREE.MeshPhysicalMaterial({color: 0x0f0f14, roughness: 0.35, metalness: 0, sheen: 1, sheenColor: new THREE.Color(0x4a5a8a)});

    const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material) => {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      m.receiveShadow = true;
      return m;
    };
    const ell = (r: number, sx: number, sy: number, sz: number, mat: THREE.Material) => {
      const m = mesh(new THREE.SphereGeometry(r, 40, 28), mat);
      m.scale.set(sx, sy, sz);
      return m;
    };

    // ---- Pelvis (origin of the whole body) ----
    this.pelvis.position.set(0, 0, 0);
    this.body.add(this.pelvis);
    this.pelvis.add(ell(0.2, 1.15, 0.8, 0.8, suit));
    const beltMat = red.clone();
    beltMat.side = THREE.DoubleSide;
    const belt = mesh(new THREE.CylinderGeometry(0.215, 0.205, 0.055, 48, 1, true), beltMat);
    belt.position.y = 0.1;
    belt.scale.set(1.1, 1, 0.8);
    this.pelvis.add(belt);
    const buckle = mesh(new THREE.BoxGeometry(0.07, 0.05, 0.035), gold);
    buckle.position.set(0, 0.095, -0.17);
    this.pelvis.add(buckle);

    // ---- Torso: tapered V from hips to shoulders ----
    const abdomen = mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.3, 40, 1), suit);
    abdomen.position.y = 0.2;
    abdomen.scale.z = 0.62;
    this.pelvis.add(abdomen);

    this.chest.position.set(0, 0.36, 0);
    this.pelvis.add(this.chest);
    const pecs = ell(0.2, 1.5, 1.05, 0.8, suit);
    pecs.position.y = 0.1;
    this.chest.add(pecs);
    const lats = ell(0.17, 1.6, 1.0, 0.7, suit);
    lats.position.set(0, 0.06, 0.05);
    this.chest.add(lats);
    const emblem = new THREE.Mesh(
      new THREE.PlaneGeometry(0.19, 0.19),
      new THREE.MeshStandardMaterial({map: this.emblemTexture(), transparent: true, roughness: 0.4, metalness: 0.3}),
    );
    emblem.position.set(0, 0.11, -0.172);
    emblem.rotation.y = Math.PI;
    this.chest.add(emblem);

    // ---- Neck & head ----
    const neck = mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.12, 20), skin);
    neck.position.y = 0.26;
    this.chest.add(neck);

    this.head.position.set(0, 0.4, 0);
    this.chest.add(this.head);
    const skull = ell(0.115, 0.92, 1.12, 1.02, skin);
    this.head.add(skull);
    const jaw = ell(0.085, 1.0, 0.8, 0.95, skin);
    jaw.position.set(0, -0.055, -0.02);
    this.head.add(jaw);
    for (const s of [-1, 1]) {
      const ear = ell(0.028, 0.5, 1, 0.9, skin);
      ear.position.set(0.108 * s, 0, 0);
      this.head.add(ear);
    }
    const hairCap = ell(0.122, 0.96, 1.08, 1.06, hair);
    hairCap.position.set(0, 0.022, 0.014);
    hairCap.scale.y = 0.9;
    this.head.add(hairCap);
    const curl = ell(0.04, 1.4, 0.8, 0.8, hair); // signature front curl
    curl.position.set(-0.03, 0.095, -0.1);
    curl.rotation.z = 0.5;
    this.head.add(curl);
    // Eyes + brows (visible when the camera swings round / in close ups)
    const eyeMat = new THREE.MeshStandardMaterial({color: 0x101820, roughness: 0.2});
    for (const s of [-1, 1]) {
      const eye = ell(0.012, 1, 0.8, 0.5, eyeMat);
      eye.position.set(0.04 * s, 0.01, -0.108);
      this.head.add(eye);
      const brow = mesh(new THREE.BoxGeometry(0.04, 0.007, 0.01), hair);
      brow.position.set(0.04 * s, 0.035, -0.108);
      brow.rotation.z = -0.15 * s;
      this.head.add(brow);
    }

    // ---- Shoulders / arms ----
    const buildArm = (limb: ReturnType<Hero3D['makeLimb']>, side: number) => {
      limb.root.position.set(0.27 * side, 0.2, 0);
      this.chest.add(limb.root);
      limb.root.add(ell(0.075, 1, 1, 1, suit)); // deltoid
      const upper = mesh(new THREE.CapsuleGeometry(0.056, 0.2, 10, 24), suit);
      upper.position.y = -0.13;
      upper.scale.z = 0.92;
      limb.root.add(upper);
      limb.mid.position.set(0, -0.27, 0);
      limb.root.add(limb.mid);
      limb.mid.add(ell(0.048, 1, 1, 1, suit));
      const fore = mesh(new THREE.CapsuleGeometry(0.045, 0.2, 10, 24), suit);
      fore.position.y = -0.13;
      limb.mid.add(fore);
      const gauntlet = mesh(new THREE.CylinderGeometry(0.05, 0.043, 0.1, 24), red);
      gauntlet.position.y = -0.2;
      limb.mid.add(gauntlet);
      limb.end.position.set(0, -0.3, 0);
      limb.mid.add(limb.end);
      const fist = ell(0.05, 1, 1.05, 1.05, red);
      limb.end.add(fist);
      const thumb = ell(0.02, 0.9, 1.4, 0.9, red);
      thumb.position.set(-0.05 * side, 0.02, -0.02);
      limb.end.add(thumb);
    };
    buildArm(this.armL, -1);
    buildArm(this.armR, 1);

    // ---- Legs ----
    const buildLeg = (limb: ReturnType<Hero3D['makeLimb']>, side: number) => {
      limb.root.position.set(0.085 * side, -0.05, 0);
      this.pelvis.add(limb.root);
      const thigh = mesh(new THREE.CapsuleGeometry(0.083, 0.3, 10, 24), suit);
      thigh.position.y = -0.2;
      thigh.scale.z = 0.95;
      limb.root.add(thigh);
      limb.mid.position.set(0, -0.43, 0);
      limb.root.add(limb.mid);
      limb.mid.add(ell(0.065, 1, 1, 1, suit)); // knee
      const shin = mesh(new THREE.CapsuleGeometry(0.058, 0.3, 10, 24), suit);
      shin.position.y = -0.2;
      limb.mid.add(shin);
      const boot = mesh(new THREE.CapsuleGeometry(0.063, 0.26, 10, 24), red);
      boot.position.y = -0.3;
      limb.mid.add(boot);
      const bootTop = mesh(new THREE.TorusGeometry(0.063, 0.01, 12, 32), gold);
      bootTop.rotation.x = Math.PI / 2;
      bootTop.position.y = -0.16;
      limb.mid.add(bootTop);
      limb.end.position.set(0, -0.45, 0);
      limb.mid.add(limb.end);
      const foot = ell(0.066, 0.95, 0.55, 1.7, red);
      foot.position.set(0, -0.02, -0.06);
      limb.end.add(foot);
    };
    buildLeg(this.legL, -1);
    buildLeg(this.legR, 1);

    this.buildCape(red);
  }

  private buildCape(red: THREE.MeshPhysicalMaterial) {
    const geo = new THREE.PlaneGeometry(1, 1, CAPE_COLS, CAPE_ROWS);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const base = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i) + 0.5; // 0..1 across
      const v = 0.5 - pos.getY(i); // 0 top .. 1 bottom
      const width = 0.38 + 0.7 * v; // flares toward the hem
      base[i * 3] = (u - 0.5) * width;
      base[i * 3 + 1] = -v * 1.35;
      base[i * 3 + 2] = 0;
    }
    this.capeBase = base;
    this.capeGeo = geo;
    const mat = red.clone();
    mat.side = THREE.DoubleSide;
    mat.sheen = 1;
    mat.sheenColor = new THREE.Color(0xff7a85);
    mat.sheenRoughness = 0.35;
    mat.roughness = 0.5;
    mat.clearcoat = 0.2;
    this.cape = new THREE.Mesh(geo, mat);
    this.cape.castShadow = true;
    this.cape.receiveShadow = true;
    this.cape.frustumCulled = false;
    this.cape.position.set(0, 0.28, 0.115);
    this.chest.add(this.cape);
    // gold clasps
    const clasp = new THREE.MeshStandardMaterial({color: 0xf2b630, roughness: 0.28, metalness: 0.9});
    for (const s of [-1, 1]) {
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.026, 16, 12), clasp);
      c.position.set(0.17 * s, 0.26, 0.04);
      c.castShadow = true;
      this.chest.add(c);
    }
  }

  // ------------------------------------------------------------------
  // Frame update
  // ------------------------------------------------------------------
  public resize(width: number, height: number) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
  }

  public setVisible(v: boolean) {
    if (this.visibleState === v) return;
    this.visibleState = v;
    this.canvas.style.visibility = v ? 'visible' : 'hidden';
  }

  public render(p: HeroPose) {
    this.setVisible(p.visible);
    if (!p.visible) return;

    const f = p.flightPose;

    // Screen-space size: hero is ~150px tall at viewScale 1 (matches the old 2D footprint)
    const dist = this.camera.position.length();
    const worldPerPx = (2 * dist * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))) / this.height;
    const s = (150 * p.viewScale * worldPerPx) / HERO_HEIGHT;
    this.yawGroup.scale.setScalar(s);
    this.yawGroup.position.y = -(p.hoverBob + p.altitudeBoost) * worldPerPx;

    // Orientation: yaw about waist, bank about the travel axis, lean forward when flying
    this.yawGroup.rotation.y = -p.bodyYaw;
    this.rollGroup.rotation.z = -(p.bankAngle + p.collisionWobble);
    const sculpted = !!this.modelRoot; // the sculpted model is already posed mid-flight
    const lean = (sculpted ? f * 0.35 : f * 1.05) + p.pitchAngle * 0.7;
    this.pitchGroup.rotation.x = -lean;
    this.body.rotation.y = p.barrelRollAngle; // corkscrew along the body axis
    this.body.position.y = sculpted ? 0 : -0.05 + f * 0.15;

    if (!sculpted) {
      this.pose(p, f);
      this.animateCape(p, f);
    }
    this.renderer.render(this.scene, this.camera);
  }

  private pose(p: HeroPose, f: number) {
    const t = p.flightPhase;
    const breathe = Math.sin(t * 1.5) * 0.012;
    const flutter = Math.sin(t * 3.1) * 0.03 * f;

    // Stance: hands on hips, feet planted. Flight: arms forward in a Superman reach, legs trailing together.
    const lerp = THREE.MathUtils.lerp;

    // Head tracks forward, lifts out of the lean
    this.head.rotation.x = lerp(0, 0.55, f) + breathe;
    this.chest.rotation.x = lerp(0.02, -0.08, f);
    this.chest.rotation.z = -p.bankAngle * 0.25;

    // Right arm leads (fist overhead), left arm trails slightly bent: classic flying pose
    this.armR.root.rotation.set(lerp(0.15, -Math.PI + 0.1, f) + flutter, 0, lerp(-0.6, -0.12, f));
    this.armR.mid.rotation.set(lerp(-0.2, 0.05, f), 0, lerp(0.9, 0, f));
    this.armR.end.rotation.set(0, 0, 0);

    this.armL.root.rotation.set(lerp(0.15, -Math.PI + 0.45, f) - flutter, 0, lerp(0.6, 0.32, f));
    this.armL.mid.rotation.set(lerp(-0.2, 0.5, f), 0, lerp(-0.9, -0.1, f));
    this.armL.end.rotation.set(0, 0, 0);

    // Legs
    const kick = Math.sin(t * 2.2) * 0.06 * f;
    this.legR.root.rotation.set(lerp(0.02, 0.1 + kick, f), 0, lerp(-0.08, -0.04, f));
    this.legR.mid.rotation.set(lerp(0.05, 0.22, f), 0, 0);
    this.legR.end.rotation.set(lerp(0, 0.65, f), 0, 0); // pointed toes

    this.legL.root.rotation.set(lerp(0.02, 0.18 - kick, f), 0, lerp(0.08, 0.04, f));
    this.legL.mid.rotation.set(lerp(0.05, 0.3, f), 0, 0);
    this.legL.end.rotation.set(lerp(0, 0.65, f), 0, 0);

    // Collision shiver
    this.pelvis.rotation.z = p.collisionWobble * 0.5;
  }

  private animateCape(p: HeroPose, f: number) {
    const pos = this.capeGeo.attributes.position as THREE.BufferAttribute;
    const base = this.capeBase;
    const tm = p.capePhase;
    const speed = Math.min(1.8, 0.35 + p.speedKmh / 40);
    // In flight the body is near horizontal, so the cape trails along local -Y (= behind the hero).
    // Stance: it hangs and sways gently. Both are expressed in the chest's local space.
    const stream = f * 0.55 * speed; // swept away from the body (local +Z)
    const sway = p.turnCentrifugal * 0.012;

    for (let i = 0; i < pos.count; i++) {
      const bx = base[i * 3];
      const by = base[i * 3 + 1];
      const v = -by / 1.35; // 0..1 down the cape
      const u = bx;
      const amp = (0.012 + 0.09 * v) * (0.6 + 0.8 * speed * f + 0.25);
      // pleats running down the cape + travelling wave
      const pleat = Math.sin(u * 17 + v * 1.5) * 0.022 * v * (0.5 + f);
      const ripple = Math.sin(tm * 0.55 - v * 6.2 + u * 4.0) * amp;
      const flap = Math.sin(tm * 0.31 - v * 3.0) * 0.06 * v * f * speed;
      pos.setXYZ(
        i,
        bx + sway * v * v * 6 + Math.sin(tm * 0.4 + v * 2) * 0.012 * v,
        by * (1 - 0.1 * f),
        v * v * stream * 0.45 + ripple + flap + pleat + 0.014 * v,
      );
    }
    pos.needsUpdate = true;
    this.capeGeo.computeVertexNormals();
  }
}
