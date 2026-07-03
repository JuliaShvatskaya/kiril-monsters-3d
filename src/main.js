import * as THREE from 'https://unpkg.com/three@0.165.0/build/three.module.js';

const ARENA = 42;
const MAX_LEVEL = 150;
const clock = new THREE.Clock();
const canvas = document.querySelector('#gameCanvas');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9edcff);
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 500);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;

const ui = {
  level: document.querySelector('#levelText'), hp: document.querySelector('#hpText'), dna: document.querySelector('#dnaText'),
  weapon: document.querySelector('#weaponText'), shop: document.querySelector('#shopItems'), board: document.querySelector('#leaderboardList'),
  msg: document.querySelector('#message'), overlay: document.querySelector('#overlay'), overlayTitle: document.querySelector('#overlayTitle'),
  overlayText: document.querySelector('#overlayText'), restart: document.querySelector('#restartButton'), super: document.querySelector('#superButton'), superHint: document.querySelector('#superHint')
};

const weapons = {
  axe: { name: 'Axe', cost: 0, damage: 25, desc: 'Melee cone. Super: 80% shield for 5s.' },
  guitar: { name: 'Guitar', cost: 100, damage: 125, desc: 'Ranged music shot. Super: heal 5 HP.' },
  staff: { name: 'Staff', cost: 1000, damage: 50, desc: 'Poison magic. Super: freeze all enemies 3s.' }
};

const state = {
  running: true, keys: {}, enemies: [], projectiles: [], fireballs: [], pickups: [],
  player: { maxHp: 500, hp: 500, dna: 0, level: 1, weapon: 'axe', unlocked: new Set(['axe']), attackCd: 0, superCd: 0, shield: 0, target: null, dir: new THREE.Vector3(0,0,-1) }
};

function makeMat(color, emissive = 0x000000) { return new THREE.MeshStandardMaterial({ color, emissive, roughness: .75 }); }
function clamp(v) { v.x = Math.max(-ARENA/2+1, Math.min(ARENA/2-1, v.x)); v.z = Math.max(-ARENA/2+1, Math.min(ARENA/2-1, v.z)); return v; }
function diff() { return Math.pow(2, Math.floor((state.player.level - 1) / 50)); }

scene.add(new THREE.HemisphereLight(0xffffff, 0x4f6a76, 2.1));
const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(12, 26, 9); sun.castShadow = true; scene.add(sun);
const ground = new THREE.Mesh(new THREE.BoxGeometry(ARENA, .35, ARENA), makeMat(0x75d36c)); ground.receiveShadow = true; scene.add(ground);
const wallMat = makeMat(0xffc857);
[[0,ARENA/2],[0,-ARENA/2],[ARENA/2,0],[-ARENA/2,0]].forEach(([x,z],i)=>{ const w = new THREE.Mesh(new THREE.BoxGeometry(i<2?ARENA+1:.8,2.2,i<2?.8:ARENA+1), wallMat); w.position.set(x,1,z); w.castShadow=true; scene.add(w); });

function makePlayer() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.65,1.4,6,12), makeMat(0x2577ff)); body.position.y = 1.25; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.48,16,12), makeMat(0xffd6a5)); head.position.y = 2.35; head.castShadow = true; g.add(head);
  const hand = new THREE.Group(); hand.name = 'weaponVisual'; hand.position.set(.75,1.45,-.15); g.add(hand); scene.add(g); return g;
}
state.player.mesh = makePlayer();
const shieldMesh = new THREE.Mesh(new THREE.SphereGeometry(1.55,24,16), new THREE.MeshBasicMaterial({ color:0x56d9ff, transparent:true, opacity:.24 })); shieldMesh.visible=false; state.player.mesh.add(shieldMesh); shieldMesh.position.y=1.25;

