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
    pool.query('SELECT wren_id, common_name, risk_category, image FROM GRASSWREN;', function (err, result) {
        if (err) throw err;

        res.send(result);
    });
});

server.get('/api/grasswren/:id', (req, res) => {
    const { id } = req.params;
    pool.query(`SELECT wren_id, scientific_name, common_name, risk_category, image, population, location, description, threats, image, audio FROM GRASSWREN WHERE wren_id = ${id};`, function (err, result) {
        if (err) throw err;

        res.send(result);
    });
});

server.get('/api/risk/firepoints', (req, res) => {
    let query = 'SELECT CASE WHEN ST_GeometryType(geometry_geom) = \'MULTIPOLYGON\' THEN ST_AsText(ST_PointN(ST_ExteriorRing(ST_GeometryN(geometry_geom, 1)), 1)) WHEN ST_GeometryType(geometry_geom) = \'POLYGON\' THEN ST_AsText(ST_PointN(ST_ExteriorRing(geometry_geom), 1)) ELSE NULL END AS first_point FROM FIRE WHERE fire_type = \'Bushfire\' OR fire_type = \'Unknown\'';

    pool.query(query, function (err, result) {
        if (err) {
            console.error(err);
            return res.status(500).send('Server error');
        }
        
        res.send(result);
    });
});

server.listen(PORT, () => {
    console.log('Server is running on port', PORT);
    }
);