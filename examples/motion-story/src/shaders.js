import { PC, PR, NP, HELD } from "./geo.js";

// ---------- shaders ----------
const H = `#version 300 es
precision highp float;precision highp int;precision highp sampler2DArray;precision highp sampler3D;
float ss(float a,float b,float x){float t=clamp((x-a)/(b-a),0.,1.);return t*t*(3.-2.*t);}
float sq(float x){return x*x;}
vec3 ss3(vec3 a,vec3 b,vec3 x){vec3 t=clamp((x-a)/max(b-a,vec3(1e-5)),0.,1.);return t*t*(3.-2.*t);}
float hs(float n){uint x=floatBitsToUint(n);x^=x>>16;x*=0x7feb352du;x^=x>>15;x*=0x846ca68bu;x^=x>>16;return float(x>>8)/16777216.;}
float rt(float x){return sqrt(max(x,1e-7));}
float pw(float x,float y){return pow(max(x,1e-6),y);}
`;
const FRAME = `uniform vec4 uFrame[14];
#define uVP mat4(uFrame[0],uFrame[1],uFrame[2],uFrame[3])
#define uEye uFrame[4].xyz
#define uT uFrame[4].w
#define uMix uFrame[5].x
#define uLocal uFrame[5].y
#define uGrow uFrame[5].z
#define uPy uFrame[5].w
#define uFogA uFrame[6].x
#define uFogB uFrame[6].y
#define uRes uFrame[6].zw
#define uRight uFrame[7].xyz
#define uTan uFrame[7].w
#define uUpV uFrame[8].xyz
#define uAsp uFrame[8].w
#define uFwd uFrame[9].xyz
#define uHaze uFrame[9].w
#define uCore uFrame[10].xyz
#define uCoreR uFrame[10].w
#define uCoreC uFrame[11].xyz
#define uCoreP uFrame[11].w
#define uFlash uFrame[12].x
#define uSeason uFrame[12].y
#define uHeadU uFrame[12].z
#define uPhi0 uFrame[12].w
#define uFrom int(uFrame[13].x)
#define uTo int(uFrame[13].y)
float pr(int k){return uFrom==k?(uTo==k?1.:1.-uMix):uTo==k?uMix:0.;}
float fog(float d){return 1.-ss(uFogA,uFogB,d);}
const vec3 PC=vec3(${PC.join(",")}.);
// the storm: a rope that widens into the cloud, bends, and turns one way on one law
float fun(float h){float q=h*h;return .42+1.25*h+1.5*q+10.2*q*q*h;}
vec2 bend(float h){return vec2(sin(h*3.4+uT*.26)*3.1+sin(h*6.1-uT*.21)*.5,cos(h*2.9+uT*.21)*2.2)*h*(1.4-.95*h)+vec2(sin(uT*.17)*1.1,cos(uT*.13)*.8)*(1.-h);}
vec3 storm(float a,float h,float out_){float r=fun(h)+out_;vec2 b=bend(clamp(h,0.,1.));return vec3(cos(a)*r+b.x,-7.35+h*21.,sin(a)*r+b.y);}
vec3 rY(vec3 p,float a){float c=cos(a),s=sin(a);return vec3(c*p.x+s*p.z,p.y,c*p.z-s*p.x);}
vec3 rZ(vec3 p,float a){float c=cos(a),s=sin(a);return vec3(c*p.x-s*p.y,s*p.x+c*p.y,p.z);}
`;
const LIVE = `
float wave(vec2 q){return sin(q.x*.21+uT*.55)*.55+sin(q.y*.27-uT*.7+q.x*.09)*.5+sin((q.x+q.y)*.55+uT*1.1)*.17+sin(q.x*1.1-q.y*.8+uT*1.7)*.07;}
vec3 sway(vec3 p){float h=max(p.y+7.,0.);p.x+=sin(uT*.6+p.z*.2+h*.2)*.011*h;p.z+=cos(uT*.5+p.x*.2)*.011*h;return p;}
// The motion a formation has of its own. s<0: rigid (a stream, a page, a line).
vec3 live(int k,vec4 f,float s){vec3 p=f.xyz;
 if(k==0&&f.w>1.5){float ph=fract(uT*(.22+.2*s)+f.z),v=2.2+5.2*f.y;vec2 d=vec2(cos(f.x),sin(f.x));vec3 b=f.w<2.5?vec3(-12.2,0.,-13.4):vec3(12.2,0.,-16.2);p=b+vec3(d.x*(.5+ph*v*.62),v*1.7*ph-8.*ph*ph,d.y*(.4+ph*v*.4));}
 else if(k==0){if(s>=-.5)p.y+=wave(p.xz)*(p.y<1.8?1.:.3)+(s>=0.?.06:0.);}
 else if(k==1){ // (angle, height, distance from the wall); w says which part
  if(s<-.5)p=storm(p.x-uT*.8,p.y,p.z);
  else if(s<0.){p=storm(p.x-uT*(.42+.6*(1.-p.y)),p.y,p.z+sin(uT*.5+p.x*3.)*.12);}
  else if(f.w>=0.){float h=fract(p.y+uT*.02*(.5+s));p=storm(p.x-uT*(.55+1.5*(1.-h)*(1.-h)),h,p.z*(.35+1.1*h));}
  else if(f.w>-1.5){float r=p.z;float a=p.x-uT*2.6/(.8+r*.5);vec2 b=bend(0.);p=vec3(cos(a)*r+b.x,-7.35+p.y*(.6+.4*sin(uT*.7+s*30.)),sin(a)*r+b.y);}
  else if(f.w>-2.5){float a=p.x-uT*.15;p=vec3(cos(a)*p.z,13.9+p.y,sin(a)*p.z);}
  else p=rY(p,-uT*.05);}
 else if(k==2){p=rY(p,uT*.05);if(s>=0.)p+=vec3(sin(uT+s*40.),cos(uT*.8+s*60.),sin(uT*.7+s*80.))*.06;}
 else if(k==3){float r=length(p.xy);if(s<-1.5||(s>=0.&&abs(p.z)<.8&&r>4.2)){float t=clamp((r-4.35)/6.05,0.,1.),hold=uFrom==3?ss(.5,.6,uLocal)*(1.-.35*ss(.62,.8,uLocal)):0.;float d=(1.-t)*(1.-t)*(.2*sin(uT*.7)+.1*sin(uT*1.9+1.)-1.*hold);float a=.02*sin(r*1.4-uT*.6+atan(p.y,p.x+1e-6)*5.)*(1.-t)+uT*.012;p.xy*=(r+d)/max(r,.01);p=rZ(p,a);}else if(s>=0.){if(abs(p.z)>.8)p.z=mod(p.z+46.+uT*(1.5+s*2.5),70.)-46.;else p.z+=sin(r*1.6-uT*2.4)*.16;}}
 else if(k==4){if(s>=0.&&f.w>1.1){if(f.w<2.){p+=vec3(sin(uT*.31+s*61.),sin(uT*.43+s*37.),cos(uT*.27+s*83.))*1.3;}else{p.y+=mod(uT*(.12+.2*s)+s*9.,3.);p.x+=sin(uT*.4+s*30.)*.5;}}
  else if(s>=0.&&f.w>.5&&fract(s*47.3)<.2*uSeason){float q=fract(uT*.04+s*13.);p.y=mix(p.y,-7.2,q);p.x+=sin(q*9.+s*40.)*1.2+q*1.6;p.z+=cos(q*7.+s*20.)*.8;}else p=sway(p);}
 else{p=PC+rY(p-PC,uT*.006);}
 if(k==5)p.y+=uPy;return p;}
`;
const NOISE = `uniform sampler3D uNoise;
float ns(vec3 p){vec3 i=floor(p),f=p-i;f=f*f*(3.-2.*f);return textureLod(uNoise,(i+f+.5)/32.,0.).r;}
float fbm(vec3 p){return ns(p)*.55+ns(p*2.03+7.1)*.28+ns(p*4.1+3.7)*.17;}
`;
const HAIR = `
float hair(float d,float px){float w=max(fwidth(d),1e-5);return 1.-ss(w*px*.5,w*(px*.5+1.),abs(d));}
float lines(float x,float px){float w=max(fwidth(x),1e-5),d=abs(fract(x+.5)-.5);return (1.-ss(w*px*.5,w*(px*.5+1.),d))*(1.-ss(.25,.6,w));}
float band(float r,float a,float b){float w=max(fwidth(r),1e-5);return ss(a-w,a+w,r)*(1.-ss(b-w,b+w,r));}
float h1(float n){return hs(n+.37);}float h2(vec2 p){return hs(p.x+hs(p.y+.71)*977.);}
`;
// Interleaved gradient noise: a dissolve without blending, so a solid thing can still fade.
const DITHER = `float ign(vec2 p){return fract(52.9829189*fract(dot(p,vec2(.06711056,.00583715))));}
`;
const QUAD = `${H}layout(location=0)in vec2 aQ;out vec2 u;void main(){u=aQ*.5+.5;gl_Position=vec4(aQ,0,1);}`;
export const SH = {
  points: [
    `${H}${FRAME}${LIVE}
uniform sampler2DArray uForm;uniform float uSize,uFocus,uBlur;uniform vec3 uA[6],uB[6],uC[6];uniform float uPow[6];
layout(location=0)in float aId;out vec3 vC;out float vSoft;
vec4 at(int k){return texelFetch(uForm,ivec3(int(aId)&255,int(aId)>>8,k),0);}
vec3 tint(int k,vec4 f,vec3 p,float s,float s2){
 vec3 c=mix(uA[k],uB[k],s*s);float spark=step(.978,s2);c=mix(c,uC[k]*2.6,spark);
 if(k==0){float d=abs(p.x-uCore.x)/(1.6+max(uEye.z-p.z,0.)*.075);float gl=exp(-d*d)*ss(.15,.95,wave(p.xz*1.7)*.5+.5);float crest=ss(.2,1.1,wave(p.xz));c*=.4+1.4*crest;c+=uC[0]*gl*(.7+2.*step(.8,s2));c*=f.y>.01?.5:1.;if(f.w>1.5){float q=uPhi0-(f.w<2.5?.44:2.7);c=mix(vec3(.5,.8,1.),vec3(1.),s)*(.25+.9*s2)*ss(-.05,.25,q)*ss(1.7,.9,q)*(p.y<-.1?0.:1.)*1.2;}}
 if(k==1){c=mix(c,vec3(.95,.16,.42),step(.86,s2)*step(s2,.92)*.7);c=mix(c,min(c,vec3(1.1)),.75);c*=f.w>=0.?.2+.6*f.w:f.w>-1.5?.95:f.w>-2.5?.3:.5;c*=1.+uFlash*1.6;}
 if(k==3&&abs(p.z)>.9){c=mix(vec3(.95,.16,.14),vec3(.1,.85,.55),ss(-.5,.8,p.z))*(.3+.4*s);}
 if(k==2){c=mix(c,vec3(1.,.72,.34),step(.62,s2)*step(s2,.9)*.85);float on=ss(uCore.y+2.,uCore.y-3.,p.y);c*=.25+1.1*on+1.8*exp(-sq((p.y-uCore.y)*.4));}
 if(k==4){vec3 q=p-uCore;float lit=1./(1.+dot(q,q)*.05);float leaf=ss(.5,.9,f.w);vec3 sum=mix(uB[4],vec3(1.,.66,.2),max(step(.75,s2),uSeason));c=mix(c,sum,leaf*.8)*(.35+2.2*lit);
  if(f.w>1.1&&f.w<2.){float b=sin(uT*(1.1+s)+s2*40.);c=vec3(1.,.78,.3)*(.12+3.2*ss(.5,1.,b))*step(.45,s);}else if(f.w>=2.)c=vec3(.2,.8,.55)*.5*(1.-ss(1.,3.2,p.y+7.));}
 if(k==5){c=mix(uA[5]*.35,mix(uB[5],uC[5],s2*s2),ss(.3,.7,f.w))*(f.w>.3?1.:.3);}
 return c*uPow[k];}
float grown(int k,float w){if(k!=4)return 1.;if(w>1.1)return ss(.45,.95,uGrow);return ss(w-.06,w+.01,uGrow);}
void main(){float s=hs(aId+.5),s2=hs(aId+40000.5),s3=hs(aId+80000.5);
 vec4 f=at(uFrom),g=at(uTo);vec3 p=live(uFrom,f,s),q=live(uTo,g,s);
 float m=clamp(uMix*1.55-s3*.55,0.,1.);m=m*m*m*(m*(m*6.-15.)+10.);
 vec3 x=mix(p,q,m);float arc=sin(3.14159*m);vec3 n=vec3(sin(x.y*.35+s*9.+uT*.3)+cos(x.z*.3+s2*5.),sin(x.x*.3+s2*9.)+cos(x.y*.25+s*7.),cos(x.x*.28+s3*8.)+sin(x.z*.33+uT*.2));
 x+=n*arc*2.2;x=mix(x,rY(x,arc*.5*(s-.2)),arc);
 vec3 c=mix(tint(uFrom,f,p,s,s2)*grown(uFrom,f.w),tint(uTo,g,q,s,s2)*grown(uTo,g.w),m)*(1.+arc*.5);
 float tw=.7+.3*sin(uT*(1.+3.*s)+s2*40.);
 gl_Position=uVP*vec4(x,1.);float d=gl_Position.w;
 float base=uRes.y*uSize*(.55+.9*s2*s2+1.4*step(.992,s2))/max(d,.3),coc=abs(d-uFocus)/max(d,1.)*uBlur*uRes.y;
 float sz=base+coc;float vis=min(1.,(base*base+1.)/(sz*sz+1.)*1.5);float px=max(sz,1.4);
 vC=c*tw*vis*fog(d)*min(1.,base/1.4+.15)*ss(.3,2.,d);vSoft=clamp(coc/max(sz,.01),0.,1.);vC*=ss(1.,6.5,d);
 gl_PointSize=min(px*2.2,uRes.y*.07);if(d<.2||dot(vC,vC)<1e-6)gl_Position=vec4(2,2,2,1);}`,
    `${H}in vec3 vC;in float vSoft;out vec4 o;void main(){vec2 q=gl_PointCoord*2.-1.;float r=dot(q,q);if(r>1.)discard;float q1=1.-rt(r),halo=q1*q1*.62,core=ss(.66,1.,q1)*.75;float d=ss(1.,.6,r)*.2;o=vec4(vC*mix(halo+core,d,vSoft),1.);}`,
  ],
  streams: [
    `${H}${FRAME}${LIVE}
uniform sampler2DArray uLine;uniform float uWidth;uniform vec3 uSc[6],uSh[6];uniform float uSp[6],uRest[6];
layout(location=0)in vec2 aV;out float vU,vSide,vA;out vec3 vC,vHc;out float vHead,vRest;out float vS;
vec3 get(int k,int i){vec4 p=vec4(texelFetch(uLine,ivec3(i,gl_InstanceID,k),0).xyz,0.);return live(k,p,k==3&&gl_InstanceID<4?0.:-1.);}
vec3 at(int i,float s){float m=clamp(uMix*1.6-s*.6,0.,1.);m=m*m*(3.-2.*m);vec3 a=get(uFrom,i);if(m<=0.)return a;return mix(a,get(uTo,i),m)+sin(vec3(1.,1.7,2.3)*float(i)*.11+s*20.)*sin(3.14159*m)*2.4;}
void main(){int i=int(aV.x);float s=hs(float(gl_InstanceID)+.3);vec3 a=at(max(i-1,0),s),p=at(i,s),b=at(min(i+1,${NP - 1}),s);
 vec4 c=uVP*vec4(p,1.),ca=uVP*vec4(a,1.),cb=uVP*vec4(b,1.);vec2 ar=vec2(uAsp,1.);vec2 t=cb.xy/max(cb.w,.1)*ar-ca.xy/max(ca.w,.1)*ar;float tl=length(t);t=tl>1e-5?t/max(tl,1e-5):vec2(1,0);
 float w=max(uWidth*(.4+1.1*s)*uRes.y/max(c.w,.5),1.5);c.xy+=vec2(-t.y,t.x)/ar*aV.y*w/uRes.y*2.*c.w;
 vU=float(i)/${NP - 1}.;vSide=aV.y;vS=s;float rv=uHeadU*1.5-s*.45;vHead=exp(-sq((vU-rv)*22.))*step(rv,1.02);float shown=ss(rv+.01,rv-.03,vU);float g=1.;if(uTo==4||uFrom==4){float gr=ss(vU-.12,vU,uGrow*1.05);g=mix(uFrom==4?gr:1.,uTo==4?gr:1.,uMix);}
 vA=fog(c.w)*g*mix(.25,1.,shown)*ss(1.5,5.5,c.w)*min(1.,w/2.2)*ss(0.,.06,vU)*(uTo==0&&uFrom==0?1.:ss(1.,.94,vU)*.999+.001);vC=mix(uSc[uFrom],uSc[uTo],uMix);vHc=mix(uSh[uFrom],uSh[uTo],uMix);vA*=mix(uSp[uFrom],uSp[uTo],uMix);vRest=mix(uRest[uFrom],uRest[uTo],uMix);
 if(min(ca.w,min(c.w,cb.w))<.15)c=vec4(2,2,2,1);gl_Position=c;}`,
    `${H}${FRAME}in float vU,vSide,vA;in vec3 vC,vHc;in float vHead,vRest;in float vS;out vec4 o;void main(){float e=1.-abs(vSide);e*=rt(e);float x=fract(vU*1.4-uT*(.07+.1*vS)+vS*7.);float pulse=x*x*x;pulse*=pulse;pulse*=pulse*ss(1.,.985,x);float x2=fract(vU*2.3-uT*(.05+.06*vS)+vS*3.);float p2=pw(x2,26.)*ss(1.,.98,x2);o=vec4((vC*(vRest+.06*sin(vU*40.+uT))+(vC*1.2+vHc*1.6)*pulse*2.6+vHc*p2*1.4+(vC+vHc)*vHead*2.2)*e*vA,1.);}`,
  ],
  // every hairline: instanced segments widened on screen, lit in the order they carry
  seg: [
    `${H}${FRAME}${LIVE}
uniform int uKS;uniform float uRigid,uReveal,uA,uPick,uPulse;
layout(location=0)in vec2 aQ;layout(location=1)in vec4 aA;layout(location=2)in vec4 aB;layout(location=3)in vec4 aC;layout(location=4)in float aS;out vec3 vC;out float vSide,vG,vS;
void main(){vec3 a=aA.xyz,b=aB.xyz;if(uKS>=0){a=live(uKS,vec4(a,0.),uRigid);b=live(uKS,vec4(b,0.),uRigid);}
 vec4 ca=uVP*vec4(a,1.),cb=uVP*vec4(b,1.),c=aQ.x<0.?ca:cb;vec2 ar=vec2(uAsp,1.),t=cb.xy/max(cb.w,.1)*ar-ca.xy/max(ca.w,.1)*ar;float tl=length(t);t=tl>1e-6?t/max(tl,1e-6):vec2(1,0);
 float px=aC.w*uRes.y/max(c.w,.4),w=max(px,1.3);c.xy+=vec2(-t.y,t.x)/ar*aQ.y*w/uRes.y*2.*c.w+t/ar*aQ.x*.6/uRes.y*c.w;vSide=aQ.y;vS=aS;vG=aQ.x<0.?aA.w:aB.w;
 vC=aC.rgb*uA*fog(c.w)*ss(1.2,4.,c.w)*min(1.,px/1.3+.12);
 if(min(ca.w,cb.w)<.15||uA<=.003||min(aA.w,aB.w)>uReveal+.02||(uPick>=0.&&abs(aS-uPick)>.1))c=vec4(2,2,2,1);gl_Position=c;}`,
    `${H}${FRAME}uniform float uReveal,uPulse;in vec3 vC;in float vSide,vG,vS;out vec4 o;void main(){float e=1.-abs(vSide);e*=rt(e);float on=1.-ss(uReveal-.01,uReveal,vG);float hd=(uReveal-vG)*26.;float head=exp(-hd*hd)*step(uReveal,1.05);float x=fract(vG*1.7-uT*.16+vS*9.);x*=x;x*=x;x*=x;o=vec4(vC*e*on*(1.+head*5.+x*x*uPulse),1.);}`,
  ],
  panels: [
    `${H}${FRAME}${LIVE}
uniform sampler2DArray uPane;uniform vec3 uGc[6];uniform float uGp[6];
layout(location=0)in vec2 aQ;out vec2 vQ;out vec3 vC;out float vA,vSeed,vFace,vPass,vZ,vWarm;
mat3 turn(vec3 e){float a=cos(e.x),b=sin(e.x),c=cos(e.y),d=sin(e.y),f=cos(e.z),g=sin(e.z);return mat3(a,0,-b,0,1,0,b,0,a)*mat3(1,0,0,0,c,d,0,-d,c)*mat3(f,g,0,-g,f,0,0,0,1);}
void main(){float id=float(gl_InstanceID),s=hs(id+.7);bool held=gl_InstanceID==${HELD};vec4 A=texelFetch(uPane,ivec3(gl_InstanceID,0,uFrom),0),B=texelFetch(uPane,ivec3(gl_InstanceID,0,uTo),0);vec3 ea=texelFetch(uPane,ivec3(gl_InstanceID,1,uFrom),0).xyz,eb=texelFetch(uPane,ivec3(gl_InstanceID,1,uTo),0).xyz;
 vec3 a=A.xyz,b=B.xyz;if(uFrom==3&&!held)a.z=mod(a.z+44.+uT*1.3,68.4)-44.;if(uTo==3&&!held)b.z=mod(b.z+44.+uT*1.3,68.4)-44.;if(held){if(uFrom==3)a=vec3(-3.,1.7,.35);if(uTo==3)b=vec3(-3.,1.7,.35);}
 a=live(uFrom,vec4(a,0.),uFrom<2?-.2:-1.);b=live(uTo,vec4(b,0.),uTo<2?-.2:-1.);
 if(uFrom==1)ea+=vec3(uT*.6*(s-.3),uT*.4*(s-.5),uT*.3*(s-.6));if(uTo==1)eb+=vec3(uT*.6*(s-.3),uT*.4*(s-.5),uT*.3*(s-.6));if(uFrom==2)ea.x+=uT*.05;if(uTo==2)eb.x+=uT*.05;if(uFrom==5)ea.x+=uT*.006;
 if(uFrom==4)ea.x+=sin(uT*.5+s*20.)*.28;if(uTo==4)eb.x+=sin(uT*.5+s*20.)*.28;
 if(uFrom==3)ea*=ss(1.,-6.,a.z)*float(!held);if(uTo==3)eb*=ss(1.,-6.,b.z)*float(!held);
 float m=clamp(uMix*1.5-s*.5,0.,1.);m=m*m*(3.-2.*m);vec3 p=mix(a,b,m)+vec3(sin(s*50.),cos(s*70.),sin(s*90.))*sin(3.14159*m)*3.;float gk=uFrom==3?(uTo==3?1.:1.-m):uTo==3?m:0.,tk=uFrom==4?(uTo==4?1.:1.-m):uTo==4?m:0.;
 float gr=ss(.72,.9,uGrow+s*.12-.06);float sc=mix(A.w*(uFrom==4?gr:1.),B.w*(uTo==4?gr:1.),m);if(held)sc*=1.+.7*gk;
 mat3 R=turn(mix(ea,eb,m));vec3 w=p+R*vec3(aQ*vec2(.62,.82)*sc,0.);vQ=aQ;vSeed=s;vZ=w.z;gl_Position=uVP*vec4(w,1.);
 vFace=abs(dot(normalize(uEye-p),R*vec3(0,0,1)));vec3 c=mix(uGc[uFrom],uGc[uTo],m);
 vec3 pc=mix(vec3(1.,.22,.18),vec3(.15,1.,.62),ss(-1.,1.2,p.z));float hk=held&&uFrom==3?ss(.5,.57,uLocal):0.;pc=mix(pc,vec3(1.7,.16,.1),hk);c=mix(c,pc,gk*(held?max(hk,.5):.75*ss(-22.,-4.,p.z)));
 vPass=held?-gk*hk:gk*ss(.4,1.6,p.z);vWarm=tk;
 vA=fog(gl_Position.w)*mix(uGp[uFrom],uGp[uTo],m)*ss(2.5,9.,gl_Position.w);if(held)vA*=1.+.5*gk;if(uFrom==1||uTo==1)vA*=1.+uFlash*pr(1)*1.5;if(uFrom==2||uTo==2){float sk=uFrom==2?1.-m:m;vA*=mix(1.,.12+.88*ss(uCore.y+2.6,uCore.y-1.4,p.y+s-.5),sk);}vC=c;if(sc<.01||vA<.004)gl_Position=vec4(2,2,2,1);}`,
    `${H}${FRAME}in vec2 vQ;in vec3 vC;in float vA,vSeed,vFace,vPass,vZ,vWarm;out vec4 o;
float box(vec2 p,vec2 b){vec2 d=abs(p)-b;return length(max(d,0.))+min(max(d.x,d.y),0.);}
float ln(vec2 p,vec2 a,vec2 b){vec2 q=p-a,r=b-a;return length(q-r*clamp(dot(q,r)/dot(r,r),0.,1.));}
void main(){vec2 p=vQ*vec2(.62,.82);float aa=fwidth(p.x)+1e-4;float d=box(p,vec2(.56,.76))-.03;float g=1.-vFace;float edge=exp(-abs(d)*40.)*.3+.85*ss(aa*1.6,0.,abs(d));float inside=ss(aa,-aa,d);float f2=g*g;
 float body=edge*(.55+.8*f2)+inside*(.035+.1*f2*g);
 float lod=ss(.05,.008,aa);
 if(lod>.01&&inside>0.){float ink=0.;vec2 q=p;vec2 im=q-vec2(0.,.4);float pic=box(im,vec2(.44,.22));float inpic=ss(aa,-aa,pic);
  float hill=im.y+.06-.07*sin(im.x*7.+vSeed*20.)-.04*sin(im.x*15.+vSeed*50.);float sun=length(im-vec2(.2-.4*fract(vSeed*7.),.09))-.055;
  ink+=inpic*(.1+.2*ss(aa,-aa,hill)+.5*ss(aa,-aa,sun)+.25*ss(aa*1.5,0.,abs(hill)))+.4*ss(aa*1.5,0.,abs(pic));
  float w=.3+.12*fract(vSeed*91.);ink+=ss(aa,-aa,box(q-vec2(w-.44,.08),vec2(w,.032)))*.85;ink+=ss(aa,-aa,length(q-vec2(-.405,-.005))-.026)*.6+ss(aa,-aa,box(q-vec2(-.27,-.005),vec2(.085,.01)))*.4;
  float row=floor((-.07-q.y)/.085);if(row>=0.&&row<6.){float wl=.44-.2*fract(sin(row*7.1+vSeed*90.)*43.)*step(.5,fract(row*.37+vSeed*3.));float gap=step(.12,fract(q.x*(3.+fract(vSeed*31.)*2.)+row*.43));ink+=ss(aa,-aa,box(vec2(q.x-wl+.44,mod(-.07-q.y,.085)-.03),vec2(wl,.011)))*.42*(.35+.65*gap);}
  float sh=fract(uT*.05+vSeed*3.)*7.-3.;float shine=exp(-sq((q.x*.8+q.y-sh)*5.))*.16;
  body+=inside*(ink*.55*lod+shine);
  if(vPass>.02){float ck=min(ln(p,vec2(.28,-.6),vec2(.34,-.67)),ln(p,vec2(.34,-.67),vec2(.46,-.52)));body+=vPass*inside*lod*(ss(aa*2.6,aa*.6,ck)*1.6+.5*ss(aa*1.5,0.,abs(length(p-vec2(.365,-.6))-.13)));}
  if(vPass<-.02){float cr=min(ln(p,vec2(-.16,-.16),vec2(.16,.16)),ln(p,vec2(-.16,.16),vec2(.16,-.16)));body=body*(1.+vPass*.55)+-vPass*inside*(ss(.05,.02,cr)*.9);}
 }
 body+=inside*exp(-vZ*vZ*9.)*abs(vPass)*.6;
 vec3 c=vC*body;c+=vWarm*inside*vec3(1.,.62,.24)*(.16+.3*ss(.9,-.2,length(p*vec2(1.1,.85))));
 o=vec4(c*vA,1.);}`,
  ],
  core: [
    `${H}${FRAME}layout(location=0)in vec2 aQ;out vec2 vQ;void main(){vQ=aQ*vec2(2.2,1.);gl_Position=uVP*vec4(uCore+(uRight*vQ.x+uUpV*vQ.y)*uCoreR*6.,1.);}`,
    `${H}${FRAME}${NOISE}uniform float uDisc;in vec2 vQ;out vec4 o;
void main(){float r=length(vQ)*6.,a=atan(vQ.y,vQ.x+1e-6);float disc=ss(1.02,.98,r);float limb=rt(max(0.,1.-r*r));float moon=pr(0),sun=pr(5);float tex=1.;
 if(r<1.05&&uDisc>.01){vec3 n=vec3(vQ*6.,limb);float m=fbm(n*1.7+3.)*.6+ns(n*6.)*.2;vec3 q=n*4.3;float cr=ns(q+11.),c2=ns(n*9.+5.);tex=mix(1.,1.16-ss(.36,.6,m)*.62+ss(.62,.66,cr)*(1.-ss(.66,.74,cr))*.24-ss(.7,.78,c2)*.14,moon);tex*=mix(1.,.88+.24*fbm(n*7.+uT*.05),sun);}
 float halo=exp(-max(r-.6,0.)*1.9)*.36+.035/(1.+r*r*.35);float rays=pw(.5+.5*sin(a*7.+uT*.13+sin(a*3.-uT*.1)*2.),3.)*exp(-r*.75)*.14;float fade=ss(6.,3.2,r);
 vec2 q=vQ*6.;float streak=(exp(-abs(q.y)*9.)*exp(-abs(q.x)*.42)*.5+exp(-abs(q.y)*26.)*exp(-abs(q.x)*.24)*.5)*ss(13.2,6.,abs(q.x));
 vec3 hot=mix(uCoreC,vec3(1.),.65);o=vec4((hot*disc*tex*(.35+.65*limb)*mix(2.1,.62,moon)*uDisc+mix(hot,uCoreC,ss(0.,2.4,r))*(halo*mix(1.,.6,moon)+rays+(1.-uDisc)*exp(-r*r*1.6)*1.8)*fade+mix(hot,uCoreC,.5)*streak*(.1+sun*.8))*uCoreP,1.);}`,
  ],
  planet: [
    `${H}${FRAME}uniform float uScale;layout(location=0)in vec3 aP;out vec3 vN,vW;void main(){vN=aP;vW=PC+vec3(0,uPy,0)+aP*${PR}.*uScale;gl_Position=uVP*vec4(vW,1.);}`,
    `${H}${FRAME}${NOISE}${HAIR}${DITHER}uniform float uShell;uniform float uA;in vec3 vN,vW;out vec4 o;
const vec3 AIR=vec3(.16,.42,.95),WARM=vec3(1.,.5,.2);
float land(vec3 p){return sin(p.x*2.1+1.3)*cos(p.y*2.7-.4)+sin(p.z*2.4+p.y*1.6)*.8+sin(p.x*5.3+p.z*4.1)*.35+cos(p.y*6.1-p.x*3.7)*.3;}
void main(){vec3 n=normalize(vN),v=normalize(uEye-vW);
 if(uShell>.5){float back=max(dot(-n,v),0.);float g=pw(back,2.6)*5.5;float lit=ss(-.75,.75,dot(n,normalize(uCore-PC)));vec3 c=mix(AIR,WARM,ss(.25,.95,lit)*.8);o=vec4(c*g*(.12+1.5*lit*lit)*uA,1.);return;}
 if(ign(gl_FragCoord.xy)>uA)discard;
 float up=uFrom==5?uLocal:0.;vec3 l=normalize(normalize(uCore-vW)+vec3(0.,.03+.4*up*up,.2*up*up));float sun=dot(n,l),rim=1.-max(dot(n,v),0.);vec3 q=rY(n,-uT*.006);
 float f=fbm(q*5.),L=land(q*2.6+vec3(1.,0.,0.))-.05+(f-.5)*.9+(ns(q*19.)-.5)*.22;float isl=ss(-.02,.05,L);
 float dw=ss(-.34,.2,sun);vec3 dawn=mix(mix(vec3(.16,.06,.2),vec3(1.,.36,.12),ss(-.27,-.04,sun)),vec3(1.,.82,.6),ss(.02,.36,sun))*dw*dw;
 vec3 c=mix(vec3(.0010,.0030,.0085),vec3(.0022,.0044,.0085),isl);c+=mix(vec3(.004,.014,.034),vec3(.006,.008,.012),isl)*dawn*1.2;
 float hgt=L*7.+(f-.5)*1.6;float ct=lines(hgt,1.)*isl*ss(.02,.14,L),coast=hair(L,1.1);c+=(vec3(.07,.2,.46)*.16*(1.-dw)+dawn*.34)*ct;c+=(vec3(.16,.42,.9)*.2*(1.-dw)+dawn*.5)*coast;
 float sea=(1.-isl)*lines(ns(q*6.+vec3(0.,uT*.01,4.))*7.+f*2.,1.)*.5;c+=dawn*sea*.10;
 vec3 R=reflect(-v,n);c+=vec3(1.,.5,.2)*pw(max(dot(R,l),0.),14.)*(1.-isl*.7)*.35*dw;
 c+=mix(AIR,WARM,ss(.05,.6,sun))*pw(rim,4.6)*ss(-.5,.4,sun)*1.2+AIR*pw(rim,3.2)*.16+vec3(.1,.9,.4)*pw(rim,11.)*.1;o=vec4(c,1.);}`,
  ],
  // the dial, the gate, ripples, floors, growth rings, cloud deck and mist: rings, so only the ring is paid for
  disc: [
    `${H}${FRAME}uniform vec4 uD[6];
#define uP uD[0].xyz
#define uX uD[1].xyz
#define uY uD[2].xyz
#define uRim uD[5].xy
layout(location=0)in vec2 aV;out vec2 vQ;out float vD;void main(){float a=aV.x*6.2831853;vQ=vec2(cos(a),sin(a))*mix(uRim.x,uRim.y,aV.y);gl_Position=uVP*vec4(uP+uX*vQ.x+uY*vQ.y,1.);vD=gl_Position.w;}`,
    `${H}${FRAME}${NOISE}${HAIR}uniform vec4 uD[6];uniform int uKind;
#define uR uD[0].w
#define uIn uD[1].w
#define uA uD[2].w
#define uSpin uD[3].w
#define uHead uD[4].w
#define uSeed uD[5].z
#define uCol uD[3].xyz
#define uHot uD[4].xyz
in vec2 vQ;in float vD;out vec4 o;
void main(){float r=length(vQ),a=uKind==2||uKind==6?0.:atan(vQ.y,vQ.x)/6.2831853+.5;float g=0.,hot=0.;float turn=fract(a+uSpin);
 if(uKind==0){ // a measuring dial
  g+=hair(r-uR*.985,1.2)*.7+hair(r-uIn,1.)*.45+hair(r-mix(uIn,uR,.62),1.)*.16;
  g+=lines(turn*144.,1.)*band(r,uR*.93,uR*.968)*.32+lines(turn*24.,1.4)*band(r,uR*.89,uR*.968)*.6;
  float ar=fract(turn*3.);g+=step(.04,ar)*step(ar,.36)*band(r,uR*.8,uR*.815)*.55;
  float lag=fract(-turn+uT*.05);float sw=exp(-lag*9.);g*=.75+sw*1.4;g+=band(r,uIn,uR)*(.012+.05*sw);hot=sw*.5;
 }else if(uKind==1){ // the gate: three working bands
  float b1=band(r,uR*.9,uR*.985),b2=band(r,uR*.795,uR*.865),b3=band(r,uR*.735,uR*.765);
  g+=hair(r-uR*.99,1.6)+hair(r-uR*.895,1.)*.5+hair(r-uR*.87,1.)*.4+hair(r-uR*.79,1.2)*.8+hair(r-uR*.73,1.)*.35;
  float c=floor(turn*96.);float lit=step(.55,h1(c+uSeed)),run=exp(-fract(h1(c*1.7)*.2-turn*2.+uT*.09)*7.);
  g+=b1*(lit*.16+lines(turn*96.,1.)*.4+lit*run*.75);hot+=b1*lit*run*.6;
  float t2=fract(-a+uSpin*1.7+1.);g+=b2*(lines(t2*240.,1.)*.22+lines(t2*40.,1.3)*.5);
  float s3=fract(a*12.+uT*.06);g+=b3*ss(.02,.06,s3)*(1.-ss(.62,.66,s3))*.42;
  float port=abs(fract(a*8.)-.5)/8.*6.283*r;g+=(1.-ss(.02,.09,port))*band(r,uR*.87,uR)*.9;
  float lag=fract(-a+uHead);float sw=exp(-lag*8.);g*=.62+sw*1.1;hot+=sw*.25;
 }else if(uKind==2){ // ripples running outward
  for(int k=0;k<3;k++){float ph=fract(uT*.06+float(k)/3.+uSeed);float rr=mix(uIn,uR,ph);float q=(r-rr)*3.;g+=hair(r-rr,1.4)*sin(ph*3.14159)*.8+exp(-q*q)*(1.-ph)*(1.-ph)*.1;}
  if(uHead>=0.){float rr=uHead*uR;float q=(r-rr)*2.4;g+=(exp(-q*q)*.9+hair(r-rr,1.6))*(1.-ss(.55,1.,uHead));hot=.4;}
 }else if(uKind==3){ // a radial floor
  float rings=hair(fract(r/2.+.5)-.5,1.)*(1.-ss(.3,.8,fwidth(r/2.)));g+=rings*.22+lines(a*48.,1.)*.1*ss(uIn,uIn*2.+1.,r)+lines(a*8.,1.2)*.26;
  float on=step(.93,h2(vec2(floor(a*48.),floor(r/2.))+uSeed));g+=on*.06;
  g*=1.-ss(uR*.2,uR*.98,r);if(uHead>=0.){float q=(r-uHead*uR)*.9;float f=exp(-q*q);g+=f*(.25+rings*1.5)*(1.-ss(.5,1.,uHead));hot=f*.5;}
 }else if(uKind==4){ // growth rings: one for each season
  float wob=(ns(vec3(vQ*.22,1.))-.5)*1.7+(ns(vec3(vQ*.9,4.))-.5)*.36;float rr=r+wob*ss(.5,5.,r);float id=floor(rr*.95+.5);float wgt=.16+.84*h1(id+3.);
  float l=lines(rr*.95,1.+wgt*.5)*wgt;float fine=lines(rr*4.75,1.)*.1;float ray=lines(a*96.+ns(vec3(a*60.,r*.3,2.)),1.)*ss(.55,.75,ns(vec3(a*200.,r*.5,7.)))*.35;
  g=(l*.62+fine+ray*.4)*ss(uIn,uIn+.6,r)*(1.-ss(uR*.25,uR*.95,r));
  if(uHead>=0.){float q=(rr-uHead*uR)*.8;float f=exp(-q*q)*(1.-ss(.6,1.,uHead));g+=f*(.04+l*1.7+fine*1.4)*ss(1.5,6.,vD);hot=f;}
 }else if(uKind==5){ // the cloud deck over the storm
  float sp=a*6.2831853-log(r+1.)*2.6+uT*.1;vec2 q=vec2(cos(sp),sin(sp))*r;float f=ns(vec3(q*.13,uT*.02))*.65+ns(vec3(q*.29,4.))*.35,f2=ns(vec3(q*.34+f*2.,3.))*.6+ns(vec3(q*.9,8.))*.4;float den=ss(.36,.72,f*.65+f2*.45)*ss(uIn,uIn*2.4,r)*(1.-ss(uR*.55,uR,r));
  g=den*(.06+.5*f2*f2*f2)+den*lines(f*9.,1.)*.05;hot=clamp(uFlash*(.4+.6*ss(.4,.7,f2)),0.,1.);g*=1.+uFlash*3.2*ss(.35,.75,f2);
 }else if(uKind==6){ // mist lying on the ground
  float f=ns(vec3(vQ*.2+vec2(uT*.06,uT*.02),uT*.03))*ns(vec3(vQ*.47-vec2(uT*.04,0.),5.));g=ss(.16,.5,f)*ss(uIn,uIn+4.,r)*(1.-ss(uR*.4,uR,r))*.3;
 }
 if(g*uA<.0012)discard;o=vec4(mix(uCol,uHot,clamp(hot,0.,1.))*g*uA*fog(vD)*ss(.8,3.5,vD),1.);}`,
  ],
  // swept surfaces: the funnel, the two bands of the spine, the tunnel and the bezel of the gate
  surf: [
    `${H}${FRAME}${NOISE}uniform int uKind;uniform float uP;layout(location=0)in vec2 aG;out vec2 vG;out vec3 vW,vN;out float vD;
vec3 at(vec2 g){float a=g.x*6.2831853;if(uKind==1){float h=g.y;return storm(a,h,fun(h)*(uP-1.)*(1.-.75*h*h)+sin(a*2.+h*6.-uT*.8)*.05*fun(h));}
 if(uKind==2){float y=(g.x-.5)*34.,b=y*.42+uP;return rY(vec3(cos(b)*3.6,y+(g.y-.5)*.86,sin(b)*3.6),uT*.16);}
 if(uKind==3){float z=mix(-46.,-1.2,g.y),r=mix(17.,10.4,g.y);return vec3(cos(a)*r,sin(a)*r,z);}
 float r=uP;return vec3(cos(a)*r,sin(a)*r,mix(-1.1,.9,g.y));}
void main(){vG=aG;vW=at(aG);vec3 e=at(aG+vec2(.004,0.))-vW,f=at(aG+vec2(0.,.01))-vW;vN=cross(e,f);gl_Position=uVP*vec4(vW,1.);vD=gl_Position.w;}`,
    `${H}${FRAME}${NOISE}${HAIR}uniform int uKind;uniform float uP;uniform float uA;uniform vec3 uCol,uHot;in vec2 vG;in vec3 vW,vN;in float vD;out vec4 o;
void main(){vec3 n=normalize(vN),v=normalize(uEye-vW);float g=1.-abs(dot(n,v));float b=0.,hot=0.;
 if(uKind==1){ // cloud wound along one helix: a soft body that fades at its own edge, streaks, and a few hairlines on the same helix
  float nv=1.-g,h=vG.y,tw=vG.x*6.2831853+h*10.5+uT*(1.25-.45*uP);vec3 q=vec3(cos(tw)*2.6,sin(tw)*2.6,h*2.1-uT*.1+uP*7.3);
  float f=ns(q)*.46+ns(vec3(q.xy*2.3,q.z*1.4)+5.)*.34+(uP>.95&&uP<1.05?ns(vec3(q.xy*5.1,q.z*1.8)+9.):.5)*.2;float den=ss(.4,.68,f);den=den*den*.8+den*.2;
  float body=ss(0.,.42,nv)*(1.1-.55*nv);b=den*body*.23+body*.014;
  float t9=tw/6.2831853*6.;b+=lines(t9,1.1)*ss(.5,.68,f)*body*.34*step(.95,uP)*step(uP,1.05);
  b*=ss(0.,.05,h)*ss(1.,.66,h)*mix(.42,1.,ss(0.,.42,h));hot=uFlash*.35+den*.12;b*=1.+uFlash*1.4;}
 else if(uKind==2){float y=(vG.x-.5)*34.,c=vG.y;float e=hair(c-.04,1.2)+hair(c-.96,1.2);float row=floor(c*5.);float x=vG.x*150.+row*3.7;float id=floor(x);float w=.3+.6*h1(id+row*17.);float dash=step(fract(x),w)*step(.24,h1(id*1.3+row*5.))*band(fract(c*5.),.36,.6)*step(.5,row)*step(row,3.5);
  float nr=exp(-sq((y-uCore.y)*.22)),past=ss(uCore.y+.4,uCore.y-.4,y);b=e*.55+dash*(.08+.5*past+1.6*nr)+.015+.05*g;hot=nr;b*=ss(0.,.04,vG.x)*ss(1.,.96,vG.x);}
 else if(uKind==3){float z=vW.z;b=lines(z/2.4,1.)*.1+lines(vG.x*36.,1.)*.06;float cell=h2(floor(vec2(vG.x*36.,z/2.4)));float run=exp(-fract(cell-z*.05+uT*.22)*9.);b+=step(.9,cell)*.04+lines(vG.x*36.,1.6)*step(.8,h1(floor(vG.x*36.+.5)+3.))*run*.8;b*=ss(0.,.25,vG.y)*ss(1.,.9,vG.y);hot=run*.6;}
 else{float c=vG.y;b=hair(c-.03,1.2)*.7+hair(c-.97,1.2)*.7+lines(vG.x*180.,1.)*band(c,.12,.4)*.2+lines(vG.x*60.,1.2)*band(c,.12,.6)*.35+hair(c-.6,1.)*.25;b+=.03*g;float lag=fract(vG.x*2.-uT*.06);b+=band(c,.7,.86)*exp(-lag*6.)*.5;hot=exp(-lag*6.);}
 if(b*uA<.0012)discard;o=vec4(mix(uCol,uHot,clamp(hot,0.,1.))*b*uA*fog(vD)*ss(1.5,5.,vD),1.);}`,
  ],
  water: [
    `${H}${FRAME}${LIVE}uniform float uDrop;layout(location=0)in vec2 aG;out vec3 vW;void main(){float z0=max(uEye.z-.5,8.),z=z0-(z0+71.)*pw(aG.y,1.8),x=(aG.x*2.-1.)*(8.+(z0-z)*1.5);vec3 p=vec3(x,wave(vec2(x,z))-uDrop,z);vW=p;gl_Position=uVP*vec4(p,1.);}`,
    `${H}${FRAME}${LIVE}${NOISE}${HAIR}${DITHER}uniform float uA;uniform vec3 uSky;uniform vec4 uBoat[8];in vec3 vW;out vec4 o;
vec2 grad(vec2 q){float a=cos(q.x*.21+uT*.55)*.55,b=cos(q.y*.27-uT*.7+q.x*.09)*.5,c=cos((q.x+q.y)*.55+uT*1.1)*.17*.55,d=cos(q.x*1.1-q.y*.8+uT*1.7)*.07;return vec2(a*.21+b*.09+c+d*1.1,b*.27+c-d*.8);}
void main(){if(ign(gl_FragCoord.xy)>uA)discard;vec3 V=uEye-vW;float d=length(V);V/=d;vec2 q=vW.xz;float nf=1.-ss(10.,55.,d);vec2 g=grad(q)+(vec2(ns(vec3(q*.9,uT*.35)),ns(vec3(q.yx*1.1+9.,uT*.4)))-.5)*.5*(.25+.75*nf);if(nf>.02){g+=(vec2(ns(vec3(q*3.3,uT*.8)),ns(vec3(q.yx*3.7+5.,uT*.9)))-.5)*.62*nf;if(nf>.5)g+=(vec2(ns(vec3(q*8.1,uT*1.2)),ns(vec3(q.yx*8.9+5.,uT*1.3)))-.5)*.4*nf*(nf*2.-1.);}
 vec3 N=normalize(vec3(-g.x,1.,-g.y)),R=reflect(-V,N);R.y=abs(R.y);float fr=.02+.98*pw(1.-max(dot(N,V),0.),5.);vec3 L=normalize(uCore-vW);float s=max(dot(R,L),0.);
 vec3 c=vec3(.0012,.004,.011)+uSky*fr*(.15+.85*exp(-R.y*5.))*.55;c+=uCoreC*(pw(s,520.)*3.6+pw(s,90.)*.13+pw(s,9.)*.010)*(fr+.04)*1.7;
 if(nf>.05)for(int i=0;i<8;i++){vec3 w=uBoat[i].xyz-vW;float w2=dot(w,w);if(w2<90.){float k=1./(1.+w2*.22);w/=rt(w2);c+=vec3(1.,.5,.17)*(pw(max(dot(R,w),0.),26.)*1.1+.02)*k*(1.-w2/90.)*uBoat[i].w;}}
 float hgt=wave(q);float sub=ss(.1,1.2,hgt);c+=vec3(.01,.06,.11)*sub*.32*nf;
 float ct=lines(hgt*4.2,1.)*.03;c+=vec3(.2,.6,1.)*ct*(.35+.9*sub)*(1.-ss(16.,50.,d));
 o=vec4(mix(c,uSky*.16,ss(34.,84.,d)*.75),1.);}`,
  ],
  // the tree's wood: dark, with light in its grain; it hides what stands behind it
  bark: [
    `${H}${FRAME}${LIVE}layout(location=0)in vec4 aC;layout(location=1)in vec4 aN;layout(location=2)in vec2 aG;out vec3 vW,vN;out vec2 vU;out float vR,vL;
void main(){float k=ss(aG.x,aG.x+.035,uGrow)*(.7+.3*ss(aG.x,aG.x+.2,uGrow));vR=aC.w;vec3 p=sway(aC.xyz+aN.xyz*aC.w*k);vW=p;vN=aN.xyz;vU=vec2(aN.w,aG.x);vL=aG.y;gl_Position=uVP*vec4(p,1.);}`,
    `${H}${FRAME}${NOISE}${HAIR}${DITHER}uniform float uA;in vec3 vW,vN;in vec2 vU;in float vR,vL;out vec4 o;
void main(){if(vU.y>uGrow||ign(gl_FragCoord.xy)>uA)discard;vec3 n=normalize(vN),v=normalize(uEye-vW);float nv=max(dot(n,v),0.),rim=1.-nv;vec3 q=uCore-vW;float d2=dot(q,q);vec3 l=q/rt(d2);float lit=(.35+.65*max(dot(n,l),0.))/(1.+d2*.3);
 float h=vU.y*46.;float wob=(ns(vec3(vU.x*6.,h*.7,vL))-.5)*1.5;float x=vU.x*vL+wob*.75;float gr=lines(x,1.2),fine=lines(x*3.+wob,1.)*.35;float ridge=.5+.5*cos(x*6.2831853);float knot=ns(vec3(vW.xz*2.4,vW.y*1.1));
 float id=floor(x+.5);float y=fract(h*.11-uT*(.08+.05*h1(id))+h1(id*3.1));y*=y;y*=y;float sap=y*y*step(.42,h1(id+7.));
 float head=exp(-sq((uGrow-vU.y)*18.))*step(uGrow,1.02);
 vec3 bk=mix(vec3(.011,.013,.010),vec3(.034,.028,.018),ridge*knot);vec3 moon=vec3(.3,.55,.75)*pw(rim,2.4)*(.35+.65*max(dot(n,normalize(vec3(-.6,.5,-.5))),0.));
 vec3 c=bk*(.2+lit*5.*uCoreC)+moon*.16;c+=mix(vec3(.12,.62,.42),vec3(1.,.72,.34),.35+.5*lit)*(gr*(.05+.17*lit)+fine*(.025+.07*lit)+gr*sap*.7);c+=uCoreC*(gr*2.+.4)*head*.9;o=vec4(c,1.);}`,
  ],
  // leaves and grass: solid, lit by the light in the crown, turning with the season
  leaf: [
    `${H}${FRAME}${LIVE}layout(location=0)in vec2 aQ;layout(location=1)in vec4 aP;layout(location=2)in vec4 aD;layout(location=3)in vec2 aK;uniform float uA;out vec2 vQ;out vec3 vW,vN;out float vHue,vPop,vGold,vPx;
void main(){float id=float(gl_InstanceID),s=hs(id+.3),s2=hs(id+10000.5);bool grass=aK.y>=2.;float pop=ss(aP.w-.01,aP.w+(grass?.1:.07),uGrow);pop=pop*(1.+.35*sin(min(pop,1.)*3.14159));
 vec3 p=aP.xyz,d=aD.xyz;float gold=0.;
 if(!grass){float sweep=clamp(uSeason*1.9-(.5+p.x*.055+p.y*.03+(s-.5)*.35)*.9,0.,1.);gold=ss(0.,.5,sweep);float fl=step(hs(id+20000.5),.2*gold);if(fl>0.){float q=fract(uT*.042+s*7.);p.x+=sin(q*8.+s*40.)*1.1+q*2.;p.z+=cos(q*7.+s*20.)*.9;p.y=mix(p.y,-7.05,q);d=normalize(d+vec3(sin(uT*1.6+s*30.),cos(uT*1.3+s*20.),sin(uT*1.1+s*9.))*1.2);pop*=ss(1.,.95,q);}else p=sway(p);
  float gust=sin(dot(p.xz,vec2(.42,.3))-uT*1.25)*.5+.5;d=normalize(d+vec3(sin(uT*2.1+s*40.),cos(uT*1.7+s2*40.),sin(uT*1.9+s*9.))*(.07+.2*gust*gust));}
 else{d.x+=sin(uT*.9+p.x*.6+p.z*.4)*.22;d=normalize(d);}
 float lv=1.-uA;p+=normalize(p-vec3(0,2.,0)+vec3(0,.01,0))*lv*lv*(3.+9.*s)+vec3(0,lv*lv*5.*s2,0);
 vec3 side=normalize(cross(d,grass?uFwd:vec3(sin(s*40.),cos(s2*30.)*1.6,sin(s2*50.)))+vec3(1e-4,0.,1e-4));vec3 nm=cross(side,d);float sz=aD.w*pop*(1.-lv*lv);float y=aQ.y*.5+.5,wd=grass?1.-y*.85:sin(pw(y,.72)*3.14159)*(.96-.25*y);
 vec3 w=p+d*y*sz+side*aQ.x*sz*aK.x*wd-nm*y*y*sz*(grass?.55:.22)+nm*abs(aQ.x)*sz*(grass?0.:.12);
 vec4 c=uVP*vec4(w,1.);vPx=sz*uRes.y/max(c.w*uTan*2.,.1);vQ=vec2(aQ.x*(grass?1.:wd),y);vW=w;vN=nm;vHue=aK.y;vPop=1.-ss(0.,.16,uGrow-aP.w);vGold=gold;if(pop<.02||c.w<.5)c=vec4(2,2,2,1);gl_Position=c;}`,
    `${H}${FRAME}${HAIR}${DITHER}uniform float uA;in vec2 vQ;in vec3 vW,vN;in float vHue,vPop,vGold,vPx;out vec4 o;
void main(){vec2 q=vQ;bool grass=vHue>=2.;float vein=0.;if(!grass){float lod=ss(6.,20.,vPx);if(lod>0.)vein=(hair(q.x*.5,1.1)+lines((q.y-abs(q.x)*.32)*7.,1.)*.5)*lod;}
 vec3 n=normalize(vN),v=normalize(uEye-vW);vec3 L=uCore-vW;float d2=dot(L,L);L/=rt(d2);float tr=abs(dot(n,L));float back=max(dot(-v,L),0.);float lit=(.25+.75*tr+back*back*1.3)/(1.+d2*.085);
 vec3 moon=normalize(vec3(-.55,.75,.35));float sky=.5+.5*abs(dot(n,moon));float depth=ss(1.,8.,length(vW-vec3(0.,2.6,0.)));
 float hh=fract(vHue);vec3 spring=mix(vec3(.02,.15,.085),vec3(.1,.34,.1),hh*hh);vec3 rose=vec3(.75,.24,.4);if(hh>.9)spring=mix(spring,rose,.75*(1.-ss(.5,1.,uSeason)));vec3 gold=mix(vec3(.2,.035,.008),mix(vec3(.36,.11,.012),vec3(.5,.27,.04),hh),ss(.12,.5,hh));vec3 alb=mix(spring,gold,vGold*(.72+.28*step(.2,fract(vHue*7.3))));
 if(grass)alb=mix(vec3(.002,.014,.011),vec3(.04,.22,.13),q.y*q.y*q.y)*(.5+hh);
 float gust=sin(dot(vW.xz,vec2(.42,.3))-uT*1.25)*.5+.5;gust*=gust;gust*=gust;
 vec3 c=alb*(.07+.2*sky*depth*(.55+.9*gust)+lit*1.7*mix(vec3(1.,.9,.7),uCoreC*1.2,.5));c+=alb*vein*(.18+lit*1.6);c+=mix(vec3(.5,1.,.7),vec3(1.,.75,.35),.6)*vPop*(grass?.12*q.y:.3)*step(vPop,.995);
 c*=ss(.8,3.5,length(uEye-vW));if(ign(gl_FragCoord.xy)>uA*1.3)discard;o=vec4(c,1.);}`,
  ],
  node: [
    `${H}${FRAME}uniform vec4 uN[12],uK[12];layout(location=0)in vec2 aQ;out vec2 vQ;out vec3 vC;out float vL,vS,vI;void main(){vec4 n=uN[gl_InstanceID],k=uK[gl_InstanceID];vQ=aQ;vC=k.rgb;vS=uLocal-n.w;vL=ss(0.,.03,vS);vI=float(gl_InstanceID);gl_Position=uVP*vec4(n.xyz+(uRight*aQ.x+uUpV*aQ.y)*k.a,1.);}`,
    `${H}${FRAME}uniform float uA;in vec2 vQ;in vec3 vC;in float vL,vS,vI;out vec4 o;void main(){float d=length(vQ);if(d>1.)discard;float aa=fwidth(d);float halo=exp(-d*d*11.)*(1.-ss(.7,1.,d)),core=ss(.07+aa,.05,d),rim=1.-ss(0.,aa*1.4,abs(d-.22));float life=clamp(vS/.11,0.,1.),on=step(0.,vS)*(1.-life);float rr=mix(.08,.96,1.-pw(1.-life,3.));float ring=(1.-ss(0.,aa*1.6,abs(d-rr)))*on;float ang=fract(atan(vQ.y,vQ.x)/6.2831853+uT*.03);float dash=(1.-ss(0.,aa*1.3,abs(d-.34)))*step(.4,fract(ang*12.))*vL*.35;float tw=1.+.12*sin(uT*1.5+vI*2.3);float lit=(halo*(.42+on*.9)+core*1.1+rim*.5)*vL;float idle=(halo*.03+core*.12+rim*.05)*(1.-vL)*float(uFrom!=4);o=vec4(vC*(lit+idle+ring*.9+dash)*tw*uA+vec3(1.)*core*vL*.5*uA,1.);}`,
  ],
  // the nebula is drawn small once a frame and stretched; only the stars need every pixel
  neb: [
    `${H}layout(location=0)in vec2 aQ;out vec2 vQ;void main(){vQ=aQ;gl_Position=vec4(aQ,0.,1.);}`,
    `${H}${FRAME}${NOISE}uniform vec3 uN1,uN2;in vec2 vQ;out vec4 o;void main(){vec3 d=normalize(uFwd+uRight*vQ.x*uTan*uAsp+uUpV*vQ.y*uTan);float f=fbm(d*2.6+vec3(uT*.008,0,uT*.005)),g=fbm(d*5.+f*2.);float f3=fbm(d*11.+g*1.5);vec3 c=vec3(.0012,.0018,.0042)+(uN1*ss(.36,.85,f)*(.12+.5*f3*f3)+uN2*ss(.45,.95,f*g*2.)*(.1+.5*f3*f3))*mix(1.,ss(-.04,.16,d.y),uHaze);
 c+=uN1*uHaze*(exp(-max(d.y,0.)*8.)*ss(-.09,0.,d.y)*.55+exp(-abs(d.y)*60.)*.5);c*=1.+uFlash*pr(1)*(.8+2.*f3)*ss(-.1,.4,d.y);o=vec4(c,1.);}`,
  ],
  back: [
    `${H}layout(location=0)in vec2 aQ;out vec2 u;void main(){u=aQ*.5+.5;gl_Position=vec4(aQ,.99999,1.);}`,
    `${H}uniform sampler2D uTex;in vec2 u;out vec4 o;void main(){o=vec4(texture(uTex,u).rgb,1.);}`,
  ],
  star: [
    `${H}${FRAME}layout(location=0)in vec4 aD;out vec3 vC;void main(){vec4 c=uVP*vec4(uEye+aD.xyz*300.,1.);float s=fract(aD.w*917.3),b=s*s*s;vC=mix(vec3(.65,.8,1.),vec3(1.,.85,.65),fract(aD.w*613.))*(.25+1.4*b)*(.65+.35*sin(uT*(1.+3.*fract(aD.w*331.))+aD.w*99.))*ss(-.02,.12,aD.y+(1.-uHaze));gl_Position=vec4(c.xy,c.w*.99998,c.w);gl_PointSize=max(1.6,uRes.y*(.0016+.0032*b));}`,
    `${H}in vec3 vC;out vec4 o;void main(){float r=length(gl_PointCoord*2.-1.);o=vec4(vC*ss(1.,.1,r),1.);}`,
  ],
  down: [
    QUAD,
    `${H}uniform sampler2D uTex;uniform vec2 uPx;uniform vec4 uS;uniform float uFirst;in vec2 u;out vec4 o;vec3 t(vec2 d){return texture(uTex,min(u*uS.xy+d*uPx,uS.zw)).rgb;}void main(){vec3 c=t(vec2(0))*.5+(t(vec2(-1,1))+t(vec2(1,1))+t(vec2(-1,-1))+t(vec2(1,-1)))*.125;if(uFirst>.5){c=min(c,vec3(9.));float l=dot(c,vec3(.2126,.7152,.0722));c*=ss(.05,.36,l);}o=vec4(c,1);}`,
  ],
  up: [
    QUAD,
    `${H}uniform sampler2D uTex;uniform vec2 uPx;uniform vec4 uS;uniform float uGain;in vec2 u;out vec4 o;vec3 t(vec2 d){return texture(uTex,min(u*uS.xy+d*uPx,uS.zw)).rgb;}void main(){o=vec4((t(vec2(-.75,-.75))+t(vec2(.75,-.75))+t(vec2(-.75,.75))+t(vec2(.75,.75)))*.25*uGain,1);}`,
  ],
  out: [
    QUAD,
    `${H}uniform sampler2D uTex,uBloom;uniform vec4 uS,uS2;uniform float uDim,uGlow,uExpo,uT;uniform vec3 uGrade;in vec2 u;out vec4 o;
vec3 agx(vec3 v){const mat3 A=mat3(.842479,.0423283,.0423757,.0784336,.878469,.0784336,.0792237,.0791661,.879143);const mat3 B=mat3(1.19688,-.0528968,-.0529717,-.0980209,1.1519,-.0980434,-.0990297,-.0989612,1.15107);v=A*max(v,vec3(1e-6));v=clamp((log2(v)+12.47393)/16.5,0.,1.);vec3 x2=v*v,x4=x2*x2;v=15.5*x4*x2-40.14*x4*v+31.96*x4-6.868*x2*v+.4298*x2+.1191*v-.00232;float l=dot(v,vec3(.2126,.7152,.0722));v=l+1.24*(v-l);return clamp(B*v,0.,1.);}
void main(){vec2 c=u-.5;float r=dot(c,c);vec3 col=texture(uTex,min(u*uS.xy,uS.zw)).rgb*.95+texture(uBloom,min(u*uS2.xy,uS2.zw)).rgb*uGlow;col*=uDim*(1.-ss(.12,.62,r)*.75);col=agx(col*uExpo);col*=mix(vec3(1.),uGrade,.3);
 float n=fract(52.9829189*fract(dot(gl_FragCoord.xy+mod(uT*60.,64.)*5.588,vec2(.06711056,.00583715))));o=vec4(col+(n-.5)*.022,1);}`,
  ],
};
// ---------- the scenes' solid things ----------
// the whale's way over the water
const WAY = `vec3 way(float th){return vec3(-13.5*cos(th),-5.2+12.6*sin(th),-15.+3.*sin(th*1.3));}`;
Object.assign(SH, {
  // a boat folded from one sheet, with a light in it
  boat: [
    `${H}${FRAME}${LIVE}layout(location=0)in vec4 aP;layout(location=1)in vec4 aN;layout(location=2)in vec4 aI;out vec3 vL,vW,vN,vB;out float vS,vD,vK;
void main(){vec2 q=aI.xy;float y=wave(q),e=.7,gx=(wave(q+vec2(e,0.))-wave(q-vec2(e,0.)))/(2.*e),gz=(wave(q+vec2(0.,e))-wave(q-vec2(0.,e)))/(2.*e);float c=cos(aI.z),s=sin(aI.z);vec3 l=aP.xyz*aI.w;vec3 p=vec3(l.x*c+l.z*s,l.y,l.z*c-l.x*s);vec3 up=normalize(vec3(-gx,1.,-gz));vec3 x=normalize(vec3(1.,gx,0.)),z=cross(x,up);vec3 w=vec3(q.x,y+.02,q.y)+x*p.x+up*p.y+z*p.z;vec3 n=vec3(aN.x*c+aN.z*s,aN.y,aN.z*c-aN.x*s);vN=x*n.x+up*n.y+z*n.z;vL=aP.xyz;vW=w;vS=aP.w;vB=vec3(aN.w<.5,aN.w>.5&&aN.w<1.5,aN.w>1.5);vK=hs(aI.x+3.1);gl_Position=uVP*vec4(w,1.);vD=gl_Position.w;}`,
    `${H}${FRAME}${DITHER}uniform float uA;in vec3 vL,vW,vN,vB;in float vS,vD,vK;out vec4 o;
void main(){if(ign(gl_FragCoord.xy)>uA)discard;vec3 n=normalize(vN),v=normalize(uEye-vW);float f=dot(n,v);vec3 L=normalize(uCore-vW);float nl=dot(n,L);float moon=(nl*f>0.?abs(nl):.35*abs(nl));float fl=.86+.14*sin(uT*(5.+3.*vK)+vK*40.)*sin(uT*2.3+vK*9.);vec3 d=vL-vec3(0.,.62,0.);float in_=exp(-dot(d,d)*1.7);vec3 fw=fwidth(vB);vec3 e3=1.-ss3(vec3(0.),fw*1.3,vB);float ed=max(e3.x,max(e3.y,e3.z));
 vec3 c=vec3(.0022,.0052,.0105)*(1.+3.*moon);c+=vec3(1.,.52,.18)*(vS>.5?.22:.05)*in_*fl*(.35+.65*abs(f));c+=vec3(1.,.74,.4)*exp(-dot(d,d)*11.)*fl*.34;c+=mix(vec3(.32,.6,.9)*.5,vec3(1.,.72,.38)*.8,in_*(vS>.5?1.:.6))*ed*(.5+.5*moon+.4*in_);o=vec4(c*fog(vD)*ss(.8,3.,vD),1.);}`,
  ],
  // the whale: solid, dark and wet, the moon on its edge and its own lights along it
  whale: [
    `${H}${FRAME}uniform float uPhi,uPart;layout(location=0)in vec2 aG;out vec3 vW,vN;out vec2 vG;out float vUp,vS;
${WAY}
const float LAM=1.08;
float rad(float s){float h=pw(clamp(s/.27,0.,1.),.52),t=clamp((s-.27)/.73,0.,1.);return 1.62*h*(1.-t)*(1.+.95*t*(1.-t))+.12*ss(.02,.2,s);}
vec3 body(vec2 g){float s=uPart<.5?g.y:uPart<2.5?.31:1.;float th=uPhi-s*LAM;vec3 P=way(th),T=normalize(way(th+.02)-way(th-.02)),N=normalize(cross(vec3(0,0,1),T)),B=cross(T,N);float sw=sin(uT*1.1-s*3.4);P+=N*sw*.42*s*s;float ro=-.95+.5*s+.25*sin(th*1.5);vec3 U=N*cos(ro)+B*sin(ro),S=B*cos(ro)-N*sin(ro);float r=rad(s);
 if(uPart<.5){float a=g.x*6.2831853,c=cos(a);float v=c>0.?.82:1.+.24*exp(-sq((s-.22)/.13));float fin=.34*exp(-sq((s-.64)/.035))*pw(max(c,0.),22.);float lip=-.05*exp(-sq((c+.12)*9.))*ss(.3,.16,s);return P+(U*c*v+S*sin(a))*(r+lip)+U*fin-T*fin*1.1;}
 float side=mod(uPart,2.)<.5?-1.:1.,u=g.x,v=g.y-.5;
 if(uPart<2.5){vec3 d=normalize(S*side*.78-T*.62-U*.34+U*.25*sin(uT*.8+side));vec3 C=normalize(T-d*dot(T,d)),W=cross(d,C);float ch=(.74*pw(1.-u,.55)+.05)*(1.+.07*sin(u*36.))*ss(-.12,.14,u);return P+S*side*r*.72-U*r*.32+d*u*4.9+C*(v*ch-.25*u*u)-W*side*(u*u)*(.8+.5*sin(uT*.8+side*.6));}
 float ch=mix(.5,.05,u*u)+.42*sin(u*3.14159)*.6;vec3 sp=P-T*(.1+1.25*pw(u,1.5))+S*side*u*2.35;return sp+T*v*ch+N*(sin(uT*1.1-4.2)*.5*u*u);}
void main(){vG=aG;vec3 p=body(aG);float e=.006;vec3 x=body(aG+vec2(e,0.))-body(aG-vec2(e,0.)),y=body(clamp(aG+vec2(0.,e),0.,1.))-body(clamp(aG-vec2(0.,e),0.,1.));vW=p;vN=cross(x,y);vUp=cos(aG.x*6.2831853);vS=uPart<.5?aG.y:1.;gl_Position=uVP*vec4(p,1.);}`,
    `${H}${FRAME}${NOISE}${HAIR}${DITHER}uniform float uA,uPart;in vec3 vW,vN;in vec2 vG;in float vUp,vS;out vec4 o;
void main(){if(ign(gl_FragCoord.xy)>uA)discard;vec3 n=normalize(vN+vec3(0.,1e-5,0.)),v=normalize(uEye-vW);if(dot(n,v)<0.)n=-n;vec3 L=normalize(uCore-vW);float rim=1.-max(dot(n,v),0.);bool bd=uPart<.5;float back=max(dot(n,normalize(L+vec3(0.,.8,0.))),0.);
 float along=bd?vS:vG.x,belly=bd?ss(.1,-.2,vUp):.4;float wob=(ns(vec3(vG.x*(bd?9.:2.),along*5.,uPart*3.))-.5)*(bd?1.5:.5);float x=bd?vG.x*mix(76.,76.,belly)+wob:vG.y*15.+wob;float id=floor(x+.5),h=h1(id+uPart*17.);float gr=lines(x,1.15)*(.35+.65*h);float edge=bd?0.:(1.-ss(.0,.05,min(vG.y,1.-vG.y)));
 float y=fract(along*1.5-uT*(.05+.05*h)+h*7.1);y*=y;y*=y;float sap=y*y*step(.45,h1(id+7.));float wv=fract(uT*.1)*1.7-.35,pulse=exp(-sq((wv-(bd?vS:vG.x*.5+.3))*5.));
 vec3 c=vec3(.0018,.0042,.0085)*(1.+2.*back);vec3 fib=mix(vec3(.14,.42,.95),vec3(.5,.85,1.),.25+.75*back);c+=fib*gr*(.05+.2*back+.14*belly)*(bd?ss(0.,.05,vS):1.);c+=vec3(.6,.92,1.)*gr*(sap*.55+pulse*.3);c+=vec3(.4,.75,1.)*pw(rim,3.2)*(.06+.5*back)+vec3(.4,.75,1.)*edge*(.12+.3*back);
 vec2 q=bd?vec2(vG.x*22.,vS*30.):vec2(vG.x*14.,vG.y*4.);vec2 cell=floor(q),f=fract(q)-.5;float hh=h2(cell+uPart*7.);f-=(vec2(hh,fract(hh*57.))-.5)*.55;float st=ss(.12,.03,length(f))*step(.8,fract(hh*31.));c+=mix(vec3(.35,.8,1.),vec3(1.,.8,.5),step(.8,fract(hh*91.)))*st*(.25+.25*sin(uT*(1.+2.*fract(hh*7.))+hh*40.)+pulse*1.2);
 if(bd)c+=vec3(1.,.78,.45)*ss(.013,.006,length(vec2((abs(abs(vG.x-.5)-.217))*3.,(vS-.153)*2.2)))*.9;
 o=vec4(c*mix(1.,fog(length(uEye-vW)),.5),1.);}`,
  ],
  // the aurora: curtains standing on the air over the planet
  aurora: [
    `${H}${FRAME}${NOISE}uniform float uP;layout(location=0)in vec2 aG;out vec2 vG;out vec3 vW;out float vD;
void main(){float a=(aG.x-.5)*2.9,w1=ns(vec3(aG.x*5.+uP*3.,uT*.05,uP))-.5,w2=ns(vec3(aG.x*17.,uT*.09,uP+4.))-.5,w3=ns(vec3(aG.x*46.,uT*.16,uP+8.))-.5;float z=-.47+.06*uP+.13*sin(a*2.1+uP*2.+uT*.03)+w1*.2+w2*.09+w3*.03;vec3 n=normalize(vec3(sin(a)*.98,cos(a)*.9,z));float h=aG.y*(1.15+1.1*ns(vec3(aG.x*9.+uP*5.,uT*.1,2.))+.35*w3);vec3 p=PC+vec3(0,uPy,0)+n*(${PR}.*1.008+h*1.25);vG=aG;vW=p;gl_Position=uVP*vec4(p,1.);vD=gl_Position.w;}`,
    `${H}${FRAME}${NOISE}uniform float uA,uP;in vec2 vG;in vec3 vW;in float vD;out vec4 o;void main(){float x=vG.x*60.+uP*9.;float ray=.2+1.1*ns(vec3(x*1.4,uT*.22,uP))*(.35+.9*ns(vec3(x*4.7,uT*.45,3.)));float big=ss(.35,.75,ns(vec3(vG.x*6.+uP*2.,uT*.05,8.)));float y=vG.y;float body=ss(0.,.09,y)*pw(1.-y,2.);vec3 c=mix(vec3(.08,1.,.45),vec3(.15,.55,1.),ss(.1,.5,y));c=mix(c,vec3(.85,.2,.8),ss(.4,.95,y));float e=ss(0.,.25,vG.x)*ss(1.,.75,vG.x);o=vec4(c*body*ray*big*e*uA*.36,1.);}`,
  ],
});
// a shader that does one of several jobs becomes one program per job: nothing is decided on a pixel
for (const [n, kinds] of [
  ["disc", [0, 2, 4, 5, 6]],
  ["surf", [1]],
]) {
  for (const k of kinds) SH[n + k] = SH[n].map((s) => s.replace("uniform int uKind;", `const int uKind=${k};`));
  delete SH[n];
}
// solid things: without a discard while they are whole, so the chip can skip what they hide; with one only while they fade
for (const n of ["planet", "water", "bark", "leaf", "whale"]) {
  SH[n + "D"] = SH[n];
  SH[n] = SH[n].map((s) => s.replace(/if\([^;]{0,40}ign\(gl_FragCoord\.xy\)>uA(?:\*1\.3)?\)discard;/, ""));
}
for (const [n, v] of [
  ["shell", "1."],
  ["planet", "0."],
  ["planetD", "0."],
])
  SH[n] = (n === "shell" ? SH.planetD : SH[n]).map((s) => s.replace("uniform float uShell;", `const float uShell=${v};`));
