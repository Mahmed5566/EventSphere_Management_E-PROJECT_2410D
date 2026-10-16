import Speaker from '../models/Speaker.js';
import Sponsor from '../models/Sponsor.js';
import FinanceTransaction from '../models/FinanceTransaction.js';
import AuditLog from '../models/AuditLog.js';
import CheckIn from '../models/CheckIn.js';
import Certificate from '../models/Certificate.js';
import Campaign from '../models/Campaign.js';
import TicketOrder from '../models/TicketOrder.js';
import Expo from '../models/Expo.js';
import User from '../models/User.js';
import Session from '../models/Session.js';
import Booth from '../models/Booth.js';
import {sendEmail} from '../utils/mailer.js';

export async function log(req,action,entity,entityId,details={}){try{await AuditLog.create({actor:req.user?._id,action,entity,entityId:String(entityId||''),details,ip:req.ip})}catch(e){console.error('audit',e.message)}}
const ownerRoles=['admin','organizer'];
const ok=(req)=>ownerRoles.includes(req.user?.role);
export const speakers=async(req,res)=>{const q=req.query.expo?{expo:req.query.expo}:{};res.json({success:true,speakers:await Speaker.find(q).populate('expo','title').populate('session','title').sort('-createdAt')})};
export const speakerCreate=async(req,res)=>{if(!ok(req))return res.status(403).json({message:'Organizer access required'});const x=await Speaker.create({...req.body});await log(req,'created','Speaker',x._id);res.status(201).json({success:true,speaker:x})};
export const speakerUpdate=async(req,res)=>{if(!ok(req))return res.status(403).json({message:'Organizer access required'});const x=await Speaker.findByIdAndUpdate(req.params.id,req.body,{new:true});if(!x)return res.status(404).json({message:'Speaker not found'});await log(req,'updated','Speaker',x._id);res.json({success:true,speaker:x})};
export const speakerDelete=async(req,res)=>{if(!ok(req))return res.status(403).json({message:'Organizer access required'});await Speaker.findByIdAndDelete(req.params.id);await log(req,'deleted','Speaker',req.params.id);res.json({success:true})};

export const sponsors=async(req,res)=>{const q=req.query.expo?{expo:req.query.expo}:{};res.json({success:true,sponsors:await Sponsor.find(q).populate('expo','title').sort('-createdAt')})};
export const sponsorCreate=async(req,res)=>{if(!ok(req))return res.status(403).json({message:'Organizer access required'});const x=await Sponsor.create(req.body);await log(req,'created','Sponsor',x._id);res.status(201).json({success:true,sponsor:x})};
export const sponsorUpdate=async(req,res)=>{if(!ok(req))return res.status(403).json({message:'Organizer access required'});const x=await Sponsor.findByIdAndUpdate(req.params.id,req.body,{new:true});if(!x)return res.status(404).json({message:'Sponsor not found'});await log(req,'updated','Sponsor',x._id);res.json({success:true,sponsor:x})};
export const sponsorDelete=async(req,res)=>{if(!ok(req))return res.status(403).json({message:'Organizer access required'});await Sponsor.findByIdAndDelete(req.params.id);await log(req,'deleted','Sponsor',req.params.id);res.json({success:true})};

export const finances=async(req,res)=>{const q=req.query.expo?{expo:req.query.expo}:{};const rows=await FinanceTransaction.find(q).sort('-createdAt');const income=rows.filter(x=>x.type==='income').reduce((a,x)=>a+x.amount,0),expense=rows.filter(x=>x.type==='expense').reduce((a,x)=>a+x.amount,0);res.json({success:true,transactions:rows,summary:{income,expense,profit:income-expense}})};
export const financeCreate=async(req,res)=>{if(!ok(req))return res.status(403).json({message:'Organizer access required'});const x=await FinanceTransaction.create({...req.body,createdBy:req.user._id});await log(req,'created','FinanceTransaction',x._id);res.status(201).json({success:true,transaction:x})};
export const financeDelete=async(req,res)=>{if(!ok(req))return res.status(403).json({message:'Organizer access required'});await FinanceTransaction.findByIdAndDelete(req.params.id);await log(req,'deleted','FinanceTransaction',req.params.id);res.json({success:true})};

