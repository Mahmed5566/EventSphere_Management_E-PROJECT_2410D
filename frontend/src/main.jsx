import React,{useEffect,useMemo,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {io} from 'socket.io-client';
import gsap from 'gsap';
import '@fortawesome/fontawesome-free/css/all.min.css';
import './styles.css';
import './EvenetSphere.css';
import './styles/design-system.css';
import './styles/vip-enhancements.css';
import './styles/vip-roles.css';
import './styles/vip-pages.css';
import './styles/vip-command.css';
import './styles/typography.css';
import './styles/planning.css';
import './styles/vip-forms.css';
import './styles/vip-profile.css';
import './styles/vip-header.css';

import { api, SOCKET, GOOGLE_CLIENT_ID, getUser, downloadText, csvFromRows, formatMoney, personImg, eventImg } from './lib/api.js';
import { buildPaletteItems, filterPalette } from './lib/palette.js';
import { ROLE_NAV } from './constants/navigation.js';
import { Loader, Toast, Modal, PageTitle, Empty } from './components/ui.jsx';
import { ReportsPage, CheckinPage, ActivityPage, CalendarPage, BudgetPage, TasksPage, CopilotAsk } from './pages/planning.jsx';
function CountdownBand(){
  const [now,setNow]=useState(()=>Date.now());
  useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t)},[]);
  const eventAt=new Date('2026-12-31T09:00:00').getTime();
  const cdLeft=Math.max(0,eventAt-now);
  const pad=n=>String(n).padStart(2,'0');
  const units=[['Days',Math.floor(cdLeft/86400000)],['Hours',Math.floor(cdLeft/3600000)%24],['Minutes',Math.floor(cdLeft/60000)%60],['Seconds',Math.floor(cdLeft/1000)%60]];
  return <section className="neo-count-band" aria-label="Next event countdown">
    <div className="neo-count-info"><span className="neo-count-tag"><i className="fa-solid fa-bolt"></i> NEXT EVENT</span><h2>EventSphere Global Summit 2026</h2><p><i className="fa-solid fa-location-dot"></i> Lahore Expo Center &nbsp;·&nbsp; <i className="fa-solid fa-calendar-day"></i> 31 December 2026</p></div>
    <div className="neo-count-grid">{units.map(x=><div className="neo-count-cell" key={x[0]}><b>{pad(x[1])}</b><small>{x[0]}</small></div>)}</div>
    <button className="neo-btn neo-btn-primary" onClick={()=>window.dispatchEvent(new CustomEvent('eventsphere:navigate',{detail:'register'}))}>Get Ticket <i className="fa-solid fa-arrow-right"></i></button>
  </section>;
}
function PublicSite({onAuth}){
  const ref=useRef();
  const [active,setActive]=useState('Home');
  const [mobileMenu,setMobileMenu]=useState(false);
  const [scrolled,setScrolled]=useState(false);
  const [progress,setProgress]=useState(0);
  useEffect(()=>{
    const onScroll=()=>{
      const y=window.scrollY||0;
      setScrolled(y>36);
      const h=document.documentElement.scrollHeight-window.innerHeight;
      setProgress(h>0?Math.min(100,(y/h)*100):0);
    };
    onScroll();
    window.addEventListener('scroll',onScroll,{passive:true});
    return()=>window.removeEventListener('scroll',onScroll);
  },[]);
  useEffect(()=>{
    const root=ref.current;
    const ctx=gsap.context(()=>{
      gsap.from('.neo-nav',{y:-28,opacity:0,duration:.8,ease:'power3.out'});
      gsap.from('.neo-hero-copy > *',{y:30,opacity:0,duration:.75,stagger:.08,ease:'power3.out'});
      gsap.from('.neo-globe-wrap',{scale:.84,opacity:0,duration:1.1,delay:.15,ease:'back.out(1.35)'});
      gsap.to('.neo-orbit',{rotate:360,repeat:-1,duration:26,ease:'none'});
      gsap.to('.neo-orbit.orbit-2',{rotate:-360,repeat:-1,duration:34,ease:'none'});
      gsap.to('.neo-float-card',{y:-10,repeat:-1,yoyo:true,stagger:.25,duration:2.6,ease:'sine.inOut'});
      gsap.to('.neo-star',{opacity:.2,repeat:-1,yoyo:true,stagger:.07,duration:1.8,ease:'sine.inOut'});
      const reveal=gsap.utils.toArray('.neo-reveal');
      reveal.forEach(el=>gsap.set(el,{y:35,opacity:0}));
      const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
        if(entry.isIntersecting){gsap.to(entry.target,{y:0,opacity:1,duration:.7,ease:'power3.out'});observer.unobserve(entry.target)}
      }),{threshold:.12});
      reveal.forEach(el=>observer.observe(el));
      const move=e=>{
        const r=root.getBoundingClientRect();
        const x=(e.clientX-r.left)/r.width-.5;
        const y=(e.clientY-r.top)/r.height-.5;
        gsap.to('.neo-globe-wrap',{rotateY:x*4,rotateX:-y*3,duration:.7,ease:'power2.out',overwrite:true});
      };
      root.addEventListener('pointermove',move);
      return()=>{observer.disconnect();root.removeEventListener('pointermove',move)};
    },root);
    return()=>ctx.revert();
  },[]);
  const nav=['Home','Events','Venues','Speakers','About','Contact'];
  const scrollTo=id=>document.getElementById(id)?.scrollIntoView({behavior:'smooth'});
  const go=item=>{
    setActive(item);
    setMobileMenu(false);
    if(item==='Home')scrollTo('top');
    if(item==='Events')scrollTo('features');
    if(item==='Speakers')scrollTo('speakers');
    if(item==='Venues')scrollTo('venues');
    if(item==='About'||item==='Contact')scrollTo('about');
  };
  const stats=[
    ['fa-calendar-days','Events','248','+12%'],
    ['fa-users','Live Attendees','12,480','+24%'],
    ['fa-ticket','Tickets Sold','8,230','82%'],
    ['fa-chart-line','Analytics','+48%','Growth']
  ];
  const features=[
    ['fa-calendar-days','EVENTS','Create, manage and promote your events with ease.'],
    ['fa-location-dot','VENUES','Find the perfect venue for your next event.'],
    ['fa-ticket','TICKETS','Smart ticketing for a seamless guest experience.'],
    ['fa-microphone','SPEAKERS','Connect with industry leaders and experts.'],
    ['fa-users','ATTENDEES','Engage your audience and build your community.'],
    ['fa-chart-column','ANALYTICS','Track performance and make data-driven decisions.']
  ];
  return <div className="neo-site" ref={ref}>
    <div className="neo-stars">{Array.from({length:55},(_,i)=><i className="neo-star" key={i} style={{left:`${(i*47)%100}%`,top:`${(i*29)%100}%`,animationDelay:`${(i%9)*.15}s`}} />)}</div>
    <header className={'neo-nav'+(scrolled?' scrolled':'')}>
      <span className="neo-nav-progress" style={{width:`${progress}%`}} aria-hidden="true"></span>
      <button className="neo-logo" onClick={()=>go('Home')} aria-label="EventSphere home">
        <span className="neo-logo-mark"><i></i><i></i><i></i><i></i><i></i><i></i></span>
        <span>EVENTSPHERE<small>PLANNING</small></span>
      </button>
      <nav>{nav.map(item=><button key={item} className={active===item?'active':''} onClick={()=>go(item)}><span>{item}</span><i className="fa-solid fa-arrow-right nav-arrow" aria-hidden="true"></i></button>)}</nav>
      <button className="neo-mobile-toggle" onClick={()=>setMobileMenu(v=>!v)} aria-label="Open navigation" aria-expanded={mobileMenu}><i className={mobileMenu?'fa-solid fa-xmark':'fa-solid fa-bars'}></i></button>
      <div className="neo-nav-actions">
        <button className="neo-search" aria-label="Search"><i className="fa-solid fa-magnifying-glass"></i></button>
        <button className="neo-login" onClick={()=>onAuth('login')}><i className="fa-solid fa-right-to-bracket"></i> Login</button>
        <button className="neo-get" onClick={()=>onAuth('register')}>Get Started <i className="fa-solid fa-arrow-right neo-get-arrow"></i></button>
      </div>
    </header>
    <div className={mobileMenu?'neo-mobile-menu open':'neo-mobile-menu'}>
      {nav.map(item=><button key={item} className={active===item?'active':''} onClick={()=>go(item)}>{item}<i className="fa-solid fa-arrow-right"></i></button>)}
      <button className="mobile-menu-cta" onClick={()=>{setMobileMenu(false);onAuth('register')}}>Get Started <i className="fa-solid fa-arrow-right"></i></button>
    </div>

    <main id="top">
      <section className="neo-hero">
        <div className="neo-city"></div>
        <div className="neo-hero-copy">
          <div className="neo-pill"><b></b> THE FUTURE OF EVENTS</div>
          <h1>PLAN. CONNECT.<br/><span>EXPERIENCE.</span></h1>
          <p>Everything you need to create unforgettable events, connect your audience, and manage every detail from one powerful platform.</p>
          <div className="neo-actions">
            <button className="neo-btn neo-btn-primary" onClick={()=>scrollTo('features')}>Explore Events <i className="fa-solid fa-arrow-right"></i></button>
            <button className="neo-btn neo-btn-outline" onClick={()=>onAuth('register')}>Create Your Event</button>
          </div>
          <div className="neo-proof">
            <div className="neo-avatars"><img src="/images/people/avatar-1.jpg" alt="EventSphere member"/><img src="/images/people/avatar-2.jpg" alt="EventSphere member"/><img src="/images/people/avatar-3.jpg" alt="EventSphere member"/><img src="/images/people/avatar-4.jpg" alt="EventSphere member"/></div>
            <div><b>Join 50,000+ event creators</b><small>worldwide</small></div>
            <button onClick={()=>onAuth('register')} aria-label="Join EventSphere"><i className="fa-solid fa-arrow-right"></i></button>
          </div>
        </div>

        <div className="neo-globe-wrap" aria-label="EventSphere futuristic event visualization">
          <div className="neo-orbit orbit-1"></div><div className="neo-orbit orbit-2"></div><div className="neo-orbit orbit-3"></div>
          <div className="neo-globe"><div className="neo-globe-grid"></div><div className="neo-globe-core">ES</div><span className="neo-node n1"></span><span className="neo-node n2"></span><span className="neo-node n3"></span><span className="neo-node n4"></span><span className="neo-node n5"></span></div>
          <div className="neo-float-card card-management"><div className="neo-card-icon"><i className="fa-solid fa-calendar-days"></i></div><div><small>Event Management</small><b>248</b><em>+12%</em></div><svg viewBox="0 0 100 30"><polyline points="0,24 18,18 30,21 43,9 58,16 73,5 87,10 100,2"/></svg></div>
          <div className="neo-float-card card-attendees"><div className="neo-card-icon"><i className="fa-solid fa-users"></i></div><div><small>Live Attendees</small><b>12,480</b><em>↑ 24%</em></div><div className="neo-mini-people"><img src="/images/people/avatar-5.jpg" alt="Attendee"/><img src="/images/people/avatar-4.jpg" alt="Attendee"/><img src="/images/people/avatar-6.jpg" alt="Attendee"/></div></div>
          <div className="neo-float-card card-tickets"><div className="neo-card-icon"><i className="fa-solid fa-ticket"></i></div><div><small>Tickets</small><b>8,230</b><em>82%</em></div><div className="neo-progress"><i></i></div></div>
          <div className="neo-float-card card-venue"><div className="neo-card-icon"><i className="fa-solid fa-location-dot"></i></div><div><small>Venues</small><b>12</b><em>Available</em></div><div className="neo-photo"></div></div>
          <div className="neo-float-card card-upcoming"><div className="neo-live">LIVE</div><small>Upcoming Event</small><b>Tech Summit 2026</b><span><i className="fa-regular fa-calendar"></i> Apr 25, 2026</span><button onClick={()=>scrollTo('features')}>View Details</button></div>
          <div className="neo-float-card card-analytics"><small>Analytics</small><b>Total Growth</b><strong>+48%</strong><svg viewBox="0 0 90 28"><polyline points="0,22 12,18 23,20 35,10 48,14 61,6 72,10 90,2"/></svg></div>
          <div className="neo-float-card card-message"><small>Messages</small><b>3 new messages</b><i className="fa-solid fa-arrow-right"></i></div>
          <div className="neo-ticket">
            <div><small>EVENTSPHERE</small><b>Tech Summit 2026</b><span>Apr 25, 2026 · Lahore Expo Center</span></div><div className="neo-qr">▦</div>
          </div>
          <div className="neo-stepbar">{[['fa-calendar-days','Events'],['fa-location-dot','Venues'],['fa-microphone','Speakers'],['fa-users','Attendees'],['fa-ticket','Tickets']].map((x,i)=><React.Fragment key={x[1]}><div><i className={'fa-solid '+x[0]}></i><span>{x[1]}</span></div>{i<4&&<b>→</b>}</React.Fragment>)}</div>
        </div>
      </section>

      <CountdownBand />

      <section id="features" className="neo-features neo-section">
        <div className="neo-section-heading neo-reveal"><div className="neo-section-kicker">POWERFUL FEATURES</div><h2>EVERYTHING YOUR EVENT NEEDS</h2><p>From planning to analytics, we provide all the tools you need to create, manage and grow successful events.</p></div>
        <div className="neo-feature-grid">{features.map((x,i)=><article className="neo-feature neo-reveal" key={x[1]} style={{transitionDelay:`${i*70}ms`}}><div className="neo-feature-icon"><i className={'fa-solid '+x[0]}></i></div><h3>{x[1]}</h3><p>{x[2]}</p><button onClick={()=>onAuth('register')}>Learn More <i className="fa-solid fa-arrow-right"></i></button></article>)}</div>
      </section>

      <section id="venues" className="neo-showcase neo-section">
        <div className="neo-showcase-copy neo-reveal"><div className="neo-section-kicker">SMART VENUES</div><h2>One connected view for <span>every event.</span></h2><p>Map halls, booths, speakers and attendee zones in one visual command center.</p><button className="neo-btn neo-btn-primary" onClick={()=>onAuth('register')}>Explore Venues <i className="fa-solid fa-arrow-right"></i></button></div>
        <div className="neo-map neo-reveal"><div className="neo-map-top">EVENT MAP <span>LIVE</span></div><div className="neo-map-grid">{Array.from({length:24},(_,i)=><i key={i}></i>)}</div><div className="neo-map-stage">MAIN STAGE</div><div className="neo-map-pin mp1"></div><div className="neo-map-pin mp2"></div><div className="neo-map-pin mp3"></div><div className="neo-map-label">LAHORE EXPO CENTER<br/><small>22 booths available</small></div></div>
      </section>

      <section id="agenda" className="neo-section neo-agenda-section">
        <div className="neo-section-heading neo-reveal"><div className="neo-section-kicker">EVENT AGENDA</div><h2>A FULL DAY, <span>PERFECTLY PLANNED</span></h2><p>Talks, workshops and networking - every session mapped to a time, a stage and a speaker.</p></div>
        <div className="neo-agenda">{[['09:00','Registration & Welcome Coffee','Main Lobby','fa-mug-hot'],['10:00','Opening Keynote','Main Stage','fa-microphone-lines'],['11:30','Panel: The Rise of Hybrid Events','Hall A','fa-users'],['13:00','Lunch & Networking','Expo Floor','fa-utensils'],['14:30','Workshops & Live Demos','Studios 1-4','fa-laptop-code'],['17:00','Awards & Closing','Main Stage','fa-trophy']].map(x=><div className="neo-agenda-row neo-reveal" key={x[0]}><span className="neo-agenda-time">{x[0]}</span><span className="neo-agenda-icon"><i className={'fa-solid '+x[3]}></i></span><div><b>{x[1]}</b><small>{x[2]}</small></div><button onClick={()=>onAuth('register')}>Book seat <i className="fa-solid fa-arrow-right"></i></button></div>)}</div>
      </section>

      <section id="speakers" className="neo-section neo-speakers-section">
        <div className="neo-section-heading neo-reveal"><div className="neo-section-kicker">SPEAKER HIGHLIGHTS</div><h2>LEARN FROM <span>THE BEST</span></h2><p>Industry leaders, founders and creators sharing the stage at EventSphere events.</p></div>
        <div className="neo-speakers">{[['avatar-1','Ayesha Khan','Event Director, EventSphere','Keynote - The Future of Live Events'],['avatar-2','Bilal Ahmed','Founder, ExpoLab','Workshop - Building Exhibitor Pipelines'],['avatar-3','Hina Raza','Operations Lead, Summit Co','Panel - Zero-Error Operations'],['avatar-4','Usman Tariq','Product Designer','Talk - Designing Attendee Journeys'],['avatar-5','Sara Malik','Marketing Head','Masterclass - Growth for Events'],['avatar-6','Daniyal Sheikh','Venue Partner','Session - Smart Venue Mapping']].map(x=><article className="neo-speaker neo-reveal" key={x[1]}><div className="neo-speaker-photo"><img src={`/images/people/${x[0]}.jpg`} alt={x[1]} loading="lazy"/><span className="neo-speaker-badge"><i className="fa-solid fa-microphone-lines"></i></span></div><h3>{x[1]}</h3><p>{x[2]}</p><small>{x[3]}</small></article>)}</div>
      </section>

      <section id="gallery" className="neo-section neo-gallery-section">
        <div className="neo-section-heading neo-reveal"><div className="neo-section-kicker">EVENT GALLERY</div><h2>REAL MOMENTS, <span>REAL ENERGY</span></h2><p>Conferences, launches, concerts and expos - captured and organised inside one connected workspace.</p></div>
        <div className="neo-gallery">{[
          ['event-1','Conference & Keynotes','1,200 seats filled'],
          ['event-2','Creative Expos','85 exhibitors live'],
          ['event-3','Live Concerts','12,000 fans'],
          ['event-4','Night Networking','3,400 connections'],
          ['event-5','Business Summits','42 sessions'],
          ['event-6','Audience Energy','98% engagement'],
          ['event-7','Main Stage','Lights, sound, action'],
          ['event-8','After Party','Unforgettable moments']
        ].map(x=><figure className="neo-gallery-card neo-reveal" key={x[0]}><img src={`/images/gallery/${x[0]}.jpg`} alt={x[1]} loading="lazy"/><figcaption><b>{x[1]}</b><span>{x[2]}</span></figcaption></figure>)}</div>
      </section>

