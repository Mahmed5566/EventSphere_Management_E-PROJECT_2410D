import Feedback from "../models/Feedback.js";

export const createFeedback = async (req, res) => {
  const feedback = await Feedback.create({ ...req.body, user: req.user._id });
  try{const Engagement=(await import('../models/EventEngagement.js')).default;await Engagement.create({expo:feedback.expo,user:req.user._id,type:'feedback',targetId:feedback._id});}catch{}
  res.status(201).json({ success: true, feedback });
};

export const getMine=async(req,res,next)=>{try{const rows=await Feedback.find({user:req.user._id}).populate("expo","title").sort({createdAt:-1});res.json({success:true,feedback:rows})}catch(e){next(e)}};

export const getFeedback = async (req, res) => {
  const feedback = await Feedback.find().populate("user", "name email").populate("expo", "title").sort({ createdAt: -1 });
  res.json({ success: true, feedback });
};