export const audit=async(req,res)=>{if(!ok(req))return res.status(403).json({message:'Organizer access required'});res.json({success:true,logs:await AuditLog.find().populate('actor','name email role').sort('-createdAt').limit(300)})};

export const checkin=async(req,res)=>{if(!ok(req))return res.status(403).json({message:'Staff/organizer access required'});const ticketKey=String(req.body.ticketId||req.body.qrToken||'').trim();
const order=await TicketOrder.findOne({status:'paid',$or:[{_id:ticketKey},{qrToken:ticketKey},{invoiceNo:ticketKey}]}).populate('attendee','name email').populate('expo','title');if(!order)return res.status(404).json({message:'Paid ticket not found'});const exists=await CheckIn.findOne({ticket:order._id});if(exists)return res.status(409).json({message:'Ticket already checked in',checkin:exists});const x=await CheckIn.create({ticket:order._id,expo:order.expo._id,attendee:order.attendee._id,checkedInBy:req.user._id});await log(req,'checked-in','TicketOrder',order._id,{ticket:order._id});req.app.get('io')?.to(`expo:${order.expo._id}`).emit('attendance:checkin',{ticket:order._id,user:order.attendee});res.status(201).json({success:true,checkin:x,attendee:order.attendee,event:order.expo})};
export const checkinList=async(req,res)=>{const q=req.query.expo?{expo:req.query.expo}:{};res.json({success:true,checkins:await CheckIn.find(q).populate('attendee','name email').populate('ticket','ticketCode ticketType').sort('-checkedInAt')})};

export const certificateCreate=async(req,res)=>{const {expoId,userId,sessionId}=req.body;if(!expoId||!userId)return res.status(400).json({message:'expoId and userId required'});const existing=await Certificate.findOne({expo:expoId,user:userId,session:sessionId||null});if(existing)return res.json({success:true,certificate:existing});const no=`ES-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random()*9000+1000)}`;const x=await Certificate.create({expo:expoId,user:userId,session:sessionId||undefined,certificateNo:no});await log(req,'issued','Certificate',x._id);res.status(201).json({success:true,certificate:x})};
export const certificates=async(req,res)=>{const q={};if(req.user.role==='attendee')q.user=req.user._id;if(req.query.expo)q.expo=req.query.expo;res.json({success:true,certificates:await Certificate.find(q).populate('expo','title').populate('user','name email').populate('session','title').sort('-issuedAt')})};

export const campaigns=async(req,res)=>{if(!ok(req))return res.status(403).json({message:'Organizer access required'});res.json({success:true,campaigns:await Campaign.find().sort('-createdAt').limit(100)})};
export const campaignSend=async(req,res)=>{if(!ok(req))return res.status(403).json({message:'Organizer access required'});const c=await Campaign.create({...req.body,createdBy:req.user._id,status:'sent',sentAt:new Date()});let q={};if(req.body.audience==='attendees')q={role:'attendee'};if(req.body.audience==='exhibitors')q={role:'exhibitor'};if(req.body.audience==='staff')q={role:'staff'};if(req.body.audience==='speakers')q={role:'speaker'};if(req.body.audience==='vip')q={role:'attendee'};const recipients=await User.find(q).select('email name');
const speakerEmails=req.body.audience==='speakers'?await Speaker.find({expo:req.body.expo,email:{$exists:true,$ne:''}}).select('email name'):[]; 
const emails=[...recipients.map(u=>u.email),...speakerEmails.map(u=>u.email)].filter(Boolean);
if(process.env.SMTP_HOST) await Promise.allSettled(emails.map(to=>sendEmail({to,subject:req.body.subject,html:`<div style="font-family:Arial"><h2>${req.body.subject}</h2><p>${String(req.body.message||'').replace(/\n/g,'<br>')}</p><p>EventSphere</p></div>`})));
const count=emails.length||recipients.length;c.sentCount=count;await c.save();await log(req,'sent','Campaign',c._id,{audience:req.body.audience,count});res.status(201).json({success:true,campaign:c,recipients:count})};

