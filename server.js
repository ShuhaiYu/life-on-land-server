import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import 'dotenv/config';


const server = express();
let PORT = 3000;

server.use(cors());
server.use(express.json());

server.listen(PORT, () => {
    console.log('Server is running on port', PORT);
    }
);