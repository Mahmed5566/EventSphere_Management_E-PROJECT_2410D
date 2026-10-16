import mongoose from 'mongoose';
const schema=new mongoose.Schema({
  expo:{type:mongoose.Schema.Types.ObjectId,ref:'Expo',required:true},
  user:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},
  exhibitor:{type:mongoose.Schema.Types.ObjectId,ref:'Exhibitor'},
  companyName:{type:String,required:true},
  status:{type:String,enum:['pending','paid','approved','rejected'],default:'pending'},
  paymentRequired:{type:Boolean,default:false},
  paymentStatus:{type:String,enum:['not_required','pending','paid'],default:'not_required'},
  amount:{type:Number,default:0,min:0},
  passType:{type:String,default:''},
  invoiceNo:{type:String,default:''},
  voucherNo:{type:String,required:true,unique:true},
  appliedAt:{type:Date,default:Date.now}
},{timestamps:true});
schema.index({expo:1,user:1},{unique:true});
export default mongoose.model('ExhibitorApplication',schema);
