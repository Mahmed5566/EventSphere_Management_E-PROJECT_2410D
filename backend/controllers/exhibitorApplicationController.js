import crypto from 'crypto';
import Expo from '../models/Expo.js';
import Exhibitor from '../models/Exhibitor.js';
import TicketSetting from '../models/TicketSetting.js';
import ExhibitorApplication from '../models/ExhibitorApplication.js';
import Notification from '../models/Notification.js';
import { sendEmail } from '../utils/mailer.js';
const voucher=()=>`ES-EX-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
const invoice=()=>`ES-EXINV-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
export const apply=async(req,res,next)=>{try{
 const expo=await Expo.findById(req.params.expoId); if(!expo)return res.status(404).json({success:false,message:'Event not found.'});
 if(req.user.role!=='exhibitor')return res.status(403).json({success:false,message:'Only exhibitor accounts can apply.'});
 let ex=await Exhibitor.findOne({user:req.user._id});
 if(!ex){
  const companyName=String(req.user.company||req.user.name||'Exhibitor Company').trim();
  ex=await Exhibitor.create({user:req.user._id,companyName,description:'',products:[],services:[],documents:[],phone:req.user.phone||'',approved:false});
 }
 const existing=await ExhibitorApplication.findOne({expo:expo._id,user:req.user._id}); if(existing)return res.status(409).json({success:false,message:'You already applied for this event.',application:existing});
 const paymentRequired=false;
 const amount=0;
 const app=await ExhibitorApplication.create({expo:expo._id,user:req.user._id,exhibitor:ex._id,companyName:ex.companyName,status:'pending',paymentRequired:false,paymentStatus:'not_required',amount:0,passType:'',invoiceNo:'',voucherNo:voucher()});
 const n=await Notification.create({user:req.user._id,title:'Exhibitor application submitted',message:`Application for ${expo.title} submitted and is waiting for organizer review. Voucher ${app.voucherNo}.`,type:'exhibitor',data:{applicationId:app._id}});
 req.app.get('io').to(`user:${req.user._id}`).emit('notification:new',n);
 if(expo.createdBy){const on=await Notification.create({user:expo.createdBy,title:'New exhibitor application',message:`${ex.companyName} applied for ${expo.title} and is waiting for review.`,type:'exhibitor',data:{applicationId:app._id}});req.app.get('io').to(`user:${expo.createdBy}`).emit('notification:new',on)}
 res.status(201).json({success:true,application:app,message:paymentRequired?'Application payment recorded successfully.':'Application submitted. Your downloadable voucher is your proof.'});
}catch(e){next(e)}};
export const mine=async(req,res,next)=>{try{const applications=await ExhibitorApplication.find({user:req.user._id}).populate('expo','title date location').sort({createdAt:-1});res.json({success:true,applications})}catch(e){next(e)}};
export const all=async(req,res,next)=>{try{
 let filter={};
 if(req.user.role==='organizer'){const own=await Expo.find({createdBy:req.user._id}).select('_id');filter={expo:{$in:own.map(x=>x._id)}};}
 const applications=await ExhibitorApplication.find(filter).populate('expo','title date location createdBy').populate('user','name email phone').populate('exhibitor','companyName description website phone approved').sort({createdAt:-1});
 res.json({success:true,applications});
}catch(e){next(e)}};

export const review=async(req,res,next)=>{try{
 const {status}=req.body;
 if(!['approved','rejected','pending'].includes(status))return res.status(400).json({success:false,message:'Invalid application status.'});
 const app=await ExhibitorApplication.findById(req.params.id).populate('expo','title createdBy').populate('user','name email');
 if(!app)return res.status(404).json({success:false,message:'Application not found.'});
 if(req.user.role==='organizer' && String(app.expo.createdBy)!==String(req.user._id))return res.status(403).json({success:false,message:'You can only review applications for your own events.'});
 app.status=status; await app.save();
 await sendEmail({to:app.user.email,subject:`Exhibitor application ${status} — ${app.expo.title}`,html:`<h2>EventSphere Exhibitor Update</h2><p>Your application for <b>${app.expo.title}</b> is now <b>${status}</b>.</p><p>Voucher: <b>${app.voucherNo}</b></p>`});
 const n=await Notification.create({user:app.user._id,title:`Exhibitor application ${status}`,message:`Your exhibitor application for ${app.expo.title} was ${status}.`,type:'exhibitor',data:{applicationId:app._id}});
 req.app.get('io').to(`user:${app.user._id}`).emit('notification:new',n);
 res.json({success:true,application:app,message:`Application ${status}.`});
}catch(e){next(e)}};
