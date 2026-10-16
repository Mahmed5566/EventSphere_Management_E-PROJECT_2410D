import mongoose from "mongoose";

export const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error("MONGO_URI is missing. Add it to backend/.env.");
  }

  try {
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 8000,
    });
    console.log(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    if (error?.name === "MongooseServerSelectionError" || error?.cause?.code === "ECONNREFUSED") {
      console.error("\nMongoDB could not be reached.");
      console.error("This project is configured for local MongoDB at 127.0.0.1:27017.");
      console.error("Start the MongoDB service (Windows Services: MongoDB Server), or install MongoDB Community Server.");
      console.error("If you use MongoDB Atlas, replace MONGO_URI in backend/.env with your Atlas connection string.\n");
    } else {
      console.error(`MongoDB connection failed: ${error.message}`);
    }
    throw error;
  }
};
