import mongoose from 'mongoose';
const speakerSchema=new mongoose.Schema({expo:{type:mongoose.Schema.Types.ObjectId,ref:'Expo',required:true},name:{type:String,required:true},title:String,company:String,email:String,phone:String,bio:String,photo:String,social:String,session:{type:mongoose.Schema.Types.ObjectId,ref:'Session',default:null}},{timestamps:true});
export default mongoose.model('Speaker',speakerSchema);
