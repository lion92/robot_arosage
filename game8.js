// ========================================
// DRONE SQUAD - COOP + CITY (Ultra Optimized)
// Additions vs previous "optimized":
// - Dynamic Resolution Scaling (DRS) based on frame time
// - Frustum culling for plant updates/effects
// - Sprite-based plant indicators (no extra PointLight per plant)
// - Fewer real lamps (1/8) + emissive heads
// - Cheaper materials where possible (Lambert on ground/plants)
// - Power preference high-performance
// ========================================

const CITY = {
    RING_INNER: 220,
    RING_OUTER: 620,
    ROAD_WIDTH: 16,
    BLOCK_SIZE: 90,
    BUILDING_MIN: 24,
    BUILDING_MAX: 90,
    LAMP_EVERY: 60,
    LAMP_HEIGHT: 22,
    MAX_BUILDINGS: 380,
    MAX_LAMPS: 96,
    LIT_LAMP_RATIO: 8
};

const CONFIG = {
    WATERING_TIME: 1000,
    WATERING_DISTANCE: 50,
    WATERING_HEIGHT: 40,
    DRONE_SPEED: 2.0,
    WATER_PER_PLANT: 20,
    REFILL_SPEED: 10,
    REBALANCE_EVERY_MS: 1700
};

// Globals
let scene, camera, renderer;
let aiDrones = [];
let plants = [];
let lakeMesh;
let sun, ambientLight;
let gameRunning = false;
let gamePaused = false;
let startTime;
let droneCount = 3;

// Pools
const DROP_POOL_SIZE = 160;
const PARTICLE_POOL_SIZE = 100;
let dropPool = [];
let liveDrops = [];
let particlePool = [];
let liveParticles = [];

// Reusable temporaries
const _tmpV1 = new THREE.Vector3();
const _tmpV2 = new THREE.Vector3();
const _frustum = new THREE.Frustum();
const _projScreen = new THREE.Matrix4();

// DRS (Dynamic Resolution Scaling)
let _drsEnabled = true;
let _targetPR = Math.min(window.devicePixelRatio, 2);
const _minPR = 0.8, _maxPR = 2.0;
let _frameTimes = []; const _ftWindow = 30; // rolling avg over 30 frames
let _frameCounter = 0;

let stats = {
    score: 0,
    plantsWatered: 0,
    totalPlants: 0,
    highScore: parseInt(localStorage.getItem('droneHighScore') || 0)
};

const MAP_SIZE = 1500;

// ----------------------------------------
// Task Manager (throttled)
// ----------------------------------------
const TaskManager = {
    claims: new Map(),
    everAssigned: new Set(),
    lastBalance: 0,
    reset(){ this.claims.clear(); this.everAssigned.clear(); this.lastBalance = 0; },
    plantId(p){ return p._uid; },
    claim(p, d){
        if (!p || p.watered) return false;
        const id = this.plantId(p);
        if (this.claims.has(id)) return this.claims.get(id) === d.id;
        this.claims.set(id, d.id); this.everAssigned.add(id); p.claimedBy = d.id; return true;
    },
    release(p, d){ if (!p) return; const id = this.plantId(p); if (this.claims.get(id) === d.id) this.claims.delete(id); p.claimedBy = null; },
    nextPlantFor(d){
        let best=null, bestDist=Infinity;
        for (const p of plants){
            if (p.watered || p.claimedBy != null) continue;
            if (d.plantsWatered===0 && this.everAssigned.has(this.plantId(p))) continue;
            const dist = d.position.distanceTo(p.position);
            if (dist < bestDist){ best = p; bestDist = dist; }
        }
        if (!best){
            for (const p of plants){
                if (p.watered || p.claimedBy != null) continue;
                const dist = d.position.distanceTo(p.position);
                if (dist < bestDist){ best = p; bestDist = dist; }
            }
        }
        return best;
    },
    balance(){
        const now = performance.now();
        if (now - this.lastBalance < CONFIG.REBALANCE_EVERY_MS) return;
        this.lastBalance = now;

        for (const p of plants){
            if (p.watered && p.claimedBy){
                const id = this.plantId(p); this.claims.delete(id); p.claimedBy = null;
            }
        }
        for (const d of aiDrones){
            if (d.state === 'SEARCHING' && d.waterLevel >= 30){
                const t = this.nextPlantFor(d);
                if (t && this.claim(t, d)){ d.target = t; d.state = 'MOVING'; }
            }
        }
    }
};

