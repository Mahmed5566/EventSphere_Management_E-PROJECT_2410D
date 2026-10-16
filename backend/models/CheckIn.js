import mongoose from 'mongoose';
const schema=new mongoose.Schema({ticket:{type:mongoose.Schema.Types.ObjectId,ref:'TicketOrder',required:true,unique:true},expo:{type:mongoose.Schema.Types.ObjectId,ref:'Expo',required:true},attendee:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},checkedInAt:{type:Date,default:Date.now},checkedInBy:{type:mongoose.Schema.Types.ObjectId,ref:'User'},method:{type:String,default:'QR'}},{timestamps:true});
export default mongoose.model('CheckIn',schema);
