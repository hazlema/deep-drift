import {Liquid} from './physics.js';
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
  this.liquid=new Liquid(WORLD.width,WORLD.height,this.random);this.liquid.drops=[];
  const rows=[[3980,260,80],[3930,650,105],[3690,880,80],[3500,450,105],[3260,170,70],[3210,745,112],[2900,540,95],[2750,900,82],[2630,230,85],[2390,690,100],[2180,385,115],[2070,920,65],[1880,130,70],[1790,750,105],[1520,480,110],[1370,920,75],[1230,200,80],[1020,680,110],[830,390,80],[650,850,76],[565,150,66],[3990,1000,33],[3030,70,32],[1630,1010,30]];
  for(const [y,x,r] of rows)this.liquid.drops.push({x,y,r,vx:(x<WORLD.width/2?1:-1)*(12+this.random()*8),vy:(this.random()-.5)*10,hue:this.random(),seed:this.random()*6.28,cool:0});
  this.ship={x:550,y:WORLD.startY,vx:0,vy:0,angle:-Math.PI/2};this.events=[];this.powerups=[];this.nukes=0;this.nukeHeld=false;this.blast=null;this.bolts=[];this.sparks=[];this.popups=[];this.score=0;this.intensity=1;this.wakes=new WeakMap();this.time=0;this.fireCooldown=0;this.deathTime=0;this.cuts=0;this.state='playing';this.thrust=0;this.current={x:0,y:0};
 }
 start(){this.attempt=1;this.reset();}
 wake(d){if(!this.wakes.has(d))this.wakes.set(d,{angle:Math.atan2(d.vy,d.vx),next:this.time+4+this.random()*3,surgeUntil:0,speed:18+this.random()*10});return this.wakes.get(d);}
 detonate(view){
  if(this.state!=='playing'||this.nukes<1||!view||!Number.isFinite(view.x+view.y+view.w+view.h)||view.w<=0||view.h<=0)return false;
  this.nukes--;
  const radius=Math.min(240,Math.min(view.w,view.h)*.35);
  this.liquid.drops=this.liquid.drops.filter(d=>Math.hypot(d.x-this.ship.x,d.y-this.ship.y)>radius||d.x+d.r<view.x||d.x-d.r>view.x+view.w||d.y+d.r<view.y||d.y-d.r>view.y+view.h);
  this.blast={x:this.ship.x,y:this.ship.y,life:.65,radius};
  this.events.push('nuke');return true;
 }
 fire(){
  if(this.fireCooldown>0)return;this.fireCooldown=.22;this.events.push('laser');
  const s=this.ship,nx=Math.cos(s.angle),ny=Math.sin(s.angle);
  for(const side of [-1,1])this.bolts.push({x:s.x+nx*18-ny*side*8,y:s.y+ny*18+nx*side*8,vx:nx*950+s.vx,vy:ny*950+s.vy,life:.9});
 }
 update(dt,input={}){
  this.events.length=0;dt=Math.min(.035,Math.max(0,dt));if(this.state!=='playing'&&this.state!=='dying')return;
  this.time+=dt;this.fireCooldown=Math.max(0,this.fireCooldown-dt);
  const s=this.ship;
  if(this.state==='dying'){
   this.deathTime+=dt;const t=this.deathTime;s.x+=(this.caught.x-s.x)*dt*5;s.y+=(this.caught.y-s.y)*dt*5;s.angle+=dt*12;
   if(t>1){this.attempt++;this.reset();}return;
  }
  const nukePressed=!!input.nuke&&!this.nukeHeld;this.nukeHeld=!!input.nuke;
  const detonated=nukePressed&&this.detonate(input.view);
  if(this.blast){this.blast.life-=dt;if(this.blast.life<=0)this.blast=null;}
  this.current={x:0,y:0};
  this.intensity=1+this.progress*.25;
  for(const d of this.liquid.drops){
   const wake=this.wake(d);
   if(this.time>wake.next){
    // Eddies change their sideways curl, but never turn away from the pilot.
    wake.curl=(this.random()-.5)*.7;
    wake.surgeUntil=this.time+1.1;wake.next=this.time+4+this.random()*3;
   }
   const toward=Math.atan2(s.y-d.y,s.x-d.x);
   wake.angle=toward+(wake.curl||0)+Math.sin(this.time*1.7+d.seed)*.12;
   const speed=(wake.speed||23)*this.intensity*(this.time<(wake.surgeUntil||0)?1.2:1);
   // Compensate for water drag, while retaining the kick from lasers and collisions.
   const response=1-Math.exp(-dt*1.8);
   d.vx+=(Math.cos(wake.angle)*speed*1.35-d.vx)*response;
   d.vy+=(Math.sin(wake.angle)*speed*1.35-d.vy)*response;
   // Keep inward momentum even after a turn, collision, or laser kick.
   const tx=Math.cos(toward),ty=Math.sin(toward),inward=d.vx*tx+d.vy*ty;
   const correction=Math.max(0,speed*.4-inward);
   d.vx+=tx*correction;d.vy+=ty*correction;
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
  s.x=Math.max(25,Math.min(WORLD.width-25,s.x+s.vx*dt));s.y=Math.max(70,Math.min(WORLD.height-60,s.y+s.vy*dt));
  if(input.fire&&!detonated)this.fire();
  for(const b of this.bolts){
   const oldX=b.x,oldY=b.y;b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;
   const candidates=this.liquid.drops.filter(d=>segmentHit(oldX,oldY,b.x,b.y,d)).sort((a,d)=>Math.hypot(a.x-oldX,a.y-oldY)-Math.hypot(d.x-oldX,d.y-oldY));
   if(candidates.length){const d=candidates[0],speed=Math.hypot(b.vx,b.vy),nx=-b.vy/speed,ny=b.vx/speed;
    // A short laser cooldown lets twin bolts cut one clean gap, not four fragments.
    if((d.laserUntil||0)<=this.time){const cool=d.cool;d.cool=0;
     if(d.r<=32){
      this.liquid.drops.splice(this.liquid.drops.indexOf(d),1);this.score+=100;this.events.push('explode');
      if(this.random()<.05)this.powerups.push({x:d.x,y:d.y,phase:this.random()*Math.PI*2});
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
  for(const p of this.sparks){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;}this.sparks=this.sparks.filter(p=>p.life>0);
  for(const p of this.popups){p.y-=dt*32;p.life-=dt;}this.popups=this.popups.filter(p=>p.life>0);
  for(const barrel of this.powerups){barrel.y-=dt*8;barrel.x+=Math.sin(this.time*1.5+barrel.phase)*dt*5;}
  this.powerups=this.powerups.filter(barrel=>{if(this.nukes<3&&Math.hypot(barrel.x-s.x,barrel.y-s.y)<30){this.nukes++;this.events.push('pickup');return false;}return true;});
  const hit=[[0,0],[8,0],[-8,0],[0,8],[0,-8]].some(([x,y])=>oilField(this.liquid.drops,s.x+x,s.y+y,this.time)>.29);
  if(hit){this.events.push('caught');this.state='dying';this.caught=this.liquid.drops.reduce((a,b)=>Math.hypot(a.x-s.x,a.y-s.y)<Math.hypot(b.x-s.x,b.y-s.y)?a:b);}
  else if(s.y<WORLD.finishY&&s.x>370&&s.x<730){this.events.push('won');this.state='won';}
 }
 get progress(){return Math.max(0,Math.min(1,(WORLD.startY-this.ship.y)/(WORLD.startY-WORLD.finishY)));}
}
