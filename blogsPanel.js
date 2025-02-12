require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");


const app = express();

const allowedOrigins = [
  'https://www.connectingdotserp.com',
  'https://connectingdotserp.com'
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true); // Allow request
    } else {
      callback(new Error('Not allowed by CORS')); // Block request
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
};

app.use(cors(corsOptions));

// Debugging Middleware to Check Incoming Origin
app.use((req, res, next) => {
  console.log("Incoming Request Origin:", req.headers.origin);
  next();
});

app.use(express.json());

// MongoDB Connection for Blogs
mongoose.connect('mongodb+srv://connectingerp1:DMcderp%40123@cluster0.vxukv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0')
  .then(() => console.log("✅ Blogs MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Connection Error:", err));


// Blog Schema & Model
const blogSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  category: { type: String, required: true },
  author: { type: String, required: true },
  image: { type: String }
});
const Blog = mongoose.model("Blog", blogSchema);

// Multer setup for file uploads
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir); // Ensure files are stored in the created directory
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const upload = multer({ storage });

// Fetch all blogs
app.get("/api/blogs", async (req, res) => {
  try {
    const { category } = req.query;
    const query = category && category !== "all" ? { category } : {};
    const blogs = await Blog.find(query);
    res.json(blogs);
  } catch (err) {
    res.status(500).json({ message: "Error fetching blogs", error: err.message });
  }
});

// Fetch blog by ID
app.get("/api/blogs/:id", async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ message: "Blog not found" });
    res.json(blog);
  } catch (err) {
    res.status(500).json({ message: "Error fetching blog", error: err.message });
  }
});

// Create a new blog with an image
app.post("/api/blogs", upload.single("image"), async (req, res) => {
  try {
    const { title, content, category, author } = req.body;
    const imagePath = req.file 
      ? `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}` 
      : null;
    const newBlog = new Blog({ title, content, category, author, image: imagePath });
    await newBlog.save();
    res.status(201).json({ message: "Blog created successfully", blog: newBlog });
  } catch (err) {
    res.status(500).json({ message: "Error creating blog", error: err.message });
  }
});

// Update a blog
app.put("/api/blogs/:id", upload.single("image"), async (req, res) => {
  try {
    const updatedData = req.body;
    const updatedBlog = await Blog.findByIdAndUpdate(req.params.id, updatedData, { new: true });
    if (!updatedBlog) return res.status(404).json({ message: "Blog not found" });
    res.json({ message: "Blog updated successfully", blog: updatedBlog });
  } catch (err) {
    res.status(500).json({ message: "Error updating blog", error: err.message });
  }
});

// Delete a blog
app.delete("/api/blogs/:id", async (req, res) => {
  try {
    const deletedBlog = await Blog.findByIdAndDelete(req.params.id);
    if (!deletedBlog) return res.status(404).json({ message: "Blog not found" });
    res.json({ message: "Blog deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting blog", error: err.message });
  }
});

// Start the blog server
const PORT = process.env.BLOG_PORT || 5002;
app.listen(PORT, () => console.log(`Blog server running on port ${PORT}`));