export const aiAsk=async(req,res,next)=>{try{
 const q=String(req.body.question||'').trim();if(!q)return res.status(400).json({message:'Question required'});
 const norm=q.toLowerCase();
 const [events,tickets,booths,sessions,sponsors,registrations,applications,finance]=await Promise.all([
  Expo.find().select('title date endDate location status').limit(100),
  TicketOrder.find().select('expo quantity total status checkedInAt passType').limit(1000),
  Booth.find().select('expo boothNumber status category').limit(1000),
  Session.find().select('expo title speaker startTime endTime location').sort('startTime').limit(500),
  Sponsor.find().select('expo name tier status amount').limit(300),
  ExpoRegistration.find().select('expo user type status').limit(1000),
  ExhibitorApplication.find().select('expo companyName status paymentStatus').limit(500),
  FinanceTransaction.find().select('expo type amount category description').limit(1000)
 ]);
 const revenue=tickets.filter(x=>x.status==='paid').reduce((a,x)=>a+Number(x.total||0),0);
 const ticketQty=tickets.filter(x=>x.status==='paid').reduce((a,x)=>a+Number(x.quantity||0),0);
 const checkedIn=tickets.filter(x=>x.status==='paid'&&x.checkedInAt).reduce((a,x)=>a+Number(x.quantity||0),0);
 const income=finance.filter(x=>x.type==='income').reduce((a,x)=>a+Number(x.amount||0),0),expense=finance.filter(x=>x.type==='expense').reduce((a,x)=>a+Number(x.amount||0),0);
 let answer='', cards=[];
 const eventMatch=events.find(e=>norm.includes(String(e.title||'').toLowerCase()));
 if(/profit|expense|finance|income/.test(norm)){answer=`Financial snapshot: PKR ${revenue.toLocaleString()} in paid ticket revenue, PKR ${income.toLocaleString()} recorded income, PKR ${expense.toLocaleString()} expenses and PKR ${(revenue+income-expense).toLocaleString()} net operating contribution.`;cards=[{label:'Ticket revenue',value:`PKR ${revenue.toLocaleString()}`},{label:'Expenses',value:`PKR ${expense.toLocaleString()}`},{label:'Net',value:`PKR ${(revenue+income-expense).toLocaleString()}`}];}
 else if(/vip|attendee/.test(norm)){const vip=tickets.filter(x=>x.status==='paid'&&x.passType==='VIP Pass').reduce((a,x)=>a+Number(x.quantity||0),0);answer=`There are ${vip} paid VIP passes, ${ticketQty} paid tickets overall and ${checkedIn} ticket quantities checked in.`;cards=[{label:'VIP',value:vip},{label:'Paid tickets',value:ticketQty},{label:'Checked in',value:checkedIn}];}
 else if(/registration|pending.*application|application/.test(norm)){const pending=applications.filter(x=>x.status==='pending').length;answer=`EventSphere currently has ${registrations.length} registrations and ${pending} pending exhibitor applications.`;cards=[{label:'Registrations',value:registrations.length},{label:'Pending applications',value:pending}];}
 else if(/low.?perform|booth.*performance/.test(norm)){const counts=new Map();tickets.filter(x=>x.status==='paid').forEach(x=>counts.set(String(x.expo), (counts.get(String(x.expo))||0)+Number(x.quantity||0)));const low=[...events].sort((a,b)=>(counts.get(String(a._id))||0)-(counts.get(String(b._id))||0)).slice(0,5);answer=low.length?`Lowest ticket-volume events right now: ${low.map(x=>`${x.title} (${counts.get(String(x._id))||0} tickets)`).join(', ')}.`:'No event performance data is available yet.';cards=low.map(x=>({label:x.title,value:`${counts.get(String(x._id))||0} tickets`}));}
 else if(/booth/.test(norm)){const hits=booths.filter(b=>norm.includes(String(b.boothNumber||'').toLowerCase()));const available=booths.filter(b=>b.status==='available').length;answer=hits.length?`Booth ${hits[0].boothNumber} is currently ${hits[0].status||'available'} (${hits[0].category||'Standard'}).`:`There are ${available} available booths across ${booths.length} booth records.`;cards=hits.length?[{label:`Booth ${hits[0].boothNumber}`,value:hits[0].status}]:[{label:'Available',value:available},{label:'Total booths',value:booths.length}];}
 else if(/session|schedule|speaker|tomorrow|kal/.test(norm)){const now=new Date(),day=norm.includes('tomorrow')||norm.includes('kal')?new Date(now.getTime()+86400000):null;let hits=sessions;if(day)hits=sessions.filter(x=>{const d=new Date(x.startTime);return d.toDateString()===day.toDateString()});hits=hits.slice(0,8);answer=hits.length?hits.map(x=>`${x.title} — ${x.speaker||'Speaker TBA'} at ${new Date(x.startTime).toLocaleString([], {dateStyle:'medium',timeStyle:'short'})}`).join(' | '):'No matching sessions are scheduled.';cards=hits.slice(0,5).map(x=>({label:x.title,value:new Date(x.startTime).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}));}
 else if(/sponsor/.test(norm)){const approved=sponsors.filter(x=>x.status==='approved'||x.status==='paid').length;answer=`There are ${sponsors.length} sponsor records, with ${approved} approved or paid. Total sponsor value recorded is PKR ${sponsors.reduce((a,x)=>a+Number(x.amount||0),0).toLocaleString()}.`;cards=[{label:'Sponsors',value:sponsors.length},{label:'Approved/Paid',value:approved}];}
 else if(eventMatch){const eventTickets=tickets.filter(x=>String(x.expo)===String(eventMatch._id)&&x.status==='paid');const eventBooths=booths.filter(x=>String(x.expo)===String(eventMatch._id));const eventSessions=sessions.filter(x=>String(x.expo)===String(eventMatch._id));answer=`${eventMatch.title}: ${eventTickets.reduce((a,x)=>a+Number(x.quantity||0),0)} paid tickets, PKR ${eventTickets.reduce((a,x)=>a+Number(x.total||0),0).toLocaleString()} revenue, ${eventBooths.length} booths and ${eventSessions.length} sessions.`;cards=[{label:'Tickets',value:eventTickets.reduce((a,x)=>a+Number(x.quantity||0),0)},{label:'Revenue',value:`PKR ${eventTickets.reduce((a,x)=>a+Number(x.total||0),0).toLocaleString()}`},{label:'Sessions',value:eventSessions.length}];}
 else{answer=`I can work from ${events.length} events, ${ticketQty} paid tickets, ${booths.length} booths, ${sessions.length} sessions, ${sponsors.length} sponsors, ${registrations.length} registrations and ${applications.length} exhibitor applications. Ask about revenue, profit, VIP attendees, booths, tomorrow's sessions, registrations, sponsors or a specific event.`;cards=[{label:'Events',value:events.length},{label:'Paid tickets',value:ticketQty},{label:'Booths',value:booths.length},{label:'Sessions',value:sessions.length}];}
 res.json({success:true,answer,cards,context:{events:events.length,paidTickets:ticketQty,checkedIn,booths:booths.length,sessions:sessions.length,sponsors:sponsors.length,registrations:registrations.length,applications:applications.length}});
}catch(e){next(e)}};

