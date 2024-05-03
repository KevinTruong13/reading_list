const path = require("path");
const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios"); // For API requests
require("dotenv").config({ path: path.resolve(__dirname, '.env') });

const { MongoClient, ServerApiVersion } = require("mongodb");

const app = express();
const uri = process.env.MONGO_CONNECTION_STRING;
const databaseAndCollection = { db: process.env.MONGO_DB_NAME, collection: process.env.MONGO_COLLECTION };
const client = new MongoClient(uri, { serverApi: ServerApiVersion.v1 });

const port = process.env.PORT || 4000;

app.set("views", path.resolve(__dirname, "templates"));
app.set("view engine", "ejs");

app.use('/styles', express.static(path.resolve(__dirname, 'styles')));

app.use(bodyParser.urlencoded({ extended: false }));

// Routes
app.get("/", (req, res) => {
    res.render("index");
});

app.post("/login", (req, res) => {
    const username = req.body.username;
    res.redirect(`/library/${username}`);
});

app.get("/library/:username", async (req, res) => {
    const username = req.params.username;
    
    try {
        await client.connect();
        const books = await client.db(databaseAndCollection.db)
                                  .collection(databaseAndCollection.collection)
                                  .find({ username })
                                  .toArray();

        res.render("library", { username, books });
    } catch (e) {
        console.error(e);
        res.send("Error loading library.");
    } finally {
        await client.close();
    }
});

app.post("/library/:username/add", async (req, res) => {
    const username = req.params.username;
    const bookTitle = req.body.bookTitle;

    try {
        const response = await axios.get(`https://openlibrary.org/search.json?title=${encodeURIComponent(bookTitle)}`);

        const bookData = response.data.docs[0];

        if (!bookData) {
            res.send("Book not found.");
            return;
        }

        const olid = bookData.cover_edition_key;

        const book = {
            username,
            title: bookData.title,
            author: bookData.author_name ? bookData.author_name[0] : "Unknown",
            pages: bookData.number_of_pages_median || "N/A",
            published: bookData.first_publish_year || "Unknown",
            coverImageUrl: olid ? `https://covers.openlibrary.org/b/olid/${olid}-M.jpg` : null,
        };

        await client.connect();
        await client.db(databaseAndCollection.db)
                    .collection(databaseAndCollection.collection)
                    .insertOne(book);

        res.redirect(`/library/${username}`);
    } catch (e) {
        console.error(e);
        res.send("Error adding book.");
    } finally {
        await client.close();
    }
});

app.post("/library/:username/remove", async (req, res) => {
    const username = req.params.username;
    const bookTitle = req.body.bookID;

    try {
        await client.connect();
        await client.db(databaseAndCollection.db)
                    .collection(databaseAndCollection.collection)
                    .deleteOne({ title: bookTitle });

        res.redirect(`/library/${username}`);
    } catch (e) {
        console.error(e);
        res.send("Error removing book.");
    } finally {
        await client.close();
    }
});

app.post("/library/:username/clear", async (req, res) => {
    const username = req.params.username;

    try {
        await client.connect();
        await client.db(databaseAndCollection.db)
                    .collection(databaseAndCollection.collection)
                    .deleteMany({ username });

        res.redirect(`/library/${username}`);
    } catch (e) {
        console.error(e);
        res.send("Error clearing library.");
    } finally {
        await client.close();
    }
});

app.listen(port, () => {
    console.log(`Web server started at http://localhost:${port}`);
    console.log("Type 'stop' to shutdown the server:");
});

// Wait for 'stop' command
process.stdin.setEncoding("utf-8");
process.stdin.on("data", (input) => {
    const command = input.toString().trim();
    if (command.toLowerCase() === "stop") {
        console.log("Shutting down the server...");
        process.exit(0);
    } else {
        console.log(`Invalid command: ${command}`);
    }
});