let _uidCounter = 1;
function assignUID(obj) { Object.defineProperty(obj, '_uid', { value: _uidCounter++, enumerable: false }); }

// ----------------------------------------
function createRoadGridTexture(size, blockSize, roadWidth) {
    const cvs = document.createElement('canvas');
    cvs.width = cvs.height = 1024;
    const ctx = cvs.getContext('2d');
    ctx.fillStyle = '#335a1a'; ctx.fillRect(0,0,1024,1024);
    const scale = cvs.width / size;
    const step = blockSize * scale;
    const w = roadWidth * scale;
    ctx.fillStyle = '#2b2b2b';
    for (let x = 0; x <= cvs.width; x += step) ctx.fillRect(x - w*0.5, 0, w, cvs.height);
    for (let y = 0; y <= cvs.height; y += step) ctx.fillRect(0, y - w*0.5, cvs.width, w);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
    for (let x = 0; x <= cvs.width; x += step){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,cvs.height); ctx.stroke(); }
    for (let y = 0; y <= cvs.height; y += step){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(cvs.width,y); ctx.stroke(); }
    const tex = new THREE.CanvasTexture(cvs);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
}

function makeWindowTexture(w=128, h=256, hue=0.6) {
    const cvs = document.createElement('canvas');
    cvs.width = w; cvs.height = h;
    const ctx = cvs.getContext('2d');
    ctx.fillStyle = '#111318'; ctx.fillRect(0,0,w,h);
    const cols=6, rows=12, padX=8, padY=10;
    const cellW = (w - padX*2) / cols;
    const cellH = (h - padY*2) / rows;
    for (let i=0;i<cols;i++){
        for (let j=0;j<rows;j++){
            const x = padX + i*cellW + 2;
            const y = padY + j*cellH + 2;
            const on = Math.random() > 0.35;
            const l = on ? (60 + Math.random()*30) : (10 + Math.random()*10);
            const s = on ? 70 : 10;
            const color = `hsl(${((hue + (Math.random()*0.06-0.03))*360)|0},${s}%,${l}%)`;
            ctx.fillStyle = color; ctx.fillRect(x,y,cellW-4,cellH-4);
        }
    }
    const tex = new THREE.CanvasTexture(cvs);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
}

// Instanced city
let buildingInstanced, lampPoleInstanced, lampHeadInstanced;
const buildingMats = [
    new THREE.MeshPhysicalMaterial({ map: makeWindowTexture(128,256,0.56), emissive: 0x111111, metalness:0.55, roughness:0.5, clearcoat:0.35 }),
    new THREE.MeshPhysicalMaterial({ map: makeWindowTexture(128,256,0.60), emissive: 0x111111, metalness:0.60, roughness:0.45, clearcoat:0.40 }),
    new THREE.MeshPhysicalMaterial({ map: makeWindowTexture(128,256,0.64), emissive: 0x111111, metalness:0.50, roughness:0.55, clearcoat:0.30 })
];

