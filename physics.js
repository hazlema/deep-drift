export const MAX_DROPS = 48;
const TAU = Math.PI * 2;
export class Liquid {
  constructor(width = 1400, height = 900, random = Math.random) {
    this.random = random;
    this.width = width; this.height = height; this.time = 0; this.splits = 0;
    this.reset();
  }
  reset() {
    this.drops = []; this.splits = 0;
    const s = Math.min(this.width, this.height);
    const layout = [[.61,.30,.09],[.72,.43,.068],[.54,.54,.078],[.81,.64,.059],[.72,.22,.043],[.89,.32,.031],[.37,.70,.044],[.65,.71,.038],[.90,.51,.02],[.46,.17,.03],[.83,.14,.018],[.28,.51,.021],[.15,.75,.028],[.47,.81,.025],[.94,.78,.023],[.33,.11,.016],[.58,.86,.019],[.78,.83,.014],[.09,.31,.014],[.93,.12,.012],[.37,.38,.015],[.53,.37,.013],[.68,.58,.012],[.23,.88,.017]];
    for (const [x,y,r] of layout) this.drops.push({x:x*this.width,y:y*this.height,r:r*s*(r>.05?1.18:1),vx:(this.random()-.5)*15,vy:(this.random()-.5)*15,hue:this.random(),seed:this.random()*TAU,cool:0});
  }
  resize(w,h) {
    const scale = Math.min(w,h)/Math.min(this.width,this.height);
    for (const d of this.drops) {d.x*=w/this.width;d.y*=h/this.height;d.r*=scale;}
    this.width=w;this.height=h;
  }
  split(drop, dx = 1, dy = 0) {
    if (this.drops.length >= MAX_DROPS || drop.r < Math.min(this.width,this.height)*.016 || drop.cool > 0) return false;
    const len=Math.hypot(dx,dy)||1, nx=dx/len, ny=dy/len;
    const r=drop.r/Math.sqrt(2), offset=r*.49;
    const h=(drop.hue+.23+this.random()*.18)%1;
    const child={...drop,r,x:drop.x+nx*offset,y:drop.y+ny*offset,vx:drop.vx+nx*65,vy:drop.vy+ny*65,hue:h,cool:1.3,seed:this.random()*TAU};
    drop.r=r;drop.x-=nx*offset;drop.y-=ny*offset;drop.vx-=nx*65;drop.vy-=ny*65;drop.hue=(h+.17)%1;drop.cool=1.3;
    this.drops.push(child);this.splits++;return true;
  }
  burst(x,y) {
    for (const d of [...this.drops]) {
      const dx=d.x-x,dy=d.y-y,dist=Math.hypot(dx,dy);
      if (dist<d.r+150) {
        const angle=dist>5?Math.atan2(dy,dx):this.random()*TAU;
        d.vx+=Math.cos(angle)*110;d.vy+=Math.sin(angle)*110;
        this.split(d,-Math.sin(angle),Math.cos(angle));
      }
    }
  }
  step(dt,pointer,current=.35) {
    dt=Math.min(.035,Math.max(0,dt)); this.time+=dt;
    const s=Math.min(this.width,this.height);
    for (const d of [...this.drops]) {
      d.cool=Math.max(0,d.cool-dt);
      d.vx+=Math.sin(d.y/s*3+this.time*.25+d.seed)*dt*(7+current*22);
      d.vy+=Math.cos(d.x/s*2+this.time*.2+d.seed)*dt*(7+current*22);
      if (pointer?.active) {
        const dx=d.x-pointer.x,dy=d.y-pointer.y,dist=Math.hypot(dx,dy);
        const radius=s*.30, influence=Math.exp(-dist*dist/(radius*radius));
        d.vx+=(pointer.vx*.95-dy*.35)*influence*dt*(2+current*3);
        d.vy+=(pointer.vy*.95+dx*.35)*influence*dt*(2+current*3);
        if (Math.hypot(pointer.vx,pointer.vy)>650 && dist<d.r+40) this.split(d,-pointer.vy,pointer.vx);
      }
      d.vx*=Math.exp(-dt*.62);d.vy*=Math.exp(-dt*.62);
      const speed=Math.hypot(d.vx,d.vy);if(speed>350){d.vx*=350/speed;d.vy*=350/speed;}
      d.x+=d.vx*dt;d.y+=d.vy*dt;
      if(d.x<d.r){d.x=d.r;d.vx=Math.abs(d.vx)*.7;} if(d.x>this.width-d.r){d.x=this.width-d.r;d.vx=-Math.abs(d.vx)*.7;}
      if(d.y<d.r){d.y=d.r;d.vy=Math.abs(d.vy)*.7;} if(d.y>this.height-d.r){d.y=this.height-d.r;d.vy=-Math.abs(d.vy)*.7;}
    }
    // Roll once per eligible collision. Split siblings have time to drift apart.
    for(let i=0;i<this.drops.length;i++)for(let j=i+1;j<this.drops.length;j++){
      const a=this.drops[i],b=this.drops[j];
      const dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy);
      if(a.boss||b.boss||a.cool>0||b.cool>0||dist>=(a.r+b.r)*.9)continue;
      const aa=a.r*a.r,bb=b.r*b.r,total=aa+bb;
      if(this.random()<.5){
        // The larger blob absorbs the smaller one's oil and momentum.
        a.x=(a.x*aa+b.x*bb)/total;a.y=(a.y*aa+b.y*bb)/total;
        a.vx=(a.vx*aa+b.vx*bb)/total;a.vy=(a.vy*aa+b.vy*bb)/total;
        if(bb>aa){a.hue=b.hue;a.seed=b.seed;}
        a.r=Math.sqrt(total);a.cool=1;
        this.drops.splice(j,1);j--;
      }else{
        // Equal and opposite impulses; smaller blobs spring away faster.
        const nx=dist>1e-6?dx/dist:1,ny=dist>1e-6?dy/dist:0;
        const relative=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
        const kick=Math.max(0,Math.max(80,-relative*.8)-relative);
        a.vx-=nx*kick*bb/total;a.vy-=ny*kick*bb/total;
        b.vx+=nx*kick*aa/total;b.vy+=ny*kick*aa/total;
        const separation=(a.r+b.r)*1.08-dist;
        a.x-=nx*separation*bb/total;a.y-=ny*separation*bb/total;
        b.x+=nx*separation*aa/total;b.y+=ny*separation*aa/total;
        a.cool=.8;b.cool=.8;
      }
    }
    // Collision corrections and growing blobs must also stay inside the water.
    for(const d of this.drops){
      d.x=Math.max(d.r,Math.min(this.width-d.r,d.x));
      d.y=Math.max(d.r,Math.min(this.height-d.r,d.y));
    }
  }
}
