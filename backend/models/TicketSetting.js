import mongoose from 'mongoose';
const passSchema=new mongoose.Schema({name:{type:String,enum:['VIP Pass','Pro Pass','Business Pass','Classic Pass'],required:true},price:{type:Number,min:0,default:0},capacity:{type:Number,min:0,default:0},sold:{type:Number,min:0,default:0},enabled:{type:Boolean,default:true}},{_id:false});
const schema=new mongoose.Schema({expo:{type:mongoose.Schema.Types.ObjectId,ref:'Expo',required:true,unique:true},passes:{type:[passSchema],default:()=>['VIP Pass','Pro Pass','Business Pass','Classic Pass'].map(name=>({name,price:0,capacity:0,sold:0,enabled:true}))},createdBy:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true}},{timestamps:true});
export default mongoose.model('TicketSetting',schema);