function populateCityInstanced() {
    // Buildings
    const geo = new THREE.BoxGeometry(1,1,1);
    buildingInstanced = new THREE.InstancedMesh(geo, buildingMats[0], CITY.MAX_BUILDINGS);
    buildingInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    buildingInstanced.castShadow = false;
    buildingInstanced.receiveShadow = false; // encore un gain
    scene.add(buildingInstanced);

    const dummy = new THREE.Object3D();
    let count = 0;
    for (let i=0; i<CITY.MAX_BUILDINGS; i++){
        const a = Math.random()*Math.PI*2;
        const r = THREE.MathUtils.lerp(CITY.RING_INNER, CITY.RING_OUTER, Math.random());
        const x = Math.cos(a)*r;
        const z = Math.sin(a)*r;
        if (Math.hypot(x,z) < CITY.RING_INNER) continue;

        const w = THREE.MathUtils.randInt(16, 28);
        const d = THREE.MathUtils.randInt(16, 28);
        const h = THREE.MathUtils.randInt(CITY.BUILDING_MIN, CITY.BUILDING_MAX) * (Math.random()<0.2 ? 1.6 : 1);

        dummy.position.set(x, h/2, z);
        dummy.scale.set(w, h, d);
        dummy.rotation.y = Math.random()*Math.PI*2;
        dummy.updateMatrix();
        buildingInstanced.setMatrixAt(count, dummy.matrix);
        count++; if (count >= CITY.MAX_BUILDINGS) break;
    }
    buildingInstanced.count = count;

    // Lamps
    const poleGeo = new THREE.CylinderGeometry(0.6, 0.8, CITY.LAMP_HEIGHT, 8);
    const headGeo = new THREE.SphereGeometry(1.2, 12, 12);
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
    const headMat = new THREE.MeshBasicMaterial({ color: 0xfff3c4 });

    lampPoleInstanced = new THREE.InstancedMesh(poleGeo, poleMat, CITY.MAX_LAMPS);
    lampHeadInstanced = new THREE.InstancedMesh(headGeo, headMat, CITY.MAX_LAMPS);
    scene.add(lampPoleInstanced, lampHeadInstanced);

    let lampCount = 0;
    const perimeter = 2*Math.PI*CITY.RING_INNER;
    const targetLamps = Math.min(CITY.MAX_LAMPS, Math.floor(perimeter / CITY.LAMP_EVERY));
    for (let i=0;i<targetLamps;i++){
        const a = (i/targetLamps)*Math.PI*2;
        const x = Math.cos(a)*(CITY.RING_INNER + 6);
        const z = Math.sin(a)*(CITY.RING_INNER + 6);

        dummy.position.set(x, CITY.LAMP_HEIGHT/2, z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1,1,1);
        dummy.updateMatrix();
        lampPoleInstanced.setMatrixAt(lampCount, dummy.matrix);

        dummy.position.set(x, CITY.LAMP_HEIGHT, z);
        dummy.updateMatrix();
        lampHeadInstanced.setMatrixAt(lampCount, dummy.matrix);

        if (i % CITY.LIT_LAMP_RATIO === 0){
            const light = new THREE.PointLight(0xffe9aa, 0.7, 60, 2.2);
            light.position.set(x, CITY.LAMP_HEIGHT, z);
            scene.add(light);
        }
        lampCount++;
    }
    lampPoleInstanced.count = lampCount;
    lampHeadInstanced.count = lampCount;
}

