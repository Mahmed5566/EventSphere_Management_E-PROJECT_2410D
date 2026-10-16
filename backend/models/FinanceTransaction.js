import mongoose from 'mongoose';
const schema=new mongoose.Schema({expo:{type:mongoose.Schema.Types.ObjectId,ref:'Expo',required:true},type:{type:String,enum:['income','expense'],required:true},entryType:{type:String,enum:['planned','actual'],default:'actual'},currency:{type:String,default:'PKR',uppercase:true,trim:true,maxlength:6},category:String,description:String,amount:{type:Number,required:true,min:0},date:{type:Date,default:Date.now},reference:String,createdBy:{type:mongoose.Schema.Types.ObjectId,ref:'User'}},{timestamps:true});
schema.index({expo:1,createdAt:-1});
schema.index({expo:1,entryType:1,type:1});
export default mongoose.model('FinanceTransaction',schema);
