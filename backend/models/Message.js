import mongoose from 'mongoose';
const schema=new mongoose.Schema({sender:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},recipient:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},text:{type:String,required:true,trim:true,maxlength:2000},read:{type:Boolean,default:false}},{timestamps:true});
schema.index({sender:1,recipient:1,createdAt:1});
export default mongoose.model('Message',schema);
