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
  "https://blog-frontend-psi-bay.vercel.app",
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
  subcategory: { 
    type: String, 
    required: true,
    enum: ["Article", "Tutorial", "Interview Questions"] 
  },
  author: { type: String, required: true },
  image: { type: String },
  imagePublicId: { type: String },
  status: { 
    type: String, 
    enum: ["Trending", "Featured", "Editor's Pick", "Recommended", "None"], 
    default: "None" 
  },
});

const Blog = mongoose.model("Blog", blogSchema);

// ✅ Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ✅ Helper function to extract public_id from Cloudinary URL
const getPublicIdFromUrl = (url) => {
  if (!url) return null;
  
  try {
    // Extract the public ID from the URL (format: .../upload/v1234567890/folder/public_id.extension)
    const urlParts = url.split('/');
    const fileNameWithExtension = urlParts[urlParts.length - 1];
    const publicIdWithFolder = urlParts.slice(-2).join('/');
    
    // Remove file extension to get the public ID
    return publicIdWithFolder.substring(0, publicIdWithFolder.lastIndexOf('.'));
  } catch (error) {
    console.error("Error extracting public ID:", error);
    return null;
  }
};

// ✅ Helper function to delete image from Cloudinary
const deleteCloudinaryImage = async (publicId) => {
  if (!publicId) return;
  
  try {
    console.log(`Attempting to delete Cloudinary image with public ID: ${publicId}`);
    const result = await cloudinary.uploader.destroy(publicId);
    console.log(`Cloudinary deletion result:`, result);
    return result;
  } catch (error) {
    console.error(`Error deleting Cloudinary image ${publicId}:`, error);
  }
};

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

// ✅ Fetch all blogs (supports category, subcategory & status filtering)
app.get("/api/blogs", async (req, res) => {
  try {
    const { category, subcategory, status } = req.query;
    let query = {};
    if (category) query.category = category;
    if (subcategory) query.subcategory = subcategory;
    if (status) query.status = status;

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
    const { title, content, category, subcategory, author, status } = req.body;
    
    let imagePath = null;
    let imagePublicId = null;
    
    if (req.file) {
      imagePath = req.file.path; // Cloudinary URL
      imagePublicId = req.file.filename || getPublicIdFromUrl(imagePath);
    }

    const newBlog = new Blog({ 
      title, 
      content, 
      category, 
      subcategory, 
      author, 
      image: imagePath,
      imagePublicId,
      status: status || "None"
    });
    
    await newBlog.save();

    res.status(201).json({ message: "Blog created successfully", blog: newBlog });
  } catch (err) {
    res.status(500).json({ message: "Error creating blog", error: err.message });
  }
});

// ✅ Update a blog (Supports optional image update and deletes old image)
app.put("/api/blogs/:id", upload.single("image"), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid Blog ID format" });
    }

    // Find the existing blog to get the current image public ID
    const existingBlog = await Blog.findById(req.params.id);
    if (!existingBlog) return res.status(404).json({ message: "Blog not found" });
    
    let updatedData = req.body;
    
    // If a new image is uploaded, update the image fields and delete the old image
    if (req.file) {
      // Delete the old image if exists
      if (existingBlog.imagePublicId) {
        await deleteCloudinaryImage(existingBlog.imagePublicId);
      }
      
      // Update with new image details
      updatedData.image = req.file.path;
      updatedData.imagePublicId = req.file.filename || getPublicIdFromUrl(req.file.path);
    }

    const updatedBlog = await Blog.findByIdAndUpdate(req.params.id, updatedData, { new: true });

    res.json({ message: "Blog updated successfully", blog: updatedBlog });
  } catch (err) {
    res.status(500).json({ message: "Error updating blog", error: err.message });
  }
});

// ✅ Delete a blog and its associated image
app.delete("/api/blogs/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid Blog ID format" });
    }

    // Find the blog to get the image public ID
    const blogToDelete = await Blog.findById(req.params.id);
    if (!blogToDelete) return res.status(404).json({ message: "Blog not found" });
    
    // Delete the associated image from Cloudinary if exists
    if (blogToDelete.imagePublicId) {
      await deleteCloudinaryImage(blogToDelete.imagePublicId);
    }

    // Delete the blog from the database
    await Blog.findByIdAndDelete(req.params.id);

    res.json({ message: "Blog and associated image deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting blog", error: err.message });
  }
});

// ✅ Start the blog server
const PORT = process.env.BLOG_PORT || 5002;
app.listen(PORT, () => console.log(`🚀 Blog server running on port ${PORT}`));
