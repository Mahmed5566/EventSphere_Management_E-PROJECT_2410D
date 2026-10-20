import Venue from '../models/Venue.js';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { recordActivity } from '../utils/activity.js';
const label = (v) => v?.name || v?.title || String(v?._id || '');

// The public event site links to venue names, so anonymous visitors may read a
// venue listing. Authenticated callers are scoped: organizers see the venues
// they own (venues they may edit), everyone else sees a read-only list without
// owner contact details.
async function viewerFrom(req){
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  try{
    const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    return await User.findById(decoded.id).select('_id role');
  }catch{ return null; }
}

export const listVenues=async(req,res,next)=>{try{
  const viewer = await viewerFrom(req);
  const manager = viewer && (viewer.role === 'admin' || viewer.role === 'organizer');
  const filter = manager && viewer.role !== 'admin' ? { owner: viewer._id } : {};
  const query = Venue.find(filter).sort({ createdAt: -1 });
  // Only managers need owner identity (to know whose venue it is); the public
  // listing must not expose other users' names or email addresses.
  if (manager) query.populate('owner','name');
  const venues = await query;
  res.json({ success: true, count: venues.length, venues });
}catch(e){next(e)}};

const VENUE_TYPES = ['hall','banquet','convention_center','outdoor','hotel','other'];
const VENUE_PLANS = ['trial','starter','growth','pro'];

// Normalise a venue payload and turn model validation failures into clear 400s
// (previously an invalid `type` surfaced as an unhandled 500).
function venuePayload(body){
  const out = {};
  if (body.name !== undefined) out.name = String(body.name).trim();
  if (body.type !== undefined) out.type = String(body.type).trim();
  if (body.city !== undefined) out.city = String(body.city).trim();
  if (body.address !== undefined) out.address = String(body.address).trim();
  if (body.description !== undefined) out.description = String(body.description).trim();
  if (body.capacity !== undefined) out.capacity = Math.max(0, Number(body.capacity) || 0);
  if (body.membershipPlan !== undefined && VENUE_PLANS.includes(body.membershipPlan)) out.membershipPlan = body.membershipPlan;
  if (body.map !== undefined) out.map = body.map;
  // Optional association: which event this venue is reserved for.
  if (body.event !== undefined) out.event = body.event || null;
  return out;
}

export const createVenue=async(req,res,next)=>{try{
  const payload = venuePayload(req.body || {});
  if (!payload.name) return res.status(400).json({ success: false, message: 'A venue name is required.' });
  if (payload.type !== undefined && !VENUE_TYPES.includes(payload.type)) {
    return res.status(400).json({ success: false, message: `Venue type must be one of: ${VENUE_TYPES.join(', ')}.` });
  }
  const v=await Venue.create({...payload,owner:req.user._id,trialEndsAt:new Date(Date.now()+7*86400000)});
  await recordActivity({actor:req.user._id,actorName:req.user.name,action:'created',entityType:'Venue',entityId:v._id,summary:`Created venue "${label(v)}"`,meta:{}});
  res.status(201).json({success:true,venue:v})
}catch(e){
  if(e.name==='ValidationError')return res.status(400).json({success:false,message:Object.values(e.errors).map(x=>x.message).join(' ')});
  next(e)
}};

export const updateVenue=async(req,res,next)=>{try{
  const payload = venuePayload(req.body || {});
  if (payload.name !== undefined && !payload.name) return res.status(400).json({ success: false, message: 'A venue name is required.' });
  if (payload.type !== undefined && !VENUE_TYPES.includes(payload.type)) {
    return res.status(400).json({ success: false, message: `Venue type must be one of: ${VENUE_TYPES.join(', ')}.` });
  }
  const v=await Venue.findOneAndUpdate({_id:req.params.id,owner:req.user._id},payload,{new:true,runValidators:true});
  if(!v)return res.status(404).json({success:false,message:'Venue not found'});
  await recordActivity({actor:req.user._id,actorName:req.user.name,action:'updated',entityType:'Venue',entityId:v._id,summary:`Updated venue "${label(v)}"`,meta:{fields:Object.keys(payload)}});
  res.json({success:true,venue:v})
}catch(e){
  if(e.name==='ValidationError')return res.status(400).json({success:false,message:Object.values(e.errors).map(x=>x.message).join(' ')});
  next(e)
}};

export const deleteVenue=async(req,res,next)=>{try{const v=await Venue.findOneAndDelete({_id:req.params.id,owner:req.user._id});if(!v)return res.status(404).json({success:false,message:'Venue not found'});await recordActivity({actor:req.user._id,actorName:req.user.name,action:'deleted',entityType:'Venue',entityId:req.params.id,summary:`Deleted venue "${label(v)}"`,meta:{}});res.json({success:true})}catch(e){next(e)}};
