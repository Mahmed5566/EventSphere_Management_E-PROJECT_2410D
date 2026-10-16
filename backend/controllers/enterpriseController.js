import Expo from '../models/Expo.js';
import User from '../models/User.js';
import Booth from '../models/Booth.js';
import TicketOrder from '../models/TicketOrder.js';
import TicketSetting from '../models/TicketSetting.js';
import Session from '../models/Session.js';
import Sponsor from '../models/Sponsor.js';
import Speaker from '../models/Speaker.js';
import Exhibitor from '../models/Exhibitor.js';
import ExhibitorApplication from '../models/ExhibitorApplication.js';
import ExpoRegistration from '../models/ExpoRegistration.js';
import FinanceTransaction from '../models/FinanceTransaction.js';
import Notification from '../models/Notification.js';
import AuditLog from '../models/AuditLog.js';
import Lead from '../models/Lead.js';
import EmailTemplate from '../models/EmailTemplate.js';
import Stripe from 'stripe';

const organizerRoles=['admin','organizer'];
const canManage=req=>organizerRoles.includes(req.user.role);
const escapeRegex=value=>String(value||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const scopedExpo=async(req,id)=>{
  const expo=await Expo.findById(id);
  if(!expo)return null;
  if(req.user.role==='organizer' && String(expo.createdBy)!==String(req.user._id))return undefined;
  return expo;
};

export const search=async(req,res,next)=>{try{
  const q=String(req.query.q||'').trim(); if(!q)return res.json({success:true,results:[]});
  const rx=new RegExp(escapeRegex(q),'i');
  const [events,users,booths,tickets,exhibitors]=await Promise.all([
    Expo.find({$or:[{title:rx},{location:rx},{theme:rx}]}).limit(8).select('title location date status'),
    User.find({$or:[{name:rx},{email:rx},{company:rx}]}).limit(8).select('name email role company'),
    Booth.find({$or:[{boothNumber:rx},{category:rx}]}).limit(8).populate('expo','title').select('boothNumber category status expo'),
    TicketOrder.find({$or:[{invoiceNo:rx},{qrToken:rx}]}).limit(8).populate('expo','title').populate('attendee','name email').select('invoiceNo passType status total expo attendee'),
    Exhibitor.find({$or:[{companyName:rx},{website:rx}]}).limit(8).populate('user','name email').select('companyName approved website user')
  ]);
  const results=[...events.map(x=>({type:'event',id:x._id,title:x.title,meta:`${x.location||'Location pending'} · ${x.status}`})),...users.map(x=>({type:'user',id:x._id,title:x.name,meta:`${x.role} · ${x.email}`})),...booths.map(x=>({type:'booth',id:x._id,title:`Booth ${x.boothNumber}`,meta:`${x.expo?.title||'Event'} · ${x.status}`})),...tickets.map(x=>({type:'ticket',id:x._id,title:x.invoiceNo||x.passType,meta:`${x.attendee?.name||'Attendee'} · PKR ${Number(x.total||0).toLocaleString()}`})),...exhibitors.map(x=>({type:'exhibitor',id:x._id,title:x.companyName,meta:x.user?.email||x.website||'Exhibitor'}))];
  res.json({success:true,results});
}catch(e){next(e)}};

export const eventDetail=async(req,res,next)=>{try{
  const expo=await scopedExpo(req,req.params.id); if(expo===undefined)return res.status(403).json({message:'You can only view your own event data.'}); if(!expo)return res.status(404).json({message:'Event not found.'});
  const [sessions,speakers,sponsors,booths,registrations,tickets,applications]=await Promise.all([
    Session.find({expo:expo._id}).sort('startTime'), Speaker.find({expo:expo._id}).populate('session','title'), Sponsor.find({expo:expo._id}).sort('-amount'),
    Booth.find({expo:expo._id}).populate('exhibitor','name company'), ExpoRegistration.find({expo:expo._id}).populate('user','name email role'),
    TicketOrder.find({expo:expo._id,status:{$in:['paid','pending','refunded','cancelled']}}).populate('attendee','name email').sort('-createdAt').limit(200),
    ExhibitorApplication.find({expo:expo._id}).populate('user','name email').sort('-createdAt')
  ]);
  const revenue=tickets.filter(x=>x.status==='paid').reduce((s,x)=>s+Number(x.total||0),0);
  res.json({success:true,event:expo,sessions,speakers,sponsors,booths,registrations,tickets,applications,summary:{revenue,ticketsSold:tickets.filter(x=>x.status==='paid').reduce((s,x)=>s+Number(x.quantity||0),0),attendance:tickets.filter(x=>x.checkedInAt).reduce((s,x)=>s+Number(x.quantity||0),0),registrations:registrations.length,booths:booths.length}});
}catch(e){next(e)}};

export const reports=async(req,res,next)=>{try{
  if(!canManage(req))return res.status(403).json({message:'Organizer access required'});
  const expo=req.query.expo?await scopedExpo(req,req.query.expo):null;
  if(req.query.expo&&expo===undefined)return res.status(403).json({message:'Access denied'});
  const eventQuery=expo?{expo:expo._id}:{};
  const [orders,registrations,finance,booths,applications]=await Promise.all([
    TicketOrder.find(eventQuery).populate('expo','title').populate('attendee','name email'), ExpoRegistration.find(eventQuery).populate('user','name email'),
    FinanceTransaction.find(eventQuery), Booth.find(eventQuery), ExhibitorApplication.find(eventQuery)
  ]);
  const paid=orders.filter(x=>x.status==='paid'); const income=finance.filter(x=>x.type==='income').reduce((s,x)=>s+Number(x.amount||0),0); const expense=finance.filter(x=>x.type==='expense').reduce((s,x)=>s+Number(x.amount||0),0); const ticketRevenue=paid.reduce((s,x)=>s+Number(x.total||0),0);
  res.json({success:true,generatedAt:new Date().toISOString(),filters:{expo:expo?{id:expo._id,title:expo.title}:null},summary:{ticketRevenue,financeIncome:income,financeExpense:expense,netProfit:ticketRevenue+income-expense,ticketsSold:paid.reduce((s,x)=>s+Number(x.quantity||0),0),checkedIn:paid.filter(x=>x.checkedInAt).reduce((s,x)=>s+Number(x.quantity||0),0),registrations:registrations.length,booths:booths.length,applications:applications.length},orders,registrations,finance,booths,applications});
}catch(e){next(e)}};

export const registrationStatus=async(req,res,next)=>{try{
 const row=await ExpoRegistration.findById(req.params.id).populate('expo','title createdBy').populate('user','name email');
 if(!row)return res.status(404).json({message:'Registration not found'});
 if(req.user.role==='organizer'&&String(row.expo.createdBy)!==String(req.user._id))return res.status(403).json({message:'Access denied'});
 row.status=req.body.status;await row.save();
 const n=await Notification.create({user:row.user._id,title:'Registration updated',message:`Your registration for ${row.expo.title} is now ${row.status}.`,type:'registration',data:{expoId:row.expo._id,registrationId:row._id}});req.app.get('io')?.to(`user:${row.user._id}`).emit('notification:new',n);
 res.json({success:true,registration:row});
}catch(e){next(e)}};

export const leads=async(req,res,next)=>{try{
  const q={}; if(req.query.expo)q.expo=req.query.expo; if(req.user.role==='exhibitor')q.exhibitor=req.user._id;
  if(req.user.role==='organizer'&&req.query.expo){const expo=await scopedExpo(req,req.query.expo);if(expo===undefined)return res.status(403).json({message:'Access denied'});}
  const rows=await Lead.find(q).populate('expo','title').populate('exhibitor','name company').populate('attendee','name email').sort('-createdAt').limit(500);res.json({success:true,leads:rows});
}catch(e){next(e)}};
export const leadCreate=async(req,res,next)=>{try{
  const {expo,name,email='',phone='',company='',notes='',followUpAt,status='new',attendee}=req.body;if(!expo||!name)return res.status(400).json({message:'Event and lead name are required'});
  if(req.user.role==='exhibitor' && attendee && String(attendee)===String(req.user._id))return res.status(400).json({message:'Lead attendee cannot be the exhibitor account.'});
  const event=await scopedExpo(req,expo); if(event===undefined)return res.status(403).json({message:'Access denied'}); if(!event)return res.status(404).json({message:'Event not found'});
  const owner=req.user.role==='exhibitor'?req.user._id:(req.body.exhibitor||req.user._id); const lead=await Lead.create({expo,name,email,phone,company,notes,followUpAt:followUpAt||null,status,attendee:attendee||null,exhibitor:owner});
  await AuditLog.create({actor:req.user._id,action:'created',entity:'Lead',entityId:String(lead._id),details:{expo,name}});res.status(201).json({success:true,lead});
}catch(e){next(e)}};
export const leadUpdate=async(req,res,next)=>{try{const lead=await Lead.findById(req.params.id);if(!lead)return res.status(404).json({message:'Lead not found'});if(req.user.role==='exhibitor'&&String(lead.exhibitor)!==String(req.user._id))return res.status(403).json({message:'Access denied'});Object.assign(lead,req.body);await lead.save();await AuditLog.create({actor:req.user._id,action:'updated',entity:'Lead',entityId:String(lead._id),details:{status:lead.status}});res.json({success:true,lead});}catch(e){next(e)}};

export const templates=async(req,res,next)=>{try{const rows=await EmailTemplate.find().sort('-updatedAt').limit(100);res.json({success:true,templates:rows});}catch(e){next(e)}};
export const templateCreate=async(req,res,next)=>{try{if(!canManage(req))return res.status(403).json({message:'Organizer access required'});const x=await EmailTemplate.create({...req.body,createdBy:req.user._id,updatedBy:req.user._id});res.status(201).json({success:true,template:x});}catch(e){next(e)}};
export const templateUpdate=async(req,res,next)=>{try{if(!canManage(req))return res.status(403).json({message:'Organizer access required'});const x=await EmailTemplate.findByIdAndUpdate(req.params.id,{...req.body,updatedBy:req.user._id},{new:true});if(!x)return res.status(404).json({message:'Template not found'});res.json({success:true,template:x});}catch(e){next(e)}};
export const templateDelete=async(req,res,next)=>{try{if(!canManage(req))return res.status(403).json({message:'Organizer access required'});await EmailTemplate.findByIdAndDelete(req.params.id);res.json({success:true});}catch(e){next(e)}};

export const calendar=async(req,res,next)=>{try{const q=req.query.expo?{expo:req.query.expo}:{};const rows=await Session.find(q).sort('startTime');const conflicts=[];for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){if(new Date(rows[j].startTime)<new Date(rows[i].endTime)&&new Date(rows[j].endTime)>new Date(rows[i].startTime))conflicts.push({first:rows[i],second:rows[j]});}res.json({success:true,sessions:rows,conflicts});}catch(e){next(e)}};

