import jwt from "jsonwebtoken";
import crypto from "crypto";
import User from "../models/User.js";

const signToken = (id, sessionVersion = 0) =>
  jwt.sign({ id, sessionVersion }, process.env.JWT_SECRET, { expiresIn: "7d" });

const safeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  phone: user.phone,
  company: user.company,
  avatar: user.avatar,
  cover: user.cover || "",
  language: user.language || "en",
  jobTitle: user.jobTitle || "",
  location: user.location || "",
  website: user.website || "",
  bio: user.bio || "",
  interests: user.interests || "",
  customFields: Array.isArray(user.customFields) ? user.customFields : []
});

export const register = async (req, res) => {
  try {
    const { name, email, password, role, phone, company } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "Name, email and password are required." });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: "Password must contain at least 6 characters." });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const allowedRoles = ["organizer", "exhibitor", "attendee", "staff"];
    const selectedRole = allowedRoles.includes(role) ? role : "attendee";

    if (selectedRole === "organizer") {
      const organizerExists = await User.exists({ role: "organizer" });
      if (organizerExists) {
        return res.status(409).json({
          success: false,
          message: "An organizer account already exists. Only one organizer account is allowed."
        });
      }
    }

    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) return res.status(409).json({ success: false, message: "Email already registered." });

    const user = await User.create({
      name,
      email: normalizedEmail,
      password,
      role: selectedRole,
      phone,
      company,
      organizerKey: selectedRole === "organizer" ? "primary" : undefined
    });

    res.status(201).json({ success: true, token: signToken(user._id, user.sessionVersion), user: safeUser(user) });
  } catch (error) {
    if (error?.code === 11000 && error?.keyPattern?.organizerKey) {
      return res.status(409).json({
        success: false,
        message: "An organizer account already exists. Only one organizer account is allowed."
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};


export const googleLogin = async (req, res) => {
  try {
    const { credential } = req.body || {};
    if (!credential) {
      return res.status(400).json({ success: false, message: "Google credential is required." });
    }

    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
    );
    const googleUser = await response.json();

    if (!response.ok || String(googleUser.aud || '') !== String(process.env.GOOGLE_CLIENT_ID || '')) {
      return res.status(401).json({ success: false, message: "Invalid Google sign-in credential." });
    }

    if (googleUser.iss !== "https://accounts.google.com" && googleUser.iss !== "accounts.google.com") {
      return res.status(401).json({ success: false, message: "Invalid Google account issuer." });
    }

    const emailVerified = googleUser.email_verified === true || googleUser.email_verified === "true";
    if (!emailVerified) {
      return res.status(401).json({ success: false, message: "Google email is not verified." });
    }

    const email = String(googleUser.email || "").trim().toLowerCase();
    const name = String(googleUser.name || googleUser.given_name || "EventSphere User").trim();
    if (!email) {
      return res.status(401).json({ success: false, message: "Google did not provide an email address." });
    }

    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        name,
        email,
        password: crypto.randomBytes(32).toString("hex"),
        role: "attendee",
        avatar: String(googleUser.picture || "")
      });
    } else if (!user.avatar && googleUser.picture) {
      user.avatar = String(googleUser.picture);
      await user.save({ validateBeforeSave: false });
    }

    if (user.role === "organizer") {
      user.sessionVersion = (user.sessionVersion || 0) + 1;
      await user.save({ validateBeforeSave: false });
      req.app.get("io")?.to(`user:${user._id}`).emit("auth:revoked", {
        reason: "Your organizer account was signed in from another device or browser."
      });
    }

    res.json({
      success: true,
      token: signToken(user._id, user.sessionVersion),
      user: safeUser(user)
    });
  } catch (error) {
    console.error("Google authentication failed:", error);
    res.status(500).json({ success: false, message: error.message || "Google sign-in failed." });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select("+password");
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    // Organizer accounts use a single active session version. A new organizer
    // login revokes every previous organizer session (all tabs/devices).
    if (user.role === "organizer") {
      user.sessionVersion = (user.sessionVersion || 0) + 1;
      await user.save({ validateBeforeSave: false });
      req.app.get("io")?.to(`user:${user._id}`).emit("auth:revoked", {
        reason: "Your organizer account was signed in from another device or browser."
      });
    }

    res.json({
      success: true,
      token: signToken(user._id, user.sessionVersion),
      user: safeUser(user)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const logout = async (req, res) => {
  try {
    if (req.user.role === "organizer") {
      req.user.sessionVersion = (req.user.sessionVersion || 0) + 1;
      await req.user.save({ validateBeforeSave: false });
      req.app.get("io")?.to(`user:${req.user._id}`).emit("auth:revoked", {
        reason: "You signed out of the organizer account."
      });
    }
    res.json({ success: true, message: "Signed out successfully." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Could not sign out." });
  }
};

export const me = async (req, res) => {
  res.json({ success: true, user: safeUser(req.user) });
};

export const updateProfile = async (req, res) => {
  try {
    const allowed = ["name", "phone", "company", "avatar", "cover", "language", "jobTitle", "location", "website", "bio", "interests", "customFields"];
    const update = {};

    for (const field of allowed) {
      if (!Object.prototype.hasOwnProperty.call(req.body, field)) continue;
      if (field === "customFields") {
        const fields = Array.isArray(req.body[field]) ? req.body[field] : [];
        update.customFields = fields.slice(0, 30).map((item, index) => ({
          id: item?.id || `${Date.now()}-${index}`,
          label: String(item?.label || "").trim().slice(0, 80),
          value: String(item?.value || "").trim().slice(0, 500)
        })).filter(item => item.label && item.value);
      } else if (field === "language") {
        const next = String(req.body[field] || "").trim().toLowerCase();
        update.language = ["en", "ur"].includes(next) ? next : "en";
      } else {
        update[field] = String(req.body[field] ?? "").trim();
      }
    }

    if (Object.prototype.hasOwnProperty.call(update, "name") && !update.name) {
      return res.status(400).json({ success: false, message: "Name is required." });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: update },
      { new: true, runValidators: true }
    );

    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    res.json({ success: true, user: safeUser(user), message: "Profile updated successfully." });
  } catch (error) {
    console.error("Profile update failed:", error);
    res.status(500).json({ success: false, message: error.message || "Could not update profile." });
  }
};

export const changePassword = async (req, res) => {
  try {
    const currentPassword = String(req.body?.currentPassword || "");
    const newPassword = String(req.body?.newPassword || "");

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "Enter your current and new password." });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "New password must contain at least 6 characters." });
    }
    if (newPassword === currentPassword) {
      return res.status(400).json({ success: false, message: "New password must be different from the current password." });
    }

    // Always scope the lookup to the signed-in user (req.user from `protect`);
    // a client can never target another account.
    const user = await User.findById(req.user._id).select("+password");
    if (!user) return res.status(404).json({ success: false, message: "User not found." });

    const ok = await user.comparePassword(currentPassword);
    if (!ok) return res.status(401).json({ success: false, message: "Your current password is incorrect." });

    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: "Password updated successfully." });
  } catch (error) {
    console.error("Password change failed:", error);
    res.status(500).json({ success: false, message: error.message || "Could not update your password." });
  }
};