// ----------------------------------------
// Plants (Lambert + sprite indicator)
// ----------------------------------------
class Plant {
    constructor(position, type = 'flower') {
        this.position = position.clone();
        this.type = type;
        this.health = 0;
        this.watered = false;
        this.pointValue = type === 'tree' ? 20 : type === 'bush' ? 15 : 10;
        this.claimedBy = null;
        assignUID(this);
        this.createMesh();
        this.createIndicator();
    }
    createMesh() {
        const group = new THREE.Group();
        if (this.type === 'flower') {
            const pot = new THREE.Mesh(
                new THREE.CylinderGeometry(5,4,6,8),
                new THREE.MeshLambertMaterial({ color: 0x8b4513 })
            );
            pot.position.y = 3; group.add(pot);
            const flowerGeo = new THREE.SphereGeometry(8, 16, 16);
            this.flowerMat = new THREE.MeshLambertMaterial({ color: 0xff6666 });
            this.flower = new THREE.Mesh(flowerGeo, this.flowerMat);
            this.flower.position.y = 18; this.flower.scale.set(1.5,1,1.5); group.add(this.flower);
        } else if (this.type === 'tree') {
            const trunk = new THREE.Mesh(new THREE.CylinderGeometry(4,5,25,8), new THREE.MeshLambertMaterial({ color: 0x4a3c28 }));
            trunk.position.y = 12.5; group.add(trunk);
            this.foliageMat = new THREE.MeshLambertMaterial({ color: 0x994444 });
            this.foliage = new THREE.Mesh(new THREE.ConeGeometry(15,20,8), this.foliageMat);
            this.foliage.position.y = 30; group.add(this.foliage);
        } else {
            this.bushMat = new THREE.MeshLambertMaterial({ color: 0x885544 });
            this.bush = new THREE.Mesh(new THREE.SphereGeometry(12,8,6), this.bushMat);
            this.bush.position.y = 10; this.bush.scale.set(1.5,1,1.5); group.add(this.bush);
        }
        this.mesh = group;
        this.mesh.position.copy(this.position);
        this.mesh.traverse(o=>{ if (o.isMesh){ o.castShadow = false; o.receiveShadow = true; } }); // pas de cast ombres pour gain
        scene.add(this.mesh);
    }
    createIndicator() {
        const texCvs = document.createElement('canvas'); texCvs.width=64; texCvs.height=64;
        const ictx = texCvs.getContext('2d');
        ictx.clearRect(0,0,64,64);
        const grd = ictx.createRadialGradient(32,32,8,32,32,30);
        grd.addColorStop(0,'rgba(255,80,80,0.95)'); grd.addColorStop(1,'rgba(255,80,80,0.0)');
        ictx.fillStyle = grd; ictx.beginPath(); ictx.arc(32,32,30,0,Math.PI*2); ictx.fill();
        const indicatorTex = new THREE.CanvasTexture(texCvs);
        indicatorTex.colorSpace = THREE.SRGBColorSpace;

        const mat = new THREE.SpriteMaterial({ map: indicatorTex, depthWrite:false, transparent:true });
        this.indicator = new THREE.Sprite(mat);
        this.indicator.position.copy(this.position); this.indicator.position.y = 40;
        this.indicator.scale.set(12,12,1);
        scene.add(this.indicator);

        const dropGeo = new THREE.SphereGeometry(3, 8, 8);
        const dropMat = new THREE.MeshBasicMaterial({ color: 0x00aaff, transparent: true, opacity: 0.8 });
        this.waterIcon = new THREE.Mesh(dropGeo, dropMat);
        this.waterIcon.position.copy(this.position); this.waterIcon.position.y = 45; this.waterIcon.scale.set(1,1.5,1);
        scene.add(this.waterIcon);
    }
    startWatering(){ this.wateringStartTime = performance.now(); }
    updateWatering(){
        if (!this.wateringStartTime || this.watered) return false;
        const elapsed = performance.now() - this.wateringStartTime;
        const progress = Math.min(100, (elapsed / CONFIG.WATERING_TIME) * 100);
        this.health = progress; this.updateAppearance();
        if (elapsed >= CONFIG.WATERING_TIME){ this.completeWatering(); return true; }
        return false;
    }
    completeWatering(){
        this.health = 100; this.watered = true; this.wateringStartTime = null;
        this.updateAppearance();
        if (this.indicator){ scene.remove(this.indicator); this.indicator = null; }
        if (this.waterIcon){ scene.remove(this.waterIcon); this.waterIcon = null; }
        this.createCompletionEffect();
    }
    updateAppearance(){
        const r = this.health / 100;
        if (this.type==='flower' && this.flowerMat){
            const hue = this.watered ? 0.3 : (0 + r * 0.3);
            const sat = this.watered ? 0.8 : 0.6;
            const light = 0.4 + r * 0.2;
            this.flowerMat.color.setHSL(hue, sat, light);
            if (this.watered){ this.flower.scale.setScalar(1.3); }
        } else if (this.type==='tree' && this.foliageMat){
            const hue = this.watered ? 0.3 : (0.1 + r * 0.2);
            const sat = this.watered ? 0.7 : 0.4;
            const light = 0.3 + r * 0.2;
            this.foliageMat.color.setHSL(hue, sat, light);
            if (this.watered){ this.foliage.scale.setScalar(1.2); }
        } else if (this.type==='bush' && this.bushMat){
            const hue = this.watered ? 0.3 : (0.08 + r * 0.22);
            const sat = this.watered ? 0.6 : 0.3;
            const light = 0.3 + r * 0.2;
            this.bushMat.color.setHSL(hue, sat, light);
            if (this.watered){ this.bush.scale.setScalar(1.25); }
        }
        if (this.indicator && !this.watered){
            const pulse = 0.8 + Math.sin(performance.now()*0.006)*0.2;
            this.indicator.scale.set(12*pulse, 12*pulse, 1);
        }
    }
    createCompletionEffect(){
        for (let i=0;i<8;i++){
            const p = particlePool.length ? particlePool.pop() : null;
            if (!p) break;
            p.visible = true; p.life = 36;
            p.position.copy(this.position); p.position.y += 20;
            const angle = (i/8)*Math.PI*2;
            p.velocity.set(Math.cos(angle)*5, 10 + Math.random()*5, Math.sin(angle)*5);
            scene.add(p);
            liveParticles.push(p);
        }
    }
    update(){
        if (this.waterIcon && !this.watered){
            this.waterIcon.rotation.y += 0.05;
            this.waterIcon.position.y = 45 + Math.sin(performance.now()*0.003)*3;
        }
        if (this.watered) this.mesh.rotation.y += 0.003;
    }
}