function setWeaponVisual() {
  const hand = state.player.mesh.getObjectByName('weaponVisual'); hand.clear();
  if (state.player.weapon === 'axe') { hand.add(new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,1.2), makeMat(0x8b5a2b))); const b=new THREE.Mesh(new THREE.BoxGeometry(.55,.35,.08), makeMat(0xbfc6cf)); b.position.y=.52; hand.add(b); }
  if (state.player.weapon === 'guitar') { hand.add(new THREE.Mesh(new THREE.BoxGeometry(.35,.55,.16), makeMat(0xd946ef))); const n=new THREE.Mesh(new THREE.BoxGeometry(.12,.9,.1), makeMat(0x8b5a2b)); n.position.y=.6; hand.add(n); }
  if (state.player.weapon === 'staff') { hand.add(new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,1.65), makeMat(0x7b4a23))); const o=new THREE.Mesh(new THREE.SphereGeometry(.22,16,12), makeMat(0x39ff76,0x18ff54)); o.position.y=.95; hand.add(o); }
}
setWeaponVisual();

function makeLizard(hp) { const g=new THREE.Group(); g.userData={type:'lizard', hp, maxHp:hp, damage:12*diff(), speed:2.1*diff(), cd:0, dna:1, poison:0, frozen:0}; const b=new THREE.Mesh(new THREE.CapsuleGeometry(.42,.75,4,8), makeMat(0x28a745)); b.rotation.z=Math.PI/2; b.position.y=.55; b.castShadow=true; g.add(b); const h=new THREE.Mesh(new THREE.SphereGeometry(.33,10,8), makeMat(0x63d471)); h.position.set(.55,.62,0); g.add(h); return spawnAtEdge(g); }
function makeDragon(hp) { const g=new THREE.Group(); g.userData={type:'dragon', hp, maxHp:hp, damage:100*diff(), speed:1.0*diff(), cd:0, shoot:1.5, dna:10, poison:0, frozen:0}; const b=new THREE.Mesh(new THREE.SphereGeometry(1.55,16,12), makeMat(0xc72525)); b.scale.set(1.5,1,1); b.position.y=1.45; b.castShadow=true; g.add(b); const head=new THREE.Mesh(new THREE.SphereGeometry(.8,16,12), makeMat(0xff4d2d)); head.position.set(1.8,1.75,0); g.add(head); [-1,1].forEach(s=>{ const wing=new THREE.Mesh(new THREE.ConeGeometry(1.15,2.3,3), makeMat(0x8b1111)); wing.position.set(-.3,1.8,s*1.4); wing.rotation.x=s*Math.PI/2; g.add(wing); }); return spawnAtEdge(g); }
function spawnAtEdge(g){ const a=Math.random()*Math.PI*2; g.position.set(Math.cos(a)*17,.05,Math.sin(a)*17); scene.add(g); state.enemies.push(g); return g; }
function startLevel(){ state.enemies.forEach(e=>scene.remove(e)); state.enemies=[]; state.projectiles=[]; state.fireballs=[]; const m=diff(); if(state.player.level%10===0) makeDragon(300*m); else for(let i=0;i<Math.min(4+Math.floor(state.player.level/3),16);i++) makeLizard(50*m); message(state.player.level%10===0?'Boss level: Dragon!':'Level '+state.player.level+' started'); updateUI(); }