export const clearProfile = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { phone: "", company: "", avatar: "", cover: "", jobTitle: "", location: "", website: "", bio: "", interests: "", customFields: [] } },
      { new: true, runValidators: true }
    );

    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    res.json({ success: true, user: safeUser(user), message: "Optional profile information cleared." });
  } catch (error) {
    console.error("Profile clear failed:", error);
    res.status(500).json({ success: false, message: error.message || "Could not clear profile." });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.json({ success: true, message: "If the email exists, a reset process can be started." });

    const token = crypto.randomBytes(32).toString("hex");
    user.resetToken = token;
    user.resetTokenExpires = Date.now() + 15 * 60 * 1000;
    await user.save({ validateBeforeSave: false });

    res.json({
      success: true,
      message: "Password reset token generated. Configure email delivery for production.",
      resetToken: token
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const user = await User.findOne({
      resetToken: req.params.token,
      resetTokenExpires: { $gt: Date.now() }
    }).select("+password");

    if (!user) return res.status(400).json({ success: false, message: "Invalid or expired reset token." });

    user.password = req.body.password;
    user.resetToken = undefined;
    user.resetTokenExpires = undefined;
    await user.save();

    res.json({ success: true, message: "Password updated successfully." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const githubLogin = async (req, res) => {
  const status = process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
    ? 501 : 503;
  return res.status(status).json({
    success: false,
    message: "GitHub Sign-In is not configured yet. Add GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET to backend/.env, then use a GitHub OAuth callback through /api/auth/github/callback. Until then, email and Google sign-in remain fully available."
  });
};
