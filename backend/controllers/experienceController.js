import Expo from '../models/Expo.js';
import User from '../models/User.js';
import TicketOrder from '../models/TicketOrder.js';
import ExpoRegistration from '../models/ExpoRegistration.js';
import CheckIn from '../models/CheckIn.js';
import Session from '../models/Session.js';
import Feedback from '../models/Feedback.js';
import Certificate from '../models/Certificate.js';
import Lead from '../models/Lead.js';
import Staff from '../models/Staff.js';
import FinanceTransaction from '../models/FinanceTransaction.js';
import Speaker from '../models/Speaker.js';
import Exhibitor from '../models/Exhibitor.js';
import Booth from '../models/Booth.js';
import OperationItem from '../models/OperationItem.js';

const roles=['admin','organizer'];
const ownEvent=async(req,id)=>{const e=await Expo.findById(id);if(!e)return null;if(req.user.role==='organizer'&&String(e.createdBy)!==String(req.user._id))return undefined;return e};

export const live=async(req,res,next)=>{try{
 const expo=await ownEvent(req,req.query.expo); if(req.query.expo&&expo===undefined)return res.status(403).json({message:'Access denied'});
 const q=expo?{expo:expo._id}:{};
 const [orders,regs,booths,leads,sessions,incidents]=await Promise.all([
  TicketOrder.find(q),ExpoRegistration.find(q),Booth.find(q),Lead.find(q),Session.find(q),OperationItem.find(expo?{expo:expo._id,type:'incident',status:{$ne:'resolved'}}:{type:'incident',status:{$ne:'resolved'}})
 ]);
 const paid=orders.filter(x=>x.status==='paid');
 const checked=paid.filter(x=>x.checkedInAt);
 const activeSessions=sessions.filter(x=>new Date(x.startTime)<=new Date()&&new Date(x.endTime)>=new Date());
 const boothBooked=booths.filter(x=>['booked','occupied','reserved'].includes(String(x.status||'').toLowerCase()));
 res.json({success:true,event:expo,stats:{registered:regs.length,ticketsSold:paid.reduce((n,x)=>n+Number(x.quantity||0),0),checkedIn:checked.reduce((n,x)=>n+Number(x.quantity||0),0),booths:booths.length,boothsOccupied:boothBooked.length,boothOccupancy:booths.length?Math.round(boothBooked.length/booths.length*100):0,liveSessions:activeSessions.length,newLeads:leads.filter(x=>Date.now()-new Date(x.createdAt).getTime()<86400000).length,revenue:paid.reduce((n,x)=>n+Number(x.total||0),0),incidents:incidents.length,system:'ONLINE'},sessions:activeSessions});
}catch(e){next(e)}};

export const attendee360=async(req,res,next)=>{try{
 const id=req.params.id; if(req.user.role==='attendee'&&String(req.user._id)!==String(id))return res.status(403).json({message:'Access denied'});
 const user=await User.findById(id).select('-password'); if(!user)return res.status(404).json({message:'Attendee not found'});
 const [registrations,tickets,checkins,sessions,feedback,certificates]=await Promise.all([
  ExpoRegistration.find({user:id}).populate('expo','title date location'),
  TicketOrder.find({attendee:id}).populate('expo','title date').sort('-createdAt'),
  CheckIn.find({attendee:id}).populate('expo','title').populate('ticket','invoiceNo passType'),
  Session.find({attendees:id}).populate('expo','title').sort('-startTime'),
  Feedback.find({user:id}).populate('expo','title').sort('-createdAt'),
  Certificate.find({user:id}).populate('expo','title').sort('-issuedAt')
 ]);
 res.json({success:true,user,registrations,tickets,checkins,sessions,feedback,certificates,summary:{events:registrations.length,tickets:tickets.length,checkins:checkins.length,sessions:sessions.length,certificates:certificates.length}});
}catch(e){next(e)}};

