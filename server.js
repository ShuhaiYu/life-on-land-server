import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import mysql from 'mysql';
import 'dotenv/config';

dotenv.config();

const server = express();
let PORT = 3000;

server.use(cors());
server.use(express.json());

let connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: 'Grasswren'
});

connection.connect(function (err) {
  if (err) throw err;
  console.log('Connected to MySQL Server!');
});

server.get('/', (req, res) => {
    res.send('Hello World This is the server for the FYJI team!');
  });

server.get('/api/grasswren/list', (req, res) => {
    connection.query('SELECT wren_id, common_name, risk_category FROM GRASSWREN;', function (err, result) {
        if (err) throw err;

        res.send(result);
    });
});

server.listen(PORT, () => {
    console.log('Server is running on port', PORT);
    }
);