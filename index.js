// import express from "express";
// import { createClient } from "@supabase/supabase-js";

// const app = express();
// const port = 3000;

// // variáveis de ambiente
// const supabaseUrl = "https://wcjqvfbfdkipeypujmxw.supabase.co";
// const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjanF2ZmJmZGtpcGV5cHVqbXh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0NTU3NjUsImV4cCI6MjA3NjAzMTc2NX0.TYv7fZ8bKQjjqUXsDWG3uNyKsqXh2ee1HQNmtex3JTc"; // usa a "anon public" key
// const supabase = createClient(supabaseUrl, supabaseKey);

// app.get("/", async (req, res) => {
//     const { data, error } = await supabase.from("users").select("*");
//     if (error) return res.status(500).json({ error });
//     res.json(data);
// });

// app.listen(port, () => {
//     console.log(`Server a correr em http://localhost:${port}`);
// });
