import {OilRun,WORLD} from './game.js';
import {FlightSound} from './sound.js';
import {WaterRenderer} from './renderer.js';
const $=s=>document.querySelector(s),canvas=$('#flight'),ctx=canvas.getContext('2d');
const sound=new FlightSound();
const game=new OilRun(),keys=new Set(),touch=new Set();
const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
// Menu-only motion never advances the course or changes the starting conditions.
let menuTime=0;
const menuOil=[...game.liquid.drops.map(d=>({...d})),
 {x:830,y:4250,r:73,hue:.38,seed:2},
 {x:930,y:4480,r:40,hue:.68,seed:4},
 {x:300,y:4580,r:26,hue:.15,seed:1}];
let nukeRequested=false;
let lastRenderedState='ready';
let renderer,paused=false,last=performance.now(),camera={x:0,y:0,w:0,h:0,zoom:1},lastState='',frames=0;
function resize(){const ratio=Math.min(devicePixelRatio,1.5);canvas.width=Math.round(innerWidth*ratio);canvas.height=Math.round(innerHeight*ratio);}
function updateCamera(){
 const boss=game.phase==='boss';
 const zoom=boss?Math.min(1,innerWidth/950,Math.max(220,innerHeight-220)/1100):Math.min(1.15,innerWidth/650);
 camera.zoom=zoom;camera.w=innerWidth/zoom;camera.h=innerHeight/zoom;
 camera.x=Math.max(-100,Math.min(WORLD.width-camera.w+100,game.ship.x-camera.w/2));
 if(camera.w>WORLD.width+200)camera.x=(WORLD.width-camera.w)/2;
 camera.y=boss?(1100-camera.h)/2:Math.max(-80,Math.min(WORLD.height-camera.h+90,game.ship.y-camera.h*.7));
}