function attack(){ if(state.player.attackCd>0||!state.running) return; const p=state.player, w=weapons[p.weapon]; p.attackCd=p.weapon==='axe'?.45:.35; if(p.weapon==='axe'){ state.enemies.forEach(e=>{ const d=e.position.clone().sub(p.mesh.position); if(d.length()<3.1 && d.normalize().dot(p.dir)>.25) hurt(e,w.damage*diff()); }); } else shoot(p.weapon==='guitar'?0xff4dff:0x35ff70, w.damage*diff(), p.weapon==='staff'); }
function shoot(color, damage, poison){ const m=new THREE.Mesh(new THREE.SphereGeometry(.22,12,8), makeMat(color,color)); m.position.copy(state.player.mesh.position).add(new THREE.Vector3(0,1.2,0)); m.userData={vel:state.player.dir.clone().multiplyScalar(13), damage, poison, life:2.2}; scene.add(m); state.projectiles.push(m); }
function superAbility(){ const p=state.player; if(p.superCd>0||!state.running) return; p.superCd=8; if(p.weapon==='axe'){p.shield=5; message('Axe shield active!');} if(p.weapon==='guitar'){p.hp=Math.min(p.maxHp,p.hp+5); message('Guitar healed 5 HP!');} if(p.weapon==='staff'){state.enemies.forEach(e=>e.userData.frozen=3); message('Staff froze all enemies!');} updateUI(); }
function hurt(e,dmg){ e.userData.hp-=dmg; if(state.player.weapon==='staff') e.userData.poison=4; if(e.userData.hp<=0){ state.player.dna+=e.userData.dna; scene.remove(e); state.enemies=state.enemies.filter(x=>x!==e); if(!state.enemies.length) nextLevel(); } }
function damagePlayer(d){ if(state.player.shield>0) d*=.2; state.player.hp=Math.max(0,state.player.hp-d); if(state.player.hp<=0) end(false); updateUI(); }
function nextLevel(){ if(state.player.level>=MAX_LEVEL) return end(true); state.player.level++; message('Level up! Entering level '+state.player.level); setTimeout(()=>state.running&&startLevel(),900); updateUI(); }

function update(dt){ const p=state.player; p.attackCd-=dt; p.superCd-=dt; p.shield-=dt; shieldMesh.visible=p.shield>0; const move=new THREE.Vector3((state.keys.KeyD?1:0)-(state.keys.KeyA?1:0),0,(state.keys.KeyS?1:0)-(state.keys.KeyW?1:0)); if(move.length()){p.target=null; move.normalize(); p.mesh.position.add(move.multiplyScalar(7*dt)); p.dir.copy(move);} else if(p.target){ const to=p.target.clone().sub(p.mesh.position); to.y=0; if(to.length()>.25){ to.normalize(); p.mesh.position.add(to.clone().multiplyScalar(6*dt)); p.dir.copy(to);} else p.target=null; } clamp(p.mesh.position); p.mesh.lookAt(p.mesh.position.clone().add(p.dir));
  state.enemies.forEach(e=>{ const u=e.userData; if(u.poison>0){u.poison-=dt; u.hp-=8*dt; if(u.hp<=0) hurt(e,99999);} if(u.frozen>0){u.frozen-=dt; return;} const to=p.mesh.position.clone().sub(e.position); const dist=to.length(); to.normalize(); e.position.add(to.multiplyScalar(u.speed*dt)); clamp(e.position); e.lookAt(p.mesh.position); u.cd-=dt; u.shoot-=dt; if(dist<1.5&&u.cd<=0){damagePlayer(u.damage); u.cd=1;} if(u.type==='dragon'&&u.shoot<=0){dragonFire(e); u.shoot=1.7;} });
  stepProjectiles(state.projectiles, dt, false); stepProjectiles(state.fireballs, dt, true); camera.position.lerp(p.mesh.position.clone().add(new THREE.Vector3(0,21,19)), .08); camera.lookAt(p.mesh.position); updateUI(); }
function dragonFire(e){ const m=new THREE.Mesh(new THREE.SphereGeometry(.34,16,10), makeMat(0xff6500,0xff3200)); m.position.copy(e.position).add(new THREE.Vector3(0,1.5,0)); m.userData={vel:state.player.mesh.position.clone().sub(e.position).normalize().multiplyScalar(8), damage:e.userData.damage, life:4}; scene.add(m); state.fireballs.push(m); }
function stepProjectiles(list,dt,fire){ for(let i=list.length-1;i>=0;i--){ const m=list[i]; m.position.add(m.userData.vel.clone().multiplyScalar(dt)); m.userData.life-=dt; let hit=false; if(fire){ if(m.position.distanceTo(state.player.mesh.position)<1.1){damagePlayer(m.userData.damage); hit=true;} } else state.enemies.forEach(e=>{ if(!hit&&m.position.distanceTo(e.position)<1.1){hurt(e,m.userData.damage); hit=true;} }); if(hit||m.userData.life<=0||Math.abs(m.position.x)>ARENA/2||Math.abs(m.position.z)>ARENA/2){scene.remove(m); list.splice(i,1);} } }