export const directory=async(req,res,next)=>{try{
 const expo=req.query.expo; const q=expo?{expo}:{};
 const [attendees,exhibitors,speakers]=await Promise.all([
  User.find({role:'attendee'}).select('name company jobTitle bio interests avatar').limit(200),
  Exhibitor.find(q).populate('user','name company email').limit(200),
  Speaker.find(q).select('name title company bio photo social session').populate('session','title')
 ]);
 res.json({success:true,attendees,exhibitors,speakers});
}catch(e){next(e)}};

export const gamification=async(req,res,next)=>{try{
 const expo=req.query.expo; const q=expo?{expo}:{}; const users=await User.find({role:'attendee'}).select('name company avatar interests');
 const Engagement=(await import('../models/EventEngagement.js')).default;
 const [engagements,checkins,feedbacks,sessions]=await Promise.all([
  Engagement.find(q), CheckIn.find(q), Feedback.find(q), Session.find(q)
 ]);
 const board=users.map(u=>{
  const own=engagements.filter(x=>String(x.user)===String(u._id));
  const c=own.filter(x=>x.type==='checkin').length||checkins.filter(x=>String(x.attendee)===String(u._id)).length;
  const s=own.filter(x=>x.type==='session').length||sessions.filter(x=>(x.attendees||[]).some(id=>String(id)===String(u._id))).length;
  const b=own.filter(x=>x.type==='booth').length,n=own.filter(x=>x.type==='networking').length;
  const f=own.filter(x=>x.type==='feedback').length||feedbacks.filter(x=>String(x.user)===String(u._id)).length;
  const points=c*10+s*20+b*10+f*5+n*15;
  const badges=[];if(c>=1)badges.push('Checked In');if(s>=3)badges.push('Session Pro');if(b>=5)badges.push('Event Explorer');if(n>=5)badges.push('Connector');
  return{user:u,points,rank:points>=100?'GOLD':points>=50?'SILVER':'BRONZE',breakdown:{checkin:c,session:s,booth:b,feedback:f,networking:n},badges};
 }).filter(x=>x.points>0).sort((a,b)=>b.points-a.points).slice(0,50);
 res.json({success:true,leaderboard:board});
}catch(e){next(e)}};

export const operations=async(req,res,next)=>{try{
 if(!roles.includes(req.user.role))return res.status(403).json({message:'Organizer access required'});
 const expo=await ownEvent(req,req.query.expo);if(req.query.expo&&expo===undefined)return res.status(403).json({message:'Access denied'});
 const q=expo?{event:expo._id}:{};
 const [staff,checkins]=await Promise.all([Staff.find(q).sort('name'),CheckIn.find(expo?{expo:expo._id}:{}).populate('attendee','name email').sort('-checkedInAt').limit(100)]);
 res.json({success:true,staff,checkins});
}catch(e){next(e)}};

export const superadmin=async(req,res,next)=>{try{
 if(req.user.role!=='admin')return res.status(403).json({message:'Super Admin access required'});
 const [organizations,events,users,orders,staff]=await Promise.all([
  User.countDocuments({role:'organizer'}),Expo.countDocuments(),User.countDocuments(),TicketOrder.find({status:'paid'}),Staff.countDocuments()
 ]);
 const revenue=orders.reduce((n,x)=>n+Number(x.total||0),0);
 res.json({success:true,platform:{organizations,events,users,staff,revenue,activeEvents:await Expo.countDocuments({status:'published'}),system:{api:'ONLINE',database:'CONNECTED',realtime:'ONLINE',storage:'READY',payments:process.env.STRIPE_SECRET_KEY?'CONFIGURED':'DEMO MODE'}}});
}catch(e){next(e)}};

export const security=async(req,res,next)=>{try{
 const user=await User.findById(req.user._id).select('name email role createdAt updatedAt').lean();
 res.json({success:true,security:{twoFactor:false,activeSessions:1,device:'Current browser',passwordResetReady:true,lastProfileUpdate:user?.updatedAt,accountCreated:user?.createdAt,permissionScope:user?.role}});
}catch(e){next(e)}};