export const notifications=async(req,res,next)=>{try{const rows=await Notification.find({user:req.user._id}).sort('-createdAt').limit(100);res.json({success:true,notifications:rows,unread:rows.filter(x=>!x.read).length});}catch(e){next(e)}};
export const notificationCreate=async(req,res,next)=>{try{if(!canManage(req))return res.status(403).json({message:'Organizer access required'});const {user,title,message,type='system',data={}}=req.body;if(!user||!title||!message)return res.status(400).json({message:'User, title and message are required'});const n=await Notification.create({user,title,message,type,data});req.app.get('io')?.to(`user:${user}`).emit('notification:new',n);res.status(201).json({success:true,notification:n});}catch(e){next(e)}};

export const createCheckout=async(req,res,next)=>{try{
 if(req.user.role!=='attendee')return res.status(403).json({message:'Attendee checkout only.'});
 if(!process.env.STRIPE_SECRET_KEY)return res.status(503).json({message:'Stripe is not configured. Add STRIPE_SECRET_KEY to backend/.env to enable live checkout.'});
 const {expo,passType,quantity=1}=req.body;const event=await Expo.findById(expo);if(!event)return res.status(404).json({message:'Event not found'});const settings=await TicketSetting.findOne({expo});const pass=settings?.passes.find(x=>x.name===passType&&x.enabled);if(!pass)return res.status(400).json({message:'Ticket pass is not available'});const qty=Math.max(1,Math.min(10,Number(quantity)));if(pass.capacity>0&&pass.sold+qty>pass.capacity)return res.status(409).json({message:'Not enough ticket inventory'});
 const stripe=new Stripe(process.env.STRIPE_SECRET_KEY);const order=await TicketOrder.create({expo,attendee:req.user._id,passType,unitPrice:pass.price,quantity:qty,total:pass.price*qty,status:'pending',paymentProvider:'stripe'});const session=await stripe.checkout.sessions.create({mode:'payment',line_items:[{price_data:{currency:'pkr',product_data:{name:`${passType} — ${event.title}`},unit_amount:Math.round(Number(pass.price)*100)},quantity:qty}],metadata:{orderId:String(order._id),expoId:String(event._id)},success_url:`${process.env.STRIPE_SUCCESS_URL||'http://localhost:5173'}?payment=success&session_id={CHECKOUT_SESSION_ID}`,cancel_url:`${process.env.STRIPE_CANCEL_URL||'http://localhost:5173'}?payment=cancelled&order_id=${order._id}`});order.paymentSessionId=session.id;await order.save();res.status(201).json({success:true,checkoutUrl:session.url,sessionId:session.id,order});
}catch(e){next(e)}};
export const confirmCheckout=async(req,res,next)=>{try{
 if(!process.env.STRIPE_SECRET_KEY)return res.status(503).json({message:'Stripe is not configured'});const order=await TicketOrder.findOne({paymentSessionId:req.params.sessionId}).populate('expo','title date location').populate('attendee','name email');if(!order)return res.status(404).json({message:'Checkout order not found'});if(String(order.attendee._id||order.attendee)!==String(req.user._id)&&!canManage(req))return res.status(403).json({message:'Access denied'});const stripe=new Stripe(process.env.STRIPE_SECRET_KEY);const session=await stripe.checkout.sessions.retrieve(req.params.sessionId);if(session.payment_status==='paid'&&order.status!=='paid'){const settings=await TicketSetting.findOne({expo:order.expo._id||order.expo});const pass=settings?.passes.find(x=>x.name===order.passType);if(pass){pass.sold+=order.quantity;await settings.save();}order.status='paid';order.qrToken=order.qrToken||`${order._id}-${Date.now()}`;order.invoiceNo=order.invoiceNo||`ES-${Date.now()}-${Math.random().toString(16).slice(2,8).toUpperCase()}`;await order.save();}res.json({success:true,paid:session.payment_status==='paid',order});
}catch(e){next(e)}};

