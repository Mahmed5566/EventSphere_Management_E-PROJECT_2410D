import crypto from 'crypto';import TicketOrder from '../models/TicketOrder.js';import TicketSetting from '../models/TicketSetting.js';import Expo from '../models/Expo.js';import Notification from '../models/Notification.js';import User from '../models/User.js';import CheckIn from '../models/CheckIn.js';
import { sendEmail } from '../utils/mailer.js';
import { claimTicketStock, releaseTicketStock, ticketStockLeft } from '../utils/inventory.js';
const invoice=()=>`ES-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
export const createOrder=async(req,res,next)=>{try{
 const {expo,passType,quantity=1}=req.body;
 if(!expo||!passType)return res.status(400).json({success:false,message:'Event and pass type are required.'});
 const e=await Expo.findById(expo);
 if(!e)return res.status(404).json({success:false,message:'Event not found.'});
 if(e.status==='cancelled')return res.status(409).json({success:false,message:'This event has been cancelled.'});
 const s=await TicketSetting.findOne({expo});
 if(!s)return res.status(400).json({success:false,message:'Organizer has not configured tickets for this event yet.'});
 const pass=s.passes.find(p=>p.name===passType&&p.enabled);
 if(!pass)return res.status(400).json({success:false,message:'This pass is not available.'});
 const qty=Math.max(1,Math.min(10,Number(quantity)));
 // Price is always read from the database, never trusted from the client.
 const unitPrice=Number(pass.price||0);
 // Atomic, race-safe stock claim: only one of two simultaneous buyers of the
 // last ticket can succeed. See utils/inventory.js.
 const claimed=await claimTicketStock(expo,passType,qty);
 if(!claimed){
   const {left}=await ticketStockLeft(expo,passType);
   return res.status(409).json({success:false,message:left===Infinity?`${passType} is not available.`:`${passType} is sold out or has only ${left} left.`});
 }
 let order;
 try{
   const orderTotal=unitPrice*qty;
   order=await TicketOrder.create({expo,attendee:req.user._id,passType,unitPrice,quantity:qty,total:orderTotal,status:'paid',paymentProvider:'manual_demo',qrToken:crypto.randomBytes(20).toString('hex'),invoiceNo:invoice()});
 }catch(createError){
   // Never leave claimed stock behind if order persistence fails.
   await releaseTicketStock(expo,passType,qty);
   throw createError;
 }
 const buyer=await User.findById(req.user._id).select('name email');
 await order.populate('expo','title date location processingReady');
 const total=order.total;
 const n=await Notification.create({user:req.user._id,title:'Ticket purchased',message:`${passType} confirmed for ${e.title}. Invoice ${order.invoiceNo}.`,type:'ticket',data:{orderId:order._id}});
 req.app.get('io').to(`user:${req.user._id}`).emit('ticket:paid',order);
 req.app.get('io').to(`user:${req.user._id}`).emit('notification:new',n);
 await sendEmail({to:buyer?.email,subject:`Ticket confirmed — ${e.title}`,html:`<h2>EventSphere Ticket Confirmed</h2><p>Hello ${buyer?.name||'Attendee'}, your <b>${passType}</b> ticket for <b>${e.title}</b> is confirmed.</p><p>Invoice: <b>${order.invoiceNo}</b><br>Entry code: <b>${order.qrToken}</b><br>Total: <b>PKR ${total.toLocaleString()}</b></p>`});
 if(e.createdBy){const on=await Notification.create({user:e.createdBy,title:'New ticket sale',message:`${qty} × ${passType} sold for ${e.title}.`,type:'sale',data:{expo:e._id,orderId:order._id}});req.app.get('io').to(`user:${e.createdBy}`).emit('notification:new',on)}
 const after=await ticketStockLeft(expo,passType);
 req.app.get('io').to(`expo:${expo}`).emit('ticket:sold',{expo,passType,quantity:qty,sold:after.capacity>0?after.capacity-after.left:undefined});
 res.status(201).json({success:true,order,message:'Ticket purchased successfully.'})
}catch(e){next(e)}};
export const mine=async(req,res,next)=>{try{const tickets=await TicketOrder.find({attendee:req.user._id}).populate('expo','title date location processingReady').sort({createdAt:-1});res.json({success:true,tickets})}catch(e){next(e)}};
export const all=async(req,res,next)=>{try{
 // Organizers only see orders for events they own; admins see everything.
 let filter={};
 if(req.user.role==='organizer'){
   const owned=await Expo.find({createdBy:req.user._id}).select('_id');
   filter={expo:{$in:owned.map(e=>e._id)}};
 }
 const tickets=await TicketOrder.find(filter).populate('expo','title').populate('attendee','name email').sort({createdAt:-1});
 res.json({success:true,tickets})
}catch(e){next(e)}};
export const cancel=async(req,res,next)=>{try{const o=await TicketOrder.findById(req.params.id);if(!o)return res.status(404).json({success:false,message:'Order not found'});if(req.user.role==='attendee'&&String(o.attendee)!==String(req.user._id))return res.status(403).json({success:false,message:'Access denied'});if(o.status==='paid'){await releaseTicketStock(o.expo,o.passType,o.quantity)}o.status='cancelled';await o.save();res.json({success:true,order:o})}catch(e){next(e)}};


export const requestCancellation=async(req,res,next)=>{try{const o=await TicketOrder.findById(req.params.id).populate('expo','title processingReady createdBy');if(!o)return res.status(404).json({success:false,message:'Order not found.'});if(String(o.attendee)!==String(req.user._id))return res.status(403).json({success:false,message:'Access denied.'});if(o.status!=='paid')return res.status(400).json({success:false,message:'Only paid tickets can be cancelled.'});if(o.expo.processingReady)return res.status(409).json({success:false,message:'This event is ready to process. Submit a cancellation request instead.'});const reason=String(req.body.reason||'').trim();o.status='cancelled';o.cancelRequested=false;o.cancelReason=reason;o.cancelRequestedAt=new Date();await releaseTicketStock(o.expo._id,o.passType,o.quantity);await o.save();res.json({success:true,order:o,message:'Ticket cancelled successfully.'});}catch(e){next(e)}};
export const submitCancelRequest=async(req,res,next)=>{try{const o=await TicketOrder.findById(req.params.id).populate('expo','title createdBy processingReady');if(!o)return res.status(404).json({success:false,message:'Order not found.'});if(String(o.attendee)!==String(req.user._id))return res.status(403).json({success:false,message:'Access denied.'});if(o.status!=='paid')return res.status(400).json({success:false,message:'Only paid tickets can request cancellation.'});o.cancelRequested=true;o.cancelReason=String(req.body.reason||'Cancellation requested').trim();o.cancelRequestedAt=new Date();await o.save();const n=await Notification.create({user:o.expo.createdBy,title:'Ticket cancellation request',message:`An attendee requested cancellation for ${o.expo.title}.`,type:'ticket',data:{orderId:o._id}});req.app.get('io').to(`user:${o.expo.createdBy}`).emit('notification:new',n);res.json({success:true,order:o,message:'Cancellation request sent to the organizer.'});}catch(e){next(e)}};
export const verifyTicket=async(req,res,next)=>{try{const o=await TicketOrder.findOne({qrToken:req.params.token}).populate('expo','title date location processingReady');if(!o)return res.status(404).json({success:false,message:'Ticket not found.'});res.json({success:true,ticket:o,valid:o.status==='paid'&&!o.checkedInAt});}catch(e){next(e)}};
export const checkInTicket=async(req,res,next)=>{try{const o=await TicketOrder.findOne({qrToken:req.params.token}).populate('expo','title createdBy').populate('attendee','name email');if(!o)return res.status(404).json({success:false,message:'Ticket not found.'});if(!['admin','organizer','staff'].includes(req.user.role))return res.status(403).json({success:false,message:'Check-in access denied.'});if(req.user.role==='organizer'&&String(o.expo.createdBy)!==String(req.user._id))return res.status(403).json({success:false,message:'You can only check in tickets for your events.'});if(o.status!=='paid')return res.status(400).json({success:false,message:'Ticket is not valid.'});if(o.checkedInAt)return res.status(409).json({success:false,message:'Ticket has already been checked in.',ticket:o});const existing=await CheckIn.findOne({ticket:o._id});if(existing){o.checkedInAt=existing.checkedInAt||new Date();await o.save();return res.status(409).json({success:false,message:'Ticket has already been checked in.',ticket:o,checkin:existing});}o.checkedInAt=new Date();await o.save();const checkin=await CheckIn.create({ticket:o._id,expo:o.expo._id,attendee:o.attendee._id,checkedInBy:req.user._id});try{const Engagement=(await import('../models/EventEngagement.js')).default;await Engagement.create({expo:o.expo._id,user:o.attendee._id,type:'checkin',targetId:o._id});}catch{}req.app.get('io')?.to(`expo:${o.expo._id}`).emit('attendance:checkin',{ticket:o._id,user:o.attendee,checkin});res.json({success:true,ticket:o,checkin,message:'Attendee checked in successfully.'});}catch(e){next(e)}};