require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("cloudinary").v2;
const path = require("path");

const app = express();

// Allowed Origins for CORS
const allowedOrigins = [
  "https://www.connectingdotserp.com",
  "https://connectingdotserp.com",
  "https://z9xp1gq0-3000.inc1.devtunnels.ms",
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.error("❌ CORS Blocked Origin:", origin);
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Debugging Middleware
app.use((req, res, next) => {
  console.log("Incoming Request:", req.method, req.url);
  console.log("Origin:", req.headers.origin);
  next();
});

// ✅ MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Blogs MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Connection Error:", err));

// ✅ Blog Schema & Model
const blogSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  category: { type: String, required: true },
  subcategory: { type: String, required: true },
  author: { type: String, required: true },
  image: { type: String },
});

const Blog = mongoose.model("Blog", blogSchema);

// ✅ Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ✅ Multer Storage for Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "blog-images",
    format: async (req, file) => "png",
    public_id: (req, file) => Date.now() + "-" + file.originalname,
  },
});

const upload = multer({ storage });

// ✅ Fetch all blogs (supports category & subcategory filtering)
app.get("/api/blogs", async (req, res) => {
  try {
    const { category, subcategory } = req.query;
    let query = {};
    if (category) query.category = category;
    if (subcategory) query.subcategory = subcategory;

    const blogs = await Blog.find(query);
    res.json(blogs);
  } catch (err) {
    res.status(500).json({ message: "Error fetching blogs", error: err.message });
  }
});

// ✅ Fetch blog by ID with proper ObjectId validation
app.get("/api/blogs/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid Blog ID format" });
    }

    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ message: "Blog not found" });

    res.json(blog);
  } catch (err) {
    res.status(500).json({ message: "Error fetching blog", error: err.message });
  }
});

// ✅ Create a new blog with Cloudinary image upload
app.post("/api/blogs", upload.single("image"), async (req, res) => {
  try {
    const { title, content, category, subcategory, author } = req.body;
    const imagePath = req.file ? req.file.path : null; // Cloudinary URL

    const newBlog = new Blog({ title, content, category, subcategory, author, image: imagePath });
    await newBlog.save();

    res.status(201).json({ message: "Blog created successfully", blog: newBlog });
  } catch (err) {
    res.status(500).json({ message: "Error creating blog", error: err.message });
  }
});

// ✅ Update a blog (Supports optional image update)
app.put("/api/blogs/:id", upload.single("image"), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid Blog ID format" });
    }

    let updatedData = req.body;
    if (req.file) {
      updatedData.image = req.file.path; // Update image URL from Cloudinary
    }

    const updatedBlog = await Blog.findByIdAndUpdate(req.params.id, updatedData, { new: true });
    if (!updatedBlog) return res.status(404).json({ message: "Blog not found" });

    res.json({ message: "Blog updated successfully", blog: updatedBlog });
  } catch (err) {
    res.status(500).json({ message: "Error updating blog", error: err.message });
  }
});

// ✅ Delete a blog
app.delete("/api/blogs/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid Blog ID format" });
    }

    const deletedBlog = await Blog.findByIdAndDelete(req.params.id);
    if (!deletedBlog) return res.status(404).json({ message: "Blog not found" });

    res.json({ message: "Blog deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting blog", error: err.message });
  }
});

// ✅ Start the blog server
const PORT = process.env.BLOG_PORT || 5002;
app.listen(PORT, () => console.log(`🚀 Blog server running on port ${PORT}`));
