const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const url = require('url');
const mongodb = require('mongodb');
const cors = require('cors');
const bodyParser = require('body-parser');
const MongoClient = mongodb.MongoClient;

const PORT = 6969;
const server = http.createServer(express);
const wss = new WebSocket.Server({server});
const mongoClient = new MongoClient('mongodb://localhost:27017');

const app = express();

app.use(cors());

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.post('/rooms', (req, res) => {
    const { room } = req.body;

    mongoClient.connect((err, client) => {
        const db = client.db('testdb');
        const collection = db.collection('room');
        collection.insertOne({
            name: room
        }, (err, result) => {
            client.close();
        });
    });
    
    res.send({
        status: 'ok'
    });
})

app.get('/rooms', (req, res) => {
    mongoClient.connect(async (err, client) => {
        const db = client.db('testdb');
        const collection = db.collection('room');
        const rooms = await collection.find().toArray();
        res.send({
            rooms: rooms
        })
    });
})

wss.on('connection', (ws, req) => {
    const {query: {name}} = url.parse(req.url, true);
    ws.name = name;
    mongoClient.connect((err, client) => {
        const db = client.db('testdb');
        const collection = db.collection('message');
        collection.find({room: name}).toArray((err, results) => {
            results.forEach(message => {
                ws.send(JSON.stringify(message));
            })
            client.close();
        })
    });

    ws.on('message', (data, isBinary) => {
        mongoClient.connect((err, client) => {
            const db = client.db('testdb');
            const collection = db.collection('message');
            collection.insertOne({
                message: (JSON.parse(data)).message,
                room: ws.name
            }, (err, result) => {
                client.close();
            });
        });
        wss.clients.forEach(client => {
            if (client !== ws && client.name === ws.name && client.readyState === WebSocket.OPEN ) {
                client.send(data, {binary: isBinary});
            }
        })
    })
});

app.listen(5000, () => {
    console.log(`Http Server is listening on port 5000`)
})

server.listen(PORT, () => {
    console.log(`Websocket Server is listening on port ${PORT}`);
})