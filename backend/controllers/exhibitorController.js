import Exhibitor from "../models/Exhibitor.js";

export const getExhibitors = async (req, res) => {
  const q = req.query.q;
  const filter = q ? { $or: [
    { companyName: { $regex: q, $options: "i" } },
    { description: { $regex: q, $options: "i" } },
    { products: { $regex: q, $options: "i" } },
    { services: { $regex: q, $options: "i" } }
  ] } : {};
  const exhibitors = await Exhibitor.find(filter).populate("user", "name email phone");
  res.json({ success: true, count: exhibitors.length, exhibitors });
};

export const getMyExhibitor = async (req, res) => {
  const exhibitor = await Exhibitor.findOne({ user: req.user._id }).populate("user", "name email phone");
  res.json({ success: true, exhibitor });
};

export const upsertExhibitor = async (req, res) => {
  const exhibitor = await Exhibitor.findOneAndUpdate(
    { user: req.user._id },
    { ...req.body, user: req.user._id },
    { new: true, upsert: true, runValidators: true }
  );
  res.json({ success: true, exhibitor });
};

export const approveExhibitor = async (req, res) => {
  const exhibitor = await Exhibitor.findByIdAndUpdate(req.params.id, { approved: req.body.approved !== false }, { new: true });
  if (!exhibitor) return res.status(404).json({ success: false, message: "Exhibitor not found." });
  res.json({ success: true, exhibitor });
};
