import mongoose from 'mongoose';
const schema=new mongoose.Schema({expo:{type:mongoose.Schema.Types.ObjectId,ref:'Expo',required:true},subject:{type:String,required:true},message:{type:String,required:true},audience:{type:String,enum:['all','attendees','vip','exhibitors','speakers','staff'],default:'all'},sentCount:{type:Number,default:0},status:{type:String,enum:['draft','sent'],default:'draft'},sentAt:Date,createdBy:{type:mongoose.Schema.Types.ObjectId,ref:'User'}},{timestamps:true});
export default mongoose.model('Campaign',schema);