export const paymentStatus=async(req,res,next)=>{try{const order=await TicketOrder.findById(req.params.orderId).populate('expo','title');if(!order)return res.status(404).json({message:'Order not found'});if(req.user.role==='attendee'&&String(order.attendee)!==String(req.user._id))return res.status(403).json({message:'Access denied'});let stripeState='not_configured';if(process.env.STRIPE_SECRET_KEY&&order.paymentSessionId){try{const stripe=new Stripe(process.env.STRIPE_SECRET_KEY);const session=await stripe.checkout.sessions.retrieve(order.paymentSessionId);stripeState=session.payment_status; }catch{stripeState='unavailable';}}res.json({success:true,order,stripeState});}catch(e){next(e)}};
export const refund=async(req,res,next)=>{try{if(!canManage(req))return res.status(403).json({message:'Organizer access required'});const order=await TicketOrder.findById(req.params.orderId);if(!order)return res.status(404).json({message:'Order not found'});if(order.status!=='paid')return res.status(400).json({message:'Only paid orders can be refunded.'});if(process.env.STRIPE_SECRET_KEY&&order.paymentSessionId){try{const stripe=new Stripe(process.env.STRIPE_SECRET_KEY);const session=await stripe.checkout.sessions.retrieve(order.paymentSessionId);if(session.payment_intent)await stripe.refunds.create({payment_intent:session.payment_intent});}catch(e){return res.status(502).json({message:`Stripe refund failed: ${e.message}`});}}order.status='refunded';await order.save();await Notification.create({user:order.attendee,title:'Ticket refunded',message:`Your ${order.passType} ticket has been refunded.`,type:'payment',data:{orderId:order._id}});await AuditLog.create({actor:req.user._id,action:'refunded',entity:'TicketOrder',entityId:String(order._id)});res.json({success:true,order});}catch(e){next(e)}};
