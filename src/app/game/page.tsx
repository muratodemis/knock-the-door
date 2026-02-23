"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { getSocket } from "@/lib/socket";
import { v4 as uuidv4 } from "uuid";
import Link from "next/link";

type BossStatus = "available" | "busy" | "away" | "in-meeting";
type KnockState = "idle" | "knocking" | "waiting" | "accepted" | "declined";
interface QueueInfo { position: number; totalInQueue: number; estimatedWaitMinutes: number; }
interface ChatMsg { from: "boss" | "employee"; text: string; timestamp: number; }

const SC = 4;
const LW = 380, LH = 220;
const CW = LW * SC, CH = LH * SC;
type C = CanvasRenderingContext2D;

function px(c:C,x:number,y:number,w:number,h:number,col:string){c.fillStyle=col;c.fillRect(Math.round(x),Math.round(y),w,h);}
function spr(c:C,ox:number,oy:number,rows:string[],pal:Record<string,string>){
  for(let ry=0;ry<rows.length;ry++)for(let rx=0;rx<rows[ry].length;rx++){
    const ch=rows[ry][rx];if(ch!=="."&&pal[ch]){c.fillStyle=pal[ch];c.fillRect(ox+rx,oy+ry,1,1);}
  }
}

// ═══ SOUND SYSTEM ═══
let globalMuted=false;

function playKnock(){
  if(globalMuted)return;
  try{const a=new AudioContext();
  const hit=(freq:number,delay:number,dur:number,vol:number)=>{const o=a.createOscillator(),g=a.createGain();
    o.connect(g);g.connect(a.destination);o.frequency.value=freq;o.type="sine";
    g.gain.setValueAtTime(0,a.currentTime+delay);g.gain.linearRampToValueAtTime(vol,a.currentTime+delay+0.005);
    g.gain.exponentialRampToValueAtTime(0.001,a.currentTime+delay+dur);o.start(a.currentTime+delay);o.stop(a.currentTime+delay+dur);};
  hit(220,0,0.15,0.35);hit(180,0.005,0.12,0.2);hit(200,0.14,0.15,0.28);hit(160,0.145,0.12,0.16);hit(190,0.28,0.1,0.18);
  }catch{}
}
function playBilliardHit(){
  if(globalMuted)return;
  try{const a=new AudioContext(),o=a.createOscillator(),g=a.createGain(),f=a.createBiquadFilter();
  o.connect(f);f.connect(g);g.connect(a.destination);f.type="highpass";f.frequency.value=600;
  o.frequency.value=900+Math.random()*600;o.type="sine";
  g.gain.setValueAtTime(0.2,a.currentTime);g.gain.exponentialRampToValueAtTime(0.001,a.currentTime+0.06);
  o.start(a.currentTime);o.stop(a.currentTime+0.06);
  const n=a.createBufferSource(),buf=a.createBuffer(1,a.sampleRate*0.04,a.sampleRate),d=buf.getChannelData(0);
  for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.exp(-i/200)*0.08;n.buffer=buf;n.connect(a.destination);n.start(a.currentTime);
  }catch{}
}
function playPingPong(){
  if(globalMuted)return;
  try{const a=new AudioContext(),o=a.createOscillator(),g=a.createGain();
  o.connect(g);g.connect(a.destination);o.frequency.value=1200+Math.random()*200;o.type="square";
  g.gain.setValueAtTime(0.08,a.currentTime);g.gain.exponentialRampToValueAtTime(0.001,a.currentTime+0.04);
  o.start(a.currentTime);o.stop(a.currentTime+0.04);
  }catch{}
}
let lastStep=0;
function playFootstep(f:number){
  if(globalMuted||f-lastStep<8)return;lastStep=f;
  try{const a=new AudioContext(),o=a.createOscillator(),g=a.createGain(),fl=a.createBiquadFilter();
  o.connect(fl);fl.connect(g);g.connect(a.destination);fl.type="lowpass";fl.frequency.value=300;
  o.frequency.value=60+Math.random()*40;o.type="triangle";
  g.gain.setValueAtTime(0.06,a.currentTime);g.gain.exponentialRampToValueAtTime(0.001,a.currentTime+0.08);
  o.start(a.currentTime);o.stop(a.currentTime+0.08);
  }catch{}
}

// ═══ PALETTE ═══
const P = {
  ceil:"#1A1A28",ceilL:"#222238",
  wallD:"#2C3850",wallP:"#344060",
  crown:["#8B6B40","#B08850","#6A4A28","#5A3A18"],
  rail:["#9A7A50","#C09060","#7A5A30"],
  wainB:"#5A3A20",wainL:"#7A5A38",wainD:"#3A2210",wainH:"#8B6A4A",
  base:["#4A3018","#6A4A28","#3A2010"],
  floorB:"#3A2A18",floorL:"#4A3820",floorG:"#1A1008",
  runner:["#6A2030","#501828","#802840"],
  doorF:["#6B4028","#8B6048","#4A2810","#A07858"],
  brass:["#C8A040","#E8C860","#A08020"],
  green:["#2A8854","#1A6838","#48C878"],
  red:["#C84040","#A02828","#E86868"],
  amber:["#D0A030","#A88020","#F0C848"],
  gray:["#6A6A7A","#4A4A5A","#8A8A9A"],
  glass:"#3A5878",glassH:"#5888AA",
  roomFloor:"#22222E",roomWall:"#1A2030",roomWallL:"#202840",
  desk:"#6B5030",deskL:"#8B6A42",deskD:"#4A3820",
  monitor:"#181820",monScr:"#1A2838",
  chair:"#3A3A4A",chairL:"#4A4A5A",chairD:"#2A2A38",
  mug:"#E0DCD0",mugD:"#C0B8A0",coffee:"#5A3018",
  hp:"#E04040",hpD:"#B03030",hpB:"#A02828",
  skin:["#FDCAB4","#E5A890","#D09878"],
  hair:["#3D2B1F","#6B4A35","#2A1A10"],
  bossHair:["#1A1A30","#2A2A48","#101020"],
  bossShirt:["#2A6A40","#1A5030","#48A868"],
  pShirt:["#5B8ED9","#4070B8","#80B0F0"],
  pants:["#3A3A4A","#2A2A38"],shoe:["#2A2210","#3A3220"],
  plant:["#2E9A48","#1A7030","#50D068"],pot:["#A06838","#C08848"],
  felt:"#1A6838",feltL:"#208040",feltD:"#104828",
  ballR:"#E04040",ballY:"#E0C040",ballW:"#E8E8E8",ballB:"#2040A0",ballP:"#8040B0",ballO:"#F0A030",
  leather:["#6A3020","#884038","#4A1810"],
  cue:"#D8C890",cueD:"#A89860",
};

