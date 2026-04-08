console.log('OMDB_API_KEY:', process.env.OMDB_API_KEY);

import express from "express";
import cors from "cors";
import pg from "pg";

import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const db = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // necessário para alguns bancos no Railway
  },
});

const imdbList = [
  "tt0372784", // Batman Begins
  "tt1375666", // Inception
  "tt0133093", // The Matrix
  "tt0111161", // The Shawshank Redemption
  "tt0068646", // The Godfather
  "tt0109830", // Forrest Gump
  "tt0120737", // The Lord of the Rings: The Fellowship of the Ring
  "tt0080684", // Star Wars: Episode V - The Empire Strikes Back
  "tt0137523", // Fight Club
  "tt0816692", // Interstellar
  "tt0120586", // American History X
  "tt0114369", // Se7en
  "tt0110912", // Pulp Fiction
  "tt0120689", // The Green Mile
  "tt0172495", // Gladiator
  "tt0120338", // Titanic
  "tt0848228", // The Avengers
  "tt7286456", // Joker
  "tt0468569", // The Dark Knight
  "tt9362722", // Spider-Man: Across the Spider-Verse
];

app.get("/loadMovies", async (req, res) => {
  try {
    const responses = await Promise.all(
      imdbList.map((id) =>
        fetch(
          `https://www.omdbapi.com/?i=${id}&apikey=${process.env.OMDB_API_KEY}`,
        ),
      ),
    );

    const data = await Promise.all(responses.map((res) => res.json()));

    // remove filmes inválidos
    const validMovies = data.filter((movie) => movie.Response === "True");

    res.json(validMovies);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Erro ao carregar filmes!" });
  }
});

app.get("/movies", async (req, res) => {
  try {
    const search = req.query.search;

    const response = await fetch(
      `https://www.omdbapi.com/?s=${search}&apikey=${process.env.OMDB_API_KEY}`,
    );
    const data = await response.json();

    if (!data.Search) return res.json([]);

    const detailedMovies = await Promise.all(
      data.Search.map((movie) =>
        fetch(
          `https://www.omdbapi.com/?i=${movie.imdbID}&apikey=${process.env.OMDB_API_KEY}`,
        ).then((res) => res.json()),
      ),
    );

    res.json(detailedMovies);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Erro ao buscar filmes!" });
  }
});

app.get("/movieDetail/:id", async (req, res) => {
  const { id } = req.params;

  const response = await fetch(
    `http://www.omdbapi.com/?i=${id}&apikey=${process.env.OMDB_API_KEY}`,
  );

  const data = await response.json();
  res.json(data);
});

app.post("/favorites", async (req, res) => {
  const { imdbID, Title } = req.body;

  try {
    const exists = await db.query(
      "SELECT imdbID FROM favorites WHERE imdbID = $1",
      [imdbID],
    );

    if (exists.rows.length > 0) {
      return res.status(400).json({ message: "Filme já adicionado." });
    }

    const query = `
    INSERT INTO favorites (imdbID, Title) 
    VALUES($1, $2) 
    RETURNING *;`;

    const values = [imdbID, Title];

    const result = await db.query(query, values);

    res.status(201).json({
      message: "Salvo com sucesso",
      data: result.rows[0],
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Erro ao salvar no banco" });
  }
});

app.post("/reviews", async (req, res) => {
  const { imdbID, Title, name, comment, rating } = req.body;

  try {
    const review = await db.query(
      "INSERT INTO reviews (imdbID, title, name, comment, rating) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [imdbID, Title, name, comment, rating],
    );

    res.status(201).json({
      message: "Review criada com sucesso",
      data: review.rows[0],
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Erro ao criar review" });
  }
});

app.get("/favorites", async (req, res) => {
  try {
    const result = await db.query("SELECT imdbID FROM favorites");

    const promises = await result.rows.map((movie) => {
      return fetch(
        `http://www.omdbapi.com/?i=${movie.imdbid}&apikey=${process.env.OMDB_API_KEY}`,
      ).then((res) => res.json());
    });

    const finalData = await Promise.all(promises);

    res.json(finalData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/reviews/:imdbid", async (req, res) => {
  try {
    const { imdbid } = req.params;

    const result = await db.query("SELECT * FROM reviews WHERE imdbid = $1", [
      imdbid,
    ]);

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.delete("/reviews/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      "DELETE FROM reviews WHERE id = $1 RETURNING *",
      [id],
    );
    res.json(result.rows);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
});

app.delete("/Favorites/:imdbID", async (req, res) => {
  try {
    const { imdbID } = req.params;

    const result = await db.query(
      "DELETE FROM favorites WHERE imdbid = $1 RETURNING *",
      [imdbID],
    );
    res.json(result.rows);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(3001, () => console.log("API rodando na porta 3001"));
