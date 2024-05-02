import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import mysql from 'mysql';
import axios from 'axios';
import moment from 'moment';

dotenv.config();   // Load environment variables from .env file

const server = express();
let PORT = process.env.PORT || 3000;

server.use(cors());  // Enable CORS
server.use(express.json());  // Enable JSON body parsing

// Create a connection pool to the MySQL database
const pool = mysql.createPool({
    connectionLimit: 10,
    host: process.env.DB_HOST,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: 'Grasswren'
});

// Utility function to perform SQL queries with basic error handling
function queryDatabase(sql, params, res, callback) {
    pool.query(sql, params, (err, result) => {
        if (err) {
            console.error(err);
            res.status(500).send('An error occurred while fetching data from the database.');
            return;
        }
        callback(result);
    });
}

// Function to geocode postcode using Google Geocode API
async function geocodePostcode(postcode) {
    const url = `https://maps.googleapis.com/maps/api/geocode/json`;
    try {
        const response = await axios.get(url, {
            params: {
                address: `${postcode} Australia`,
                key: process.env.GOOGLE_MAPS_API_KEY
            }
        });
        const { data } = response;
        if (data.status === 'OK') {
            const { lat, lng } = data.results[0].geometry.location;
            console.log('Geocoded coordinates:', lat, lng);
            return { latitude: lat, longitude: lng };
        }
        console.error('Geocoding error:', data.status);
        return null;
    } catch (error) {
        console.error('Error contacting the Google API:', error);
        return null;
    }
}

server.get('/', (req, res) => {
    console.log('Received request:', req.method, req.url);
    res.status(200).send('Hello World This is the server for the FYJI team!');
});

// List all Grasswrens with basic information
server.get('/api/grasswren/list', (req, res) => {
    console.log('Fetching Grasswren list...');
    const sql = 'SELECT wren_id, common_name, risk_category, image FROM GRASSWREN ORDER BY risk_category;';
    queryDatabase(sql, [], res, result => {
        if (result.length === 0) {
            res.status(404).send('Grasswren not found.');
            return;
        }
        res.send(result);
    });
});

// Fetch detailed information about a specific Grasswren by ID
server.get('/api/grasswren/:id', (req, res) => {
    console.log('Fetching Grasswren details for ID:', req.params.id);
    const sql = `SELECT g.wren_id, scientific_name, common_name, risk_category, image, population, location, description, threats, image, audio, obs_lat, obs_lon, obs_date FROM Grasswren.OBSERVATION AS o RIGHT JOIN Grasswren.GRASSWREN AS g ON g.wren_id = o.wren_id WHERE g.wren_id = ?;`;
    const params = [req.params.id];
    queryDatabase(sql, params, res, result => {
        if (result.length === 0) {
            res.status(404).send('Grasswren not found.');
            return;
        }

        // Extract observation locations from the result
        const obs_locations = result.map(item => ({ lat: item.obs_lat, lon: item.obs_lon, date: item.obs_date }));
        // Find the earliest observation date
        const earliestObsDate = obs_locations.reduce((min, p) => p.date < min ? p.date : min, obs_locations[0].date);
        // Remove the observation columns from the result
        let finalResult = { ...result[0], obs_locations, earliestObsDate };
        res.send(finalResult);
    });
});

server.get('/api/grasswren/geo/all', (req, res) => {
    console.log('Fetching all Grasswren geographic data');

    const sql = `
        SELECT 
            common_name, 
            obs_lat, 
            obs_lon, 
            obs_date
        FROM (
            SELECT 
                g.common_name, 
                o.obs_lat, 
                o.obs_lon, 
                o.obs_date,
                ROW_NUMBER() OVER (PARTITION BY g.common_name ORDER BY o.obs_date DESC) AS rn
            FROM 
                Grasswren.GRASSWREN AS g
            LEFT JOIN 
                Grasswren.OBSERVATION AS o ON g.wren_id = o.wren_id
        ) sub
        WHERE rn <= 50;
    `;

    queryDatabase(sql, [], res, result => {
        if (result.length === 0) {
            res.status(404).send('No Grasswren data found.');
            return;
        }

        // Optional: Reduce data to group observations under each common name
        const groupedResults = result.reduce((acc, item) => {
            if (!acc[item.common_name]) {
                acc[item.common_name] = {
                    common_name: item.common_name,
                    observations: []
                };
            }
            if (item.obs_lat && item.obs_lon && item.obs_date) {
                acc[item.common_name].observations.push({
                    lat: item.obs_lat,
                    lon: item.obs_lon,
                    date: item.obs_date
                });
            }
            return acc;
        }, {});

        res.send(Object.values(groupedResults));
    });
});


// Get if user are close to grasswren
// Endpoint to check for nearby grasswrens
server.get('/api/grasswren/geo/nearby', async (req, res) => {
    console.log('Checking for nearby Grasswrens...');
    const { postcode } = req.query;
    console.log('Postcode:', postcode);
    if (!postcode) {
        res.status(400).send('Postcode is required.');
        return;
    }

    const coords = await geocodePostcode(postcode);
    if (!coords) {
        res.status(404).send('Invalid postcode or no data available.');
        return;
    }
    console.log('Geocoded coordinates:', coords);

    const { latitude, longitude } = coords;
    const queryRadius = 100; // Radius in kilometers
    const sql = `
        SELECT wren_id, obs_lat, obs_lon,
            (6371 * acos(cos(radians(?)) * cos(radians(obs_lat)) *
            cos(radians(obs_lon) - radians(?)) + sin(radians(?)) *
            sin(radians(obs_lat)))) AS distance
        FROM OBSERVATION
        WHERE wren_id IS NOT NULL
        HAVING distance < ?
        ORDER BY distance;
    `;
    const params = [latitude, longitude, latitude, queryRadius];

    queryDatabase(sql, params, res, result => {
        if (result.length === 0) {
            res.send({ nearby: false });
            return;
        }
        res.send({ nearby: true, observations: result });
    });
});

