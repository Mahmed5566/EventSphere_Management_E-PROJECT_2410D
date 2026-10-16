import mongoose from 'mongoose';
const sponsorSchema=new mongoose.Schema({expo:{type:mongoose.Schema.Types.ObjectId,ref:'Expo',required:true},name:{type:String,required:true},tier:{type:String,enum:['Bronze','Silver','Gold','Platinum'],default:'Bronze'},contactName:String,email:String,phone:String,amount:{type:Number,default:0},status:{type:String,enum:['pending','approved','rejected','paid'],default:'pending'},logo:String,notes:String},{timestamps:true});
export default mongoose.model('Sponsor',sponsorSchema);
