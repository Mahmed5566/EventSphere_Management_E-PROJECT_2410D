import mongoose from 'mongoose';
const schema=new mongoose.Schema({user:{type:mongoose.Schema.Types.ObjectId,ref:'User',unique:true,required:true},plan:{type:String,enum:['trial','starter','growth','pro'],default:'trial'},status:{type:String,enum:['trialing','active','past_due','cancelled','expired'],default:'trialing'},trialEndsAt:{type:Date},stripeCustomerId:{type:String,default:''},stripeSubscriptionId:{type:String,default:''},messageLimit:{type:Number,default:50},priority:{type:Number,default:1}},{timestamps:true});
export default mongoose.model('Membership',schema);
