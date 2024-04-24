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

const TodoTask = require("./models/TodoTask");

main().catch((err) => console.log(err));

async function main() {
  await mongoose.connect(process.env.URI);
  console.log("Connected to db!");
  app.listen(3000, () => console.log("Server Up and running"));
}

app.set("view engine", "ejs");
app.use("/static", express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get("/api/posts", async (req, res) => {
  try {
    const posts = await util.read(URI, DATABASE, POSTS, {});
    res.json(posts); //  JSON response
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: "Failed to retrieve posts" });
  }
});

// === LOGIN PAGE ===
app.route("/").get(async (req, res) => {
  try {
    res.render("login.ejs");
  } catch (err) {
    console.error(err);
  }
});

app.post("/create-post", async (req, res) => {
  try {
    res.redirect("/home");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// === CALL to AUTHENTICATE ===
app.post("/login", (req, res) => {
  const { email, password } = req.body;
  let authenticated = false;
  let avatarUrl = ""; // Initialize avatarUrl variable
  let todoTasks = []; // Initialize todoTasks variable

  // Read the CSV file
  fs.createReadStream("./util/credentials.csv")
    .pipe(csv())
    .on("data", (row) => {
      if (row.email === email && row.password === password) {
        authenticated = true;

        // Check if avatar URL exists in the row
        if (row.avatar) {
          avatarUrl = row.avatar;
        }

        // Generate JWT token
        const token = jwt.sign(
          { id: row.id, email: row.email },
          process.env.JWT_SECRET,
          { expiresIn: "1h" }
        );

        // Retrieve todoTasks for the user
        TodoTask.find({ userIdentifier: row.id, deleted: false })
          .then((tasks) => {
            todoTasks = tasks;
            // Pass avatar URL, token, and todoTasks to the EJS template
            res.render("todo.ejs", { avatarUrl, token, todoTasks });
          })
          .catch((err) => {
            console.error(err);
            res.status(500).send("Internal Server Error");
          });
      }
    })
    .on("end", () => {
      if (!authenticated) {
        res.status(401).send("Khong dung rui thu lai ikk");
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
app.get("/home", verifyToken, async (req, res) => {
  try {
    const userIdentifier = req.user.id;
    const tasks = await TodoTask.find({ userIdentifier, deleted: false });
    res.render("todo.ejs", { todoTasks: tasks });
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

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

//DELETE
app.route("/remove/:id").get(async (req, res) => {
  const id = req.params.id;
  try {
    await TodoTask.findByIdAndUpdate(id, { deleted: true });

    res.redirect("/home");
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

function verifyToken(req, res, next) {
  let bearerHeader = req.headers["authorization"];
  if (!bearerHeader) {
    bearerHeader = req.cookies.token;
  }
  if (typeof bearerHeader !== "undefined") {
    const bearerToken = bearerHeader.split(" ")[1];
    jwt.verify(bearerToken, process.env.JWT_SECRET, (err, authData) => {
      if (err) {
        console.error("JWT verification error:", err);
        res.status(403).send("Forbidden: Invalid token");
      } else {
        console.log("Authenticated user data:", authData);
        req.user = authData;
        next();
      }
    });
  } else {
    console.error("Token not provided");
    res.status(403).send("Forbidden: Token not provided");
  }
}
