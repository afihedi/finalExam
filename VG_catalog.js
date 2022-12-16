const http = require("http");
const path = require("path");
const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const portNumber = 5000;
const { MongoClient, ServerApiVersion } = require('mongodb');
require("dotenv").config(({ path: path.resolve(__dirname, './.env') }));
const igdb = require("igdb-api-node").default;
const axios = require("axios");

process.stdin.setEncoding("utf8"); 
app.set("views", path.resolve(__dirname, "templates"));
app.set("view engine", "ejs");
app.use("/styles", express.static("styles"));
app.use(bodyParser.urlencoded({extended:false}));

const userName = process.env.MONGO_DB_USERNAME;
const password = process.env.MONGO_DB_PASSWORD;
const database = process.env.MONGO_DB_NAME;
const collection = process.env.MONGO_COLLECTION;
const uri = `mongodb+srv://${userName}:${password}@cluster0.0rfx2j5.mongodb.net/?retryWrites=true&w=majority`;

let favoriteGames = [];

async function addOrUpdateInMongo(person) {
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

  try {
    let filter = {name: person}
    const result = await client.db(database).collection(collection).findOne(filter);
    if (result) {
      
     // console.log("favorites" + result.favorites)
    //  const cursor = await client.db(database).collection(collection).find(filter);
      
      let listOfGames = result.favorites;
      //myPerson.forEach(elem => {console.log("name: " + elem.favorites)})
      //myList = myPerson[0].favorites;
      
      favoriteGames.forEach((game) => {
        if (!listOfGames.includes(game)) {
        listOfGames.push(game)
        }
      });

      let update = { $set: {favorites : listOfGames} };
      console.log("Updated List: " + listOfGames)
      await client.db(database).collection(collection).updateOne(filter, update)
     
    } else {
      let newGamer = {name: person, favorites : favoriteGames}
      await client.db(database).collection(collection).insertOne(newGamer);

    }
  } catch(e) {
      console.error(e);
  } finally {
      client.close();
  }
}

async function lookupUser(person) {
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
  try {
    let filter = {name: person}
    await client.connect();
    retrieval = await client.db(database).collection(collection).findOne(filter);
        return retrieval;
    } catch(e) {
        console.error(e);
    } finally {
        client.close();
    }
}


const data = {
  client_id: process.env.TWITCH_CLIENT_ID,
  client_secret: process.env.TWITCH_CLIENT_SECRET,
  grant_type: "client_credentials",
};

// Example using all methods.
async function getGames(name) {
    
    const getToken = axios
      .post("https://id.twitch.tv/oauth2/token", data)
      .then((res) => {
        // console.log(`Status: ${res.status}`);
        // console.log("Body: ", res.data);
        return res.data.access_token;
      })
      .catch((err) => {
        console.error(err);
      });

      let access_token = await getToken;
      const client = igdb(data.client_id, access_token);
      const gamesFromDB = await client
        .search(name)
        .fields(["name", "release_dates", "genres"])
        .request("/games");
      //  console.log(response.data);
      //console.log(gamesFromDB.data.forEach((game) => {
     //   console.log(game.name + " " + game.release_dates[0]);
     // }));

      return gamesFromDB;
}

app.get("/", (request, response) => {
    response.render("index.ejs");
})

app.get("/lookup", async (request, response) => {
  
  let gameList =  await getGames(request.query.game);
  let selected = `<h1>The video game is: ${request.query.game}</h1>`;
  let results = ``;
  gameList.data.forEach((game) => {
      game.name = game.name.replace(',', '');
      results +=  `<option value="${game.name}">${game.name}</option>`;
  })
  let variables = {
    videogames: results,
    nameSelected: selected
  };

  response.render('lookup.ejs', variables);
  //console.log(gameList.data);
})

app.post("/favorites", (request, response) => {
  let table = "<ul>";
  let type = typeof(request.body.favorites)
  favoriteGames = [];
  //console.log("type of " + typeof(request.body.favorites))
  if (type === "object") {
    
    request.body.favorites.forEach((elem) => {
      table += `<li>${elem}</li>`;
      favoriteGames.push(elem);
    })
  } else if (type === "string") {
    table += `<li>${request.body.favorites}</li>`;
    favoriteGames.push(request.body.favorites);
  }
  
  table += "</ul>";
  let info = {itemsTable: table};
  //favoriteGames = [];
  response.render("favorites.ejs", info);
});

app.post("/success", (request, response) => {
  let table = "<ul>";
  favoriteGames.forEach((elem) => {
    table += `<li>${elem}</li>`;
  })
  
  table += "</ul>";
  let info = {user: request.body.name, itemsTable: table};
  addOrUpdateInMongo(request.body.name);
  //favoriteGames = [];
  response.render("success.ejs", info);
})

app.get("/userlookup", (request, response) => {
  response.render("names.ejs");
})

app.post("/userFavorites", async (request, response) => {
 let found = await lookupUser(request.body.user);
 let user;

 if (found) {
    let games = found.favorites;
    let table = "<ul>";
    games.forEach((elem) => {
    table += `<li>${elem}</li>`;
  })
    table += "</ul>";

    user = {nameOfUser: `${found.name}'s favorite Games`, theirFavs: table}
 } else {
    let table = `<p>None.</p>`
    user = {nameOfUser: `${request.body.user} was not Found.`, theirFavs: table}
 }

 response.render("results.ejs", user);

})


app.listen(portNumber);
console.log(`Web server started and running at http://localhost:${portNumber}`);
let prompt = `Stop to shutdown the server: `;
process.stdout.write(prompt);
process.stdin.on('readable', () => {
    let data = process.stdin.read();

    if (data !== null) {
        let command = data.trim();
        if (command === "stop") {
            console.log("Shutting down the server");
            process.exit(0);
        } else {
            console.log(`Invalid command: ${command}`);
        }

        process.stdout.write(prompt);
        process.stdin.resume();
    }
})