// ----------------------------------------
// Drone (identique à la version optimisée, petits ajustements)
// ----------------------------------------
class AIDrone {
    constructor(id, startPos) {
        this.id = id;
        this.position = startPos.clone();
        this.velocity = new THREE.Vector3();
        this.waterLevel = 100;
        this.state = 'SEARCHING';
        this.target = null;
        this.plantsWatered = 0;
        this.createMesh();
    }
    createMesh(){
        const group = new THREE.Group();
        const body = new THREE.Mesh(new THREE.OctahedronGeometry(10,1), new THREE.MeshLambertMaterial({ color: new THREE.Color().setHSL(this.id*0.15,0.8,0.5) }));
        group.add(body);
        this.rotors=[];
        for(let i=0;i<4;i++){
            const angle = (i/4)*Math.PI*2;
            const rotor = new THREE.Mesh(new THREE.BoxGeometry(8,0.5,2), new THREE.MeshBasicMaterial({ color: 0x222222 }));
            rotor.position.set(Math.cos(angle)*12,5,Math.sin(angle)*12);
            group.add(rotor); this.rotors.push(rotor);
        }
        const tankGeo = new THREE.SphereGeometry(6,8,8);
        this.tankMat = new THREE.MeshLambertMaterial({ color: 0x00aaff, transparent:true, opacity:0.6 });
        this.tank = new THREE.Mesh(tankGeo, this.tankMat); this.tank.position.y = -8; group.add(this.tank);
        const canvas = document.createElement('canvas'); canvas.width=64; canvas.height=64;
        const ctx = canvas.getContext('2d'); ctx.fillStyle='#fff'; ctx.font='bold 40px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(this.id.toString(),32,32);
        const texture = new THREE.CanvasTexture(canvas);
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture })); sprite.position.y = 15; sprite.scale.set(8,8,1); group.add(sprite);
        this.mesh = group; this.mesh.position.copy(this.position); scene.add(this.mesh);
    }
    update(){
        for (const rotor of this.rotors) rotor.rotation.y += 0.9;
        switch(this.state){
            case 'SEARCHING': this.findTarget(); break;
            case 'MOVING':    this.moveToTarget(); break;
            case 'WATERING':  this.waterPlant(); break;
            case 'REFILLING': this.refillAtLake(); break;
        }
        this.position.add(this.velocity); this.velocity.multiplyScalar(0.9);
        this.mesh.position.copy(this.position);
        const limit = MAP_SIZE/2 - 50;
        this.position.x = Math.max(-limit, Math.min(limit, this.position.x));
        this.position.z = Math.max(-limit, Math.min(limit, this.position.z));
        this.position.y = Math.max(20, Math.min(150, this.position.y));
        this.updateTankVisual();
    }
    findTarget(){
        if (this.waterLevel < 30){
            if (this.target) TaskManager.release(this.target, this);
            this.state = 'REFILLING'; return;
        }
        const candidate = TaskManager.nextPlantFor(this);
        if (candidate && TaskManager.claim(candidate, this)){
            this.target = candidate; this.state = 'MOVING'; return;
        }
        this.velocity.x += (Math.random()-0.5)*0.18;
        this.velocity.y += (Math.random()-0.5)*0.02;
        this.velocity.z += (Math.random()-0.5)*0.18;
    }
    moveToTarget(){
        const t = this.target;
        if (!t || t.watered){ if (t) TaskManager.release(t, this); this.target = null; this.state='SEARCHING'; return; }
        _tmpV1.copy(t.position); _tmpV1.y = CONFIG.WATERING_HEIGHT;
        const dist = this.position.distanceTo(_tmpV1);
        if (dist < CONFIG.WATERING_DISTANCE){ this.state='WATERING'; t.startWatering(this.id); return; }
        _tmpV1.sub(this.position).normalize();
        this.velocity.add(_tmpV1.multiplyScalar(CONFIG.DRONE_SPEED));
    }
    waterPlant(){
        const t = this.target; if (!t){ this.state='SEARCHING'; return; }
        _tmpV1.copy(t.position); _tmpV1.y = CONFIG.WATERING_HEIGHT;
        const dist = this.position.distanceTo(_tmpV1);
        if (dist > CONFIG.WATERING_DISTANCE){
            _tmpV1.sub(this.position).normalize();
            this.velocity.add(_tmpV1.multiplyScalar(0.5));
        }
        if (Math.random() < 0.22){
            const d = dropPool.length ? dropPool.pop() : null;
            if (d){
                d.visible = true; d.life = 26;
                d.position.copy(this.position); d.position.y -= 10;
                d.velocity = d.velocity || new THREE.Vector3();
                d.velocity.set((Math.random()-0.5)*2, -5, (Math.random()-0.5)*2);
                scene.add(d); liveDrops.push(d);
            }
        }
        const completed = t.updateWatering();
        if (completed){
            this.waterLevel -= CONFIG.WATER_PER_PLANT;
            this.plantsWatered++; stats.plantsWatered++; stats.score += t.pointValue;
            TaskManager.release(t, this);
            this.target = null; this.state='SEARCHING'; updateHUD();
            if (stats.plantsWatered >= stats.totalPlants) endGame(true);
        }
    }
    refillAtLake(){
        _tmpV1.set(0,30,0);
        const dist = this.position.distanceTo(_tmpV1);
        if (dist > 100){
            _tmpV1.sub(this.position).normalize();
            this.velocity.add(_tmpV1.multiplyScalar(CONFIG.DRONE_SPEED * 1.5));
        }else{
            this.waterLevel = Math.min(100, this.waterLevel + CONFIG.REFILL_SPEED);
            if (this.waterLevel >= 100) this.state='SEARCHING';
        }
    }
    updateTankVisual(){
        const ratio = this.waterLevel/100;
        this.tank.scale.y = 0.5 + ratio*0.5;
        this.tankMat.opacity = 0.3 + ratio*0.4;
        this.tankMat.color.setHex(this.waterLevel < 30 ? 0xff4444 : 0x00aaff);
    }
}

