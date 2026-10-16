import mongoose from 'mongoose';
const schema=new mongoose.Schema({expo:{type:mongoose.Schema.Types.ObjectId,ref:'Expo',required:true},user:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},session:{type:mongoose.Schema.Types.ObjectId,ref:'Session'},certificateNo:{type:String,unique:true},issuedAt:{type:Date,default:Date.now},title:{type:String,default:'Certificate of Participation'}},{timestamps:true});
export default mongoose.model('Certificate',schema);