// ═══ EMPLOYEE SPRITE 18×26 ═══
const EP:Record<string,string>={
  o:"#0E0C08",h:P.hair[0],H:P.hair[1],D:P.hair[2],s:P.skin[0],S:P.skin[1],T:P.skin[2],
  e:"#1A1410",w:"#FFF",m:"#D08070",
  b:P.pShirt[0],B:P.pShirt[1],c:P.pShirt[2],
  p:P.pants[0],P:P.pants[1],z:P.shoe[0],Z:P.shoe[1],
};
const E_DOWN=[
  "......oooooo......","....ohhhHhhho.....","...ohHHHHHHhho....","...ohHHDDHHhho....","...ohHDDDHHhho....","...ohhhhhhhho.....","...oSsssssSo......","...oSswwswSo......","...oSseeseSo......","...osss.ssso......",
  "....ossmso........",".....oTTo.........","....obbbbbo.......","...obBBBBBbo......","..obcBBBBBcbo.....","..TobBBBBBBBoT....","..so.bBBBBBb.os...","...obbBBBBBbbo....","...opppppppo......","...opPP.PPpo......",
  "...opPP.PPpo......","...opPP.PPpo......","....ozz.zzo.......","...oZZz.zZZo......","...oooo.oooo......",
];
const E_UP=[
  "......oooooo......","....ohhhHhhho.....","...ohHHHHHHhho....","...ohHHHHHHhho....","...ohHHHHHHhho....","...ohhhhhhhho.....","...oSSSSSSSo......","...oSSSSSSSo......","...oSSSSSSSo......","...oSSSSSSSo......",
  "....oSSSSo........",".....oTTo.........","....obbbbbo.......","...obBBBBBbo......","..obcBBBBBcbo.....","..TobBBBBBBBoT....","..so.bBBBBBb.os...","...obbBBBBBbbo....","...opppppppo......","...opPP.PPpo......",
  "...opPP.PPpo......","...opPP.PPpo......","....ozz.zzo.......","...oZZz.zZZo......","...oooo.oooo......",
];
const E_LEFT=[
  ".....oooooo.......","...ohhhHhhho......","..ohHHHHHHhho.....","..ohHHDDHHhho.....","..ohHDDDHHhho.....","..ohhhhhhhho......","..oSsssssSo.......","..owwsssSo........","..oeesssSo........","..osss.sso........",
  "...ossmso.........",".....oTTo.........","...obbbbbo........","..obBBBBBbo.......","..obbBBBBBbbso....","...obBBBBBbbo.....","...obbBBBBbbo.....","....oppppppo......","....opPPppo.......","....opPPppo.......",
  "....opPPppo.......","....ozzzzo........","...oZZzzoo........","...ooooo..........",
];
const E_RIGHT=[
  ".......oooooo.....","......ohhhHhhho...","....ohHHHHHHhho...","....ohHHDDHHhho...","....ohHDDDHHhho...",".....ohhhhhhhho...","......oSsssssSo...","........oSssswwo..","........oSssseeo..","......oss.ssso....",
  ".........ossmso...",".........oTTo.....","........obbbbbo...",".......obBBBBBbo..","....osbBBBBBBbbo..","......obbBBBBBbo..","......obbBBBBbbo..","......oppppppo....","........oppPPpo...","........oppPPpo...",
  "........oppPPpo...","........ozzzzo....","........oozzZZo...","..........ooooo...",
];
function eWalk(base:string[],frame:number):string[]{
  return base.map((r,i)=>{if(i>=21&&i<=24){if(frame%2===0){if(i===21)return"..opPo...oPPpo....";if(i===22)return"..ozzo....ozzo....";if(i===23)return".oZZo......oZZo...";if(i===24)return".oooo......oooo...";}else{if(i===21)return"...opPPoPPpo......";if(i===22)return"...ozzo.ozzo......";if(i===23)return"..oZZzo.ozZZo.....";if(i===24)return"..oooo..oooo......";}}return r;});
}
const E_BLINK=E_DOWN.map((r,i)=>i===7?"...oSsoosssoSo....":i===8?"...oSsssssSo......":r);

// ═══ BOSS SPRITE 18×20 ═══
const BP:Record<string,string>={
  o:"#0E0C08",h:P.bossHair[0],H:P.bossHair[1],D:P.bossHair[2],
  s:P.skin[0],S:P.skin[1],T:P.skin[2],
  e:"#1A1410",w:"#FFF",m:"#D08070",g:"#4488CC",G:"#336AAA",
  b:P.bossShirt[0],B:P.bossShirt[1],c:P.bossShirt[2],
  p:P.pants[0],z:P.shoe[0],
  r:P.hp,R:P.hpD,A:P.hpB,
  f:P.coffee,F:P.mug,M:P.mugD,
};
const BOSS_COFFEE=[
  "......oooooo......",".....ohhHHhhho....","....ohHHHHHHho....","....ohhhhhhho.....","....oSssssssSo....","....oSgwwsgSo.....","....oGeeGseGo.....","....osssmmssso....",".....ossssso......","......oTTo........",
  ".....obbbbbo......","....obBBBBBbo.....","...obBBBBBBBbo....","...obbBBBsFFFFo...","...obBBBBoFMMFo...","....opppppp.......","....opppppp.......",".....ozzoo........",".....ooooo........",
];
const BOSS_HP=[
  ".rRR..oooooo..RRr.",".rAA.ohhHHhhho.AAr",".....ohHHHHHHho...","....ohhhhhhho.....","....oSssssssSo....","....oSgwwsgSo.....","....oGeeGseGo.....","....osssmmssso....",".....ossssso......","......oTTo........",
  ".....obbbbbo......","....obBBBBBbo.....","...TobBBBBBBoT....","...obbBBBBBBBbo...","....obBBBBBbo.....","....opppppppo.....","....opppppppo.....",".....ozzoo........",".....ooooo........",
];
const BOSS_SIT=[
  "......oooooo......",".....ohhHHhhho....","....ohHHHHHHho....","....ohhhhhhho.....","....oSssssssSo....","....oSgwwsgSo.....","....oGeeGseGo.....","....osssmmssso....",".....ossssso......","......oTTo........",
  ".....obbbbbo......","....obBBBBBbo.....","...obBBBBBBBbo....","...obbBBBBBBbbo...","....obBBBBBbo.....","....opppppppo.....","....opppppppo.....",".....ozzoo........",".....ooooo........",
];

// ═══ BG CACHE ═══
let bgImg:HTMLCanvasElement|null=null;
function buildBg(){if(typeof document==="undefined")return null!;const cv=document.createElement("canvas");cv.width=CW;cv.height=CH;const c=cv.getContext("2d")!;c.imageSmoothingEnabled=false;c.scale(SC,SC);drawStaticBg(c);return cv;}
function getBg(){if(!bgImg)bgImg=buildBg();return bgImg;}

function drawStaticBg(c:C){
  px(c,0,0,LW,20,P.ceil);for(let x=0;x<LW;x+=4)px(c,x,0,2,20,P.ceilL);
  px(c,0,19,LW,1,P.crown[1]);px(c,0,20,LW,2,P.crown[0]);px(c,0,22,LW,1,P.crown[2]);
  px(c,0,23,LW,58,P.wallD);for(let y=23;y<81;y+=8)for(let x=(y%16<8?0:4);x<LW;x+=8){px(c,x+2,y+2,4,4,P.wallP);px(c,x+3,y+3,2,2,P.wallD);}
  px(c,0,81,LW,1,P.rail[1]);px(c,0,82,LW,2,P.rail[0]);px(c,0,84,LW,1,P.rail[2]);
  px(c,0,85,LW,28,P.wainB);for(let x=4;x<LW-4;x+=36){px(c,x,88,32,20,P.wainL);px(c,x+1,89,30,18,P.wainB);px(c,x,88,32,1,P.wainH);px(c,x,88,1,20,P.wainH);px(c,x+31,88,1,20,P.wainD);px(c,x,107,32,1,P.wainD);}
  px(c,0,113,LW,1,P.base[1]);px(c,0,114,LW,3,P.base[0]);px(c,0,117,LW,1,P.base[2]);
  px(c,0,118,LW,LH-118,P.floorB);for(let y=118;y<LH;y+=6){const off=((y-118)%12<6)?0:14;for(let x=0;x<LW;x+=28)px(c,x+off,y,28,5,P.floorL);px(c,0,y,LW,1,P.floorG);}
  for(let x=0;x<LW;x+=28)px(c,x,118,1,LH-118,P.floorG);
  const rx=118,rw=86;px(c,rx,118,rw,LH-118,P.runner[0]);px(c,rx+2,118,rw-4,LH-118,P.runner[1]);px(c,rx+4,118,rw-8,LH-118,P.runner[0]);px(c,rx,118,2,LH-118,P.runner[2]);px(c,rx+rw-2,118,2,LH-118,P.runner[2]);
  drawBench(c,8,95);drawPainting(c,36,28);
}
function drawBench(c:C,bx:number,by:number){px(c,bx+2,by+16,3,12,P.crown[2]);px(c,bx+39,by+16,3,12,P.crown[2]);px(c,bx,by,44,5,P.leather[0]);px(c,bx+1,by+1,42,3,P.leather[1]);px(c,bx,by+5,44,12,P.leather[0]);px(c,bx+1,by+6,42,10,P.leather[2]);}
function drawPainting(c:C,x:number,py:number){px(c,x,py,24,16,"#2A1A10");px(c,x+1,py+1,22,14,"#332210");px(c,x+2,py+2,20,12,"#1A3050");px(c,x+4,py+10,6,4,"#2A5A28");px(c,x+12,py+8,8,6,"#2A5A28");px(c,x+8,py+4,4,4,"#E8D060");}

