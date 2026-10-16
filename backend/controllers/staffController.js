import Staff from '../models/Staff.js';
export const listStaff=async(req,res,next)=>{try{res.json({success:true,staff:await Staff.find({createdBy:req.user._id}).populate('event','title').sort({createdAt:-1})})}catch(e){next(e)}};
export const createStaff=async(req,res,next)=>{try{res.status(201).json({success:true,staff:await Staff.create({...req.body,createdBy:req.user._id})})}catch(e){next(e)}};
export const updateStaff=async(req,res,next)=>{try{const s=await Staff.findOneAndUpdate({_id:req.params.id,createdBy:req.user._id},req.body,{new:true,runValidators:true});if(!s)return res.status(404).json({success:false,message:'Staff member not found'});res.json({success:true,staff:s})}catch(e){next(e)}};
export const deleteStaff=async(req,res,next)=>{try{const s=await Staff.findOneAndDelete({_id:req.params.id,createdBy:req.user._id});if(!s)return res.status(404).json({success:false,message:'Staff member not found'});res.json({success:true})}catch(e){next(e)}};