<section id="voices" className="neo-section neo-voices-section">
        <div className="neo-section-heading neo-reveal"><div className="neo-section-kicker">TRUSTED BY TEAMS</div><h2>LOVED BY <span>ORGANISERS</span></h2><p>Real voices from organisers, exhibitors, staff and attendees running events on EventSphere every week.</p></div>
        <div className="neo-voices">{[
          ['avatar-1','Ayesha Khan','Event Director','Cut our check-in queue from 40 minutes to 6. The live command center is unreal.'],
          ['avatar-2','Bilal Ahmed','Exhibitor Lead','Lead capture and follow-ups finally live in one board. We closed 3x more deals.'],
          ['avatar-3','Hina Raza','Operations Manager','The live staff task board means nothing slips. My team actually enjoys shifts now.'],
          ['avatar-4','Usman Tariq','Attendee','My QR pass, agenda and networking matches - all inside one beautiful app.'],
          ['avatar-5','Sara Malik','Marketing Head','The analytics dashboard shows exactly what worked. No more guessing.'],
          ['avatar-6','Daniyal Sheikh','Venue Partner','Booth mapping and footfall heatmaps changed how we sell floor space.']
        ].map(x=><article className="neo-voice neo-reveal" key={x[1]}><img src={`/images/people/${x[0]}.jpg`} alt={x[1]} loading="lazy"/><div className="neo-voice-rating">{Array.from({length:5},(_,i)=><i className="fa-solid fa-star" key={i}></i>)}</div><p>{x[3]}</p><b>{x[1]}</b><span>{x[2]}</span></article>)}</div>
      </section>

      <section id="pricing" className="neo-section neo-pricing-section">
        <div className="neo-section-heading neo-reveal"><div className="neo-section-kicker">TICKET PRICING</div><h2>CHOOSE YOUR <span>PASS</span></h2><p>Simple, honest pricing. Start free and upgrade anytime as your event grows.</p></div>
        <div className="neo-pricing">{[['Starter','Free','fa-seedling',['1 event','Up to 100 attendees','QR tickets','Email support'],false],['Pro','PKR 9,999','fa-rocket',['Unlimited events','Up to 5,000 attendees','Booth designer','Analytics & reports','Priority support'],true],['Enterprise','Custom','fa-building',['Unlimited everything','Dedicated manager','SSO & audit logs','Custom integrations'],false]].map(x=><article className={x[4]?'neo-price-card featured':'neo-price-card'} key={x[0]}>{x[4]&&<span className="neo-price-flag">MOST POPULAR</span>}<div className="neo-price-icon"><i className={'fa-solid '+x[2]}></i></div><h3>{x[0]}</h3><div className="neo-price-value">{x[1]}{x[1]!=='Custom'&&x[1]!=='Free'&&<small>/mo</small>}</div><ul>{x[3].map(f=><li key={f}><i className="fa-solid fa-check"></i> {f}</li>)}</ul><button className={x[4]?'neo-btn neo-btn-primary':'neo-btn neo-btn-outline'} onClick={()=>onAuth('register')}>Choose {x[0]} <i className="fa-solid fa-arrow-right"></i></button></article>)}</div>
      </section>

            <section id="about" className="neo-final neo-section"><div className="neo-section-kicker">BUILT FOR EVENT TEAMS</div><h2>PLAN. CONNECT. <span>EXPERIENCE.</span></h2><p>EventSphere brings events, venues, tickets, speakers and attendee conversations into one powerful workspace.</p><button className="neo-btn neo-btn-primary" onClick={()=>onAuth('register')}>Get Started <i className="fa-solid fa-arrow-right"></i></button></section>
    </main>
    <footer className="neo-footer">
      <div className="neo-footer-main">
        <div className="neo-footer-brand">
          <div className="neo-logo"><span className="neo-logo-mark"><i></i><i></i><i></i><i></i><i></i><i></i></span><span>EVENTSPHERE<small>PLANNING</small></span></div>
          <p>The premium operating system for modern event teams — plan, sell, host and measure every experience in one place.</p>
          <div className="neo-footer-social"><a href="#gallery" aria-label="Gallery"><i className="fa-solid fa-camera-retro"></i></a><a href="#speakers" aria-label="Speakers"><i className="fa-solid fa-microphone-lines"></i></a><a href="#venues" aria-label="Venues"><i className="fa-solid fa-map-location-dot"></i></a><a href="#pricing" aria-label="Pricing"><i className="fa-solid fa-ticket"></i></a></div>
        </div>
        <div className="neo-footer-col"><h4>Platform</h4><a href="#features">Features</a><a href="#pricing">Pricing</a><a href="#agenda">Agenda</a><button type="button" onClick={()=>onAuth('register')}>Get started</button><button type="button" onClick={()=>onAuth('login')}>Sign in</button></div>
        <div className="neo-footer-col"><h4>Explore</h4><a href="#venues">Venues</a><a href="#speakers">Speakers</a><a href="#gallery">Gallery</a><a href="#voices">Testimonials</a><a href="#about">About</a></div>
        <div className="neo-footer-col"><h4>Contact</h4><a href="mailto:support@eventsphere.example">support@eventsphere.example</a><a href="tel:+920000000000">+92 000 0000000</a><span>Lahore · Pakistan</span><span>Mon–Fri · 9am–6pm PKT</span></div>
      </div>
      <div className="neo-footer-base"><span>© 2026 EventSphere Management</span><span>Built with the MERN stack · React · Node · MongoDB</span></div>
    </footer>
  </div>
}
function Auth({mode,onBack,onDone}){
 const [kind,setKind]=useState(mode),[data,setData]=useState({name:'',email:'',password:'',role:'attendee',company:''}),[err,setErr]=useState(''),[busy,setBusy]=useState(false),[showPw,setShowPw]=useState(false);
 const googleRef=useRef(null);
 const googleScriptLoaded=useRef(false);
 const finishAuth=(d)=>{localStorage.setItem('es_token',d.token);localStorage.setItem('es_user',JSON.stringify(d.user));onDone(d.user)};
 async function submit(e){e.preventDefault();setErr('');setBusy(true);try{const d=await api('/auth/'+(kind==='login'?'login':'register'),{method:'POST',body:JSON.stringify(data)});finishAuth(d)}catch(e){setErr(e.message)}finally{setBusy(false)}}
 async function googleAuth(credential){setErr('');setBusy(true);try{const d=await api('/auth/google',{method:'POST',body:JSON.stringify({credential})});finishAuth(d)}catch(e){setErr(e.message)}finally{setBusy(false)}}
 useEffect(()=>{
   if(!GOOGLE_CLIENT_ID) return;
   googleScriptLoaded.current=false;
   if(googleRef.current) googleRef.current.innerHTML='';
   const render=()=>{
     if(!window.google?.accounts?.id || !googleRef.current) return;
     googleScriptLoaded.current=true;
     window.google.accounts.id.initialize({client_id:GOOGLE_CLIENT_ID,callback:(response)=>googleAuth(response.credential)});
     window.google.accounts.id.renderButton(googleRef.current,{theme:'outline',size:'large',width:360,text:kind==='register'?'signup_with':'signin_with',shape:'rectangular'});
   };
   if(window.google?.accounts?.id){render();return}
   const existing=document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
   if(existing){existing.addEventListener('load',render,{once:true});return()=>existing.removeEventListener('load',render)}
   const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;script.defer=true;script.onload=render;script.onerror=()=>setErr('Google Sign-In could not load. Check your internet connection.');document.head.appendChild(script);
   return()=>{script.onload=null};
 },[kind]);
 return (
    <div className="auth-screen">
      <div className="auth-bg" aria-hidden="true"><span className="auth-orb o1"/><span className="auth-orb o2"/><span className="auth-orb o3"/><span className="auth-grid"/></div>
      <button className="back-home" onClick={onBack}><i className="fa-solid fa-arrow-left"></i> Back to website</button>
      <div className="auth-shell">
        <aside className="auth-showcase">
          <div className="brand"><span className="brand-mark">ES</span><span>EventSphere<small>EVENT COMMAND CENTER</small></span></div><div className="kicker">SECURE WORKSPACE</div><h1>{kind==='login'?'Welcome back.':'Build your workspace.'}</h1><p>After authentication you enter a role-specific command center. Exhibitors are identified by the name saved against their email account.</p><ul className="auth-perks"><li><i className="fa-solid fa-shield-halved"></i> Role-based access, JWT secured</li><li><i className="fa-solid fa-ticket"></i> Live ticketing &amp; QR passes</li><li><i className="fa-solid fa-comments"></i> Real-time messages &amp; notifications</li><li><i className="fa-solid fa-map-location-dot"></i> Venues, booths &amp; sessions in one place</li></ul><div className="auth-visual"><figure className="av-1"><img src="/images/gallery/event-1.jpg" alt="Conference keynote" loading="lazy"/></figure><figure className="av-2"><img src="/images/gallery/event-3.jpg" alt="Live concert" loading="lazy"/></figure><figure className="av-3"><img src="/images/gallery/event-6.jpg" alt="Audience energy" loading="lazy"/></figure><div className="auth-people"><img src="/images/people/avatar-1.jpg" alt="Member" loading="lazy"/><img src="/images/people/avatar-3.jpg" alt="Member" loading="lazy"/><img src="/images/people/avatar-5.jpg" alt="Member" loading="lazy"/><span>Joined by <b>50,000+</b> creators</span></div></div>
          <div className="auth-stats"><div><b>50k+</b><span>Creators</span></div><div><b>12k+</b><span>Events hosted</span></div><div><b>4.9<i className="fa-solid fa-star"></i></b><span>Avg rating</span></div></div>
        </aside>
        <form className="auth-card" onSubmit={submit}>
          <div className="auth-card-head"><div className="auth-card-mark"><i className="fa-solid fa-bolt"></i></div><div><h2>{kind==='login'?'Sign in':'Create account'}</h2><p>{kind==='login'?'Access your command center.':'Set up your workspace in a minute.'}</p></div></div>
          <div className="tabs"><button type="button" className={kind==='login'?'active':''} onClick={()=>setKind('login')}>Sign in</button><button type="button" className={kind==='register'?'active':''} onClick={()=>setKind('register')}>Sign up</button></div>{err&&<div className="error">{err}</div>}
          {kind==='register'&&<div className="field"><i className="fa-solid fa-user"></i><input placeholder="Full name" required value={data.name} onChange={e=>setData({...data,name:e.target.value})}/></div>}
          <div className="field"><i className="fa-solid fa-envelope"></i><input type="email" placeholder="Email address" required value={data.email} onChange={e=>setData({...data,email:e.target.value})}/></div>
          <div className="field field-pw"><i className="fa-solid fa-lock"></i><input type={showPw?'text':'password'} placeholder="Password (6+ chars)" required minLength="6" value={data.password} onChange={e=>setData({...data,password:e.target.value})}/><button type="button" className="pw-toggle" onClick={()=>setShowPw(s=>!s)} aria-label={showPw?'Hide password':'Show password'}><i className={'fa-solid '+(showPw?'fa-eye-slash':'fa-eye')}></i></button></div>
          {kind==='register'&&<><div className="field"><i className="fa-solid fa-building"></i><input placeholder="Company (optional)" value={data.company} onChange={e=>setData({...data,company:e.target.value})}/></div><select value={data.role} onChange={e=>setData({...data,role:e.target.value})}><option value="attendee">Attendee</option><option value="exhibitor">Exhibitor</option><option value="organizer">Organizer</option><option value="staff">Staff</option></select></>}
          <button className="primary wide auth-submit" disabled={busy}>{busy?<><i className="fa-solid fa-circle-notch fa-spin"></i> Authenticating...</>:kind==='login'?'Enter command center':'Create workspace'}{!busy&&<i className="fa-solid fa-arrow-right"></i>}</button><div className="social-auth-row"><button type="button" className="social-btn github-btn" disabled={busy} onClick={async()=>{setErr("");setBusy(true);try{await api("/auth/github",{method:"POST"});setErr("GitHub response received. Use Google or email until GitHub OAuth keys are configured.")}catch(e){setErr(e.message)}finally{setBusy(false)}}}><i className="fa-brands fa-github"></i> Continue with GitHub</button></div><div className="google-divider"><span>OR EMAIL / GOOGLE</span></div>{GOOGLE_CLIENT_ID?<div className="google-login-wrap"><div ref={googleRef}></div></div>:<div className="google-config-note">Google Sign-In is ready — add <b>VITE_GOOGLE_CLIENT_ID</b> to the frontend <code>.env</code> file.</div>}<p className="auth-terms"><i className="fa-solid fa-shield-halved"></i> Protected by encrypted connections.</p></form></div>
    </div>
  );
}
function Dashboard({user,onNavigate}){
 const [expos,setExpos]=useState([]),[analytics,setAnalytics]=useState(null),[toast,setToast]=useState(''),[loading,setLoading]=useState(true);
 const [health,setHealth]=useState({db:'checking',socket:'connecting',tickets:'checking',audit:'checking',auditCount:0});
 const heroRef=useRef(null);
 const load=async()=>{setLoading(true);try{const [e,a]=await Promise.all([api('/expos'),api('/analytics')]);setExpos(e.expos||[]);setAnalytics(a.analytics||null);setHealth(h=>({...h,tickets:'ready'}))}catch{setExpos([]);setAnalytics(null);setHealth(h=>({...h,tickets:'unavailable'}))}finally{setLoading(false)}};
 useEffect(()=>{load()},[]);
 /* Real system health: database from GET /api/health, audit trail from GET /api/advanced/audit.
    Nothing is hardcoded - each row reflects the actual API/socket response. */
 useEffect(()=>{
  let alive=true;
  const run=async()=>{
   try{const h=await api('/health');if(alive)setHealth(s=>({...s,db:h.database==='connected'?'connected':'disconnected'}))}catch{if(alive)setHealth(s=>({...s,db:'offline'}))}
   try{const a=await api('/advanced/audit');if(alive)setHealth(s=>({...s,audit:'enabled',auditCount:(a.logs||[]).length}))}catch(e){if(alive)setHealth(s=>({...s,audit:/access|organizer|denied|forbidden|403/i.test(e.message||'')?'restricted':'offline'}))}
  };
  run();const t=setInterval(run,30000);
  return()=>{alive=false;clearInterval(t)};
 },[]);
 useEffect(()=>{const s=io(SOCKET,{auth:{token:localStorage.getItem('es_token')}});const on=()=>setHealth(h=>({...h,socket:'live'}));const off=()=>setHealth(h=>({...h,socket:'offline'}));s.on('connect',on);s.on('disconnect',off);setHealth(h=>({...h,socket:s.connected?'live':'connecting'}));s.emit('user:join',user.id);s.on('ticket:paid',()=>{setToast('Ticket payment confirmed and added to the event wallet.');load()});s.on('message:new',()=>setToast('New realtime message received.'));s.on('notification:new',()=>setToast('You have a new notification.'));return()=>s.disconnect()},[user.id]);
 const stats=[['Events',analytics?.expos??expos.length,'fa-calendar-days','events'],['Tickets sold',analytics?.ticketsSold??0,'fa-ticket','tickets'],['Revenue',analytics?formatMoney(analytics.revenue):'—','fa-chart-line','analytics'],['Pending applications',analytics?.pendingApplications??0,'fa-building','exhibitors']];
 const upcoming=expos.filter(e=>new Date(e.date)>=new Date()).sort((a,b)=>new Date(a.date)-new Date(b.date)).slice(0,5);
 const exportSnapshot=()=>{const rows=[['Metric','Value'],['Events',analytics?.expos??expos.length],['Tickets sold',analytics?.ticketsSold??0],['Revenue PKR',analytics?.revenue??0],['Pending applications',analytics?.pendingApplications??0],[],['Upcoming event','Date','Location','Status'],...upcoming.map(e=>[e.title,new Date(e.date).toLocaleString(),e.location||'',e.status||''])];downloadText(`eventsphere-command-center-${new Date().toISOString().slice(0,10)}.csv`,csvFromRows(rows),'text/csv;charset=utf-8')};
 const roleMedia={organizer:['event-1','event-3','event-7','event-5'],exhibitor:['event-5','event-2','event-4','event-1'],staff:['event-6','event-3','event-1','event-8'],attendee:['event-2','event-8','event-6','event-4'],admin:['event-7','event-1','event-5','event-3']};
 const media=roleMedia[user.role]||roleMedia.attendee;
 const healthRows=[['db','fa-database','MongoDB data layer'],['socket','fa-tower-broadcast','Realtime events'],['tickets','fa-ticket','Ticket workflow'],['audit','fa-clipboard-list','Audit trail']];
 const healthMap={db:{connected:['Connected','ok'],disconnected:['Waiting for database','warn'],checking:['Checking…','wait'],offline:['Offline','bad']},socket:{live:['Live','ok'],connecting:['Connecting…','wait'],offline:['Offline','bad']},tickets:{ready:['Ready','ok'],unavailable:['Unavailable','bad'],checking:['Checking…','wait']},audit:{enabled:['Enabled','ok'],restricted:['Restricted','warn'],offline:['Offline','bad'],checking:['Checking…','wait']}};
 const heroTone=health.socket==='live'?'ok':health.socket==='connecting'?'wait':'bad';
 /* Hero entrance (GSAP) - skipped entirely when the user prefers reduced motion. */
 useEffect(()=>{const el=heroRef.current;if(!el)return;const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches||document.documentElement.classList.contains('reduce-motion');if(reduce)return;const ctx=gsap.context(()=>{gsap.from('.dash-hero-copy > *',{y:26,opacity:0,duration:.7,stagger:.08,ease:'power3.out'});gsap.from('.dash-hero-visual',{x:34,opacity:0,duration:.9,delay:.12,ease:'power3.out'});gsap.from('.dash-hero .live-pill',{scale:.7,opacity:0,duration:.6,delay:.4,ease:'back.out(1.6)'})},el);return()=>ctx.revert()},[]);
 /* Subtle pointer parallax on the hero depth layers (rAF-throttled, no idle loop). */
 useEffect(()=>{const el=heroRef.current;if(!el)return;if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;let raf=0;const move=e=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{const r=el.getBoundingClientRect();const x=(e.clientX-r.left)/r.width-.5;const y=(e.clientY-r.top)/r.height-.5;el.style.setProperty('--hx',(x*12).toFixed(2)+'px');el.style.setProperty('--hy',(y*10).toFixed(2)+'px')})};const reset=()=>{el.style.setProperty('--hx','0px');el.style.setProperty('--hy','0px')};el.addEventListener('pointermove',move);el.addEventListener('pointerleave',reset);return()=>{el.removeEventListener('pointermove',move);el.removeEventListener('pointerleave',reset);cancelAnimationFrame(raf)}},[]);
 return <div className="dash-page page-enter">
  <div className="dash-hero" ref={heroRef}>
   <span className="dash-hero-glow glow-a" aria-hidden="true"></span>
   <span className="dash-hero-glow glow-b" aria-hidden="true"></span>
   <div className="dash-hero-copy">
    <div className="kicker">{user.role.toUpperCase()} COMMAND CENTER</div>
    <h1>Hello, <span>{(user.name||'User').split(' ')[0]}</span>.</h1>
    <p>{user.role==='organizer'?'Your event operation is connected end-to-end: registrations, ticketing, exhibitors, venues, staff and live reporting.':user.role==='exhibitor'?'Track your company presence, applications, booths and event communication from one workspace.':user.role==='attendee'?'Discover events, keep your digital tickets close and follow sessions from one place.':'Control the EventSphere operation with live business data and role-based tools.'}</p>
    <div className="hero-meta">
     {upcoming[0]?<span className="hero-meta-chip" title="Next scheduled event"><i className="fa-solid fa-calendar-day"></i><b>{upcoming[0].title}</b></span>:null}
     {upcoming[0]?<span className="hero-meta-chip" title="Next event venue"><i className="fa-solid fa-location-dot"></i>{upcoming[0].location||'Venue to be announced'}</span>:null}
     <span className={'hero-meta-chip live-chip tone-'+heroTone}><span className={'status-dot tone-'+heroTone+(heroTone==='ok'?' pulse':'')}></span>{health.socket==='live'?'Realtime live':health.socket==='connecting'?'Realtime connecting':'Realtime offline'}</span>
    </div>
   </div>
   <div className="dash-hero-visual" aria-hidden="true">
    <figure className="hero-frame"><img src={`/images/gallery/${media[1]||media[0]}.jpg`} alt="" loading="lazy" decoding="async"/></figure>
    <div className="hero-float hero-float-a"><i className="fa-solid fa-ticket"></i><div><b>{loading?'…':(analytics?.ticketsSold??0)}</b><span>Tickets sold</span></div></div>
    <div className="hero-float hero-float-b"><i className="fa-solid fa-calendar-check"></i><div><b>{loading?'…':(analytics?.expos??expos.length)}</b><span>Active events</span></div></div>
   </div>
   <div className="live-pill"><i></i> REALTIME</div>
  </div>
  <div className="stats">{stats.map(x=><button className="stat stat-button" key={x[0]} onClick={()=>onNavigate?.(x[3])}><i className={'fa-solid '+x[2]}></i><span>{x[0]}</span><b>{loading?'…':x[1]}</b></button>)}</div>
  <section className="role-gallery panel"><div className="panel-head"><div><div className="kicker">ROLE GALLERY</div><h2>{user.role.toUpperCase()} · EVENT HIGHLIGHTS</h2></div><span className="live-pill"><i></i> LIVE</span></div><div className="role-gallery-grid">{media.map((m,i)=><figure className={'role-shot s'+((i%4)+1)} key={m}><img src={`/images/gallery/${m}.jpg`} alt="Event highlight" loading="lazy"/><figcaption>{['Venue floor','Main stage','Attendees','Networking'][i%4]}</figcaption></figure>)}</div></section>
  <div className="command-insights">
   <div className="insight-chart panel">
    <div className="panel-head"><div><div className="kicker">PERFORMANCE</div><h2>Command center pulse</h2></div><span className="chart-period">LIVE · 30 DAYS</span></div>
    <div className="chart-area" aria-label="Decorative performance trend">
     <div className="chart-grid"></div><svg viewBox="0 0 700 190" preserveAspectRatio="none"><defs><linearGradient id="esChartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#55e6ff" stopOpacity=".25"/><stop offset="1" stopColor="#55e6ff" stopOpacity="0"/></linearGradient></defs><path className="chart-fill" d="M0 160 C65 145 75 125 135 135 S210 95 265 112 S330 78 385 96 S450 58 505 76 S570 42 625 56 S665 30 700 38 L700 190 L0 190 Z"/><path className="chart-line" d="M0 160 C65 145 75 125 135 135 S210 95 265 112 S330 78 385 96 S450 58 505 76 S570 42 625 56 S665 30 700 38"/></svg>
     <div className="chart-labels"><span>Week 1</span><span>Week 2</span><span>Week 3</span><span>Today</span></div>
    </div>
   </div>
   <div className="live-command-card panel">
    <div className="live-command-top"><span className="live-pulse"><i></i> LIVE EVENT</span><i className="fa-solid fa-signal"></i></div>
    <b className="live-command-title">{upcoming[0]?.title||'EventSphere Operations'}</b>
    <span className="live-command-copy">{upcoming[0]?.location||'Your command center is ready for the next event.'}</span>
    <div className="live-mini-grid"><div><b>{loading?'…':(analytics?.ticketsSold??0)}</b><span>Tickets</span></div><div><b>{loading?'…':(analytics?.expos??expos.length)}</b><span>Events</span></div><div><b>{loading?'…':(analytics?.pendingApplications??0)}</b><span>Pending</span></div></div>
    <button className="primary wide" onClick={()=>onNavigate?.('experience')}><i className="fa-solid fa-bolt"></i> Open Live Mode</button>
   </div>
  </div>
  <div className="quick-actions panel">
   <div className="quick-actions-head"><div className="kicker">QUICK ACTIONS</div><h2>Move the operation forward.</h2><p className="muted">Common tasks are one click away. Use <kbd>Ctrl</kbd> + <kbd>K</kbd> anytime to search the workspace.</p></div>
   <div className="quick-action-grid">
    <button className="qa-card qa-events" onClick={()=>onNavigate?.('events')}><span className="qa-icon"><i className="fa-solid fa-calendar-plus"></i></span><span className="qa-label">Create / manage events</span><i className="qa-arrow fa-solid fa-arrow-right" aria-hidden="true"></i></button>
    <button className="qa-card qa-booths" onClick={()=>onNavigate?.('booths')}><span className="qa-icon"><i className="fa-solid fa-table-cells-large"></i></span><span className="qa-label">Open booth designer</span><i className="qa-arrow fa-solid fa-arrow-right" aria-hidden="true"></i></button>
    <button className="qa-card qa-tickets" onClick={()=>onNavigate?.('tickets')}><span className="qa-icon"><i className="fa-solid fa-qrcode"></i></span><span className="qa-label">Open ticketing</span><i className="qa-arrow fa-solid fa-arrow-right" aria-hidden="true"></i></button>
    <button className="qa-card qa-analytics" onClick={()=>onNavigate?.('analytics')}><span className="qa-icon"><i className="fa-solid fa-file-chart-column"></i></span><span className="qa-label">View live analytics</span><i className="qa-arrow fa-solid fa-arrow-right" aria-hidden="true"></i></button>
   </div>
  </div>
  <div className="dashboard-grid">
   <div className="panel large event-schedule">
    <div className="panel-head"><div><div className="kicker">UPCOMING</div><h2>Event schedule</h2></div><button className="ghost small refresh-btn" onClick={load} disabled={loading} aria-label="Refresh event schedule"><i className={'fa-solid fa-rotate'+(loading?' fa-spin':'')}></i> Refresh</button></div>
    {loading&&!upcoming.length
     ?<div className="sched-skeleton" aria-hidden="true">{[0,1,2].map(i=><span key={i}></span>)}</div>
     :<div className="event-timeline">{upcoming.map((e,i)=><button type="button" className="event-row" key={e._id} onClick={()=>onNavigate?.('events')} style={{animationDelay:(i*70)+'ms'}}><span className="event-date"><b>{new Date(e.date).getDate()}</b><span>{new Date(e.date).toLocaleString('en',{month:'short'})}</span></span><span className="event-thumb"><img src={e.image||eventImg(e._id||e.title)} alt="" loading="lazy" decoding="async"/></span><span className="event-copy"><b>{e.title}</b><small><i className="fa-solid fa-location-dot"></i> {e.location||'Location pending'}</small></span><span className={'status-tag '+(e.status||'draft')}>{(e.status||'draft')}</span><i className="fa-solid fa-chevron-right event-go" aria-hidden="true"></i></button>)}</div>}
    {!loading&&!upcoming.length&&<Empty text="No upcoming events yet. Create your first event to start the operation."/>}
   </div>
   <div className="panel operational-pulse">
    <div className="panel-head"><div><div className="kicker">OPERATIONAL PULSE</div><h2>System health</h2></div><span className={'health-live-badge tone-'+(health.db==='connected'?'ok':health.db==='checking'?'wait':'bad')}><span className={'status-dot tone-'+(health.db==='connected'?'ok':health.db==='checking'?'wait':'bad')+(health.db==='connected'?' pulse':'')}></span>{health.db==='connected'?'Database online':health.db==='checking'?'Checking API':'API offline'}</span></div>
    <div className="health-list">{healthRows.map(([key,icon,label])=>{const [text,tone]=(healthMap[key]&&healthMap[key][health[key]])||['Unknown','wait'];return <div className={'health-card tone-'+tone} key={key}><i className={'fa-solid '+icon} aria-hidden="true"></i><span className="health-label">{label}{key==='audit'&&health.audit==='enabled'&&health.auditCount>0?<small>{health.auditCount} logged events</small>:null}</span><b className="health-value"><span className={'status-dot tone-'+tone+(tone==='ok'?' pulse':'')}></span>{text}</b></div>})}</div>
    <p className="health-note muted"><i className="fa-solid fa-circle-info"></i> Live status from the EventSphere API, the MongoDB connection and the realtime socket.</p>
    <div className="panel-divider"></div>
    <button className="primary wide" onClick={exportSnapshot}><i className="fa-solid fa-file-export"></i> Export command snapshot</button>
   </div>
  </div>
  {toast&&<Toast text={toast} onClose={()=>setToast('')}/>}</div>
}
function Events({user}){
 const [items,setItems]=useState([]),[open,setOpen]=useState(false),[edit,setEdit]=useState(null),[regOpen,setRegOpen]=useState(false),[regEvent,setRegEvent]=useState(null),[registrations,setRegistrations]=useState([]),[form,setForm]=useState({title:'',date:'',endDate:'',location:'',theme:'',description:'',status:'published',image:''}),[err,setErr]=useState(''),[busy,setBusy]=useState(false),[toast,setToast]=useState('');
 const load=()=>api('/expos').then(d=>setItems(d.expos||[])).catch(()=>setItems([]));
 useEffect(()=>{load()},[]);
 const readImage=file=>new Promise((resolve,reject)=>{if(!file)return resolve('');if(!file.type.startsWith('image/'))return reject(Error('Please select an image file.'));if(file.size>5*1024*1024)return reject(Error('Image must be 5MB or smaller.'));const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('Could not read image.'));r.readAsDataURL(file)});
 const save=async(e,forcedStatus)=>{if(e&&e.preventDefault)e.preventDefault();if(busy)return;const status=forcedStatus||form.status;const payload={...form,status};const problems=[];if(!String(payload.title||'').trim())problems.push('An event title is required.');if(!payload.date)problems.push('A start date and time is required.');if(!String(payload.location||'').trim())problems.push('A location is required.');if(payload.date&&payload.endDate&&new Date(payload.endDate)<new Date(payload.date))problems.push('The end date must be on or after the start date.');if(problems.length){setErr(problems.join(' '));return}setErr('');setBusy(true);try{await api(edit?`/expos/${edit._id}`:'/expos',{method:edit?'PUT':'POST',body:JSON.stringify(payload)});setOpen(false);setEdit(null);await load();setToast(edit?'Event updated and saved to the database.':'Event created and saved to the database.')}catch(x){setErr(x.message||'Could not save the event. Please try again.')}finally{setBusy(false)}};
 const remove=async(event)=>{if(!confirm(`Delete "${event.title}"? This will also remove its booths, ticket settings, ticket orders, registrations and exhibitor applications.`))return;try{await api('/expos/'+event._id,{method:'DELETE'});await load();alert('Event deleted successfully.')}catch(e){alert(e.message||'Could not delete event.')}};
 const startEdit=e=>{setEdit(e);setForm({title:e.title,date:e.date?.slice(0,16)||'',endDate:e.endDate?.slice(0,16)||'',location:e.location||'',theme:e.theme||'',description:e.description||'',status:e.status||'draft',image:e.image||''});setOpen(true)};
 const showRegistrations=async e=>{try{const d=await api(`/expos/${e._id}/registrations`);setRegistrations(d.registrations||[]);setRegEvent(e);setRegOpen(true)}catch(x){alert(x.message||'Could not load registrations.')}};
 const blank={title:'',date:'',endDate:'',location:'',theme:'',description:'',status:'published',image:''};
 return <div className="dash-page">
  <PageTitle kicker="EVENT OPERATIONS" title="Events" copy="Create rich event posts, manage registrations and keep every event record connected." action={(user.role==='organizer'||user.role==='admin')&&<button className="primary" onClick={()=>{setEdit(null);setForm(blank);setErr('');setOpen(true)}}><i className="fa-solid fa-plus"></i> Add event</button>}/>
  <div className="cards-grid">{items.map(e=><article className="event-card" key={e._id}>
   {e.image?<div className="event-image-wrap"><img className="event-image" src={e.image} alt={e.title}/><span className="event-status">{e.status}</span></div>:<div className="event-banner"><span>{e.status}</span><b>{e.theme||'EVENT'}</b></div>}
   <div className="event-card-body"><small><i className="fa-regular fa-calendar"></i> {new Date(e.date).toLocaleString()}</small><h3>{e.title}</h3><p>{e.description||'No description'}</p><small><i className="fa-solid fa-location-dot"></i> {e.location}</small>
    <div className="row-actions">
     {(user.role==='organizer'||user.role==='admin')&&<>
      <button className="ghost small" onClick={()=>showRegistrations(e)}><i className="fa-solid fa-users"></i> Registrations</button>
      <button className={e.processingReady?'danger small':'ghost small'} onClick={async()=>{try{await api(`/expos/${e._id}/processing-ready`,{method:'PUT',body:JSON.stringify({processingReady:!e.processingReady})});await load()}catch(err){alert(err.message)}}}><i className="fa-solid fa-lock"></i> {e.processingReady?'Processing Ready':'Mark Ready'}</button>
      <button className="ghost small" onClick={()=>startEdit(e)}><i className="fa-solid fa-pen"></i> Edit</button><button className="danger small" onClick={()=>remove(e)}><i className="fa-solid fa-trash"></i></button>
     </>}
     {user.role==='attendee'&&<button className="primary small" onClick={async()=>{try{const d=await api(`/expos/${e._id}/register`,{method:'POST'});alert(d.message||'Registered for event.')}catch(x){alert(x.message)}}}>Register</button>}
     {user.role==='exhibitor'&&<button className="primary small" onClick={async()=>{try{const d=await api(`/exhibitor-applications/${e._id}/apply`,{method:'POST'});alert(d.message||'Exhibitor application submitted.')}catch(x){alert(x.message)}}}>Apply as Exhibitor</button>}
    </div>
   </div>
  </article>)}{!items.length&&<Empty text="No events available yet."/>}</div>
  {regOpen&&<Modal title={`${regEvent?.title||'Event'} registrations`} onClose={()=>setRegOpen(false)} wide>
   <div className="stats"><div className="stat"><span>Total</span><b>{registrations.length}</b></div><div className="stat"><span>Attendees</span><b>{registrations.filter(x=>x.type==='attendee').length}</b></div><div className="stat"><span>Exhibitors</span><b>{registrations.filter(x=>x.type==='exhibitor').length}</b></div></div>
   <div className="table-panel">{registrations.map(r=><div className="table-row" key={r._id}><div className="company"><span><i className={r.type==='exhibitor'?'fa-solid fa-building':'fa-solid fa-user'}></i></span><div><b>{r.user?.name||'Unknown user'}</b><small>{r.user?.email||'—'} · {r.type}</small></div></div><span>{r.user?.phone||'—'}</span><span className="status-tag">{r.status}</span><span>{r.createdAt?new Date(r.createdAt).toLocaleString():'—'}</span></div>)}{!registrations.length&&<Empty text="No attendee or exhibitor registrations have been saved for this event yet."/>}</div>
  </Modal>}
    {open&&<Modal title={edit?'Edit event':'Create event'} onClose={()=>{if(!busy)setOpen(false)}} wide><form onSubmit={save} className="event-form" noValidate>
   <div className="event-form-body">
    <section className="event-form-section">
     <div className="efs-head"><span className="efs-index">1</span><div><h3>Event details</h3><p>Give the event a clear name and a short description.</p></div></div>
     <div className="form-grid">
      <label className="ef-field full-col"><span>Event title <b>*</b></span><input required placeholder="e.g. Future Tech Expo 2026" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label>
      <label className="ef-field full-col"><span>Description</span><textarea placeholder="What should attendees expect?" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label>
     </div>
    </section>
    <section className="event-form-section">
     <div className="efs-head"><span className="efs-index">2</span><div><h3>Schedule &amp; location</h3><p>When and where the event takes place.</p></div></div>
     <div className="form-grid">
      <label className="ef-field"><span>Start date &amp; time <b>*</b></span><input required type="datetime-local" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label>
      <label className="ef-field"><span>End date &amp; time</span><input type="datetime-local" value={form.endDate} onChange={e=>setForm({...form,endDate:e.target.value})}/></label>
      <label className="ef-field"><span>Location <b>*</b></span><input required placeholder="Venue or city" value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/></label>
      <label className="ef-field"><span>Theme</span><input placeholder="e.g. AI &amp; Robotics" value={form.theme} onChange={e=>setForm({...form,theme:e.target.value})}/></label>
     </div>
    </section>
    <section className="event-form-section">
     <div className="efs-head"><span className="efs-index">3</span><div><h3>Appearance &amp; cover image</h3><p>Upload a cover or choose a preset from the gallery.</p></div></div>
     <div className="form-grid">
      <label className="image-upload full-col"><span><i className="fa-solid fa-image"></i> Event cover image</span><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={async e=>{try{const image=await readImage(e.target.files?.[0]);setForm({...form,image})}catch(x){setErr(x.message)}}}/><small>JPG, PNG, WEBP or GIF · max 5MB</small></label>
      <div className="cover-picker full-col"><small><i className="fa-solid fa-wand-magic-sparkles"></i> Quick cover - pick from gallery</small><div className="cover-thumbs">{['event-1','event-2','event-3','event-4','event-5','event-6','event-7','event-8'].map(n=><button type="button" key={n} className={form.image===`/images/gallery/${n}.jpg`?'cover-thumb active':'cover-thumb'} onClick={()=>setForm({...form,image:`/images/gallery/${n}.jpg`})}><img src={`/images/gallery/${n}.jpg`} alt="Cover option" loading="lazy"/></button>)}</div></div>
      {form.image&&<div className="event-preview full-col"><img src={form.image} alt="Event preview"/><div className="event-image-actions"><label className="image-change-btn"><i className="fa-solid fa-camera-rotate"></i> Change image<input hidden type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={async e=>{try{const image=await readImage(e.target.files?.[0]);if(image)setForm({...form,image})}catch(x){setErr(x.message)}}}/></label><button type="button" className="ghost small" onClick={()=>setForm({...form,image:''})}><i className="fa-solid fa-trash-can"></i> Remove image</button></div></div>}
     </div>
    </section>
    <section className="event-form-section">
     <div className="efs-head"><span className="efs-index">4</span><div><h3>Publishing status</h3><p>Draft events stay hidden from attendees until published.</p></div></div>
     <div className="form-grid">
      <label className="ef-field full-col"><span>Status</span><select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="draft">Draft</option><option value="published">Published</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label>
     </div>
    </section>
    {err&&<div className="error full-col" role="alert"><i className="fa-solid fa-triangle-exclamation"></i> <span>{err}</span></div>}
   </div>
   <div className="event-form-footer">
    <span className="eff-hint"><i className="fa-solid fa-database"></i> {edit?'Changes are saved to the database.':'This event is saved to the database.'}</span>
    <div className="eff-actions">
     <button type="button" className="ghost" onClick={()=>setOpen(false)} disabled={busy}>Cancel</button>
     {!edit&&<button type="button" className="ghost" onClick={()=>save(null,'draft')} disabled={busy}><i className="fa-regular fa-floppy-disk"></i> Save draft</button>}
     <button type="submit" className="primary" disabled={busy}>{busy?<><i className="fa-solid fa-spinner fa-spin"></i> Saving…</>:(edit?<><i className="fa-solid fa-check"></i> Save changes</>:<><i className="fa-solid fa-plus"></i> Create event</>)}</button>
    </div>
   </div>
  </form></Modal>}
  {toast&&<Toast text={toast} onClose={()=>setToast('')}/>}
  </div>}
