const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const express = require("express");
const app = express();
const dotenv = require("dotenv");
const csv = require("csv-parser");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
dotenv.config();
const multer = require("multer");
const TodoTask = require("./models/TodoTask");

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
    res.render("todo.ejs", {
      todoTasks: tasks,
      token: req.token,
      avatarUrl: avatarUrl,
      filename: req.file.filename,
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

    // Retrieve todoTasks for the user
    const tasks = await TodoTask.find({
      userIdentifier: userId,
      deleted: false,
    });

    res.render("todo.ejs", {
      todoTasks: tasks,
      token: req.token,
      avatarUrl: avatarUrl,
      filename: filename, // Pass the filename to the view
    });
  } catch (error) {
    console.error("Error creating task:", error);
    res.status(500).send("Error creating task");
  }
});

// === CALL to AUTHENTICATE ===
app.post("/login", (req, res) => {
  const { email, password } = req.body;
  let authenticated = false;
  let avatarUrl = ""; // Initialize avatarUrl variable

  // Read the CSV file
  fs.createReadStream("./util/credentials.csv")
    .pipe(csv())
    .on("data", (row) => {
      if (row.email === email && row.password === password) {
        authenticated = true;

        if (row.avatar) {
          avatarUrl = row.avatar;
        }

        // Generate JWT token
        const token = jwt.sign(
          {
            id: row.id,
            email: row.email,
            avatarUrl: row.avatar,
            name: row.name,
          },
          process.env.JWT_SECRET,
          { expiresIn: "1h" }
        );

        // Set JWT token as cookie
        res.cookie("token", "Bearer " + token, {
          httpOnly: true,
          secure: true,
        });

        // Retrieve todoTasks for the user
        TodoTask.find({ userIdentifier: row.id, deleted: false })
          .then((tasks) => {
            // Render the todo.ejs template with the necessary variables
            res.render("todo.ejs", { avatarUrl, token, todoTasks: tasks });
          })
          .catch((err) => {
            console.error(err);
            res.status(500).send("Internal Server Error");
          });
      }
    })
    .on("end", () => {
      if (!authenticated) {
        res.status(401).send("Invalid credentials");
      }
    });
});

// === LOG OUT ====
app.get("/logout", (req, res) => {
  res.clearCookie("token", { httpOnly: true, secure: true });
  // Redirect the user to the login page after logout
  res.redirect("/");
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

    // Extract the filename if task exists and has mainimg property
    const filename = task && task.mainimg ? task.mainimg.filename : "";

    // Pass the required variables to the template
    res.render("todo.ejs", {
      filename: filename,
      avatarUrl: avatarUrl,
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

// Define a schema for comments
const Comment = mongoose.model("Comment", {
  postId: String,
  userId: String,
  content: String,
});

// Endpoint for posting comments
app.post("/post/:postId/comment", verifyToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const { content } = req.body;
    const userId = req.user.id; // Assuming the user ID is stored in the JWT token

    // Create a new comment
    const comment = new Comment({
      postId,
      userId,
      content,
    });

    // Save the comment to the database
    await comment.save();

    res.status(201).send("Comment posted successfully");
  } catch (error) {
    console.error(error);
    res.status(500).send("Error posting comment");
  }
});

app.get("/post/:postId", (req, res) => {
  // Fetch post data from the database or any other data source
  const postId = req.params.postId;
  const postData = {
    title: "Sample Post Title",
    content: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
    author: "John Doe",
  };

  res.render("post.ejs", { post: postData });
});
// ========= file upload ========
// Update the route handler for serving images
app.get("/image/:taskId", async (req, res) => {
  try {
    const taskId = req.params.taskId;
    const task = await TodoTask.findById(taskId);
    console.log("Retrieved task:", task); // Log the retrieved task to console
    if (!task || !task.mainimg) {
      return res.status(404).send("Image not found");
    }
    res.set("Content-Type", "image/png"); // Adjust the content type based on the image format
    res.send(task.mainimg);
  } catch (error) {
    console.error("Error fetching image:", error);
    res.status(500).send("Internal Server Error");
  }
});