function line(x1,y1,x2,y2,color,width=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
function draw(){
 updateCamera();
 const menu=game.state==='ready',visualTime=menu?menuTime:game.time;
 const visibleOil=menu?menuOil.map(d=>({...d,x:d.x+Math.sin(visualTime*.22+d.seed)*32,y:d.y+(Math.cos(visualTime*.18+d.seed)-Math.cos(d.seed))*24})):game.liquid.drops;
 renderer.draw(visibleOil,camera,visualTime,reduced);
 ctx.setTransform(canvas.width/innerWidth,0,0,canvas.height/innerHeight,0,0);ctx.clearRect(0,0,innerWidth,innerHeight);ctx.scale(camera.zoom,camera.zoom);ctx.translate(-camera.x,-camera.y);
 ctx.font='11px "DM Sans",sans-serif';
 // Navigation rails and depth marks keep the flowing world legible.
 ctx.setLineDash([3,12]);line(20,0,20,WORLD.height,'#9accc22a');line(WORLD.width-20,0,WORLD.width-20,WORLD.height,'#9accc22a');ctx.setLineDash([]);
 if(game.phase==='level')for(let y=300;y<4800;y+=250){if(y<camera.y||y>camera.y+camera.h)continue;line(23,y,45,y,'#a1cec54a');line(1055,y,1077,y,'#a1cec54a');ctx.fillStyle='#92b9ad66';ctx.fillText(`${Math.max(0,Math.round((WORLD.startY-y)/10)*10)} m`,53,y+4);}
 for(const d of visibleOil){
  if(d.y+d.r+360<camera.y||d.y-d.r-360>camera.y+camera.h)continue;
  const wake=menu?{angle:-Math.PI/2+Math.sin(visualTime*.2+d.seed)*.4,next:Infinity}:game.wake(d),warning=wake.next-game.time<.8,nx=Math.cos(wake.angle),ny=Math.sin(wake.angle);
  ctx.strokeStyle=warning?'#edc48cb0':'#95d6ce48';ctx.lineWidth=1;
  for(let k=-1;k<=1;k++){
   ctx.beginPath();for(let j=0;j<=20;j++){const t=j/20,length=d.r+20+t*300,wiggle=Math.sin(t*6-visualTime*2*game.intensity+k)*(10+t*15),side=k*(d.r*.42+t*40)+wiggle;const x=d.x-nx*length-ny*side,y=d.y-ny*length+nx*side;j?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();
  }
  if(warning&&!d.boss){ctx.strokeStyle='#e8be8666';ctx.beginPath();ctx.arc(d.x,d.y,d.r*1.08,game.time*3,game.time*3+2);ctx.stroke();}
 }
 if(game.phase==='level'){
 // The striped tape marks the same opening used by the finish trigger.
 const finishY=WORLD.finishY;
 line(370,finishY-38,370,finishY+38,'#c7c8bd',4);line(730,finishY-38,730,finishY+38,'#c7c8bd',4);
 ctx.save();ctx.shadowColor='#edbf5460';ctx.shadowBlur=12;
 ctx.fillStyle='#f5d34d';ctx.fillRect(370,finishY-12,360,24);ctx.shadowBlur=0;
 ctx.beginPath();ctx.rect(370,finishY-12,360,24);ctx.clip();ctx.fillStyle='#ce343c';
 for(let x=338;x<750;x+=40){ctx.beginPath();ctx.moveTo(x,finishY+12);ctx.lineTo(x+20,finishY+12);ctx.lineTo(x+44,finishY-12);ctx.lineTo(x+24,finishY-12);ctx.closePath();ctx.fill();}
 ctx.restore();line(370,finishY-12,730,finishY-12,'#ffe998',1);line(370,finishY+12,730,finishY+12,'#a85b33',1);
 ctx.fillStyle='#f5d34d';ctx.fillRect(507,finishY-12,86,24);
 ctx.fillStyle='#342a20';ctx.textAlign='center';ctx.font='700 12px "DM Sans",sans-serif';ctx.fillText('FINISH',550,finishY+4);
 ctx.fillStyle='#f4d685';ctx.font='14px "DM Sans",sans-serif';ctx.fillText('Cross the finish line',550,finishY-52);
 }else{
  ctx.strokeStyle='#d996bd55';ctx.lineWidth=2;ctx.strokeRect(20,70,1060,970);
  const boss=game.boss;
  if(boss&&boss.hp>0){
   ctx.save();ctx.translate(boss.x,boss.y);
   const damage=1-boss.hp/boss.maxHp;
   // Match the oil silhouette so fracture lines never float outside its surface.
   ctx.beginPath();for(let i=0;i<=80;i++){const a=i/80*Math.PI*2,phase=boss.hue*Math.PI*2+game.time*.13;
    const shape=1+.16*Math.sin(2*a+phase)+.11*Math.sin(3*a-phase),r=boss.r*Math.sqrt(-Math.log(.29)/(2*shape));
    i?ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r):ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r);
   }ctx.closePath();ctx.clip();
   const cracks=Math.ceil(damage*8);
   for(let i=0;i<cracks;i++){
    const angle=i*2.399+.5,length=boss.r*(.38+damage*.55);
    ctx.save();ctx.rotate(angle);ctx.beginPath();ctx.moveTo(-boss.r*.08,0);ctx.lineTo(length*.3,9);ctx.lineTo(length*.5,-7);ctx.lineTo(length*.72,3);ctx.lineTo(length,-11);
    ctx.moveTo(length*.5,-7);ctx.lineTo(length*.48,-length*.22);ctx.lineTo(length*.67,-length*.35);
    ctx.strokeStyle='#321d38';ctx.lineWidth=4;ctx.globalAlpha=.4+damage*.4;ctx.stroke();
    ctx.strokeStyle='#ffd6c3';ctx.lineWidth=1.2;ctx.stroke();ctx.restore();
   }
   ctx.restore();
   // Three outward marks signal shedding; no surrounding shield-like ring.
   if(boss.nextPulse-game.time<1){
    const toward=Math.atan2(game.ship.y-boss.y,game.ship.x-boss.x);
    for(const offset of [-.7,0,.7]){const a=toward+offset,x=boss.x+Math.cos(a)*(boss.r+22),y=boss.y+Math.sin(a)*(boss.r+22);
     ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.strokeStyle='#f2bd82';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-5,-5);ctx.lineTo(3,0);ctx.lineTo(-5,5);ctx.stroke();ctx.restore();
    }
   }
  }
 }
 ctx.textAlign='center';
 if(game.state==='ready'){ctx.fillStyle='#92bfb3';ctx.font='10px "DM Sans",sans-serif';ctx.fillText('Your spacecraft',550,WORLD.startY+46);}
 for(const b of game.bolts){const len=Math.hypot(b.vx,b.vy);ctx.shadowColor='#9cf9dc';ctx.shadowBlur=12;line(b.x-b.vx/len*27,b.y-b.vy/len*27,b.x,b.y,'#d4ffbd',2.5);}ctx.shadowBlur=0;
 for(const p of game.sparks){ctx.globalAlpha=p.life/(p.maxLife||.4);ctx.fillStyle=p.color||'#defbd0';ctx.fillRect(p.x,p.y,3,3);}ctx.globalAlpha=1;
 ctx.font='600 18px \"DM Sans\",sans-serif';ctx.fillStyle='#e6ffd0';for(const p of game.popups){ctx.globalAlpha=Math.min(1,p.life*2);ctx.fillText(p.text||'+100',p.x,p.y);}ctx.globalAlpha=1;
 for(const b of game.powerups){
  ctx.save();ctx.translate(b.x,b.y);ctx.rotate(reduced?0:Math.sin(game.time*.9+b.phase)*.12);
  if(b.type==='life'){
   ctx.shadowColor='#ffb7bc';ctx.shadowBlur=12;ctx.fillStyle='#c74b5e';ctx.strokeStyle='#ffe3dd';ctx.lineWidth=1.5;
   ctx.fillRect(-17,-12,34,27);ctx.strokeRect(-17,-12,34,27);ctx.shadowBlur=0;
   ctx.strokeRect(-7,-18,14,6);ctx.fillStyle='#fff3dd';ctx.fillRect(-3,-6,6,15);ctx.fillRect(-8,-1,16,5);
  }else if(b.type==='wide'){
   ctx.shadowColor='#c8a5ff';ctx.shadowBlur=12;ctx.fillStyle='#28354c';ctx.strokeStyle='#cdbbff';ctx.lineWidth=1.5;
   ctx.fillRect(-14,-8,29,12);ctx.strokeRect(-14,-8,29,12);ctx.shadowBlur=0;
   ctx.fillStyle='#c7b6ed';ctx.fillRect(15,-5,13,4);ctx.fillRect(26,-7,3,8);ctx.fillRect(-25,-5,11,5);
   ctx.beginPath();ctx.moveTo(-9,4);ctx.lineTo(-1,4);ctx.lineTo(-5,15);ctx.lineTo(-12,15);ctx.closePath();ctx.fill();ctx.fillRect(6,4,7,10);
   for(let x=-8;x<11;x+=6)line(x,-5,x,-1,'#647697',2);
  }else{
  // Steel drum with amber paint, rolled rims, and a stencilled oil drop.
  ctx.shadowColor='#f1c16b';ctx.shadowBlur=10;
  const paint=ctx.createLinearGradient(-15,0,15,0);paint.addColorStop(0,'#795126');paint.addColorStop(.32,'#ecc17c');paint.addColorStop(.72,'#bb873f');paint.addColorStop(1,'#67451f');
  ctx.fillStyle=paint;ctx.strokeStyle='#f6d49c';ctx.lineWidth=1.2;
  ctx.beginPath();ctx.moveTo(-15,-17);ctx.lineTo(15,-17);ctx.lineTo(15,17);ctx.ellipse(0,17,15,5,0,0,Math.PI);ctx.closePath();ctx.fill();ctx.stroke();ctx.shadowBlur=0;
  ctx.fillStyle='#c99c59';ctx.beginPath();ctx.ellipse(0,-17,15,5,0,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.fillStyle='#4b3924';ctx.beginPath();ctx.ellipse(6,-17,3,1.6,0,0,Math.PI*2);ctx.fill();
  for(const y of [-10,11]){ctx.fillStyle='#59482e';ctx.fillRect(-15,y,30,3);line(-15,y,15,y,'#f3cf8b',1);}
  ctx.fillStyle='#263a35';ctx.beginPath();ctx.moveTo(0,-7);ctx.bezierCurveTo(-3,-2,-6,1,-6,4);ctx.bezierCurveTo(-6,11,6,11,6,4);ctx.bezierCurveTo(6,1,3,-2,0,-7);ctx.fill();
  }
  ctx.restore();ctx.fillStyle=b.type==='life'?'#ffd4d4':b.type==='wide'?'#d8c6ff':'#f3d69c';ctx.font='10px "DM Sans",sans-serif';ctx.fillText(b.type==='life'?'+1 life':b.type==='wide'?'Wide shot':'Nuke',b.x,b.y+36);
 }

 if(game.blast){const t=1-game.blast.life/.65;ctx.globalAlpha=(1-t)*.65;ctx.strokeStyle='#b9eaff';ctx.lineWidth=reduced?1:5*(1-t);ctx.beginPath();ctx.arc(game.blast.x,game.blast.y,game.blast.radius*(reduced?.7:t),0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}
 const s=game.ship;ctx.save();ctx.translate(s.x+(menu?Math.sin(visualTime*.55)*5:0),s.y+(menu?Math.sin(visualTime*.8)*7:0));ctx.rotate(s.angle+Math.PI/2+(menu?Math.sin(visualTime*.4)*.04:0));const shrink=game.state==='dying'?Math.max(.03,1-game.deathTime):1;ctx.scale(shrink,shrink);
 if(game.thrust&&game.state==='playing'){const flame=paused||reduced?22:20+Math.sin(game.time*57)*7;ctx.fillStyle='#a6f7d780';ctx.beginPath();ctx.moveTo(-6,13);ctx.lineTo(0,13+flame);ctx.lineTo(6,13);ctx.fill();ctx.fillStyle='#e3ffe4';ctx.beginPath();ctx.moveTo(-3,13);ctx.lineTo(0,27);ctx.lineTo(3,13);ctx.fill();}
 ctx.shadowColor='#bcecd2';ctx.shadowBlur=12;ctx.strokeStyle='#e2f9e7';ctx.lineWidth=1.5;ctx.fillStyle='#578e91';ctx.beginPath();ctx.moveTo(0,-20);ctx.lineTo(14,16);ctx.lineTo(0,10);ctx.lineTo(-14,16);ctx.closePath();ctx.fill();ctx.stroke();ctx.shadowBlur=0;ctx.fillStyle='#e9f8c4';ctx.beginPath();ctx.moveTo(0,-9);ctx.lineTo(4,5);ctx.lineTo(-4,5);ctx.fill();line(-11,0,-11,-8,'#d4ebcd',2);line(11,0,11,-8,'#d4ebcd',2);ctx.restore();
 if(game.state==='playing'&&game.phase==='level'&&s.y>camera.y+100){ctx.fillStyle='#bfe9ca77';ctx.font='10px "DM Sans",sans-serif';ctx.fillText(game.phase==='boss'?'Super Blob ↑':'↑ Finish',Math.max(camera.x+80,Math.min(camera.x+camera.w-80,game.boss?.x||550)),camera.y+100);}
 ctx.textAlign='left';
}
function timeText(t){return `${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}`;}
function updateUI(){
 const ready=game.state==='ready';
 if(ready&&lastRenderedState!=='ready'){
  keys.clear();touch.clear();nukeRequested=false;paused=false;document.body.classList.remove('running','paused');
  document.querySelectorAll('[data-action]').forEach(b=>b.classList.remove('active'));
  $('#brief').hidden=false;$('#pause').disabled=true;$('#pause').innerHTML='Ⅱ <span>Pause</span>';$('#pause').setAttribute('aria-label','Pause game');
  $('#last-run').hidden=!game.lastRun;
  if(game.lastRun)$('#last-run').textContent=`Out of lives · ${game.lastRun.score.toLocaleString()} points · Level ${game.lastRun.level}. Ready for another run?`;
  $('#launch').focus();
 }
 lastRenderedState=game.state;
 $('#nuke').disabled=game.nukes<1||game.state!=='playing'||paused;$('#nuke').textContent=`N · Nuke (${game.nukes}/3)`;
 $('#lives').textContent=`${game.lives}/3`;$('#attempt').textContent=String(game.level).padStart(2,'0');$('#time').textContent=timeText(game.time);$('#cuts').textContent=game.cuts;$('#score').textContent=game.score.toLocaleString();
 $('#wide-status').hidden=game.wideRemaining<=0;$('#wide-status').textContent=`Wide shot · ${Math.ceil(game.wideRemaining)}s`;
 $('#intensity').textContent=`${game.intensity.toFixed(1)}× current`;
 const boss=game.phase==='boss';$('#route-label').textContent=boss?'Boss':'Finish';$('#progress').style.height=`${(boss?1-game.boss.hp/game.boss.maxHp:game.progress)*100}%`;
 $('#distance').textContent=boss?`${game.boss.hp} HP`:`${Math.max(0,Math.round(game.ship.y-WORLD.finishY)).toLocaleString()} m`;
 $('#boss-hud').hidden=!boss||ready;$('#boss-health').value=game.boss?.hp||0;$('#boss-health').max=game.boss?.maxHp||60;
 $('#boss-feedback').textContent=game.boss?(game.boss.nextPulse-game.time<1?'Shedding oil…':`${game.boss.hp} / ${game.boss.maxHp} · Lasers damage the core`):'';
 $('#boss-health').setAttribute('aria-valuetext',`${game.boss?.hp||0} health remaining`);
 const state=paused?'paused':game.state,transition=game.transition?.kind;
 const stateKey=`${state}/${transition||''}/${game.phase}/${game.lives}`;
 if(stateKey!==lastState){lastState=stateKey;
  $('#notice').textContent=state==='dying'?(game.lives?`Caught in the oil. ${game.lives} ${game.lives===1?'life':'lives'} left…`:'Last life lost…'):state==='paused'?'Flight paused':state==='transition'?(transition==='boss'?'Super Blob\nBreak it down. Stay alive.':`Super Blob defeated
Level ${game.level+1} ahead`):'';
  $('#status').textContent=ready?'Flight systems ready':state==='dying'?'Hull captured':state==='paused'?'Holding position':state==='transition'?'Entering the next encounter':boss?'Defeat Super Blob':'Find your way to clear water';
 }
}

function start(){nukeRequested=false;sound.setPaused(false);sound.unlock().then(ready=>{if(ready)sound.play('launch');});game.start();paused=false;document.body.classList.remove('paused');keys.clear();touch.clear();$('#brief').hidden=true;$('#last-run').hidden=true;$('#result').hidden=true;document.body.classList.add('running');$('#pause').disabled=false;$('#pause').innerHTML='Ⅱ <span>Pause</span>';$('#pause').setAttribute('aria-label','Pause game');canvas.focus();updateUI();}
function pause(){if(!['playing','dying','transition'].includes(game.state))return;paused=!paused;sound.setPaused(paused);if(!paused)sound.unlock();keys.clear();touch.clear();document.body.classList.toggle('paused',paused);$('#pause').innerHTML=paused?'▷ <span>Resume</span>':'Ⅱ <span>Pause</span>';$('#pause').setAttribute('aria-label',paused?'Resume game':'Pause game');updateUI();}
$('#launch').onclick=start;$('#again').onclick=start;$('#restart').onclick=start;$('#pause').onclick=()=>{pause();canvas.focus();};
function updateSoundButton(){const b=$('#sound');b.textContent=sound.muted?'Sound off':'Sound on';b.setAttribute('aria-pressed',String(!sound.muted));b.setAttribute('aria-label',sound.muted?'Enable sound':'Mute sound');}
$('#sound').onclick=()=>{sound.setMuted(!sound.muted);if(!sound.muted)sound.unlock();updateSoundButton();canvas.focus();};updateSoundButton();
$('#nuke').onclick=()=>{if(!paused&&game.state==='playing')nukeRequested=true;canvas.focus();};
const controlled=['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyW','KeyA','KeyS','KeyD','KeyN'];
addEventListener('keydown',e=>{if(e.target.closest('button,a'))return;if(controlled.includes(e.code))e.preventDefault();keys.add(e.code);if(e.repeat)return;if(e.code==='KeyP'||e.code==='Escape')pause();if(e.code==='KeyR')start();if(e.code==='KeyN'&&!paused&&game.state==='playing')nukeRequested=true;if(e.code==='Enter'&&(game.state==='ready'||game.state==='won'))start();});
addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>{keys.clear();touch.clear();if(!paused&&['playing','dying','transition'].includes(game.state))pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&!paused&&['playing','dying','transition'].includes(game.state))pause();last=performance.now();});
for(const button of document.querySelectorAll('[data-action]')){button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);touch.add(button.dataset.action);button.classList.add('active');});const release=()=>{touch.delete(button.dataset.action);button.classList.remove('active');};button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);}
function input(){return {nuke:nukeRequested,view:{...camera},thrust:keys.has('KeyW')||keys.has('ArrowUp')||touch.has('thrust'),left:keys.has('KeyA')||keys.has('ArrowLeft')||touch.has('left'),right:keys.has('KeyD')||keys.has('ArrowRight')||touch.has('right'),brake:keys.has('KeyS')||keys.has('ArrowDown')||touch.has('brake'),fire:keys.has('Space')||touch.has('fire')};}
function frame(now){const dt=Math.min(.035,(now-last)/1000);last=now;if(game.state==='ready'&&!reduced&&!document.hidden)menuTime+=dt;if(!paused)game.update(dt,input());nukeRequested=false;sound.update(game,paused);draw();if(frames++%5===0)updateUI();requestAnimationFrame(frame);}
addEventListener('resize',resize);resize();try{renderer=new WaterRenderer($('#water'));requestAnimationFrame(frame);}catch(error){console.error(error);$('#fallback').hidden=false;$('#launch').disabled=true;}
