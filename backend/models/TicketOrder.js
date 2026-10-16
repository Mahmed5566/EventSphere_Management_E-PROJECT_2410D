import mongoose from 'mongoose';
const schema=new mongoose.Schema({expo:{type:mongoose.Schema.Types.ObjectId,ref:'Expo',required:true},attendee:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},passType:{type:String,enum:['VIP Pass','Pro Pass','Business Pass','Classic Pass'],required:true},unitPrice:{type:Number,required:true,min:0},quantity:{type:Number,default:1,min:1,max:10},total:{type:Number,required:true},status:{type:String,enum:['pending','paid','cancelled','refunded'],default:'pending'},paymentProvider:{type:String,default:'stripe'},paymentSessionId:{type:String,default:''},qrToken:{type:String,unique:true,sparse:true},invoiceNo:{type:String,unique:true,sparse:true},cancelRequested:{type:Boolean,default:false},cancelReason:{type:String,default:''},cancelRequestedAt:{type:Date},checkedInAt:{type:Date}},{timestamps:true});

// Record an activity-feed entry when a ticket is first issued. Uses $locals so
// later updates (e.g. check-in) do not produce duplicate feed entries.
schema.pre('save', function(next){ this.$locals.wasNew = this.isNew; next(); });
schema.post('save', function(doc){
  if(!doc.$locals?.wasNew) return;
  import('../utils/activity.js')
    .then(({ recordActivity }) => recordActivity({
      actor: doc.attendee,
      action: 'issued',
      entityType: 'Ticket',
      entityId: doc._id,
      expo: doc.expo,
      summary: `Ticket issued (${doc.passType})${doc.invoiceNo ? ` — invoice ${doc.invoiceNo}` : ''}`,
      meta: { passType: doc.passType, quantity: doc.quantity, total: doc.total, status: doc.status },
    }))
    .catch(() => {});
});

export default mongoose.model('TicketOrder',schema);
