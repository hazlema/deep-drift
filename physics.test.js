import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Liquid,MAX_DROPS} from './physics.js';
const area=l=>l.drops.reduce((sum,d)=>sum+d.r*d.r,0);
test('splitting changes both colors and conserves oil area',()=>{const l=new Liquid(1400,900,()=>.5);const d=l.drops[0],h=d.hue,a=area(l),count=l.drops.length;assert.equal(l.split(d,1,0),true);assert.equal(l.drops.length,count+1);assert.notEqual(d.hue,h);assert.notEqual(l.drops.at(-1).hue,h);assert.ok(Math.abs(area(l)-a)<1e-6);});
test('fast pointer current splits drops and moves them',()=>{const l=new Liquid(1400,900,()=>.5);const d=l.drops[0],x=d.x;l.step(.016,{active:true,x:d.x,y:d.y,vx:1100,vy:300},.6);assert.ok(l.splits>0);assert.notEqual(d.x,x);});
test('absorption conserves oil area',()=>{const l=new Liquid(1400,900,()=>.1);l.drops=[{x:500,y:500,r:30,vx:0,vy:0,hue:.2,seed:0,cool:0},{x:510,y:500,r:20,vx:0,vy:0,hue:.5,seed:0,cool:0}];const a=area(l);l.step(.016,null,0);assert.equal(l.drops.length,1);assert.ok(Math.abs(area(l)-a)<1e-6);});
test('sustained bursts stay bounded and finite',()=>{const l=new Liquid(800,600,()=>.5),a=area(l);for(let i=0;i<2000;i++){if(i%10===0)l.burst(400,300);l.step(.016,{active:true,x:400,y:300,vx:800,vy:-500},1);}assert.ok(l.drops.length<=MAX_DROPS);assert.ok(Math.abs(area(l)-a)<1e-5);for(const d of l.drops){assert.ok(Number.isFinite(d.x+d.y+d.vx+d.vy+d.r));assert.ok(d.x>=d.r&&d.x<=800-d.r);assert.ok(d.y>=d.r&&d.y<=600-d.r);}});
test('resize preserves relative position and reset restores scene',()=>{const l=new Liquid(1000,800);const x=l.drops[0].x,r=l.drops[0].r;l.resize(500,400);assert.equal(l.drops[0].x,x/2);assert.equal(l.drops[0].r,r/2);l.burst(300,150);l.reset();assert.equal(l.drops.length,24);assert.equal(l.splits,0);});

function collisionPair(random) {
  const l=new Liquid(1000,800,random);
  l.drops=[{x:450,y:400,r:40,vx:20,vy:0,hue:.2,seed:0,cool:0},{x:500,y:400,r:25,vx:-20,vy:0,hue:.7,seed:0,cool:0}];
  return l;
}
test('repulsion separates drops and conserves area and momentum',()=>{
  const l=collisionPair(()=>.9),before=area(l);
  const momentum=l.drops.reduce((sum,d)=>sum+d.vx*d.r*d.r,0);
  l.step(0,null,0);
  assert.equal(l.drops.length,2);
  const [a,b]=l.drops;
  assert.ok(b.vx-a.vx>=79);
  assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=a.r+b.r);
  assert.equal(area(l),before);
  assert.ok(Math.abs(a.vx*a.r*a.r+b.vx*b.r*b.r-momentum)<1e-6);
});
test('collision cooldown prevents repeated random decisions',()=>{
  let rolls=0;const l=collisionPair(()=>{rolls++;return .9;});rolls=0;
  l.step(0,null,0);assert.equal(rolls,1);
  l.drops[1].x=l.drops[0].x;
  l.step(.016,null,0);assert.equal(rolls,1);
});
test('coincident drops repel without invalid numbers',()=>{
  const l=collisionPair(()=>.9);l.drops[1].x=l.drops[0].x;
  l.step(0,null,0);
  assert.equal(l.drops.length,2);
  for(const d of l.drops)assert.ok(Number.isFinite(d.x+d.y+d.vx+d.vy));
  assert.ok(Math.hypot(l.drops[0].x-l.drops[1].x,l.drops[0].y-l.drops[1].y)>0);
});
test('absorption retains the larger blobs color regardless of array order',()=>{
  const l=collisionPair(()=>.1);l.drops.reverse();l.step(0,null,0);
  assert.equal(l.drops.length,1);assert.equal(l.drops[0].hue,.2);
});