// ═══ BOSS ROOM ═══
function drawBossRoom(c:C,status:BossStatus,f:number,bossWalkX?:number,bossWalkY?:number){
  const rx=182,ry=23,rw=198,rh=95;
  px(c,rx,ry,rw,rh,P.roomWall);for(let y2=ry;y2<ry+rh;y2+=12)for(let x2=rx;x2<rx+rw;x2+=12)px(c,x2,y2,1,1,P.roomWallL);
  px(c,rx,ry+rh-32,rw,32,P.roomFloor);for(let x=rx;x<rx+rw;x+=18)px(c,x,ry+rh-32,1,32,"#1A1A26");

  const dkx=rx+70,dky=ry+rh-52;
  px(c,dkx,dky,56,18,P.desk);px(c,dkx+1,dky,54,3,P.deskL);px(c,dkx,dky+16,56,2,P.deskD);
  px(c,dkx+2,dky+18,4,14,P.deskD);px(c,dkx+50,dky+18,4,14,P.deskD);
  // BOSS nameplate on desk
  px(c,dkx+16,dky+4,24,8,P.brass[2]);px(c,dkx+17,dky+5,22,6,P.brass[0]);
  c.font="bold 4px monospace";c.fillStyle=P.doorF[2];c.fillText("BOSS",dkx+21,dky+10);
  const monx=dkx+14,mony=dky-14;
  px(c,monx,mony,28,14,P.monitor);px(c,monx+1,mony+1,26,12,P.monScr);px(c,monx+11,mony+14,6,3,"#333");
  if(status==="available"){px(c,monx+3,mony+3,18,2,"#4080C0");px(c,monx+3,mony+5,14,1,"#306090");for(let i=0;i<4;i++)px(c,monx+4+i*5,mony+4,3,4,"#2A4868");}
  else if(status==="busy"){const cols=["#A78BFA","#58A6FF","#4ADE80","#FB923C","#F472B6","#60D0A0"];for(let i=0;i<6;i++)px(c,monx+2,mony+2+i*2,5+(i*3)%12,1,cols[i]);if(f%8<5)px(c,monx+3+2+(f%7)*3,mony+3+(f%6),1,1,"#FFF");}
  else if(status==="in-meeting"){px(c,monx+4,mony+3,7,7,P.skin[0]);px(c,monx+16,mony+3,7,7,P.skin[0]);}

  // chair behind desk
  const chx=dkx+20,chy=dky-22;
  px(c,chx,chy+16,14,8,P.chair);px(c,chx-1,chy+14,16,3,P.chairL);px(c,chx,chy+10,14,4,P.chairD);

  if(status!=="away"){
    if(bossWalkX!==undefined&&bossWalkY!==undefined){
      spr(c,bossWalkX,bossWalkY,BOSS_SIT,BP);
    }else{
      const bx2=dkx+18,by2=dky-34;
      if(status==="busy"){spr(c,bx2,by2,BOSS_HP,BP);if(f%30<18){c.font="6px monospace";c.fillStyle=f%6<3?"#A0A0FF":"#80D080";c.fillText(["♪","♫","♬"][f%3],bx2+20+Math.sin(f*0.12)*5,by2-4+Math.cos(f*0.15)*3);}}
      else if(status==="available"){spr(c,bx2,by2+2,BOSS_COFFEE,BP);if(f%25<16){c.globalAlpha=0.5;for(let i=0;i<3;i++){const sy=by2+16-Math.floor((f*0.3+i*2)%7);px(c,bx2+14+i*2,sy,1,2,"#FFF8");}c.globalAlpha=1;}}
      else spr(c,bx2,by2+2,BOSS_SIT,BP);
    }
  }

  // plant & bookshelf & painting
  px(c,rx+10,ry+rh-28,12,12,P.pot[0]);px(c,rx+11,ry+rh-28,10,2,P.pot[1]);
  const sw2=Math.sin(f*0.04)*0.8;px(c,rx+12,ry+rh-38,5,10,P.plant[1]);px(c,rx+8+Math.round(sw2),ry+rh-46,10,9,P.plant[0]);px(c,rx+16-Math.round(sw2),ry+rh-42,9,6,P.plant[2]);
  px(c,rx+rw-20,ry+6,16,18,"#2A1A10");px(c,rx+rw-19,ry+7,14,16,"#D8D0C0");for(let i=0;i<4;i++)px(c,rx+rw-18,ry+8+i*4,12,3,"#999");
  px(c,rx+rw-46,ry+4,18,12,"#2A1A10");px(c,rx+rw-45,ry+5,16,10,"#1A3050");px(c,rx+rw-43,ry+11,6,4,"#2A5A28");px(c,rx+rw-35,ry+7,4,4,"#E8D060");

  if(status==="away"){c.fillStyle="rgba(6,10,20,0.55)";c.fillRect(rx+2,ry+2,rw-4,rh-4);c.font="bold 10px monospace";c.fillStyle="rgba(255,255,255,0.35)";c.fillText("UZAKTA",rx+rw/2-24,ry+rh/2+4);}

  // glass border
  c.strokeStyle=P.glassH;c.lineWidth=0.8;c.beginPath();c.moveTo(rx+0.5,ry);c.lineTo(rx+0.5,ry+rh);c.stroke();c.beginPath();c.moveTo(rx,ry+0.5);c.lineTo(rx+rw,ry+0.5);c.stroke();
  c.strokeStyle=P.glass;c.beginPath();c.moveTo(rx+rw-0.5,ry);c.lineTo(rx+rw-0.5,ry+rh);c.stroke();c.beginPath();c.moveTo(rx,ry+rh-0.5);c.lineTo(rx+rw,ry+rh-0.5);c.stroke();
  c.globalAlpha=0.04;c.fillStyle="#88BBDD";c.fillRect(rx+4,ry+2,36,rh-6);c.fillRect(rx+50,ry+4,20,rh-10);c.globalAlpha=1;
}