export const feedbackSummary=async(req,res,next)=>{try{
 const q=req.query.expo?{expo:req.query.expo}:{};const rows=await Feedback.find(q).populate('user','name').sort('-createdAt').limit(500);
 const avg=rows.length?rows.reduce((n,x)=>n+Number(x.rating||0),0)/rows.length:0;
 res.json({success:true,average:Number(avg.toFixed(2)),count:rows.length,ratings:[5,4,3,2,1].map(r=>({rating:r,count:rows.filter(x=>x.rating===r).length})),feedback:rows});
}catch(e){next(e)}};

export const venue=async(req,res,next)=>{try{
 const expo=await Expo.findById(req.query.expo);if(!expo)return res.status(404).json({message:'Event not found'});
 const booths=await Booth.find({expo}).populate('exhibitor','name company').sort('boothNumber');
 const speakers=await Speaker.find({expo}).populate('session','title');
 res.json({success:true,event:expo,booths,speakers});
}catch(e){next(e)}};

export const leadFromTicket=async(req,res,next)=>{try{
 if(req.user.role!=='exhibitor')return res.status(403).json({message:'Exhibitor access required'});
 const ticket=await TicketOrder.findOne({qrToken:req.body.qrToken}).populate('attendee','name email company');
 if(!ticket)return res.status(404).json({message:'Attendee QR ticket not found'});
 const existing=await Lead.findOne({expo:ticket.expo,exhibitor:req.user._id,attendee:ticket.attendee._id});
 if(existing)return res.json({success:true,lead:existing,existing:true});
 const lead=await Lead.create({expo:ticket.expo,exhibitor:req.user._id,attendee:ticket.attendee._id,name:ticket.attendee.name,email:ticket.attendee.email,company:ticket.attendee.company||'',source:'attendee-qr',status:'new'});
 req.app.get('io')?.to(`user:${req.user._id}`).emit('lead:new',lead);
 res.status(201).json({success:true,lead,existing:false});
}catch(e){next(e)}};

const engagementPoints = { checkin: 10, session: 20, booth: 10, feedback: 5, networking: 15 };
const eventScope = async (req, id) => {
 const expo = await ownEvent(req, id);
 if (id && expo === undefined) return undefined;
 return expo;
};

export const intelligence = async (req,res,next)=>{try{
 const expo=await eventScope(req,req.query.expo); if(req.query.expo&&expo===undefined)return res.status(403).json({message:'Access denied'});
 const q=expo?{expo:expo._id}:{};
 const [orders,regs,booths,leads,sessions,feedback,checkins]=await Promise.all([
  TicketOrder.find(q).sort('-createdAt'), ExpoRegistration.find(q), Booth.find(q), Lead.find(q), Session.find(q), Feedback.find(q), CheckIn.find(q).sort('checkedInAt')
 ]);
 const paid=orders.filter(x=>x.status==='paid');
 const revenue=paid.reduce((n,x)=>n+Number(x.total||0),0);
 const booked=booths.filter(x=>['reserved','occupied'].includes(x.status));
 const attendanceByDay={};
 checkins.forEach(x=>{const k=new Date(x.checkedInAt||x.createdAt).toISOString().slice(0,10);attendanceByDay[k]=(attendanceByDay[k]||0)+1});
 const attendanceTrend=Object.entries(attendanceByDay).slice(-7).map(([date,count])=>({date,count}));
 const sessionPopularity=sessions.map(s=>({id:s._id,title:s.title,attendees:s.attendees?.length||0,capacity:s.capacity||0})).sort((a,b)=>b.attendees-a.attendees).slice(0,6);
 const lowPerformingBooths=booths.filter(b=>b.status==='available').slice(0,8).map(b=>({id:b._id,boothNumber:b.boothNumber,status:b.status,reason:'No exhibitor assigned'}));
 const attention=[];
 if(regs.length && checkins.length/regs.length<0.5)attention.push({level:'high',title:'Attendance conversion is low',detail:`${checkins.length} check-ins from ${regs.length} registrations.`});
 if(lowPerformingBooths.length)attention.push({level:'medium',title:`${lowPerformingBooths.length} booths need attention`,detail:'Available booths are still unassigned.'});
 const weakSessions=sessionPopularity.filter(s=>s.capacity&&s.attendees/s.capacity<0.35);
 if(weakSessions.length)attention.push({level:'medium',title:'Some sessions have low booking',detail:`${weakSessions.length} sessions are below 35% capacity.`});
 if(orders.some(x=>x.status==='pending'))attention.push({level:'medium',title:'Pending ticket payments',detail:`${orders.filter(x=>x.status==='pending').length} orders still need payment resolution.`});
 const summary=expo?`${expo.title} has ${regs.length} registrations, ${checkins.length} check-ins and ${formatMoneyLocal(revenue)} in paid ticket revenue. ${booked.length}/${booths.length||0} booths are occupied or reserved.`:'Your EventSphere workspace is ready for live event intelligence.';
 res.json({success:true,summary,metrics:{registrations:regs.length,checkedIn:checkins.length,revenue,paidTickets:paid.length,leads:leads.length,booths:booths.length,occupiedBooths:booked.length,sessions:sessions.length,feedback:feedback.length},attendanceTrend,sessionPopularity,lowPerformingBooths,attention});
}catch(e){next(e)}};