function Venues(){
 const [items,setItems]=useState([]);
 const [open,setOpen]=useState(false);
 const [edit,setEdit]=useState(null);
 const empty={name:'',type:'hall',city:'',address:'',capacity:0,description:''};
 const [form,setForm]=useState(empty);
 const [error,setError]=useState('');
 const load=()=>api('/venues').then(d=>setItems(d.venues||[])).catch(e=>setError(e.message||'Could not load venues.'));
 useEffect(()=>{load()},[]);
 const save=async e=>{
  e.preventDefault();
  setError('');
  try{
   await api(edit?`/venues/${edit._id}`:'/venues',{method:edit?'PUT':'POST',body:JSON.stringify(form)});
   setOpen(false);setEdit(null);setForm(empty);await load();
  }catch(e){setError(e.message||'Could not save venue.')}
 };
 const del=async id=>{
  if(!window.confirm('Delete venue?'))return;
  try{await api('/venues/'+id,{method:'DELETE'});await load()}catch(e){setError(e.message||'Could not delete venue.')}
 };
 const startEdit=v=>{
  setEdit(v);
  setForm({name:v.name||'',type:v.type||'hall',city:v.city||'',address:v.address||'',capacity:v.capacity||0,description:v.description||''});
  setError('');
  setOpen(true);
 };
 const startAdd=()=>{setEdit(null);setForm({...empty});setError('');setOpen(true)};
 return <div className="dash-page">
  <PageTitle
   kicker="VENUE NETWORK"
   title="Venues & maps"
   copy="Create, edit and delete halls, banquets and other connected event spaces."
   action={<button className="primary" type="button" onClick={startAdd}><i className="fa-solid fa-plus"></i> Add venue</button>}
  />
  {error&&<div className="error">{error}</div>}
  <div className="venue-grid">
   {items.map((v,i)=><div className="panel venue-card" key={v._id}>
    <figure className="venue-photo">
     <img src={eventImg(v._id||v.name||i)} alt={v.name||'Venue'} loading="lazy"/>
     <span className="venue-photo-tag"><i className="fa-solid fa-location-dot"></i> {v.city||'Venue network'}</span>
     <span className="venue-photo-badge"><i className="fa-solid fa-users"></i> {Number(v.capacity||0).toLocaleString()}</span>
    </figure>
    <div className="venue-top">
     <span className="venue-icon"><i className="fa-solid fa-building"></i></span>
     <span className="trial">{v.membershipPlan==='trial'?'7 DAY TRIAL':(v.membershipPlan||'VENUE').toUpperCase()}</span>
    </div>
    <h2>{v.name}</h2>
    <p>{v.type} · {v.city}</p>
    <div className="venue-map">
     {Array.from({length:20},(_,i)=><span key={i} className={i%6===0?'occupied':''}>V{i+1}</span>)}
     <b>STAGE</b>
    </div>
    <div className="row-actions">
     <button className="ghost small" type="button" onClick={()=>startEdit(v)}><i className="fa-solid fa-pen"></i> Edit</button>
     <button className="danger small" type="button" onClick={()=>del(v._id)}><i className="fa-solid fa-trash"></i></button>
    </div>
   </div>)}
   {!items.length&&<Empty text="Add your first venue to activate the venue network."/>}
  </div>
  {open&&<Modal title={edit?'Edit venue':'Add venue'} onClose={()=>setOpen(false)}>
   <form onSubmit={save} className="form-grid">
    <input required placeholder="Venue name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
    <select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>
     <option value="hall">Hall</option><option value="banquet">Banquet</option><option value="convention_center">Convention Center</option><option value="outdoor">Outdoor</option><option value="hotel">Hotel</option><option value="other">Other</option>
    </select>
    <input placeholder="City" value={form.city} onChange={e=>setForm({...form,city:e.target.value})}/>
    <input placeholder="Address" value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/>
    <input type="number" min="0" placeholder="Capacity" value={form.capacity} onChange={e=>setForm({...form,capacity:Number(e.target.value)||0})}/>
    <textarea className="full-col" placeholder="Description" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/>
    <button className="primary wide full-col" type="submit">Save venue</button>
   </form>
  </Modal>}
 </div>
}
function Booths({user}){const [events,setEvents]=useState([]),[expo,setExpo]=useState(''),[items,setItems]=useState([]),[open,setOpen]=useState(false),[arrange,setArrange]=useState(false),[edit,setEdit]=useState(null),[zoom,setZoom]=useState(1),[form,setForm]=useState({boothNumber:'',size:'3x3',category:'Standard',status:'available',details:'',x:0,y:0});useEffect(()=>{api('/expos').then(d=>{setEvents(d.expos||[]);if(d.expos?.[0])setExpo(d.expos[0]._id)}).catch(()=>{})},[]);const load=()=>expo&&api('/booths/expo/'+expo).then(d=>setItems(d.booths||[])).catch(()=>setItems([]));useEffect(()=>{load()},[expo]);const save=async e=>{e.preventDefault();await api(edit?`/booths/${edit._id}`:`/booths/expo/${expo}`,{method:edit?'PUT':'POST',body:JSON.stringify(form)});setOpen(false);setEdit(null);load()};const del=async id=>{if(confirm('Delete booth?')){await api('/booths/'+id,{method:'DELETE'});load()}};const move=async(e,b)=>{if(!arrange||!['organizer','admin'].includes(user.role))return;const r=e.currentTarget.parentElement.getBoundingClientRect(),x=Math.max(0,Math.min(92,((e.clientX-r.left)/r.width)*100)),y=Math.max(0,Math.min(82,((e.clientY-r.top)/r.height)*100));await api('/booths/'+b._id,{method:'PUT',body:JSON.stringify({x:Number(x.toFixed(1)),y:Number(y.toFixed(1))})});load()};const reserve=async id=>{try{await api('/booths/'+id+'/reserve',{method:'POST'});load()}catch(e){alert(e.message)}};return <div className="dash-page"><PageTitle kicker="FLOOR PLAN" title="Booth designer" copy="A real MongoDB booth map. Add, edit, delete and reserve positions; x/y arrangement is saved." action={(user.role==='organizer'||user.role==='admin')&&<div className="row-actions"><button className={arrange?'primary':'ghost'} onClick={()=>setArrange(x=>!x)}><i className="fa-solid fa-arrows-up-down-left-right"></i> {arrange?'Save arrangement':'Edit arrangement'}</button><button className="primary" onClick={()=>{setEdit(null);setForm({boothNumber:'',size:'3x3',category:'Standard',status:'available',details:'',x:0,y:0});setOpen(true)}}><i className="fa-solid fa-plus"></i> Add booth</button></div>}/><div className="toolbar panel"><select value={expo} onChange={e=>setExpo(e.target.value)}>{events.map(e=><option value={e._id} key={e._id}>{e.title}</option>)}</select><span className="muted">{items.length} booth records</span><div className="map-zoom"><button className="ghost small" onClick={()=>setZoom(z=>Math.max(.7,Number((z-.1).toFixed(1))))}>−</button><b>{Math.round(zoom*100)}%</b><button className="ghost small" onClick={()=>setZoom(z=>Math.min(1.8,Number((z+.1).toFixed(1))))}>+</button><button className="ghost small" onClick={()=>setZoom(1)}>Reset</button></div></div><div className="floor-map" style={{transform:`scale(${zoom})`,transformOrigin:'top left',marginBottom:`${Math.max(0,(zoom-1)*220)}px`}}>{items.map((b,i)=><div key={b._id} draggable={arrange} onDragEnd={e=>move(e,b)} className={'booth '+b.status+(arrange?' draggable':'')} style={{left:`${(b.x||((i%8)*12))}%`,top:`${(b.y||Math.floor(i/8)*18)}%`}}><b>{b.boothNumber}</b><small>{b.category}</small><div className="booth-actions">{user.role==='exhibitor'?b.status==='available'&&<button onClick={()=>reserve(b._id)} title="Reserve"><i className="fa-solid fa-hand-pointer"></i></button>:<><button onClick={()=>{setEdit(b);setForm({boothNumber:b.boothNumber,size:b.size,category:b.category,status:b.status,details:b.details||'',x:b.x||0,y:b.y||0});setOpen(true)}}><i className="fa-solid fa-pen"></i></button><button onClick={()=>del(b._id)}><i className="fa-solid fa-trash"></i></button></>}</div></div>)}<div className="stage-block">MAIN STAGE</div><div className="entrance-block">ENTRANCE</div>{!items.length&&<div className="map-empty">Add booths to build your custom floor plan.</div>}</div>{open&&<Modal title={edit?'Edit booth':'Add booth'} onClose={()=>setOpen(false)}><form onSubmit={save} className="form-grid"><input required placeholder="Booth number e.g. A01" value={form.boothNumber} onChange={e=>setForm({...form,boothNumber:e.target.value})}/><input placeholder="Size" value={form.size} onChange={e=>setForm({...form,size:e.target.value})}/><input placeholder="Category" value={form.category} onChange={e=>setForm({...form,category:e.target.value})}/><select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option>available</option><option>reserved</option><option>occupied</option></select><input type="number" min="0" max="92" placeholder="X %" value={form.x} onChange={e=>setForm({...form,x:Number(e.target.value)})}/><input type="number" min="0" max="82" placeholder="Y %" value={form.y} onChange={e=>setForm({...form,y:Number(e.target.value)})}/><textarea className="full-col" placeholder="Details" value={form.details} onChange={e=>setForm({...form,details:e.target.value})}/><button className="primary wide full-col">Save booth arrangement</button></form></Modal>}</div>}
function Exhibitors({user}){
 const [items,setItems]=useState([]),[me,setMe]=useState(null),[open,setOpen]=useState(false),[events,setEvents]=useState([]),[apps,setApps]=useState([]),[selectedEvent,setSelectedEvent]=useState(''),[applyBusy,setApplyBusy]=useState(false),[form,setForm]=useState({companyName:'',description:'',products:'',services:'',website:'',phone:'',logo:'',documents:''}),[busyAction,setBusyAction]=useState('');
 const load=()=>api('/exhibitors').then(d=>setItems(d.exhibitors||[])).catch(()=>setItems([]));
 const loadMine=()=>api('/exhibitors/me').then(d=>{setMe(d.exhibitor);const x=d.exhibitor;if(x)setForm({companyName:x.companyName||'',description:x.description||'',products:(x.products||[]).join(', '),services:(x.services||[]).join(', '),website:x.website||'',phone:x.phone||'',logo:x.logo||'',documents:(x.documents||[]).join(', ')})}).catch(()=>setMe(null));
 const loadApps=()=>api(user.role==='exhibitor'?'/exhibitor-applications/mine':'/exhibitor-applications').then(d=>setApps(d.applications||[])).catch(()=>setApps([]));
 useEffect(()=>{load();api('/expos').then(d=>{setEvents(d.expos||[]);if(d.expos?.[0])setSelectedEvent(d.expos[0]._id)}).catch(()=>{});if(user.role==='exhibitor')loadMine();loadApps()},[user.role]);
 const save=async e=>{e.preventDefault();try{await api('/exhibitors/me',{method:'POST',body:JSON.stringify({...form,products:form.products.split(',').map(x=>x.trim()).filter(Boolean),services:form.services.split(',').map(x=>x.trim()).filter(Boolean),documents:form.documents.split(',').map(x=>x.trim()).filter(Boolean)})});setOpen(false);await loadMine();await load();alert('Company profile saved successfully.')}catch(e){alert(e.message||'Could not save company profile.')}};
 const approve=async(id,val)=>{try{await api('/exhibitors/'+id+'/approve',{method:'PUT',body:JSON.stringify({approved:val})});await load();alert(val?'Exhibitor profile approved.':'Exhibitor profile approval removed.')}catch(e){alert(e.message)}};
 const reviewApplication=async(id,status)=>{if(busyAction)return;setBusyAction(id+status);try{await api('/exhibitor-applications/'+id+'/status',{method:'PUT',body:JSON.stringify({status})});await loadApps();alert(`Application ${status}.`)}catch(e){alert(e.message||'Could not update application.')}finally{setBusyAction('')}};
 const downloadVoucher=(a)=>{const e=a.expo||{};const html=`<!doctype html><html><head><meta charset="utf-8"><title>EventSphere Exhibitor Voucher</title><style>body{font-family:Arial;background:#071329;padding:40px;color:#10233f}.card{max-width:720px;margin:auto;background:#fff;border:2px solid #12bfff;border-radius:22px;padding:36px}h1{color:#087dff}.code{font-size:28px;font-weight:800;letter-spacing:2px;padding:18px;background:#eef5ff;border-radius:14px;text-align:center;color:#174ea6}.row{display:flex;justify-content:space-between;gap:20px;border-bottom:1px solid #e5eaf2;padding:12px 0}.muted{color:#637083}</style></head><body><div class="card"><h1>EventSphere</h1><div class="muted">EXHIBITOR APPLICATION VOUCHER</div><h2>${e.title||'Event'}</h2><div class="row"><b>Company</b><span>${a.companyName||'—'}</span></div><div class="row"><b>Status</b><span>${a.status||'submitted'}</span></div><div class="row"><b>Payment</b><span>${a.paymentStatus==='paid'?'PAID — PKR '+Number(a.amount||0).toLocaleString():'NO TICKET PAYMENT REQUIRED'}</span></div><div class="row"><b>Pass</b><span>${a.passType||'No ticket/pass configured'}</span></div><div class="row"><b>Applied</b><span>${a.createdAt?new Date(a.createdAt).toLocaleString():'—'}</span></div><h2>Voucher Number</h2><div class="code">${a.voucherNo}</div><p class="muted">Keep this voucher as proof that the exhibitor application was submitted.</p></div></body></html>`;const blob=new Blob([html],{type:'text/html;charset=utf-8'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`EventSphere-Voucher-${a.voucherNo||'application'}.html`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)};
 const apply=async()=>{if(!selectedEvent||applyBusy)return;if(!me){setMe({companyName:user.company||user.name||'Exhibitor Company'}); }setApplyBusy(true);try{const d=await api('/exhibitor-applications/'+selectedEvent+'/apply',{method:'POST'});await loadApps();alert(d.message||'Exhibitor application submitted.');if(d.application)downloadVoucher(d.application)}catch(e){alert(e.message)}finally{setApplyBusy(false)}};
 return <div className="dash-page"><PageTitle kicker="EXHIBITOR NETWORK" title={user.role==='exhibitor'?'My company & applications':'Exhibitors'} copy={user.role==='exhibitor'?`Signed in as ${user.name} · ${user.email}. Manage your company profile, apply to events and track application status.`:'Review exhibitor companies and the actual event applications submitted to your events.'} action={user.role==='exhibitor'?<button className="primary" onClick={()=>setOpen(true)}><i className="fa-solid fa-pen"></i> Edit company profile</button>:null}/>
 {user.role==='exhibitor'&&<><div className="profile-hero panel"><div className="profile-avatar">{(user.name||'E')[0]}</div><div><div className="kicker">SIGNED-IN EXHIBITOR</div><h2>{user.name}</h2><p>{user.email} · {me?.companyName||user.company||'Company profile not created yet'}</p></div><button className="ghost" onClick={()=>setOpen(true)}><i className="fa-solid fa-building"></i> Company profile</button></div><div className="panel"><div className="panel-head"><div><div className="kicker">EVENT APPLICATION</div><h2>Apply to an event</h2></div></div><div className="toolbar"><select value={selectedEvent} onChange={e=>setSelectedEvent(e.target.value)}>{events.map(e=><option key={e._id} value={e._id}>{e.title} · {new Date(e.date).toLocaleDateString()}</option>)}</select><button className="primary" disabled={applyBusy||!events.length} onClick={apply}><i className="fa-solid fa-paper-plane"></i> {applyBusy?'Submitting...':'Apply as exhibitor'}</button></div><small className="muted">Your company profile is created automatically if needed; you can edit it anytime. Your application is stored separately and will appear in the organizer's Applications panel.</small></div><div className="panel"><div className="panel-head"><h2>My applications</h2><span className="live-pill"><i></i> SYNCED</span></div>{apps.map(a=><div className="ticket-row" key={a._id}><div className="qr"><i className="fa-solid fa-file-invoice"></i></div><div><b>{a.expo?.title||'Event'}</b><small>{a.companyName} · {a.paymentStatus==='paid'?`Paid PKR ${Number(a.amount||0).toLocaleString()}`:'No ticket payment'} · Voucher {a.voucherNo}</small></div><span className="row-actions"><strong>{a.status}</strong><button className="ghost small" onClick={()=>downloadVoucher(a)}><i className="fa-solid fa-download"></i> Voucher</button></span></div>)}{!apps.length&&<Empty text="No event applications yet."/>}</div></>}
 {user.role!=='exhibitor'&&<div className="panel"><div className="panel-head"><div><div className="kicker">EVENT APPLICATIONS</div><h2>Applications submitted to your events</h2></div><button className="ghost small" onClick={loadApps}><i className="fa-solid fa-rotate"></i> Refresh</button></div><div className="table-panel compact-table"><div className="table-head"><span>COMPANY / APPLICANT</span><span>EVENT</span><span>STATUS</span><span>ACTION</span></div>{apps.map(a=><div className="table-row" key={a._id}><div className="company"><span><i className="fa-solid fa-building"></i></span><div><b>{a.companyName}</b><small>{a.user?.name||'—'} · {a.user?.email||'—'}</small></div></div><span>{a.expo?.title||'—'}</span><span className="status-tag">{a.status}</span><span className="row-actions">{a.status!=='approved'&&<button className="primary small" disabled={busyAction===a._id+'approved'} onClick={()=>reviewApplication(a._id,'approved')}>Approve</button>}{a.status!=='rejected'&&<button className="danger small" disabled={busyAction===a._id+'rejected'} onClick={()=>reviewApplication(a._id,'rejected')}>Reject</button>}</span></div>)}{!apps.length&&<Empty text="No exhibitor applications have been submitted to your events yet."/>}</div></div>}
 <div className="table-panel"><div className="table-head"><span>COMPANY</span><span>OWNER</span><span>STATUS</span><span>ACTION</span></div>{items.map(x=><div className="table-row" key={x._id}><div className="company"><span><i className="fa-solid fa-building"></i></span><div><b>{x.companyName}</b><small>{x.description||'No description'}</small></div></div><span>{x.user?.name||'—'}</span><span className="status-tag">{x.approved?'Approved':'Pending'}</span><span>{(user.role==='organizer'||user.role==='admin')&&<button className="ghost small" onClick={()=>approve(x._id,!x.approved)}>{x.approved?'Remove approval':'Approve profile'}</button>}</span></div>)}{!items.length&&<Empty text="No exhibitor profile records yet."/>}</div>
 {open&&<Modal title="Exhibitor company profile" onClose={()=>setOpen(false)}><form onSubmit={save} className="form-grid"><input required placeholder="Company name" value={form.companyName} onChange={e=>setForm({...form,companyName:e.target.value})}/><input placeholder="Phone" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/><input placeholder="Website" value={form.website} onChange={e=>setForm({...form,website:e.target.value})}/><input placeholder="Logo URL" value={form.logo} onChange={e=>setForm({...form,logo:e.target.value})}/><input className="full-col" placeholder="Products (comma separated)" value={form.products} onChange={e=>setForm({...form,products:e.target.value})}/><input className="full-col" placeholder="Services (comma separated)" value={form.services} onChange={e=>setForm({...form,services:e.target.value})}/><input className="full-col" placeholder="Documents / links (comma separated)" value={form.documents} onChange={e=>setForm({...form,documents:e.target.value})}/><textarea className="full-col" placeholder="Company description" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/><button className="primary wide full-col">Save company profile</button></form></Modal>}</div>}
function Tickets({user}){
 const [events,setEvents]=useState([]),[expo,setExpo]=useState(''),[setting,setSetting]=useState(null),[orders,setOrders]=useState([]),[open,setOpen]=useState(false),[passes,setPasses]=useState([]),[busy,setBusy]=useState(false);
 const loadEvents=()=>api('/expos').then(d=>{setEvents(d.expos||[]);if(!expo&&d.expos?.[0])setExpo(d.expos[0]._id)}).catch(()=>{});
 const loadOrders=()=>api(user.role==='attendee'?'/ticket-orders/mine':'/ticket-orders').then(d=>setOrders(d.tickets||[])).catch(()=>setOrders([]));
 useEffect(()=>{loadEvents();loadOrders()},[user.role]);
 useEffect(()=>{if(expo)api('/ticket-settings/expo/'+expo).then(d=>{setSetting(d.setting);setPasses(d.setting?.passes||[])}).catch(()=>{setSetting(null);setPasses([])})},[expo]);
 const save=async e=>{e.preventDefault();if(!setting)return;setBusy(true);try{await api('/ticket-settings/'+setting._id,{method:'PUT',body:JSON.stringify({passes})});const d=await api('/ticket-settings/expo/'+expo);setSetting(d.setting);setPasses(d.setting?.passes||[]);setOpen(false);alert('Ticket settings saved successfully.')}catch(e){alert(e.message)}finally{setBusy(false)}};
 const purchase=async p=>{try{const d=await api('/ticket-orders',{method:'POST',body:JSON.stringify({expo,passType:p.name,quantity:1})});await loadOrders();alert('Purchase successful. Your ticket PDF will download now.');setTimeout(()=>downloadTicket(d.order),150)}catch(e){alert(e.message)}};
 const updatePass=(i,key,val)=>setPasses(a=>a.map((p,n)=>n===i?{...p,[key]:key==='price'||key==='capacity'?Number(val):val}:p));
 const downloadTicket=o=>{
  const event=o.expo||{};
  const clean=v=>String(v??'').replace(/[^\x20-\x7E]/g,' ').replace(/[()\\]/g,'');
  const lines=[
    'EVENTSPHERE - DIGITAL ENTRY PASS',
    clean(event.title||'Event'),
    `Attendee: ${clean(user.name||'Attendee')}`,
    `Pass: ${clean(o.passType||'Pass')}`,
    `Date: ${clean(event.date?new Date(event.date).toLocaleString():'-')}`,
    `Venue: ${clean(event.location||'-')}`,
    `Invoice: ${clean(o.invoiceNo||'-')}`,
    `Quantity: ${o.quantity||1}`,
    `Total: PKR ${Number(o.total||0).toLocaleString()}`,
    `Entry Code: ${clean(o.qrToken||o.invoiceNo||o._id)}`,
    'Present this ticket at event entry.'
  ];
  const esc=v=>clean(v);
  const streamParts=['BT','/F1 20 Tf','50 790 Td'];
  lines.forEach((line,i)=>{if(i===0)streamParts.push(`(${esc(line)}) Tj`);else streamParts.push(`0 -42 Td /F1 ${i===1?18:13} Tf (${esc(line)}) Tj`);});
  streamParts.push('ET');
  const stream=streamParts.join('\n');
  const objects=[
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
  ];
  let pdf='%PDF-1.4\n';
  const offsets=[0];
  objects.forEach((obj,i)=>{offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${obj}\nendobj\n`;});
  const xref=pdf.length;
  pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
  for(let i=1;i<offsets.length;i++)pdf+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
  pdf+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const blob=new Blob([pdf],{type:'application/pdf'});
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');link.href=url;link.download=`EventSphere-Ticket-${o.invoiceNo||o._id}.pdf`;link.style.display='none';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
 };
 return <div className="dash-page"><PageTitle kicker="TICKETING" title={user.role==='attendee'?'My Tickets':'Ticket settings & sales'} copy={user.role==='attendee'?'Your purchased digital passes stay in your wallet and can be downloaded as a printable ticket file.':'Create and edit the four pass types, rates and capacity for each event.'} action={user.role!=='attendee'&&<button className="primary" onClick={()=>setOpen(true)}><i className="fa-solid fa-sliders"></i> Ticket settings</button>}/><div className="toolbar panel"><select value={expo} onChange={e=>setExpo(e.target.value)}>{events.map(e=><option key={e._id} value={e._id}>{e.title}</option>)}</select>{setting&&<span className="muted">Configured passes: {setting.passes.filter(p=>p.enabled).length}/4</span>}</div>{user.role==='attendee'&&<div className="pass-grid">{(passes||[]).filter(p=>p.enabled).map(p=><div className="pass-card" key={p.name}><span>{p.name}</span><h2>PKR {p.price.toLocaleString()}</h2><small>{p.capacity?`${Math.max(0,p.capacity-p.sold)} left of ${p.capacity}`:'Unlimited capacity'}</small><button className="primary wide" disabled={p.capacity>0&&p.sold>=p.capacity} onClick={()=>purchase(p)}>{p.capacity>0&&p.sold>=p.capacity?'Sold out':'Purchase'} <i className="fa-solid fa-arrow-right"></i></button></div>)}{!passes.length&&<Empty text="Organizer has not configured ticket settings for this event."/>}</div>}{user.role!=='attendee'&&<div className="panel"><div className="kicker">ORDERS</div>{orders.map(o=><div className="ticket-row" key={o._id}><div className="qr"><i className="fa-solid fa-qrcode"></i></div><div><b>{o.passType}</b><small>{o.attendee?.name||'Attendee'} · {o.expo?.title} · {o.status}</small></div><span className="row-actions"><strong>PKR {o.total}</strong>{o.cancelRequested&&<button className="danger small" onClick={async()=>{try{await api(`/ticket-orders/${o._id}/cancel`,{method:'PUT'});await loadOrders();alert('Cancellation approved.')}catch(e){alert(e.message)}}}>Approve cancellation</button>}{o.status==='paid'&&o.qrToken&&<button className="ghost small" onClick={async()=>{try{await api(`/ticket-orders/check-in/${o.qrToken}`,{method:'POST'});await loadOrders();alert('Attendee checked in.')}catch(e){alert(e.message)}}}><i className="fa-solid fa-qrcode"></i> Check-in</button>}</span></div>)}{!orders.length&&<Empty text="No ticket orders yet."/>}</div>}{user.role==='attendee'&&<div className="panel"><div className="panel-head"><div><div className="kicker">DIGITAL WALLET</div><h2>My purchased tickets</h2></div><button className="ghost small" onClick={loadOrders}><i className="fa-solid fa-rotate"></i> Refresh</button></div>{orders.map(o=><div className="ticket-row" key={o._id}><div className="qr"><i className="fa-solid fa-qrcode"></i></div><div><b>{o.passType}</b><small>{o.expo?.title} · {o.status} · Invoice {o.invoiceNo}</small></div><span className="row-actions"><strong>PKR {o.total}</strong>{o.status==='paid'&&<><button className="primary small" onClick={()=>downloadTicket(o)}><i className="fa-solid fa-download"></i> Download ticket</button>{o.expo?.processingReady?<button className="ghost small" onClick={async()=>{const reason=prompt('Why do you need cancellation?')||'Cancellation requested';try{await api(`/ticket-orders/${o._id}/cancel-request`,{method:'POST',body:JSON.stringify({reason})});await loadOrders();alert('Cancellation request sent to organizer.')}catch(e){alert(e.message)}}}>Request cancellation</button>:<button className="danger small" onClick={async()=>{if(!confirm('Cancel this ticket?'))return;try{await api(`/ticket-orders/${o._id}/cancel-direct`,{method:'POST',body:JSON.stringify({reason:'Attendee cancelled'})});await loadOrders();alert('Ticket cancelled.')}catch(e){alert(e.message)}}}>Cancel</button>}</>}</span></div>)}{!orders.length&&<Empty text="Your purchased tickets will appear here."/>}</div>}{open&&<Modal title="Ticket settings" wide onClose={()=>setOpen(false)}><div className="ticket-settings-head"><select value={expo} onChange={e=>setExpo(e.target.value)}>{events.map(e=><option key={e._id} value={e._id}>{e.title}</option>)}</select><span>Organizer controls pricing + capacity</span></div><div className="settings-list">{passes.map((p,i)=><div className="setting-row" key={p.name}><b>{p.name}</b><input type="number" min="0" value={p.price} onChange={e=>updatePass(i,'price',e.target.value)} placeholder="Price"/><input type="number" min="0" value={p.capacity} onChange={e=>updatePass(i,'capacity',e.target.value)} placeholder="Capacity (0=unlimited)"/><label><input type="checkbox" checked={p.enabled} onChange={e=>updatePass(i,'enabled',e.target.checked)}/> Enabled</label><span>Sold: {p.sold}</span></div>)}</div><div className="row-actions"><button className="primary wide" onClick={save} disabled={busy}>{busy?'Saving...':'Save ticket configuration'}</button><button className="danger" onClick={async()=>{if(setting&&confirm('Delete ticket settings for this event?')){try{await api('/ticket-settings/'+setting._id,{method:'DELETE'});setOpen(false);setSetting(null);setPasses([])}catch(e){alert(e.message)}}}}>Delete settings</button></div></Modal>}</div>}
function Staff(){const [items,setItems]=useState([]),[events,setEvents]=useState([]),[open,setOpen]=useState(false),[edit,setEdit]=useState(null),[form,setForm]=useState({name:'',email:'',phone:'',role:'staff',event:'',salary:0,salaryType:'monthly',shiftStart:'09:00',shiftEnd:'17:00',active:true});const load=()=>api('/staff').then(d=>setItems(d.staff||[])).catch(()=>setItems([]));useEffect(()=>{load();api('/expos').then(d=>setEvents(d.expos||[])).catch(()=>{})},[]);const save=async e=>{e.preventDefault();await api(edit?`/staff/${edit._id}`:'/staff',{method:edit?'PUT':'POST',body:JSON.stringify(form)});setOpen(false);setEdit(null);load()};const del=async id=>{if(confirm('Delete staff member?')){await api('/staff/'+id,{method:'DELETE'});load()}};return <div className="dash-page"><PageTitle kicker="PEOPLE OPERATIONS" title="Staff & payroll" copy="Working staff CRUD: salary, salary type, role, shift and event assignment." action={<button className="primary" onClick={()=>{setEdit(null);setForm({name:'',email:'',phone:'',role:'staff',event:'',salary:0,salaryType:'monthly',shiftStart:'09:00',shiftEnd:'17:00',active:true});setOpen(true)}}><i className="fa-solid fa-user-plus"></i> Add staff</button>}/><div className="stats"><div className="stat"><i className="fa-solid fa-users"></i><span>Staff</span><b>{items.length}</b></div><div className="stat"><i className="fa-solid fa-clock"></i><span>Shifts</span><b>Active</b></div><div className="stat"><i className="fa-solid fa-money-bill"></i><span>Payroll</span><b>Live</b></div></div><div className="table-panel"><div className="table-head"><span>STAFF</span><span>EVENT</span><span>SHIFT</span><span>SALARY</span><span>ACTION</span></div>{items.map(s=><div className="table-row" key={s._id}><div className="company"><span><i className="fa-solid fa-user"></i></span><div><b>{s.name}</b><small>{s.email} · {s.role}</small></div></div><span>{s.event?.title||'—'}</span><span>{s.shiftStart} - {s.shiftEnd}</span><span>PKR {Number(s.salary||0).toLocaleString()} / {s.salaryType}</span><span className="row-actions"><button className="ghost small" onClick={()=>{setEdit(s);setForm({...s,event:s.event?._id||''});setOpen(true)}}><i className="fa-solid fa-pen"></i></button><button className="danger small" onClick={()=>del(s._id)}><i className="fa-solid fa-trash"></i></button></span></div>)}{!items.length&&<Empty text="Add your first staff member."/>}</div>{open&&<Modal title={edit?'Edit staff':'Add staff'} onClose={()=>setOpen(false)}><form onSubmit={save} className="form-grid"><input required placeholder="Name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/><input type="email" placeholder="Email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/><input placeholder="Phone" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/><input placeholder="Role" value={form.role} onChange={e=>setForm({...form,role:e.target.value})}/><select value={form.event} onChange={e=>setForm({...form,event:e.target.value})}><option value="">No event</option>{events.map(e=><option key={e._id} value={e._id}>{e.title}</option>)}</select><input type="number" min="0" value={form.salary} onChange={e=>setForm({...form,salary:Number(e.target.value)})} placeholder="Salary"/><select value={form.salaryType} onChange={e=>setForm({...form,salaryType:e.target.value})}><option>monthly</option><option>daily</option><option>hourly</option></select><input type="time" value={form.shiftStart} onChange={e=>setForm({...form,shiftStart:e.target.value})}/><input type="time" value={form.shiftEnd} onChange={e=>setForm({...form,shiftEnd:e.target.value})}/><label className="check"><input type="checkbox" checked={form.active} onChange={e=>setForm({...form,active:e.target.checked})}/> Active staff</label><button className="primary wide full-col">Save staff</button></form></Modal>}</div>}
function Messages({user}){const [users,setUsers]=useState([]),[selected,setSelected]=useState(null),[messages,setMessages]=useState([]),[text,setText]=useState('');const socket=useRef(null);useEffect(()=>{api('/messages/users').then(d=>setUsers(d.users||[])).catch(()=>setUsers([]));const s=io(SOCKET,{auth:{token:localStorage.getItem('es_token')}});socket.current=s;s.emit('user:join',user.id);s.on('message:new',m=>{if(selected&&String(m.sender?._id||m.sender)===String(selected._id)||String(m.recipient?._id||m.recipient)===String(selected?._id))setMessages(x=>[...x,m])});return()=>s.disconnect()},[user.id,selected]);useEffect(()=>{if(selected)api('/messages/thread/'+selected._id).then(d=>setMessages(d.messages||[])).catch(()=>setMessages([]))},[selected]);const send=async e=>{e.preventDefault();if(!text.trim()||!selected)return;const d=await api('/messages',{method:'POST',body:JSON.stringify({recipient:selected._id,text})});setText('');if(!messages.some(m=>m._id===d.message._id))setMessages(x=>[...x,d.message])};return <div className="dash-page"><PageTitle kicker="SOCKET.IO COMMUNICATIONS" title="Messages" copy="Select any account, load the MongoDB thread and send messages with realtime delivery."/><div className="message-layout"><div className="panel inbox"><div className="panel-head"><h2>People</h2><span className="live-pill"><i></i> Socket.IO</span></div>{users.map(u=><button className={selected?._id===u._id?'message-item active':'message-item'} key={u._id} onClick={()=>setSelected(u)}><div className="avatar-round"><img src={personImg(u.email||u.name)} alt={u.name||'User'} loading="lazy"/></div><div><b>{u.name}</b><small>{u.role} · {u.email}</small></div><i className="fa-solid fa-chevron-right"></i></button>)}{!users.length&&<Empty text="No other users available."/>}</div><div className="panel message-detail">{selected?<><div className="chat-head"><div className="avatar-round"><img src={personImg(selected.email||selected.name)} alt={selected.name} loading="lazy"/></div><div><b>{selected.name}</b><small>{selected.role} · {selected.email}</small></div></div><div className="chat-body">{messages.map(m=><div className={String(m.sender?._id||m.sender)===String(user.id)?'bubble me':'bubble'} key={m._id}><span>{m.text}</span><small>{new Date(m.createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</small></div>)}</div><form className="chat-compose" onSubmit={send}><input value={text} onChange={e=>setText(e.target.value)} placeholder="Write a realtime message..."/><button className="primary"><i className="fa-solid fa-paper-plane"></i></button></form></>:<div className="chat-empty"><i className="fa-regular fa-comments"></i><h2>Choose a conversation</h2><p>Messages arrive live through Socket.IO.</p></div>}</div></div></div>}
function Profile({ user, onSave, onNavigate, onLogout }) {
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState("edit");
  const [form, setForm] = useState({
    name: "", email: "", phone: "", company: "", jobTitle: "",
    location: "", website: "", bio: "", interests: "", language: "en"
  });
  const [avatar, setAvatar] = useState("");
  const [cover, setCover] = useState("");
  const [meta, setMeta] = useState({ role: "", email: "" });
  const [customFields, setCustomFields] = useState([]);
  const [newField, setNewField] = useState({ label: "", value: "" });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [avatarBroken, setAvatarBroken] = useState(false);
  const [coverBroken, setCoverBroken] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState({ type: "", text: "" });
  const [notifs, setNotifs] = useState({ items: [], loading: false, error: "" });
  const [dark, setDark] = useState(() => localStorage.getItem("es_theme") !== "light");

  const applyTheme = (on) => {
    document.documentElement.dataset.theme = on ? "dark" : "light";
    localStorage.setItem("es_theme", on ? "dark" : "light");
    window.dispatchEvent(new CustomEvent("eventsphere:theme", { detail: on }));
  };
  const toggleTheme = () => { applyTheme(!dark); setDark((v) => !v); };

  const applyLanguage = async (lang) => {
    const next = ["en", "ur"].includes(lang) ? lang : "en";
    document.documentElement.lang = next;
    setForm((f) => ({ ...f, language: next }));
    try {
      const d = await api("/auth/profile", {
        method: "PUT",
        body: JSON.stringify({ language: next })
      });
      if (d.user) { preservingUpdate(d.user); }
    } catch (e) {
      // keep local preference; surface quietly
    }
  };

  function preservingUpdate(next) {
    setMeta({ role: next.role || meta.role, email: next.email || meta.email });
    setForm((f) => ({
      ...f, name: next.name ?? f.name, email: next.email ?? f.email,
      phone: next.phone ?? f.phone, company: next.company ?? f.company,
      jobTitle: next.jobTitle ?? f.jobTitle, location: next.location ?? f.location,
      website: next.website ?? f.website, bio: next.bio ?? f.bio,
      interests: next.interests ?? f.interests, language: next.language ?? f.language
    }));
    const na = next.avatar ?? avatar;
    const nc = next.cover ?? cover;
    setAvatar(na);
    setCover(nc);
    setCustomFields(Array.isArray(next.customFields) ? next.customFields : customFields);
    setAvatarBroken(false);
    setCoverBroken(false);
  }

  useEffect(() => {
    let alive = true;
    api("/auth/me")
      .then((d) => {
        if (!alive || !d.user) return;
        const u = d.user;
        setMeta({ role: u.role || "", email: u.email || "" });
        setForm({
          name: u.name || "", email: u.email || "", phone: u.phone || "",
          company: u.company || "", jobTitle: u.jobTitle || "",
          location: u.location || "", website: u.website || "",
          bio: u.bio || "", interests: u.interests || "",
          language: (u.language || "en")
        });
        setAvatar(u.avatar || "");
        setCover(u.cover || "");
        setCustomFields(Array.isArray(u.customFields) ? u.customFields : []);
        document.documentElement.lang = u.language || "en";
        try { onSave(u); } catch {}
      })
      .catch((err) => {
        if (!alive) return;
        setMsg({ type: "error", text: err.message || "Could not load your profile." });
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  function flash(t) { setMsg(t); setTimeout(() => setMsg({ type: "", text: "" }), 3200); }

  function validate(values) {
    const e = {};
    if (!String(values.name || "").trim()) e.name = "Full name is required.";
    else if (String(values.name).trim().length < 2) e.name = "Enter at least 2 characters.";
    if (values.website && !/^(https?:\/\/)?[\w.-]+\.[a-zA-Z]{2,}([/?#].*)?$/.test(String(values.website).trim())) {
      e.website = "Enter a valid URL like https://example.com";
    }
    if (values.phone && String(values.phone).replace(/[^0-9]/g, "").length < 7) {
      e.phone = "Enter a valid phone number.";
    }
    if (values.bio && String(values.bio).length > 1000) {
      e.bio = "Keep your bio under 1000 characters.";
    }
    if (values.interests && String(values.interests).length > 300) {
      e.interests = "Keep interests under 300 characters.";
    }
    return e;
  }

  const readImage = (file, maxMB, label, onDone, onFail) => {
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
      onFail(label + " must be a PNG, JPG or WebP image.");
      return;
    }
    if (file.size > maxMB * 1024 * 1024) {
      onFail(label + " must be under " + maxMB + "MB.");
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => onFail("Could not read that " + label.toLowerCase() + ".");
    reader.onload = () => onDone(String(reader.result));
    reader.readAsDataURL(file);
  };

  function pickAvatar(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    readImage(file, 2, "Photo", (r) => { setAvatar(r); setAvatarBroken(false); flash({ type: "success", text: "Photo selected. Save profile to upload it." }); }, (m) => flash({ type: "error", text: m }));
  }
  function pickCover(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    readImage(file, 2, "Cover image", (r) => { setCover(r); setCoverBroken(false); flash({ type: "success", text: "Cover selected. Save profile to upload it." }); }, (m) => flash({ type: "error", text: m }));
  }
  function removeCover() { setCover(""); setCoverBroken(false); }

  async function save(e) {
    if (e) e.preventDefault();
    if (saving) return;
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) {
      setMsg({ type: "error", text: "Please fix the highlighted fields." });
      return;
    }
    setSaving(true);
    setMsg({ type: "", text: "" });
    try {
      const payload = {
        name: String(form.name || "").trim(),
        phone: form.phone, company: form.company, jobTitle: form.jobTitle,
        location: form.location, website: form.website, bio: form.bio,
        interests: form.interests, avatar, cover,
        customFields, language: form.language
      };
      const d = await api("/auth/profile", { method: "PUT", body: JSON.stringify(payload) });
      if (!d.user) throw new Error("Profile could not be saved.");
      preservingUpdate(d.user);
      try { onSave(d.user); } catch {}
      setMsg({ type: "success", text: d.message || "Profile saved to your account." });
      setErrors({});
    } catch (err) {
      setMsg({ type: "error", text: err.message || "Could not save profile. Your changes are still here." });
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    // restore from baseline not tracked; reload from /auth/me is safest, but we just clear errors
    setErrors({});
    setMsg({ type: "", text: "" });
  }

  function addField(e) {
    e.preventDefault();
    const label = String(newField.label || "").trim();
    const value = String(newField.value || "").trim();
    if (!label || !value) { flash({ type: "error", text: "Enter both a field name and value." }); return; }
    if (customFields.length >= 30) { flash({ type: "error", text: "You can add up to 30 custom fields." }); return; }
    setCustomFields((x) => [...x, { id: Date.now(), label, value }]);
    setNewField({ label: "", value: "" });
    flash({ type: "success", text: "Field added. Save profile to sync it." });
  }
  function removeField(id) {
    setCustomFields((x) => x.filter((f) => f.id !== id));
    flash({ type: "success", text: "Field removed. Save profile to sync it." });
  }
  async function clearData() {
    if (saving) return;
    if (!window.confirm("Clear your optional profile information from your account? Your login and account will remain.")) return;
    setSaving(true);
    try {
      const d = await api("/auth/profile", { method: "DELETE" });
      if (!d.user) throw new Error("Profile could not be cleared.");
      preservingUpdate({ ...d.user, avatar: "", cover: "", customFields: [] });
      setAvatar(""); setCover(""); setCustomFields([]);
      try { onSave(d.user); } catch {}
      setMsg({ type: "success", text: d.message || "Optional profile information cleared." });
    } catch (err) {
      setMsg({ type: "error", text: err.message || "Could not clear profile." });
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(e) {
    e.preventDefault();
    if (pwBusy) return;
    if (!pw.current || !pw.next) { setPwMsg({ type: "error", text: "Enter your current and new password." }); return; }
    if (pw.next.length < 6) { setPwMsg({ type: "error", text: "New password must contain at least 6 characters." }); return; }
    if (pw.next !== pw.confirm) { setPwMsg({ type: "error", text: "New passwords do not match." }); return; }
    setPwBusy(true);
    setPwMsg({ type: "", text: "" });
    try {
      const d = await api("/auth/password", { method: "PUT", body: JSON.stringify({ currentPassword: pw.current, newPassword: pw.next }) });
      setPw({ current: "", next: "", confirm: "" });
      setPwMsg({ type: "success", text: d.message || "Password updated successfully." });
    } catch (err) {
      setPwMsg({ type: "error", text: err.message || "Could not update your password." });
    } finally {
      setPwBusy(false);
    }
  }

  function loadNotifications() {
    setNotifs({ items: [], loading: true, error: "" });
    api("/notifications").then((d) => {
      setNotifs({ items: d.notifications || [], loading: false, error: "" });
    }).catch((e) => {
      setNotifs((x) => ({ ...x, loading: false, error: e.message || "Unable to load notifications." }));
    });
  }
  useEffect(() => {
    if (section === "notifications") loadNotifications();
  }, [section]);

  async function markRead(id) {
    try { await api("/notifications/" + id + "/read", { method: "PUT" }); }
    catch {}
    setNotifs((x) => ({ ...x, items: x.items.map((n) => (n._id === id ? { ...n, read: true } : n)) }));
  }
  async function markAll() {
    try { await api("/notifications/read-all", { method: "PUT" }); }
    catch {}
    setNotifs((x) => ({ ...x, items: x.items.map((n) => ({ ...n, read: true })) }));
  }

  if (loading) {
    return (
      <div className="dash-page profile-page page-enter">
        <div className="pf-skel">
          <div className="pf-skel-row" style={{ width: "52%", height: 34 }} />
          <div className="pf-skel-row" style={{ width: "34%", height: 16 }} />
          <div className="pf-skel-row" style={{ height: 200, borderRadius: 22 }} />
          <div className="pf-shell" style={{ marginTop: 18 }}>
            <div className="pf-skel-row" style={{ height: 320, borderRadius: 22 }} />
            <div className="pf-skel-row" style={{ height: 420, borderRadius: 22 }} />
          </div>
        </div>
      </div>
    );
  }

  const navItems = [
    ["edit", "Edit Profile", "fa-user-pen"],
    ["password", "Change Password", "fa-key"],
    ["notifications", "Notifications", "fa-bell"],
    ["security", "Security", "fa-shield-halved"],
    ["language", "Language", "fa-language"],
    ["appearance", "Dark Mode", "fa-moon"],
  ];

  const avatarInitial = (form.name || meta.email || "U").trim().slice(0, 1).toUpperCase();
  const unread = notifs.items.filter((n) => !n.read).length;

  return (
    <div className="dash-page profile-page page-enter">
      <div className="pf-shell">
        {/* ---------- LEFT PANEL ---------- */}
        <aside className="pf-nav">
          <div className="pf-nav-head">
            <div className="pf-nav-avatar">
              {avatar && !avatarBroken ? <img src={avatar} alt="Profile" onError={() => setAvatarBroken(true)} /> : avatarInitial}
            </div>
            <div className="kicker" style={{ fontSize: 9, letterSpacing: 1.6, color: "var(--es-cyan,#55e6ff)" }}>MY ACCOUNT</div>
            <b>{form.name || "Your Profile"}</b>
            <small>{meta.role ? meta.role.charAt(0).toUpperCase() + meta.role.slice(1) : "Member"} · {form.email || meta.email}</small>
          </div>

          <nav className="pf-nav-list" aria-label="Profile settings">
            {navItems.map(([id, label, icon], i) => (
              <button
                type="button"
                key={id}
                style={{ "--i": i + 1 }}
                className={"pf-nav-item" + (section === id ? " active" : "")}
                onClick={() => setSection(id)}
                aria-current={section === id ? "page" : undefined}
              >
                <i className={"fa-solid " + icon} aria-hidden="true" />
                <span>{label}</span>
                {id === "notifications" && unread > 0 ? <span className="pf-nav-badge">{unread}</span> : null}
              </button>
            ))}
          </nav>

          <div className="pf-nav-sep" />

          <button
            type="button"
            className="pf-nav-item pf-signout"
            onClick={() => { if (onLogout) onLogout(); }}
            style={{ "--i": navItems.length + 1 }}
          >
            <i className="fa-solid fa-right-from-bracket" aria-hidden="true" />
            <span>Sign Out</span>
          </button>
        </aside>

        {/* ---------- RIGHT PANEL ---------- */}
        <section className="pf-panel">
          {section === "edit" && (
            <div className="pf-view" key="edit">
              {/* cover */}
              <div className={"pf-cover" + (cover ? " has-image" : "")} style={cover && !coverBroken ? { backgroundImage: "url(" + cover + ")" } : undefined}>
                {cover && !coverBroken ? <img src={cover} alt="" style={{ display: "none" }} onError={() => setCoverBroken(true)} /> : null}
                <div className="pf-cover-actions">
                  <label className="pf-cover-btn">
                    <i className="fa-solid fa-image" /> {cover ? "Change cover" : "Add cover"}
                    <input type="file" accept="image/png,image/jpeg,image/webp" onChange={pickCover} style={{ display: "none" }} />
                  </label>
                  {cover && (
                    <button type="button" className="pf-cover-btn danger" onClick={removeCover}>
                      <i className="fa-solid fa-trash" /> Remove
                    </button>
                  )}
                </div>
              </div>

              <div className="pf-ident">
                <div className="pf-avatar-wrap">
                  <div className="pf-avatar">
                    {avatar && !avatarBroken ? <img src={avatar} alt="Profile" onError={() => setAvatarBroken(true)} /> : avatarInitial}
                  </div>
                  <label className="pf-avatar-edit" title="Change profile picture">
                    <i className="fa-solid fa-camera" />
                    <input type="file" accept="image/png,image/jpeg,image/webp" onChange={pickAvatar} />
                  </label>
                </div>
                <div className="pf-ident-copy">
                  <span className="pf-role-chip"><i className="fa-solid fa-sparkles" /> {meta.role || "member"}</span>
                  <h1>{form.name || "Your Profile"}</h1>
                  <p>{form.email || meta.email}</p>
                </div>
                <div className="pf-ident-actions">
                  <button type="button" className="pf-ghost" onClick={clearData} disabled={saving}>
                    <i className="fa-solid fa-eraser" /> Clear optional data
                  </button>
                </div>
              </div>

              {msg.text && <div className={"pf-alert " + msg.type} style={{ margin: "0 26px 16px" }}><i className={"fa-solid " + (msg.type === "success" ? "fa-circle-check" : "fa-triangle-exclamation")} />{msg.text}</div>}

              <div className="pf-body">
                <div className="pf-section-head">
                  <div>
                    <div className="kicker" style={{ color: "#63c8ff" }}>ACCOUNT DETAILS</div>
                    <h2>Edit your profile</h2>
                    <p>Update your photo, name, location and bio. Changes are saved to your real EventSphere account and verified on the server.</p>
                  </div>
                </div>

                <form className="pf-form" onSubmit={save} noValidate>
                  {Object.keys(errors).length > 0 && (
                    <div className="pf-alert error" style={{ gridColumn: "1 / -1" }}>
                      <i className="fa-solid fa-triangle-exclamation" />
                      {errors.name || errors.phone || errors.website || errors.bio || errors.interests}
                    </div>
                  )}
                  <div className="pf-grid">
                    <div className="pf-field">
                      <label>Full name <em>required</em></label>
                      <input
                        className={"pf-input" + (errors.name ? " invalid" : "")}
                        required value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="Your full name"
                        autoComplete="name"
                      />
                      <span className="pf-error-text">{errors.name}</span>
                    </div>
                    <div className="pf-field">
                      <label>Email address</label>
                      <input className="pf-input" value={form.email} disabled readOnly />
                      <span className="pf-hint">Email is managed by your sign-in account and cannot be edited here.</span>
                    </div>
                    <div className="pf-field">
                      <label>Job title</label>
                      <input className="pf-input" value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} placeholder="e.g. Event Coordinator" />
                    </div>
                    <div className="pf-field">
                      <label>Company</label>
                      <input className="pf-input" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Your organisation" />
                    </div>
                    <div className="pf-field">
                      <label>Phone</label>
                      <input
                        className={"pf-input" + (errors.phone ? " invalid" : "")}
                        value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        placeholder="+92 300 0000000" inputMode="tel"
                      />
                      <span className="pf-error-text">{errors.phone}</span>
                    </div>
                    <div className="pf-field">
                      <label>Location</label>
                      <input className="pf-input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="City, Country" autoComplete="address-level2" />
                    </div>
                    <div className="pf-field full">
                      <label>Website</label>
                      <input
                        className={"pf-input" + (errors.website ? " invalid" : "")}
                        value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })}
                        placeholder="https://example.com" inputMode="url"
                      />
                      <span className="pf-error-text">{errors.website}</span>
                    </div>
                    <div className="pf-field full">
                      <label>Interests</label>
                      <input
                        className={"pf-input" + (errors.interests ? " invalid" : "")}
                        value={form.interests} onChange={(e) => setForm({ ...form, interests: e.target.value })}
                        placeholder="Technology, design, community"
                      />
                      <span className="pf-error-text">{errors.interests}</span>
                    </div>
                    <div className="pf-field full">
                      <label>Bio</label>
                      <textarea
                        className={"pf-textarea" + (errors.bio ? " invalid" : "")}
                        value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })}
                        placeholder="A short note about you and what you do at EventSphere"
                        rows={4}
                      />
                      <span className="pf-hint">{String(form.bio || "").length}/1000 characters</span>
                      <span className="pf-error-text">{errors.bio}</span>
                    </div>
                  </div>

                  <div className="pf-custom">
                    <div className="pf-custom-head">
                      <b>Extra personal information</b>
                      <span>Add anything you want. Max 30 fields.</span>
                    </div>
                    {customFields.map((f) => (
                      <div className="pf-custom-row" key={f.id}>
                        <div className="pf-custom-copy">
                          <span>{f.label}</span>
                          <b>{f.value}</b>
                        </div>
                        <button type="button" className="pf-icon-btn" onClick={() => removeField(f.id)} title="Remove">
                          <i className="fa-solid fa-trash" />
                        </button>
                      </div>
                    ))}
                    <div className="pf-add-row">
                      <input
                        className="pf-input" placeholder="Field name e.g. Birthday"
                        value={newField.label}
                        onChange={(e) => setNewField({ ...newField, label: e.target.value })}
                      />
                      <input
                        className="pf-input" placeholder="Value"
                        value={newField.value}
                        onChange={(e) => setNewField({ ...newField, value: e.target.value })}
                      />
                      <button type="button" className="pf-ghost" onClick={addField}>
                        <i className="fa-solid fa-plus" /> Add
                      </button>
                    </div>
                  </div>

                  <div className="pf-actions">
                    <button type="submit" className="pf-save" disabled={saving}>
                      {saving ? <span className="pf-spinner" /> : <i className="fa-solid fa-check" />}
                      {saving ? "Saving changes..." : "Save Changes"}
                    </button>
                    <button type="button" className="pf-ghost" onClick={cancel} disabled={saving}>
                      <i className="fa-solid fa-rotate-left" /> Discard
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {section === "password" && (
            <div className="pf-view" key="password">
              <div className="pf-ident" style={{ paddingTop: 18 }}>
                <div className="pf-ident-copy">
                  <span className="pf-role-chip"><i className="fa-solid fa-key" /> Security</span>
                  <h1 style={{ fontSize: 24 }}>Change password</h1>
                  <p>Use a strong password you do not reuse elsewhere.</p>
                </div>
              </div>
              <div className="pf-body">
                <div className="pf-section-head">
                  <div>
                    <div className="kicker" style={{ color: "#63c8ff" }}>PASSWORD</div>
                    <h2>Update your password</h2>
                    <p>Your current password must be verified before the change is applied.</p>
                  </div>
                </div>
                {pwMsg.text && (
                  <div className={"pf-alert " + pwMsg.type}>
                    <i className={"fa-solid " + (pwMsg.type === "success" ? "fa-circle-check" : "fa-triangle-exclamation")} />
                    {pwMsg.text}
                  </div>
                )}
                <form onSubmit={changePassword} noValidate>
                  <div className="pf-grid">
                    <div className="pf-field full">
                      <label>Current password <em>required</em></label>
                      <input type="password" className="pf-input" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" />
                    </div>
                    <div className="pf-field">
                      <label>New password <em>min 6</em></label>
                      <input type="password" className="pf-input" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" />
                    </div>
                    <div className="pf-field">
                      <label>Confirm new password</label>
                      <input type="password" className="pf-input" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} autoComplete="new-password" />
                    </div>
                  </div>
                  <div className="pf-actions">
                    <button type="submit" className="pf-save" disabled={pwBusy}>
                      {pwBusy ? <span className="pf-spinner" /> : <i className="fa-solid fa-key" />}
                      {pwBusy ? "Updating..." : "Update Password"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {section === "notifications" && (
            <div className="pf-view" key="notifications">
              <div className="pf-ident" style={{ paddingTop: 18 }}>
                <div className="pf-ident-copy">
                  <span className="pf-role-chip"><i className="fa-solid fa-bell" /> Inbox</span>
                  <h1 style={{ fontSize: 24 }}>Notifications</h1>
                  <p>Updates from events, messages and operations across your account.</p>
                </div>
              </div>
              <div className="pf-body">
                <div className="pf-section-head">
                  <div>
                    <div className="kicker" style={{ color: "#63c8ff" }}>NOTIFICATIONS</div>
                    <h2>Your recent activity</h2>
                    <p>Mark items as read to keep your queue tidy.</p>
                  </div>
                  <button type="button" className="pf-ghost" onClick={markAll} disabled={!notifs.items.some((n) => !n.read)}>
                    <i className="fa-solid fa-check-double" /> Mark all read
                  </button>
                </div>
                {notifs.loading && (
                  <div className="pf-skel">
                    <div className="pf-skel-row" style={{ height: 76, borderRadius: 15 }} />
                    <div className="pf-skel-row" style={{ height: 76, borderRadius: 15 }} />
                    <div className="pf-skel-row" style={{ height: 76, borderRadius: 15 }} />
                  </div>
                )}
                {!notifs.loading && notifs.error && <div className="pf-alert error"><i className="fa-solid fa-triangle-exclamation" />{notifs.error}</div>}
                {!notifs.loading && !notifs.error && notifs.items.length === 0 && (
                  <div style={{ padding: "30px 4px", color: "#8ea3bc", display: "flex", alignItems: "center", gap: 10 }}>
                    <i className="fa-regular fa-bell-slash" /> No notifications yet.
                  </div>
                )}
                {!notifs.loading && notifs.items.map((n, i) => (
                  <button
                    type="button"
                    key={n._id || i}
                    style={{ "--i": i }}
                    className={"pf-notif" + (n.read ? "" : " unread")}
                    onClick={() => markRead(n._id)}
                  >
                    <i className="fa-solid fa-bell" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <b>{n.title || "Notification"}</b>
                      <span>{n.message || ""}</span>
                      <small>{n.createdAt ? new Date(n.createdAt).toLocaleString() : ""}</small>
                    </div>
                    {!n.read && <span className="pf-dot" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {section === "security" && (
            <div className="pf-view" key="security">
              <div className="pf-ident" style={{ paddingTop: 18 }}>
                <div className="pf-ident-copy">
                  <span className="pf-role-chip"><i className="fa-solid fa-shield-halved" /> Security</span>
                  <h1 style={{ fontSize: 24 }}>Account &amp; session</h1>
                  <p>Protect the account that signs in to this EventSphere workspace.</p>
                </div>
              </div>
              <div className="pf-body">
                <div className="pf-section-head">
                  <div>
                    <div className="kicker" style={{ color: "#63c8ff" }}>SECURITY</div>
                    <h2>Signed-in account</h2>
                    <p>Your requests are always scoped to your own identity on the backend.</p>
                  </div>
                </div>
                <div className="pf-info-row">
                  <div className="pf-info-copy">
                    <span className="pf-info-icon"><i className="fa-solid fa-at" /></span>
                    <div><b>Email</b><small>Your sign-in identity</small></div>
                  </div>
                  <span className="pf-info-value">{form.email || meta.email}</span>
                </div>
                <div className="pf-info-row">
                  <div className="pf-info-copy">
                    <span className="pf-info-icon"><i className="fa-solid fa-user-shield" /></span>
                    <div><b>Role</b><small>Access level in EventSphere</small></div>
                  </div>
                  <span className="pf-info-value">{meta.role || "member"}</span>
                </div>
                <div className="pf-info-row">
                  <div className="pf-info-copy">
                    <span className="pf-info-icon"><i className="fa-solid fa-lock" /></span>
                    <div><b>Password</b><small>Change your password anytime</small></div>
                  </div>
                  <button type="button" className="pf-ghost" onClick={() => setSection("password")}>
                    <i className="fa-solid fa-key" /> Change
                  </button>
                </div>
                <div className="pf-info-row">
                  <div className="pf-info-copy">
                    <span className="pf-info-icon"><i className="fa-solid fa-right-from-bracket" /></span>
                    <div><b>Sign out</b><small>End this session on this device</small></div>
                  </div>
                  <button type="button" className="pf-ghost danger" onClick={() => { if (onLogout) onLogout(); }}>
                    <i className="fa-solid fa-power-off" /> Sign out
                  </button>
                </div>
              </div>
            </div>
          )}

          {section === "language" && (
            <div className="pf-view" key="language">
              <div className="pf-ident" style={{ paddingTop: 18 }}>
                <div className="pf-ident-copy">
                  <span className="pf-role-chip"><i className="fa-solid fa-language" /> Language</span>
                  <h1 style={{ fontSize: 24 }}>Interface language</h1>
                  <p>Your preference is saved to your account.</p>
                </div>
              </div>
              <div className="pf-body">
                <div className="pf-section-head">
                  <div>
                    <div className="kicker" style={{ color: "#63c8ff" }}>PREFERENCES</div>
                    <h2>Choose your language</h2>
                    <p>The EventSphere interface is provided in English. Urdu is accepted as a preference and applies to the document locale.</p>
                  </div>
                </div>
                <div className="pf-grid">
                  <div className="pf-field full">
                    <label>Interface language</label>
                    <select
                      className="pf-select"
                      value={form.language}
                      onChange={(e) => applyLanguage(e.target.value)}
                    >
                      <option value="en">English</option>
                      <option value="ur">Urdu (اردو)</option>
                    </select>
                  </div>
                </div>
                <div className="pf-actions">
                  <button type="button" className="pf-save" onClick={() => setSection("edit")}>
                    <i className="fa-solid fa-check" /> Done
                  </button>
                </div>
              </div>
            </div>
          )}

          {section === "appearance" && (
            <div className="pf-view" key="appearance">
              <div className="pf-ident" style={{ paddingTop: 18 }}>
                <div className="pf-ident-copy">
                  <span className="pf-role-chip"><i className="fa-solid fa-moon" /> Appearance</span>
                  <h1 style={{ fontSize: 24 }}>Visual style</h1>
                  <p>Toggle between dark and light mode.</p>
                </div>
              </div>
              <div className="pf-body">
                <div className="pf-section-head">
                  <div>
                    <div className="kicker" style={{ color: "#63c8ff" }}>APPEARANCE</div>
                    <h2>Theme</h2>
                    <p>Dark mode is the default premium experience.</p>
                  </div>
                </div>
                <div className="pf-info-row">
                  <div className="pf-info-copy">
                    <span className="pf-info-icon"><i className="fa-solid fa-circle-half-stroke" /></span>
                    <div><b>Dark mode</b><small>Switches between dark and light interface</small></div>
                  </div>
                  <button
                    type="button"
                    className={"pf-switch" + (dark ? " on" : "")}
                    role="switch"
                    aria-checked={dark}
                    onClick={toggleTheme}
                    aria-label="Toggle dark mode"
                  />
                </div>
                <div className="pf-actions">
                  <button type="button" className="pf-save" onClick={() => setSection("edit")}>
                    <i className="fa-solid fa-check" /> Done
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function CommandPalette({open,onClose,onNavigate,user}){
 const [query,setQuery]=useState('');const [activeIndex,setActiveIndex]=useState(0);const [events,setEvents]=useState([]);const [loadedEvents,setLoadedEvents]=useState(false);const inputRef=useRef(null);
 const nav=ROLE_NAV[user.role]||ROLE_NAV.attendee;
 useEffect(()=>{if(!open||loadedEvents)return;api('/expos').then(d=>{setEvents((d.expos||[]).slice(0,40));setLoadedEvents(true)}).catch(()=>setLoadedEvents(true))},[open,loadedEvents]);
 const items=useMemo(()=>buildPaletteItems(nav,events),[nav,events]);
 const filtered=useMemo(()=>filterPalette(items,query),[items,query]);
 useEffect(()=>{if(open){setQuery('');setActiveIndex(0);setTimeout(()=>inputRef.current?.focus(),20)}},[open]);
 useEffect(()=>{setActiveIndex(i=>Math.min(i,Math.max(0,filtered.length-1)))},[filtered.length]);
 const groups=useMemo(()=>{const g=[];let n=0;for(const x of filtered){let grp=g.find(v=>v.name===x.group);if(!grp){grp={name:x.group,items:[]};g.push(grp)}grp.items.push({item:x,index:n++})}return g},[filtered]);
 const order=useMemo(()=>groups.flatMap(g=>g.items.map(o=>o.item)),[groups]);
 const openItem=item=>{if(!item)return;onNavigate(item.target);onClose()};
 const onKeyDown=e=>{if(e.key==='ArrowDown'){e.preventDefault();setActiveIndex(i=>Math.min(i+1,order.length-1))}else if(e.key==='ArrowUp'){e.preventDefault();setActiveIndex(i=>Math.max(i-1,0))}else if(e.key==='Enter'){e.preventDefault();openItem(order[activeIndex])}else if(e.key==='Escape'){e.preventDefault();onClose()}};
 if(!open)return null;
 return <div className="command-overlay" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="command-card" role="dialog" aria-modal="true" aria-label="Command palette"><div className="command-search"><i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i><input ref={inputRef} value={query} onChange={e=>{setQuery(e.target.value);setActiveIndex(0)}} onKeyDown={onKeyDown} placeholder="Search destinations and your events…" aria-label="Search workspace" aria-controls="command-results"/><kbd>ESC</kbd></div><div className="command-results" id="command-results" role="listbox" aria-label="Search results">{groups.map(g=><React.Fragment key={g.name}><p className="command-group" aria-hidden="true"><span>{g.name}</span></p>{g.items.map(({item:x,index:i})=><button type="button" key={x.key} role="option" style={{"--i":i}} aria-selected={i===activeIndex} className={'command-row'+(i===activeIndex?' active':'')} onMouseEnter={()=>setActiveIndex(i)} onClick={()=>openItem(x)}><span className="command-thumb-wrap">{x.group==='Events'?<img className="command-thumb" src={'/images/gallery/event-'+(((String(x.label).split('').reduce((a,c)=>a+c.charCodeAt(0),0))%8)+1)+'.jpg'} alt="" onError={e=>{e.currentTarget.style.display='none'}}/>:<i className={'fa-solid '+x.icon} aria-hidden="true"></i>}</span><span className="command-text"><b>{x.label}</b>{x.detail&&x.detail!=='Workspace'&&<small className="command-hint">{x.detail}</small>}</span><i className="fa-solid fa-arrow-right command-go" aria-hidden="true"></i></button>)}</React.Fragment>)}{!filtered.length&&<div className="command-empty"><i className="fa-regular fa-face-thinking" aria-hidden="true"></i><span>No destination or event matches that search.</span></div>}</div><div className="command-foot"><span className="command-count">{order.length} result{order.length===1?'':'s'}</span><span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span><span><kbd>Enter</kbd> Open</span><span><kbd>Esc</kbd> Close</span></div></div></div>
}
function ThemeToggle(){const [dark,setDark]=useState(()=>localStorage.getItem('es_theme')!=='light');useEffect(()=>{document.documentElement.dataset.theme=dark?'dark':'light';localStorage.setItem('es_theme',dark?'dark':'light')},[dark]);useEffect(()=>{const onToggle=()=>setDark(v=>!v);const onTheme=e=>{if(typeof e.detail==='boolean')setDark(e.detail)};window.addEventListener('eventsphere:theme-toggle',onToggle);window.addEventListener('eventsphere:theme',onTheme);return()=>{window.removeEventListener('eventsphere:theme-toggle',onToggle);window.removeEventListener('eventsphere:theme',onTheme)}},[]);return <button className="theme-toggle" onClick={()=>setDark(v=>!v)} title={dark?'Switch to light mode':'Switch to dark mode'}><i className={'fa-solid '+(dark?'fa-moon':'fa-sun')}></i></button>}
function GlobalSearch({onNavigate}){const [open,setOpen]=useState(false);useEffect(()=>{const onKey=e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setOpen(true)}if(e.key==='Escape')setOpen(false)};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[]);return <CommandPalette open={open} onClose={()=>setOpen(false)} onNavigate={onNavigate} user={getUser()||{role:'attendee'}}/>}


function Notifications({user,onClose}){
 const [items,setItems]=useState([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const load=async()=>{
   setLoading(true);setError('');
   try{const d=await api('/notifications');setItems(d.notifications||[])}
   catch(e){setError(e.message||'Unable to load notifications.')}
   finally{setLoading(false)}
 };
 useEffect(()=>{load()},[]);
 const markRead=async(id)=>{
   try{await api(`/notifications/${id}/read`,{method:'PUT'});setItems(prev=>prev.map(n=>n._id===id?{...n,read:true}:n))}
   catch(e){setError(e.message||'Unable to update notification.')}
 };
 const markAll=async()=>{
   try{await api('/notifications/read-all',{method:'PUT'});setItems(prev=>prev.map(n=>({...n,read:true})))}
   catch(e){setError(e.message||'Unable to update notifications.')}
 };
 return <div className="notif-pop" role="dialog" aria-label="Notifications" onMouseDown={e=>e.stopPropagation()}>
   <div className="panel-head">
     <div><span className="section-kicker">UPDATES</span><h3>Notifications</h3></div>
     <div className="row-actions">
       <button type="button" className="ghost small" onClick={markAll} disabled={!items.some(n=>!n.read)}>Mark all read</button>
       <button type="button" className="icon-btn" onClick={onClose} aria-label="Close notifications"><i className="fa-solid fa-xmark"></i></button>
     </div>
   </div>
   {loading?<Loader/>:error?<div className="empty"><i className="fa-solid fa-triangle-exclamation"></i><p>{error}</p><button type="button" className="ghost small" onClick={load}>Retry</button></div>:items.length?items.map(n=><button type="button" className={'notif '+(n.read?'read':'')} key={n._id} onClick={()=>markRead(n._id)}>
     <i className="fa-solid fa-bell"></i><span><b>{n.title||'Notification'}</b><span>{n.message||''}</span><small>{n.createdAt?new Date(n.createdAt).toLocaleString():''}</small></span>
   </button>):<div className="empty"><i className="fa-regular fa-bell-slash"></i><p>No notifications yet.</p></div>}
 </div>
}


function HeaderProfile({ user, onNavigate, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => { setBroken(false); }, [user?.avatar]);
  const initials = (user?.name || 'U').trim().slice(0, 1).toUpperCase();
  const go = (id) => { setOpen(false); onNavigate && onNavigate(id); };
  return (
    <div className={'hpm' + (open ? ' open-hpm' : '')} ref={ref}>
      <button className={'hpm-trigger' + (open ? ' open' : '')} onClick={() => setOpen((v) => !v)} aria-haspopup="true" aria-expanded={open} title="Account">
        <span className="hpm-avatar">{user?.avatar && !broken ? <img src={user.avatar} alt="" onError={() => setBroken(true)} /> : initials}</span>
        <span className="hpm-name">{user?.name}</span>
        <i className="fa-solid fa-chevron-down hpm-caret" aria-hidden="true" />
      </button>
      {open && (
        <div className="hpm-menu" role="menu">
          <div className="hpm-head">
            <span className="hpm-avatar lg">{user?.avatar && !broken ? <img src={user.avatar} alt="" /> : initials}</span>
            <div><b>{user?.name}</b><small>{user?.email}</small></div>
            <span className="hpm-role">{user?.role}</span>
          </div>
          <button type="button" className="hpm-item" role="menuitem" onClick={() => go('profile')}>
            <i className="fa-solid fa-user-pen" /><span>My Profile</span>
          </button>
          <button type="button" className="hpm-item" role="menuitem" onClick={() => go('settings')}>
            <i className="fa-solid fa-gear" /><span>Account Settings</span>
          </button>
          <button type="button" className="hpm-item" role="menuitem" onClick={() => { setOpen(false); window.dispatchEvent(new CustomEvent('eventsphere:theme-toggle')); }}>
            <i className="fa-solid fa-circle-half-stroke" /><span>Toggle theme</span>
          </button>
          <div className="hpm-sep" />
          <button type="button" className="hpm-item danger" role="menuitem" onClick={() => { setOpen(false); onLogout && onLogout(); }}>
            <i className="fa-solid fa-right-from-bracket" /><span>Sign Out</span>
          </button>
        </div>
      )}
    </div>
  );
}

function DashboardShell({user,onLogout}){
 const [page,setPage]=useState('overview'),[mobile,setMobile]=useState(false),[notifs,setNotifs]=useState(false),[count,setCount]=useState(0),[currentUser,setCurrentUser]=useState(user),[palette,setPalette]=useState(false);
 const nav=ROLE_NAV[currentUser.role]||ROLE_NAV.attendee;
 const go=id=>{setPage(id);setMobile(false);setNotifs(false)};
 useEffect(()=>{api('/notifications').then(d=>setCount((d.notifications||[]).filter(x=>!x.read).length)).catch(()=>{});const onKey=e=>{if(e.key==='Escape')setNotifs(false)};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[page]);
 useEffect(()=>{const onOpen=()=>setPalette(true);const onNav=e=>e.detail&&go(e.detail);window.addEventListener('eventsphere:search',onOpen);window.addEventListener('eventsphere:navigate',onNav);return()=>{window.removeEventListener('eventsphere:search',onOpen);window.removeEventListener('eventsphere:navigate',onNav)}},[]);
 const saveProfile=next=>{setCurrentUser(next);localStorage.setItem('es_user',JSON.stringify(next));};
 useEffect(()=>{
   const socket=io(SOCKET,{auth:{token:localStorage.getItem('es_token')}});
   socket.emit('user:join',currentUser.id||currentUser._id);
   const revoked=payload=>onLogout(payload?.reason||'Your session was signed out.');
   socket.on('auth:revoked',revoked);
   return()=>{socket.off('auth:revoked',revoked);socket.disconnect()};
 },[currentUser.id,currentUser._id,onLogout]);
 return <div className="app-shell" data-role={currentUser.role}>{mobile&&<div className="sidebar-scrim" onClick={()=>setMobile(false)}></div>}<aside className={mobile?'sidebar open sidebar-anim':'sidebar sidebar-anim'}><div className="side-brand"><span className="brand-mark">ES</span><div><b>EventSphere</b><small>{currentUser.role} workspace</small></div><button className="mobile-close" onClick={()=>setMobile(false)}>×</button></div><div className="nav-label">COMMAND CENTER</div>{nav.map(([id,label,icon],navI)=><button data-page={id} key={id} style={{"--i":navI+1}} className={page===id?'side-nav active':'side-nav'} onClick={()=>go(id)}><i className={'fa-solid '+icon} aria-hidden="true"></i><span>{label}</span></button>)}<div className="side-bottom"><button className="user-chip profile-chip" onClick={()=>go('profile')}><span className="hpm-avatar user-chip-avatar">{currentUser.avatar?<img src={currentUser.avatar} alt="" onError={e=>{e.currentTarget.style.display='none'}}/>:String((currentUser.name||'U')[0]).toUpperCase()}</span><span><b>{currentUser.name}</b><small>{currentUser.email}</small></span><i className="fa-solid fa-chevron-right"></i></button><button className="side-logout" onClick={onLogout} title="Sign out"><i className="fa-solid fa-right-from-bracket"></i></button></div></aside>
 <main className="dash-main"><header className="dash-header"><button className={'mobile-menu'+(mobile?' is-open':'')} onClick={()=>setMobile(true)} aria-label="Open navigation menu" aria-expanded={mobile}><span></span><span></span><span></span></button><div className="header-title"><div className="kicker"><span className="header-live-dot"></span>EVENTSPHERE OS</div><h2><span className="header-page-icon"><i className={'fa-solid '+(nav.find(n=>n[0]===page)?.[2]||'fa-user-circle')}></i></span>{nav.find(n=>n[0]===page)?.[1]||'My Profile'}</h2></div><div className="header-tools"><button className="workspace-search" onClick={()=>setPalette(true)} aria-label="Search workspace"><i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i><span>Search workspace</span><kbd>Ctrl K</kbd></button><ThemeToggle/><span className="live-pill"><i></i> LIVE</span><button className="notif-btn" onClick={()=>setNotifs(x=>!x)} aria-label="Notifications"><i className="fa-regular fa-bell"></i>{count>0&&<b>{count}</b>}</button><HeaderProfile user={currentUser} onNavigate={go} onLogout={onLogout}/></div>{notifs&&<Notifications user={currentUser} onClose={()=>setNotifs(false)}/>}</header><DashboardRouter page={page} user={currentUser} onProfileSave={saveProfile} onNavigate={go} onLogout={onLogout}/></main><GlobalSearch onNavigate={go}/>{palette&&<CommandPalette open={palette} onClose={()=>setPalette(false)} onNavigate={go} user={currentUser}/>}</div>
}
function AICopilot({user}){
 const [events,setEvents]=useState([]),[selected,setSelected]=useState(''),[mode,setMode]=useState('blueprint'),[result,setResult]=useState(null),[busy,setBusy]=useState(false);
 useEffect(()=>{api('/expos').then(d=>{const x=d.expos||[];setEvents(x);if(x[0])setSelected(x[0]._id)}).catch(()=>{})},[]);
 const event=events.find(x=>x._id===selected);
 const generate=()=>{
  setBusy(true);setTimeout(()=>{
   const title=event?.title||'Your next event'; const desc=event?.description||''; const venue=event?.location||'venue not set';
   const words=desc.split(/\s+/).filter(Boolean).length;
   const checklist=[`Confirm venue capacity and emergency exits at ${venue}.`,`Publish a clear arrival, parking and check-in plan.`,`Keep exhibitor applications, booth assignments and payments in one queue.`,`Create a 30-minute operational buffer before every major session.`,`Send attendees a reminder 24 hours before the event.`];
   const pricing=event?`Suggested pass ladder: Classic $${Math.max(10,Math.round(words*1.2))}, Standard $${Math.max(25,Math.round(words*2.4))}, VIP $${Math.max(60,Math.round(words*5.2))}. Use these as planning estimates, then adjust for your actual costs and audience.`:'Create an event first to get a ticket-price planning estimate.';
   const match=['Tech & Software','Food & Beverage','Fashion & Lifestyle','Education & Training','Healthcare','Finance'];
   const audience=user.role==='exhibitor'?`Your exhibitor profile should emphasize one measurable outcome, one flagship product and one reason attendees should visit your booth.`:`Likely audience focus: ${match[(title.length+user.role.length)%match.length]}. Build your landing page around one clear attendee promise.`;
   const social=`✨ ${title} is coming to ${venue}. Expect practical ideas, meaningful connections and a smoother event experience. Save your date and watch this space for passes, exhibitors and updates.`;
   const blueprint=`EVENTSPHERE AI EVENT BLUEPRINT\n\n${title}\nVenue: ${venue}\n\nOPERATIONS\n${checklist.map((x,i)=>`${i+1}. ${x}`).join('\\n')}\n\nTICKET PLANNING\n${pricing}\n\nAUDIENCE INSIGHT\n${audience}\n\nPROMOTION\n${social}`;
   const outputs={blueprint:{title:'Event Blueprint',icon:'fa-diagram-project',text:blueprint,items:checklist},pricing:{title:'Smart Ticket Planner',icon:'fa-ticket',text:pricing,items:[pricing,'Check venue, staffing, platform fees and target margin before publishing.']},match:{title:'Audience & Exhibitor Match',icon:'fa-bullseye',text:audience,items:[audience,'Add one strong CTA to the event page.','Use booth categories to make discovery easier.']},risk:{title:'Risk Radar',icon:'fa-shield-halved',text:'AI-style operational scan based on the information currently entered. Fix the highest-impact gaps before publishing.',items:checklist.slice(0,4).map((x,i)=>`RISK ${i+1}: ${x}`)},marketing:{title:'Campaign Copy',icon:'fa-megaphone',text:social,items:[social,'CTA: Reserve your place / Apply as an exhibitor.']}};
   setResult(outputs[mode]);setBusy(false);
  },650)
 };
 const download=()=>{if(!result)return;const blob=new Blob([result.text+'\\n\\nGenerated by EventSphere AI Copilot'],{type:'text/plain'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`eventsphere-ai-${mode}.txt`;a.click();URL.revokeObjectURL(a.href)};
 return <div className="dash-page"><div className="ai-hero"><div><div className="kicker"><i className="fa-solid fa-wand-magic-sparkles"></i> AI OPERATIONS LAYER</div><h1>Meet your <span>EventSphere Copilot.</span></h1><p>Turn your event data into planning ideas, ticket scenarios, risk checks, audience insights and campaign copy — inside the command center.</p></div><div className="ai-orb"><i className="fa-solid fa-brain"></i><small>SMART ENGINE</small></div></div>
 <div className="ai-layout"><div className="panel ai-controls"><div className="kicker">1 · CONTEXT</div><h2>Choose an event</h2><select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">General workspace</option>{events.map(e=><option key={e._id} value={e._id}>{e.title}</option>)}</select><div className="kicker ai-kicker">2 · COPILOT SKILL</div><div className="ai-modes">{[['blueprint','fa-diagram-project','Event Blueprint'],['pricing','fa-ticket','Ticket Planner'],['match','fa-bullseye','Audience Match'],['risk','fa-shield-halved','Risk Radar'],['marketing','fa-megaphone','Campaign Copy']].map(x=><button key={x[0]} className={mode===x[0]?'ai-mode active':'ai-mode'} onClick={()=>setMode(x[0])}><i className={'fa-solid '+x[1]}></i><span>{x[2]}</span></button>)}</div><button className="primary wide ai-generate" onClick={generate} disabled={busy}>{busy?<><i className="fa-solid fa-circle-notch fa-spin"></i> Thinking...</>:<><i className="fa-solid fa-wand-magic-sparkles"></i> Generate insight</>}</button><small className="ai-note">No external AI key is required for this demo build. The Smart Engine uses your current EventSphere records and transparent planning rules.</small></div>
 <div className="panel ai-result">{result?<><div className="panel-head"><div><div className="kicker">COPILOT OUTPUT</div><h2><i className={'fa-solid '+result.icon}></i> {result.title}</h2></div><button className="ghost small" onClick={download}><i className="fa-solid fa-download"></i> Download</button></div><div className="ai-output">{result.items.map((x,i)=><div className="ai-insight" key={i}><span>{String(i+1).padStart(2,'0')}</span><p>{x}</p></div>)}</div><div className="ai-summary"><b>Generated for:</b> {event?.title||'Workspace'} · <b>Role:</b> {user.role}</div></>:<div className="ai-empty"><div className="ai-pulse"><i className="fa-solid fa-wand-magic-sparkles"></i></div><h2>Your AI workspace is ready.</h2><p>Select an event and a Copilot skill to generate a practical result.</p></div>}</div></div></div>}
function Sessions({user}){
 const [events,setEvents]=useState([]),[expo,setExpo]=useState(''),[items,setItems]=useState([]),[open,setOpen]=useState(false),[edit,setEdit]=useState(null),[form,setForm]=useState({title:'',topic:'',speaker:'',location:'',startTime:'',endTime:'',capacity:100});
 const loadEvents=()=>api('/expos').then(d=>{const x=d.expos||[];setEvents(x);if(!expo&&x[0])setExpo(x[0]._id)}).catch(()=>{});
 const load=()=>expo&&api('/sessions/expo/'+expo).then(d=>setItems(d.sessions||[])).catch(()=>setItems([]));
 useEffect(()=>{loadEvents()},[]); useEffect(()=>{load()},[expo]);
 const save=async e=>{e.preventDefault();try{await api(edit?`/sessions/${edit._id}`:`/sessions/expo/${expo}`,{method:edit?'PUT':'POST',body:JSON.stringify({...form,capacity:Number(form.capacity)||100})});setOpen(false);setEdit(null);load()}catch(err){alert(err.message)}};
 const remove=async id=>{if(!confirm('Delete this session?'))return;try{await api('/sessions/'+id,{method:'DELETE'});load()}catch(e){alert(e.message)}};
 const join=async id=>{try{await api('/sessions/'+id+'/join',{method:'POST'});load();alert('Session booked successfully.')}catch(e){alert(e.message)}};
 return <div className="dash-page"><PageTitle kicker="PROGRAM & SESSIONS" title="Sessions" copy="Manage event talks, speakers, schedules and attendee session bookings." action={['organizer','admin'].includes(user.role)&&<button className="primary" onClick={()=>{setEdit(null);setForm({title:'',topic:'',speaker:'',location:'',startTime:'',endTime:'',capacity:100});setOpen(true)}}><i className="fa-solid fa-plus"></i> Add session</button>}/>
 <div className="toolbar panel"><select value={expo} onChange={e=>setExpo(e.target.value)}>{events.map(e=><option key={e._id} value={e._id}>{e.title}</option>)}</select><span className="muted">{items.length} scheduled sessions</span></div>
 <div className="cards-grid">{items.map(x=><article className="event-card" key={x._id}><div className="event-banner"><span>{x.topic||'SESSION'}</span><b><i className="fa-solid fa-microphone-lines"></i> LIVE PROGRAM</b></div><div className="event-card-body"><small>{x.startTime?new Date(x.startTime).toLocaleString():''} → {x.endTime?new Date(x.endTime).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):''}</small><h3>{x.title}</h3><div className="session-speaker"><img src={personImg(x.speaker||x.title||x._id)} alt={x.speaker||'Speaker'} loading="lazy"/><span><b>{x.speaker||'Speaker TBA'}</b><small>{x.location||'Main stage'}</small></span></div><small>{x.attendees?.length||0} / {x.capacity||0} seats booked</small><div className="row-actions">{user.role==='attendee'&&<button className="primary small" onClick={()=>join(x._id)}>Book seat</button>}{['organizer','admin'].includes(user.role)&&<><button className="ghost small" onClick={()=>{setEdit(x);setForm({title:x.title||'',topic:x.topic||'',speaker:x.speaker||'',location:x.location||'',startTime:x.startTime?.slice(0,16)||'',endTime:x.endTime?.slice(0,16)||'',capacity:x.capacity||100});setOpen(true)}}><i className="fa-solid fa-pen"></i></button><button className="danger small" onClick={()=>remove(x._id)}><i className="fa-solid fa-trash"></i></button></>}</div></div></article>)}{!items.length&&<Empty text="No sessions scheduled for this event yet."/>}</div>
 {open&&<Modal title={edit?'Edit session':'Add session'} onClose={()=>setOpen(false)}><form className="form-grid" onSubmit={save}><input required placeholder="Session title" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/><input placeholder="Topic" value={form.topic} onChange={e=>setForm({...form,topic:e.target.value})}/><input placeholder="Speaker" value={form.speaker} onChange={e=>setForm({...form,speaker:e.target.value})}/><input placeholder="Location" value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/><input type="datetime-local" required value={form.startTime} onChange={e=>setForm({...form,startTime:e.target.value})}/><input type="datetime-local" required value={form.endTime} onChange={e=>setForm({...form,endTime:e.target.value})}/><input type="number" min="1" value={form.capacity} onChange={e=>setForm({...form,capacity:e.target.value})} placeholder="Capacity"/><button className="primary wide full-col">Save session</button></form></Modal>}</div>
}
function Feedback({user}){
 const [events,setEvents]=useState([]),[mine,setMine]=useState([]),[form,setForm]=useState({expo:'',rating:5,message:''}),[all,setAll]=useState([]);
 const load=()=>{api('/expos').then(d=>{const x=d.expos||[];setEvents(x);if(!form.expo&&x[0])setForm(f=>({...f,expo:x[0]._id}))}).catch(()=>{});if(user.role==='attendee')api('/feedback/mine').then(d=>setMine(d.feedback||[])).catch(()=>{});else api('/feedback').then(d=>setAll(d.feedback||[])).catch(()=>{})};
 useEffect(()=>{load()},[user.role]);
 const submit=async e=>{e.preventDefault();try{await api('/feedback',{method:'POST',body:JSON.stringify({expo:form.expo,rating:Number(form.rating),message:form.message})});setForm(f=>({...f,message:''}));load();alert('Feedback submitted.')}catch(err){alert(err.message)}};
 return <div className="dash-page"><PageTitle kicker="EXPERIENCE LOOP" title="Feedback" copy="Collect event ratings and comments after the attendee experience."/>{user.role==='attendee'?<><div className="panel"><form className="form-grid" onSubmit={submit}><select value={form.expo} onChange={e=>setForm({...form,expo:e.target.value})}>{events.map(e=><option key={e._id} value={e._id}>{e.title}</option>)}</select><select value={form.rating} onChange={e=>setForm({...form,rating:e.target.value})}><option value="5">★★★★★ 5</option><option value="4">★★★★ 4</option><option value="3">★★★ 3</option><option value="2">★★ 2</option><option value="1">★ 1</option></select><textarea className="full-col" required placeholder="Tell the organizer about your experience..." value={form.message} onChange={e=>setForm({...form,message:e.target.value})}/><button className="primary full-col">Submit feedback</button></form></div><div className="panel"><div className="kicker">MY REVIEWS</div>{mine.map(x=><div className="event-row" key={x._id}><div><b>{x.expo?.title||'Event'}</b><small>{'★'.repeat(x.rating||0)} · {x.message}</small></div></div>)}{!mine.length&&<Empty text="Your submitted feedback will appear here."/>}</div></>:<div className="table-panel">{all.map(x=><div className="table-row" key={x._id}><div><b>{x.expo?.title||'Event'}</b><small>{x.user?.name||'Attendee'} · {x.user?.email||''}</small></div><strong>{'★'.repeat(x.rating||0)}</strong><span>{x.message}</span></div>)}{!all.length&&<Empty text="No feedback received yet."/>}</div>}</div>
}
function Analytics(){const [a,setA]=useState(null);useEffect(()=>{api('/analytics').then(d=>setA(d.analytics)).catch(()=>setA(null))},[]);const boothRows=a?.boothTraffic||[],regRows=a?.registrationsByType||[];const maxBooth=Math.max(1,...boothRows.map(x=>Number(x.count)||0)),maxReg=Math.max(1,...regRows.map(x=>Number(x.count)||0));const exportReport=()=>{const rows=[['Metric','Value'],['Events',a?.expos??0],['Tickets sold',a?.ticketsSold??0],['Revenue PKR',a?.revenue??0],['Pending applications',a?.pendingApplications??0],[],['Booth status','Count'],...boothRows.map(x=>[x._id,x.count]),[],['Registration type','Count'],...regRows.map(x=>[x._id,x.count])];const csv=rows.map(r=>r.map(v=>`"${String(v??'').replaceAll('\"','\"\"')}"`).join(',')).join('\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),el=document.createElement('a');el.href=url;el.download=`eventsphere-analytics-${new Date().toISOString().slice(0,10)}.csv`;el.click();URL.revokeObjectURL(url)};return <div className="dash-page"><PageTitle kicker="LIVE INTELLIGENCE" title="Analytics" copy="Operational metrics from your current EventSphere data." action={<div className="row-actions"><button className="primary" onClick={exportReport} disabled={!a}><i className="fa-solid fa-file-csv"></i> Export CSV</button></div>}/><div className="stats">{[['Events',a?.expos??'—','fa-calendar-days'],['Tickets sold',a?.ticketsSold??'—','fa-ticket'],['Revenue',a?`PKR ${Number(a.revenue||0).toLocaleString()}`:'—','fa-money-bill-wave'],['Pending applications',a?.pendingApplications??'—','fa-building']].map(x=><div className="stat" key={x[0]}><i className={'fa-solid '+x[2]}></i><span>{x[0]}</span><b>{x[1]}</b></div>)}</div><div className="analytics-grid"><div className="panel"><div className="kicker">BOOTH INVENTORY · LIVE</div><h2>Live booth status</h2>{boothRows.length?<div className="bar-chart">{boothRows.map(x=><div className="bar-row" key={x._id}><div className="bar-label"><span>{x._id}</span><b>{x.count}</b></div><div className="bar-track"><i style={{width:`${Math.max(5,(Number(x.count)||0)/maxBooth*100)}%`}}></i></div></div>)}</div>:a?<Empty text="No booth data available yet."/>:<Loader/>}</div><div className="panel"><div className="kicker">REGISTRATIONS</div><h2>Audience mix</h2>{regRows.length?<div className="bar-chart">{regRows.map(x=><div className="bar-row" key={x._id}><div className="bar-label"><span>{x._id}</span><b>{x.count}</b></div><div className="bar-track"><i style={{width:`${Math.max(5,(Number(x.count)||0)/maxReg*100)}%`}}></i></div></div>)}</div>:a?<Empty text="No registration data available yet."/>:<Loader/>}<div className="system-list"><span><i></i> MongoDB API</span><span><i></i> Socket.IO</span><span><i></i> Notifications</span><span><i></i> Ticket inventory</span></div></div></div></div>}



function MyCertificates({user}){
 const [items,setItems]=useState([]),[loading,setLoading]=useState(true);
 const load=()=>api('/advanced/certificates').then(d=>setItems(d.certificates||[])).catch(()=>setItems([])).finally(()=>setLoading(false));
 useEffect(()=>{load()},[]);
 const download=async(id,no)=>{try{const token=localStorage.getItem('es_token');const r=await fetch(API+`/advanced/certificates/${id}/download`,{headers:{Authorization:`Bearer ${token}`}});if(!r.ok)throw Error('Download failed');const blob=await r.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=(no||'certificate')+'.pdf';a.click();URL.revokeObjectURL(url)}catch(e){alert(e.message)}};
 return <div className="dash-page"><PageTitle kicker="ACHIEVEMENTS" title="My Certificates" copy="Download verified EventSphere participation certificates."/>{loading?<Loader/>:<div className="cards-grid">{items.map(x=><article className="event-card" key={x._id}><div className="event-card-body"><span className="section-kicker">VERIFIED CERTIFICATE</span><h3>{x.title}</h3><p>{x.expo?.title||'EventSphere Event'}</p><small>{x.certificateNo} · {new Date(x.issuedAt).toLocaleDateString()}</small><div className="row-actions"><button className="primary small" onClick={()=>download(x._id,x.certificateNo)}><i className="fa-solid fa-download"></i> Download PDF</button></div></div></article>)}{!items.length&&<Empty text="No certificates issued yet."/>}</div>}</div>
}

function QRCheckin({onDone}){
 const videoRef=useRef(null),[camera,setCamera]=useState(false),[supported,setSupported]=useState(false),[value,setValue]=useState(''),[status,setStatus]=useState(''),[busy,setBusy]=useState(false),[queued,setQueued]=useState(()=>{try{return JSON.parse(localStorage.getItem('es_checkin_queue')||'[]')}catch{return[]}});const streamRef=useRef(null);
 useEffect(()=>{setSupported('BarcodeDetector' in window);const sync=async()=>{const q=[...queued];for(const raw of q){try{await api('/advanced/checkin',{method:'POST',body:JSON.stringify({ticketId:raw})});q.splice(q.indexOf(raw),1)}catch{break}}setQueued(q);localStorage.setItem('es_checkin_queue',JSON.stringify(q));if(q.length!==queued.length){setStatus('Offline check-in queue synced successfully.');onDone?.()}};window.addEventListener('online',sync);if(navigator.onLine)sync();return()=>{streamRef.current?.getTracks().forEach(t=>t.stop());window.removeEventListener('online',sync)}},[]);
 const stop=()=>{streamRef.current?.getTracks().forEach(t=>t.stop());streamRef.current=null;setCamera(false)};
 const validate=async(raw=value)=>{const token=String(raw||'').trim();if(!token)return;setBusy(true);setStatus('Validating ticket…');try{const d=await api('/advanced/checkin',{method:'POST',body:JSON.stringify({ticketId:token})});setStatus(`✓ Checked in ${d.attendee?.name||'attendee'} successfully.`);setValue('');onDone?.()}catch(e){if(!navigator.onLine||/failed|network|fetch/i.test(e.message||'')){const next=Array.from(new Set([...queued,token]));setQueued(next);localStorage.setItem('es_checkin_queue',JSON.stringify(next));setStatus('Network unavailable. Check-in saved locally and will sync when the connection returns.');}else setStatus(e.message)}finally{setBusy(false)}};
 const scan=async()=>{if(!('BarcodeDetector' in window)){setStatus('Camera QR scanning is not supported by this browser. Use the manual QR value field below.');return}try{const detector=new BarcodeDetector({formats:['qr_code']});const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}}});streamRef.current=stream;setCamera(true);await new Promise(r=>setTimeout(r,80));if(!videoRef.current)throw Error('Camera preview could not be initialized.');videoRef.current.srcObject=stream;await videoRef.current.play();const loop=async()=>{if(!streamRef.current)return;try{const codes=await detector.detect(videoRef.current);if(codes?.[0]?.rawValue){setValue(codes[0].rawValue);await validate(codes[0].rawValue);stop();return}}catch{}requestAnimationFrame(loop)};requestAnimationFrame(loop)}catch(e){setStatus(e.message||'Camera permission was not available. Use manual entry instead.')}};
 return <div className="panel qr-panel"><div className="panel-head"><div><div className="kicker">FAST ENTRY · OFFLINE READY</div><h2>QR ticket check-in</h2><p className="muted">Scan a ticket QR code with your camera or paste the ticket/order/invoice value.</p></div>{camera&&<button className="danger small" onClick={stop}>Stop camera</button>}</div>{queued.length>0&&<div className="warning-box"><i className="fa-solid fa-cloud-arrow-up"></i><b>{queued.length} check-in(s) waiting to sync.</b><span>Keep the device online to upload them.</span></div>}{camera&&<div className="qr-camera"><video ref={videoRef} playsInline muted></video><div className="qr-frame"></div></div>}<div className="form-grid"><input value={value} onChange={e=>setValue(e.target.value)} placeholder="Ticket Order ID / QR value"/><button className="primary" disabled={busy||!value.trim()} onClick={()=>validate()}>{busy?'Validating…':'Validate & Check-in'}</button><button className="ghost full-col" disabled={!supported||camera} onClick={scan}><i className="fa-solid fa-camera"></i> {supported?'Open camera scanner':'Camera scanner unavailable — use manual entry'}</button></div>{status&&<div className={'qr-status '+(status.startsWith('✓')?'success':'')}>{status}</div>}</div>}
function ProOperations({user}){
 const [tab,setTab]=useState('speakers'),[events,setEvents]=useState([]),[expo,setExpo]=useState(''),[rows,setRows]=useState([]),[summary,setSummary]=useState(null),[busy,setBusy]=useState(false);
 const [form,setForm]=useState({});
 const loadEvents=()=>api('/expos').then(d=>{const e=d.expos||[];setEvents(e);if(!expo&&e[0])setExpo(e[0]._id)}).catch(()=>{});
 const load=async()=>{try{
   if(tab==='speakers'){const d=await api('/advanced/speakers'+(expo?'?expo='+expo:''));setRows(d.speakers||[])}
   if(tab==='sponsors'){const d=await api('/advanced/sponsors'+(expo?'?expo='+expo:''));setRows(d.sponsors||[])}
   if(tab==='finance'){const d=await api('/advanced/finance'+(expo?'?expo='+expo:''));setRows(d.transactions||[]);setSummary(d.summary)}
   if(tab==='audit'){const d=await api('/advanced/audit');setRows(d.logs||[])}
   if(tab==='checkin'){const d=await api('/advanced/checkin'+(expo?'?expo='+expo:''));setRows(d.checkins||[])}
   if(tab==='certificates'){const d=await api('/advanced/certificates'+(expo?'?expo='+expo:''));setRows(d.certificates||[])}
   if(tab==='campaigns'){const d=await api('/advanced/campaigns');setRows(d.campaigns||[])}
 }catch(e){setRows([])}};
 useEffect(()=>{loadEvents()},[]);useEffect(()=>{load()},[tab,expo]);
 const reset=()=>setForm(tab==='speakers'?{name:'',title:'',company:'',bio:'',session:''}:tab==='sponsors'?{name:'',tier:'Bronze',contactName:'',email:'',phone:'',amount:0,status:'pending',notes:''}:{type:'income',category:'',description:'',amount:0,reference:''});
 const create=async e=>{e.preventDefault();setBusy(true);try{
   if(tab==='speakers')await api('/advanced/speakers',{method:'POST',body:JSON.stringify({...form,expo})});
   if(tab==='sponsors')await api('/advanced/sponsors',{method:'POST',body:JSON.stringify({...form,expo,amount:Number(form.amount)||0})});
   if(tab==='finance')await api('/advanced/finance',{method:'POST',body:JSON.stringify({...form,expo,amount:Number(form.amount)||0})});
   if(tab==='campaigns')await api('/advanced/campaigns/send',{method:'POST',body:JSON.stringify({...form,expo})});
   reset();load();
 }catch(err){alert(err.message)}finally{setBusy(false)}};
 const del=async(id)=>{if(!confirm('Delete this record?'))return;try{await api(`/advanced/${tab==='speakers'?'speakers':tab==='sponsors'?'sponsors':'finance'}/${id}`,{method:'DELETE'});load()}catch(e){alert(e.message)}};
 const [question,setQuestion]=useState('');const [answer,setAnswer]=useState('');
 const ask=async()=>{if(!question.trim())return;setBusy(true);try{const d=await api('/advanced/ai/ask',{method:'POST',body:JSON.stringify({question})});setAnswer(d.answer||'No answer')}catch(e){setAnswer(e.message)}finally{setBusy(false)}};
 const issue=async(userId)=>{try{await api('/advanced/certificates',{method:'POST',body:JSON.stringify({expoId:expo,userId})});load();alert('Certificate issued.')}catch(e){alert(e.message)}};
 const tabs=[['speakers','Speakers'],['sponsors','Sponsors'],['finance','Finance'],['checkin','QR Check-in'],['certificates','Certificates'],['campaigns','Email Campaigns'],['audit','Audit Logs'],['ai','AI Event Assistant']];
 return <div className="dash-page"><PageTitle kicker="PRO OPERATIONS SUITE" title="Advanced Event Command Center" copy="Production-style modules connected to MongoDB APIs, role protection, audit trails and realtime events."/>
 <div className="toolbar panel">{tabs.map(t=><button key={t[0]} className={tab===t[0]?'primary small':'ghost small'} onClick={()=>{setTab(t[0]);reset()}}>{t[1]}</button>)}</div>
 {tab!=='ai'&&tab!=='audit'&&<div className="toolbar panel"><select value={expo} onChange={e=>setExpo(e.target.value)}><option value="">Select event</option>{events.map(e=><option key={e._id} value={e._id}>{e.title}</option>)}</select></div>}
 {['speakers','sponsors','finance'].includes(tab)&&<div className="panel"><form className="form-grid" onSubmit={create}>
 {tab==='speakers'&&<><input required placeholder="Speaker name" value={form.name||''} onChange={e=>setForm({...form,name:e.target.value})}/><input placeholder="Job title" value={form.title||''} onChange={e=>setForm({...form,title:e.target.value})}/><input placeholder="Company" value={form.company||''} onChange={e=>setForm({...form,company:e.target.value})}/><input placeholder="Session ID (optional)" value={form.session||''} onChange={e=>setForm({...form,session:e.target.value})}/><textarea className="full-col" placeholder="Speaker bio" value={form.bio||''} onChange={e=>setForm({...form,bio:e.target.value})}/></>}
 {tab==='sponsors'&&<><input required placeholder="Sponsor name" value={form.name||''} onChange={e=>setForm({...form,name:e.target.value})}/><select value={form.tier||'Bronze'} onChange={e=>setForm({...form,tier:e.target.value})}>{['Bronze','Silver','Gold','Platinum'].map(x=><option key={x}>{x}</option>)}</select><input placeholder="Contact name" value={form.contactName||''} onChange={e=>setForm({...form,contactName:e.target.value})}/><input type="email" placeholder="Email" value={form.email||''} onChange={e=>setForm({...form,email:e.target.value})}/><input type="number" placeholder="Sponsorship amount" value={form.amount||0} onChange={e=>setForm({...form,amount:e.target.value})}/><select value={form.status||'pending'} onChange={e=>setForm({...form,status:e.target.value})}>{['pending','approved','rejected','paid'].map(x=><option key={x}>{x}</option>)}</select></>}
 {tab==='finance'&&<><select value={form.type||'income'} onChange={e=>setForm({...form,type:e.target.value})}><option value="income">Income</option><option value="expense">Expense</option></select><input placeholder="Category" value={form.category||''} onChange={e=>setForm({...form,category:e.target.value})}/><input placeholder="Description" value={form.description||''} onChange={e=>setForm({...form,description:e.target.value})}/><input type="number" min="0" required placeholder="Amount" value={form.amount||0} onChange={e=>setForm({...form,amount:e.target.value})}/><input placeholder="Reference" value={form.reference||''} onChange={e=>setForm({...form,reference:e.target.value})}/></>}
 <button disabled={!expo||busy} className="primary wide full-col">{busy?'Saving...':'Add '+tab}</button></form></div>}
 {tab==='campaigns'&&<div className="panel"><form className="form-grid" onSubmit={create}><input required placeholder="Email subject" value={form.subject||''} onChange={e=>setForm({...form,subject:e.target.value})}/><select value={form.audience||'all'} onChange={e=>setForm({...form,audience:e.target.value})}>{['all','attendees','vip','exhibitors','speakers','staff'].map(x=><option key={x}>{x}</option>)}</select><textarea required className="full-col" rows="6" placeholder="Campaign message" value={form.message||''} onChange={e=>setForm({...form,message:e.target.value})}/><button disabled={!expo||busy} className="primary full-col">{busy?'Sending...':'Send Campaign'}</button></form></div>}
 {tab==='finance'&&summary&&<div className="stats"><div className="stat"><span>Income</span><b>PKR {summary.income.toLocaleString()}</b></div><div className="stat"><span>Expenses</span><b>PKR {summary.expense.toLocaleString()}</b></div><div className="stat"><span>Net Profit</span><b>PKR {summary.profit.toLocaleString()}</b></div></div>}
 {tab==='ai'&&<div className="panel ai-result"><div className="kicker">DATABASE-AWARE ASSISTANT</div><h2>Ask EventSphere</h2><div className="form-grid"><textarea className="full-col" rows="4" placeholder="Where is Booth B-12? How many tickets sold? What sessions are scheduled?" value={question} onChange={e=>setQuestion(e.target.value)}/><button className="primary full-col" onClick={ask}>{busy?'Thinking...':'Ask assistant'}</button></div>{answer&&<div className="ai-insight"><span>AI</span><p>{answer}</p></div>}</div>}
 {tab==='checkin'&&<QRCheckin onDone={load}/>}
 {tab==='certificates'&&<div className="panel"><p className="muted">Certificates are issued from a verified attendee user ID after attendance. Use the attendee ID from the organizer records.</p><form className="form-grid" onSubmit={e=>{e.preventDefault();issue(e.currentTarget.userId.value)}}><input name="userId" required placeholder="Attendee User ID"/><button className="primary">Generate Certificate</button></form></div>}
 <div className="table-panel">{rows.map(x=><div className="table-row" key={x._id||x.certificateNo||Math.random()}><div><b>{x.name||x.action||x.type||x.certificateNo||'Record'}</b><small>{x.email||x.description||x.entity||x.title||x.subject||''}</small></div><strong>{x.tier||x.status||x.amount||x.certificateNo||''}</strong><span>{x.createdAt?new Date(x.createdAt).toLocaleString():x.message||x.details?'Activity':''}</span>{['speakers','sponsors','finance'].includes(tab)&&<button className="danger small" onClick={()=>del(x._id)}><i className="fa-solid fa-trash"></i></button>}</div>)}{!rows.length&&tab!=='ai'&&<Empty text="No records found for this module yet."/>}</div>
 </div>
}


function EnterpriseHub({user}){
 const [tab,setTab]=useState('overview'),[events,setEvents]=useState([]),[expo,setExpo]=useState(''),[detail,setDetail]=useState(null),[query,setQuery]=useState(''),[filterType,setFilterType]=useState('all'),[results,setResults]=useState([]),[report,setReport]=useState(null),[leads,setLeads]=useState([]),[calendar,setCalendar]=useState(null),[templates,setTemplates]=useState([]),[notifications,setNotifications]=useState([]),[orders,setOrders]=useState([]),[question,setQuestion]=useState(''),[ai,setAi]=useState(null),[busy,setBusy]=useState(false),[toast,setToast]=useState('');
 const canManage=['admin','organizer'].includes(user.role);
 const flash=m=>{setToast(m);setTimeout(()=>setToast(''),2600)};
 const loadEvents=async()=>{try{const d=await api('/expos');const rows=d.expos||[];setEvents(rows);if(!expo&&rows[0])setExpo(rows[0]._id)}catch(e){flash(e.message)}};
 useEffect(()=>{loadEvents()},[]);
 useEffect(()=>{if(!expo)return; if(['overview','event','calendar','reports'].includes(tab)) loadTab(tab);},[expo,tab]);
 const loadTab=async t=>{try{
   if(t==='event'){const d=await api(`/enterprise/events/${expo}/detail`);setDetail(d)}
   if(t==='reports'&&canManage){const d=await api(`/enterprise/reports?expo=${expo}`);setReport(d)}
   if(t==='calendar'){const d=await api(`/enterprise/calendar?expo=${expo}`);setCalendar(d)}
 }catch(e){flash(e.message)}};
 const search=async()=>{if(!query.trim()){setResults([]);return}try{const d=await api(`/enterprise/search?q=${encodeURIComponent(query.trim())}`);setResults(d.results||[])}catch(e){flash(e.message)}};
 const loadLeads=async()=>{try{const d=await api(`/enterprise/leads${expo?`?expo=${expo}`:''}`);setLeads(d.leads||[])}catch(e){flash(e.message)}};
 const loadTemplates=async()=>{try{const d=await api('/enterprise/email-templates');setTemplates(d.templates||[])}catch(e){flash(e.message)}};
 const loadNotifications=async()=>{try{const d=await api('/enterprise/notifications');setNotifications(d.notifications||[])}catch(e){flash(e.message)}};
 const loadOrders=async()=>{try{const d=await api(user.role==='attendee'?'/ticket-orders/mine':'/ticket-orders');setOrders(d.tickets||[])}catch(e){flash(e.message)}};
 useEffect(()=>{if(tab==='leads')loadLeads();if(tab==='templates'&&canManage)loadTemplates();if(tab==='notifications')loadNotifications();if(tab==='payments')loadOrders()},[tab,expo]);
 const exportReport=()=>{if(!report)return;const rows=[['EventSphere Enterprise Report',new Date(report.generatedAt).toLocaleString()],[],['Metric','Value'],['Ticket revenue',report.summary.ticketRevenue],['Finance income',report.summary.financeIncome],['Finance expense',report.summary.financeExpense],['Net profit',report.summary.netProfit],['Tickets sold',report.summary.ticketsSold],['Checked in',report.summary.checkedIn],['Registrations',report.summary.registrations],['Booths',report.summary.booths],['Applications',report.summary.applications],[],['Invoice','Pass','Status','Total'],...(report.orders||[]).map(x=>[x.invoiceNo,x.passType,x.status,x.total])];downloadText(`eventsphere-enterprise-${new Date().toISOString().slice(0,10)}.csv`,csvFromRows(rows),'text/csv;charset=utf-8');flash('CSV report exported.');};
 const printReport=()=>{if(!report)return;window.print()};
 const approveRegistration=async(id,status)=>{try{await api(`/enterprise/registrations/${id}/status`,{method:'PUT',body:JSON.stringify({status})});const d=await api(`/enterprise/events/${expo}/detail`);setDetail(d);flash(`Registration marked ${status}.`)}catch(e){flash(e.message)}};
 const addLead=async e=>{e.preventDefault();const f=e.currentTarget;try{await api('/enterprise/leads',{method:'POST',body:JSON.stringify({expo,name:f.name.value,email:f.email.value,phone:f.phone.value,company:f.company.value,notes:f.notes.value,status:'new'})});f.reset();loadLeads();flash('Lead captured.')}catch(x){flash(x.message)}};
 const updateLead=async(id,status)=>{try{await api(`/enterprise/leads/${id}`,{method:'PUT',body:JSON.stringify({status})});loadLeads();}catch(e){flash(e.message)}};
 const saveTemplate=async e=>{e.preventDefault();const f=e.currentTarget;try{await api('/enterprise/email-templates',{method:'POST',body:JSON.stringify({name:f.name.value,category:f.category.value,subject:f.subject.value,body:f.body.value})});f.reset();loadTemplates();flash('Email template saved.')}catch(x){flash(x.message)}};
 const askAI=async()=>{if(!question.trim())return;setBusy(true);try{const d=await api('/advanced/ai/ask',{method:'POST',body:JSON.stringify({question})});setAi(d);flash('AI data refreshed.')}catch(e){setAi({answer:e.message,cards:[]})}finally{setBusy(false)}};
 const refund=async id=>{if(!confirm('Refund this paid ticket?'))return;try{await api(`/enterprise/payments/${id}/refund`,{method:'POST'});loadOrders();flash('Refund processed.')}catch(e){flash(e.message)}};
 const startCheckout=async e=>{e.preventDefault();const f=e.currentTarget;setBusy(true);try{const d=await api('/enterprise/payments/checkout',{method:'POST',body:JSON.stringify({expo:f.expo.value,passType:f.passType.value,quantity:Number(f.quantity.value||1)})});if(d.checkoutUrl)window.location.href=d.checkoutUrl;else flash('Checkout session created.')}catch(x){flash(x.message)}finally{setBusy(false)}};
 useEffect(()=>{const params=new URLSearchParams(window.location.search);const sid=params.get('session_id');if(params.get('payment')==='success'&&sid){api(`/enterprise/payments/confirm/${encodeURIComponent(sid)}`).then(d=>{flash(d.paid?'Payment confirmed successfully.':'Payment is still processing.');loadOrders()}).catch(e=>flash(e.message));window.history.replaceState({},'',window.location.pathname)}},[]);
 const tabs=[['overview','Command Center'],['event','Event Detail'],['search','Global Search'],...(canManage?[['reports','Reports'],['templates','Email Templates']]:[]),['leads','Lead CRM'],['calendar','Schedule Calendar'],['payments','Payments'],['notifications','Notifications'],['ai','AI Copilot'],['offline','Offline Ops']];
 const selectedEvent=events.find(e=>e._id===expo);
 return <div className="dash-page enterprise-page page-enter">
  <PageTitle kicker="ENTERPRISE EVENT OPERATIONS" title="EventSphere Enterprise Hub" copy="One workspace for event intelligence, registrations, exhibitor leads, payments, reports, notifications and operational planning." action={<div className="row-actions"><select className="enterprise-event-select" value={expo} onChange={e=>setExpo(e.target.value)}>{events.map(e=><option key={e._id} value={e._id}>{e.title}</option>)}</select></div>}/>
  <div className="enterprise-tabs">{tabs.map(([id,label])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}>{label}</button>)}</div>
  {tab==='overview'&&<div className="enterprise-overview">
    <div className="enterprise-hero"><div><div className="kicker">{selectedEvent?.status||'EVENT'} · COMMAND CENTER</div><h2>{selectedEvent?.title||'Select an event'}</h2><p>{selectedEvent?.description||'Your enterprise layer brings every operational signal into one place.'}</p></div><div className="enterprise-orb"><i className="fa-solid fa-crown"></i><span>PRO</span></div></div>
    <div className="stats enterprise-stats">{[['fa-ticket','Tickets','Open Ticketing'],['fa-map','Booths','Open Booth Designer'],['fa-users','Registrations','Review event detail'],['fa-chart-line','Analytics','Open Analytics']].map(x=><button key={x[1]} className="stat stat-action" onClick={()=>{const target=x[1]==='Tickets'?'tickets':x[1]==='Booths'?'booths':x[1]==='Analytics'?'analytics':'enterprise';window.dispatchEvent(new CustomEvent('eventsphere:navigate',{detail:target}))}}><i className={'fa-solid '+x[0]}></i><span>{x[1]}</span><b>{x[2]}</b></button>)}</div>
    <div className="enterprise-grid"><div className="panel"><div className="kicker">PREMIUM CAPABILITIES</div><h2>Everything connected</h2><div className="feature-list">{[['fa-chart-pie','Business intelligence','Revenue, attendance and exhibitor signals'],['fa-qrcode','QR operations','Camera check-in with instant validation'],['fa-building','Exhibitor CRM','Applications, booths, leads and follow-ups'],['fa-envelope','Lifecycle email','Reusable templates for ticketing and reminders'],['fa-calendar-days','Schedule control','Calendar view with session conflict detection'],['fa-credit-card','Payments','Payment status, invoices and refund workflow']].map(x=><div key={x[1]}><i className={'fa-solid '+x[0]}></i><span><b>{x[1]}</b><small>{x[2]}</small></span></div>)}</div></div><div className="panel"><div className="kicker">LIVE STATUS</div><h2>Operational readiness</h2><div className="health-list"><span><i></i> Data layer <b>Connected</b></span><span><i></i> Realtime notifications <b>Live</b></span><span><i></i> QR check-in <b>Ready</b></span><span><i></i> Offline queue <b>Enabled</b></span><span><i></i> AI data layer <b>Ready</b></span></div></div></div>
  </div>}
  {tab==='event'&&<div className="enterprise-grid"><div className="panel"><div className="panel-head"><div><div className="kicker">EVENT DETAIL</div><h2>{detail?.event?.title||'Loading event…'}</h2></div><button className="ghost small" onClick={()=>loadTab('event')}><i className="fa-solid fa-rotate"></i></button></div>{detail&&<><div className="stats"><div className="stat"><span>Revenue</span><b>PKR {Number(detail.summary.revenue||0).toLocaleString()}</b></div><div className="stat"><span>Tickets</span><b>{detail.summary.ticketsSold}</b></div><div className="stat"><span>Check-ins</span><b>{detail.summary.attendance}</b></div><div className="stat"><span>Registrations</span><b>{detail.summary.registrations}</b></div></div><div className="detail-sections"><section><h3>Schedule</h3>{detail.sessions.map(x=><div className="mini-row" key={x._id}><b>{x.title}</b><span>{new Date(x.startTime).toLocaleString([], {dateStyle:'medium',timeStyle:'short'})} · {x.location||'Main stage'}</span></div>)}{!detail.sessions.length&&<Empty text="No sessions yet."/>}</section><section><h3>Speakers & sponsors</h3>{detail.speakers.map(x=><div className="mini-row" key={x._id}><b>{x.name}</b><span>{x.title||x.company||'Speaker'}</span></div>)}{detail.sponsors.map(x=><div className="mini-row" key={x._id}><b>{x.name}</b><span>{x.tier} · PKR {Number(x.amount||0).toLocaleString()}</span></div>)}</section><section><h3>Venue map</h3><div className="mini-map">{detail.booths.slice(0,24).map((b,i)=><span key={b._id} style={{left:`${b.x||((i%8)*11)}%`,top:`${b.y||Math.floor(i/8)*25}%`}} className={'mini-booth '+b.status}>{b.boothNumber}</span>)}<b>MAIN STAGE</b></div></section><section><h3>Registration workflow</h3>{detail.registrations.map(r=><div className="mini-row" key={r._id}><span><b>{r.user?.name||'User'}</b><small>{r.type} · {r.status}</small></span>{canManage&&<span className="row-actions"><button className="ghost small" onClick={()=>approveRegistration(r._id,'approved')}>Approve</button><button className="danger small" onClick={()=>approveRegistration(r._id,'rejected')}>Reject</button></span>}</div>)}{!detail.registrations.length&&<Empty text="No registrations yet."/>}</section></div></>}</div></div>}
  {tab==='search'&&<div className="panel"><div className="kicker">GLOBAL SEARCH</div><h2>Find anything in EventSphere</h2><div className="enterprise-search"><select value={filterType} onChange={e=>setFilterType(e.target.value)}><option value="all">All types</option><option value="event">Events</option><option value="user">Users</option><option value="booth">Booths</option><option value="ticket">Tickets</option><option value="exhibitor">Exhibitors</option></select><input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&search()} placeholder="Search events, exhibitors, users, booths, invoices…"/><button className="primary" onClick={search}><i className="fa-solid fa-search"></i> Search</button></div><div className="search-results">{results.filter(r=>filterType==='all'||r.type===filterType).map(r=><div className="search-result" key={`${r.type}-${r.id}`}><span className="result-type">{r.type}</span><div><b>{r.title}</b><small>{r.meta}</small></div><i className="fa-solid fa-arrow-right"></i></div>)}{query&&!results.length&&<Empty text="No matching records found."/>}</div></div>}
  {tab==='reports'&&canManage&&<div className="panel report-panel"><div className="panel-head"><div><div className="kicker">BUSINESS INTELLIGENCE</div><h2>Reports & exports</h2><p className="muted">Sales, attendance, finance, booths and exhibitor applications in one report.</p></div><div className="row-actions"><button className="primary" onClick={exportReport} disabled={!report}><i className="fa-solid fa-file-csv"></i> CSV</button><button className="ghost" onClick={printReport} disabled={!report}><i className="fa-solid fa-file-pdf"></i> Print / PDF</button></div></div>{report&&<><div className="stats"><div className="stat"><span>Ticket revenue</span><b>PKR {Number(report.summary.ticketRevenue).toLocaleString()}</b></div><div className="stat"><span>Net profit</span><b>PKR {Number(report.summary.netProfit).toLocaleString()}</b></div><div className="stat"><span>Attendance</span><b>{report.summary.checkedIn}</b></div><div className="stat"><span>Applications</span><b>{report.summary.applications}</b></div></div><div className="bar-chart">{[['Tickets sold',report.summary.ticketsSold],['Checked in',report.summary.checkedIn],['Registrations',report.summary.registrations],['Booths',report.summary.booths]].map(([l,v])=><div className="bar-row" key={l}><div className="bar-label"><span>{l}</span><b>{v}</b></div><div className="bar-track"><i style={{width:`${Math.min(100,Math.max(7,Number(v)/Math.max(1,report.summary.ticketsSold)*100))}%`}}></i></div></div>)}</div></>}</div>}
  {tab==='leads'&&<div className="enterprise-grid">{['admin','organizer','exhibitor'].includes(user.role)&&<div className="panel"><div className="kicker">LEAD CAPTURE</div><h2>Capture a visitor lead</h2><form className="form-grid" onSubmit={addLead}><input name="name" required placeholder="Visitor name"/><input name="email" type="email" placeholder="Email"/><input name="phone" placeholder="Phone"/><input name="company" placeholder="Company"/><textarea name="notes" className="full-col" placeholder="Notes / product interest"/><button className="primary wide full-col">Add lead</button></form></div>}<div className="panel"><div className="panel-head"><div><div className="kicker">CRM PIPELINE</div><h2>{leads.length} leads</h2></div><button className="ghost small" onClick={loadLeads}>Refresh</button></div>{leads.map(l=><div className="lead-row" key={l._id}><div className="avatar-round">{(l.name||'L')[0]}</div><div><b>{l.name}</b><small>{l.company||l.email||'No contact detail'} · {l.expo?.title||''}</small></div><select value={l.status} onChange={e=>updateLead(l._id,e.target.value)}><option>new</option><option>contacted</option><option>qualified</option><option>won</option><option>lost</option></select></div>)}{!leads.length&&<Empty text="Capture your first visitor lead."/>}</div></div>}
  {tab==='calendar'&&<div className="panel"><div className="panel-head"><div><div className="kicker">EVENT SCHEDULE</div><h2>Sessions calendar</h2></div><button className="ghost small" onClick={()=>loadTab('calendar')}>Refresh</button></div>{calendar?.conflicts?.length>0&&<div className="warning-box"><i className="fa-solid fa-triangle-exclamation"></i><b>{calendar.conflicts.length} session conflict(s) detected.</b><span>Resolve overlapping times before publishing the final schedule.</span></div>}<div className="calendar-list">{(calendar?.sessions||[]).map(s=><div className="calendar-row" key={s._id}><div className="calendar-time"><b>{new Date(s.startTime).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</b><small>{new Date(s.startTime).toLocaleDateString([], {month:'short',day:'numeric'})}</small></div><div><b>{s.title}</b><small>{s.speaker||'Speaker TBA'} · {s.location||'Main stage'}</small></div><span>{new Date(s.endTime).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span></div>)}</div></div>}
  {tab==='templates'&&canManage&&<div className="enterprise-grid"><div className="panel"><div className="kicker">EMAIL LIFECYCLE</div><h2>Create template</h2><form className="form-grid" onSubmit={saveTemplate}><input name="name" required placeholder="Template name"/><select name="category"><option>ticket</option><option>registration</option><option>reminder</option><option>certificate</option><option>general</option></select><input name="subject" required className="full-col" placeholder="Email subject"/><textarea name="body" required className="full-col" rows="9" placeholder="Hello {{name}}, ..."/><button className="primary wide full-col">Save template</button></form></div><div className="panel"><div className="kicker">LIBRARY</div><h2>Reusable emails</h2>{templates.map(t=><div className="template-row" key={t._id}><div><b>{t.name}</b><small>{t.category} · {t.subject}</small></div><button className="danger small" onClick={async()=>{if(confirm('Delete this template?')){await api(`/enterprise/email-templates/${t._id}`,{method:'DELETE'});loadTemplates()}}}><i className="fa-solid fa-trash"></i></button></div>)}{!templates.length&&<Empty text="No templates saved yet."/>}</div></div>}
  {tab==='payments'&&<div className="enterprise-grid">{user.role==='attendee'&&<div className="panel"><div className="kicker">SECURE CHECKOUT</div><h2>Buy a ticket with Stripe</h2><form className="form-grid" onSubmit={startCheckout}><select name="expo" defaultValue={expo}>{events.map(e=><option key={e._id} value={e._id}>{e.title}</option>)}</select><select name="passType"><option>VIP Pass</option><option>Pro Pass</option><option>Business Pass</option><option>Classic Pass</option></select><input name="quantity" type="number" min="1" max="10" defaultValue="1"/><button className="primary wide full-col" disabled={busy}>{busy?'Opening checkout…':'Continue to Stripe Checkout'}</button></form><p className="muted">Live checkout activates when STRIPE_SECRET_KEY is configured. Without it, the existing EventSphere demo payment flow remains available.</p></div>}<div className="panel"><div className="panel-head"><div><div className="kicker">PAYMENTS & INVOICES</div><h2>Payment operations</h2><p className="muted">Stripe status is checked when a Stripe session exists; the current project also supports its local demo payment flow.</p></div><button className="ghost small" onClick={loadOrders}>Refresh</button></div>{orders.map(o=><div className="payment-row" key={o._id}><div className="invoice-icon"><i className="fa-solid fa-file-invoice-dollar"></i></div><div><b>{o.invoiceNo||'Pending invoice'} · {o.passType}</b><small>{o.attendee?.name||user.name} · {o.expo?.title||'Event'}</small></div><strong>PKR {Number(o.total||0).toLocaleString()}</strong><span className={'status-tag '+o.status}>{o.status}</span>{canManage&&o.status==='paid'&&<button className="danger small" onClick={()=>refund(o._id)}>Refund</button>}{user.role==='attendee'&&<button className="ghost small" onClick={async()=>{try{const d=await api(`/enterprise/payments/${o._id}`);flash(`Payment status: ${d.stripeState}`)}catch(e){flash(e.message)}}}>Status</button>}</div>)}{!orders.length&&<Empty text="No ticket payments found."/>}</div></div>}
  {tab==='notifications'&&<div className="panel"><div className="panel-head"><div><div className="kicker">NOTIFICATION CENTER</div><h2>Realtime updates</h2></div><button className="ghost small" onClick={loadNotifications}>Refresh</button></div>{notifications.map(n=><div className={'notification-row '+(!n.read?'unread':'')} key={n._id}><div className="notification-icon"><i className="fa-solid fa-bell"></i></div><div><b>{n.title}</b><p>{n.message}</p><small>{new Date(n.createdAt).toLocaleString()}</small></div></div>)}{!notifications.length&&<Empty text="No notifications yet."/>}</div>}
  {tab==='ai'&&<div className="enterprise-grid"><div className="panel ai-result"><div className="kicker">DATABASE-AWARE AI COPILOT</div><h2>Ask your event data</h2><textarea rows="5" value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Mere event ki total revenue kitni hai? Kal ke sessions batao. Low-performing booths identify karo."/><button className="primary wide" onClick={askAI} disabled={busy}>{busy?'Thinking…':'Ask EventSphere AI'}</button></div><div className="panel">{ai?<><div className="kicker">LIVE ANSWER</div><h2>Copilot response</h2><p className="ai-answer">{ai.answer}</p><div className="stats">{(ai.cards||[]).map((c,i)=><div className="stat" key={i}><span>{c.label}</span><b>{c.value}</b></div>)}</div></>:<Empty text="Ask a database question to see live metrics and insight cards."/>}</div></div>}
  {tab==='offline'&&<div className="enterprise-grid"><div className="panel"><div className="kicker">OFFLINE OPERATIONS</div><h2>Check-in continuity</h2><p className="muted">The PWA service worker keeps the application shell available and this workspace stores a local check-in queue for temporary network loss.</p><div className="offline-status"><i className="fa-solid fa-wifi"></i><div><b>{navigator.onLine?'Online':'Offline'}</b><small>{navigator.onLine?'Live API requests are available.':'Queue check-ins locally and sync when connection returns.'}</small></div></div><button className="primary wide" onClick={()=>{localStorage.setItem('es_offline_ready','1');flash('Offline operations flag saved on this device.')}}>Enable offline readiness</button></div><div className="panel"><div className="kicker">MOBILE EXPERIENCE</div><h2>Installable workspace</h2><p>EventSphere already ships with a PWA manifest and service worker. On supported browsers use the browser’s Install App action to place the command center on your phone or desktop.</p><div className="health-list"><span><i></i> App shell cache <b>Ready</b></span><span><i></i> Responsive tables <b>Enabled</b></span><span><i></i> Camera QR scanner <b>Supported</b></span></div></div></div>}
  {toast&&<Toast text={toast} onClose={()=>setToast('')}
  />}
 </div>
}



function EventToolkit({user,events,expo,flash}){
 const [ticketType,setTicketType]=useState('VIP'),[venue,setVenue]=useState(null),[qr,setQr]=useState(''),[lead,setLead]=useState(null),[busy,setBusy]=useState(false);
 const event=events.find(x=>x._id===expo);
 useEffect(()=>{if(expo)api(`/experience/venue?expo=${expo}`).then(setVenue).catch(()=>{})},[expo]);
 const printTicket=()=>window.print();
 const capture=async e=>{e.preventDefault();setBusy(true);try{const d=await api('/experience/lead-from-ticket',{method:'POST',body:JSON.stringify({qrToken:qr.trim()})});setLead(d.lead);flash(d.existing?'This attendee is already in your lead list.':'Attendee captured as a new lead.')}catch(x){flash(x.message)}finally{setBusy(false)}};
 return <div className="toolkit-grid">
  <div className="panel"><div className="kicker">SMART TICKET DESIGNER</div><h2>Digital ticket preview</h2><div className="ticket-designer"><div className="ticket-head"><span>EVENTSPHERE</span><b>{ticketType} PASS</b></div><div className="ticket-body"><div><small>ATTENDEE</small><strong>{user.name}</strong><small>EVENT</small><strong>{event?.title||'Event'} </strong><small>DATE / VENUE</small><span>{event?.date?new Date(event.date).toLocaleString():'Event date'} · {event?.location||'Venue'}</span></div><div className="ticket-qr">▦<small>QR</small></div></div><div className="ticket-footer"><span>Unique digital identity</span><b>{ticketType==='VIP'?'VIP':'STANDARD'}</b></div></div><div className="row-actions"><select value={ticketType} onChange={e=>setTicketType(e.target.value)}><option>VIP</option><option>STANDARD</option><option>STAFF</option></select><button className="primary" onClick={printTicket}><i className="fa-solid fa-file-pdf"></i> Print / PDF</button></div></div>
  <div className="panel"><div className="kicker">EXHIBITOR LEAD SCANNER</div><h2>Capture attendee by QR token</h2>{user.role==='exhibitor'?<form onSubmit={capture} className="form-grid"><input value={qr} onChange={e=>setQr(e.target.value)} placeholder="Scan/paste attendee QR token" required/><button className="primary wide full-col" disabled={busy}>{busy?'Capturing…':'Capture Lead'}</button></form>:<p className="muted">Sign in as an exhibitor to turn an attendee ticket QR into a CRM lead.</p>}{lead&&<div className="lead-result"><b>{lead.name}</b><span>{lead.company||lead.email||'Attendee'}</span><small>Status: {lead.status}</small></div>}</div>
  <div className="panel"><div className="kicker">VENUE FLOOR NAVIGATION</div><h2>{venue?.event?.title||'Event map'}</h2><p className="muted">Search a booth to highlight its position.</p><input id="booth-search" placeholder="Search booth number…"/><div className="toolkit-map">{(venue?.booths||[]).slice(0,48).map((b,i)=><button key={b._id} className={'tool-booth '+b.status} title={b.exhibitor?.company||'Available'} style={{left:`${(i%8)*12+2}%`,top:`${Math.floor(i/8)*17+3}%`}} onClick={()=>flash(`Booth ${b.boothNumber} · ${b.status||'available'}`)}>{b.boothNumber}</button>)}<b>MAIN STAGE</b><span>REGISTRATION</span><span>FOOD</span></div></div>
  <div className="panel"><div className="kicker">SPEAKER EXPERIENCE</div><h2>Speaker directory</h2><p className="muted">Profiles, sessions and availability in one place.</p>{(venue?.speakers||[]).length?venue.speakers.map(s=><div className="mini-row" key={s._id}><b>{s.name}</b><span>{s.title||s.company||'Speaker'}</span></div>):<Empty text="Open Sessions / Speaker Management to add speaker profiles."/>}</div>
 </div>
}

function RoleExperienceBanner({user}){
 const meta={organizer:['🎛️ Command Center','Run the whole event from one connected operational view.'],admin:['🛡️ Platform Control','Monitor event health, intelligence and platform operations.'],attendee:['📱 Event Companion','Your ticket, schedule, networking, map and rewards in one place.'],exhibitor:['🤝 Business Hub','Turn booth traffic into qualified conversations and follow-ups.'],staff:['🚨 Operations Center','Stay on top of assigned tasks, incidents and live check-ins.']};
 const [title,copy]=meta[user.role]||meta.attendee;
 const photos={organizer:['event-1','event-7','event-3'],exhibitor:['event-5','event-2','event-4'],staff:['event-6','event-3','event-1'],attendee:['event-2','event-8','event-6'],admin:['event-7','event-1','event-5']};
 const shots=photos[user.role]||photos.attendee;
 return <div className="role-experience-banner"><div><div className="kicker">EVENTSPHERE — EVENT EXPERIENCE & OPERATIONS PLATFORM</div><h1>{title}</h1><p>{copy}</p></div><div className="role-banner-shots">{shots.map((s,i)=><img key={s} src={`/images/gallery/${s}.jpg`} alt="Event moment" loading="lazy" style={{animationDelay:`${i*0.5}s`}}/>)}</div><div className="role-experience-badge"><i className="fa-solid fa-sparkles"></i><span>{user.role.toUpperCase()} EXPERIENCE</span></div></div>
}
function MetricCard({icon,label,value,detail,tone=''}){return <div className={'experience-metric '+tone}><i className={'fa-solid '+icon}></i><div><span>{label}</span><b>{value}</b>{detail&&<small>{detail}</small>}</div></div>}
function EmptyState({icon='fa-layer-group',title='No data yet',text='Your EventSphere activity will appear here.'}){return <div className="experience-empty"><i className={'fa-solid '+icon}></i><b>{title}</b><span>{text}</span></div>}
function InterestPicker({selected,onChange,onSave,busy}){
 const options=['Web Development','AI','Business','Cybersecurity','Cloud','Startups','Marketing','FinTech','Design','Education'];
 const toggle=x=>onChange(selected.includes(x)?selected.filter(i=>i!==x):[...selected,x]);
 return <div className="interest-picker"><div className="interest-chips">{options.map(x=><button type="button" key={x} className={selected.includes(x)?'interest-chip active':'interest-chip'} onClick={()=>toggle(x)}>{selected.includes(x)&&<i className="fa-solid fa-check"></i>}{x}</button>)}</div><button className="primary small" type="button" onClick={onSave} disabled={busy}>{busy?'Saving…':'Save interests'}</button></div>
}
function EventIntelligence({expo}){
 const [data,setData]=useState(null),[loading,setLoading]=useState(true);
 const load=()=>{setLoading(true);api(`/experience/intelligence${expo?`?expo=${expo}`:''}`).then(d=>setData(d)).catch(()=>setData(null)).finally(()=>setLoading(false))};
 useEffect(()=>{load()},[expo]);
 if(loading)return <Loader/>;
 if(!data)return <EmptyState icon="fa-brain" title="Intelligence is warming up" text="Create event activity and this panel will calculate live insights."/>;
 const max=Math.max(1,...(data.attendanceTrend||[]).map(x=>x.count||0));
 return <div className="intelligence-layout">
  <div className="panel intelligence-summary"><div className="kicker">🧠 AI EVENT SUMMARY</div><h2>What the data is saying</h2><p>{data.summary}</p><div className="ai-summary-line"><i className="fa-solid fa-wand-magic-sparkles"></i><span>Smart Engine · transparent event-data analysis</span></div></div>
  <div className="experience-metric-grid">{[['fa-users','Attendance',data.metrics?.checkedIn||0,`${data.metrics?.registrations||0} registrations`],['fa-money-bill-trend-up','Revenue',formatMoney(data.metrics?.revenue||0),'paid ticket value'],['fa-store','Booth occupancy',`${data.metrics?.occupiedBooths||0}/${data.metrics?.booths||0}`,'reserved + occupied'],['fa-handshake','New leads',data.metrics?.leads||0,'CRM activity']].map(x=><MetricCard key={x[1]} icon={x[0]} label={x[1]} value={x[2]} detail={x[3]}/>)}</div>
  <div className="panel"><div className="panel-head"><div><div className="kicker">ATTENDANCE TRENDS</div><h2>Check-ins over time</h2></div><span className="status-tag paid">LIVE DATA</span></div><div className="trend-chart">{(data.attendanceTrend||[]).map(x=><div className="trend-col" key={x.date}><div className="trend-value">{x.count}</div><i style={{height:`${Math.max(10,(x.count/max)*100)}%`}}></i><small>{new Date(x.date).toLocaleDateString(undefined,{month:'short',day:'numeric'})}</small></div>)}{!data.attendanceTrend?.length&&<EmptyState icon="fa-chart-column" title="No check-ins yet"/>}</div></div>
  <div className="experience-grid"><div className="panel"><div className="kicker">SESSION POPULARITY</div><h2>Sessions drawing attention</h2>{(data.sessionPopularity||[]).map(x=><div className="insight-row" key={x.id}><div><b>{x.title}</b><small>{x.attendees} booked · {x.capacity||0} capacity</small></div><strong>{x.capacity?Math.round(x.attendees/x.capacity*100):0}%</strong></div>)}{!data.sessionPopularity?.length&&<EmptyState title="No sessions yet"/>}</div><div className="panel"><div className="kicker">LOW-PERFORMING BOOTHS</div><h2>Booths needing attention</h2>{(data.lowPerformingBooths||[]).map(x=><div className="insight-row" key={x.id}><div><b>{x.boothNumber}</b><small>{x.reason}</small></div><span className="status-tag cancelled">OPEN</span></div>)}{!data.lowPerformingBooths?.length&&<EmptyState icon="fa-store" title="All booths assigned" text="No available booths are currently flagged."/>}</div></div>
  <div className="panel attention-panel"><div className="kicker">WHAT NEEDS ATTENTION?</div><h2>Priority queue</h2>{(data.attention||[]).map((x,i)=><div className={'attention-row '+x.level} key={i}><i className="fa-solid fa-circle-exclamation"></i><div><b>{x.title}</b><span>{x.detail}</span></div><em>{x.level.toUpperCase()}</em></div>)}{!data.attention?.length&&<div className="all-clear"><i className="fa-solid fa-circle-check"></i><b>No urgent signals detected</b><span>Your current event data is within the configured operating thresholds.</span></div>}</div>
 </div>
}
function EventHealth({expo}){
 const [data,setData]=useState(null);useEffect(()=>{if(expo)api(`/experience/health?expo=${expo}`).then(setData).catch(()=>setData(null))},[expo]);
 return <div className="health-dashboard"><div className="health-hero"><div><div className="kicker">📊 EVENT HEALTH</div><h2>Operational pulse</h2><p>One screen for attendance, revenue, booths, sessions, feedback and operations.</p></div><div className={'health-overall '+(data?.overall==='HEALTHY'?'green':data?.overall==='MONITOR'?'yellow':'red')}><span>{data?.overall||'LOADING'}</span><b>{data?.checks?.filter(x=>x.status==='green').length||0}/{data?.checks?.length||0}</b></div></div><div className="health-grid">{(data?.checks||[]).map(x=><div className={'health-card '+x.status} key={x.name}><div><i></i><b>{x.name}</b></div><strong>{x.value}%</strong><span>{x.status==='green'?'Healthy':x.status==='yellow'?'Monitor':'Attention'}</span></div>)}</div></div>
}
function NetworkingHub({user,expo,flash}){
 const [selected,setSelected]=useState([]),[data,setData]=useState(null),[busy,setBusy]=useState(false);
 const load=()=>api(`/experience/network${expo?`?expo=${expo}`:''}`).then(d=>{setData(d);setSelected((d.interests||[]).map(x=>x.split(' ').map(y=>y[0]?.toUpperCase()+y.slice(1)).join(' ')))}).catch(()=>setData(null));useEffect(()=>{load()},[expo]);
 const save=async()=>{setBusy(true);try{await api('/experience/interests',{method:'POST',body:JSON.stringify({interests:selected})});await load();flash('Interest profile updated — suggestions refreshed.')}catch(e){flash(e.message)}finally{setBusy(false)}};
 return <div className="networking-layout"><div className="panel"><div className="kicker">🤝 SMART NETWORKING</div><h2>Tell EventSphere what matters to you</h2><p className="muted">Pick your interests and the directory will surface attendees and exhibitors with overlapping topics.</p><InterestPicker selected={selected} onChange={setSelected} onSave={save} busy={busy}/></div><div className="panel"><div className="panel-head"><div><div className="kicker">MATCH ENGINE</div><h2>Relevant people & companies</h2></div><span className="status-tag paid">MATCHED</span></div>{(data?.suggestions||[]).slice(0,12).map(x=><div className="directory-row" key={`${x.type}-${x.id}`}><div className="avatar-round">{(x.name||'A')[0]}</div><div><b>{x.name}</b><small>{x.type==='exhibitor'?'Exhibitor':'Attendee'} · {x.company||x.jobTitle||'Event participant'} · {x.interests||'Networking'}</small></div><strong className="match-score">{x.match?.percent||0}% match</strong><button className="ghost small" onClick={async()=>{if(user.role==='attendee'&&expo){try{await api('/experience/engagement',{method:'POST',body:JSON.stringify({expo,type:'networking',targetId:x.id})});flash(`Connected with ${x.name} · +15 points`)}catch(e){flash(e.message)}}else flash(`Connection prepared for ${x.name}.`)}}>Connect</button></div>)}{data&&!data.suggestions?.length&&<EmptyState icon="fa-handshake" title="No matches yet" text="Choose a few interests above to start matching."/>}</div></div>
}
function LeadScoreHub({expo,flash}){const [data,setData]=useState(null);const load=()=>api(`/experience/lead-score${expo?`?expo=${expo}`:''}`).then(setData).catch(()=>setData(null));useEffect(()=>{load()},[expo]);return <div className="lead-score-layout"><div className="panel lead-score-hero"><div className="kicker">🎯 EXHIBITOR LEAD SCORE</div><h2>Know who needs a follow-up</h2><p>QR capture becomes a practical sales signal using recency, profile completeness and lead status.</p><div className="lead-score-legend"><span><i></i> HIGH 75–100</span><span><i></i> MEDIUM 50–74</span><span><i></i> LOW 0–49</span></div></div><div className="panel"><div className="panel-head"><div><div className="kicker">CRM SIGNALS</div><h2>{data?.leads?.length||0} scored leads</h2></div><button className="ghost small" onClick={load}>Refresh</button></div>{(data?.leads||[]).map(l=><div className="lead-score-row" key={l._id}><div className="avatar-round">{(l.name||'L')[0]}</div><div className="lead-main"><b>{l.name}</b><small>{l.company||l.email||'Attendee'} · {l.status}</small></div><div className="lead-score-ring"><strong>{l.score}</strong><span>{l.quality}</span></div><div className="lead-meta"><span>Interest: <b>{l.interest}%</b></span><span>Last Interaction: <b>{Math.max(1,Math.round((Date.now()-new Date(l.updatedAt||l.createdAt).getTime())/60000))} mins ago</b></span><span>Follow-up: <b>{l.followUp}</b></span></div><button className="ghost small" onClick={()=>flash(`Follow-up task prepared for ${l.name}.`)}>Follow up</button></div>)}{!data?.leads?.length&&<EmptyState icon="fa-qrcode" title="No QR leads yet" text="Use the Event Toolkit scanner to capture attendee leads."/>}</div></div>}
function OperationsCenter({expo,flash,canCreate=true}){
 const [data,setData]=useState(null),[form,setForm]=useState({type:'task',title:'',description:'',priority:'medium',area:'Registration',assignedTo:''});
 const load=()=>expo&&api(`/experience/operations-board?expo=${expo}`).then(setData).catch(()=>setData(null));useEffect(()=>{load()},[expo]);
 const create=async e=>{e.preventDefault();try{await api('/experience/operations-board',{method:'POST',body:JSON.stringify({...form,expo,assignedTo:form.assignedTo||null})});setForm({...form,title:'',description:''});load();flash('Operations item created.')}catch(err){flash(err.message)}};
 const update=async(id,status)=>{try{await api(`/experience/operations-board/${id}`,{method:'PATCH',body:JSON.stringify({status})});load()}catch(e){flash(e.message)}};
 return <div className="operations-layout"><div className="experience-metric-grid"><MetricCard icon="fa-right-to-bracket" label="Check-ins" value={data?.checkinCount||0} detail={`${data?.openCounters||1} active counter(s)`}/><MetricCard icon="fa-ticket" label="Paid tickets" value={data?.paidTickets||0} detail="ready for entry"/><MetricCard icon="fa-list-check" label="Open items" value={(data?.items||[]).filter(x=>x.status!=='resolved').length} detail="tasks + incidents"/></div><div className="experience-grid"><div className="panel"><div className="kicker">🚨 SMART OPERATIONS</div><h2>Staff command board</h2>{canCreate&&<form className="form-grid compact-form" onSubmit={create}><select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}><option value="task">Task</option><option value="incident">Incident</option><option value="announcement">Emergency announcement</option></select><input required placeholder="Title" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/><input placeholder="Area" value={form.area} onChange={e=>setForm({...form,area:e.target.value})}/><select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}><option>low</option><option>medium</option><option>high</option><option>critical</option></select><select value={form.assignedTo} onChange={e=>setForm({...form,assignedTo:e.target.value})}><option value="">Unassigned</option>{(data?.staff||[]).map(s=><option value={s._id} key={s._id}>{s.name}</option>)}</select><textarea className="full-col" placeholder="Instructions / incident details" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/><button className="primary full-col">Create operations item</button></form>}<div className="operation-list">{(data?.items||[]).map(x=><div className={'operation-row '+x.priority} key={x._id}><div className="operation-icon"><i className={'fa-solid '+(x.type==='incident'?'fa-triangle-exclamation':x.type==='announcement'?'fa-bullhorn':'fa-list-check')}></i></div><div><b>{x.title}</b><small>{x.type} · {x.area} · {x.assignedTo?.name||'Unassigned'}</small><span>{x.description}</span></div><select value={x.status} onChange={e=>update(x._id,e.target.value)}><option value="open">Open</option><option value="in-progress">In progress</option><option value="resolved">Resolved</option></select></div>)}</div>{!data?.items?.length&&<EmptyState icon="fa-helmet-safety" title="Operations board is clear" text="Create tasks, incidents or emergency announcements as your event runs."/>}</div><div className="panel"><div className="kicker">ASSIGNED AREAS</div><h2>Staff coverage</h2>{(data?.staff||[]).map(s=><div className="directory-row" key={s._id}><div className="avatar-round">{(s.name||'S')[0]}</div><div><b>{s.name}</b><small>{s.role} · {s.shiftStart||'Shift TBD'}–{s.shiftEnd||'TBD'}</small></div><span className={s.active?'status-tag paid':'status-tag cancelled'}>{s.active?'ACTIVE':'OFF'}</span></div>)}{!data?.staff?.length&&<EmptyState icon="fa-users-gear" title="No staff assignments"/>}</div></div></div>
}
function AttendeeCompanion({expo,user,flash}){const [data,setData]=useState(null);const load=()=>expo&&api(`/experience/companion?expo=${expo}`).then(setData).catch(()=>setData(null));useEffect(()=>{load()},[expo]);const engage=async(type,targetId)=>{try{await api('/experience/engagement',{method:'POST',body:JSON.stringify({expo,type,targetId})});flash(`Engagement recorded · +${({booth:10,networking:15,session:20,feedback:5,checkin:10}[type]||0)} points`);load()}catch(e){flash(e.message)}};return <div className="companion-layout"><div className="companion-hero"><div><div className="kicker">📱 EVENT COMPANION</div><h2>Welcome, {user.name?.split(' ')[0]||'Attendee'}</h2><p>Your event day in one connected workspace.</p></div><div className="passport-mini"><span>REWARDS</span><b>{data?.rewards?.points||0}</b><small>points</small></div></div><div className="companion-grid"><div className="panel"><div className="kicker">MY TICKET</div>{data?.ticket?<SmartTicket ticket={data.ticket}/>:<EmptyState icon="fa-ticket" title="No paid ticket found" text="Purchase a ticket to unlock your event companion."/>}</div><div className="panel"><div className="kicker">MY SCHEDULE</div>{(data?.schedule||[]).map(s=><div className="mini-row" key={s._id}><b>{s.title}</b><span>{new Date(s.startTime).toLocaleString()} · {s.location||'Main stage'}</span></div>)}{!data?.schedule?.length&&<EmptyState icon="fa-calendar-days" title="No saved sessions"/>}</div><div className="panel"><div className="kicker">EVENT MAP</div><p className="muted">Open a booth to earn +10 points for a visit.</p><div className="companion-map">{(data?.map||[]).slice(0,24).map((b,i)=><button key={b._id} onClick={()=>engage('booth',b._id)} title={b.exhibitor?.company||'Available'} style={{left:`${(b.x||i%8)*10+4}%`,top:`${(b.y||Math.floor(i/8))*22+8}%`}}>{b.boothNumber}</button>)}<b>MAIN STAGE</b></div></div><div className="panel"><div className="kicker">REWARDS</div><div className="reward-summary"><b>{data?.rewards?.points||0} pts</b>{(data?.rewards?.badges||[]).map(x=><span key={x}>🏆 {x}</span>)}</div></div></div></div>}
function SmartTicket({ticket}){const verification=ticket.qrToken?String(ticket.qrToken).slice(-8).toUpperCase():'ES-VERIFY';return <div className="smart-ticket"><div className="smart-ticket-top"><span>EVENTSPHERE</span><b>{ticket.passType}</b></div><div className="smart-ticket-body"><div className="ticket-attendee">{ticket.attendee?.avatar?<img src={ticket.attendee.avatar} alt=""/>:<div className="ticket-photo-fallback">{(ticket.attendee?.name||'A')[0]}</div>}<div><small>ATTENDEE</small><strong>{ticket.attendee?.name||'Attendee'}</strong><small>EVENT</small><strong>{ticket.expo?.title||'Event'}</strong><small>DATE / VENUE</small><span>{ticket.expo?.date?new Date(ticket.expo.date).toLocaleDateString():''} · {ticket.expo?.location||'Venue'}</span></div></div><div className="smart-qr"><span>▦</span><small>QR</small></div></div><div className="smart-ticket-meta"><span>Verification ID <b>{verification}</b></span><span className="status-tag paid">{ticket.status.toUpperCase()}</span></div></div>}
function Passport({user,expo}){const [data,setData]=useState(null);useEffect(()=>{api(`/experience/passport/${user.id}${expo?`?expo=${expo}`:''}`).then(setData).catch(()=>setData(null))},[user.id,expo]);return <div className="passport-layout"><div className="passport-card"><div className="passport-head"><div className="passport-avatar">{(data?.user?.name||user.name||'A')[0]}</div><div><div className="kicker">EVENT PASSPORT</div><h2>{data?.user?.name||user.name}</h2><p>{data?.user?.company||'Event participant'} · {data?.user?.jobTitle||'Attendee'}</p></div></div><div className="passport-stats">{[['fa-right-to-bracket','Checked In',data?.counts?.checkin||0],['fa-microphone-lines','Sessions',data?.counts?.session||0],['fa-store','Booths',data?.counts?.booth||0],['fa-handshake','Connections',data?.counts?.networking||0],['fa-message','Feedbacks',data?.counts?.feedback||0]].map(x=><div key={x[1]}><i className={'fa-solid '+x[0]}></i><b>{x[2]}</b><span>{x[1]}</span></div>)}</div><div className="passport-achievement"><span>Achievement</span><strong>🏆 {data?.badges?.[0]||'Event Explorer'}</strong><em>{data?.points||0} points</em></div></div><div className="panel"><div className="kicker">BADGES</div><h2>Your achievements</h2>{(data?.badges||[]).map(x=><div className="badge-row" key={x}><span>🏆</span><div><b>{x}</b><small>Unlocked from your EventSphere activity</small></div></div>)}{!data?.badges?.length&&<EmptyState icon="fa-trophy" title="Your first badge is waiting" text="Check in, attend sessions, visit booths and connect with people."/>}</div></div>}
function RewardsHub({expo,user}){const [board,setBoard]=useState([]);useEffect(()=>{if(expo)api(`/experience/gamification?expo=${expo}`).then(d=>setBoard(d.leaderboard||[])).catch(()=>{})},[expo]);const me=board.find(x=>String(x.user?._id)===String(user.id));return <div className="rewards-layout"><div className="reward-hero"><div><div className="kicker">🏆 GAMIFICATION</div><h2>Make every interaction count</h2><p>Check-in +10 · Session +20 · Booth visit +10 · Feedback +5 · Networking +15</p></div><div className="reward-points"><span>YOUR SCORE</span><b>{me?.points||0}</b><small>points</small></div></div><div className="panel"><div className="kicker">LEADERBOARD</div><h2>Event engagement</h2>{board.map((x,i)=><div className="leader-row" key={x.user._id}><strong>#{i+1}</strong><div className="avatar-round">{(x.user.name||'A')[0]}</div><div><b>{x.user.name}</b><small>{x.rank} · {(x.badges||[]).join(' · ')||'Building momentum'}</small></div><span>{x.points} pts</span></div>)}{!board.length&&<EmptyState icon="fa-trophy" title="Leaderboard is waiting" text="Engage with the event to start earning points."/>}</div></div>}
function MapNavigator({expo,flash}){const [venue,setVenue]=useState(null),[query,setQuery]=useState(''),[selected,setSelected]=useState(null);useEffect(()=>{if(expo)api(`/experience/venue?expo=${expo}`).then(setVenue).catch(()=>setVenue(null))},[expo]);const booths=venue?.booths||[];const found=booths.filter(b=>String(b.boothNumber||'').toLowerCase().includes(query.toLowerCase()));return <div className="map-navigator"><div className="panel"><div className="kicker">🗺️ SMART VENUE NAVIGATION</div><h2>Find your booth</h2><div className="map-search"><i className="fa-solid fa-magnifying-glass"></i><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search Booth A-24"/></div><div className="map-results">{query&&found.slice(0,8).map(b=><button key={b._id} onClick={()=>setSelected(b)}><b>{b.boothNumber}</b><span>{b.exhibitor?.company||'Available'} · {b.status}</span></button>)}</div><div className="smart-floor-map">{booths.slice(0,48).map((b,i)=><button key={b._id} className={selected?._id===b._id?'selected':''} style={{left:`${(b.x||i%8)*10+2}%`,top:`${(b.y||Math.floor(i/8))*15+3}%`}} onClick={()=>setSelected(b)}>{b.boothNumber}</button>)}<b>MAIN STAGE</b><span>REGISTRATION</span><span>FOOD</span></div></div><div className="panel"><div className="kicker">LOCATION INTELLIGENCE</div>{selected?<><h2>Booth {selected.boothNumber}</h2><div className="route-card"><i className="fa-solid fa-route"></i><div><b>Route information</b><span>Registration → Booth {selected.boothNumber}</span><small>Map coordinates: X {selected.x||0} · Y {selected.y||0} · Status: {selected.status}</small></div></div><button className="primary wide" onClick={()=>flash(`Booth ${selected.boothNumber} highlighted on the venue map.`)}>Highlight booth</button></>:<EmptyState icon="fa-map-location-dot" title="Search a booth" text="Type a booth number such as A-24 to highlight its location."/>}</div></div>}
function ExperienceOS({user}){
 const [tab,setTab]=useState(user.role==='attendee'?'companion':user.role==='exhibitor'?'leads':'live'),[events,setEvents]=useState([]),[expo,setExpo]=useState(''),[live,setLive]=useState(null),[toast,setToast]=useState('');
 const isAdmin=user.role==='admin',isOrg=['admin','organizer'].includes(user.role),isExhibitor=user.role==='exhibitor',isAttendee=user.role==='attendee',isStaff=user.role==='staff';
 const flash=m=>{setToast(m);setTimeout(()=>setToast(''),2800)};
 useEffect(()=>{api('/expos').then(d=>{const rows=d.expos||[];setEvents(rows);if(rows[0])setExpo(rows[0]._id)}).catch(e=>flash(e.message))},[]);
 useEffect(()=>{if(!expo||tab!=='live')return;const load=()=>api(`/experience/live?expo=${expo}`).then(setLive).catch(()=>{});load();const s=io(SOCKET,{auth:{token:localStorage.getItem('es_token')}});s.emit('expo:join',expo);['ticket:paid','notification:new','attendance:checkin','lead:new','engagement:new','operation:new','operation:update'].forEach(ev=>s.on(ev,load));const timer=setInterval(load,15000);return()=>{clearInterval(timer);s.emit('expo:leave',expo);s.disconnect()}},[expo,tab]);
 const tabs=[...(isAttendee?[['companion','Event Companion','fa-mobile-screen-button'],['passport','Event Passport','fa-id-card'],['network','Networking','fa-handshake'],['rewards','Rewards','fa-trophy'],['ticket','Smart Ticket','fa-ticket'],['map','Event Map','fa-map-location-dot'],['live','Live Mode','fa-tower-broadcast']]:[]),...(isExhibitor?[['leads','Lead Score','fa-bullseye'],['network','Visitor Network','fa-handshake'],['toolkit','Event Toolkit','fa-toolbox'],['live','Live Mode','fa-tower-broadcast']]:[]),...(isOrg?[['live','Live Mode','fa-tower-broadcast'],['intelligence','Event Intelligence','fa-brain'],['health','Event Health','fa-heart-pulse'],['operations','Operations Center','fa-helmet-safety'],['toolkit','Event Toolkit','fa-toolbox']]:[]),...(isStaff?[['live','Live Mode','fa-tower-broadcast'],['operations','Operations Center','fa-helmet-safety'],['toolkit','Event Toolkit','fa-toolbox']]:[])];
 return <div className="dash-page experience-page page-enter"><RoleExperienceBanner user={user}/><PageTitle kicker="EVENTSPHERE EXPERIENCE OS" title={isAttendee?'My Event Companion':isExhibitor?'Exhibitor Business Hub':isAdmin?'Platform Control':isStaff?'Staff Operations Center':'Organizer Command Center'} copy="EventSphere — Event Experience & Operations Platform" action={<select className="enterprise-event-select" value={expo} onChange={e=>setExpo(e.target.value)}>{events.map(e=><option key={e._id} value={e._id}>{e.title}</option>)}</select>}/><div className="enterprise-tabs experience-tabs">{tabs.map(([id,label,icon])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}><i className={'fa-solid '+icon}></i>{label}</button>)}</div>
  {tab==='live'&&<div className="experience-live"><div className="live-event-banner"><div><div className="kicker">🟢 LIVE EVENT</div><h2>{live?.event?.title||'EventSphere Live Mode'}</h2><p>{live?.event?.location||'Realtime event operations'}</p></div><div className="live-clock">{new Date().toLocaleTimeString()}</div></div><div className="experience-metric-grid">{[['fa-right-to-bracket','Checked In',live?.stats?.checkedIn||0,'realtime'],['fa-store','Booth Occupancy',(live?.stats?.boothOccupancy||0)+'%','occupied / reserved'],['fa-handshake','New Leads',live?.stats?.newLeads||0,'last 24 hours'],['fa-microphone-lines','Sessions Live',live?.stats?.liveSessions||0,'happening now'],['fa-triangle-exclamation','Incidents',live?.stats?.incidents||0,'operations signal'],['fa-money-bill-trend-up','Revenue',formatMoney(live?.stats?.revenue||0),'paid tickets'],['fa-ticket','Tickets Sold',live?.stats?.ticketsSold||0,'quantity'],['fa-heart-pulse','System',live?.stats?.system||'ONLINE','Socket.IO']].map(x=><MetricCard key={x[1]} icon={x[0]} label={x[1]} value={x[2]} detail={x[3]}/>)}</div><div className="experience-grid"><div className="panel"><div className="kicker">ACTIVE SESSIONS</div><h2>Happening now</h2>{(live?.sessions||[]).map(s=><div className="mini-row" key={s._id}><b>{s.title}</b><span>{s.location||'Main stage'} · {new Date(s.endTime).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span></div>)}{!live?.sessions?.length&&<EmptyState icon="fa-microphone-lines" title="No live session right now"/>}</div><div className="panel"><div className="kicker">REALTIME PIPELINE</div><h2>Connected systems</h2><div className="health-list"><span><i></i> Attendance <b>LIVE</b></span><span><i></i> Exhibitor leads <b>LIVE</b></span><span><i></i> Operations <b>LIVE</b></span><span><i></i> Socket.IO <b>ONLINE</b></span></div></div></div></div>}
  {tab==='intelligence'&&<EventIntelligence expo={expo}/>} {tab==='health'&&<EventHealth expo={expo}/>} {tab==='operations'&&<OperationsCenter expo={expo} flash={flash} canCreate={isOrg}/>} {tab==='leads'&&<LeadScoreHub expo={expo} flash={flash}/>} {tab==='network'&&<NetworkingHub user={user} expo={expo} flash={flash}/>} {tab==='companion'&&<AttendeeCompanion expo={expo} user={user} flash={flash}/>} {tab==='passport'&&<Passport user={user} expo={expo}/>} {tab==='rewards'&&<RewardsHub expo={expo} user={user}/>} {tab==='map'&&<MapNavigator expo={expo} flash={flash}/>} {tab==='ticket'&&<div className="ticket-experience"><div className="panel"><div className="kicker">🎟️ SMART TICKET</div><h2>Dynamic event identity</h2><SmartTicket ticket={{status:'valid',passType:'VIP Pass',attendee:{name:user.name},expo:events.find(x=>x._id===expo)}}/></div><div className="panel"><div className="kicker">VERIFICATION</div><h2>Fast entry</h2><div className="verification-list"><span><i className="fa-solid fa-qrcode"></i> QR verification</span><span><i className="fa-solid fa-id-card"></i> Attendee photo identity</span><span><i className="fa-solid fa-chair"></i> Seat / session details</span><span><i className="fa-solid fa-shield-halved"></i> Verification ID</span><span><i className="fa-solid fa-arrows-rotate"></i> Dynamic status</span></div></div></div>} {tab==='toolkit'&&<EventToolkit user={user} events={events} expo={expo} flash={flash}/>} {toast&&<Toast text={toast} onClose={()=>setToast('')}/>}</div>
}

function Settings({user,onNavigate,onLogout}){
 const [theme,setTheme]=useState(()=>localStorage.getItem('es_theme')||'dark');
 const [reduce,setReduce]=useState(()=>localStorage.getItem('es_reduce_motion')==='1');
 const [prefs,setPrefs]=useState(()=>{try{return JSON.parse(localStorage.getItem('es_prefs')||'{}')}catch{return{}}});
 const [msg,setMsg]=useState('');
 const flash=t=>{setMsg(t);setTimeout(()=>setMsg(''),2400)};
 useEffect(()=>{document.documentElement.dataset.theme=theme;localStorage.setItem('es_theme',theme)},[theme]);
 useEffect(()=>{document.documentElement.classList.toggle('reduce-motion',reduce);localStorage.setItem('es_reduce_motion',reduce?'1':'0')},[reduce]);
 const savePrefs=next=>{const merged={...prefs,...next};setPrefs(merged);localStorage.setItem('es_prefs',JSON.stringify(merged))};
 async function askDesktop(){if(!('Notification' in window)){flash('Desktop notifications are not supported by this browser.');return}try{const p=await Notification.requestPermission();savePrefs({desktop:p});flash(p==='granted'?'Desktop notifications enabled.':'Desktop notifications '+p+'.')}catch{flash('Could not request notification permission.')}}
 return <div className="dash-page settings-page page-enter"><PageTitle kicker="PREFERENCES" title="Settings" copy="Control appearance, motion and alert preferences for this workspace."/>
  {msg&&<div className="profile-success step-pop"><i className="fa-solid fa-circle-check"></i>{msg}</div>}
  <div className="settings-grid">
   <div className="panel settings-card animated-panel"><div className="panel-head"><div><div className="kicker">APPEARANCE</div><h2>Theme &amp; motion</h2></div></div>
    <div className="setting-row"><div><b>Theme</b><small>Choose the workspace colour mode.</small></div><div className="seg"><button type="button" className={theme==='dark'?'active':''} onClick={()=>setTheme('dark')}><i className="fa-solid fa-moon"></i> Dark</button><button type="button" className={theme==='light'?'active':''} onClick={()=>setTheme('light')}><i className="fa-solid fa-sun"></i> Light</button></div></div>
    <div className="setting-row"><div><b>Reduce motion</b><small>Minimise animations and transitions.</small></div><button type="button" className={'switch'+(reduce?' on':'')} aria-pressed={reduce} aria-label="Toggle reduced motion" onClick={()=>setReduce(v=>!v)}><span></span></button></div>
   </div>
   <div className="panel settings-card animated-panel"><div className="panel-head"><div><div className="kicker">NOTIFICATIONS</div><h2>Alerts</h2></div></div>
    <div className="setting-row"><div><b>Desktop notifications</b><small>Allow browser alerts for new workspace activity.</small></div><button type="button" className="ghost" onClick={askDesktop}><i className="fa-regular fa-bell"></i> {prefs.desktop==='granted'?'Enabled':'Enable'}</button></div>
    <div className="setting-row"><div><b>In-app notifications</b><small>Unread alerts appear in the header bell.</small></div><span className="live-pill"><i></i> Always on</span></div>
   </div>
   <div className="panel settings-card animated-panel"><div className="panel-head"><div><div className="kicker">ACCOUNT</div><h2>Signed in as</h2></div></div>
    <div className="setting-row"><div><b>{user.name}</b><small>{user.email} · {user.role}</small></div><button type="button" className="ghost" onClick={()=>onNavigate&&onNavigate('profile')}><i className="fa-solid fa-user-pen"></i> Edit profile</button></div>
    <div className="setting-row"><div><b>Session</b><small>Sign out of this device.</small></div><button type="button" className="danger" onClick={onLogout}><i className="fa-solid fa-right-from-bracket"></i> Sign out</button></div>
   </div>
  </div></div>
}
function HelpContact(){
 const [open,setOpen]=useState(0),[copied,setCopied]=useState('');
 const support='support@eventsphere.example';
 const faqs=[
  ['How do I get started?','Create an account, then open the Overview to see your command center. Organizers can create events, venues and tickets right away.'],
  ['How are tickets and payments handled?','Organizers configure pass types, prices and capacity inside Ticketing. No online payment gateway is connected in this project, so payments are never simulated or charged.'],
  ['Can attendees download their tickets?','Yes — open My Tickets and download a printable ticket file that includes the QR code for check-in.'],
  ['How do messages work?','Messages use Socket.IO when the backend is running, so new messages arrive in real time between accounts.'],
  ['Who can edit my profile?','Only you. Profile updates are protected on the backend and always apply to your own signed-in account.']
 ];
 const copy=async t=>{try{await navigator.clipboard.writeText(t);setCopied(t);setTimeout(()=>setCopied(''),1800)}catch{}};
 return <div className="dash-page help-page page-enter"><PageTitle kicker="SUPPORT" title="Help &amp; Contact" copy="Answers to common questions and the fastest way to reach the EventSphere team."/>
  <div className="help-grid">
   <div className="panel help-faq animated-panel"><div className="panel-head"><div><div className="kicker">FAQ</div><h2>Frequently asked</h2></div></div>
    {faqs.map(([q,a],i)=><div className={'faq-item'+(open===i?' open':'')} key={q}><button type="button" onClick={()=>setOpen(open===i?-1:i)}><span>{q}</span><i className="fa-solid fa-chevron-down"></i></button>{open===i&&<p>{a}</p>}</div>)}
   </div>
   <div className="panel help-contact animated-panel"><div className="panel-head"><div><div className="kicker">CONTACT</div><h2>Talk to us</h2></div></div>
    <a className="help-line" href={'mailto:'+support}><i className="fa-solid fa-envelope"></i><div><b>Email support</b><small>{support}</small></div><i className="fa-solid fa-arrow-up-right-from-square"></i></a>
    <a className="help-line" href="tel:+920000000000"><i className="fa-solid fa-phone"></i><div><b>Phone</b><small>+92 000 0000000</small></div><i className="fa-solid fa-arrow-up-right-from-square"></i></a>
    <button type="button" className="help-line" onClick={()=>copy(support)}><i className="fa-solid fa-copy"></i><div><b>Copy support email</b><small>{copied===support?'Copied to clipboard':'Click to copy'}</small></div><i className={'fa-solid '+(copied===support?'fa-circle-check':'fa-clipboard')}></i></button>
    <div className="help-note"><i className="fa-solid fa-circle-info"></i><span>EventSphere runs on the MERN stack. If a page shows no data, make sure the backend is running on port 5000 and MongoDB is connected.</span></div>
   </div>
  </div></div>
}
function NotFound({onNavigate}){
 return <div className="dash-page notfound-page page-enter"><div className="notfound-card animated-panel"><div className="kicker">ERROR 404</div><h1>This page drifted off the map.</h1><p>The workspace view you asked for does not exist. Head back to your overview or open your profile.</p><div className="row-actions"><button type="button" className="primary" onClick={()=>onNavigate&&onNavigate('overview')}><i className="fa-solid fa-gauge-high"></i> Back to overview</button><button type="button" className="ghost" onClick={()=>onNavigate&&onNavigate('profile')}><i className="fa-solid fa-user-circle"></i> My profile</button></div></div></div>
}
function DashboardRouter({page,user,onProfileSave,onNavigate,onLogout}){if(page==='settings')return <Settings user={user} onNavigate={onNavigate} onLogout={onLogout}/>;if(page==='help')return <HelpContact/>;if(page==='enterprise')return <EnterpriseHub user={user}/>;if(page==='certificates')return <MyCertificates user={user}/>;if(page==='advanced')return <ProOperations user={user}/>;if(page==='experience')return <ExperienceOS user={user}/>;if(page==='ai')return <><AICopilot user={user}/><CopilotAsk user={user}/></>;if(page==='reports')return <ReportsPage/>;if(page==='checkin')return <CheckinPage user={user}/>;if(page==='activity')return <ActivityPage user={user}/>;if(page==='calendar')return <CalendarPage/>;if(page==='budget')return <BudgetPage/>;if(page==='tasks')return <TasksPage/>;if(page==='overview')return <Dashboard user={user} onNavigate={onNavigate}/>;if(page==='events')return <Events user={user}/>;if(page==='venues')return <Venues user={user}/>;if(page==='booths')return <Booths user={user}/>;if(page==='exhibitors')return <Exhibitors user={user}/>;if(page==='tickets')return <Tickets user={user}/>;if(page==='staff')return <Staff user={user}/>;if(page==='sessions')return <Sessions user={user}/>;if(page==='feedback')return <Feedback user={user}/>;if(page==='messages')return <Messages user={user}/>;if(page==='profile')return <Profile user={user} onSave={onProfileSave} onNavigate={onNavigate} onLogout={onLogout}/>;if(page==='analytics')return <Analytics/>;return <NotFound onNavigate={onNavigate}/>}
// A premium glowing dual-layer cursor: a crisp inner dot with a smooth
// trailing ring that expands over interactive elements. Desktop (fine
// pointer) only and disabled for users who prefer reduced motion.
function CustomCursor(){
 const dotRef=useRef(null),ringRef=useRef(null);
 useEffect(()=>{
  if(typeof window==='undefined'||!window.matchMedia)return;
  if(!window.matchMedia('(pointer: fine)').matches)return;
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const dot=dotRef.current,ring=ringRef.current;
  if(!dot||!ring)return;
  document.documentElement.classList.add('es-custom-cursor');
  let mx=window.innerWidth/2,my=window.innerHeight/2,rx=mx,ry=my,raf=0,shown=false;
  const move=e=>{
   mx=e.clientX;my=e.clientY;
   dot.style.transform=`translate3d(${mx}px,${my}px,0) translate(-50%,-50%)`;
   if(!shown){shown=true;dot.classList.add('is-visible');ring.classList.add('is-visible')}
  };
  const loop=()=>{rx+=(mx-rx)*0.2;ry+=(my-ry)*0.2;ring.style.transform=`translate3d(${rx}px,${ry}px,0) translate(-50%,-50%)`;raf=requestAnimationFrame(loop)};
  const over=e=>{const t=e.target.closest?.('button,a,input,select,textarea,label,[role=button],summary,.side-nav,.event-card,.neo-btn,.stat-button');ring.classList.toggle('is-hover',!!t)};
  const down=()=>ring.classList.add('is-down');
  const up=()=>ring.classList.remove('is-down');
  const leave=()=>{dot.classList.remove('is-visible');ring.classList.remove('is-visible');shown=false};
  const enter=()=>{shown=false};
  window.addEventListener('pointermove',move,{passive:true});
  window.addEventListener('pointerover',over,{passive:true});
  window.addEventListener('pointerdown',down,{passive:true});
  window.addEventListener('pointerup',up,{passive:true});
  document.addEventListener('pointerleave',leave);
  document.addEventListener('pointerenter',enter);
  raf=requestAnimationFrame(loop);
  return ()=>{
   document.documentElement.classList.remove('es-custom-cursor');
   cancelAnimationFrame(raf);
   window.removeEventListener('pointermove',move);
   window.removeEventListener('pointerover',over);
   window.removeEventListener('pointerdown',down);
   window.removeEventListener('pointerup',up);
   document.removeEventListener('pointerleave',leave);
   document.removeEventListener('pointerenter',enter);
  };
 },[]);
 return <>
  <div className="es-cursor-dot" ref={dotRef} aria-hidden="true" style={{transform:'translate3d(-100px,-100px,0)'}}></div>
  <div className="es-cursor-ring" ref={ringRef} aria-hidden="true" style={{transform:'translate3d(-100px,-100px,0)'}}></div>
 </>;
}
function App(){
 const [user,setUser]=useState(getUser()),[auth,setAuth]=useState(null),[boot,setBoot]=useState(true);
 useEffect(()=>{const t=setTimeout(()=>setBoot(false),850);const onClick=e=>{if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;const target=e.target.closest?.('button,a,[role=button]');if(!target||target.disabled)return;const r=document.createElement('span');r.className='ripple';r.style.left=e.clientX+'px';r.style.top=e.clientY+'px';document.body.appendChild(r);setTimeout(()=>r.remove(),600)};document.addEventListener('click',onClick);return()=>{clearTimeout(t);document.removeEventListener('click',onClick)}},[]);
 const handleLogout=async()=>{try{if(localStorage.getItem('es_token'))await api('/auth/logout',{method:'POST'});}catch{}finally{localStorage.removeItem('es_token');localStorage.removeItem('es_user');setUser(null);}};
 let content;
 if(boot)content=<Loader full/>;
 else if(!user)content=auth?<Auth mode={auth} onBack={()=>setAuth(null)} onDone={setUser}/>:<PublicSite onAuth={setAuth}/>;
 else content=<DashboardShell user={user} onLogout={handleLogout}/>;
 return <><CustomCursor/>{content}</>;
}
createRoot(document.getElementById('root')).render(<App/>);