// Get fire points for a specific type of fire
server.get('/api/risk/firepoints', (req, res) => {
    const query = "SELECT fire_date, geometry AS first_point FROM FIRE;";
    queryDatabase(query, [], res, result => {
        res.send(result);
    });
});

// Get fire data including date, type, and state
server.get('/api/risk/firedata', (req, res) => {
    const query = 'SELECT fire_date, fire_type, state FROM FIRE ORDER BY fire_date';
    queryDatabase(query, [], res, result => {
        res.send(result);
    });
});

server.get('/api/risk/estimate', async (req, res) => {
    const { postcode, currentDate } = req.query;

    if (!postcode || !currentDate) {
        return res.status(400).send("Both postcode and current date are required.");
    }

    try {
        const coords = await geocodePostcode(postcode);
        if (!coords) {
            return res.status(404).send("Coordinates not found for the provided postcode.");
        }

        const { latitude, longitude } = coords;
        const currentMoment = moment(currentDate);
        const nextMonthMoment = moment(currentDate).add(1, 'months');

        const query = `
            SELECT 
                COUNT(*) AS count, 
                fire_date,
                MONTH(fire_date) AS month,
                ROUND(ST_Distance_Sphere(geometry, POINT(?, ?)) / 1000, 2) AS distance_km  -- Distance in kilometers
            FROM FIRE
            WHERE ST_Distance_Sphere(geometry, POINT(?, ?)) <= 200000  -- Within 100 km radius
            GROUP BY YEAR(fire_date), MONTH(fire_date)
            ORDER BY fire_date DESC
            LIMIT 200;  -- Limit to 100 historical points
        `;

        queryDatabase(query, [longitude, latitude, longitude, latitude], res, results => {
            const nextMonthData = results.filter(r => {
                const fireMoment = moment(r.fire_date);
                return fireMoment.year() === nextMonthMoment.year() && fireMoment.month() === nextMonthMoment.month();
            });

            const totalFires = results.length;
            const nextMonthFires = nextMonthData.length;
            const probability = (nextMonthFires / totalFires) * 100;

            // Risk levels based on probability
            let riskLevel;
            if (probability > 75) {
                riskLevel = 'High';
            } else if (probability > 50) {
                riskLevel = 'Moderate';
            } else if (probability > 25) {
                riskLevel = 'Low';
            } else {
                riskLevel = 'Very Low';
            }

            res.send({
                latitude,
                longitude,
                riskLevel,
                probability: `${probability.toFixed(2)}%`,
                historicalData: results.map(r => ({
                    count: r.count,
                    fire_date: r.fire_date,
                    distance_km: r.distance_km,
                    month: r.month
                }))
            });
        });

    } catch (error) {
        console.error('Error processing request:', error);
        res.status(500).send("An error occurred while processing your request.");
    }
});

server.get('/api/risk/predators', (req, res) => {
    const sql = `
        SELECT obs.obs_date, obs.obs_lat, obs.obs_lon, p.pre_name
        FROM OBSERVATION AS obs 
        JOIN PREDATOR AS p ON obs.pre_id = p.pre_id
        WHERE obs.pre_id IS NOT NULL;
    `;

    queryDatabase(sql, [], res, result => {
        if (result.length === 0) {
            res.status(404).send('No predator location found.');
            return;
        }

        // Group the data by predator name
        const groupedData = result.reduce((acc, item) => {
            // Initialize the predator group if it doesn't already exist
            if (!acc[item.pre_name]) {
                acc[item.pre_name] = [];
            }

            // Add the observation to the correct predator group
            acc[item.pre_name].push({
                obs_date: item.obs_date,
                obs_lat: item.obs_lat,
                obs_lon: item.obs_lon
            });

            return acc;
        }, {});

        res.json(groupedData);
    });
});

server.get('/api/risk/predatorsdata', (req, res) => {
    const sql = `
        SELECT obs.obs_date, p.pre_name
        FROM OBSERVATION AS obs 
        JOIN PREDATOR AS p ON obs.pre_id = p.pre_id
        WHERE obs.pre_id IS NOT NULL;
    `;

    queryDatabase(sql, [], res, result => {
        if (result.length === 0) {
            res.status(404).send('No predator data found.');
            return;
        }
        res.status(200).send(result);
    });
});


server.get('/api/risk/human', async (req, res) => {
    try {
        // Query for camping data
        const campingData = await new Promise((resolve, reject) => {
            const campingSql = "SELECT * FROM CAMPING";
            queryDatabase(campingSql, [], res, (result) => {
                if (result.length === 0) {
                    reject('No camping data found.');
                } else {
                    resolve(result);
                }
            });
        });

        // Query for hunting data
        const huntingData = await new Promise((resolve, reject) => {
            const huntingSql = "SELECT * FROM HUNTING";
            queryDatabase(huntingSql, [], res, (result) => {
                if (result.length === 0) {
                    reject('No hunting data found.');
                } else {
                    resolve(result);
                }
            });
        });

        // Combine all results into a single object categorized by type
        const responseData = {
            camping: campingData,
            hunting: huntingData
        };

        // Send the combined response
        res.json(responseData);
    } catch (error) {
        console.error('Failed to retrieve data:', error);
        res.status(500).send(error);
    }
});




server.listen(PORT, () => {
    console.log('Server is running on port', PORT);
}
);