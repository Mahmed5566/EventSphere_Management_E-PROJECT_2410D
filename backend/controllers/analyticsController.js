import Expo from "../models/Expo.js";
import User from "../models/User.js";
import Booth from "../models/Booth.js";
import ExpoRegistration from "../models/ExpoRegistration.js";
import Session from "../models/Session.js";
import TicketOrder from "../models/TicketOrder.js";
import ExhibitorApplication from "../models/ExhibitorApplication.js";

export const getAnalytics = async (req, res) => {
  const [users, expos, booths, registrations, sessions, paidOrders, pendingApplications] = await Promise.all([
    User.countDocuments(),
    Expo.countDocuments(),
    Booth.countDocuments(),
    ExpoRegistration.countDocuments(),
    Session.countDocuments(),
    TicketOrder.find({status:"paid"}).select("total quantity"),
    ExhibitorApplication.countDocuments({status:"pending"})
  ]);
  const boothTraffic = await Booth.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]);
  const registrationsByType = await ExpoRegistration.aggregate([{ $group: { _id: "$type", count: { $sum: 1 } } }]);
  const revenue=paidOrders.reduce((sum,o)=>sum+Number(o.total||0),0);
  const ticketsSold=paidOrders.reduce((sum,o)=>sum+Number(o.quantity||0),0);
  res.json({ success: true, analytics: { users, expos, booths, registrations, sessions, pendingApplications, revenue, ticketsSold, boothTraffic, registrationsByType } });
};