// ----------------------------------------
// Init / Scene
// ----------------------------------------
function init() {
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x87ceeb, 0.0005);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 3000);
    camera.position.set(0,150,250); camera.lookAt(0,0,0);

    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(_targetPR);
    renderer.shadowMap.enabled = true;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    ambientLight = new THREE.HemisphereLight(0x87ceeb, 0x545454, 0.7);
    scene.add(ambientLight);

    sun = new THREE.DirectionalLight(0xffffff, 1.25);
    sun.position.set(200, 400, 200);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1280, 1280);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 1200;
    sun.shadow.camera.left = -480;
    sun.shadow.camera.right = 480;
    sun.shadow.camera.top = 480;
    sun.shadow.camera.bottom = -480;
    scene.add(sun);

    const groundTex = createRoadGridTexture(MAP_SIZE, CITY.BLOCK_SIZE, CITY.RO
    AD_WIDTH);
    groundTex.anisotropy = 8;
    groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;
    const groundMat = new THREE.MeshLambertMaterial({ map: groundTex });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE), groundMat);
    ground.rotation.x = -Math.PI/2; ground.receiveShadow = true; scene.add(ground);

    const lakeGeo = new THREE.CircleGeometry(100, 32);
    const lakeMat = new THREE.MeshStandardMaterial({ color: 0x2c6ea8, metalness: 0.1, roughness: 0.25, transparent: true, opacity: 0.9 });
    lakeMesh = new THREE.Mesh(lakeGeo, lakeMat);
    lakeMesh.rotation.x = -Math.PI/2; lakeMesh.position.y = 0.5; scene.add(lakeMesh);

    const sky = new THREE.Mesh(new THREE.SphereGeometry(2000, 32, 32), new THREE.MeshBasicMaterial({ color: 0x87ceeb, side: THREE.BackSide }));
    scene.add(sky);

    populateCityInstanced();
    buildPools();
}