function updateUI(){ const p=state.player; ui.level.textContent=p.level; ui.hp.textContent=`${Math.ceil(p.hp)} / ${p.maxHp}`; ui.dna.textContent=p.dna; ui.weapon.textContent=weapons[p.weapon].name; ui.super.disabled=p.superCd>0; ui.superHint.textContent=p.superCd>0?Math.ceil(p.superCd)+'s':'Q'; renderShop(); }
function renderShop(){ ui.shop.innerHTML=''; Object.entries(weapons).forEach(([id,w])=>{ const owned=state.player.unlocked.has(id), cur=state.player.weapon===id; const row=document.createElement('div'); row.className='shop-item '+(cur?'current':''); row.innerHTML=`<strong>${w.name}</strong><button ${(!owned&&state.player.dna<w.cost)?'disabled':''}>${owned?(cur?'Equipped':'Equip'):'Buy '+w.cost}</button><div class="desc">${w.desc}</div>`; row.querySelector('button').onclick=()=>{ if(!owned){ if(state.player.dna<w.cost)return; state.player.dna-=w.cost; state.player.unlocked.add(id); } state.player.weapon=id; setWeaponVisual(); updateUI(); }; ui.shop.appendChild(row); }); }
function scores(){ return JSON.parse(localStorage.getItem('dna-monster-scores')||'[]'); }
function saveScore(){ const name=prompt('Leaderboard name?', 'Player')||'Player'; const s=[...scores(),{name,level:state.player.level,dna:state.player.dna}].sort((a,b)=>b.level-a.level||b.dna-a.dna).slice(0,5); localStorage.setItem('dna-monster-scores',JSON.stringify(s)); renderBoard(); }
function renderBoard(){ const s=scores(); ui.board.innerHTML=s.length?s.map(x=>`<li>${x.name}: Level ${x.level} — DNA ${x.dna}</li>`).join(''):'<li>No runs yet</li>'; }
function message(t){ ui.msg.textContent=t; }
function end(victory){ state.running=false; saveScore(); ui.overlayTitle.textContent=victory?'Victory':'Game Over'; ui.overlayText.textContent=victory?`You completed all 150 levels! DNA collected: ${state.player.dna}`:`Level reached: ${state.player.level}. DNA collected: ${state.player.dna}`; ui.overlay.classList.remove('hidden'); }
function restart(){ location.reload(); }

addEventListener('keydown',e=>{ state.keys[e.code]=true; if(e.code==='Space'){e.preventDefault(); attack();} if(e.code==='KeyQ') superAbility(); });
addEventListener('keyup',e=>state.keys[e.code]=false);
addEventListener('resize',()=>{ camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight); });
ui.super.onclick=superAbility; ui.restart.onclick=restart;
const raycaster=new THREE.Raycaster(), mouse=new THREE.Vector2();
canvas.addEventListener('pointerdown',e=>{ if(e.button!==0) return; mouse.set(e.clientX/innerWidth*2-1, -(e.clientY/innerHeight)*2+1); raycaster.setFromCamera(mouse,camera); const hit=raycaster.intersectObject(ground)[0]; if(hit) state.player.target=clamp(hit.point.clone()); });

function loop(){ requestAnimationFrame(loop); const dt=Math.min(clock.getDelta(), .04); if(state.running) update(dt); renderer.render(scene,camera); }
renderBoard(); startLevel(); loop();