// ═══ DOOR ═══
function drawDoor(c:C,status:BossStatus,f:number,open:boolean){
  const dx=132,dy=24,dw=50,dh=90;
  px(c,dx-4,dy-4,dw+8,dh+8,P.doorF[2]);px(c,dx-3,dy-3,dw+6,dh+6,P.doorF[0]);px(c,dx-2,dy-2,dw+4,dh+4,P.doorF[1]);
  px(c,dx-4,dy-4,dw+8,2,P.doorF[3]);px(c,dx-4,dy-4,2,dh+8,P.doorF[3]);px(c,dx+dw+2,dy-4,2,dh+8,P.doorF[2]);
  let dc:string[],glow:string;
  if(status==="available"){dc=P.green;glow="rgba(42,136,84,";}else if(status==="busy"){dc=P.red;glow="rgba(200,64,64,";}else if(status==="in-meeting"){dc=P.amber;glow="rgba(208,160,48,";}else{dc=P.gray;glow="rgba(100,100,120,";}
  const pulse=0.05+Math.sin(f*0.06)*0.03;if(status!=="away"){c.fillStyle=glow+pulse+")";c.fillRect(dx-7,dy-7,dw+14,dh+14);}
  if(open){px(c,dx,dy,dw,dh,"#0E0A08");px(c,dx,dy,14,dh,dc[0]);px(c,dx,dy,14,2,dc[2]);px(c,dx,dy,2,dh,dc[2]);px(c,dx+12,dy,2,dh,dc[1]);px(c,dx+10,dy+dh/2-3,3,6,P.brass[0]);}
  else{px(c,dx,dy,dw,dh,dc[0]);px(c,dx,dy,dw,2,dc[2]);px(c,dx,dy,2,dh,dc[2]);px(c,dx+dw-2,dy,2,dh,dc[1]);px(c,dx,dy+dh-2,dw,2,dc[1]);
    for(const poy of [dy+6,dy+48])for(const pox of [dx+4,dx+dw-22]){px(c,pox,poy,18,32,dc[1]);px(c,pox+1,poy+1,16,30,dc[0]);px(c,pox+2,poy+2,14,28,dc[2]+"28");px(c,pox,poy,18,1,dc[2]);px(c,pox,poy,1,32,dc[2]);px(c,pox+17,poy,1,32,dc[1]);px(c,pox,poy+31,18,1,dc[1]);}
    const hx=dx+dw-8,hy=dy+dh/2-4;px(c,hx,hy,5,8,P.brass[2]);px(c,hx+1,hy+1,3,6,P.brass[0]);px(c,hx+2,hy+2,1,4,P.brass[1]);}
  px(c,dx-2,dy+dh+2,dw+4,2,P.brass[2]);px(c,dx,dy+dh+2,dw,1,P.brass[0]);
}
function drawNameplate(c:C,status:BossStatus){
  const nx=136,ny=14;px(c,nx,ny,42,10,P.brass[2]);px(c,nx+1,ny+1,40,8,P.brass[0]);px(c,nx+2,ny+2,38,6,P.brass[1]);
  const labels:Record<BossStatus,string>={available:"MUSAIT",busy:"MESGUL","in-meeting":"TOPLANTI",away:"UZAKTA"};
  c.font="bold 5px monospace";c.fillStyle=P.doorF[2];const t=labels[status];const tw=c.measureText(t).width;c.fillText(t,nx+(42-tw)/2,ny+7);
}

// ═══ BILLIARD TABLE (playable) ═══
const POOL={x:6,y:128,w:104,h:54};
interface PoolState{balls:Array<{x:number;y:number;vx:number;vy:number;col:string}>;cueAng:number;cuePow:number;shooting:boolean;}
function initPool():PoolState{
  const b:PoolState["balls"]=[];const cols=[P.ballR,P.ballY,P.ballB,P.ballP,P.ballO,P.ballR];
  let row=0,col=0,idx=0;
  for(let r=0;r<3;r++)for(let ci=0;ci<=r;ci++){b.push({x:POOL.x+POOL.w*0.65+r*6,y:POOL.y+POOL.h/2-r*3+ci*6,vx:0,vy:0,col:cols[idx%cols.length]});idx++;}
  b.push({x:POOL.x+POOL.w*0.28,y:POOL.y+POOL.h/2,vx:0,vy:0,col:P.ballW});
  return{balls:b,cueAng:0,cuePow:0,shooting:false};
}
let lastBHit=0;
function updatePool(ps:PoolState,f:number){
  ps.balls.forEach(b=>{b.x+=b.vx;b.y+=b.vy;b.vx*=0.97;b.vy*=0.97;
    if(b.x<POOL.x+6){b.x=POOL.x+6;b.vx=-b.vx*0.8;}if(b.x>POOL.x+POOL.w-6){b.x=POOL.x+POOL.w-6;b.vx=-b.vx*0.8;}
    if(b.y<POOL.y+6){b.y=POOL.y+6;b.vy=-b.vy*0.8;}if(b.y>POOL.y+POOL.h-6){b.y=POOL.y+POOL.h-6;b.vy=-b.vy*0.8;}
  });
  for(let i=0;i<ps.balls.length;i++)for(let j=i+1;j<ps.balls.length;j++){
    const a=ps.balls[i],b2=ps.balls[j],ddx=b2.x-a.x,ddy=b2.y-a.y,d=Math.sqrt(ddx*ddx+ddy*ddy);
    if(d<4&&d>0){const nx=ddx/d,ny=ddy/d,dvx=a.vx-b2.vx,dvy=a.vy-b2.vy,dot=dvx*nx+dvy*ny;
      if(dot>0){a.vx-=dot*nx;a.vy-=dot*ny;b2.vx+=dot*nx;b2.vy+=dot*ny;if(f-lastBHit>6){lastBHit=f;playBilliardHit();}}}
  }
}
function drawPool(c:C,f:number,active:boolean,ps:PoolState){
  const tx=POOL.x,ty=POOL.y,tw=POOL.w,th=POOL.h;
  px(c,tx+6,ty+th,4,14,P.crown[2]);px(c,tx+tw-10,ty+th,4,14,P.crown[2]);px(c,tx+6,ty+th,tw-12,2,P.crown[2]);
  px(c,tx,ty,tw,th,P.feltD);px(c,tx+4,ty+4,tw-8,th-8,P.felt);px(c,tx+5,ty+5,tw-10,th-10,P.feltL+"30");
  px(c,tx,ty,tw,4,"#2A1A10");px(c,tx,ty,4,th,"#2A1A10");px(c,tx+tw-4,ty,4,th,"#1A0E06");px(c,tx,ty+th-4,tw,4,"#1A0E06");
  px(c,tx+tw/2-2,ty,4,4,"#2A1A10");px(c,tx+tw/2-2,ty+th-4,4,4,"#2A1A10");
  for(const[cx2,cy2] of [[tx+5,ty+5],[tx+tw-7,ty+5],[tx+5,ty+th-7],[tx+tw-7,ty+th-7],[tx+tw/2-1,ty+5],[tx+tw/2-1,ty+th-7]])px(c,cx2,cy2,3,3,"#111");
  ps.balls.forEach(b=>{px(c,Math.round(b.x)-2,Math.round(b.y)-2,4,4,b.col);px(c,Math.round(b.x)-1,Math.round(b.y)-1,2,2,b.col+"88");});
  if(active){
    const cue=ps.balls[ps.balls.length-1];
    const totalV=ps.balls.reduce((s,b)=>s+Math.abs(b.vx)+Math.abs(b.vy),0);
    if(totalV<0.5){
      const dist=8+ps.cuePow*0.3;
      const ex=cue.x-Math.cos(ps.cueAng)*dist,ey=cue.y-Math.sin(ps.cueAng)*dist;
      const ex2=cue.x-Math.cos(ps.cueAng)*(dist+20),ey2=cue.y-Math.sin(ps.cueAng)*(dist+20);
      c.strokeStyle=P.cue;c.lineWidth=1.5;c.beginPath();c.moveTo(ex,ey);c.lineTo(ex2,ey2);c.stroke();
      c.strokeStyle=P.cueD;c.lineWidth=0.5;c.beginPath();c.moveTo(ex,ey);c.lineTo(ex2,ey2);c.stroke();
      c.strokeStyle="rgba(255,255,200,0.15)";c.lineWidth=0.5;c.setLineDash([2,2]);
      c.beginPath();c.moveTo(cue.x,cue.y);c.lineTo(cue.x+Math.cos(ps.cueAng)*30,cue.y+Math.sin(ps.cueAng)*30);c.stroke();c.setLineDash([]);
    }
  }
  c.font="bold 5px monospace";c.fillStyle="#7A9A88";c.fillText("BILARDO",tx+28,ty-5);
}

