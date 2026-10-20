import TicketSetting from '../models/TicketSetting.js';
import Expo from '../models/Expo.js';
// An organizer must never see (or create settings for) another organizer's
// event. Admin keeps global visibility for support.
async function ownedExpoIds(user){
  if(user.role==='admin')return null; // null = no restriction
  const own=await Expo.find({createdBy:user._id}).select('_id');
  return own.map(e=>e._id);
}
export const list=async(req,res,next)=>{try{
  const ids=await ownedExpoIds(req.user);
  const filter=ids?{expo:{$in:ids}}:{};
  const rows=await TicketSetting.find(filter).populate('expo','title date').sort({createdAt:-1});
  res.json({success:true,settings:rows})
}catch(e){next(e)}};
export const getByExpo=async(req,res,next)=>{try{
  const expo=await Expo.findById(req.params.expoId).select('_id title date status createdBy');
  if(!expo)return res.status(404).json({success:false,message:'Event not found.'});
  const own=req.user.role==='admin'||String(expo.createdBy)===String(req.user._id);
  // Attendees, exhibitors and staff must be able to read the pass list for an
  // event they can buy into; that is what powers the purchase screen. Pricing for
  // an unpublished event stays private to its owner (and admin).
  const published=['published','completed'].includes(expo.status);
  if(!own && !published)return res.status(403).json({success:false,message:'Ticket settings for this event are not public.'});

  let s=await TicketSetting.findOne({expo:expo._id}).populate('expo','title date');
  // Only the event owner may trigger the lazy default-settings creation.
  if(!s && own && ['admin','organizer'].includes(req.user.role))s=await TicketSetting.create({expo:expo._id,createdBy:req.user._id});
  // Buyers only need the passes that are actually on sale; owners/admins see all.
  const passes=(s?.passes||[]).filter(p=>own||p.enabled!==false);
  res.json({success:true,setting:s||null,passes})
}catch(e){next(e)}};
export const create=async(req,res,next)=>{try{
  // The caller must own the event they are pricing (admin exempt).
  if(req.user.role!=='admin'){
    const own=await Expo.findOne({_id:req.body.expo,createdBy:req.user._id}).select('_id');
    if(!own)return res.status(403).json({success:false,message:'You can only configure tickets for your own events.'});
  }
  const exists=await TicketSetting.findOne({expo:req.body.expo});if(exists)return res.status(409).json({success:false,message:'Ticket settings already exist for this event.'});const s=await TicketSetting.create({...req.body,createdBy:req.user._id});res.status(201).json({success:true,setting:s})
}catch(e){next(e)}};
export const update=async(req,res,next)=>{try{const s=await TicketSetting.findOneAndUpdate({_id:req.params.id,createdBy:req.user._id},{passes:req.body.passes},{new:true,runValidators:true});if(!s)return res.status(404).json({success:false,message:'Ticket settings not found'});res.json({success:true,setting:s})}catch(e){next(e)}};
export const remove=async(req,res,next)=>{try{const s=await TicketSetting.findOneAndDelete({_id:req.params.id,createdBy:req.user._id});if(!s)return res.status(404).json({success:false,message:'Ticket settings not found'});res.json({success:true})}catch(e){next(e)}};
