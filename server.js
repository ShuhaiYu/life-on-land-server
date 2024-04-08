import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import mysql from 'mysql';


dotenv.config();

const server = express();
let PORT = process.env.PORT || 3000;

server.use(cors());
server.use(express.json());

const pool = mysql.createPool({
    connectionLimit: 10,
    host: process.env.DB_HOST,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: 'Grasswren'
});

server.get('/', (req, res) => {
    res.status(200).send('Hello World This is the server for the FYJI team!');
});

server.get('/api/grasswren/list', (req, res) => {
    pool.query('SELECT wren_id, common_name, risk_category, image FROM GRASSWREN ORDER BY risk_category;', function (err, result) {
        if (err) throw err;

        res.send(result);
    });
});

server.get('/api/grasswren/:id', (req, res) => {
    const { id } = req.params;
    pool.query(`SELECT g.wren_id, scientific_name, common_name, risk_category, image, population, location, description, threats, image, audio, obs_lat, obs_lon FROM Grasswren.OBSERVATION AS o RIGHT JOIN Grasswren.GRASSWREN AS g ON g.wren_id = o.wren_id WHERE g.wren_id = ${id};`, function (err, result) {
        if (err) throw err;

        // check if the result is empty
        if (result.length === 0) {
            res.send([]);
            return;
        }

        // initialize an array to store all observation locations
        const obs_locations = result.map(item => ({
            lat: item.obs_lat,
            lon: item.obs_lon
        }));

        // create the final result object and add the observation locations array
        let finalResult = {
            wren_id: result[0].wren_id,
            scientific_name: result[0].scientific_name,
            common_name: result[0].common_name,
            risk_category: result[0].risk_category,
            image: result[0].image,
            population: result[0].population,
            location: result[0].location,
            description: result[0].description,
            threats: result[0].threats,
            audio: result[0].audio,
            obs_locations: obs_locations // add the observation locations array
        };

        // send the final result object
        res.send(finalResult);
    });
});

server.get('/api/risk/firepoints', (req, res) => {
    let query = 'SELECT geometry AS first_point FROM FIRE WHERE fire_type = \'Bushfire\'';

    pool.query(query, function (err, result) {
        if (err) {
            console.error(err);
            return res.status(500).send('Server error');
        }

        res.send(result);
    });
});

server.get('/api/risk/firedata', (req, res) => {
    let query = 'SELECT fire_date, fire_type, state FROM FIRE ORDER BY fire_date';

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