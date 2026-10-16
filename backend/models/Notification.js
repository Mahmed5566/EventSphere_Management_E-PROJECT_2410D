import mongoose from 'mongoose';
const schema=new mongoose.Schema({user:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},title:{type:String,required:true},message:{type:String,required:true},type:{type:String,default:'system'},read:{type:Boolean,default:false},readAt:{type:Date,default:null},link:{type:String,default:''},data:{type:Object,default:{}},dedupeKey:{type:String,default:undefined}},{timestamps:true});
schema.index({user:1,read:1,createdAt:-1});
schema.index({user:1,dedupeKey:1},{unique:true,partialFilterExpression:{dedupeKey:{$type:'string'}}});
export default mongoose.model('Notification',schema);
