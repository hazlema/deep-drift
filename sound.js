// A small procedural soundtrack: no downloads, loops, or autoplay before launch.
export class FlightSound {
 constructor(){this.muted=false;this.paused=false;this.active=new Set();try{this.muted=localStorage.getItem('deep-drift-muted')==='true';}catch{}}
 async unlock(){
  try{
   if(!this.context){const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Audio)return false;this.initialize(new Audio());}
   if(this.context.state==='suspended')await this.context.resume();
   return this.context.state==='running';
  }catch{return false;}
 }
 initialize(context){
  this.context=context;this.master=context.createGain();this.master.gain.value=this.muted?0:.32;
  const limiter=context.createDynamicsCompressor();limiter.threshold.value=-12;limiter.ratio.value=6;this.master.connect(limiter);limiter.connect(context.destination);
  this.noise=context.createBuffer(1,context.sampleRate*2,context.sampleRate);const samples=this.noise.getChannelData(0);let brown=0;for(let i=0;i<samples.length;i++){brown=(brown+(.04*(Math.random()*2-1)))/1.02;samples[i]=brown*3.5;}
  this.engine=context.createBufferSource();this.engine.buffer=this.noise;this.engine.loop=true;
  this.engineFilter=context.createBiquadFilter();this.engineFilter.type='lowpass';this.engineFilter.frequency.value=230;
  this.engineGain=context.createGain();this.engineGain.gain.value=0;this.engine.connect(this.engineFilter);this.engineFilter.connect(this.engineGain);this.engineGain.connect(this.master);this.engine.start();
 }
 setMuted(value){this.muted=value;try{localStorage.setItem('deep-drift-muted',String(value));}catch{}this.applyVolume();}
 setPaused(value){this.paused=value;this.applyVolume();if(value){for(const source of this.active){try{source.stop();}catch{}}this.active.clear();}}
 applyVolume(){if(!this.context)return;const p=this.master.gain,t=this.context.currentTime;p.cancelScheduledValues(t);p.setTargetAtTime(this.muted||this.paused?0:.32,t,.025);}
 tone(from,to,duration,volume=.2,type='sine',delay=0){
  if(!this.context||this.muted||this.paused)return;
  const c=this.context,t=c.currentTime+delay,osc=c.createOscillator(),gain=c.createGain();osc.type=type;osc.frequency.setValueAtTime(from,t);osc.frequency.exponentialRampToValueAtTime(Math.max(20,to),t+duration);
  gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(volume,t+.008);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);osc.connect(gain);gain.connect(this.master);this.active.add(osc);osc.onended=()=>{this.active.delete(osc);osc.disconnect();gain.disconnect();};osc.start(t);osc.stop(t+duration+.02);
 }
 splash(duration=.35,volume=.3){
  if(!this.context||this.muted||this.paused)return;
  const c=this.context,t=c.currentTime,source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();source.buffer=this.noise;filter.type='lowpass';filter.frequency.setValueAtTime(1800,t);filter.frequency.exponentialRampToValueAtTime(120,t+duration);gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(volume,t+.01);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);source.connect(filter);filter.connect(gain);gain.connect(this.master);this.active.add(source);source.onended=()=>{this.active.delete(source);source.disconnect();filter.disconnect();gain.disconnect();};source.start(t);source.stop(t+duration+.02);
 }
 play(event){
  switch(event){
   case 'boss-hit':this.tone(360,95,.12,.18,'triangle');break;
   case 'boss':this.tone(110,55,.7,.2,'triangle');this.tone(165,82,.65,.1,'sine',.15);break;
   case 'gameover':this.tone(180,60,.8,.17);break;
   case 'pickup':this.tone(440,880,.25,.18);this.tone(660,990,.25,.12,'sine',.1);break;
   case 'nuke':this.splash(.65,.65);this.tone(240,28,.65,.28);break;
   case 'launch':this.tone(180,360,.35,.18);this.tone(360,540,.4,.12,'sine',.12);break;
   case 'laser':this.tone(900,220,.12,.10,'triangle');this.tone(660,160,.10,.06,'sine',.015);break;
   case 'split':this.tone(280,75,.19,.27);this.splash(.18,.25);break;
   case 'explode':this.splash(.45,.65);this.tone(160,38,.35,.32);this.tone(660,880,.15,.12,'sine',.08);break;
   case 'caught':this.splash(.8,.32);this.tone(390,35,.85,.3);this.tone(270,45,.7,.13,'triangle');break;
   case 'won':[330,440,554,660].forEach((f,i)=>this.tone(f,f,.55,.16,'sine',i*.13));break;
  }
 }
 update(game,paused){
  if(paused!==this.paused)this.setPaused(paused);
  for(const event of game.events.splice(0))if(!paused)this.play(event);
  if(!this.context)return;
  const flying=game.state==='playing'&&!paused,t=this.context.currentTime;
  this.engineGain.gain.setTargetAtTime(flying?(game.thrust?.22:.035):0,t,.09);
  this.engineFilter.frequency.setTargetAtTime(game.thrust?360:140,t,.12);
 }
}