// ═══ PING PONG TABLE (playable) ═══
const PP={x:260,y:130,w:110,h:58};
interface PPState{ballX:number;ballY:number;bvx:number;bvy:number;p1y:number;p2y:number;score:[number,number];}
function initPP():PPState{return{ballX:PP.x+PP.w/2,ballY:PP.y+PP.h/2,bvx:1.2,bvy:0.8,p1y:PP.y+PP.h/2,p2y:PP.y+PP.h/2,score:[0,0]};}
let lastPPHit=0;
let ppScoreCallback:(()=>void)|null=null;
function updatePP(pp:PPState,f:number,upKey:boolean,downKey:boolean){
  if(upKey)pp.p1y=Math.max(PP.y+8,pp.p1y-2);
  if(downKey)pp.p1y=Math.min(PP.y+PP.h-8,pp.p1y+2);
  const target=pp.ballY+(pp.bvx>0?pp.bvy*6:0);pp.p2y+=(target-pp.p2y)*0.045;
  pp.p2y=Math.max(PP.y+8,Math.min(PP.y+PP.h-8,pp.p2y));
  pp.ballX+=pp.bvx;pp.ballY+=pp.bvy;
  if(pp.ballY<PP.y+4||pp.ballY>PP.y+PP.h-4){pp.bvy=-pp.bvy;pp.ballY=Math.max(PP.y+4,Math.min(PP.y+PP.h-4,pp.ballY));}
  if(pp.ballX<PP.x+10&&Math.abs(pp.ballY-pp.p1y)<9){pp.bvx=Math.abs(pp.bvx)*1.15;pp.bvy+=(pp.ballY-pp.p1y)*0.18;if(f-lastPPHit>4){lastPPHit=f;playPingPong();}}
  if(pp.ballX>PP.x+PP.w-10&&Math.abs(pp.ballY-pp.p2y)<9){pp.bvx=-Math.abs(pp.bvx)*1.02;pp.bvy+=(pp.ballY-pp.p2y)*0.12;if(f-lastPPHit>4){lastPPHit=f;playPingPong();}}
  pp.bvx=Math.max(-3,Math.min(3,pp.bvx));pp.bvy=Math.max(-2.5,Math.min(2.5,pp.bvy));
  if(pp.ballX<PP.x+2){pp.score[1]++;pp.ballX=PP.x+PP.w/2;pp.ballY=PP.y+PP.h/2;pp.bvx=1.2;pp.bvy=0.6;}
  if(pp.ballX>PP.x+PP.w-2){pp.score[0]++;pp.ballX=PP.x+PP.w/2;pp.ballY=PP.y+PP.h/2;pp.bvx=-1.2;pp.bvy=0.6;if(ppScoreCallback)ppScoreCallback();}
}
function drawPingPong(c:C,_f:number,active:boolean,pp:PPState){
  const tx=PP.x,ty=PP.y,tw=PP.w,th=PP.h;
  px(c,tx+tw/2-2,ty+th,5,14,P.crown[2]);
  px(c,tx,ty,tw,th,"#145028");px(c,tx+1,ty+1,tw-2,th-2,"#1A6030");
  px(c,tx,ty,tw,1,"#2A7038");px(c,tx,ty,1,th,"#2A7038");px(c,tx+tw-1,ty,1,th,"#104020");px(c,tx,ty+th-1,tw,1,"#104020");
  px(c,tx+tw/2-1,ty,3,th,"#BBB");for(let y2=ty;y2<ty+th;y2+=4)px(c,tx+tw/2-1,y2,3,2,"#DDD");
  px(c,Math.round(pp.ballX)-2,Math.round(pp.ballY)-2,4,4,P.ballW);
  px(c,tx+5,Math.round(pp.p1y)-7,5,14,"#C83838");
  px(c,tx+tw-10,Math.round(pp.p2y)-7,5,14,"#3868C0");
  if(active){c.font="bold 5px monospace";c.fillStyle="#FFF";c.fillText(`${pp.score[0]}`,tx+tw/2-12,ty-4);c.fillText(`${pp.score[1]}`,tx+tw/2+8,ty-4);}
  c.font="bold 5px monospace";c.fillStyle="#7A9A88";c.fillText("MASA TENISI",tx+24,active?ty-12:ty-5);
}

// ═══ DECORATIONS ═══
function drawSconce(c:C,sx:number,sy:number){px(c,sx,sy,7,4,"#888070");px(c,sx+1,sy-2,5,3,"#F8E8C0");c.fillStyle="rgba(248,232,192,0.04)";c.beginPath();c.arc(sx+3.5,sy+8,18,0,Math.PI*2);c.fill();}
function drawClock(c:C,cx2:number,cy2:number,f:number){px(c,cx2-7,cy2-7,14,14,P.crown[0]);px(c,cx2-6,cy2-6,12,12,"#DDD");c.fillStyle="#F0EDE4";c.beginPath();c.arc(cx2,cy2,5,0,Math.PI*2);c.fill();c.strokeStyle="#333";c.lineWidth=0.6;const ma=(f*0.008)%(Math.PI*2)-Math.PI/2;c.beginPath();c.moveTo(cx2,cy2);c.lineTo(cx2+Math.cos(ma)*3.5,cy2+Math.sin(ma)*3.5);c.stroke();const ha=(f*0.001)%(Math.PI*2)-Math.PI/2;c.lineWidth=0.8;c.beginPath();c.moveTo(cx2,cy2);c.lineTo(cx2+Math.cos(ha)*2.5,cy2+Math.sin(ha)*2.5);c.stroke();px(c,cx2,cy2,1,1,"#333");}
function drawPlant(c:C,x:number,y:number,f:number){px(c,x,y,10,8,P.pot[0]);px(c,x+1,y,8,2,P.pot[1]);const sw=Math.sin(f*0.035)*0.8;px(c,x+4,y-5,3,5,P.plant[1]);px(c,x+1+Math.round(sw),y-10,7,6,P.plant[0]);px(c,x+5-Math.round(sw),y-8,6,4,P.plant[2]);}
function drawDustMotes(c:C,f:number){c.globalAlpha=0.14;c.fillStyle="#F8E8C0";for(let i=0;i<8;i++){const mx2=(22+i*47+f*0.2*(i%3+1))%LW;const my=(32+Math.sin(f*0.02+i*2)*28+i*5);c.fillRect(Math.round(mx2),Math.round(my),1,1);}c.globalAlpha=1;}
function drawKnockWaves(c:C,f:number){for(let i=0;i<4;i++){const t=(f+i*7)%28;if(t>20)continue;c.globalAlpha=(1-t/20)*0.5;c.strokeStyle="#F8E8C0";c.lineWidth=1;c.beginPath();c.arc(157,68,5+t*2.5,0,Math.PI*2);c.stroke();}c.globalAlpha=1;}

// ═══ DIALOG & HUD ═══
function drawDialog(c:C,lines:string[],y:number,w:number){const x=Math.round((LW-w)/2)-40;const h=14+lines.length*11;px(c,x-1,y-1,w+2,h+2,"#08060C");px(c,x,y,w,h,"#12101C");px(c,x+1,y+1,w-2,h-2,"#1C1A28");px(c,x+2,y+2,w-4,1,"#3A3858");px(c,x+2,y+h-3,w-4,1,"#2A2838");c.font="bold 6px monospace";lines.forEach((l,i)=>{c.fillStyle=i===0?"#F0DCA0":"#C8C8E0";c.fillText(l,x+8,y+12+i*11);});}
function drawHUD(c:C,status:BossStatus,pName:string,mg:string){px(c,0,LH-16,LW,16,"rgba(8,6,12,0.88)");px(c,0,LH-16,LW,1,"#3A3858");const scol=status==="available"?"#30E060":status==="busy"?"#FF4444":status==="in-meeting"?"#FFD040":"#666";px(c,6,LH-11,5,5,"#222");px(c,7,LH-10,3,3,scol);const lbl:Record<BossStatus,string>={available:"Musait",busy:"Mesgul","in-meeting":"Toplantida",away:"Uzakta"};c.font="bold 6px monospace";c.fillStyle=scol;c.fillText(lbl[status],16,LH-5);c.fillStyle="#8888AA";c.fillText(pName,LW/2-30,LH-5);if(mg){c.fillStyle="#50D068";c.fillText(mg.toUpperCase(),LW-80,LH-5);}else{c.fillStyle="#555568";c.fillText("ENTER: Cal",LW-64,LH-5);}}
function drawPlayer(c:C,x:number,y:number,f:number,walking:boolean,dir:"up"|"down"|"left"|"right"){const blink=f%80>75;let frame:string[];if(dir==="up")frame=walking?eWalk(E_UP,Math.floor(f/4)):E_UP;else if(dir==="left")frame=walking?eWalk(E_LEFT,Math.floor(f/4)):E_LEFT;else if(dir==="right")frame=walking?eWalk(E_RIGHT,Math.floor(f/4)):E_RIGHT;else frame=walking?eWalk(E_DOWN,Math.floor(f/4)):(blink?E_BLINK:E_DOWN);spr(c,x-9,y-25,frame,EP);if(!walking){c.fillStyle="rgba(0,0,0,0.14)";c.beginPath();c.ellipse(x,y+1,7,3,0,0,Math.PI*2);c.fill();}}

