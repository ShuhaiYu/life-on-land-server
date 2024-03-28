import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import mysql from 'mysql';


dotenv.config();

const server = express();
let PORT = 3000;

server.use(cors());
server.use(express.json());

const pool = mysql.createPool({
  connectionLimit : 10, 
  host            : process.env.DB_HOST,
  user            : process.env.DB_USERNAME,
  password        : process.env.DB_PASSWORD,
  database        : 'Grasswren'
});

server.get('/', (req, res) => {
    res.send('Hello World This is the server for the FYJI team!');
  });

server.get('/api/grasswren/list', (req, res) => {
    pool.query('SELECT wren_id, common_name, risk_category FROM GRASSWREN;', function (err, result) {
        if (err) throw err;

        res.send(result);
    });
});

server.get('/api/grasswren/:id', (req, res) => {
    const { id } = req.params;
    pool.query(`SELECT * FROM GRASSWREN WHERE wren_id = ${id};`, function (err, result) {
        if (err) throw err;

        res.send(result);
    });
});

server.listen(PORT, () => {
    console.log('Server is running on port', PORT);
    }
);