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
let renderer,paused=false,last=performance.now(),camera={x:0,y:0,w:0,h:0,zoom:1},lastState='',frames=0;
function resize(){const ratio=Math.min(devicePixelRatio,1.5);canvas.width=Math.round(innerWidth*ratio);canvas.height=Math.round(innerHeight*ratio);}
function updateCamera(){const zoom=Math.min(1.15,innerWidth/650);camera.zoom=zoom;camera.w=innerWidth/zoom;camera.h=innerHeight/zoom;camera.x=Math.max(-100,Math.min(WORLD.width-camera.w+100,game.ship.x-camera.w/2));if(camera.w>WORLD.width+200)camera.x=(WORLD.width-camera.w)/2;camera.y=Math.max(-80,Math.min(WORLD.height-camera.h+90,game.ship.y-camera.h*.7));}
function line(x1,y1,x2,y2,color,width=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
function draw(){
 updateCamera();
 const menu=game.state==='ready',visualTime=menu?menuTime:game.time;
 const visibleOil=menu?menuOil.map(d=>({...d,x:d.x+Math.sin(visualTime*.22+d.seed)*32,y:d.y+(Math.cos(visualTime*.18+d.seed)-Math.cos(d.seed))*24})):game.liquid.drops;
 renderer.draw(visibleOil,camera,visualTime);
 ctx.setTransform(canvas.width/innerWidth,0,0,canvas.height/innerHeight,0,0);ctx.clearRect(0,0,innerWidth,innerHeight);ctx.scale(camera.zoom,camera.zoom);ctx.translate(-camera.x,-camera.y);
 ctx.font='11px "DM Sans",sans-serif';
 // Navigation rails and depth marks keep the flowing world legible.
 ctx.setLineDash([3,12]);line(20,0,20,WORLD.height,'#9accc22a');line(WORLD.width-20,0,WORLD.width-20,WORLD.height,'#9accc22a');ctx.setLineDash([]);
 for(let y=300;y<4800;y+=250){if(y<camera.y||y>camera.y+camera.h)continue;line(23,y,45,y,'#a1cec54a');line(1055,y,1077,y,'#a1cec54a');ctx.fillStyle='#92b9ad66';ctx.fillText(`${Math.max(0,Math.round((WORLD.startY-y)/10)*10)} m`,53,y+4);}
 for(const d of visibleOil){
  if(d.y+d.r+360<camera.y||d.y-d.r-360>camera.y+camera.h)continue;
  const wake=menu?{angle:-Math.PI/2+Math.sin(visualTime*.2+d.seed)*.4,next:Infinity}:game.wake(d),warning=wake.next-game.time<.8,nx=Math.cos(wake.angle),ny=Math.sin(wake.angle);
  ctx.strokeStyle=warning?'#edc48cb0':'#95d6ce48';ctx.lineWidth=1;
  for(let k=-1;k<=1;k++){
   ctx.beginPath();for(let j=0;j<=20;j++){const t=j/20,length=d.r+20+t*300,wiggle=Math.sin(t*6-visualTime*2*game.intensity+k)*(10+t*15),side=k*(d.r*.42+t*40)+wiggle;const x=d.x-nx*length-ny*side,y=d.y-ny*length+nx*side;j?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();
  }
  if(warning){ctx.strokeStyle='#e8be8666';ctx.beginPath();ctx.arc(d.x,d.y,d.r*1.08,game.time*3,game.time*3+2);ctx.stroke();}
 }
 // Exit gate spans a deliberate opening, not the whole course.
 ctx.shadowColor='#b8f1c5';ctx.shadowBlur=18;line(370,WORLD.finishY,730,WORLD.finishY,'#c9ffd6',4);line(370,WORLD.finishY-40,370,WORLD.finishY+40,'#c9ffd6',5);line(730,WORLD.finishY-40,730,WORLD.finishY+40,'#c9ffd6',5);ctx.shadowBlur=0;
 ctx.fillStyle='#c5eed0';ctx.textAlign='center';ctx.font='14px "DM Sans",sans-serif';ctx.fillText('Clear water / Exit',550,WORLD.finishY-50);
 if(game.state==='ready'){ctx.fillStyle='#92bfb3';ctx.font='10px "DM Sans",sans-serif';ctx.fillText('Your spacecraft',550,WORLD.startY+46);}
 for(const b of game.bolts){const len=Math.hypot(b.vx,b.vy);ctx.shadowColor='#9cf9dc';ctx.shadowBlur=12;line(b.x-b.vx/len*27,b.y-b.vy/len*27,b.x,b.y,'#d4ffbd',2.5);}ctx.shadowBlur=0;
 for(const p of game.sparks){ctx.globalAlpha=p.life/(p.maxLife||.4);ctx.fillStyle='#defbd0';ctx.fillRect(p.x,p.y,3,3);}ctx.globalAlpha=1;
 ctx.font='600 18px \"DM Sans\",sans-serif';ctx.fillStyle='#e6ffd0';for(const p of game.popups){ctx.globalAlpha=Math.min(1,p.life*2);ctx.fillText('+100',p.x,p.y);}ctx.globalAlpha=1;
 for(const b of game.powerups){
  ctx.save();ctx.translate(b.x,b.y);ctx.rotate(reduced?0:Math.sin(game.time*.9+b.phase)*.12);
  // Steel drum with amber paint, rolled rims, and a stencilled oil drop.
  ctx.shadowColor='#f1c16b';ctx.shadowBlur=10;
  const paint=ctx.createLinearGradient(-15,0,15,0);paint.addColorStop(0,'#795126');paint.addColorStop(.32,'#ecc17c');paint.addColorStop(.72,'#bb873f');paint.addColorStop(1,'#67451f');
  ctx.fillStyle=paint;ctx.strokeStyle='#f6d49c';ctx.lineWidth=1.2;
  ctx.beginPath();ctx.moveTo(-15,-17);ctx.lineTo(15,-17);ctx.lineTo(15,17);ctx.ellipse(0,17,15,5,0,0,Math.PI);ctx.closePath();ctx.fill();ctx.stroke();ctx.shadowBlur=0;
  ctx.fillStyle='#c99c59';ctx.beginPath();ctx.ellipse(0,-17,15,5,0,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.fillStyle='#4b3924';ctx.beginPath();ctx.ellipse(6,-17,3,1.6,0,0,Math.PI*2);ctx.fill();
  for(const y of [-10,11]){ctx.fillStyle='#59482e';ctx.fillRect(-15,y,30,3);line(-15,y,15,y,'#f3cf8b',1);}
  ctx.fillStyle='#263a35';ctx.beginPath();ctx.moveTo(0,-7);ctx.bezierCurveTo(-3,-2,-6,1,-6,4);ctx.bezierCurveTo(-6,11,6,11,6,4);ctx.bezierCurveTo(6,1,3,-2,0,-7);ctx.fill();
  ctx.restore();ctx.fillStyle='#f3d69c';ctx.font='10px "DM Sans",sans-serif';ctx.fillText('Nuke',b.x,b.y+36);
 }

 if(game.blast){const t=1-game.blast.life/.65;ctx.globalAlpha=(1-t)*.65;ctx.strokeStyle='#b9eaff';ctx.lineWidth=reduced?1:5*(1-t);ctx.beginPath();ctx.arc(game.blast.x,game.blast.y,game.blast.radius*(reduced?.7:t),0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}
 const s=game.ship;ctx.save();ctx.translate(s.x+(menu?Math.sin(visualTime*.55)*5:0),s.y+(menu?Math.sin(visualTime*.8)*7:0));ctx.rotate(s.angle+Math.PI/2+(menu?Math.sin(visualTime*.4)*.04:0));const shrink=game.state==='dying'?Math.max(.03,1-game.deathTime):1;ctx.scale(shrink,shrink);
 if(game.thrust&&game.state==='playing'){const flame=paused||reduced?22:20+Math.sin(game.time*57)*7;ctx.fillStyle='#a6f7d780';ctx.beginPath();ctx.moveTo(-6,13);ctx.lineTo(0,13+flame);ctx.lineTo(6,13);ctx.fill();ctx.fillStyle='#e3ffe4';ctx.beginPath();ctx.moveTo(-3,13);ctx.lineTo(0,27);ctx.lineTo(3,13);ctx.fill();}
 ctx.shadowColor='#bcecd2';ctx.shadowBlur=12;ctx.strokeStyle='#e2f9e7';ctx.lineWidth=1.5;ctx.fillStyle='#578e91';ctx.beginPath();ctx.moveTo(0,-20);ctx.lineTo(14,16);ctx.lineTo(0,10);ctx.lineTo(-14,16);ctx.closePath();ctx.fill();ctx.stroke();ctx.shadowBlur=0;ctx.fillStyle='#e9f8c4';ctx.beginPath();ctx.moveTo(0,-9);ctx.lineTo(4,5);ctx.lineTo(-4,5);ctx.fill();line(-11,0,-11,-8,'#d4ebcd',2);line(11,0,11,-8,'#d4ebcd',2);ctx.restore();
 if(game.state==='playing'&&s.y>camera.y+100){ctx.fillStyle='#bfe9ca77';ctx.font='10px "DM Sans",sans-serif';ctx.fillText('↑ Exit',Math.max(camera.x+80,Math.min(camera.x+camera.w-80,550)),camera.y+100);}
 ctx.textAlign='left';
}
function timeText(t){return `${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}`;}
function updateUI(){
 $('#nuke').disabled=game.nukes<1||game.state!=='playing'||paused;$('#nuke').textContent=`N · Nuke (${game.nukes}/3)`;
 $('#attempt').textContent=String(game.attempt).padStart(2,'0');$('#time').textContent=timeText(game.time);$('#cuts').textContent=game.cuts;$('#score').textContent=game.score.toLocaleString();$('#intensity').textContent=`${game.intensity.toFixed(1)}× current`;$('#progress').style.height=`${game.progress*100}%`;$('#distance').textContent=`${Math.max(0,Math.round(WORLD.startY-WORLD.finishY-(WORLD.startY-game.ship.y))).toLocaleString()} m`;
 const state=paused?'paused':game.state;if(state!==lastState){lastState=state;$('#notice').textContent=state==='dying'?'Caught in the oil. Trying again…':state==='paused'?'Flight paused':'';$('#status').textContent=state==='ready'?'Flight systems ready':state==='won'?'Exit reached':state==='dying'?'Hull captured':state==='paused'?'Holding position':'Find your way to clear water';}
 if(game.state==='won'){$('#result').hidden=false;document.body.classList.remove('running');$('#result-text').textContent=`${game.score.toLocaleString()} points. ${timeText(game.time)} in the current. ${game.cuts} oil splits. Run ${game.attempt}.`;$('#pause').disabled=true;}
}
function start(){nukeRequested=false;sound.setPaused(false);sound.unlock().then(ready=>{if(ready)sound.play('launch');});game.start();paused=false;document.body.classList.remove('paused');keys.clear();touch.clear();$('#brief').hidden=true;$('#result').hidden=true;document.body.classList.add('running');$('#pause').disabled=false;$('#pause').innerHTML='Ⅱ <span>Pause</span>';$('#pause').setAttribute('aria-label','Pause game');canvas.focus();updateUI();}
function pause(){if(!['playing','dying'].includes(game.state))return;paused=!paused;sound.setPaused(paused);if(!paused)sound.unlock();keys.clear();touch.clear();document.body.classList.toggle('paused',paused);$('#pause').innerHTML=paused?'▷ <span>Resume</span>':'Ⅱ <span>Pause</span>';$('#pause').setAttribute('aria-label',paused?'Resume game':'Pause game');updateUI();}
$('#launch').onclick=start;$('#again').onclick=start;$('#restart').onclick=start;$('#pause').onclick=()=>{pause();canvas.focus();};
function updateSoundButton(){const b=$('#sound');b.textContent=sound.muted?'Sound off':'Sound on';b.setAttribute('aria-pressed',String(!sound.muted));b.setAttribute('aria-label',sound.muted?'Enable sound':'Mute sound');}
$('#sound').onclick=()=>{sound.setMuted(!sound.muted);if(!sound.muted)sound.unlock();updateSoundButton();canvas.focus();};updateSoundButton();
$('#nuke').onclick=()=>{if(!paused&&game.state==='playing')nukeRequested=true;canvas.focus();};
const controlled=['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyW','KeyA','KeyS','KeyD','KeyN'];
addEventListener('keydown',e=>{if(e.target.closest('button,a'))return;if(controlled.includes(e.code))e.preventDefault();keys.add(e.code);if(e.repeat)return;if(e.code==='KeyP'||e.code==='Escape')pause();if(e.code==='KeyR')start();if(e.code==='KeyN'&&!paused&&game.state==='playing')nukeRequested=true;if(e.code==='Enter'&&(game.state==='ready'||game.state==='won'))start();});
addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>{keys.clear();touch.clear();if(!paused&&['playing','dying'].includes(game.state))pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&!paused&&['playing','dying'].includes(game.state))pause();last=performance.now();});
for(const button of document.querySelectorAll('[data-action]')){button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);touch.add(button.dataset.action);button.classList.add('active');});const release=()=>{touch.delete(button.dataset.action);button.classList.remove('active');};button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);}
function input(){return {nuke:nukeRequested,view:{...camera},thrust:keys.has('KeyW')||keys.has('ArrowUp')||touch.has('thrust'),left:keys.has('KeyA')||keys.has('ArrowLeft')||touch.has('left'),right:keys.has('KeyD')||keys.has('ArrowRight')||touch.has('right'),brake:keys.has('KeyS')||keys.has('ArrowDown')||touch.has('brake'),fire:keys.has('Space')||touch.has('fire')};}
function frame(now){const dt=Math.min(.035,(now-last)/1000);last=now;if(game.state==='ready'&&!reduced&&!document.hidden)menuTime+=dt;if(!paused)game.update(dt,input());nukeRequested=false;sound.update(game,paused);draw();if(frames++%5===0)updateUI();requestAnimationFrame(frame);}
addEventListener('resize',resize);resize();try{renderer=new WaterRenderer($('#water'));requestAnimationFrame(frame);}catch(error){console.error(error);$('#fallback').hidden=false;$('#launch').disabled=true;}
