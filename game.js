import {Liquid,MAX_DROPS} from './physics.js';
export const POWERUP_DROP_RATE=.05;
export const POWERUP_TYPES=['nuke','life','wide'];
export const WORLD={width:1100,height:4800,startY:4470,finishY:220};
export function oilField(drops,x,y,time){
 let field=0;
 for(const d of drops){const vx=(x-d.x)/d.r,vy=(y-d.y)/d.r;if(vx*vx+vy*vy>9)continue;const angle=Math.atan2(vy,vx),phase=d.hue*Math.PI*2+time*.13;field+=Math.exp(-2*(vx*vx+vy*vy)*(1+.16*Math.sin(2*angle+phase)+.11*Math.sin(3*angle-phase)));}
 return field;
}
export function segmentHit(x1,y1,x2,y2,d){const dx=x2-x1,dy=y2-y1,t=Math.max(0,Math.min(1,((d.x-x1)*dx+(d.y-y1)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x1+dx*t-d.x,y1+dy*t-d.y)<d.r*.85+3;}
export class OilRun {
 constructor(random=Math.random){this.random=random;this.attempt=1;this.state='ready';this.reset();this.state='ready';}
 reset(){
  this.lives=3;this.level=1;this.phase='level';this.boss=null;this.transition=null;this.wideRemaining=0;this.lastRun=null;
  this.liquid=new Liquid(WORLD.width,WORLD.height,this.random);this.liquid.drops=[];
  const rows=[[3980,260,80],[3930,650,105],[3690,880,80],[3500,450,105],[3260,170,70],[3210,745,112],[2900,540,95],[2750,900,82],[2630,230,85],[2390,690,100],[2180,385,115],[2070,920,65],[1880,130,70],[1790,750,105],[1520,480,110],[1370,920,75],[1230,200,80],[1020,680,110],[830,390,80],[650,850,76],[565,150,66],[3990,1000,33],[3030,70,32],[1630,1010,30]];
  for(const [y,x,r] of rows)this.liquid.drops.push({x,y,r,homeX:x,homeY:y,vx:(x<WORLD.width/2?1:-1)*(12+this.random()*8),vy:(this.random()-.5)*10,hue:this.random(),seed:this.random()*6.28,cool:0});
  this.ship={x:550,y:WORLD.startY,vx:0,vy:0,angle:-Math.PI/2};this.events=[];this.powerups=[];this.nukes=0;this.nukeHeld=false;this.blast=null;this.bolts=[];this.enemyBolts=[];this.shot=false;this.volleyGap=0;this.health=100;this.hullHitAt=-10;this.sparks=[];this.popups=[];this.score=0;this.intensity=1;this.wakes=new WeakMap();this.time=0;this.fireCooldown=0;this.deathTime=0;this.cuts=0;this.state='playing';this.thrust=0;this.current={x:0,y:0};
 }
 start(){this.attempt=1;this.reset();}
 dropPowerup(d){
  if(this.random()>=POWERUP_DROP_RATE)return;
  const type=POWERUP_TYPES[Math.min(2,Math.floor(this.random()*3))];
  this.powerups.push({x:d.x,y:d.y,type,phase:this.random()*Math.PI*2});
 }
 restartEncounter(keepGear=false){
  const saved={lives:this.lives,level:this.level,score:this.score,cuts:this.cuts,time:this.time,attempt:this.attempt,phase:this.phase};
  const gear={nukes:this.nukes,wideRemaining:this.wideRemaining};
  this.reset();Object.assign(this,saved);if(keepGear)Object.assign(this,gear);
  if(this.phase==='boss')this.beginBoss();
 }
 beginBoss(){
  this.phase='boss';this.state='playing';this.transition=null;this.health=100;
  this.ship={x:550,y:850,vx:0,vy:0,angle:-Math.PI/2};
  this.bolts=[];this.enemyBolts=[];this.powerups=[];this.sparks=[];this.popups=[];this.blast=null;this.fireCooldown=0;
  this.liquid=new Liquid(WORLD.width,1100,this.random);this.wakes=new WeakMap();
  this.boss={x:550,y:300,r:155,vx:0,vy:0,hue:.88,seed:1,cool:0,boss:true,hitAt:-10,hp:60,maxHp:60,shed:0,weave:this.random()*6.28,nextAttack:this.time+3.5,attack:null,attacks:0,dodge:null,dodgeReady:0};
  this.liquid.drops=[this.boss];this.events.push('boss');
 }
 damageBoss(amount,impact){
  if(!this.boss||this.boss.hp<=0)return;
  const b=this.boss,damage=Math.min(amount,b.hp);
  b.hitAt=this.time;
  b.hp=Math.max(0,b.hp-damage);
  b.hue=.88+(1-b.hp/b.maxHp)*.45;
  const x=impact?.x??b.x,y=impact?.y??b.y;
  const recent=this.popups.find(p=>p.bossHit&&this.time-p.created<.09);
  if(recent){recent.damage+=damage;recent.text=`−${recent.damage}`;recent.life=.65;}
  else this.popups.push({x,y:y-20,life:.65,bossHit:true,created:this.time,damage,text:`−${damage}`});
  for(let i=0;i<8;i++){const a=i*Math.PI/4;this.sparks.push({x,y,vx:Math.cos(a)*95,vy:Math.sin(a)*95,life:.28,maxLife:.28,color:'#ffd5ba'});}
  this.events.push('boss-hit');
  this.boss.r=115+40*this.boss.hp/this.boss.maxHp;
  if(this.boss.hp===0){
   this.liquid.drops=[];this.bolts=[];this.enemyBolts=[];this.thrust=0;
   this.state='transition';this.transition={kind:'level',remaining:2.4};this.events.push('won');
   return;
  }
  // Every few points of damage knocks a laser-armed mini blob loose.
  b.shed+=damage;
  for(;b.shed>=4;b.shed-=4)this.shedMini(impact);
 }
 shedMini(impact){
  const b=this.boss;if(this.liquid.drops.length>=MAX_DROPS)return;
  const from=impact?Math.atan2(impact.y-b.y,impact.x-b.x):Math.atan2(this.ship.y-b.y,this.ship.x-b.x);
  // Burst out beside the wound, clear of the firing line that opened it.
  const a=from+(this.random()<.5?-1:1)*(.9+this.random()*.5),r=25;
  this.liquid.drops.push({x:b.x+Math.cos(a)*(b.r+40),y:b.y+Math.sin(a)*(b.r+40),r,vx:Math.cos(a)*150,vy:Math.sin(a)*150,hue:(b.hue+.2+this.random()*.2)%1,seed:a,cool:1.3,minion:true,laserUntil:this.time+.4,nextShot:this.time+1.5+this.random()*1.5});
  this.events.push('split');
 }
 updateBoss(dt){
  const b=this.boss;if(!b||b.hp<=0)return;
  const s=this.ship,rage=1-b.hp/b.maxHp;
  const k=b.attack,rest=()=>{b.attack=null;b.nextAttack=this.time+5-rage*2;};
  if(!k){
   // Ring bursts join the rotation once the boss is below half health.
   const ring=rage>=.5&&b.attacks%2===1;
   // A charge is announced three seconds early, tracking the pilot until it locks.
   if(this.time<b.nextAttack-(ring?0:3))return;
   b.attacks++;
   b.attack=ring?{kind:'ring',at:this.time+.7,volleys:rage>=.75?2:1,spin:this.random()*6.28}:{kind:'charge',at:this.time+4,x:s.x,y:s.y};
   this.events.push('windup');
  }else if(k.kind==='charge'){
   // The dash commits to where the pilot was one second before it launches.
   if(!k.locked&&this.time<k.at-1){k.x=s.x;k.y=s.y;}
   else if(!k.locked){k.locked=true;b.dodge=null;this.events.push('windup');}
   else if(!k.dash&&this.time>=k.at){const dx=k.x-b.x,dy=k.y-b.y,dist=Math.hypot(dx,dy)||1;k.dash=true;k.vx=dx/dist*300;k.vy=dy/dist*300;k.until=this.time+Math.min(1.6,dist/300);this.events.push('charge');}
   else if(k.dash&&this.time>=k.until)rest();
  }else if(this.time>=k.at){
   for(let i=0;i<16;i++){const a=k.spin+i*Math.PI/8;this.enemyBolts.push({x:b.x+Math.cos(a)*b.r*.8,y:b.y+Math.sin(a)*b.r*.8,vx:Math.cos(a)*200,vy:Math.sin(a)*200,life:6});}
   this.events.push('ring');
   if(--k.volleys>0){k.at=this.time+.5;k.spin+=Math.PI/16;}else rest();
  }
 }
 minisFire(){
  const s=this.ship,level=this.phase==='level';
  for(const d of this.liquid.drops){
   if(level){
    // Small course oil fires only while the pilot is in range, each on its own clock.
    if(d.r>42||Math.hypot(s.x-d.x,s.y-d.y)>450){d.nextShot=undefined;continue;}
    d.nextShot??=this.time+1+this.random()*4;
   }else if(!d.minion)continue;
   if(this.time<d.nextShot||this.time<this.volleyGap)continue;
   d.nextShot=this.time+(level?5:2.6+this.random()*1.2);
   // On the course a short shared gap keeps neighbours from firing as one volley.
   if(level)this.volleyGap=this.time+.6;
   const a=Math.atan2(s.y-d.y,s.x-d.x);
   this.enemyBolts.push({x:d.x+Math.cos(a)*d.r,y:d.y+Math.sin(a)*d.r,vx:Math.cos(a)*240,vy:Math.sin(a)*240,life:6});
   this.events.push('enemy-laser');
  }
 }
 steerBoss(b,dt){
  const k=b.attack;
  if(k?.dash){b.vx=k.vx;b.vy=k.vy;return;}
  if(k&&(k.kind!=='charge'||k.locked)){const hold=Math.exp(-dt*6);b.vx*=hold;b.vy*=hold;return;}
  const rage=1-b.hp/b.maxHp;
  if(b.dodge){if(this.time<b.dodge.until){b.vx=b.dodge.vx;b.vy=b.dodge.vy;return;}b.dodge=null;}
  // Sidestep incoming fire, but only every so often: sustained fire still lands.
  if(this.time>=b.dodgeReady)for(const p of this.bolts){
   const speed=Math.hypot(p.vx,p.vy)||1,ux=p.vx/speed,uy=p.vy/speed,rx=b.x-p.x,ry=b.y-p.y,ahead=rx*ux+ry*uy,side=rx*uy-ry*ux;
   if(ahead<=0||ahead>b.r+420||Math.abs(side)>b.r)continue;
   let dir=side>0?1:side<0?-1:this.random()<.5?1:-1;
   const x=b.x+uy*dir*130;if(x<b.r||x>this.liquid.width-b.r)dir=-dir;
   b.dodge={vx:uy*dir*330,vy:-ux*dir*330,until:this.time+.4};b.dodgeReady=this.time+1.8-rage*.7;
   b.vx=b.dodge.vx;b.vy=b.dodge.vy;return;
  }
  // Weave across the upper arena, faster as the damage mounts.
  b.weave+=dt*(.35+rage*.25);
  const dx=550+Math.sin(b.weave)*330-b.x,dy=320+Math.sin(b.weave*1.7)*170-b.y,dist=Math.hypot(dx,dy)||1,speed=Math.min(110+rage*70,dist*2),response=1-Math.exp(-dt*3);
  b.vx+=(dx/dist*speed-b.vx)*response;b.vy+=(dy/dist*speed-b.vy)*response;
 }
 wake(d){if(!this.wakes.has(d))this.wakes.set(d,{angle:Math.atan2(d.vy,d.vx),next:this.time+4+this.random()*3,surgeUntil:0,speed:18+this.random()*10});return this.wakes.get(d);}
 detonate(view){
  if(this.state!=='playing'||this.nukes<1||!view||!Number.isFinite(view.x+view.y+view.w+view.h)||view.w<=0||view.h<=0)return false;
  this.nukes--;
  const radius=Math.min(240,Math.min(view.w,view.h)*.35);
  let hitBoss=false;
  this.liquid.drops=this.liquid.drops.filter(d=>{
   const visible=!(d.x+d.r<view.x||d.x-d.r>view.x+view.w||d.y+d.r<view.y||d.y-d.r>view.y+view.h);
   const inRange=Math.hypot(d.x-this.ship.x,d.y-this.ship.y)<=radius;
   if(d.boss){hitBoss=visible&&inRange;return true;}
   return !(visible&&inRange);
  });
  this.enemyBolts=this.enemyBolts.filter(b=>Math.hypot(b.x-this.ship.x,b.y-this.ship.y)>radius);
  if(hitBoss)this.damageBoss(8);
  this.blast={x:this.ship.x,y:this.ship.y,life:.65,radius};
  this.events.push('nuke');return true;
 }
 fire(){
  if(this.fireCooldown>0)return;this.fireCooldown=.22;this.events.push('laser');
  const s=this.ship;
  const angles=this.wideRemaining>0?[-.22,0,.22]:[0];
  for(const offset of angles){const nx=Math.cos(s.angle+offset),ny=Math.sin(s.angle+offset);
   for(const side of [-1,1])this.bolts.push({x:s.x+nx*18-ny*side*8,y:s.y+ny*18+nx*side*8,vx:nx*950+s.vx,vy:ny*950+s.vy,life:.9});
  }
 }
 update(dt,input={}){
  this.events.length=0;dt=Math.min(.035,Math.max(0,dt));if(this.state==='transition'){
   this.transition.remaining-=dt;
   if(this.transition.remaining<=0){if(this.transition.kind==='boss')this.beginBoss();else{this.phase='level';this.level++;this.restartEncounter(true);}}
   return;
  }
  if(this.state!=='playing'&&this.state!=='dying')return;
  this.time+=dt;this.fireCooldown=Math.max(0,this.fireCooldown-dt);
  const s=this.ship;
  if(this.state==='dying'){
   this.deathTime+=dt;const t=this.deathTime;s.x+=(this.caught.x-s.x)*dt*5;s.y+=(this.caught.y-s.y)*dt*5;s.angle+=dt*12;
   if(t>1){
    if(this.lives<=0){const lastRun={score:this.score,level:this.level,time:this.time};this.reset();this.lastRun=lastRun;this.lives=0;this.state='ready';this.events.push('gameover');}
    else{this.attempt++;this.restartEncounter();}
   }return;
  }
  this.wideRemaining=Math.max(0,this.wideRemaining-dt);
  const nukePressed=!!input.nuke&&!this.nukeHeld;this.nukeHeld=!!input.nuke;
  const detonated=nukePressed&&this.detonate(input.view);
  if(this.state==='transition')return;
  this.minisFire();
  if(this.phase==='boss')this.updateBoss(dt);
  if(this.blast){this.blast.life-=dt;if(this.blast.life<=0)this.blast=null;}
  this.current={x:0,y:0};
  this.intensity=this.phase==='boss'?1.15:1+this.progress*.25;
  for(const d of this.liquid.drops){
   const wake=this.wake(d);
   if(this.time>wake.next){
    // Eddies change their sideways curl, but never turn away from the pilot.
    wake.curl=(this.random()-.5)*.7;
    wake.surgeUntil=this.time+1.1;wake.next=this.time+4+this.random()*3;
   }
   const toward=Math.atan2(s.y-d.y,s.x-d.x);
   if(d.boss){this.steerBoss(d,dt);if(Math.hypot(d.vx,d.vy)>5)wake.angle=Math.atan2(d.vy,d.vx);}
   else{
   let aim=toward,pace=1;
   if(this.phase==='level'&&d.homeX!==undefined){
    // Oil keeps to its home waters: it hunts a nearby pilot, then drifts back to roam.
    const away=Math.hypot(d.homeX-d.x,d.homeY-d.y);
    if(away>350)d.returning=true;else if(away<200)d.returning=false;
    if(d.returning||Math.hypot(s.x-d.x,s.y-d.y)>450){
     const a=this.time*.15+d.seed,wx=d.homeX+Math.cos(a)*150-d.x,wy=d.homeY+Math.sin(a)*150-d.y;
     aim=Math.atan2(wy,wx);pace=Math.min(1,Math.hypot(wx,wy)/60);
    }
   }
   wake.angle=aim+(wake.curl||0)+Math.sin(this.time*1.7+d.seed)*.12;
   const speed=(wake.speed||23)*pace*this.intensity*(this.time<(wake.surgeUntil||0)?1.2:1);
   // Compensate for water drag, while retaining the kick from lasers and collisions.
   const response=1-Math.exp(-dt*1.8);
   d.vx+=(Math.cos(wake.angle)*speed*1.35-d.vx)*response;
   d.vy+=(Math.sin(wake.angle)*speed*1.35-d.vy)*response;
   // Keep inward momentum even after a turn, collision, or laser kick.
   const tx=Math.cos(aim),ty=Math.sin(aim),inward=d.vx*tx+d.vy*ty;
   const correction=Math.max(0,speed*.4-inward);
   d.vx+=tx*correction;d.vy+=ty*correction;
   }
   const nx=Math.cos(wake.angle),ny=Math.sin(wake.angle),dx=s.x-d.x,dy=s.y-d.y,behind=Math.abs(dx*nx+dy*ny),side=Math.abs(dx*ny-dy*nx);
   if(behind>0&&behind<d.r+330&&side<d.r+100){const power=(1-side/(d.r+100))*(1-behind/(d.r+330));this.current.x+=nx*power*60*this.intensity;this.current.y+=ny*power*60*this.intensity;}
  }
  this.liquid.step(dt,null,.12);
  // Oil behind the ship keeps pursuing; destroyed fragments free particle slots.
  s.angle+=((input.right?1:0)-(input.left?1:0))*dt*3.2;
  this.thrust=input.thrust?1:0;
  // Coast with a long deceleration tail; thrust and brakes retain their familiar response.
  const thrust=input.thrust?240:0,drag=input.brake?4:input.thrust?1.7:.38;
  s.vx+=(Math.cos(s.angle)*thrust+this.current.x)*dt;s.vy+=(Math.sin(s.angle)*thrust+this.current.y)*dt;
  s.vx*=Math.exp(-drag*dt);s.vy*=Math.exp(-drag*dt);
  s.x=Math.max(25,Math.min(WORLD.width-25,s.x+s.vx*dt));s.y=Math.max(70,Math.min((this.phase==='boss'?1100:WORLD.height)-60,s.y+s.vy*dt));
  if(input.fire&&!detonated)this.fire();
  for(const b of this.bolts){
   const oldX=b.x,oldY=b.y;b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;
   const candidates=this.liquid.drops.filter(d=>segmentHit(oldX,oldY,b.x,b.y,d)).sort((a,d)=>Math.hypot(a.x-oldX,a.y-oldY)-Math.hypot(d.x-oldX,d.y-oldY));
   if(candidates.length&&candidates[0].boss){this.damageBoss(1,b);b.life=0;if(this.state==='transition')return;continue;}
   if(candidates.length){const d=candidates[0],speed=Math.hypot(b.vx,b.vy),nx=-b.vy/speed,ny=b.vx/speed;
    // A short laser cooldown lets twin bolts cut one clean gap, not four fragments.
    if((d.laserUntil||0)<=this.time){const cool=d.cool;d.cool=0;
     if(d.r<=32){
      this.liquid.drops.splice(this.liquid.drops.indexOf(d),1);this.score+=100;this.events.push('explode');
      this.dropPowerup(d);
      this.popups.push({x:d.x,y:d.y,life:1.1});
      for(let i=0;i<26;i++){const angle=this.random()*Math.PI*2,force=55+this.random()*150;this.sparks.push({x:d.x,y:d.y,vx:Math.cos(angle)*force,vy:Math.sin(angle)*force,life:.7,maxLife:.7});}
     }
     else if(this.liquid.split(d,nx,ny)){const child=this.liquid.drops.at(-1);d.x-=nx*d.r*.48;d.y-=ny*d.r*.48;child.x+=nx*child.r*.48;child.y+=ny*child.r*.48;d.vx-=nx*70;d.vy-=ny*70;child.vx+=nx*70;child.vy+=ny*70;d.laserUntil=child.laserUntil=this.time+.3;this.cuts++;this.events.push('split');}
     else{d.cool=cool;d.vx+=b.vx*.09;d.vy+=b.vy*.09;}
     for(let i=0;i<9;i++)this.sparks.push({x:b.x,y:b.y,vx:(this.random()-.5)*130,vy:(this.random()-.5)*130,life:.4});
    }b.life=0;
   }
  }
  this.bolts=this.bolts.filter(b=>b.life>0);
  for(const b of this.enemyBolts){b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;}
  this.enemyBolts=this.enemyBolts.filter(b=>b.life>0&&b.x>0&&b.x<WORLD.width&&b.y>0&&b.y<this.liquid.height);
  for(const p of this.sparks){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;}this.sparks=this.sparks.filter(p=>p.life>0);
  for(const p of this.popups){p.y-=dt*32;p.life-=dt;}this.popups=this.popups.filter(p=>p.life>0);
  for(const barrel of this.powerups){barrel.y-=dt*8;barrel.x+=Math.sin(this.time*1.5+barrel.phase)*dt*5;}
  this.powerups=this.powerups.filter(item=>{
   if(Math.hypot(item.x-s.x,item.y-s.y)>=30)return true;
   const type=item.type||'nuke';
   const repair=type==='life'&&this.lives>=3;
   if(type==='life'){if(repair&&this.health>=100)return true;if(!repair)this.lives++;this.health=100;}
   else if(type==='wide')this.wideRemaining=15;
   else{if(this.nukes>=3)return true;this.nukes++;}
   this.events.push('pickup');
   this.popups.push({x:item.x,y:item.y,life:1.1,text:repair?'Hull repaired':type==='life'?'+1 life':type==='wide'?'Wide shot':'Nuke ready'});
   return false;
  });
  const hit=[[0,0],[8,0],[-8,0],[0,8],[0,-8]].some(([x,y])=>oilField(this.liquid.drops,s.x+x,s.y+y,this.time)>.29);
  let shot=hit?null:this.enemyBolts.find(b=>Math.hypot(b.x-s.x,b.y-s.y)<12);
  // Laser fire wears the hull down a quarter at a time; oil contact is still fatal.
  if(shot&&this.health>25){
   this.health-=25;this.hullHitAt=this.time;this.enemyBolts.splice(this.enemyBolts.indexOf(shot),1);this.events.push('ship-hit');
   for(let i=0;i<10;i++){const a=i*Math.PI/5;this.sparks.push({x:s.x,y:s.y,vx:Math.cos(a)*110,vy:Math.sin(a)*110,life:.3,maxLife:.3,color:'#ffb3a6'});}
   shot=null;
  }
  if(shot)this.health=0;
  if(hit||shot){this.lives--;this.events.push('caught');this.state='dying';this.shot=!!shot;this.caught=shot?{x:shot.x,y:shot.y}:this.liquid.drops.reduce((a,b)=>Math.hypot(a.x-s.x,a.y-s.y)<Math.hypot(b.x-s.x,b.y-s.y)?a:b);}
  else if(this.phase==='level'&&s.y<WORLD.finishY&&s.x>370&&s.x<730){this.state='transition';this.thrust=0;this.transition={kind:'boss',remaining:2};this.events.push('boss');}
 }
 get progress(){return Math.max(0,Math.min(1,(WORLD.startY-this.ship.y)/(WORLD.startY-WORLD.finishY)));}
}