const formatMoneyLocal = v => `PKR ${Number(v||0).toLocaleString()}`;

export const health = async(req,res,next)=>{try{
 const expo=await eventScope(req,req.query.expo); if(req.query.expo&&expo===undefined)return res.status(403).json({message:'Access denied'});
 const q=expo?{expo:expo._id}:{};
 const [regs,orders,booths,sessions,feedback,staff]=await Promise.all([ExpoRegistration.find(q),TicketOrder.find(q),Booth.find(q),Session.find(q),Feedback.find(q),Staff.find(expo?{event:expo._id}:{})]);
 const checked=orders.filter(x=>x.status==='paid'&&x.checkedInAt).length;
 const occupancy=booths.length?booths.filter(x=>['reserved','occupied'].includes(x.status)).length/booths.length:1;
 const avg=feedback.length?feedback.reduce((n,x)=>n+Number(x.rating||0),0)/feedback.length:5;
 const sessionBooked=sessions.reduce((n,x)=>n+(x.attendees?.length||0),0);
 const checks=[
  ['Attendance',regs.length?checked/regs.length:1],
  ['Revenue',orders.some(x=>x.status==='paid')?1:0.35],
  ['Booths',occupancy],
  ['Sessions',sessions.length?(sessionBooked/sessions.reduce((n,x)=>n+(x.capacity||1),0)):1],
  ['Feedback',avg/5],
  ['Operations',staff.length?staff.filter(x=>x.active).length/staff.length:1]
 ].map(([name,v])=>({name,value:Math.round(v*100),status:v>=.7?'green':v>=.4?'yellow':'red'}));
 const red=checks.filter(x=>x.status==='red').length,yellow=checks.filter(x=>x.status==='yellow').length;
 res.json({success:true,overall:red?'ATTENTION':yellow?'MONITOR':'HEALTHY',checks});
}catch(e){next(e)}};