// ═══ PROXIMITY CHECK ═══
function nearPool(px2:number,py:number):boolean{return px2>POOL.x-10&&px2<POOL.x+POOL.w+10&&py>POOL.y-14&&py<POOL.y+POOL.h+14;}
function nearPP(px2:number,py:number):boolean{return px2>PP.x-10&&px2<PP.x+PP.w+10&&py>PP.y-14&&py<PP.y+PP.h+14;}

// ═══ GAME STATE ═══
interface Spark{x:number;y:number;vx:number;vy:number;life:number;col:string;}
interface GS{px:number;py:number;walking:boolean;doorOpen:boolean;prompt:boolean;scene:"hall"|"door"|"enter";miniGame:""|"bilardo"|"pinpong";nearTable:""|"bilardo"|"pinpong";dir:"up"|"down"|"left"|"right";bossWalkX:number;bossWalkY:number;bossWalking:boolean;bossAtDoor:boolean;cueCharging:boolean;exitCooldown:number;sparks:Spark[];}
function initGS():GS{return{px:160,py:198,walking:false,doorOpen:false,prompt:false,scene:"hall",miniGame:"",nearTable:"",dir:"down",bossWalkX:-1,bossWalkY:-1,bossWalking:false,bossAtDoor:false,cueCharging:false,exitCooldown:0,sparks:[]};}

function render(c:C,gs:GS,status:BossStatus,ks:KnockState,qi:QueueInfo|null,f:number,pName:string,ps:PoolState,pp:PPState){
  c.clearRect(0,0,CW,CH);c.drawImage(getBg(),0,0);c.save();c.scale(SC,SC);
  drawBossRoom(c,status,f,gs.bossWalking?gs.bossWalkX:undefined,gs.bossWalking?gs.bossWalkY:undefined);drawDoor(c,status,f,gs.doorOpen);drawNameplate(c,status);
  drawSconce(c,90,34);drawClock(c,108,36,f);drawPlant(c,80,112,f);
  drawPool(c,f,gs.miniGame==="bilardo",ps);drawPingPong(c,f,gs.miniGame==="pinpong",pp);
  if(ks==="knocking"||ks==="waiting")drawKnockWaves(c,f);
  drawDustMotes(c,f);
  if(gs.scene!=="enter")drawPlayer(c,gs.px,gs.py,f,gs.walking,gs.dir);

  // score sparkles
  gs.sparks.forEach(s=>{c.globalAlpha=Math.max(0,s.life/20);px(c,Math.round(s.x),Math.round(s.y),2,2,s.col);px(c,Math.round(s.x)+1,Math.round(s.y)-1,1,1,"#FFF");});c.globalAlpha=1;
  if(gs.sparks.length>0){const hasText=gs.sparks[0].life>10;if(hasText){c.font="bold 7px monospace";c.fillStyle="#F0DCA0";c.fillText("GOL!",gs.px-10,gs.py-34);}}

  // billiard power bar
  if(gs.miniGame==="bilardo"&&gs.cueCharging){
    const pw=ps.cuePow;px(c,POOL.x+POOL.w+6,POOL.y,6,POOL.h,"#222");
    const barH=Math.round((pw/30)*POOL.h);px(c,POOL.x+POOL.w+7,POOL.y+POOL.h-barH,4,barH,pw<15?"#50D068":"#E04040");
    c.font="3px monospace";c.fillStyle="#AAA";c.fillText("GUC",POOL.x+POOL.w+5,POOL.y-3);
  }

  // proximity prompt
  if(gs.nearTable&&!gs.miniGame&&ks==="idle"&&gs.scene==="hall"){
    const lbl=gs.nearTable==="bilardo"?"Bilardo oynamak ister misin?":"Masa tenisi oynamak ister misin?";
    drawDialog(c,[lbl,"","  [ENTER] Evet   [ESC] Hayir"],gs.nearTable==="bilardo"?118:120,210);
  }

  if(gs.prompt&&ks==="idle"&&!gs.nearTable){
    if(status==="away") drawDialog(c,["Yonetici uzakta.","","  Lobide oyun oyna!"],140,200);
    else drawDialog(c,["Kapiyi calmak ister misiniz?","","  [ENTER] Kapiyi Cal","  [ESC]   Geri Don"],140,185);
  }
  if(ks==="waiting"){const dots=".".repeat((Math.floor(f/10)%3)+1);const lines=["Bekleniyor"+dots];if(qi)lines.push(`Sirada: ${qi.position}/${qi.totalInQueue}`);lines.push("","  [ESC] Vazgec");drawDialog(c,lines,130,200);}
  if(ks==="accepted"){if(!gs.bossAtDoor)drawDialog(c,["Yonetici kapiya geliyor..."],140,185);else drawDialog(c,["Kapi acildi!","Yonetici sizi bekliyor.","","  [ENTER] Gorusmeye Katil"],140,185);}
  if(ks==="declined") drawDialog(c,["Talebiniz reddedildi.","","  [ENTER] Tekrar dene"],140,175);
  drawHUD(c,status,pName,gs.miniGame);c.restore();
}

