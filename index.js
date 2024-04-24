const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const express = require("express");
const app = express();
const dotenv = require("dotenv");
const csv = require("csv-parser");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt"); // Import bcrypt for password hashing
dotenv.config();
const multer = require("multer");

const TodoTask = require("./models/TodoTask");
const User = require("./models/User");

const upload = multer({ dest: "uploads/" });

main().catch((err) => console.log(err));

async function main() {
  await mongoose.connect(process.env.URI);
  console.log("Connected to db!");
  app.listen(3000, () => console.log("Server Up and running"));
}

app.set("view engine", "ejs");
app.use("/static", express.static("public"));
app.use("/uploads", express.static("uploads"));

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Error handling middleware for Multer
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // A Multer error occurred when uploading
    console.error("Multer error:", err);
    res.status(400).send("Error uploading file");
  } else {
    // An unknown error occurred
    console.error("Unknown error:", err);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/api/posts", async (req, res) => {
  try {
    const posts = await util.read(URI, DATABASE, POSTS, {});
    res.json(posts); //  JSON response
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: "Failed to retrieve posts" });
  }
});
app.route("/").get(async (req, res) => {
  try {
    res.render("login.ejs");
  } catch (err) {
    console.error(err);
  }
});

app.get("/home", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const tasks = await TodoTask.find({
      userIdentifier: userId,
      deleted: false,
    });
    const avatarUrl = req.avatarUrl;
    const name = req.name;
    res.render("todo.ejs", {
      todoTasks: tasks,
      token: req.token,
      avatarUrl: avatarUrl,
      name: name,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/home", verifyToken, upload.single("file"), async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if a file was uploaded
    if (!req.file) {
      return res.status(400).send("No file uploaded");
    }

    // Access the filename and other image properties
    const { filename, buffer, mimetype } = req.file;

    // Create a new TodoTask object with image data
    const todoTask = new TodoTask({
      name: req.body.name,
      mainimg: {
        data: buffer, // Save image data
        contentType: mimetype, // Save content type
        filename: filename, // Save filename
      },
      location: req.body.location,
      caption: req.body.caption,
      userIdentifier: userId,
    });

    // Save the TodoTask object to the database
    await todoTask.save();

    // Retrieve avatarUrl from req.user
    const avatarUrl = req.user.avatarUrl;
    const name = req.user.name;

    // Retrieve todoTasks for the user
    const tasks = await TodoTask.find({
      userIdentifier: userId,
      deleted: false,
    });

    res.render("todo.ejs", {
      todoTasks: tasks,
      token: req.token,
      avatarUrl: avatarUrl,
      name: name,
      filename: filename, // Pass the filename to the view
    });
  } catch (error) {
    console.error("Error creating task:", error);
    res.status(500).send("Error creating task");
  }
});

// === CALL to AUTHENTICATE ===
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find the user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).send("Invalid credentials");
    }

    // Compare the password with the hashed password stored in the database
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).send("Invalid credentials");
    }

    // Generate JWT token for authentication
    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        avatarUrl: user.avatar,
        name: user.name,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Set JWT token as cookie
    res.cookie("token", "Bearer " + token, { httpOnly: true, secure: true });

    // Redirect the user to the home page
    res.redirect("/home");
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

// === LOG OUT ====
app.get("/logout", (req, res) => {
  res.clearCookie("token", { httpOnly: true, secure: true });
  // Redirect the user to the login page after logout
  res.redirect("/");
});

// === SIGNUP ====
app.post("/signup", async (req, res) => {
  try {
    // Extract email and password from request body
    const { email, password } = req.body;

    // Validate input data (you can add more validation as needed)
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Check if user with the same email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "Email already exists" });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user object
    const newUser = new User({ email, password: hashedPassword });

    // Save the new user to the database
    await newUser.save();

    // Generate JWT token for authentication
    const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    // Send the JWT token back to the client
    res.status(201).json({ token });
  } catch (error) {
    console.error("Error signing up user:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// === HOME PAGE ===

//UPDATE
app
  .route("/edit/:id")
  .get(async (req, res) => {
    const id = req.params.id;
    try {
      const task = await TodoTask.findById(id);
      res.render("todoEdit.ejs", { task, idTask: id });
    } catch (err) {
      res.status(500).send(err);
    }
  })
  .post(async (req, res) => {
    const id = req.params.id;
    try {
      await TodoTask.findByIdAndUpdate(id, {
        name: req.body.name,
        profimg: req.body.profimg,
        mainimg: req.body.mainimg,
        location: req.body.location,
        caption: req.body.caption,
      });
      res.redirect("/home");
    } catch (err) {
      res.status(500).send(err);
    }
  });

app.get("/remove/:id", verifyToken, async (req, res) => {
  const id = req.params.id;
  try {
    // Fetch the task by ID
    const task = await TodoTask.findById(id);

    // Update the task to mark it as deleted
    await TodoTask.findByIdAndUpdate(id, { deleted: true });

    // Retrieve tasks after removing
    const userId = req.user.id;
    const tasks = await TodoTask.find({
      userIdentifier: userId,
      deleted: false,
    });

    // Retrieve avatarUrl from req.user
    const avatarUrl = req.user.avatarUrl;
    const name = req.user.name;

    // Extract the filename if task exists and has mainimg property
    const filename = task && task.mainimg ? task.mainimg.filename : "";

    // Pass the required variables to the template
    res.render("todo.ejs", {
      filename: filename,
      avatarUrl: avatarUrl,
      name: name,
      token: req.token,
      todoTasks: tasks,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error removing task");
  }
});

//VIEW DELETED POSTS
app.get("/deleted", async (req, res) => {
  try {
    const deletedTasks = await TodoTask.find({ deleted: true });
    res.render("deleted.ejs", { deletedTasks });
  } catch (err) {
    res.status(500).send(err);
  }
});

// -------------- verifyToken -----------------------
function verifyToken(req, res, next) {
  let bearerHeader = req.headers["authorization"];
  if (!bearerHeader) {
    bearerHeader = req.cookies.token;
  }
  if (typeof bearerHeader !== "undefined") {
    const bearerToken = bearerHeader.split(" ")[1];
    jwt.verify(bearerToken, process.env.JWT_SECRET, (err, authData) => {
      if (err) {
        console.error("Token verification error:", err);
        res.status(403).send("Invalid or expired token");
      } else {
        console.log("Token verified successfully:", authData);
        req.user = authData;
        next();
      }
    });
  } else {
    console.log("No token provided");
    res.status(403).send("No token provided");
  }
}

// ==== added ===