export const network = async(req,res,next)=>{try{
 const expo=req.query.expo;
 const me=await User.findById(req.user._id).select('name company jobTitle interests role');
 const mine=(me?.interests||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
 const attendees=await User.find({role:'attendee',_id:{$ne:req.user._id}}).select('name company jobTitle interests avatar').limit(300);
 const exhibQ=expo?{expo}:{};
 const exhibitors=await Exhibitor.find(exhibQ).populate('user','name company jobTitle interests avatar').limit(100);
 const score=(text)=>{const theirs=String(text||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);const overlap=mine.filter(x=>theirs.some(y=>y===x||y.includes(x)||x.includes(y))).length;return {overlap,percent:mine.length?Math.min(99,Math.round(overlap/mine.length*100)):0};};
 const people=attendees.map(a=>({type:'attendee',id:a._id,name:a.name,company:a.company,jobTitle:a.jobTitle,interests:a.interests,match:score(a.interests)}));
 const companies=exhibitors.map(e=>({type:'exhibitor',id:e._id,name:e.companyName||e.user?.company||'Exhibitor',contact:e.user?.name,interests:e.user?.interests||'',match:score(e.user?.interests)}));
 res.json({success:true,interests:mine,suggestions:[...people,...companies].sort((a,b)=>b.match.percent-a.match.percent).slice(0,30)});
}catch(e){next(e)}};

export const updateInterests=async(req,res,next)=>{try{
 const interests=Array.isArray(req.body.interests)?req.body.interests.filter(Boolean).slice(0,12):String(req.body.interests||'').split(',').map(x=>x.trim()).filter(Boolean).slice(0,12);
 const user=await User.findByIdAndUpdate(req.user._id,{interests:interests.join(', ')},{new:true}).select('-password');
 res.json({success:true,user,interests});
}catch(e){next(e)}};

export const engagement=async(req,res,next)=>{try{
 const {expo,type,targetId,metadata}=req.body;
 if(!expo||!engagementPoints[type])return res.status(400).json({message:'Event and valid engagement type are required.'});
 const existing=targetId?await (await import('../models/EventEngagement.js')).default.findOne({expo,user:req.user._id,type,targetId}):null;
 if(existing)return res.json({success:true,engagement:existing,duplicate:true,points:0});
 const Engagement=(await import('../models/EventEngagement.js')).default;
 const item=await Engagement.create({expo,user:req.user._id,type,targetId:targetId||null,metadata:metadata||{}});
 req.app.get('io')?.to(`expo:${expo}`).emit('engagement:new',item);
 res.status(201).json({success:true,engagement:item,points:engagementPoints[type]});
}catch(e){next(e)}};

export const passport=async(req,res,next)=>{try{
 if(req.user.role==='attendee'&&String(req.user._id)!==String(req.params.id))return res.status(403).json({message:'Access denied'});
 const Engagement=(await import('../models/EventEngagement.js')).default;
 const q={user:req.params.id,...(req.query.expo?{expo:req.query.expo}:{})};
 const [user,engagements,feedback,checkins,sessions]=await Promise.all([User.findById(req.params.id).select('name company jobTitle avatar interests'),Engagement.find(q).sort('-createdAt'),Feedback.find({user:req.params.id,...(req.query.expo?{expo:req.query.expo}:{})}),CheckIn.find({attendee:req.params.id,...(req.query.expo?{expo:req.query.expo}:{})}),Session.find({attendees:req.params.id,...(req.query.expo?{expo:req.query.expo}:{})})]);
 const counts=engagements.reduce((a,x)=>(a[x.type]=(a[x.type]||0)+1,a),{});
 const points=(counts.checkin||checkins.length)*10+(counts.session||sessions.length)*20+(counts.booth||0)*10+(counts.feedback||feedback.length)*5+(counts.networking||0)*15;
 const badges=[]; if((counts.booth||0)>=5)badges.push('Event Explorer'); if((counts.networking||0)>=5)badges.push('Connector'); if((counts.session||sessions.length)>=3)badges.push('Session Pro'); if((counts.checkin||checkins.length)>=1)badges.push('Checked In');
 res.json({success:true,user,counts,points,badges,engagements});
}catch(e){next(e)}};

export const companion=async(req,res,next)=>{try{
 const expo=req.query.expo; if(!expo)return res.json({success:true,schedule:[],savedSessions:[],ticket:null,map:[],notifications:[],rewards:{points:0,badges:[]}});
 const [ticket,sessions,venue,engagements]=await Promise.all([
  TicketOrder.findOne({expo,attendee:req.user._id,status:'paid'}).sort('-createdAt').populate('expo','title date location').populate('attendee','name company avatar'),
  Session.find({expo,attendees:req.user._id}).sort('startTime'),
  Booth.find({expo}).populate('exhibitor','name company').sort('boothNumber'),
  (await import('../models/EventEngagement.js')).default.find({expo,user:req.user._id})
 ]);
 const counts=engagements.reduce((a,x)=>(a[x.type]=(a[x.type]||0)+1,a),{});
 const points=(counts.checkin||0)*10+(counts.session||sessions.length)*20+(counts.booth||0)*10+(counts.feedback||0)*5+(counts.networking||0)*15;
 const badges=[];if((counts.checkin||0)>=1)badges.push('Checked In');if((counts.session||sessions.length)>=3)badges.push('Session Pro');if((counts.booth||0)>=5)badges.push('Event Explorer');if((counts.networking||0)>=5)badges.push('Connector');
 res.json({success:true,ticket,schedule:sessions,savedSessions:sessions,map:venue,rewards:{points,badges}});
}catch(e){next(e)}};

export const leadScore=async(req,res,next)=>{try{
 const q=req.user.role==='exhibitor'?{exhibitor:req.user._id,...(req.query.expo?{expo:req.query.expo}:{})}:{...(req.query.expo?{expo:req.query.expo}:{})};
 const leads=await Lead.find(q).populate('attendee','name company interests').sort('-createdAt').limit(100);
 const rows=leads.map(l=>{const age=Math.max(0,Date.now()-new Date(l.createdAt).getTime());const recency=Math.max(0,25-Math.round(age/3600000)*3);const status={new:20,contacted:35,qualified:50,won:50,lost:0}[l.status]||10;const profile=(l.company?10:0)+(l.email?5:0)+(l.notes?10:0);const score=Math.min(100,Math.max(0,status+recency+profile));return {...l.toObject(),score,quality:score>=75?'HIGH':score>=50?'MEDIUM':'LOW',interest:score,followUp:score>=75?'Tomorrow':score>=50?'Within 3 days':'Nurture'};});
 res.json({success:true,leads:rows});
}catch(e){next(e)}};

export const operationsBoard=async(req,res,next)=>{try{
 const expo=await eventScope(req,req.query.expo); if(req.query.expo&&expo===undefined)return res.status(403).json({message:'Access denied'});
 const OperationItem=(await import('../models/OperationItem.js')).default;
 const rows=await OperationItem.find(expo?{expo:expo._id}:{}).populate('assignedTo','name role shiftStart shiftEnd').sort('-createdAt').limit(100);
 const staff=await Staff.find(expo?{event:expo._id}:{ }).sort('name');
 const [checkins,orders]=await Promise.all([CheckIn.find(expo?{expo:expo._id}:{}),TicketOrder.find(expo?{expo:expo._id}:{}).select('status checkedInAt')]);
 res.json({success:true,items:rows,staff,checkinCount:checkins.length,paidTickets:orders.filter(x=>x.status==='paid').length,openCounters:Math.max(1,Math.ceil(checkins.length/100)||1)});
}catch(e){next(e)}};

export const createOperation=async(req,res,next)=>{try{
 const OperationItem=(await import('../models/OperationItem.js')).default;
 const expo=await eventScope(req,req.body.expo);if(!expo)return res.status(404).json({message:'Event not found or access denied.'});
 const item=await OperationItem.create({...req.body,expo:expo._id,createdBy:req.user._id});
 req.app.get('io')?.to(`expo:${expo._id}`).emit('operation:new',item);
 res.status(201).json({success:true,item});
}catch(e){next(e)}};

export const updateOperation=async(req,res,next)=>{try{
 const OperationItem=(await import('../models/OperationItem.js')).default;
 const current=await OperationItem.findById(req.params.id);if(!current)return res.status(404).json({message:'Operation item not found'});
 if(req.user.role==='organizer'){const expo=await ownEvent(req,current.expo);if(!expo)return res.status(403).json({message:'Access denied'});}
 const item=await OperationItem.findByIdAndUpdate(req.params.id,req.body,{new:true,runValidators:true}).populate('assignedTo','name role shiftStart shiftEnd');
 req.app.get('io')?.to(`expo:${current.expo}`).emit('operation:update',item);
 res.json({success:true,item});
}catch(e){next(e)}};