// ═══ COMPONENT ═══
export default function GamePage(){
  const canvasRef=useRef<HTMLCanvasElement>(null);const gsRef=useRef<GS>(initGS());
  const frameRef=useRef(0);const rafRef=useRef(0);const lastRef=useRef(0);
  const keysRef=useRef<Set<string>>(new Set());
  const poolRef=useRef<PoolState>(initPool());
  const ppRef=useRef<PPState>(initPP());

  const [name,setName]=useState("");const [nameSubmitted,setNameSubmitted]=useState(false);
  const [knockState,setKnockState]=useState<KnockState>("idle");const [knockId,setKnockId]=useState("");
  const [bossStatus,setBossStatus]=useState<BossStatus>("available");const [meetLink,setMeetLink]=useState("");
  const [queueInfo,setQueueInfo]=useState<QueueInfo|null>(null);const [chatMessages,setChatMessages]=useState<ChatMsg[]>([]);
  const [chatInput,setChatInput]=useState("");const [connected,setConnected]=useState(false);const [message,setMessage]=useState("");
  const [muted,setMuted]=useState(false);
  const toggleMute=useCallback(()=>{setMuted(prev=>{const next=!prev;globalMuted=next;return next;});},[]);

  const bossStatusRef=useRef(bossStatus);bossStatusRef.current=bossStatus;
  const knockStateRef=useRef(knockState);knockStateRef.current=knockState;
  const queueInfoRef=useRef(queueInfo);queueInfoRef.current=queueInfo;
  const nameRef=useRef(name);nameRef.current=name;

  useEffect(()=>{
    if(!nameSubmitted)return;const socket=getSocket();
    socket.on("connect",()=>setConnected(true));socket.on("disconnect",()=>setConnected(false));
    socket.on("boss-status",(s:BossStatus)=>setBossStatus(s));socket.on("knock-sent",()=>setKnockState("waiting"));
    socket.on("door-opened",(data:{meetLink:string})=>{setKnockState("accepted");setMeetLink(data.meetLink);setQueueInfo(null);
      const gs2=gsRef.current;gs2.miniGame="";
      const rx=182,rh=95,ry=23,dkx=rx+70,dky=ry+rh-52;
      gs2.bossWalkX=dkx+18;gs2.bossWalkY=dky-34;gs2.bossWalking=true;gs2.bossAtDoor=false;
    });
    socket.on("knock-declined",()=>{setKnockState("declined");setQueueInfo(null);});
    socket.on("queue-update",(q:QueueInfo)=>setQueueInfo(q));
    socket.on("chat-message",(msg:ChatMsg)=>setChatMessages(prev=>[...prev,msg]));
    if(socket.connected)setConnected(true);socket.emit("employee-join",knockId);
    return()=>{socket.off("connect");socket.off("disconnect");socket.off("boss-status");socket.off("knock-sent");socket.off("door-opened");socket.off("knock-declined");socket.off("queue-update");socket.off("chat-message");};
  },[nameSubmitted,knockId]);

  const doKnock=useCallback(()=>{if(bossStatusRef.current==="away")return;gsRef.current.miniGame="";setKnockState("knocking");playKnock();getSocket().emit("knock",{id:knockId,employeeName:nameRef.current,message:message||"",timestamp:Date.now()});setTimeout(()=>setKnockState("waiting"),500);},[knockId,message]);
  const resetKnock=useCallback(()=>{setKnockState("idle");setMeetLink("");setQueueInfo(null);setChatMessages([]);const gs=gsRef.current;gs.doorOpen=false;gs.prompt=false;gs.scene="hall";gs.py=198;gs.px=160;gs.miniGame="";gs.nearTable="";gs.dir="down";gs.bossWalking=false;gs.bossAtDoor=false;gs.bossWalkX=-1;gs.bossWalkY=-1;gs.cueCharging=false;gs.exitCooldown=0;gs.sparks=[];const id=uuidv4().split("-")[0];setKnockId(id);getSocket().emit("employee-join",id);},[]);
  const submitName=useCallback(()=>{if(!name.trim())return;setNameSubmitted(true);setKnockId(uuidv4().split("-")[0]);},[name]);

  const draw=useCallback((time:number)=>{
    rafRef.current=requestAnimationFrame(draw);if(time-lastRef.current<40)return;lastRef.current=time;frameRef.current++;
    const gs=gsRef.current;const keys=keysRef.current;const f=frameRef.current;

    // mini-game updates
    if(gs.miniGame==="bilardo"){
      if(keys.has("ArrowLeft")||keys.has("a"))poolRef.current.cueAng-=0.06;
      if(keys.has("ArrowRight")||keys.has("d"))poolRef.current.cueAng+=0.06;
      if(gs.cueCharging)poolRef.current.cuePow=Math.min(30,poolRef.current.cuePow+0.6);
      updatePool(poolRef.current,f);
    }else if(gs.miniGame==="pinpong"){
      ppScoreCallback=()=>{const cols=["#F0DCA0","#E04040","#50D068","#80B0F0","#F0A030","#E868E8"];for(let i=0;i<12;i++)gs.sparks.push({x:gs.px,y:gs.py-10,vx:(Math.random()-0.5)*3,vy:-Math.random()*2.5-0.5,life:20,col:cols[i%cols.length]});};
      updatePP(ppRef.current,f,keys.has("ArrowUp")||keys.has("w"),keys.has("ArrowDown")||keys.has("s"));
    }else{
      const speed=2;let mx=0,my=0;
      if(gs.scene==="hall"&&knockStateRef.current==="idle"){
        if(keys.has("ArrowLeft")||keys.has("a")){mx=-speed;gs.dir="left";}
        if(keys.has("ArrowRight")||keys.has("d")){mx=speed;gs.dir="right";}
        if(keys.has("ArrowUp")||keys.has("w")){my=-speed;gs.dir="up";}
        if(keys.has("ArrowDown")||keys.has("s")){my=speed;gs.dir="down";}
      }
      if(mx||my){gs.walking=true;gs.px=Math.max(18,Math.min(LW-18,gs.px+mx));gs.py=Math.max(130,Math.min(LH-24,gs.py+my));}
      else if(gs.walking&&gs.scene==="hall")gs.walking=false;
    }

    // proximity detection (skip during cooldown after exiting a game)
    if(gs.scene==="hall"&&!gs.miniGame&&knockStateRef.current==="idle"&&gs.exitCooldown<=0){
      if(nearPool(gs.px,gs.py))gs.nearTable="bilardo";
      else if(nearPP(gs.px,gs.py))gs.nearTable="pinpong";
      else gs.nearTable="";
    }

    // sparks update
    gs.sparks.forEach(s=>{s.x+=s.vx;s.y+=s.vy;s.vy+=0.08;s.life--;});gs.sparks=gs.sparks.filter(s=>s.life>0);
    // exit cooldown
    if(gs.exitCooldown>0)gs.exitCooldown--;
    // footstep
    if(gs.walking&&gs.scene==="hall"&&!gs.miniGame)playFootstep(f);

    // boss walk-to-door animation
    if(gs.bossWalking&&!gs.bossAtDoor){
      const targetX=184,targetY=80;
      gs.bossWalkX+=(targetX-gs.bossWalkX)*0.08;gs.bossWalkY+=(targetY-gs.bossWalkY)*0.08;
      if(Math.abs(gs.bossWalkX-targetX)<2&&Math.abs(gs.bossWalkY-targetY)<2){gs.bossAtDoor=true;gs.doorOpen=true;}
    }
    // celebration countdown
    if(gs.celebrateT>0)gs.celebrateT--;

    if(gs.scene==="door"&&!gs.prompt){gs.walking=true;gs.dir="up";gs.px+=(157-gs.px)*0.12;if(gs.py>134)gs.py-=3;else{gs.prompt=true;gs.walking=false;gs.dir="up";}}
    if(gs.scene==="enter"&&gs.py>70){gs.py-=4;gs.walking=true;gs.dir="up";}
    if(gs.py<136&&gs.scene==="hall"&&gs.px>120&&gs.px<195&&!gs.nearTable)gs.scene="door";

    const canvas=canvasRef.current;if(!canvas)return;const ctx=canvas.getContext("2d");if(!ctx)return;
    ctx.imageSmoothingEnabled=false;
    render(ctx,gs,bossStatusRef.current,knockStateRef.current,queueInfoRef.current,f,nameRef.current,poolRef.current,ppRef.current);
  },[]);

  useEffect(()=>{if(!nameSubmitted)return;rafRef.current=requestAnimationFrame(draw);return()=>cancelAnimationFrame(rafRef.current);},[draw,nameSubmitted]);

  useEffect(()=>{
    if(!nameSubmitted)return;
    const down=(e:KeyboardEvent)=>{
      keysRef.current.add(e.key);const gs=gsRef.current;const ks=knockStateRef.current;
      if(e.key===" "||e.key==="Enter"){e.preventDefault();
        if(gs.miniGame==="bilardo"){const tv=poolRef.current.balls.reduce((s,b)=>s+Math.abs(b.vx)+Math.abs(b.vy),0);if(tv<0.5)gs.cueCharging=true;return;}
        if(gs.nearTable&&!gs.miniGame&&ks==="idle"){gs.miniGame=gs.nearTable;gs.nearTable="";if(gs.miniGame==="bilardo"){poolRef.current=initPool();gs.cueCharging=false;playBilliardHit();}else{ppRef.current=initPP();playPingPong();}return;}
        if(ks==="idle"){if(gs.prompt&&bossStatusRef.current!=="away")doKnock();else if(gs.scene==="hall"&&!gs.nearTable){gs.scene="door";gs.miniGame="";}}
        else if(ks==="accepted"){if(meetLink)window.open(meetLink,"_blank");resetKnock();}
        else if(ks==="declined")resetKnock();
      }
      if(e.key==="Escape"){if(gs.miniGame){gs.miniGame="";gs.nearTable="";gs.cueCharging=false;gs.exitCooldown=20;return;}if(gs.nearTable){gs.nearTable="";gs.exitCooldown=20;return;}if(ks==="idle"&&gs.prompt){gs.prompt=false;gs.scene="hall";gs.py=198;gs.dir="down";}else if(ks==="waiting")resetKnock();}
    };
    const up=(e:KeyboardEvent)=>{keysRef.current.delete(e.key);
      if((e.key===" "||e.key==="Enter")&&gsRef.current.miniGame==="bilardo"&&gsRef.current.cueCharging){
        const ps=poolRef.current,cue=ps.balls[ps.balls.length-1];
        const tv=ps.balls.reduce((s,b)=>s+Math.abs(b.vx)+Math.abs(b.vy),0);
        if(tv<0.5){const pw=Math.max(3,ps.cuePow);cue.vx=Math.cos(ps.cueAng)*(0.8+pw*0.14);cue.vy=Math.sin(ps.cueAng)*(0.8+pw*0.14);playBilliardHit();}
        ps.cuePow=0;gsRef.current.cueCharging=false;}
    };
    window.addEventListener("keydown",down);window.addEventListener("keyup",up);
    return()=>{window.removeEventListener("keydown",down);window.removeEventListener("keyup",up);};
  },[nameSubmitted,doKnock,resetKnock,meetLink]);

  const handleCanvasClick=useCallback((e:React.MouseEvent<HTMLCanvasElement>)=>{
    const canvas=canvasRef.current;if(!canvas)return;const rect=canvas.getBoundingClientRect();
    const cx=(e.clientX-rect.left)*(LW/rect.width);const cy=(e.clientY-rect.top)*(LH/rect.height);
    const gs=gsRef.current;const ks=knockStateRef.current;
    if(gs.miniGame==="bilardo"){const ps2=poolRef.current,cue=ps2.balls[ps2.balls.length-1];const tv=ps2.balls.reduce((s,b)=>s+Math.abs(b.vx)+Math.abs(b.vy),0);if(tv<0.5){ps2.cueAng=Math.atan2(cy-cue.y,cx-cue.x);cue.vx=Math.cos(ps2.cueAng)*2.5;cue.vy=Math.sin(ps2.cueAng)*2.5;ps2.cuePow=0;gs.cueCharging=false;playBilliardHit();}return;}
    if(cy<120&&cx>120&&cx<195){if(ks==="idle"&&gs.scene==="hall"&&!gs.nearTable){gs.scene="door";gs.miniGame="";}else if(ks==="idle"&&gs.prompt&&bossStatusRef.current!=="away")doKnock();}
    if(ks==="accepted"){if(meetLink)window.open(meetLink,"_blank");resetKnock();}
    if(ks==="declined")resetKnock();
  },[doKnock,resetKnock,meetLink]);

  const sendChat=useCallback(()=>{if(!chatInput.trim())return;getSocket().emit("employee-chat",{knockId,text:chatInput.trim()});setChatMessages(prev=>[...prev,{from:"employee",text:chatInput.trim(),timestamp:Date.now()}]);setChatInput("");},[chatInput,knockId]);

  if(!nameSubmitted)return(
    <div className="min-h-screen bg-[#12101C] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8"><div className="inline-block px-4 py-1.5 bg-[#1C1A28] border border-[#3A3858] rounded text-[#F0DCA0] text-xs font-mono tracking-widest mb-4">OYUN MODU</div><h1 className="text-3xl font-bold text-[#E8E4F0] font-mono tracking-tight">Knock The Door</h1><p className="text-sm text-[#6A6888] font-mono mt-2">Yoneticinin odasina girin</p></div>
        <div className="bg-[#1C1A28] border-2 border-[#3A3858] rounded-xl p-8 shadow-2xl">
          <label className="block text-[#F0DCA0] text-xs font-mono mb-2 tracking-wider">ADINIZ</label>
          <input type="text" value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submitName()} placeholder="Adinizi girin..." className="w-full bg-[#12101C] border-2 border-[#3A3858] rounded-lg px-4 py-3 text-[#E8E4F0] font-mono text-sm placeholder:text-[#444] focus:border-[#5A5880] focus:outline-none" autoFocus/>
          <label className="block text-[#F0DCA0] text-xs font-mono mb-2 mt-5 tracking-wider">MESAJ (opsiyonel)</label>
          <input type="text" value={message} onChange={e=>setMessage(e.target.value)} placeholder="Gorusme konusu..." className="w-full bg-[#12101C] border-2 border-[#3A3858] rounded-lg px-4 py-3 text-[#E8E4F0] font-mono text-sm placeholder:text-[#444] focus:border-[#5A5880] focus:outline-none"/>
          <button onClick={submitName} disabled={!name.trim()} className="w-full mt-6 bg-[#2A5A34] hover:bg-[#3A7A44] disabled:bg-[#222] disabled:text-[#444] text-[#C8E8D0] font-mono text-sm py-3 rounded-lg border-2 border-[#4A8A54] disabled:border-[#333] transition-all tracking-wider">OYUNA BASLA</button>
        </div>
        <div className="text-center mt-8"><Link href="/" className="text-[#5A5878] hover:text-[#8888AA] font-mono text-xs">← Ana Sayfa</Link></div>
      </div>
    </div>
  );

  return(
    <div className="min-h-screen bg-[#12101C] flex flex-col">
      <nav className="bg-[#1C1A28] border-b-2 border-[#3A3858] px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3"><Link href="/" className="text-[#5A5878] hover:text-[#8888AA]"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></Link><span className="text-[#F0DCA0] font-mono text-xs tracking-widest">KNOCK THE DOOR</span><span className="text-[#3A3858]">|</span><span className="text-[#8888AA] font-mono text-xs">{name}</span></div>
        <div className="flex items-center gap-3">
          <button onClick={toggleMute} className="text-[#8888AA] hover:text-[#F0DCA0] font-mono text-xs flex items-center gap-1 px-2 py-1 rounded border border-[#3A3858] hover:border-[#5A5880] transition-colors" title={muted?"Sesi Ac":"Sesi Kapat"}>
            {muted?<svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>:<svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>}
            <span>{muted?"KAPALI":"ACIK"}</span>
          </button>
          <div className={`w-2 h-2 rounded-full ${connected?"bg-emerald-400":"bg-red-400"}`}/><span className="text-[#5A5878] font-mono text-xs">{connected?"Bagli":"Baglaniyor..."}</span>
        </div>
      </nav>
      <div className="flex-1 flex flex-col items-center justify-start p-2 pt-1">
        <canvas ref={canvasRef} width={CW} height={CH} onClick={handleCanvasClick} className="w-full border-2 border-[#3A3858] rounded-lg cursor-pointer shadow-2xl" style={{imageRendering:"pixelated",maxWidth:"1520px",aspectRatio:`${LW}/${LH}`}} tabIndex={0}/>
        {(knockState==="waiting"||knockState==="accepted")&&chatMessages.length>0&&(
          <div className="max-w-[960px] w-full mt-3 bg-[#1C1A28] border-2 border-[#3A3858] rounded-lg p-4"><div className="text-[#F0DCA0] font-mono text-xs mb-2 tracking-wider">SOHBET</div><div className="max-h-32 overflow-y-auto space-y-1.5 mb-3">{chatMessages.map((msg,i)=>(<div key={i} className={`font-mono text-xs ${msg.from==="boss"?"text-[#F0C030]":"text-[#6898E0]"}`}>{msg.from==="boss"?"Yonetici":"Siz"}: {msg.text}</div>))}</div><div className="flex gap-2"><input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendChat()} placeholder="Mesaj yaz..." className="flex-1 bg-[#12101C] border border-[#3A3858] rounded-lg px-3 py-2 text-[#E8E4F0] font-mono text-xs placeholder:text-[#444] focus:outline-none focus:border-[#5A5880]"/><button onClick={sendChat} className="bg-[#2A5A34] hover:bg-[#3A7A44] text-[#C8E8D0] font-mono text-xs px-4 py-2 rounded-lg border border-[#4A8A54]">Gonder</button></div></div>
        )}
        <p className="text-[#3A3858] font-mono text-[10px] tracking-wider mt-2">WASD HAREKET · ←→ ISTAKA · SPACE BASILI TUT VE BIRAK VURUS · ESC GERI</p>
      </div>
    </div>
  );
}