export const certificateDownload=async(req,res)=>{
 const c=await Certificate.findById(req.params.id).populate('expo','title').populate('user','name email').populate('session','title');
 if(!c)return res.status(404).json({message:'Certificate not found'});
 if(req.user.role==='attendee' && String(c.user._id)!==String(req.user._id))return res.status(403).json({message:'Access denied'});
 const esc=s=>String(s??'').replace(/([\\()])/g,'\\$1');
 const lines=[c.title||'Certificate of Participation',`This certifies that ${c.user.name||'Attendee'}`,`has participated in ${c.expo?.title||'EventSphere Event'}`,c.session?.title?`Session: ${c.session.title}`:'',`Certificate No: ${c.certificateNo}`,`Issued: ${new Date(c.issuedAt).toLocaleDateString()}`].filter(Boolean);
 const stream='BT /F1 22 Tf 70 700 Td ('+esc(lines[0])+') Tj 0 -55 Td /F1 16 Tf '+lines.slice(1).map((l,i)=>`(${esc(l)}) Tj${i<lines.length-2?' 0 -35 Td ':''}`).join('')+' ET';
 const objs=[`1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj`, `2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj`, `3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>endobj`, `4 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj`, `5 0 obj<< /Length ${Buffer.byteLength(stream)} >>stream\n${stream}\nendstream endobj`];
 let pdf='%PDF-1.4\n';const offsets=[0];for(const o of objs){offsets.push(Buffer.byteLength(pdf));pdf+=o+'\n';}const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`;for(let i=1;i<offsets.length;i++)pdf+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';pdf+=`trailer<< /Size ${objs.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',`attachment; filename="${c.certificateNo}.pdf"`);res.send(Buffer.from(pdf));
};