// Pools
function buildPools(){
    const dropGeo = new THREE.SphereGeometry(0.5, 6, 6);
    const dropMat = new THREE.MeshBasicMaterial({ color: 0x00aaff, transparent:true, opacity:0.8 });
    for (let i=0;i<DROP_POOL_SIZE;i++){ const m = new THREE.Mesh(dropGeo, dropMat.clone()); m.visible=false; m.velocity = new THREE.Vector3(); m.life = 0; dropPool.push(m); }
    const pGeo = new THREE.SphereGeometry(1, 6, 6);
    const pMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent:true, opacity:0.8 });
    for (let i=0;i<PARTICLE_POOL_SIZE;i++){ const m = new THREE.Mesh(pGeo, pMat.clone()); m.visible=false; m.velocity = new THREE.Vector3(); m.life = 0; particlePool.push(m); }
}

// ----------------------------------------
// Plants generation
// ----------------------------------------
function generatePlants() {
    plants.forEach(p => {
        if (p.mesh) scene.remove(p.mesh);
        if (p.indicator) scene.remove(p.indicator);
        if (p.waterIcon) scene.remove(p.waterIcon);
    });
    plants = [];

    const count = 40;
    const types = ['flower', 'tree', 'bush'];

    for (let i=0; i<count; i++){
        let x, z, valid = false, attempts = 0;
        while(!valid && attempts < 50){
            x = (Math.random() - 0.5) * (MAP_SIZE - 200);
            z = (Math.random() - 0.5) * (MAP_SIZE - 200);
            if (Math.sqrt(x*x + z*z) > 150){
                valid = true;
                for (let p of plants){
                    const dx = x - p.position.x, dz = z - p.position.z;
                    if (Math.sqrt(dx*dx + dz*dz) < 80){ valid = false; break; }
                }
            }
            attempts++;
        }
        if (!valid) continue;
        const type = types[Math.floor(Math.random()*types.length)];
        const plant = new Plant(new THREE.Vector3(x,0,z), type);
        plants.push(plant);
    }
    stats.totalPlants = plants.length;
}

// ----------------------------------------
// Game controls
// ----------------------------------------
function createDrones(count) {
    aiDrones.forEach(d => { if (d.mesh) scene.remove(d.mesh); });
    aiDrones = [];
    for (let i=0;i<count;i++){
        const angle = (i/count)*Math.PI*2;
        const radius = 80;
        const startPos = new THREE.Vector3(Math.cos(angle)*radius, 60, Math.sin(angle)*radius);
        aiDrones.push(new AIDrone(i+1, startPos));
    }
}

function startNewGame() {
    gameRunning = true;
    gamePaused = false;
    stats.score = 0; stats.plantsWatered = 0; startTime = performance.now();
    generatePlants();
    const requested = parseInt(document.getElementById('droneCount').value);
    droneCount = Math.min(requested, stats.totalPlants);
    TaskManager.reset();
    createDrones(droneCount);

    const free = new Set(plants.map(p=>p._uid));
    for (const d of aiDrones){
        let best=null, bestDist=Infinity;
        for (const p of plants){
            if (!free.has(p._uid) || p.watered) continue;
            const dist = d.position.distanceTo(p.position);
            if (dist < bestDist){ best=p; bestDist=dist; }
        }
        if (best){ free.delete(best._uid); if (TaskManager.claim(best,d)){ d.target=best; d.state='MOVING'; } }
    }

    document.getElementById('gameOver').style.display = 'none';
    updateHUD();
}

function pauseGame(){ if (!gameRunning) return; gamePaused = !gamePaused; }

function endGame(victory) {
    gameRunning = false;
    const title = document.getElementById('gameOverTitle');
    if (victory){ title.textContent='🎉 VICTOIRE!'; title.style.color='#00ff00'; }
    else { title.textContent='⏰ TEMPS ÉCOULÉ!'; title.style.color='#ff6666'; }

    document.getElementById('finalScore').textContent = stats.score;
    document.getElementById('finalPlants').textContent = `${stats.plantsWatered}/${stats.totalPlants}`;

    const elapsed = performance.now() - startTime;
    const seconds = Math.floor(elapsed/1000);
    const minutes = Math.floor(seconds/60);
    const secs = seconds % 60;
    document.getElementById('finalTime').textContent = `${minutes}:${secs.toString().padStart(2,'0')}`;

    if (stats.score > stats.highScore){
        stats.highScore = stats.score;
        localStorage.setItem('droneHighScore', stats.highScore);
        document.getElementById('scoreComparison').textContent = '🏆 NOUVEAU RECORD!';
    }
    document.getElementById('gameOver').style.display='block';
}

function updateHUD(){
    document.getElementById('score').textContent = stats.score;
    document.getElementById('plantsWatered').textContent = stats.plantsWatered;
    document.getElementById('totalPlants').textContent = stats.totalPlants;
    document.getElementById('activeDrones').textContent = aiDrones.length;
    document.getElementById('highScore').textContent = stats.highScore;
}

// ----------------------------------------
// Animation loop (DRS + frustum culling)
// ----------------------------------------
let _lastFrameTS = performance.now();
function animate() {
    requestAnimationFrame(animate);

    const now = performance.now();
    const dt = now - _lastFrameTS;
    _lastFrameTS = now;
    _frameTimes.push(dt); if (_frameTimes.length > _ftWindow) _frameTimes.shift();
    const avg = _frameTimes.reduce((a,b)=>a+b,0) / _frameTimes.length;

    // DRS adjust every ~20 frames
    if (_drsEnabled && (++_frameCounter % 20 === 0)){
        if (avg > 21 && _targetPR > _minPR){ // ~ < 48 fps
            _targetPR = Math.max(_minPR, _targetPR - 0.05);
            renderer.setPixelRatio(_targetPR);
        } else if (avg < 14 && _targetPR < _maxPR){ // ~ > 71 fps
            _targetPR = Math.min(_maxPR, _targetPR + 0.05);
            renderer.setPixelRatio(_targetPR);
        }
    }

    // Slight lake motion
    const t = now*0.0015;
    if (lakeMesh && lakeMesh.material){
        lakeMesh.material.roughness = 0.22 + Math.sin(t)*0.015;
        lakeMesh.rotation.z = Math.sin(t * 0.33) * 0.002;
    }

    if (gameRunning && !gamePaused){
        TaskManager.balance();

        // Frustum from camera
        _projScreen.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        _frustum.setFromProjectionMatrix(_projScreen);

        // Update drones
        for (const d of aiDrones) d.update();

        // Update plants only if in view or near camera
        for (const p of plants){
            const inView = _frustum.containsPoint(p.mesh.position) || p.mesh.position.distanceToSquared(camera.position) < 700*700;
            if (inView) p.update();
        }

        // Drops
        const nd = [];
        for (const drop of liveDrops){
            drop.position.add(drop.velocity);
            drop.velocity.y -= 0.3;
            drop.life--;
            if (drop.position.y <= 0 || drop.life <= 0){
                drop.visible=false; scene.remove(drop); dropPool.push(drop);
            }else{
                drop.scale.setScalar(drop.life/26);
                drop.material.opacity = (drop.life/26)*0.8;
                nd.push(drop);
            }
        }
        liveDrops = nd;

        // Particles
        const np = [];
        for (const p of liveParticles){
            p.position.add(p.velocity);
            p.velocity.y -= 0.3;
            p.life--;
            if (p.life <= 0){
                p.visible=false; scene.remove(p); particlePool.push(p);
            }else{
                if (p.material) p.material.opacity = p.life/90;
                np.push(p);
            }
        }
        liveParticles = np;
    }

    // Camera orbit
    const time = now * 0.0001;
    camera.position.x = Math.sin(time) * 300;
    camera.position.z = Math.cos(time) * 300;
    camera.position.y = 150 + Math.sin(time * 2) * 50;
    camera.lookAt(0, 50, 0);

    renderer.render(scene, camera);
}

// ----------------------------------------
// Events
// ----------------------------------------
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(_targetPR);
});

document.getElementById('droneCount').addEventListener('input', (e) => {
    document.getElementById('droneCountDisplay').textContent = e.target.value;
});

window.addEventListener('DOMContentLoaded', () => {
    init();
    animate();
});

// Buttons
window.startNewGame = startNewGame;
window.pauseGame = pauseGame;
window.toggleCamera = () => { console.log('📷 Changement de caméra'); };
window.toggleAIDebug = () => { console.log('🧠 Mode debug'); };
